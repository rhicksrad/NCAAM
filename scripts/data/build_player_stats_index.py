#!/usr/bin/env python3
"""Build per-player season averages from the archived PlayerStatistics feed."""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Dict, Iterable, Tuple

# Compute repository root and enable first-party imports.
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from scripts.build_insights import (  # noqa: E402
    PlayerStatisticsStreamError,
    iter_player_statistics_rows,
)

OUTPUT_PATH = ROOT / "public" / "data" / "player_stats.json"
SEASON_CONFIG_PATH = ROOT / "scripts" / "lib" / "season.ts"


@dataclass
class PlayerTotals:
    """Mutable aggregate of a player's season totals."""

    player_id: int
    games: int = 0
    seconds: float = 0.0
    pts: float = 0.0
    reb: float = 0.0
    ast: float = 0.0
    stl: float = 0.0
    blk: float = 0.0
    tov: float = 0.0
    fgm: float = 0.0
    fga: float = 0.0
    fg3m: float = 0.0
    fg3a: float = 0.0
    ftm: float = 0.0
    fta: float = 0.0
    team_id: int | None = None
    team_abbr: str | None = None


def _load_season_label() -> str:
    """Extract the active season label from the TypeScript config."""

    try:
        content = SEASON_CONFIG_PATH.read_text(encoding="utf-8")
    except OSError as exc:  # pragma: no cover - defensive guard
        raise SystemExit(f"Unable to read {SEASON_CONFIG_PATH}: {exc}") from exc

    match = re.search(r'SEASON\s*=\s*"(?P<label>\d{4}-\d{2})"', content)
    if not match:
        raise SystemExit("Failed to parse active season from scripts/lib/season.ts")
    return match.group("label")


def _season_start_year(label: str) -> int:
    start, *_ = label.split("-", 1)
    try:
        return int(start)
    except ValueError as exc:  # pragma: no cover - defensive guard
        raise SystemExit(f"Invalid season label: {label}") from exc


