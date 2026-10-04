"""Workflow regressions for metadata publication and post-enrichment validation."""

import os
import subprocess
import textwrap
from pathlib import Path

WORKFLOW = Path(__file__).parents[2] / ".github/workflows/update-tournaments.yml"


def step_block(name):
    return WORKFLOW.read_text().split(f"      - name: {name}\n", 1)[1].split("\n      - name: ", 1)[0]


def test_metadata_only_refresh_is_a_publishable_change(tmp_path):
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=tmp_path, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, check=True)
    for name in ("tournaments_data.json", "tournaments_data_meta.json", "geocode_cache.json", "details_cache.json"):
        (tmp_path / name).write_text("[]")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True)
    subprocess.run(["git", "commit", "-qm", "fixture"], cwd=tmp_path, check=True)
    (tmp_path / "tournaments_data_meta.json").write_text('{"generatedAt":"2026-10-04T00:00:00Z"}')
    output = tmp_path / "output"
    check_step = step_block("Check if tournament data or metadata was updated")
    script = textwrap.dedent(check_step.split("        run: |\n", 1)[1])
    subprocess.run(["bash", "-e", "-c", script], cwd=tmp_path,
                   env={**os.environ, "GITHUB_OUTPUT": str(output)}, check=True)
    assert "changed=true" in output.read_text()


def test_final_validation_precedes_any_publish():
    workflow = WORKFLOW.read_text()
    assert workflow.index("Fetch tournament details from chess-results.com") < workflow.index("Validate final enriched snapshot")
    assert workflow.index("Validate final enriched snapshot") < workflow.index("Commit and push changes")
    validator = step_block("Validate final enriched snapshot")
    assert "continue-on-error: true" not in validator
    assert "tournaments_data_meta.json" in validator
