"""Generate aggregated JSON snapshots from the full NBA CSV extracts.

This script powers the richer data visualizations on the static MVP by
condensing the large CSV extracts into lightweight JSON summaries.  It reads
all of the datasets in the repository – including the compressed team and
player statistics tables – and writes browser-friendly outputs to
``public/data``.

The script intentionally avoids external Python dependencies so it can run on
CI or a local workstation with nothing more than CPython, ``zipfile`` (from
the standard library), and the ``7z`` command line utility that ships with the
``p7zip-full`` package.  If the 7z binary is not available, a clear error
message is raised describing the installation step.
"""

from __future__ import annotations

import atexit
import csv
import io
import json
import math
import re
import shutil
import subprocess
import tempfile
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

try:  # Optional dependency used when the 7z CLI is unavailable.
    import py7zr  # type: ignore
except Exception:  # pragma: no cover - fallback only triggered when module missing
    py7zr = None


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA_DIR = ROOT / "public" / "data"

# Some legacy player records report incorrect country information in the
# ``Players.csv`` extract. Patch them here so downstream snapshots and the UI
# display the expected nationalities.
PLAYER_COUNTRY_OVERRIDES = {
    "76195": "Sudan",  # Manute Bol
    "22": "Netherlands",  # Rik Smits
}

_TEMP_PLAYER_STATS_DIR: Path | None = None


# ---------------------------------------------------------------------------
# Utility helpers


def _to_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _to_int(value: str | None) -> int | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def _to_bool(value: str | None) -> bool:
    if value is None:
        return False
    value = value.strip().lower()
    return value in {"1", "true", "yes", "t"}


def _year_from_date(raw: str | None) -> int | None:
    if raw is None:
        return None
    raw = raw.strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace(" ", "T")).year
    except ValueError:
        return None


def _decade_label(year: int) -> str:
    start = (year // 10) * 10
    return f"{start}s"


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_output_dir() -> None:
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)


def _write_json(filename: str, payload: dict, *, indent: int | None = 2) -> None:
    _ensure_output_dir()
    path = PUBLIC_DATA_DIR / filename
    with path.open("w", encoding="utf-8") as f:
        if indent is None:
            json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(payload, f, indent=indent, ensure_ascii=False)
        f.write("\n")


def _push_top(collection: list[tuple[float, dict]], key: float, item: dict, *, size: int) -> None:
    """Maintain a bounded min-heap of the largest ``size`` elements."""

    if math.isnan(key):
        return
    if len(collection) < size:
        collection.append((key, item))
        if len(collection) == size:
            collection.sort(key=lambda pair: pair[0])
        return

    if key <= collection[0][0]:
        return

    collection[0] = (key, item)
    # Re-establish min ordering for the first element.
    collection.sort(key=lambda pair: pair[0])


def _sorted_heap(heap: list[tuple[float, dict]], *, reverse: bool = True) -> list[dict]:
    return [item for _, item in sorted(heap, key=lambda pair: pair[0], reverse=reverse)]


def _normalize_person_id(value: object) -> str | None:
    """Convert assorted identifier representations to a trimmed string."""

    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or None
    if isinstance(value, (int, float)):
        if isinstance(value, float):
            if math.isnan(value):  # pragma: no cover - defensive guard
                return None
            value = int(value)
        return str(int(value))
    return None


_PLAYERS_INDEX_LOOKUP_CACHE: tuple[dict[tuple[str, str], str], dict[str, str]] | None = None


def _load_players_index_lookup() -> tuple[dict[tuple[str, str], str], dict[str, str]]:
    global _PLAYERS_INDEX_LOOKUP_CACHE
    if _PLAYERS_INDEX_LOOKUP_CACHE is not None:
        return _PLAYERS_INDEX_LOOKUP_CACHE

    path = PUBLIC_DATA_DIR / "players_index.json"
    if not path.exists():
        _PLAYERS_INDEX_LOOKUP_CACHE = ({}, {})
        return _PLAYERS_INDEX_LOOKUP_CACHE

    try:
        with path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        _PLAYERS_INDEX_LOOKUP_CACHE = ({}, {})
        return _PLAYERS_INDEX_LOOKUP_CACHE

    players = payload.get("players") if isinstance(payload, dict) else None
    if not isinstance(players, list):
        _PLAYERS_INDEX_LOOKUP_CACHE = ({}, {})
        return _PLAYERS_INDEX_LOOKUP_CACHE

    player_directory = _load_player_directory()
    known_ids = set(player_directory.keys())

    by_team: dict[tuple[str, str], str] = {}
    by_name: dict[str, str] = {}
    for entry in players:
        if not isinstance(entry, dict):
            continue
        person_id = _normalize_person_id(entry.get("id") or entry.get("personId"))
        if not person_id or (known_ids and person_id not in known_ids):
            continue
        name_key = _normalize_name_key(str(entry.get("name", "")))
        if name_key:
            by_name.setdefault(name_key, person_id)
        team_abbr = (entry.get("team_abbr") or "").strip().upper()
        if name_key and team_abbr:
            by_team[(name_key, team_abbr)] = person_id

    _PLAYERS_INDEX_LOOKUP_CACHE = (by_team, by_name)
    return _PLAYERS_INDEX_LOOKUP_CACHE


def _load_active_player_ids_from_players_index() -> tuple[set[str], str] | None:
    by_team, by_name = _load_players_index_lookup()
    if not by_team and not by_name:
        return None

    ids = set(by_name.values())
    if not ids:
        return None

    return ids, "public/data/players_index.json"


def _load_active_player_ids_from_rosters() -> tuple[set[str], str] | None:
    path = PUBLIC_DATA_DIR / "rosters.json"
    if not path.exists():
        return None

    try:
        with path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None

    teams = payload.get("teams") if isinstance(payload, dict) else None
    if not isinstance(teams, list):
        return None

    by_team, by_name = _load_players_index_lookup()
    ids: set[str] = set()

    for team in teams:
        if not isinstance(team, dict):
            continue
        roster = team.get("roster")
        if not isinstance(roster, list):
            continue
        team_abbr = (team.get("abbreviation") or "").strip().upper()
        for player in roster:
            if not isinstance(player, dict):
                continue
            name_key = _normalize_name_key(
                f"{(player.get('first_name') or '').strip()} {(player.get('last_name') or '').strip()}"
            )
            person_id = None
            if name_key and team_abbr:
                person_id = by_team.get((name_key, team_abbr))
            if not person_id and name_key:
                person_id = by_name.get(name_key)
            if person_id:
                ids.add(person_id)

    if not ids:
        return None

    return ids, "public/data/rosters.json"


def _load_active_player_ids_from_canonical() -> tuple[set[str], str] | None:
    data_root = ROOT / "data"
    candidates = sorted(data_root.glob("*/canonical/players.json"))
    for path in reversed(candidates):
        try:
            with path.open(encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError):
            continue

        ids: set[str] = set()
        if isinstance(payload, list):
            for entry in payload:
                if not isinstance(entry, dict):
                    continue
                person_id = _normalize_person_id(
                    entry.get("playerId")
                    or entry.get("personId")
                    or entry.get("id")
                    or entry.get("player_id")
                )
                if person_id:
                    ids.add(person_id)

        if ids:
            try:
                relative = str(path.relative_to(ROOT))
            except ValueError:
                relative = str(path)
            return ids, relative

    return None


def _load_active_player_ids() -> tuple[set[str], str | None]:
    index_lookup = _load_active_player_ids_from_players_index()
    if index_lookup:
        return index_lookup

    roster_lookup = _load_active_player_ids_from_rosters()
    if roster_lookup:
        return roster_lookup

    canonical_lookup = _load_active_player_ids_from_canonical()
    if canonical_lookup:
        return canonical_lookup

    return set(), None


def _top_career(entries: list[dict], metric: str, per_game_metric: str, *, size: int = 15) -> list[dict]:
    return (
        sorted(
            entries,
            key=lambda item: (item.get(metric, 0), item.get(per_game_metric, 0)),
            reverse=True,
        )[:size]
        if entries
        else []
    )