def _infer_season_start(date_str: str | None) -> int | None:
    if not date_str:
        return None
    text = date_str.strip()
    if not text:
        return None
    # The archive uses ``YYYY-MM-DD HH:MM:SS`` without timezone information.
    try:
        parsed = datetime.strptime(text[:19], "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None
    return parsed.year if parsed.month >= 10 else parsed.year - 1


def _parse_number(value: str | None) -> float:
    if value is None:
        return 0.0
    text = value.strip()
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _parse_minutes(value: str | None) -> float:
    minutes = _parse_number(value)
    if minutes <= 0:
        return 0.0
    return minutes * 60.0


def _normalise_team_key(city: str | None, name: str | None) -> str | None:
    parts = []
    if city:
        parts.append(city.strip().lower())
    if name:
        parts.append(name.strip().lower())
    if not parts:
        return None
    return "::".join(parts)


def _load_team_lookup() -> Dict[str, Tuple[int, str]]:
    """Parse team metadata from the TypeScript source for cross-linking."""

    try:
        content = (ROOT / "scripts" / "lib" / "teams.ts").read_text(encoding="utf-8")
    except OSError:
        return {}

    pattern = re.compile(
        r"\{\s*teamId:\s*\"(?P<id>\d+)\",\s*tricode:\s*\"(?P<tricode>[A-Z]+)\",\s*market:\s*\"(?P<market>[^\"]+)\",\s*name:\s*\"(?P<name>[^\"]+)\"",
    )

    lookup: Dict[str, Tuple[int, str]] = {}
    for match in pattern.finditer(content):
        team_id = int(match.group("id"))
        tricode = match.group("tricode")
        market = match.group("market")
        name = match.group("name")
        key = _normalise_team_key(market, name)
        if key:
            lookup[key] = (team_id, tricode)
    return lookup


def _iter_regular_season_rows(target_start_year: int) -> Iterable[dict[str, str]]:
    try:
        rows = iter_player_statistics_rows()
    except PlayerStatisticsStreamError as exc:  # pragma: no cover - defensive guard
        raise SystemExit(str(exc)) from exc

    for row in rows:
        season_start = _infer_season_start(row.get("gameDate"))
        if season_start != target_start_year:
            continue
        game_type = (row.get("gameType") or "").strip().lower()
        if game_type != "regular season":
            continue
        yield row


def _season_counts() -> Counter[int]:
    counts: Counter[int] = Counter()
    try:
        rows = iter_player_statistics_rows()
    except PlayerStatisticsStreamError as exc:  # pragma: no cover - defensive guard
        raise SystemExit(str(exc)) from exc

    for row in rows:
        season_start = _infer_season_start(row.get("gameDate"))
        if season_start is not None:
            counts[season_start] += 1
    return counts


def _accumulate(bucket: PlayerTotals, row: dict[str, str], lookup: Dict[str, Tuple[int, str]]) -> None:
    minutes = _parse_minutes(row.get("numMinutes"))
    if minutes <= 0:
        return

    bucket.games += 1
    bucket.seconds += minutes
    bucket.pts += _parse_number(row.get("points"))
    bucket.reb += _parse_number(row.get("reboundsTotal"))
    bucket.ast += _parse_number(row.get("assists"))
    bucket.stl += _parse_number(row.get("steals"))
    bucket.blk += _parse_number(row.get("blocks"))
    bucket.tov += _parse_number(row.get("turnovers"))
    bucket.fgm += _parse_number(row.get("fieldGoalsMade"))
    bucket.fga += _parse_number(row.get("fieldGoalsAttempted"))
    bucket.fg3m += _parse_number(row.get("threePointersMade"))
    bucket.fg3a += _parse_number(row.get("threePointersAttempted"))
    bucket.ftm += _parse_number(row.get("freeThrowsMade"))
    bucket.fta += _parse_number(row.get("freeThrowsAttempted"))

    team_key = _normalise_team_key(row.get("playerteamCity"), row.get("playerteamName"))
    if team_key and team_key in lookup:
        team_id, tricode = lookup[team_key]
        bucket.team_id = team_id
        bucket.team_abbr = tricode


def _totals_to_average(totals: PlayerTotals) -> dict[str, object]:
    games = max(totals.games, 1)
    return {
        "player_id": totals.player_id,
        "team_id": totals.team_id,
        "team_abbreviation": totals.team_abbr,
        "games_played": totals.games,
        "avg_seconds": totals.seconds / games,
        "pts": totals.pts / games,
        "reb": totals.reb / games,
        "ast": totals.ast / games,
        "stl": totals.stl / games,
        "blk": totals.blk / games,
        "tov": totals.tov / games,
        "fg_pct": (totals.fgm / totals.fga) if totals.fga > 0 else None,
        "fg3_pct": (totals.fg3m / totals.fg3a) if totals.fg3a > 0 else None,
        "ft_pct": (totals.ftm / totals.fta) if totals.fta > 0 else None,
    }


def main() -> None:
    season_label = _load_season_label()
    desired_start = _season_start_year(season_label)
    counts = _season_counts()
    if not counts:
        raise SystemExit("PlayerStatistics archive does not contain any seasons")

    if desired_start in counts:
        season_start = desired_start
        season_label_output = season_label
    else:
        candidates = [year for year in counts if year <= desired_start]
        if candidates:
            season_start = max(candidates)
        else:
            season_start = max(counts)
        season_label_output = f"{season_start}-{str(season_start + 1)[-2:]}"
        print(
            "Warning: PlayerStatistics archive missing season",
            desired_start,
            "— using",
            season_label_output,
        )

    if season_start != desired_start:
        print(
            f"Generating fallback stats for {season_label_output} (requested {season_label})."
        )
    else:
        season_label_output = season_label

    team_lookup = _load_team_lookup()

    totals: Dict[int, PlayerTotals] = {}
    for row in _iter_regular_season_rows(season_start):
        player_id_value = row.get("personId")
        try:
            player_id = int(float(player_id_value))  # Handles possible "123.0" entries
        except (TypeError, ValueError):
            continue
        if player_id <= 0:
            continue

        bucket = totals.get(player_id)
        if bucket is None:
            bucket = PlayerTotals(player_id=player_id)
            totals[player_id] = bucket
        _accumulate(bucket, row, team_lookup)

    entries = [
        (str(player_id), _totals_to_average(bucket))
        for player_id, bucket in totals.items()
        if bucket.games > 0
    ]
    entries.sort(key=lambda item: int(item[0]))

    payload = {
        "season": season_start,
        "season_label": season_label_output,
        "generated": datetime.now(UTC).isoformat(),
        "player_count": len(entries),
        "players": dict(entries),
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {payload['player_count']} players to {OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
