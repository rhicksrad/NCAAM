"""Refresh the team profile snapshot consumed by the front-end map view."""

from __future__ import annotations

import csv
import io
import json
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
TEAM_HISTORIES = ROOT / "TeamHistories.csv"
TEAM_STATS_ARCHIVE = ROOT / "TeamStatistics.zip"
PROFILES_PATH = ROOT / "public" / "data" / "team_profiles.json"
CANONICAL_TEAMS = ROOT / "data" / "2025-26" / "canonical" / "teams.json"
BDL_TEAMS_CACHE = ROOT / "data" / "cache" / "bdl" / "teams.json"


# Championship and Hall of Fame counts are sourced from the Basketball-Reference
# franchise index as of the 2024-25 refresh window.
FRANCHISE_LEGACY: dict[str, dict[str, int]] = {
    "ATL": {"titles": 1, "hall_of_famers": 13},
    "BKN": {"titles": 0, "hall_of_famers": 6},
    "BOS": {"titles": 18, "hall_of_famers": 41},
    "CHA": {"titles": 0, "hall_of_famers": 1},
    "CHI": {"titles": 6, "hall_of_famers": 10},
    "CLE": {"titles": 1, "hall_of_famers": 7},
    "DAL": {"titles": 1, "hall_of_famers": 6},
    "DEN": {"titles": 1, "hall_of_famers": 7},
    "DET": {"titles": 3, "hall_of_famers": 16},
    "GSW": {"titles": 7, "hall_of_famers": 32},
    "HOU": {"titles": 2, "hall_of_famers": 14},
    "IND": {"titles": 0, "hall_of_famers": 9},
    "LAC": {"titles": 0, "hall_of_famers": 2},
    "LAL": {"titles": 17, "hall_of_famers": 36},
    "MEM": {"titles": 0, "hall_of_famers": 1},
    "MIA": {"titles": 3, "hall_of_famers": 6},
    "MIL": {"titles": 2, "hall_of_famers": 12},
    "MIN": {"titles": 0, "hall_of_famers": 1},
    "NOP": {"titles": 0, "hall_of_famers": 0},
    "NYK": {"titles": 2, "hall_of_famers": 20},
    "OKC": {"titles": 1, "hall_of_famers": 10},
    "ORL": {"titles": 0, "hall_of_famers": 3},
    "PHI": {"titles": 3, "hall_of_famers": 18},
    "PHX": {"titles": 0, "hall_of_famers": 7},
    "POR": {"titles": 1, "hall_of_famers": 6},
    "SAC": {"titles": 1, "hall_of_famers": 13},
    "SAS": {"titles": 5, "hall_of_famers": 8},
    "TOR": {"titles": 1, "hall_of_famers": 2},
    "UTA": {"titles": 0, "hall_of_famers": 5},
    "WAS": {"titles": 1, "hall_of_famers": 9},
}


@dataclass
class TeamAggregate:
    """Running totals for a franchise."""

    games: int = 0
    wins: int = 0
    losses: int = 0
    points: float = 0.0
    opponent_points: float = 0.0
    assists: float = 0.0
    turnovers: float = 0.0
    rebounds: float = 0.0
    points_in_paint: float = 0.0
    points_in_paint_games: int = 0
    fast_break_points: float = 0.0
    fast_break_games: int = 0
    bench_points: float = 0.0
    bench_points_games: int = 0
    field_goal_pct_total: float = 0.0
    field_goal_pct_games: int = 0
    three_pct_total: float = 0.0
    three_pct_games: int = 0


