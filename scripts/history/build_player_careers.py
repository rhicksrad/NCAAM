"""Generate cached career totals for the history explorer.

Production deployments do not ship Ball Don't Lie API credentials, so the
history explorer cannot request live season averages. This script aggregates
career totals from ``PlayerStatistics.7z`` and maps the results to Ball Don't
Lie player identifiers (when possible) by cross-referencing the NBA
``Players.csv`` metadata and the cached ``players.index.json`` file under
``public/data/history``.

The generated JSON stores two lookups:

* ``players`` – totals keyed by Ball Don't Lie player id (string).
* ``byName`` – totals keyed by a normalized name when an id match could not be
  established.

Each entry mirrors the payload returned by ``fetchCareerStats`` in
``public/scripts/history.js``:

```
{
  "regular": {"totals": {...}, "seasons": [...]},
  "postseason": {"totals": {...}, "seasons": [...]}
}
```
"""

from __future__ import annotations

import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

OUTPUT_PATH = ROOT / "public" / "data" / "history" / "player_careers.json"
PLAYERS_CSV = ROOT / "Players.csv"
BDL_INDEX_PATH = ROOT / "public" / "data" / "history" / "players.index.json"


@dataclass
class Totals:
    games: int = 0
    minutes: float = 0.0
    points: float = 0.0
    rebounds: float = 0.0
    assists: float = 0.0
    steals: float = 0.0
    blocks: float = 0.0
    turnovers: float = 0.0
    fouls: float = 0.0
    fgm: float = 0.0
    fga: float = 0.0
    fg3m: float = 0.0
    fg3a: float = 0.0
    ftm: float = 0.0
    fta: float = 0.0
    oreb: float = 0.0
    dreb: float = 0.0

    def add_game(self, row: dict[str, str]) -> None:
        self.games += 1
        self.minutes += _parse_minutes(row.get("numMinutes"))
        self.points += _to_float(row.get("points"))
        self.rebounds += _to_float(row.get("reboundsTotal"))
        self.assists += _to_float(row.get("assists"))
        self.steals += _to_float(row.get("steals"))
        self.blocks += _to_float(row.get("blocks"))
        self.turnovers += _to_float(row.get("turnovers"))
        self.fouls += _to_float(row.get("foulsPersonal"))
        self.fgm += _to_float(row.get("fieldGoalsMade"))
        self.fga += _to_float(row.get("fieldGoalsAttempted"))
        self.fg3m += _to_float(row.get("threePointersMade"))
        self.fg3a += _to_float(row.get("threePointersAttempted"))
        self.ftm += _to_float(row.get("freeThrowsMade"))
        self.fta += _to_float(row.get("freeThrowsAttempted"))
        self.oreb += _to_float(row.get("reboundsOffensive"))
        self.dreb += _to_float(row.get("reboundsDefensive"))

    def serialise(self) -> dict[str, int]:
        return {
            "games": int(self.games),
            "minutes": int(round(self.minutes)),
            "points": int(round(self.points)),
            "rebounds": int(round(self.rebounds)),
            "assists": int(round(self.assists)),
            "steals": int(round(self.steals)),
            "blocks": int(round(self.blocks)),
            "turnovers": int(round(self.turnovers)),
            "fouls": int(round(self.fouls)),
            "fgm": int(round(self.fgm)),
            "fga": int(round(self.fga)),
            "fg3m": int(round(self.fg3m)),
            "fg3a": int(round(self.fg3a)),
            "ftm": int(round(self.ftm)),
            "fta": int(round(self.fta)),
            "oreb": int(round(self.oreb)),
            "dreb": int(round(self.dreb)),
        }


@dataclass
class PlayerMeta:
    person_id: str
    name: str
    name_key: str
    draft_year: int | None
    college: str | None
    country: str | None
    height_inches: int | None
    weight_lb: int | None


@dataclass
class CareerRecord:
    person_id: str
    meta: PlayerMeta
    regular: Totals
    postseason: Totals
    regular_seasons: list[int]
    postseason_seasons: list[int]

    def regular_games(self) -> int:
        return self.regular.games

    def to_payload(self) -> dict[str, dict[str, object]]:
        return {
            "regular": {"totals": self.regular.serialise(), "seasons": self.regular_seasons},
            "postseason": {"totals": self.postseason.serialise(), "seasons": self.postseason_seasons},
        }


@dataclass
class BdlPlayer:
    player_id: int
    name: str
    name_key: str
    draft_year: int | None
    college: str | None
    country: str | None
    height_inches: int | None
    weight_lb: int | None