def _load_player_directory() -> dict[str, dict[str, object]]:
    """Load player metadata from ``Players.csv`` keyed by ``personId``."""

    path = ROOT / "Players.csv"
    directory: dict[str, dict[str, object]] = {}
    with path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            person_id = (row.get("personId") or "").strip()
            if not person_id:
                continue

            country = PLAYER_COUNTRY_OVERRIDES.get(person_id, (row.get("country") or "").strip())
            directory[person_id] = {
                "personId": person_id,
                "firstName": (row.get("firstName") or "").strip(),
                "lastName": (row.get("lastName") or "").strip(),
                "country": country,
                "height": _to_float(row.get("height")),
                "weight": _to_float(row.get("bodyWeight")),
                "guard": _to_bool(row.get("guard")),
                "forward": _to_bool(row.get("forward")),
                "center": _to_bool(row.get("center")),
                "draftYear": _to_int(row.get("draftYear")),
                "draftNumber": _to_int(row.get("draftNumber")),
            }
    return directory


def _load_franchise_lookup() -> dict[str, str]:
    """Map ``"City Team"`` names to franchise abbreviations."""

    mapping: dict[str, str] = {}
    path = ROOT / "TeamHistories.csv"
    if not path.exists():
        return mapping

    with path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            city = (row.get("teamCity") or "").strip()
            name = (row.get("teamName") or "").strip()
            abbrev = (row.get("teamAbbrev") or "").strip()
            if not (city or name):
                continue
            key = f"{city} {name}".strip()
            if not key:
                continue
            if abbrev:
                mapping.setdefault(key, abbrev)
    return mapping


_NUMBER_WORDS: dict[str, int] = {
    "zero": 0,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
}


def _normalize_name_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _parse_championship_override(resume: str) -> int | None:
    text = resume.lower()
    digit_match = re.search(r"(\d+)\s+(?:title|titles|championship|championships|ring|rings)", text)
    if digit_match:
        try:
            value = int(digit_match.group(1))
            if 0 < value <= 30:
                return value
        except ValueError:
            pass

    hyphen_match = re.search(r"([a-z]+)-for-[a-z]+", text)
    if hyphen_match:
        word = hyphen_match.group(1)
        if word in _NUMBER_WORDS:
            return _NUMBER_WORDS[word]

    tokens = [token for token in re.split(r"[^a-z]+", text) if token]
    for index, token in enumerate(tokens):
        if token in {"title", "titles", "championship", "championships", "ring", "rings"} and index > 0:
            previous = tokens[index - 1]
            if previous in _NUMBER_WORDS:
                return _NUMBER_WORDS[previous]
    return None


def _load_championship_overrides() -> dict[str, int]:
    path = PUBLIC_DATA_DIR / "goat_index.json"
    overrides: dict[str, int] = {}
    if not path.exists():
        return overrides

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return overrides

    for entry in payload.get("players", []):
        name = (entry.get("name") or "").strip()
        resume = entry.get("resume") or ""
        if not name:
            continue
        override = _parse_championship_override(resume)
        if override and override > 0:
            overrides[_normalize_name_key(name)] = override
    return overrides


def _load_finals_mvp_ledger() -> dict[str, dict[str, object]]:
    """Load Finals MVP winners keyed by normalized player name."""

    path = ROOT / "data" / "awards" / "finals_mvp.json"
    ledger: dict[str, dict[str, object]] = {}
    if not path.exists():
        return ledger

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ledger

    for entry in payload.get("winners", []):
        name = (entry.get("player") or "").strip()
        if not name:
            continue

        year = entry.get("year")
        name_key = _normalize_name_key(name)
        record = ledger.setdefault(name_key, {"count": 0, "years": []})
        record["count"] = int(record.get("count", 0)) + 1
        if isinstance(year, int):
            years = record.setdefault("years", [])
            if year not in years:
                years.append(year)
    for record in ledger.values():
        years = record.get("years")
        if isinstance(years, list):
            record["years"] = sorted({year for year in years if isinstance(year, int)})
    return ledger


def _load_bdi_component_lookup() -> tuple[
    dict[str, dict[str, float]],
    dict[str, float],
    dict[str, dict[str, object]],
    str | None,
]:
    """Load component values from the BDI (Pantheon) feed for blending."""

    path = PUBLIC_DATA_DIR / "goat_index.json"
    component_keys = ("impact", "stage", "longevity", "versatility", "culture")

    lookup: dict[str, dict[str, float]] = {}
    maxima: dict[str, float] = {key: 0.0 for key in component_keys}
    metadata: dict[str, dict[str, object]] = {}
    generated_at: str | None = None

    if not path.exists():
        return lookup, maxima, metadata, generated_at

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return lookup, maxima, metadata, generated_at

    generated_at = payload.get("generatedAt")

    for entry in payload.get("players", []):
        name = (entry.get("name") or "").strip()
        if not name:
            continue

        name_key = _normalize_name_key(name)
        metadata[name_key] = entry

        components = entry.get("goatComponents") or {}
        component_map: dict[str, float] = {}
        for key in component_keys:
            value = components.get(key)
            if isinstance(value, (int, float)):
                numeric_value = float(value)
                component_map[key] = numeric_value
                maxima[key] = max(maxima[key], numeric_value)

        if component_map:
            lookup[name_key] = component_map

    return lookup, maxima, metadata, generated_at


def _scale_component(value: float, ceiling: float, weight: float) -> float:
    if ceiling <= 0:
        return 0.0
    return round((value / ceiling) * weight, 2)


class PlayerStatisticsStreamError(RuntimeError):
    """Raised when the PlayerStatistics archive cannot be streamed."""


def _cleanup_temp_dir() -> None:
    global _TEMP_PLAYER_STATS_DIR
    if _TEMP_PLAYER_STATS_DIR and _TEMP_PLAYER_STATS_DIR.exists():
        shutil.rmtree(_TEMP_PLAYER_STATS_DIR, ignore_errors=True)
    _TEMP_PLAYER_STATS_DIR = None


def _ensure_player_statistics_csv() -> Path:
    """Extract ``PlayerStatistics.csv`` to a temporary directory.

    The helper caches the extraction for the lifetime of the process so the
    heavy archive only needs to be unpacked once when the ``7z`` CLI is not
    available.
    """

    global _TEMP_PLAYER_STATS_DIR
    if _TEMP_PLAYER_STATS_DIR is not None and (_TEMP_PLAYER_STATS_DIR / "PlayerStatistics.csv").exists():
        return _TEMP_PLAYER_STATS_DIR / "PlayerStatistics.csv"

    if py7zr is None:
        raise PlayerStatisticsStreamError(
            "Unable to stream PlayerStatistics. Install the `p7zip-full` CLI or the `py7zr` Python package."
        )

    archive_path = ROOT / "PlayerStatistics.7z"
    if not archive_path.exists():
        raise PlayerStatisticsStreamError(
            "PlayerStatistics.7z is missing. Ensure the archive is present before running the build script."
        )

    temp_dir = Path(tempfile.mkdtemp(prefix="playerstats_"))
    with py7zr.SevenZipFile(archive_path, mode="r") as archive:
        archive.extract(path=temp_dir, targets=["PlayerStatistics.csv"])

    extracted_path = temp_dir / "PlayerStatistics.csv"
    if not extracted_path.exists():
        raise PlayerStatisticsStreamError("Failed to extract PlayerStatistics.csv from the archive using py7zr.")

    _TEMP_PLAYER_STATS_DIR = temp_dir
    atexit.register(_cleanup_temp_dir)
    return extracted_path


