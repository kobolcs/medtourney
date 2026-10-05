from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest

from scripts.report_tourneyradar_coverage import build_report


def row(event_id: int, country: str = "DE", name: str = "Open") -> dict[str, object]:
    return {
        "id": f"cr_{event_id}",
        "name": name,
        "city": "Berlin",
        "country": "Germany",
        "country_code": country,
        "date": "2026-11-01",
        "end_date": "2026-11-02",
        "category": "Classical",
        "time_control": "90+30",
        "source_url": f"https://chess-results.com/tnr{event_id}.aspx?lan=1",
    }


def test_build_report_paginates_deduplicates_by_event_id_and_keeps_sections_distinct() -> None:
    pages = {
        ("DE", 1): {
            "data": [row(100), row(200), row(201, name="Open")],
            "meta": {"hasMore": True},
        },
        ("DE", 2): {"data": [row(200)], "meta": {"hasMore": False}},
        ("FR", 1): {"data": [row(200, "FR"), row(300, "FR")], "meta": {"hasMore": False}},
    }
    requests: list[tuple[str, int]] = []

    def get_page(url: str) -> dict:
        query = parse_qs(urlparse(url).query)
        key = (query["country"][0], int(query["page"][0]))
        requests.append(key)
        return pages[key]

    report = build_report(["DE", "FR"], {"100"}, get_page, sleep=lambda _seconds: None)

    assert requests == [("DE", 1), ("DE", 2), ("FR", 1)]
    assert report["totals"] == {
        "apiRows": 6,
        "validRows": 6,
        "existingEventIds": 1,
        "candidateCount": 3,
        "duplicateRows": 2,
        "rejectedRows": 0,
    }
    candidates = report["candidates"]
    assert [candidate["eventId"] for candidate in candidates] == ["200", "201", "300"]
    assert candidates[0]["sourceUrl"] == "https://chess-results.com/tnr200.aspx?lan=1"


def test_build_report_rejects_malformed_or_non_chess_results_rows() -> None:
    invalid = [
        {**row(101), "date": "not-a-date"},
        {**row(102), "source_url": "https://example.com/tnr102.aspx"},
        {**row(103), "country_code": "FR"},
        None,
    ]
    report = build_report(
        ["DE"],
        set(),
        lambda _url: {"data": invalid, "meta": {"hasMore": False}},
        sleep=lambda _seconds: None,
    )

    assert report["totals"]["apiRows"] == 4
    assert report["totals"]["rejectedRows"] == 4
    assert report["candidates"] == []


def test_build_report_refuses_incomplete_results_at_request_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("scripts.report_tourneyradar_coverage.MAX_REQUESTS", 1)
    calls = 0

    def get_page(_url: str) -> dict:
        nonlocal calls
        calls += 1
        return {"data": [], "meta": {"hasMore": True}}

    with pytest.raises(RuntimeError, match="report is incomplete"):
        build_report(["DE"], set(), get_page, sleep=lambda _seconds: None)
    assert calls == 1