def _load_existing_profiles(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or "teams" not in data:
        raise ValueError("team_profiles.json payload is not in the expected format")
    return data


def _load_canonical_team_tricodes(path: Path) -> dict[str, str]:
    lookup: dict[str, str] = {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return lookup
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse canonical teams JSON: {path}") from exc

    if isinstance(payload, list):
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            team_id = str(entry.get("teamId", "")).strip()
            tricode = str(entry.get("tricode", "")).strip().upper()
            if not team_id or not tricode:
                continue
            lookup[team_id] = tricode
    return lookup


def _load_bdl_team_metadata(path: Path) -> dict[str, dict[str, str]]:
    """Return Ball Don't Lie team metadata keyed by abbreviation."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as exc:
        raise ValueError(f"Failed to parse cached BDL teams JSON: {path}") from exc

    teams = payload.get("value") if isinstance(payload, dict) else None
    if not isinstance(teams, list):
        return {}

    lookup: dict[str, dict[str, str]] = {}
    for entry in teams:
        if not isinstance(entry, dict):
            continue
        abbr = str(entry.get("abbreviation", "")).strip().upper()
        if not abbr:
            continue
        lookup[abbr] = entry
    return lookup


def _active_team_lookup(path: Path, canonical_lookup: dict[str, str]) -> dict[str, str]:
    """Return a mapping of teamId -> current abbreviation.

    Preference order:
    1. Canonical Ball Don't Lie derived tricode
    2. Raw TeamHistories abbreviation (legacy CSV)
    """

    lookup: dict[str, str] = {}
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            active_until = row.get("seasonActiveTill", "").strip()
            if active_until != "2100":
                continue
            team_id = (row.get("teamId") or "").strip()
            if not team_id:
                continue

            abbreviation = canonical_lookup.get(team_id)
            if not abbreviation:
                abbreviation = (row.get("teamAbbrev") or "").strip().upper()

            if not abbreviation:
                continue
            lookup[team_id] = abbreviation
    if not lookup:
        raise ValueError("No active franchises detected in TeamHistories.csv")
    return lookup


def _iter_team_statistics(path: Path) -> Iterable[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError("TeamStatistics.zip is missing; cannot refresh team profiles.")
    with zipfile.ZipFile(path) as archive:
        with archive.open("TeamStatistics.csv") as raw:
            reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8"))
            for row in reader:
                yield row


def _float_or_none(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _safe_divide(numerator: float, denominator: float) -> float:
    if not denominator:
        return 0.0
    return numerator / denominator


def _aggregate_team_metrics(team_lookup: dict[str, str]) -> tuple[dict[str, TeamAggregate], datetime | None, datetime | None]:
    aggregates: dict[str, TeamAggregate] = defaultdict(TeamAggregate)
    earliest: datetime | None = None
    latest: datetime | None = None

    for row in _iter_team_statistics(TEAM_STATS_ARCHIVE):
        team_id = (row.get("teamId") or "").strip()
        abbreviation = team_lookup.get(team_id)
        if not abbreviation:
            continue

        aggregate = aggregates[abbreviation]
        aggregate.games += 1
        if (row.get("win") or "").strip() == "1":
            aggregate.wins += 1
        else:
            aggregate.losses += 1

        if (value := _float_or_none(row.get("teamScore"))) is not None:
            aggregate.points += value
        if (value := _float_or_none(row.get("opponentScore"))) is not None:
            aggregate.opponent_points += value
        if (value := _float_or_none(row.get("assists"))) is not None:
            aggregate.assists += value
        if (value := _float_or_none(row.get("turnovers"))) is not None:
            aggregate.turnovers += value
        if (value := _float_or_none(row.get("reboundsTotal"))) is not None:
            aggregate.rebounds += value

        if (value := _float_or_none(row.get("pointsInThePaint"))) is not None:
            aggregate.points_in_paint += value
            aggregate.points_in_paint_games += 1
        if (value := _float_or_none(row.get("pointsFastBreak"))) is not None:
            aggregate.fast_break_points += value
            aggregate.fast_break_games += 1
        if (value := _float_or_none(row.get("benchPoints"))) is not None:
            aggregate.bench_points += value
            aggregate.bench_points_games += 1
        if (value := _float_or_none(row.get("fieldGoalsPercentage"))) is not None and value > 0:
            aggregate.field_goal_pct_total += value
            aggregate.field_goal_pct_games += 1
        if (value := _float_or_none(row.get("threePointersPercentage"))) is not None and value > 0:
            aggregate.three_pct_total += value
            aggregate.three_pct_games += 1

        raw_date = (row.get("gameDate") or "").strip()
        if raw_date:
            try:
                game_date = datetime.strptime(raw_date, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                game_date = None
            if game_date:
                if earliest is None or game_date < earliest:
                    earliest = game_date
                if latest is None or game_date > latest:
                    latest = game_date

    return aggregates, earliest, latest


def _update_profiles(data: dict, aggregates: dict[str, TeamAggregate]) -> None:
    for team in data.get("teams", []):
        abbreviation = team.get("abbreviation")
        if not abbreviation:
            continue
        aggregate = aggregates.get(abbreviation)
        if not aggregate or aggregate.games == 0:
            continue

        team["gamesSampled"] = aggregate.games
        team["wins"] = aggregate.wins
        team["losses"] = aggregate.losses

        team["metrics"] = {
            "winPct": round(_safe_divide(aggregate.wins, aggregate.games), 4),
            "avgPointsFor": round(_safe_divide(aggregate.points, aggregate.games), 2),
            "avgPointsAgainst": round(_safe_divide(aggregate.opponent_points, aggregate.games), 2),
            "netMargin": round(_safe_divide(aggregate.points - aggregate.opponent_points, aggregate.games), 2),
            "fieldGoalPct": round(
                _safe_divide(aggregate.field_goal_pct_total, aggregate.field_goal_pct_games), 4
            ),
            "threePointPct": round(
                _safe_divide(aggregate.three_pct_total, aggregate.three_pct_games), 4
            ),
            "rebounds": round(_safe_divide(aggregate.rebounds, aggregate.games), 2),
            "assists": round(_safe_divide(aggregate.assists, aggregate.games), 2),
            "turnovers": round(_safe_divide(aggregate.turnovers, aggregate.games), 2),
            "pointsInPaint": round(
                _safe_divide(aggregate.points_in_paint, aggregate.points_in_paint_games), 2
            ),
            "fastBreakPoints": round(
                _safe_divide(aggregate.fast_break_points, aggregate.fast_break_games), 2
            ),
            "benchPoints": round(
                _safe_divide(aggregate.bench_points, aggregate.bench_points_games), 2
            ),
        }

        legacy = FRANCHISE_LEGACY.get(abbreviation, {"titles": 0, "hall_of_famers": 0})
        team["legacy"] = {
            "titles": legacy.get("titles", 0),
            "hallOfFamers": legacy.get("hall_of_famers", 0),
        }


def _apply_team_metadata(data: dict, bdl_lookup: dict[str, dict[str, str]]) -> None:
    """Enrich team metadata using Ball Don't Lie as the primary source."""

    if not bdl_lookup:
        return

    for team in data.get("teams", []):
        abbreviation = str(team.get("abbreviation", "")).strip().upper()
        if not abbreviation:
            continue

        metadata = bdl_lookup.get(abbreviation)
        if not metadata:
            continue

        bdl_abbr = str(metadata.get("abbreviation", "")).strip().upper()
        if bdl_abbr:
            team["abbreviation"] = bdl_abbr

        full_name = str(metadata.get("full_name", "")).strip()
        if full_name:
            team["name"] = full_name

        conference = str(metadata.get("conference", "")).strip()
        if conference:
            team["conference"] = conference

        division = str(metadata.get("division", "")).strip()
        if division:
            team["division"] = division

        city = str(metadata.get("city", "")).strip()
        if city and not str(team.get("city", "")).strip():
            team["city"] = city


def main() -> None:
    profiles = _load_existing_profiles(PROFILES_PATH)
    canonical_lookup = _load_canonical_team_tricodes(CANONICAL_TEAMS)
    bdl_lookup = _load_bdl_team_metadata(BDL_TEAMS_CACHE)
    team_lookup = _active_team_lookup(TEAM_HISTORIES, canonical_lookup)
    aggregates, earliest, latest = _aggregate_team_metrics(team_lookup)
    if not aggregates:
        raise RuntimeError("No aggregates produced from TeamStatistics.zip")

    _update_profiles(profiles, aggregates)
    _apply_team_metadata(profiles, bdl_lookup)

    if earliest and latest:
        profiles["season"] = f"{earliest.year}-{latest.year}"
    profiles["generatedAt"] = datetime.now(UTC).isoformat()

    PROFILES_PATH.write_text(json.dumps(profiles, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
