"""Shared helpers for computing GOAT scoring snapshots."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Collection, Iterable, Mapping

RECENT_SEASON_START = 2022
RECENT_SEASON_SPAN = 3  # 2022-23 through 2024-25
RECENT_SEASON_YEARS = {
    RECENT_SEASON_START + offset for offset in range(RECENT_SEASON_SPAN)
}
RECENT_SEASON_MAX_GAMES = 82 * RECENT_SEASON_SPAN
RECENT_COMPONENT_WEIGHTS = {
    "production": 50.0,
    "impact": 30.0,
    "availability": 20.0,
}
RECENT_MIN_GAMES = 25
RECENT_MIN_MINUTES = 600.0


def _parse_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        text = str(value).strip()
        if not text:
            return None
        try:
            number = float(text)
        except ValueError:
            return None
    if not math.isfinite(number):
        return None
    return number


def _parse_game_date(value: str | None) -> datetime | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def _season_year_from_date(value: str | None) -> int | None:
    parsed = _parse_game_date(value)
    if not parsed:
        return None
    anchor_year = parsed.year
    if parsed.month >= 7:
        return anchor_year
    return anchor_year - 1


def format_season_label(start_year: int) -> str:
    end_year = start_year + 1
    return f"{start_year}-{str(end_year)[-2:]}"


def format_season_span(seasons: Iterable[int]) -> str | None:
    years: list[int] = []
    seen: set[int] = set()
    for year in seasons:
        if not isinstance(year, int):
            continue
        if year in seen:
            continue
        seen.add(year)
        years.append(year)
    if not years:
        return None
    years.sort()
    labels = [format_season_label(year) for year in years]
    if len(labels) == 1:
        return labels[0]
    return f"{labels[0]}–{labels[-1]}"


def format_season_window(start_year: int, span: int) -> str:
    if span <= 0:
        return format_season_label(start_year)
    end_year = start_year + span - 1
    return f"{format_season_label(start_year)} to {format_season_label(end_year)}"


def compute_recent_goat_scores(
    rows: Iterable[Mapping[str, Any]],
    active_ids: Collection[str],
) -> dict[str, dict[str, Any]]:
    """Aggregate last-three-season GOAT scores for the provided players."""

    normalized_ids = {str(person_id).strip() for person_id in active_ids if str(person_id).strip()}
    if not normalized_ids:
        return {}

    aggregates: dict[str, dict[str, Any]] = {
        person_id: {
            "games": 0,
            "wins": 0,
            "minutes": 0.0,
            "points": 0.0,
            "assists": 0.0,
            "rebounds": 0.0,
            "steals": 0.0,
            "blocks": 0.0,
            "plus_minus": 0.0,
            "seasons": set(),
            "last_game": None,
            "team_name": None,
            "team_city": None,
        }
        for person_id in normalized_ids
    }

    for row in rows:
        person_raw = row.get("personId")
        person_id = str(person_raw).strip() if person_raw is not None else ""
        if person_id not in aggregates:
            continue

        season_year = _season_year_from_date(row.get("gameDate"))
        if season_year not in RECENT_SEASON_YEARS:
            continue

        minutes = _parse_float(row.get("numMinutes")) or 0.0
        if minutes <= 0:
            continue

        bucket = aggregates[person_id]
        bucket["games"] += 1
        if (row.get("win") or "").strip() == "1":
            bucket["wins"] += 1
        bucket["minutes"] += minutes
        bucket["points"] += _parse_float(row.get("points")) or 0.0
        bucket["assists"] += _parse_float(row.get("assists")) or 0.0
        bucket["rebounds"] += _parse_float(row.get("reboundsTotal")) or 0.0
        bucket["steals"] += _parse_float(row.get("steals")) or 0.0
        bucket["blocks"] += _parse_float(row.get("blocks")) or 0.0
        bucket["plus_minus"] += _parse_float(row.get("plusMinusPoints")) or 0.0
        bucket["seasons"].add(season_year)

        game_date = _parse_game_date(row.get("gameDate"))
        if game_date is not None:
            last_game = bucket.get("last_game")
            if last_game is None or game_date > last_game:
                bucket["last_game"] = game_date
                bucket["team_name"] = (row.get("playerteamName") or "").strip() or None
                bucket["team_city"] = (row.get("playerteamCity") or "").strip() or None

    component_maxima = {key: 0.0 for key in RECENT_COMPONENT_WEIGHTS}
    for bucket in aggregates.values():
        minutes = bucket["minutes"]
        if minutes <= 0:
            bucket["components"] = {key: 0.0 for key in RECENT_COMPONENT_WEIGHTS}
            continue

        per36_points = (bucket["points"] / minutes) * 36.0 if minutes else 0.0
        per36_assists = (bucket["assists"] / minutes) * 36.0 if minutes else 0.0
        per36_rebounds = (bucket["rebounds"] / minutes) * 36.0 if minutes else 0.0
        per36_stocks = ((bucket["steals"] + bucket["blocks"]) / minutes) * 36.0 if minutes else 0.0

        availability = min(bucket["games"] / RECENT_SEASON_MAX_GAMES, 1.0)
        plus_minus = (bucket["plus_minus"] / bucket["games"]) if bucket["games"] else 0.0

        game_availability = availability
        minute_availability = min((minutes / (RECENT_SEASON_MAX_GAMES * 36.0)), 1.0)
        availability_component = (game_availability + minute_availability) / 2.0

        sample_scale_candidates = [1.0]
        if RECENT_MIN_GAMES > 0:
            sample_scale_candidates.append(bucket["games"] / RECENT_MIN_GAMES)
        if RECENT_MIN_MINUTES > 0:
            sample_scale_candidates.append(minutes / RECENT_MIN_MINUTES)
        sample_scale = max(0.0, min(sample_scale_candidates))

        production_component = max(
            per36_points
            + 1.5 * per36_assists
            + 1.1 * per36_rebounds
            + 3.0 * per36_stocks,
            0.0,
        ) * sample_scale
        impact_component = max(plus_minus, 0.0) * sample_scale

        components = {
            "production": production_component,
            "impact": impact_component,
            "availability": availability_component,
        }
        bucket["components"] = components

        for key, value in components.items():
            if value > component_maxima[key]:
                component_maxima[key] = value

    scores: dict[str, float] = {}
    for person_id, bucket in aggregates.items():
        score_total = 0.0
        for key, weight in RECENT_COMPONENT_WEIGHTS.items():
            ceiling = component_maxima[key]
            value = bucket["components"].get(key, 0.0)
            if ceiling > 0:
                score_total += (value / ceiling) * weight
        score = round(score_total, 1)
        scores[person_id] = score
    rankings: dict[str, int] = {}
    sorted_entries = sorted(
        aggregates.items(), key=lambda item: scores.get(item[0], 0.0), reverse=True
    )
    for index, (person_id, _bucket) in enumerate(sorted_entries):
        rankings[person_id] = index + 1

    recent_scores: dict[str, dict[str, Any]] = {}
    for person_id, bucket in aggregates.items():
        score = scores.get(person_id, 0.0)
        last_game = bucket.get("last_game")
        recent_scores[person_id] = {
            "score": score,
            "rank": rankings.get(person_id),
            "games": bucket["games"],
            "wins": bucket["wins"],
            "points": int(round(bucket["points"])),
            "assists": int(round(bucket["assists"])),
            "rebounds": int(round(bucket["rebounds"])),
            "blocks": int(round(bucket["blocks"])),
            "seasons": sorted(bucket["seasons"]),
            "teamName": bucket.get("team_name"),
            "teamCity": bucket.get("team_city"),
            "lastGame": last_game.date().isoformat() if isinstance(last_game, datetime) else None,
        }

    return recent_scores