def iter_player_statistics_rows() -> Iterator[dict[str, str]]:
    """Yield rows from ``PlayerStatistics.7z``.

    The function prefers streaming via the ``7z`` CLI for speed. When the CLI
    is unavailable, it falls back to extracting the CSV with ``py7zr``.
    """

    archive_path = ROOT / "PlayerStatistics.7z"
    if not archive_path.exists():
        raise PlayerStatisticsStreamError(
            "PlayerStatistics.7z is missing. Ensure the archive is present before running the build script."
        )

    binary = None
    for candidate in ("7zz", "7zr", "7z"):
        if shutil.which(candidate):
            binary = candidate
            break

    if binary is not None:
        process = subprocess.Popen(
            [binary, "x", "-so", str(archive_path), "PlayerStatistics.csv"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=False,
        )

        assert process.stdout is not None
        with io.TextIOWrapper(process.stdout, encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                yield row

        stderr_output = process.stderr.read().decode("utf-8", errors="ignore") if process.stderr else ""
        returncode = process.wait()
        if returncode != 0:
            raise PlayerStatisticsStreamError(
                f"Failed to stream PlayerStatistics.csv from the 7z archive (exit code {returncode}).\n{stderr_output.strip()}"
            )
        return

    csv_path = _ensure_player_statistics_csv()
    with csv_path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            yield row


# ---------------------------------------------------------------------------
# Players.csv snapshot


def build_players_overview() -> None:
    path = ROOT / "Players.csv"
    total_players = 0
    heights: list[float] = []
    weights: list[float] = []
    guard_count = 0
    forward_count = 0
    center_count = 0
    country_counts: Counter[str] = Counter()
    college_counts: Counter[str] = Counter()
    height_buckets: Counter[int] = Counter()
    skyline_players: list[dict[str, object]] = []
    skyline_ids: set[str] = set()
    drafted = 0
    undrafted = 0
    draft_years: list[int] = []

    with path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            total_players += 1

            person_id = (row.get("personId") or "").strip()
            height = _to_float(row.get("height"))
            weight = _to_float(row.get("bodyWeight"))
            if height is not None:
                heights.append(height)
                bucket_start = int(height // 2 * 2)
                height_buckets[bucket_start] += 1
            if weight is not None and 120 <= weight <= 400:
                weights.append(weight)

            if _to_bool(row.get("guard")):
                guard_count += 1
            if _to_bool(row.get("forward")):
                forward_count += 1
            if _to_bool(row.get("center")):
                center_count += 1

            country = row.get("country", "").strip()
            if person_id and person_id in PLAYER_COUNTRY_OVERRIDES:
                country = PLAYER_COUNTRY_OVERRIDES[person_id]
            if country:
                country_counts[country] += 1

            college = row.get("lastAttended", "").strip()
            if college:
                college_counts[college] += 1

            draft_year_raw = row.get("draftYear", "").strip()
            if draft_year_raw:
                year = _to_int(draft_year_raw)
                if year is not None:
                    drafted += 1
                    draft_years.append(year)
            else:
                undrafted += 1

            positions = []
            if _to_bool(row.get("guard")):
                positions.append("G")
            if _to_bool(row.get("forward")):
                positions.append("F")
            if _to_bool(row.get("center")):
                positions.append("C")

            has_valid_weight = weight is not None and 120 <= weight <= 400
            if height is not None:
                player_entry = {
                    "personId": person_id or row.get("personId"),
                    "name": f"{row.get('firstName', '').strip()} {row.get('lastName', '').strip()}".strip(),
                    "heightInches": height,
                    "weightPounds": weight if has_valid_weight else None,
                    "country": country or None,
                    "positions": positions,
                }

                if height >= 84:
                    skyline_key = _normalize_person_id(player_entry.get("personId"))
                    if skyline_key:
                        if skyline_key in skyline_ids:
                            # Skip duplicate person entries that occasionally surface in the raw CSV
                            # when players have multiple roster stints.
                            pass
                        else:
                            skyline_ids.add(skyline_key)
                            skyline_players.append(player_entry)
                    else:
                        skyline_players.append(player_entry)

    average_height = sum(heights) / len(heights) if heights else 0.0
    average_weight = sum(weights) / len(weights) if weights else 0.0
    min_height = min(heights) if heights else None
    max_height = max(heights) if heights else None
    min_weight = min(weights) if weights else None
    max_weight = max(weights) if weights else None

    draft_decades: Counter[str] = Counter()
    for year in draft_years:
        draft_decades[_decade_label(year)] += 1

    payload = {
        "generatedAt": _timestamp(),
        "totals": {
            "players": total_players,
            "averageHeightInches": round(average_height, 2),
            "averageWeightPounds": round(average_weight, 1),
            "guards": guard_count,
            "forwards": forward_count,
            "centers": center_count,
            "countriesRepresented": len(country_counts),
        },
        "heightSummary": {
            "minHeightInches": round(min_height, 2) if min_height is not None else None,
            "maxHeightInches": round(max_height, 2) if max_height is not None else None,
            "minWeightPounds": round(min_weight, 1) if min_weight is not None else None,
            "maxWeightPounds": round(max_weight, 1) if max_weight is not None else None,
        },
        "countries": [
            {"country": country, "players": count}
            for country, count in country_counts.most_common(12)
        ],
        "colleges": [
            {"program": college, "players": count}
            for college, count in college_counts.most_common(12)
        ],
        "heightBuckets": [
            {"bucketStart": bucket, "label": f"{bucket}-{bucket + 1}\"", "players": count}
            for bucket, count in sorted(height_buckets.items())
        ],
        "tallestPlayers": sorted(
            skyline_players,
            key=lambda entry: (
                -(float(entry.get("heightInches") or 0.0)),
                -(float(entry.get("weightPounds") or 0.0)),
                entry.get("name") or "",
            ),
        ),
        "draftSummary": {
            "draftedPlayers": drafted,
            "undraftedPlayers": undrafted,
            "earliestDraftYear": min(draft_years) if draft_years else None,
            "latestDraftYear": max(draft_years) if draft_years else None,
            "decadeCounts": [
                {"decade": decade, "players": count}
                for decade, count in sorted(draft_decades.items(), key=lambda item: item[0])
            ],
        },
    }

    _write_json("players_overview.json", payload)


# ---------------------------------------------------------------------------
# Games.csv snapshot


def build_games_snapshot() -> None:
    path = ROOT / "Games.csv"
    totals = Counter()
    totals_by_type: Counter[str] = Counter()
    games_by_decade: Counter[str] = Counter()
    highest_scoring: list[tuple[float, dict]] = []
    largest_margins: list[tuple[float, dict]] = []
    attendance_leaders: list[tuple[float, dict]] = []
    earliest_date: datetime | None = None
    latest_date: datetime | None = None

    with path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            totals["games"] += 1

            game_type = row.get("gameType", "").strip() or "Unknown"
            totals_by_type[game_type] += 1

            home_score = _to_int(row.get("homeScore")) or 0
            away_score = _to_int(row.get("awayScore")) or 0
            total_points = home_score + away_score
            margin = abs(home_score - away_score)
            attendance = _to_int(row.get("attendance"))

            date_raw = row.get("gameDate", "").strip()
            game_date: datetime | None = None
            if date_raw:
                try:
                    game_date = datetime.fromisoformat(date_raw.replace(" ", "T"))
                except ValueError:
                    game_date = None

            if game_date is not None:
                if earliest_date is None or game_date < earliest_date:
                    earliest_date = game_date
                if latest_date is None or game_date > latest_date:
                    latest_date = game_date
                games_by_decade[_decade_label(game_date.year)] += 1

            record = {
                "gameId": row.get("gameId"),
                "date": date_raw or None,
                "gameType": game_type,
                "home": {
                    "city": row.get("hometeamCity", "").strip(),
                    "name": row.get("hometeamName", "").strip(),
                    "score": home_score,
                },
                "away": {
                    "city": row.get("awayteamCity", "").strip(),
                    "name": row.get("awayteamName", "").strip(),
                    "score": away_score,
                },
                "totalPoints": total_points,
                "margin": margin,
                "attendance": attendance,
            }

            _push_top(highest_scoring, float(total_points), record, size=12)
            _push_top(largest_margins, float(margin), record, size=12)
            if attendance and attendance > 0:
                _push_top(attendance_leaders, float(attendance), record, size=12)

    payload = {
        "generatedAt": _timestamp(),
        "totals": {
            "games": totals["games"],
            "byType": [
                {"gameType": game_type, "games": count}
                for game_type, count in totals_by_type.most_common()
            ],
            "firstGame": earliest_date.isoformat() if earliest_date else None,
            "latestGame": latest_date.isoformat() if latest_date else None,
        },
        "gamesByDecade": [
            {"decade": decade, "games": count}
            for decade, count in sorted(games_by_decade.items(), key=lambda item: item[0])
        ],
        "highestScoringGames": _sorted_heap(highest_scoring),
        "largestMargins": _sorted_heap(largest_margins),
        "attendanceLeaders": _sorted_heap(attendance_leaders),
    }

    _write_json("historic_games.json", payload)


# ---------------------------------------------------------------------------
# TeamStatistics.zip snapshot


@dataclass
class TeamAggregate:
    name: str
    games: int = 0
    wins: int = 0
    losses: int = 0
    points: float = 0.0
    opponent_points: float = 0.0
    assists: float = 0.0


def build_team_performance_snapshot() -> None:
    path = ROOT / "TeamStatistics.zip"
    if not path.exists():
        raise FileNotFoundError("TeamStatistics.zip is missing; cannot build team performance snapshot.")

    team_totals: dict[str, TeamAggregate] = {}
    scoring_highs: list[tuple[float, dict]] = []
    margin_highs: list[tuple[float, dict]] = []
    assist_highs: list[tuple[float, dict]] = []

    with zipfile.ZipFile(path) as archive:
        with archive.open("TeamStatistics.csv") as raw:
            handle = io.TextIOWrapper(raw, encoding="utf-8", newline="")
            reader = csv.DictReader(handle)
            for row in reader:
                team_id = row.get("teamId", "").strip()
                team_name = f"{row.get('teamCity', '').strip()} {row.get('teamName', '').strip()}".strip()
                if not team_name:
                    team_name = team_id or "Unknown"

                aggregate = team_totals.setdefault(team_id or team_name, TeamAggregate(name=team_name))
                aggregate.games += 1
                if row.get("win", "").strip() == "1":
                    aggregate.wins += 1
                else:
                    aggregate.losses += 1

                points = _to_float(row.get("teamScore")) or 0.0
                opponent_points = _to_float(row.get("opponentScore")) or 0.0
                assists = _to_float(row.get("assists")) or 0.0

                aggregate.points += points
                aggregate.opponent_points += opponent_points
                aggregate.assists += assists

                margin = points - opponent_points
                record = {
                    "gameId": row.get("gameId"),
                    "date": row.get("gameDate"),
                    "team": team_name,
                    "opponent": f"{row.get('opponentTeamCity', '').strip()} {row.get('opponentTeamName', '').strip()}".strip(),
                    "points": round(points, 1),
                    "opponentPoints": round(opponent_points, 1),
                    "margin": round(margin, 1),
                    "assists": round(assists, 1),
                    "gameType": row.get("gameType", "").strip() or None,
                    "home": row.get("home", "").strip() == "1",
                }

                _push_top(scoring_highs, points, record, size=12)
                if margin > 0:
                    _push_top(margin_highs, margin, record, size=12)
                if assists > 0:
                    _push_top(assist_highs, assists, record, size=12)

    win_pct_leaders = []
    for team_id, aggregate in team_totals.items():
        if aggregate.games < 500:
            continue
        win_pct = aggregate.wins / aggregate.games if aggregate.games else 0.0
        win_pct_leaders.append(
            {
                "teamId": team_id,
                "team": aggregate.name,
                "games": aggregate.games,
                "wins": aggregate.wins,
                "losses": aggregate.losses,
                "winPct": round(win_pct, 4),
                "pointsPerGame": round(aggregate.points / aggregate.games, 2) if aggregate.games else 0.0,
                "opponentPointsPerGame": round(aggregate.opponent_points / aggregate.games, 2) if aggregate.games else 0.0,
                "assistsPerGame": round(aggregate.assists / aggregate.games, 2) if aggregate.games else 0.0,
            }
        )

    win_pct_leaders.sort(key=lambda item: (item["winPct"], item["pointsPerGame"]), reverse=True)

    payload = {
        "generatedAt": _timestamp(),
        "winPctLeaders": win_pct_leaders[:12],
        "singleGameHighs": {
            "scoring": _sorted_heap(scoring_highs),
            "margins": _sorted_heap(margin_highs),
            "assists": _sorted_heap(assist_highs),
        },
    }

    _write_json("team_performance.json", payload)


# ---------------------------------------------------------------------------
# PlayerStatistics.7z snapshot


def build_player_leaders_snapshot() -> None:
    active_player_ids, active_player_source = _load_active_player_ids()
    career_totals: dict[str, dict[str, object]] = {}
    points_highs: list[tuple[float, dict]] = []
    points_50_plus: dict[tuple[str | None, str], dict] = {}
    assists_highs: list[tuple[float, dict]] = []
    rebounds_highs: list[tuple[float, dict]] = []
    total_rows = 0
    earliest_season: int | None = None
    latest_season: int | None = None

    for row in iter_player_statistics_rows():
        total_rows += 1
        person_id = row.get("personId") or ""
        if not person_id:
            continue

        points = _to_float(row.get("points")) or 0.0
        assists = _to_float(row.get("assists")) or 0.0
        rebounds = _to_float(row.get("reboundsTotal")) or 0.0
        minutes = _to_float(row.get("numMinutes")) or 0.0
        win_flag = row.get("win", "").strip() == "1"
        game_type = row.get("gameType", "").strip() or "Unknown"
        game_date_raw = row.get("gameDate", "").strip()
        season_year = _year_from_date(game_date_raw)
        if season_year is not None:
            if earliest_season is None or season_year < earliest_season:
                earliest_season = season_year
            if latest_season is None or season_year > latest_season:
                latest_season = season_year

        career = career_totals.setdefault(
            person_id,
            {
                "personId": person_id,
                "firstName": row.get("firstName", "").strip(),
                "lastName": row.get("lastName", "").strip(),
                "games": 0,
                "points": 0.0,
                "assists": 0.0,
                "rebounds": 0.0,
                "minutes": 0.0,
                "wins": 0,
                "losses": 0,
                "gameTypes": Counter(),
                "teams": set(),
                "firstSeason": season_year,
                "lastSeason": season_year,
            },
        )

        if not career["firstName"] and row.get("firstName"):
            career["firstName"] = row.get("firstName", "").strip()
        if not career["lastName"] and row.get("lastName"):
            career["lastName"] = row.get("lastName", "").strip()

        career["games"] += 1
        career["points"] += points
        career["assists"] += assists
        career["rebounds"] += rebounds
        career["minutes"] += minutes
        if win_flag:
            career["wins"] += 1
        else:
            career["losses"] += 1
        career["gameTypes"][game_type] += 1

        team_name = f"{row.get('playerteamCity', '').strip()} {row.get('playerteamName', '').strip()}".strip()
        if team_name:
            career["teams"].add(team_name)

        if season_year is not None:
            if career["firstSeason"] is None or season_year < career["firstSeason"]:
                career["firstSeason"] = season_year
            if career["lastSeason"] is None or season_year > career["lastSeason"]:
                career["lastSeason"] = season_year

        single_game_record = {
            "personId": person_id,
            "name": f"{row.get('firstName', '').strip()} {row.get('lastName', '').strip()}".strip(),
            "gameId": row.get("gameId"),
            "gameDate": game_date_raw or None,
            "team": team_name or None,
            "opponent": f"{row.get('opponentteamCity', '').strip()} {row.get('opponentteamName', '').strip()}".strip() or None,
            "gameType": game_type,
            "points": round(points, 1),
            "assists": round(assists, 1),
            "rebounds": round(rebounds, 1),
            "minutes": round(minutes, 1),
        }

        _push_top(points_highs, points, single_game_record, size=12)
        _push_top(assists_highs, assists, single_game_record, size=12)
        _push_top(rebounds_highs, rebounds, single_game_record, size=12)

        if points >= 50.0:
            key = (single_game_record.get("gameId"), person_id)
            if key not in points_50_plus:
                points_50_plus[key] = single_game_record

    career_list = []
    for stats in career_totals.values():
        games = stats["games"] or 1
        win_pct = stats["wins"] / games if games else 0.0
        entry = {
            "personId": stats["personId"],
            "name": f"{stats['firstName']} {stats['lastName']}".strip(),
            "games": stats["games"],
            "points": round(stats["points"], 1),
            "assists": round(stats["assists"], 1),
            "rebounds": round(stats["rebounds"], 1),
            "minutes": round(stats["minutes"], 1),
            "pointsPerGame": round(stats["points"] / games, 2),
            "assistsPerGame": round(stats["assists"] / games, 2),
            "reboundsPerGame": round(stats["rebounds"] / games, 2),
            "winPct": round(win_pct, 4),
            "teams": sorted(stats["teams"]),
            "firstSeason": stats["firstSeason"],
            "lastSeason": stats["lastSeason"],
        }
        career_list.append(entry)

    active_career_list = [entry for entry in career_list if entry["personId"] in active_player_ids]

    career_points = _top_career(career_list, "points", "pointsPerGame")
    career_assists = _top_career(career_list, "assists", "assistsPerGame")
    career_rebounds = _top_career(career_list, "rebounds", "reboundsPerGame")

    active_points = _top_career(active_career_list, "points", "pointsPerGame")
    active_assists = _top_career(active_career_list, "assists", "assistsPerGame")
    active_rebounds = _top_career(active_career_list, "rebounds", "reboundsPerGame")

    payload = {
        "generatedAt": _timestamp(),
        "totals": {
            "playerGameRows": total_rows,
            "playersWithStats": len(career_list),
            "seasonCoverage": {
                "start": earliest_season,
                "end": latest_season,
            },
        },
        "careerLeaders": {
            "points": career_points,
            "assists": career_assists,
            "rebounds": career_rebounds,
        },
        "singleGameHighs": {
            "points": _sorted_heap(points_highs),
            "points50Plus": sorted(
                points_50_plus.values(),
                key=lambda record: (
                    record.get("points") or 0.0,
                    record.get("minutes") or 0.0,
                    record.get("gameDate") or "",
                ),
                reverse=True,
            ),
            "assists": _sorted_heap(assists_highs),
            "rebounds": _sorted_heap(rebounds_highs),
        },
    }

    if active_points or active_assists or active_rebounds:
        chase_payload: dict[str, object] = {
            "leaders": {
                "points": active_points,
                "assists": active_assists,
                "rebounds": active_rebounds,
            }
        }
        if active_player_source:
            chase_payload["source"] = active_player_source
        if active_player_ids:
            chase_payload["playerPoolSize"] = len(active_player_ids)
        if active_career_list:
            chase_payload["playersWithStats"] = len(active_career_list)
        payload["milestoneChase"] = chase_payload

    _write_json("player_leaders.json", payload)


# ---------------------------------------------------------------------------
# Player season insight snapshot


def build_player_season_insights_snapshot() -> None:
    season_player_totals: dict[tuple[str, int], dict[str, object]] = {}
    player_meta: dict[str, dict[str, object]] = {}
    triple_double_counts: Counter[str] = Counter()
    triple_double_seasons: defaultdict[str, set[int]] = defaultdict(set)
    season_totals: defaultdict[int, dict[str, float]] = defaultdict(
        lambda: {"games": 0.0, "points": 0.0, "assists": 0.0, "rebounds": 0.0, "minutes": 0.0}
    )
    season_triple_counts: Counter[int] = Counter()
    player_best_triple: dict[str, dict[str, object]] = {}
    total_rows = 0
    earliest_season: int | None = None
    latest_season: int | None = None

    for row in iter_player_statistics_rows():
        total_rows += 1
        person_id = row.get("personId") or ""
        if not person_id:
            continue

        season_year = _year_from_date(row.get("gameDate"))
        if season_year is None:
            continue

        if earliest_season is None or season_year < earliest_season:
            earliest_season = season_year
        if latest_season is None or season_year > latest_season:
            latest_season = season_year

        first_name = row.get("firstName", "").strip()
        last_name = row.get("lastName", "").strip()
        team_name = f"{row.get('playerteamCity', '').strip()} {row.get('playerteamName', '').strip()}".strip()

        meta = player_meta.setdefault(
            person_id,
            {
                "personId": person_id,
                "firstName": first_name,
                "lastName": last_name,
                "teams": set(),
                "firstSeason": season_year,
                "lastSeason": season_year,
            },
        )
        if first_name and not meta.get("firstName"):
            meta["firstName"] = first_name
        if last_name and not meta.get("lastName"):
            meta["lastName"] = last_name

        if meta.get("firstSeason") is None or (isinstance(meta.get("firstSeason"), int) and season_year < meta["firstSeason"]):
            meta["firstSeason"] = season_year
        if meta.get("lastSeason") is None or (isinstance(meta.get("lastSeason"), int) and season_year > meta["lastSeason"]):
            meta["lastSeason"] = season_year

        if team_name:
            meta["teams"].add(team_name)

        key = (person_id, season_year)
        totals = season_player_totals.setdefault(
            key,
            {
                "personId": person_id,
                "season": season_year,
                "games": 0,
                "points": 0.0,
                "assists": 0.0,
                "rebounds": 0.0,
                "minutes": 0.0,
                "teams": set(),
                "tripleDoubles": 0,
            },
        )

        points = _to_float(row.get("points")) or 0.0
        assists = _to_float(row.get("assists")) or 0.0
        rebounds = _to_float(row.get("reboundsTotal")) or 0.0
        steals = _to_float(row.get("steals")) or 0.0
        blocks = _to_float(row.get("blocks")) or 0.0
        minutes = _to_float(row.get("numMinutes")) or 0.0

        totals["games"] = int(totals.get("games", 0)) + 1
        totals["points"] = float(totals.get("points", 0.0)) + points
        totals["assists"] = float(totals.get("assists", 0.0)) + assists
        totals["rebounds"] = float(totals.get("rebounds", 0.0)) + rebounds
        totals["minutes"] = float(totals.get("minutes", 0.0)) + minutes
        if team_name:
            totals["teams"].add(team_name)

        season_totals_entry = season_totals[season_year]
        season_totals_entry["games"] += 1
        season_totals_entry["points"] += points
        season_totals_entry["assists"] += assists
        season_totals_entry["rebounds"] += rebounds
        season_totals_entry["minutes"] += minutes

        categories_above_threshold = sum(
            1 for value in (points, assists, rebounds, steals, blocks) if value >= 10
        )
        triple_double = categories_above_threshold >= 3
        if triple_double:
            totals["tripleDoubles"] = int(totals.get("tripleDoubles", 0)) + 1
            triple_double_counts[person_id] += 1
            triple_double_seasons[person_id].add(season_year)
            season_triple_counts[season_year] += 1

    season_records: list[dict[str, object]] = []
    for (person_id, season_year), totals in season_player_totals.items():
        games = int(totals.get("games", 0))
        if games == 0:
            continue

        meta = player_meta.get(person_id, {})
        name = f"{meta.get('firstName', '')} {meta.get('lastName', '')}".strip()
        teams = sorted(totals.get("teams", set()))

        record = {
            "personId": person_id,
            "name": name or person_id,
            "season": season_year,
            "games": games,
            "teams": teams,
            "pointsPerGame": round(float(totals.get("points", 0.0)) / games, 2),
            "assistsPerGame": round(float(totals.get("assists", 0.0)) / games, 2),
            "reboundsPerGame": round(float(totals.get("rebounds", 0.0)) / games, 2),
            "minutesPerGame": round(float(totals.get("minutes", 0.0)) / games, 1),
            "totalPoints": round(float(totals.get("points", 0.0)), 1),
            "totalAssists": round(float(totals.get("assists", 0.0)), 1),
            "totalRebounds": round(float(totals.get("rebounds", 0.0)), 1),
            "tripleDoubles": int(totals.get("tripleDoubles", 0)),
        }

        season_records.append(record)

        if record["tripleDoubles"] > 0:
            best = player_best_triple.get(person_id)
            if not best or record["tripleDoubles"] > best["tripleDoubles"]:
                player_best_triple[person_id] = {
                    "season": season_year,
                    "tripleDoubles": record["tripleDoubles"],
                }

    qualified = [record for record in season_records if record["games"] >= 40]

    scoring_leaders = sorted(
        qualified,
        key=lambda item: (item["pointsPerGame"], item["totalPoints"]),
        reverse=True,
    )[:12]

    assist_leaders = sorted(
        qualified,
        key=lambda item: (item["assistsPerGame"], item["totalAssists"]),
        reverse=True,
    )[:12]

    rebound_leaders = sorted(
        qualified,
        key=lambda item: (item["reboundsPerGame"], item["totalRebounds"]),
        reverse=True,
    )[:12]

    triple_double_leaders = []
    for person_id, count in triple_double_counts.most_common():
        if count < 10:
            break
        meta = player_meta.get(person_id, {})
        name = f"{meta.get('firstName', '')} {meta.get('lastName', '')}".strip()
        triple_double_leaders.append(
            {
                "personId": person_id,
                "name": name or person_id,
                "tripleDoubles": int(count),
                "seasonsWithTripleDouble": len(triple_double_seasons.get(person_id, set())),
                "careerSpan": {
                    "start": meta.get("firstSeason"),
                    "end": meta.get("lastSeason"),
                },
                "bestSeason": player_best_triple.get(person_id),
            }
        )

    season_trends = []
    for season_year, totals in sorted(season_totals.items(), key=lambda item: item[0]):
        games = totals["games"] or 1.0
        season_trends.append(
            {
                "season": season_year,
                "playerGames": int(games),
                "avgPoints": round(totals["points"] / games, 2),
                "avgAssists": round(totals["assists"] / games, 2),
                "avgRebounds": round(totals["rebounds"] / games, 2),
                "avgMinutes": round(totals["minutes"] / games, 2),
                "tripleDoubles": int(season_triple_counts.get(season_year, 0)),
            }
        )

    overall_games = sum(entry["games"] for entry in season_totals.values())
    overall_points = sum(entry["points"] for entry in season_totals.values())
    overall_assists = sum(entry["assists"] for entry in season_totals.values())
    overall_rebounds = sum(entry["rebounds"] for entry in season_totals.values())

    totals_payload = {
        "playerGameRows": total_rows,
        "playersTracked": len(player_meta),
        "seasonsTracked": len(season_totals),
        "seasonCoverage": {"start": earliest_season, "end": latest_season},
        "tripleDoubleGames": int(sum(triple_double_counts.values())),
        "playersWithTripleDouble": sum(1 for count in triple_double_counts.values() if count > 0),
        "averagePlayerLine": {
            "points": round(overall_points / overall_games, 2) if overall_games else 0.0,
            "assists": round(overall_assists / overall_games, 2) if overall_games else 0.0,
            "rebounds": round(overall_rebounds / overall_games, 2) if overall_games else 0.0,
        },
    }

    if season_triple_counts:
        season, count = season_triple_counts.most_common(1)[0]
        totals_payload["mostTripleDoubleSeason"] = {"season": season, "tripleDoubles": int(count)}

    payload = {
        "generatedAt": _timestamp(),
        "totals": totals_payload,
        "seasonAverages": {
            "points": [
                {
                    "personId": record["personId"],
                    "name": record["name"],
                    "season": record["season"],
                    "games": record["games"],
                    "pointsPerGame": record["pointsPerGame"],
                    "totalPoints": record["totalPoints"],
                    "teams": record["teams"],
                }
                for record in scoring_leaders
            ],
            "assists": [
                {
                    "personId": record["personId"],
                    "name": record["name"],
                    "season": record["season"],
                    "games": record["games"],
                    "assistsPerGame": record["assistsPerGame"],
                    "totalAssists": record["totalAssists"],
                    "teams": record["teams"],
                }
                for record in assist_leaders
            ],
            "rebounds": [
                {
                    "personId": record["personId"],
                    "name": record["name"],
                    "season": record["season"],
                    "games": record["games"],
                    "reboundsPerGame": record["reboundsPerGame"],
                    "totalRebounds": record["totalRebounds"],
                    "teams": record["teams"],
                }
                for record in rebound_leaders
            ],
        },
        "tripleDoubleLeaders": triple_double_leaders,
        "seasonTrends": season_trends,
    }

    _write_json("player_season_insights.json", payload)


# ---------------------------------------------------------------------------


def build_goat_system_snapshot() -> None:
    """Generate a GOAT ranking row for every known player."""

    player_directory = _load_player_directory()
    franchise_lookup = _load_franchise_lookup()
    championship_overrides = _load_championship_overrides()
    finals_mvp_lookup = _load_finals_mvp_ledger()
    bdi_lookup, bdi_maxima, bdi_metadata, bdi_generated_at = _load_bdi_component_lookup()

    career_totals: dict[str, dict[str, object]] = {}
    earliest_season: int | None = None
    latest_season: int | None = None

    for row in iter_player_statistics_rows():
        person_id = (row.get("personId") or "").strip()
        if not person_id:
            continue

        season_year = _year_from_date(row.get("gameDate"))
        if season_year is not None:
            if earliest_season is None or season_year < earliest_season:
                earliest_season = season_year
            if latest_season is None or season_year > latest_season:
                latest_season = season_year

        totals = career_totals.setdefault(
            person_id,
            {
                "personId": person_id,
                "games": 0,
                "points": 0.0,
                "assists": 0.0,
                "rebounds": 0.0,
                "minutes": 0.0,
                "steals": 0.0,
                "blocks": 0.0,
                "wins": 0,
                "losses": 0,
                "playoffGames": 0,
                "playoffWins": 0,
                "finalsGames": 0,
                "finalsWins": 0,
                "finalsSeasons": {},
                "teams": set(),
                "firstSeason": season_year,
                "lastSeason": season_year,
            },
        )

        totals["games"] = int(totals.get("games", 0)) + 1
        points = _to_float(row.get("points")) or 0.0
        assists = _to_float(row.get("assists")) or 0.0
        rebounds = _to_float(row.get("reboundsTotal")) or 0.0
        minutes = _to_float(row.get("numMinutes")) or 0.0
        steals = _to_float(row.get("steals")) or 0.0
        blocks = _to_float(row.get("blocks")) or 0.0

        totals["points"] = float(totals.get("points", 0.0)) + points
        totals["assists"] = float(totals.get("assists", 0.0)) + assists
        totals["rebounds"] = float(totals.get("rebounds", 0.0)) + rebounds
        totals["minutes"] = float(totals.get("minutes", 0.0)) + minutes
        totals["steals"] = float(totals.get("steals", 0.0)) + steals
        totals["blocks"] = float(totals.get("blocks", 0.0)) + blocks

        win_flag = (row.get("win") or "").strip() == "1"
        if win_flag:
            totals["wins"] = int(totals.get("wins", 0)) + 1
        else:
            totals["losses"] = int(totals.get("losses", 0)) + 1

        game_type = (row.get("gameType") or "").strip().lower()
        if game_type == "playoffs":
            totals["playoffGames"] = int(totals.get("playoffGames", 0)) + 1
            if win_flag:
                totals["playoffWins"] = int(totals.get("playoffWins", 0)) + 1

        game_label = (row.get("gameLabel") or "").strip().lower()
        is_nba_finals = "nba finals" in game_label
        if is_nba_finals:
            totals["finalsGames"] = int(totals.get("finalsGames", 0)) + 1
            if win_flag:
                totals["finalsWins"] = int(totals.get("finalsWins", 0)) + 1
            if season_year is not None:
                finals_seasons = totals.setdefault("finalsSeasons", {})
                season_record = finals_seasons.setdefault(season_year, {"wins": 0, "games": 0})
                season_record["games"] = int(season_record.get("games", 0)) + 1
                if win_flag:
                    season_record["wins"] = int(season_record.get("wins", 0)) + 1

        team_name = f"{(row.get('playerteamCity') or '').strip()} {(row.get('playerteamName') or '').strip()}".strip()
        if team_name:
            totals.setdefault("teams", set()).add(team_name)

        if season_year is not None:
            if totals.get("firstSeason") is None or (
                isinstance(totals.get("firstSeason"), int) and season_year < totals["firstSeason"]
            ):
                totals["firstSeason"] = season_year
            if totals.get("lastSeason") is None or (
                isinstance(totals.get("lastSeason"), int) and season_year > totals["lastSeason"]
            ):
                totals["lastSeason"] = season_year

    component_keys = ("impact", "stage", "longevity", "versatility", "culture")
    component_budget = {
        "impact": 34.0,
        "stage": 26.0,
        "longevity": 20.0,
        "versatility": 12.0,
        "culture": 8.0,
    }
    blend_weights = {
        "impact": (0.65, 0.35),
        "stage": (0.6, 0.4),
        "longevity": (0.7, 0.3),
        "versatility": (0.55, 0.45),
        "culture": (0.4, 0.6),
    }

    all_ids = set(player_directory.keys()) | set(career_totals.keys())

    raw_metrics: dict[str, dict[str, object]] = {}

    for person_id in all_ids:
        meta = player_directory.get(
            person_id,
            {
                "personId": person_id,
                "firstName": "",
                "lastName": "",
                "country": "",
                "guard": False,
                "forward": False,
                "center": False,
                "draftYear": None,
                "draftNumber": None,
            },
        )
        totals = career_totals.get(
            person_id,
            {
                "games": 0,
                "points": 0.0,
                "assists": 0.0,
                "rebounds": 0.0,
                "minutes": 0.0,
                "steals": 0.0,
                "blocks": 0.0,
                "wins": 0,
                "losses": 0,
                "playoffGames": 0,
                "playoffWins": 0,
                "finalsGames": 0,
                "finalsWins": 0,
                "finalsSeasons": {},
                "teams": set(),
                "firstSeason": meta.get("draftYear"),
                "lastSeason": meta.get("draftYear"),
            },
        )
        games = int(totals.get("games", 0))
        wins = int(totals.get("wins", 0))
        playoff_games = int(totals.get("playoffGames", 0))
        playoff_wins = int(totals.get("playoffWins", 0))
        minutes = float(totals.get("minutes", 0.0))
        points = float(totals.get("points", 0.0))
        assists = float(totals.get("assists", 0.0))
        rebounds = float(totals.get("rebounds", 0.0))
        steals = float(totals.get("steals", 0.0))
        blocks = float(totals.get("blocks", 0.0))

        production = 0.0
        if games:
            production = (points + 1.25 * assists + 1.1 * rebounds + 1.5 * (steals + blocks)) / games
        impact_metric = production * (0.6 + (minutes / games if games else 0.0))

        finals_games = int(totals.get("finalsGames", 0))
        finals_wins = int(totals.get("finalsWins", 0))
        finals_seasons = totals.get("finalsSeasons") or {}
        championships = 0
        for season_record in finals_seasons.values():
            games_played = int(season_record.get("games", 0))
            wins_recorded = int(season_record.get("wins", 0))
            if games_played <= 0:
                continue
            closeout_target = 4 if games_played > 5 else 3
            if wins_recorded >= closeout_target:
                championships += 1

        name_key = _normalize_name_key(f"{meta.get('firstName', '')} {meta.get('lastName', '')}")
        finals_mvp_meta = finals_mvp_lookup.get(name_key, {})
        finals_mvp_count = int(finals_mvp_meta.get("count", 0))
        documented_championships = championships
        override_championships = championship_overrides.get(name_key)
        if override_championships and override_championships > championships:
            championships = override_championships
        missing_championships = max(0, championships - documented_championships)

        finals_win_rate = (finals_wins / finals_games) if finals_games else 0.0
        win_pct = wins / games if games else 0.0
        playoff_win_pct = playoff_wins / playoff_games if playoff_games else 0.0

        postseason_volume = math.sqrt(max(playoff_wins, 0)) * 35.0
        playoff_run = math.sqrt(max(playoff_games, 0)) * 10.0
        finals_volume = math.sqrt(max(finals_wins, 0)) * 55.0
        finals_stage = math.sqrt(max(finals_games, 0)) * 20.0
        championship_crown = math.sqrt(max(championships, 0)) * 110.0
        legacy_crown = math.sqrt(max(missing_championships, 0)) * 90.0

        finals_game_scale = math.sqrt(max(finals_games, 0)) / 10.0 if finals_games else 0.0
        playoff_game_scale = math.sqrt(max(playoff_games, 0)) / 20.0 if playoff_games else 0.0

        finals_efficiency = finals_win_rate * 220.0 * finals_game_scale
        playoff_efficiency = playoff_win_pct * 200.0 * playoff_game_scale

        finals_mvp_stage = 0.0
        if finals_mvp_count > 0:
            finals_mvp_stage = math.sqrt(finals_mvp_count) * 200.0 + finals_mvp_count * 110.0

        stage_metric = (
            postseason_volume
            + playoff_run
            + finals_volume
            + finals_stage
            + championship_crown
            + legacy_crown
            + missing_championships * 55.0
            + finals_efficiency
            + playoff_efficiency
            + playoff_wins * 1.15
            + playoff_games * 0.05
            + wins * 0.02
            + finals_mvp_stage
        )
        if finals_games >= 20:
            stage_metric += (finals_win_rate**2) * 180.0
        finals_losses = max(0, finals_games - finals_wins)
        if finals_losses:
            stage_metric -= math.sqrt(finals_losses) * 40.0
        if finals_games and finals_losses == 0 and championships >= 3:
            stage_metric += 160.0

        longevity_metric = minutes + games * 5.0

        positions_count = sum(1 for flag in (meta.get("guard"), meta.get("forward"), meta.get("center")) if flag)
        teams_set = set(totals.get("teams", set()))
        teams_count = len(teams_set)
        per_game_assists = assists / games if games else 0.0
        per_game_rebounds = rebounds / games if games else 0.0
        per_game_stocks = (steals + blocks) / games if games else 0.0
        versatility_metric = (
            positions_count * 40.0
            + teams_count * 12.0
            + per_game_assists * 18.0
            + per_game_rebounds * 12.0
            + per_game_stocks * 14.0
        )

        country = (meta.get("country") or "").strip()
        international_bonus = 30.0 if country and country.upper() not in {"USA", "US", "UNITED STATES"} else 0.0
        draft_bonus = 0.0
        draft_number = meta.get("draftNumber")
        if isinstance(draft_number, int):
            if draft_number <= 3:
                draft_bonus = 12.0
            elif draft_number <= 14:
                draft_bonus = 8.0
            elif draft_number <= 30:
                draft_bonus = 4.0

        culture_metric = (
            championships * 55.0
            + missing_championships * 25.0
            + wins * 0.08
            + playoff_wins * 0.35
            + teams_count * 6.0
            + international_bonus
            + draft_bonus
        )
        if finals_mvp_count > 0:
            culture_metric += finals_mvp_count * 50.0

        raw_metrics[person_id] = {
            "impact": impact_metric,
            "stage": stage_metric,
            "longevity": longevity_metric,
            "versatility": versatility_metric,
            "culture": culture_metric,
            "games": games,
            "wins": wins,
            "playoffGames": playoff_games,
            "playoffWins": playoff_wins,
            "championships": championships,
            "finalsWins": finals_wins,
            "finalsMVPs": finals_mvp_count,
            "winPct": win_pct,
            "playoffWinPct": playoff_win_pct,
            "firstSeason": totals.get("firstSeason"),
            "lastSeason": totals.get("lastSeason"),
            "points": points,
            "assists": assists,
            "rebounds": rebounds,
            "teams": teams_set,
            "meta": meta,
            "nameKey": name_key,
        }

    raw_maxima = {key: 0.0 for key in component_keys}
    for metrics in raw_metrics.values():
        for key in component_keys:
            raw_maxima[key] = max(raw_maxima[key], float(metrics.get(key, 0.0)))

    players_payload: list[dict[str, object]] = []

    for person_id in all_ids:
        metrics = raw_metrics[person_id]
        meta = metrics["meta"]
        name_key = metrics["nameKey"]
        bdi_components = bdi_lookup.get(name_key)
        bdi_entry = bdi_metadata.get(name_key, {})

        components: dict[str, float] = {}
        for key in component_keys:
            budget = component_budget[key]
            our_value = float(metrics.get(key, 0.0))
            ceiling = raw_maxima.get(key, 0.0)
            our_ratio = (our_value / ceiling) if ceiling else 0.0
            our_ratio = max(0.0, min(1.0, our_ratio))

            combined_ratio = our_ratio
            blend = blend_weights.get(key, (1.0, 0.0))
            if bdi_components and key in bdi_components:
                bdi_value = bdi_components.get(key)
                bdi_ceiling = bdi_maxima.get(key, 0.0)
                if isinstance(bdi_value, (int, float)) and bdi_ceiling > 0:
                    bdi_ratio = max(0.0, min(1.0, float(bdi_value) / bdi_ceiling))
                    combined_ratio = blend[0] * our_ratio + blend[1] * bdi_ratio

            combined_ratio = max(0.0, min(1.0, combined_ratio))
            components[key] = round(budget * combined_ratio, 2)

        goat_score = round(sum(components.values()), 1)

        first_name = (meta.get("firstName") or "").strip()
        last_name = (meta.get("lastName") or "").strip()
        display_name = f"{first_name} {last_name}".strip() or person_id

        first_season = metrics.get("firstSeason")
        last_season = metrics.get("lastSeason")
        if first_season is None and isinstance(meta.get("draftYear"), int):
            first_season = meta.get("draftYear")
        if last_season is None and isinstance(meta.get("draftYear"), int):
            last_season = meta.get("draftYear")

        career_span = "—"
        if isinstance(first_season, int) and isinstance(last_season, int):
            career_span = f"{first_season}-{last_season}"

        prime_window = None
        if isinstance(first_season, int) and isinstance(last_season, int):
            prime_start = max(first_season, last_season - 4)
            prime_window = f"{prime_start}-{last_season}"
        bdi_prime = bdi_entry.get("primeWindow")
        if (not prime_window) and isinstance(bdi_prime, str) and bdi_prime.strip():
            prime_window = bdi_prime.strip()

        franchises = sorted(
            {
                franchise_lookup.get(team, team.split(" ")[-1] if team else "")
                for team in metrics.get("teams", set())
                if team
            }
        )

        games = metrics["games"]
        wins = metrics["wins"]
        playoff_games = metrics["playoffGames"]
        playoff_wins = metrics["playoffWins"]

        if games:
            resume = (
                f"{round(metrics['points']):,} pts · {round(metrics['assists']):,} ast · "
                f"{round(metrics['rebounds']):,} reb in {games:,} games"
            )
        else:
            resume = "Awaiting NBA impact"
        bdi_resume = (bdi_entry.get("resume") or "").strip()
        if bdi_resume:
            resume = f"{resume} · {bdi_resume}" if games else bdi_resume

        if last_season and isinstance(last_season, int) and last_season >= (datetime.now().year - 1):
            status = "Active"
        elif games:
            status = "Legend"
        else:
            status = "Prospect"

        bdi_tier = bdi_entry.get("tier")
        if isinstance(bdi_tier, str) and bdi_tier.strip():
            tier = bdi_tier.strip()
        else:
            if goat_score >= 92:
                tier = "Pantheon"
            elif goat_score >= 80:
                tier = "Inner Circle"
            elif goat_score >= 68:
                tier = "All-Time Great"
            elif goat_score >= 52:
                tier = "Hall of Fame"
            elif goat_score >= 36:
                tier = "All-Star"
            elif goat_score >= 22:
                tier = "Starter"
            elif goat_score >= 10:
                tier = "Rotation"
            else:
                tier = "Reserve"

        delta = 0.0
        bdi_delta = bdi_entry.get("delta")
        if isinstance(bdi_delta, (int, float)):
            delta = float(bdi_delta)

        players_payload.append(
            {
                "personId": person_id,
                "rank": 0,
                "name": display_name,
                "goatScore": goat_score,
                "tier": tier,
                "status": status,
                "careerSpan": career_span,
                "primeWindow": prime_window,
                "delta": delta,
                "franchises": franchises,
                "resume": resume,
                "goatComponents": components,
                "winPct": round(metrics["winPct"], 3) if games else 0.0,
                "playoffWinPct": round(metrics["playoffWinPct"], 3) if playoff_games else 0.0,
                "finalsMVPs": int(metrics.get("finalsMVPs", 0)),
            }
        )

    players_payload.sort(key=lambda item: item["goatScore"], reverse=True)
    for index, record in enumerate(players_payload, start=1):
        record["rank"] = index

    weights_payload = [
        {
            "key": "impact",
            "label": "Prime Impact & Possession Value",
            "weight": 0.32,
            "description": "Possession-weighted scoring, playmaking, and stocks blended with BDI opponent-adjusted impact.",
            "sources": [
                {
                    "name": "Ball Don't Lie API game logs (PlayerStatistics.7z)",
                    "contribution": "Points, assists, rebounds, steals, blocks, and minutes per game.",
                    "fields": [
                        "points",
                        "assists",
                        "reboundsTotal",
                        "steals",
                        "blocks",
                        "numMinutes",
                    ],
                },
                {
                    "name": "BDI API pantheon feed",
                    "contribution": "Opponent-adjusted impact baseline used for cross-era calibration.",
                    "fields": ["goatComponents.impact"],
                    "lastUpdated": bdi_generated_at,
                },
            ],
        },
        {
            "key": "stage",
            "label": "Stage Dominance",
            "weight": 0.26,
            "description": "Championship equity from playoff wins, Finals performance, and BDI postseason deltas.",
            "sources": [
                {
                    "name": "Ball Don't Lie API game logs (PlayerStatistics.7z)",
                    "contribution": "Playoff wins, Finals games, and close-out opportunities.",
                    "fields": ["gameType", "gameLabel", "win"],
                },
                {
                    "name": "BDI API pantheon feed",
                    "contribution": "Stage dominance priors and twelve-month movement flags.",
                    "fields": ["goatComponents.stage", "delta"],
                    "lastUpdated": bdi_generated_at,
                },
                {
                    "name": "Finals MVP ledger (data/awards/finals_mvp.json)",
                    "contribution": "Finals MVP counts that significantly amplify stage equity.",
                    "fields": ["player", "year"],
                },
            ],
        },
        {
            "key": "longevity",
            "label": "Longevity & Availability",
            "weight": 0.2,
            "description": "Career minutes, appearances, and durability context aligned with BDI aging curves.",
            "sources": [
                {
                    "name": "Ball Don't Lie API game logs (PlayerStatistics.7z)",
                    "contribution": "Total minutes, games played, and availability counts.",
                    "fields": ["numMinutes", "personId"],
                },
                {
                    "name": "Players.csv registry",
                    "contribution": "Draft years to anchor entry seasons when game logs are incomplete.",
                    "fields": ["draftYear"],
                },
                {
                    "name": "BDI API pantheon feed",
                    "contribution": "Longevity coefficients ensuring modern and classic careers share the same scale.",
                    "fields": ["goatComponents.longevity"],
                    "lastUpdated": bdi_generated_at,
                },
            ],
        },
        {
            "key": "versatility",
            "label": "Versatility & Scalability",
            "weight": 0.12,
            "description": "Positional flexibility, on-ball creation, and multi-team adaptability factors.",
            "sources": [
                {
                    "name": "Ball Don't Lie API game logs (PlayerStatistics.7z)",
                    "contribution": "Assist, rebound, steal, and block rates per game.",
                    "fields": ["assists", "reboundsTotal", "steals", "blocks"],
                },
                {
                    "name": "Players.csv registry",
                    "contribution": "Declared guard/forward/center flags for positional counts.",
                    "fields": ["guard", "forward", "center"],
                },
                {
                    "name": "TeamHistories.csv",
                    "contribution": "Franchise abbreviations that normalize team switches across eras.",
                    "fields": ["teamCity", "teamName", "teamAbbrev"],
                },
                {
                    "name": "BDI API pantheon feed",
                    "contribution": "Versatility anchors derived from historical lineup data.",
                    "fields": ["goatComponents.versatility"],
                    "lastUpdated": bdi_generated_at,
                },
            ],
        },
        {
            "key": "culture",
            "label": "Cultural Capital",
            "weight": 0.1,
            "description": "Leadership credit rooted in championships, global reach, and BDI cultural resonance.",
            "sources": [
                {
                    "name": "Ball Don't Lie API game logs (PlayerStatistics.7z)",
                    "contribution": "Win totals and postseason success that underpin leadership value.",
                    "fields": ["win", "gameType"],
                },
                {
                    "name": "Players.csv registry",
                    "contribution": "Country of origin and draft position for international and pedigree bonuses.",
                    "fields": ["country", "draftNumber"],
                },
                {
                    "name": "TeamHistories.csv",
                    "contribution": "Franchise context for multi-market influence scoring.",
                    "fields": ["teamCity", "teamName", "teamAbbrev"],
                },
                {
                    "name": "BDI API pantheon feed",
                    "contribution": "Cultural capital baseline and story-driven adjustments.",
                    "fields": ["goatComponents.culture"],
                    "lastUpdated": bdi_generated_at,
                },
                {
                    "name": "Finals MVP ledger (data/awards/finals_mvp.json)",
                    "contribution": "Finals MVP hardware used to elevate leadership and legacy credit.",
                    "fields": ["player", "year"],
                },
            ],
        },
    ]

    payload = {
        "generatedAt": _timestamp(),
        "weights": weights_payload,
        "coverage": {
            "players": len(players_payload),
            "seasonRange": {"start": earliest_season, "end": latest_season},
        },
        "players": players_payload,
    }

    if bdi_generated_at:
        payload["sourceTimestamps"] = {"bdi": bdi_generated_at}

    _write_json("goat_system.json", payload, indent=None)

# ---------------------------------------------------------------------------


def main() -> None:
    build_players_overview()
    build_games_snapshot()
    build_team_performance_snapshot()
    build_player_leaders_snapshot()
    build_player_season_insights_snapshot()
    build_goat_system_snapshot()


if __name__ == "__main__":
    main()
