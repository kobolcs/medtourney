"""chess-results.com tournament details: parser (real saved pages) and fetch pipeline (no network)."""

import json
import urllib.error
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from details import pipeline
from details.parse import fide_url, parse_details, parse_schedule

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 9, 26, 12, tzinfo=UTC)


def page(tid: str) -> str:
    return (FIXTURES / f"chess_results_details_{tid}.html").read_text(encoding="utf-8")


def schedule_page(tid: str) -> str:
    return (FIXTURES / f"chess_results_schedule_{tid}.html").read_text(encoding="utf-8")


def tournament(tid: str, date: str = "2026-10-01") -> dict:
    return {"name": f"T{tid}", "url": f"https://chess-results.com/tnr{tid}.aspx?lan=1", "date": date}


class TestParse:
    def test_full_page(self) -> None:
        assert parse_details(page("1489548")) == {
            "organizer": "Double Rook",
            "rounds": 7,
            "system": "Swiss-System",
            "rated": ["Rating national", "Rating international"],
            "fideId": "452939",
            "address": "1, 5 Park Rd, Shanklin PO37 6BB",
            "homepage": "https://www.iowchess.com/event-details/isle-of-wight-winter-chess-tournament-adu",
        }

    def test_missing_fields_are_left_out(self) -> None:
        # Not FIDE-rated ("Rating calculation: -"), no homepage link
        assert parse_details(page("1502197")) == {
            "organizer": "Shopping City, Sah in Scoala, ACS Chess Family",
            "rounds": 6,
            "system": "Swiss-System",
            "address": "Shopping City Timisoara",
        }

    def test_not_a_details_page(self) -> None:
        assert parse_details("<html><body>Object moved</body></html>") == {}

    def test_fide_url(self) -> None:
        assert fide_url("452939") == "https://ratings.fide.com/tournament_information.phtml?event=452939"

    def test_regulations_pdf_extracted(self) -> None:
        html = (
            '<tr><td class="CRnowrap b">Links</td><td class="CR">'
            '<a href="https://example.com/regs.pdf">Regulations</a>, '
            '<a href="https://example.com/">Homepage</a>'
            "</td></tr>"
        )
        result = parse_details(html)
        assert result.get("regulationsUrl") == "https://example.com/regs.pdf"

    def test_regulations_pdf_not_in_non_pdf_links(self) -> None:
        result = parse_details(page("1489548"))
        assert "regulationsUrl" not in result


class TestSchedule:
    def test_parse_schedule_from_fixture(self) -> None:
        rounds = parse_schedule(schedule_page("1489548"))
        assert len(rounds) == 7
        assert rounds[0] == {"round": 1, "date": "2026-11-10", "time": "10:00"}
        assert rounds[1] == {"round": 2, "date": "2026-11-10", "time": "15:00"}
        assert rounds[6] == {"round": 7, "date": "2026-11-13", "time": "10:00"}

    def test_parse_schedule_three_digit_time(self) -> None:
        html = (
            '<h2>Playing schedule</h2>'
            '<table class="CRs1"><tr><th>Round</th><th>Date</th><th>Time</th></tr>'
            '<tr><td>1</td><td>2026/10/05</td><td>900</td></tr></table>'
        )
        rounds = parse_schedule(html)
        assert rounds == [{"round": 1, "date": "2026-10-05", "time": "09:00"}]

    def test_parse_schedule_missing_time(self) -> None:
        html = (
            '<h2>Playing schedule</h2>'
            '<table class="CRs1"><tr><th>Round</th><th>Date</th><th>Time</th></tr>'
            '<tr><td>1</td><td>2026/10/05</td><td></td></tr></table>'
        )
        rounds = parse_schedule(html)
        assert rounds == [{"round": 1, "date": "2026-10-05"}]

    def test_parse_schedule_no_table(self) -> None:
        assert parse_schedule("<html><body>no schedule here</body></html>") == []
        assert parse_schedule(page("1489548")) == []  # details page has no schedule


