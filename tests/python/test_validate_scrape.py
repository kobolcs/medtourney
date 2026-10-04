"""scripts/validate_scrape.py: the checks that stop a bad scrape replacing good data."""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
_spec = importlib.util.spec_from_file_location("validate_scrape", ROOT / "scripts" / "validate_scrape.py")
vs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vs)


def rows(n, tc="90+30", url="https://chess-results.com/tnr1.aspx"):
    return [{"name": f"T{i}", "location": "Barcelona, ESP", "category": "Open",
             "description": "", "date": "2026-10-04", "timeControl": tc, "url": url}
            for i in range(n)]


def test_healthy_scrape_passes():
    assert vs.check(rows(1000), rows(1100)) == []


def test_too_few_rows_fails():
    assert "only 5 tournaments" in vs.check(rows(5), None)[0]


def test_big_drop_vs_previous_fails():
    problems = vs.check(rows(500), rows(1500))
    assert any("vs 1500 last run" in p for p in problems)


def test_big_drop_allowed_when_forced():
    assert vs.check(rows(500), rows(1500), allow_drop=True) == []


def test_small_previous_run_is_not_compared():
    assert vs.check(rows(20), rows(90)) == []


def test_empty_time_control_column_fails():
    problems = vs.check(rows(1000, tc=""), rows(1000))
    assert any("time control" in p for p in problems)


def test_missing_links_fail():
    problems = vs.check(rows(1000, url=None), None)
    assert any("url" in p.lower() for p in problems)


def test_main_exit_codes(tmp_path, monkeypatch):
    good, prev = tmp_path / "new.json", tmp_path / "prev.json"
    good.write_text(json.dumps(rows(1000)))
    prev.write_text(json.dumps(rows(1000)))
    assert vs.main(["x", str(good), str(prev)]) == 0

    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(rows(100)))
    assert vs.main(["x", str(bad), str(prev)]) == 1
    monkeypatch.setenv("ALLOW_DATA_DROP", "1")
    assert vs.main(["x", str(bad), str(prev)]) == 0


def test_missing_previous_file_is_tolerated(tmp_path):
    good = tmp_path / "new.json"
    good.write_text(json.dumps(rows(50)))
    assert vs.main(["x", str(good), str(tmp_path / "nope.json")]) == 0


def test_malformed_rows_fail_without_crashing():
    for bad in (None, "row", {}, {**rows(1)[0], "date": "2026-02-30"},
                {**rows(1)[0], "dateTo": "2026-10-01"}):
        assert vs.check([bad, *rows(10)], None)


def test_final_enrichment_bounds_are_validated():
    for extra in ({"lat": 100}, {"lng": float("nan")}, {"coast": "bad"}):
        assert vs.check([{**row, **extra} for row in rows(10)], None)


def test_invalid_json_fails_cleanly(tmp_path):
    path = tmp_path / "bad.json"
    path.write_text("{truncated")
    assert vs.main(["x", str(path)]) == 1


def test_sidecar_must_match_published_count(tmp_path):
    data, meta = tmp_path / "data.json", tmp_path / "meta.json"
    data.write_text(json.dumps(rows(10)))
    meta.write_text(json.dumps({"generatedAt": "2026-10-04T00:00:00Z", "keptRows": 10}))
    assert vs.main(["x", str(data), "missing", str(meta)]) == 0
    meta.write_text(json.dumps({"generatedAt": "2026-10-04T00:00:00Z", "keptRows": 11}))
    assert vs.main(["x", str(data), "missing", str(meta)]) == 1