def _to_float(value: str | None) -> float:
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
    if value is None:
        return 0.0
    text = value.strip()
    if not text or text == "0:00":
        return 0.0
    if ":" not in text:
        try:
            return float(text) * 60.0
        except ValueError:
            return 0.0
    minutes, seconds = text.split(":", 1)
    try:
        mins = float(minutes)
        secs = float(seconds)
    except ValueError:
        return 0.0
    return mins * 60.0 + secs


def _classify_game(game_type: str | None) -> str | None:
    if game_type is None:
        return None
    label = game_type.strip().lower()
    if not label:
        return None
    if "playoff" in label or "play-in" in label:
        return "postseason"
    if "regular" in label:
        return "regular"
    return None


def _season_from_date(raw: str | None) -> int | None:
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        timestamp = datetime.fromisoformat(text.replace(" ", "T"))
    except ValueError:
        return None
    year = timestamp.year
    month = timestamp.month
    return year if month >= 7 else year - 1


def _normalize_name(value: str | None) -> str:
    if value is None:
        return ""
    text = unicodedata.normalize("NFD", value)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text)
    return text.strip().lower()


def _normalize_simple(value: str | None) -> str | None:
    if value is None:
        return None
    text = unicodedata.normalize("NFD", value)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).strip().lower()
    return text or None