class TestFetchPolicy:
    def test_tournament_id(self) -> None:
        assert pipeline.tournament_id("https://chess-results.com/tnr1489548.aspx?lan=1") == "1489548"
        assert pipeline.tournament_id("https://example.com/") is None

    @pytest.mark.parametrize(
        ("entry", "is_due"),
        [
            (None, True),
            ({"fetched": (NOW - timedelta(days=13)).isoformat(), "details": {"rounds": 7}}, False),
            ({"fetched": (NOW - timedelta(days=15)).isoformat(), "details": {"rounds": 7}}, True),
            ({"fetched": (NOW - timedelta(days=2)).isoformat(), "details": {}}, False),
            ({"fetched": (NOW - timedelta(days=4)).isoformat(), "details": {}}, True),
            ({"details": {"rounds": 7}}, True),
        ],
    )
    def test_due(self, entry, is_due) -> None:
        assert pipeline.due(entry, NOW) is is_due

    def test_never_fetched_first_soonest_first_capped_and_paced(self) -> None:
        tournaments = [tournament("3", "2026-12-01"), tournament("1", "2026-10-01"), tournament("2", "2026-11-01")]
        cache = {"1": {"fetched": (NOW - timedelta(days=30)).isoformat(), "details": {"rounds": 5}}}
        asked, slept = [], []
        stats = pipeline.fetch_due(
            tournaments, cache, fetch=lambda url: asked.append(url) or page("1489548"),
            max_fetches=2, sleep=slept.append, now=NOW,
        )
        assert [pipeline.tournament_id(u) for u in asked] == ["2", "3"]  # stale "1" waits for the next run
        assert slept == [pipeline.REQUEST_INTERVAL_S]
        assert stats == {"fetched": 2, "found": 2, "errors": 0}
        assert cache["2"]["details"]["rounds"] == 7

    def test_blocked_stops_the_run(self) -> None:
        def refuse(_url: str) -> str:
            status = "429"
            raise pipeline.Blocked(status)

        stats = pipeline.fetch_due([tournament("1"), tournament("2")], {}, fetch=refuse, sleep=lambda _s: None, now=NOW)
        assert stats == {"fetched": 1, "found": 0, "errors": 1}

    def test_errors_in_a_row_stop_the_run_and_are_not_cached(self) -> None:
        def fail(_url: str) -> str:
            reason = "offline"
            raise urllib.error.URLError(reason)

        cache: dict = {}
        many = [tournament(str(i)) for i in range(10)]
        stats = pipeline.fetch_due(many, cache, fetch=fail, sleep=lambda _s: None, now=NOW)
        assert stats["errors"] == pipeline.MAX_CONSECUTIVE_ERRORS
        assert cache == {}

    def test_annotate_adds_and_removes(self) -> None:
        tournaments = [tournament("1"), {**tournament("2"), "details": {"rounds": 1}}]
        count = pipeline.annotate(tournaments, {"1": {"details": {"rounds": 7}}, "2": {"details": {}}})
        assert count == 1
        assert tournaments[0]["details"] == {"rounds": 7}
        assert "details" not in tournaments[1]

    def test_annotate_injects_schedule(self) -> None:
        t = tournament("1")
        schedule = [{"round": 1, "date": "2026-11-10", "time": "10:00"}]
        pipeline.annotate([t], {"1": {"details": {"rounds": 7}, "schedule": schedule}})
        assert t["details"]["schedule"] == schedule

    def test_annotate_does_not_mutate_cache(self) -> None:
        cache = {"1": {"details": {"rounds": 7}}}
        t = tournament("1")
        schedule = [{"round": 1, "date": "2026-11-10", "time": "10:00"}]
        cache["1"]["schedule"] = schedule
        pipeline.annotate([t], cache)
        # Cache's details dict must not have been modified
        assert "schedule" not in cache["1"]["details"]


class TestSchedulePipeline:
    def multi_day(self, tid: str) -> dict:
        return {**tournament(tid), "dateTo": "2026-11-13"}

    def test_fetch_schedules_skips_single_day(self) -> None:
        asked = []
        pipeline.fetch_schedules_due(
            [tournament("1")], {}, fetch=lambda u: asked.append(u) or "", sleep=lambda _s: None,
        )
        assert asked == []

    def test_fetch_schedules_fetches_multi_day(self) -> None:
        asked, slept = [], []
        sched_html = schedule_page("1489548")
        cache: dict = {}
        stats = pipeline.fetch_schedules_due(
            [self.multi_day("1489548")], cache,
            fetch=lambda u: asked.append(u) or sched_html,
            sleep=slept.append,
        )
        assert stats == {"fetched": 1, "errors": 0}
        assert len(cache["1489548"]["schedule"]) == 7
        assert cache["1489548"]["schedule"][0] == {"round": 1, "date": "2026-11-10", "time": "10:00"}

    def test_fetch_schedules_skips_already_cached(self) -> None:
        cache = {"1": {"schedule": []}}
        asked = []
        pipeline.fetch_schedules_due(
            [self.multi_day("1")], cache,
            fetch=lambda u: asked.append(u) or "",
            sleep=lambda _s: None,
        )
        assert asked == []

    def test_fetch_schedules_blocked_stops(self) -> None:
        def refuse(_u: str) -> str:
            status = "403"
            raise pipeline.Blocked(status)

        cache: dict = {}
        stats = pipeline.fetch_schedules_due(
            [self.multi_day("1"), self.multi_day("2")], cache,
            fetch=refuse, sleep=lambda _s: None,
        )
        assert stats == {"fetched": 1, "errors": 1}


def test_update_file(tmp_path: Path) -> None:
    data, cache = tmp_path / "data.json", tmp_path / "cache.json"
    data.write_text(json.dumps([tournament("1489548")]), encoding="utf-8")
    stats = pipeline.update_file(data, cache, fetch=lambda _u: page("1489548"), sleep=lambda _s: None)
    assert stats["with_details"] == 1
    assert json.loads(data.read_text(encoding="utf-8"))[0]["details"]["fideId"] == "452939"
    assert "1489548" in json.loads(cache.read_text(encoding="utf-8"))
    # Second run: cached, nothing fetched
    again = pipeline.update_file(data, cache, fetch=lambda _u: pytest.fail("fetched again"), sleep=lambda _s: None)
    assert again["fetched"] == 0


def test_update_file_with_schedule(tmp_path: Path) -> None:
    data, cache = tmp_path / "data.json", tmp_path / "cache.json"
    t = {"name": "IoW", "url": "https://chess-results.com/tnr1489548.aspx?lan=1",
         "date": "2026-11-10", "dateTo": "2026-11-13"}
    data.write_text(json.dumps([t]), encoding="utf-8")

    pages = {
        "turdet=YES": page("1489548"),
        "art=14": schedule_page("1489548"),
    }
    stats = pipeline.update_file(
        data, cache,
        fetch=lambda u: next(v for k, v in pages.items() if k in u),
        sleep=lambda _s: None,
    )
    assert stats["schedules_fetched"] == 1
    result = json.loads(data.read_text(encoding="utf-8"))[0]
    assert result["details"]["fideId"] == "452939"
    assert len(result["details"]["schedule"]) == 7
