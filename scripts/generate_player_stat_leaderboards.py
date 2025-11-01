#!/usr/bin/env python3
"""Generate player stat leaderboards for the Players page visualisations."""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable, Optional


@dataclass(frozen=True)
class MetricSpec:
    stat_fn: Callable[[dict], Optional[float]]
    minimum_games: int
    formatter: Callable[[float], str]
    description: str


def format_decimal(value: float, digits: int = 1) -> str:
    rounded = round(value, digits)
    return f"{rounded:.{digits}f}"


def format_percent(value: float) -> str:
    pct = value * 100
    rounded = round(pct, 1)
    return f"{rounded:.1f}%"


LEADERBOARD_SPECS: dict[str, MetricSpec] = {
    "mp": MetricSpec(lambda s: s.get("mp_g"), 12, lambda v: format_decimal(v, 1), "Minutes per game"),
    "fgPct": MetricSpec(lambda s: s.get("fg_pct"), 15, format_percent, "Field goal %"),
    "fg3Pct": MetricSpec(lambda s: s.get("fg3_pct"), 15, format_percent, "3-point %"),
    "ftPct": MetricSpec(lambda s: s.get("ft_pct"), 15, format_percent, "Free throw %"),
    "rebounds": MetricSpec(
        lambda s: s.get("trb_g"), 12, lambda v: format_decimal(v, 1), "Total rebounds (TRB + ORB + DRB)"
    ),
    "assists": MetricSpec(lambda s: s.get("ast_g"), 12, lambda v: format_decimal(v, 1), "Assists per game"),
    "stocks": MetricSpec(
        lambda s: (s.get("stl_g") or 0) + (s.get("blk_g") or 0), 12, lambda v: format_decimal(v, 1), "Stocks per game (STL + BLK)"
    ),
    "turnovers": MetricSpec(lambda s: s.get("tov_g"), 12, lambda v: format_decimal(v, 1), "Turnovers per game"),
    "points": MetricSpec(lambda s: s.get("pts_g"), 12, lambda v: format_decimal(v, 1), "Points per game"),
}

METRIC_ORDER: tuple[str, ...] = (
    "mp",
    "fgPct",
    "fg3Pct",
    "ftPct",
    "rebounds",
    "assists",
    "stocks",
    "turnovers",
    "points",
)

METRIC_SHORT_LABELS: dict[str, str] = {
    "mp": "MP",
    "fgPct": "FG%",
    "fg3Pct": "3P%",
    "ftPct": "FT%",
    "rebounds": "REB",
    "assists": "AST",
    "stocks": "STL+BLK",
    "turnovers": "TOV",
    "points": "PTS",
}


@dataclass
class PlayerSeason:
    slug: str
    name: str
    url: Optional[str]
    season: str
    team: Optional[str]
    games: Optional[float]
    stats: dict


def is_finite(value: Optional[float]) -> bool:
    return value is not None and isinstance(value, (int, float)) and math.isfinite(value)


def iter_player_seasons(players_dir: Path, season_label: str) -> Iterable[PlayerSeason]:
    for path in players_dir.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:  # pragma: no cover - defensive logging
            raise RuntimeError(f"Failed to parse {path}") from exc

        seasons = data.get("seasons")
        if not isinstance(seasons, list):
            continue

        for season in seasons:
            if not isinstance(season, dict):
                continue
            if season.get("season") != season_label:
                continue
            yield PlayerSeason(
                slug=data.get("slug", path.stem),
                name=data.get("name", path.stem.replace("-", " ").title()),
                url=data.get("source"),
                season=season_label,
                team=season.get("team"),
                games=season.get("gp"),
                stats=season,
            )
            break


def build_metric_leaders(players: Iterable[PlayerSeason], spec: MetricSpec) -> list[dict]:
    leaders: list[dict] = []
    for season in players:
        games = season.games
        if not is_finite(games) or games < spec.minimum_games:
            continue
        value = spec.stat_fn(season.stats)
        if not is_finite(value):
            continue
        leaders.append(
            {
                "name": season.name,
                "team": season.team or "",
                "slug": season.slug,
                "url": season.url,
                "games": int(round(float(games))),
                "value": float(value),
                "valueFormatted": spec.formatter(float(value)),
            }
        )
    leaders.sort(key=lambda item: (-item["value"], item["name"]))
    return leaders[:10]


def build_leaderboards(players_dir: Path, season_label: str) -> dict:
    players = list(iter_player_seasons(players_dir, season_label))
    metrics: dict[str, dict] = {}
    for metric in METRIC_ORDER:
        spec = LEADERBOARD_SPECS[metric]
        metric_players = build_metric_leaders(players, spec)
        metrics[metric] = {
            "label": spec.description,
            "shortLabel": METRIC_SHORT_LABELS.get(metric, metric.upper()),
            "leaders": metric_players,
        }
    now = datetime.now(timezone.utc)
    generated_at = now.isoformat(timespec="seconds").replace("+00:00", "Z")
    return {
        "season": season_label,
        "seasonYear": _resolve_season_year(season_label),
        "generatedAt": generated_at,
        "metrics": metrics,
    }


def _resolve_season_year(season_label: str) -> int:
    try:
        start_year = int(season_label.split("-")[0])
    except (ValueError, IndexError):
        start_year = datetime.now(timezone.utc).year
    return start_year + 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--season",
        default="2024-25",
        help="Season label to build leaderboards for (default: %(default)s)",
    )
    parser.add_argument(
        "--players-dir",
        type=Path,
        default=Path("public/data/players"),
        help="Directory containing per-player season stat JSON files",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Path to write the leaderboard JSON (defaults to public/data/player_stat_leaders_<season>.json)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.output is None:
        args.output = Path(f"public/data/player_stat_leaders_{args.season}.json")
    payload = build_leaderboards(args.players_dir, args.season)
    args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":  # pragma: no cover
    main()
