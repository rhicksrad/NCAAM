"""Phase 1 data plumbing pipeline.

This utility integrates official league feeds, cleans historical CSV tables,
normalizes player identifiers, and emits JSON payloads that power the web
experience.  It is intentionally dependency-light so it can run anywhere CPython
is available.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DATA_DIR = ROOT / "public" / "data"
DEFAULT_SEASON = "2024"
DEFAULT_PLAYERS_FEED = "https://data.nba.com/data/v2015/json/mobile_teams/nba/{season}/players/playerlist.json"
DEFAULT_TEAMS_FEED = "https://data.nba.com/data/v2015/json/mobile_teams/nba/{season}/teams/00_teams.json"


def _timestamp() -> str:
    return datetime.now(UTC).isoformat()


def _clean_str(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


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


def _meters_to_inches(value: str | float | None) -> float | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            value = float(value)
        except ValueError:
            return None
    return round(value * 39.3701, 1)


def _kilograms_to_pounds(value: str | float | None) -> float | None:
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        try:
            value = float(value)
        except ValueError:
            return None
    return round(value * 2.20462, 1)


def _season_label(dt: datetime) -> str:
    """Return a season label such as ``2024-25``."""

    if dt.month >= 8:
        start = dt.year
        end = dt.year + 1
    else:
        start = dt.year - 1
        end = dt.year
    return f"{start}-{str(end)[-2:]}"


@dataclass
class OfficialPlayer:
    person_id: str
    payload: dict[str, Any]


@dataclass
class OfficialTeam:
    team_id: str
    payload: dict[str, Any]


@dataclass
class RosterPlayer:
    person_id: str
    payload: dict[str, Any]


@dataclass
class TeamEra:
    team_id: str
    payload: dict[str, Any]


class FeedDownloadError(RuntimeError):
    pass


def _load_json_from_source(source: str, *, timeout: int = 30) -> dict[str, Any]:
    """Load JSON from a URL or local file."""

    path = Path(source)
    if path.exists():
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    request = urllib.request.Request(
        source,
        headers={
            "User-Agent": "Mozilla/5.0 (Phase1Pipeline)",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if response.status != 200:
                raise FeedDownloadError(f"Feed responded with HTTP {response.status}: {source}")
            data = response.read().decode("utf-8")
    except urllib.error.URLError as exc:  # pragma: no cover - network failures should be surfaced clearly
        raise FeedDownloadError(f"Unable to fetch feed {source}: {exc}") from exc
    return json.loads(data)


def _iter_official_players(payload: dict[str, Any]) -> Iterable[OfficialPlayer]:
    league = payload.get("league") or {}
    for entry in league.get("standard", []):
        person_id = _clean_str(str(entry.get("personId", "")))
        if not person_id:
            continue
        yield OfficialPlayer(person_id=person_id, payload=entry)


def _iter_official_teams(payload: dict[str, Any]) -> Iterable[OfficialTeam]:
    league = payload.get("league") or {}
    for entry in league.get("standard", []):
        team_id = _clean_str(str(entry.get("teamId", "")))
        if not team_id:
            continue
        yield OfficialTeam(team_id=team_id, payload=entry)


def _load_players_csv() -> dict[str, RosterPlayer]:
    path = ROOT / "Players.csv"
    roster: dict[str, RosterPlayer] = {}
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            person_id = _clean_str(row.get("personId"))
            if not person_id:
                continue
            roster[person_id] = RosterPlayer(person_id=person_id, payload={k: v for k, v in row.items()})
    return roster


def _load_team_histories() -> dict[str, list[TeamEra]]:
    path = ROOT / "TeamHistories.csv"
    histories: dict[str, list[TeamEra]] = defaultdict(list)
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            team_id = _clean_str(row.get("teamId"))
            if not team_id:
                continue
            cleaned = {
                "teamCity": _clean_str(row.get("teamCity")),
                "teamName": _clean_str(row.get("teamName")),
                "teamAbbrev": _clean_str(row.get("teamAbbrev")),
                "seasonFounded": _to_int(row.get("seasonFounded")),
                "seasonActiveTill": _to_int(row.get("seasonActiveTill")),
                "league": _clean_str(row.get("league")),
            }
            histories[team_id].append(TeamEra(team_id=team_id, payload=cleaned))
    return histories


def _summarize_players_table(roster: dict[str, RosterPlayer]) -> dict[str, Any]:
    heights = []
    weights = []
    blank_country = 0
    height_outliers: list[dict[str, Any]] = []
    weight_outliers: list[dict[str, Any]] = []
    for player in roster.values():
        payload = player.payload
        height = _to_float(payload.get("height"))
        weight = _to_float(payload.get("bodyWeight"))
        if height:
            heights.append(height)
            if height < 60 or height > 96:
                if len(height_outliers) < 20:
                    height_outliers.append(
                        {
                            "personId": player.person_id,
                            "heightInches": height,
                        }
                    )
        if weight:
            weights.append(weight)
            if weight < 100 or weight > 400:
                if len(weight_outliers) < 20:
                    weight_outliers.append(
                        {
                            "personId": player.person_id,
                            "weightPounds": weight,
                        }
                    )
        if not _clean_str(payload.get("country")):
            blank_country += 1
    return {
        "rowCount": len(roster),
        "minHeightInches": min(heights) if heights else None,
        "maxHeightInches": max(heights) if heights else None,
        "minWeightPounds": min(weights) if weights else None,
        "maxWeightPounds": max(weights) if weights else None,
        "playersMissingCountry": blank_country,
        "heightOutlierCount": len(height_outliers),
        "heightOutlierSamples": height_outliers,
        "weightOutlierCount": len(weight_outliers),
        "weightOutlierSamples": weight_outliers,
    }


def _summarize_team_histories(histories: dict[str, list[TeamEra]]) -> dict[str, Any]:
    trimmed_abbrev = 0
    eras = 0
    for eras_list in histories.values():
        for era in eras_list:
            value = era.payload.get("teamAbbrev")
            if value and value != value.strip():
                trimmed_abbrev += 1
            era.payload["teamAbbrev"] = value.strip() if isinstance(value, str) else value
            eras += 1
    return {"teamCount": len(histories), "eraCount": eras, "abbrevTrimmed": trimmed_abbrev}


def _summarize_games_table() -> dict[str, Any]:
    path = ROOT / "Games.csv"
    seen_ids: set[str] = set()
    duplicates: list[str] = []
    invalid_dates: list[str] = []
    seasons: dict[str, int] = defaultdict(int)
    game_types: dict[str, int] = defaultdict(int)
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            game_id = _clean_str(row.get("gameId"))
            if not game_id:
                continue
            if game_id in seen_ids and len(duplicates) < 20:
                duplicates.append(game_id)
            seen_ids.add(game_id)
            game_type = _clean_str(row.get("gameType")) or "Unknown"
            game_types[game_type] += 1
            raw_date = _clean_str(row.get("gameDate"))
            if not raw_date:
                invalid_dates.append(game_id)
                continue
            try:
                dt = datetime.strptime(raw_date, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                invalid_dates.append(game_id)
                continue
            seasons[_season_label(dt)] += 1
    return {
        "rowCount": len(seen_ids),
        "duplicateIds": duplicates,
        "invalidDateCount": len(invalid_dates),
        "invalidDateSamples": invalid_dates[:10],
        "seasonBreakdown": sorted(
            ("%s" % season, count) for season, count in seasons.items()
        ),
        "gameTypeBreakdown": dict(sorted(game_types.items())),
    }


def _positions_from_sources(official: dict[str, Any] | None, roster: dict[str, Any] | None) -> list[str]:
    positions: set[str] = set()
    if official:
        raw = _clean_str(official.get("pos"))
        if raw:
            for part in raw.replace("-", "/").replace(" ", "").split("/"):
                if not part:
                    continue
                part = part.upper()
                if part.startswith("G"):
                    positions.add("G")
                if part.startswith("F"):
                    positions.add("F")
                if part.startswith("C"):
                    positions.add("C")
    if roster:
        if (_clean_str(roster.get("guard")) or "").lower() == "true":
            positions.add("G")
        if (_clean_str(roster.get("forward")) or "").lower() == "true":
            positions.add("F")
        if (_clean_str(roster.get("center")) or "").lower() == "true":
            positions.add("C")
    return sorted(positions)


def _draft_info(official: dict[str, Any] | None, roster: dict[str, Any] | None) -> dict[str, Any] | None:
    data: dict[str, Any] = {}
    source = None
    if roster:
        year = _to_int(roster.get("draftYear"))
        round_ = _to_int(roster.get("draftRound"))
        number = _to_int(roster.get("draftNumber"))
        if year:
            data["seasonYear"] = year
            source = "historical"
        if round_:
            data["roundNum"] = round_
        if number:
            data["pickNum"] = number
    if official and official.get("draft"):
        draft = official["draft"]
        if draft.get("seasonYear") and not data.get("seasonYear"):
            data["seasonYear"] = _to_int(str(draft["seasonYear"]))
            source = "official"
        if draft.get("roundNum") and not data.get("roundNum"):
            data["roundNum"] = _to_int(str(draft["roundNum"]))
        if draft.get("pickNum") and not data.get("pickNum"):
            data["pickNum"] = _to_int(str(draft["pickNum"]))
        if draft.get("teamId"):
            data["teamId"] = _clean_str(str(draft["teamId"]))
    if not data:
        return None
    if source:
        data["source"] = source
    return data


def _normalized_player_record(
    person_id: str,
    official: dict[str, Any] | None,
    roster: dict[str, Any] | None,
) -> dict[str, Any]:
    first_name = _clean_str((official or {}).get("firstName")) or _clean_str((roster or {}).get("firstName"))
    last_name = _clean_str((official or {}).get("lastName")) or _clean_str((roster or {}).get("lastName"))
    display_name = (
        _clean_str((official or {}).get("temporaryDisplayName"))
        or " ".join(filter(None, [first_name, last_name]))
        or person_id
    )
    roster_height = _to_float((roster or {}).get("height"))
    official_height = (
        _meters_to_inches((official or {}).get("heightMeters"))
        or _to_float((official or {}).get("heightInches"))
    )
    height_inches = roster_height or official_height
    if height_inches:
        height_inches = round(height_inches, 1)
    roster_weight = _to_float((roster or {}).get("bodyWeight"))
    official_weight = (
        _kilograms_to_pounds((official or {}).get("weightKilograms"))
        or _to_float((official or {}).get("weightPounds"))
    )
    weight_pounds = roster_weight or official_weight
    if weight_pounds:
        weight_pounds = round(weight_pounds, 1)
    is_active = bool((official or {}).get("isActive"))
    if not official:
        is_active = False
    record = {
        "personId": person_id,
        "displayName": display_name,
        "firstName": first_name,
        "lastName": last_name,
        "isActive": is_active,
        "currentTeamId": _clean_str((official or {}).get("teamId")),
        "positions": _positions_from_sources(official, roster),
        "heightInches": height_inches,
        "weightPounds": weight_pounds,
        "birthdate": _clean_str((roster or {}).get("birthdate")),
        "country": _clean_str((roster or {}).get("country")),
        "college": _clean_str((roster or {}).get("lastAttended")),
        "draft": _draft_info(official, roster),
        "source": "both" if official and roster else ("official" if official else "historical"),
    }
    jersey = _clean_str((official or {}).get("jersey"))
    if jersey:
        record["jersey"] = jersey
    return record


def _normalized_team_record(
    team_id: str,
    official: dict[str, Any] | None,
    history: list[TeamEra],
) -> dict[str, Any]:
    latest_era = None
    if history:
        latest_era = max(history, key=lambda era: era.payload.get("seasonFounded") or -math.inf)
    record = {
        "teamId": team_id,
        "fullName": _clean_str((official or {}).get("fullName"))
        or _clean_str((latest_era.payload if latest_era else {}).get("teamName")),
        "tricode": _clean_str((official or {}).get("tricode"))
        or _clean_str((latest_era.payload if latest_era else {}).get("teamAbbrev")),
        "nickname": _clean_str((official or {}).get("nickname"))
        or _clean_str((latest_era.payload if latest_era else {}).get("teamName")),
        "city": _clean_str((official or {}).get("city"))
        or _clean_str((latest_era.payload if latest_era else {}).get("teamCity")),
        "urlName": _clean_str((official or {}).get("urlName")),
        "conference": _clean_str((official or {}).get("confName")),
        "division": _clean_str((official or {}).get("divName")),
        "isNBAFranchise": bool((official or {}).get("isNBAFranchise", True)),
        "history": [era.payload for era in sorted(history, key=lambda era: era.payload.get("seasonFounded") or 0)],
        "source": "both" if official and history else ("official" if official else "historical"),
    }
    return record


def build_phase1_payload(
    *,
    season: str,
    players_feed: str,
    teams_feed: str,
    output_dir: Path,
) -> None:
    roster = _load_players_csv()
    team_histories = _load_team_histories()
    players_json = _load_json_from_source(players_feed)
    teams_json = _load_json_from_source(teams_feed)

    official_players = list(_iter_official_players(players_json))
    official_teams = list(_iter_official_teams(teams_json))

    normalized_players: list[dict[str, Any]] = []
    matched_ids: set[str] = set()
    for player in official_players:
        roster_payload = roster.get(player.person_id)
        normalized_players.append(
            _normalized_player_record(
                player.person_id,
                player.payload,
                roster_payload.payload if roster_payload else None,
            )
        )
        matched_ids.add(player.person_id)
    for person_id, roster_player in roster.items():
        if person_id in matched_ids:
            continue
        normalized_players.append(
            _normalized_player_record(person_id, None, roster_player.payload)
        )
    normalized_players.sort(key=lambda row: (row.get("lastName") or "", row.get("firstName") or "", row["personId"]))

    normalized_teams: list[dict[str, Any]] = []
    matched_team_ids: set[str] = set()
    history_lookup = team_histories
    for team in official_teams:
        normalized_teams.append(
            _normalized_team_record(
                team.team_id,
                team.payload,
                history_lookup.get(team.team_id, []),
            )
        )
        matched_team_ids.add(team.team_id)
    for team_id, histories in history_lookup.items():
        if team_id in matched_team_ids:
            continue
        normalized_teams.append(_normalized_team_record(team_id, None, histories))
    normalized_teams.sort(key=lambda row: (row.get("fullName") or "", row["teamId"]))

    unmatched_official = [
        {
            "personId": player.person_id,
            "firstName": _clean_str(player.payload.get("firstName")),
            "lastName": _clean_str(player.payload.get("lastName")),
        }
        for player in official_players
        if player.person_id not in roster
    ]
    official_ids = {player.person_id for player in official_players}
    unmatched_historical = [
        {
            "personId": roster_player.person_id,
            "firstName": _clean_str(roster_player.payload.get("firstName")),
            "lastName": _clean_str(roster_player.payload.get("lastName")),
        }
        for roster_player in roster.values()
        if roster_player.person_id not in official_ids
    ]
    player_integrity = {
        "officialCount": len(official_players),
        "historicalCount": len(roster),
        "normalizedCount": len(normalized_players),
        "unmatchedOfficialCount": len(unmatched_official),
        "unmatchedHistoricalCount": len(unmatched_historical),
        "unmatchedOfficialSamples": unmatched_official[:25],
        "unmatchedHistoricalSamples": unmatched_historical[:25],
    }

    unmatched_official_teams = [
        {
            "teamId": team.team_id,
            "fullName": _clean_str(team.payload.get("fullName")),
        }
        for team in official_teams
        if team.team_id not in team_histories
    ]
    official_team_ids = {team.team_id for team in official_teams}
    unmatched_historical_teams = [
        {"teamId": team_id, "eraCount": len(histories)}
        for team_id, histories in team_histories.items()
        if team_id not in official_team_ids
    ]
    team_integrity = {
        "officialCount": len(official_teams),
        "historicalCount": len(team_histories),
        "normalizedCount": len(normalized_teams),
        "unmatchedOfficialCount": len(unmatched_official_teams),
        "unmatchedHistoricalCount": len(unmatched_historical_teams),
        "unmatchedOfficialSamples": unmatched_official_teams[:25],
        "unmatchedHistoricalSamples": unmatched_historical_teams[:25],
    }

    league_directory = {
        "generatedAt": _timestamp(),
        "season": season,
        "feeds": {
            "players": players_feed,
            "teams": teams_feed,
        },
        "players": normalized_players,
        "teams": normalized_teams,
        "integrity": {
            "players": player_integrity,
            "teams": team_integrity,
        },
    }

    audit_payload = {
        "generatedAt": _timestamp(),
        "players": _summarize_players_table(roster),
        "teamHistories": _summarize_team_histories(team_histories),
        "games": _summarize_games_table(),
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / "league_directory.json").open("w", encoding="utf-8") as fh:
        json.dump(league_directory, fh, indent=2, ensure_ascii=False)
    with (output_dir / "historical_audit.json").open("w", encoding="utf-8") as fh:
        json.dump(audit_payload, fh, indent=2, ensure_ascii=False)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Phase 1 data plumbing pipeline.")
    parser.add_argument("--season", default=DEFAULT_SEASON, help="Season used for official feeds (e.g., 2024).")
    parser.add_argument(
        "--players-feed",
        default=DEFAULT_PLAYERS_FEED,
        help="Official players feed URL or local JSON path.",
    )
    parser.add_argument(
        "--teams-feed",
        default=DEFAULT_TEAMS_FEED,
        help="Official teams feed URL or local JSON path.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(PUBLIC_DATA_DIR),
        help="Directory where normalized JSON payloads should be written.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    args = _parse_args(argv or sys.argv[1:])
    players_feed = args.players_feed.format(season=args.season)
    teams_feed = args.teams_feed.format(season=args.season)
    build_phase1_payload(
        season=args.season,
        players_feed=players_feed,
        teams_feed=teams_feed,
        output_dir=Path(args.output_dir),
    )


if __name__ == "__main__":
    main()
