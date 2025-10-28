#!/usr/bin/env python3
"""Build per-player scoring averages for the 2024-25 season."""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Dict

# Compute project root and enable first-party imports.
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.build_insights import (  # noqa: E402
    PlayerStatisticsStreamError,
    iter_player_statistics_rows,
)

TARGET_SEASON_START = 2024
OUTPUT_PATH = ROOT / "data" / "2025-26" / "canonical" / "player_scoring_averages.json"


def _season_start_year(date_str: str | None) -> int | None:
    if not date_str:
        return None
    try:
        year = int(date_str[0:4])
        month = int(date_str[5:7])
    except (ValueError, IndexError):
        return None
    return year if month >= 10 else year - 1


def _to_float(value: str | None) -> float:
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def main() -> None:
    totals: Dict[str, Dict[str, object]] = defaultdict(
        lambda: {"points": 0.0, "games": 0.0, "firstName": "", "lastName": ""}
    )

    try:
        rows = iter_player_statistics_rows()
    except PlayerStatisticsStreamError as exc:  # pragma: no cover - defensive guard
        # Preserve original cause for debugging (Ruff B904).
        raise SystemExit(str(exc)) from exc

    for row in rows:
        game_type = (row.get("gameType") or "").strip().lower()
        if game_type != "regular season":
            continue

        season_start = _season_start_year((row.get("gameDate") or "").strip())
        if season_start != TARGET_SEASON_START:
            continue

        minutes = _to_float(row.get("numMinutes"))
        if minutes <= 0:
            continue

        player_id = (row.get("personId") or "").strip()
        if not player_id:
            continue

        points = _to_float(row.get("points"))
        bucket = totals[player_id]
        bucket["points"] = float(bucket.get("points", 0.0)) + points
        bucket["games"] = float(bucket.get("games", 0.0)) + 1
        first_name = (row.get("firstName") or "").strip()
        last_name = (row.get("lastName") or "").strip()
        if first_name and not bucket.get("firstName"):
            bucket["firstName"] = first_name
        if last_name and not bucket.get("lastName"):
            bucket["lastName"] = last_name

    players = []
    for player_id, bucket in totals.items():
        games = float(bucket.get("games", 0.0))
        if games <= 0:
            continue
        points_per_game = float(bucket.get("points", 0.0)) / games
        first_name = str(bucket.get("firstName") or "").strip()
        last_name = str(bucket.get("lastName") or "").strip()
        full_name = " ".join(part for part in (first_name, last_name) if part).strip() or None
        players.append(
            {
                "playerId": player_id,
                "gamesPlayed": int(games),
                "pointsPerGame": round(points_per_game, 2),
                "firstName": first_name or None,
                "lastName": last_name or None,
                "name": full_name,
            }
        )

    players.sort(
        key=lambda item: (item["pointsPerGame"], item["gamesPlayed"], item["playerId"]),
        reverse=True,
    )

    payload = {
        "season": "2024-25",
        "generatedAt": datetime.now(UTC).isoformat(timespec="seconds"),
        "players": players,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
