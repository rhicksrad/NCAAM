from __future__ import annotations

import json
from pathlib import Path

from scripts.goat_metrics import (
    RECENT_SEASON_SPAN,
    RECENT_SEASON_START,
    compute_recent_goat_scores,
    format_season_window,
)

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data"


def _load_json(name: str) -> dict:
    path = DATA_DIR / name
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def test_goat_recent_structure() -> None:
    payload = _load_json("goat_recent.json")
    assert payload.get("metric") == "Rolling three-year GOAT index"
    assert payload.get("window") == format_season_window(RECENT_SEASON_START, RECENT_SEASON_SPAN)

    players = payload.get("players") or []
    assert players, "GOAT recent payload should include players"

    previous_score = float("inf")
    for expected_rank, entry in enumerate(players, start=1):
        assert entry.get("rank") == expected_rank
        score = entry.get("score")
        assert isinstance(score, (int, float)) and 0 <= score <= 100
        assert score <= previous_score + 1e-9
        previous_score = score
        assert isinstance(entry.get("personId"), str) and entry["personId"].strip()
        assert isinstance(entry.get("name"), str) and entry["name"].strip()
        assert isinstance(entry.get("team"), str)
        assert isinstance(entry.get("blurb"), str)


def test_goat_recent_matches_profiles() -> None:
    recent = _load_json("goat_recent.json").get("players") or []
    profiles = _load_json("player_profiles.json").get("players") or []
    profile_by_id = {
        str(profile.get("personId")): profile
        for profile in profiles
        if profile.get("personId")
    }
    assert profile_by_id, "Player profiles payload should expose personId fields"

    for entry in recent:
        person_id = str(entry.get("personId"))
        assert person_id in profile_by_id, f"Missing player profile for {person_id}"
        profile = profile_by_id[person_id]
        assert profile.get("goatRecentScore") == entry.get("score")
        assert profile.get("goatRecentRank") == entry.get("rank")


def test_recent_scores_penalize_small_samples() -> None:
    rows: list[dict[str, str]] = []
    # Player with an extended sample of strong production.
    for _ in range(50):
        rows.append(
            {
                "personId": "big-sample",
                "gameDate": "2023-01-15",
                "numMinutes": "30",
                "points": "20",
                "assists": "5",
                "reboundsTotal": "8",
                "steals": "1",
                "blocks": "1",
                "win": "1",
                "plusMinusPoints": "8",
            }
        )
    # Player with a tiny sample but extreme per-minute numbers.
    for _ in range(2):
        rows.append(
            {
                "personId": "small-sample",
                "gameDate": "2024-10-20",
                "numMinutes": "20",
                "points": "25",
                "assists": "8",
                "reboundsTotal": "5",
                "steals": "2",
                "blocks": "2",
                "win": "1",
                "plusMinusPoints": "15",
            }
        )

    scores = compute_recent_goat_scores(rows, {"big-sample", "small-sample"})
    assert scores["big-sample"]["score"] > scores["small-sample"]["score"]
    assert scores["big-sample"]["rank"] == 1
    assert scores["small-sample"]["rank"] == 2
    # Ensure the small sample receives a meaningful penalty despite high production.
    assert scores["small-sample"]["score"] < 30