def _normalize_country(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip().upper()
    return text or None


def _parse_int(value: object) -> int | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def _parse_height_inches(value: str | None) -> int | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if "-" in text:
        feet, inches = text.split("-", 1)
        try:
            feet_val = int(feet)
            inch_val = int(inches)
        except ValueError:
            return None
        return feet_val * 12 + inch_val
    try:
        return int(float(text))
    except ValueError:
        return None


def _iter_rows() -> Iterable[dict[str, str]]:
    from scripts.build_insights import (
        PlayerStatisticsStreamError,
        iter_player_statistics_rows,
    )

    try:
        yield from iter_player_statistics_rows()
    except PlayerStatisticsStreamError as error:
        raise SystemExit(str(error)) from error


def _load_stats_metadata() -> tuple[dict[str, PlayerMeta], dict[str, list[str]]]:
    metadata: dict[str, PlayerMeta] = {}
    names: dict[str, list[str]] = defaultdict(list)
    if not PLAYERS_CSV.exists():
        return metadata, names

    with PLAYERS_CSV.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            person_id = (row.get("personId") or "").strip()
            if not person_id:
                continue
            first = (row.get("firstName") or "").strip()
            last = (row.get("lastName") or "").strip()
            full_name = f"{first} {last}".strip() or person_id
            name_key = _normalize_name(full_name)
            draft_year = _parse_int(row.get("draftYear"))
            college = _normalize_simple(row.get("lastAttended"))
            country = _normalize_country(row.get("country"))
            height_inches = _parse_int(row.get("height"))
            if height_inches is not None and height_inches <= 0:
                height_inches = None
            weight_lb = _parse_int(row.get("bodyWeight"))
            if weight_lb is not None and weight_lb < 120:
                weight_lb = None

            meta = PlayerMeta(
                person_id=person_id,
                name=full_name,
                name_key=name_key,
                draft_year=draft_year,
                college=college,
                country=country,
                height_inches=height_inches,
                weight_lb=weight_lb,
            )
            metadata[person_id] = meta
            if name_key:
                names[name_key].append(person_id)

    return metadata, names


def _load_bdl_players() -> list[BdlPlayer]:
    if not BDL_INDEX_PATH.exists():
        return []
    try:
        with BDL_INDEX_PATH.open(encoding="utf-8") as handle:
            document = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return []

    payload = []
    players = document.get("players")
    if not isinstance(players, list):
        return payload

    for entry in players:
        try:
            player_id = int(entry.get("id"))
        except (TypeError, ValueError):
            continue
        first = entry.get("first_name") or ""
        last = entry.get("last_name") or ""
        full_name = entry.get("full_name") or f"{first} {last}".strip() or str(player_id)
        name_key = _normalize_name(full_name)
        draft_year = _parse_int(entry.get("draft_year"))
        college = _normalize_simple(entry.get("college"))
        country = _normalize_country(entry.get("country"))
        height_inches = _parse_height_inches(entry.get("height"))
        weight_lb = _parse_int(entry.get("weight"))
        if weight_lb is not None and weight_lb < 120:
            weight_lb = None
        payload.append(
            BdlPlayer(
                player_id=player_id,
                name=full_name,
                name_key=name_key,
                draft_year=draft_year,
                college=college,
                country=country,
                height_inches=height_inches,
                weight_lb=weight_lb,
            )
        )
    return payload


def _score_candidate(bdl: BdlPlayer, meta: PlayerMeta) -> int:
    score = 0
    if bdl.draft_year is not None and meta.draft_year is not None and bdl.draft_year == meta.draft_year:
        score += 4
    if bdl.college and meta.college and bdl.college == meta.college:
        score += 2
    if bdl.country and meta.country and bdl.country == meta.country:
        score += 1
    if (
        bdl.height_inches is not None
        and meta.height_inches is not None
        and abs(bdl.height_inches - meta.height_inches) <= 1
    ):
        score += 1
    if bdl.weight_lb is not None and meta.weight_lb is not None and abs(bdl.weight_lb - meta.weight_lb) <= 10:
        score += 1
    return score


def build_player_careers() -> None:
    stats_meta, stats_by_name = _load_stats_metadata()

    players: dict[str, dict[str, Totals]] = defaultdict(lambda: {
        "regular": Totals(),
        "postseason": Totals(),
    })
    season_sets: dict[str, dict[str, set[int]]] = defaultdict(lambda: {
        "regular": set(),
        "postseason": set(),
    })
    fallback_names: dict[str, tuple[str, str]] = {}

    row_count = 0
    for row in _iter_rows():
        row_count += 1
        person_id = (row.get("personId") or "").strip()
        if not person_id:
            continue
        phase = _classify_game(row.get("gameType"))
        if phase is None:
            continue
        season = _season_from_date(row.get("gameDate"))
        players[person_id][phase].add_game(row)
        if season is not None:
            season_sets[person_id][phase].add(season)
        first = (row.get("firstName") or "").strip()
        last = (row.get("lastName") or "").strip()
        if first or last:
            fallback_names[person_id] = (first, last)

    records: dict[str, CareerRecord] = {}
    for person_id, segments in players.items():
        meta = stats_meta.get(person_id)
        if meta is None:
            first, last = fallback_names.get(person_id, ("", ""))
            full_name = f"{first} {last}".strip() or person_id
            meta = PlayerMeta(
                person_id=person_id,
                name=full_name,
                name_key=_normalize_name(full_name),
                draft_year=None,
                college=None,
                country=None,
                height_inches=None,
                weight_lb=None,
            )
        regular_seasons = sorted(season_sets[person_id]["regular"])
        postseason_seasons = sorted(season_sets[person_id]["postseason"])
        records[person_id] = CareerRecord(
            person_id=person_id,
            meta=meta,
            regular=segments["regular"],
            postseason=segments["postseason"],
            regular_seasons=regular_seasons,
            postseason_seasons=postseason_seasons,
        )

    bdl_players = _load_bdl_players()
    careers_by_bdl_id: dict[str, dict[str, object]] = {}
    used_person_ids: set[str] = set()

    for bdl_player in bdl_players:
        if not bdl_player.name_key:
            continue
        candidate_ids = stats_by_name.get(bdl_player.name_key, [])
        if not candidate_ids:
            continue
        best_person_id: str | None = None
        best_score = -1
        for candidate in candidate_ids:
            record = records.get(candidate)
            if record is None:
                continue
            score = _score_candidate(bdl_player, record.meta)
            if score > best_score or (
                score == best_score
                and best_person_id is not None
                and record.regular_games() > records[best_person_id].regular_games()
            ):
                best_person_id = candidate
                best_score = score
        if best_person_id is None and len(candidate_ids) == 1:
            best_person_id = candidate_ids[0]
        if best_person_id is None:
            continue
        record = records.get(best_person_id)
        if record is None:
            continue
        careers_by_bdl_id[str(bdl_player.player_id)] = record.to_payload()
        used_person_ids.add(best_person_id)

    fallback_by_name: dict[str, dict[str, object]] = {}
    fallback_games: dict[str, int] = {}
    for person_id, record in records.items():
        if person_id in used_person_ids:
            continue
        name_key = record.meta.name_key
        if not name_key:
            continue
        games = record.regular_games()
        if name_key not in fallback_by_name or games > fallback_games.get(name_key, -1):
            fallback_by_name[name_key] = record.to_payload()
            fallback_games[name_key] = games

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, object] = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "Ball Don't Lie API game logs (PlayerStatistics.7z)",
        "rowCount": row_count,
        "playerCount": len(careers_by_bdl_id),
        "players": careers_by_bdl_id,
    }
    if fallback_by_name:
        payload["byName"] = fallback_by_name
        payload["unmatchedCount"] = len(fallback_by_name)

    with OUTPUT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write("\n")

    print(
        "Wrote", len(careers_by_bdl_id), "Ball Don't Lie player matches",
        "with", len(fallback_by_name), "name-only fallbacks",
        "to", OUTPUT_PATH.relative_to(ROOT),
    )


if __name__ == "__main__":
    build_player_careers()
