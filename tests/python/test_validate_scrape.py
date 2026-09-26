"""scripts/validate_scrape.py: the checks that stop a bad scrape replacing good data."""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent
_spec = importlib.util.spec_from_file_location("validate_scrape", ROOT / "scripts" / "validate_scrape.py")
vs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vs)


def rows(n, tc="90+30", url="https://chess-results.com/tnr1.aspx"):
    return [{"name": f"T{i}", "timeControl": tc, "url": url} for i in range(n)]


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
    assert any("link" in p for p in problems)


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
