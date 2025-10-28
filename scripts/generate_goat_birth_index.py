"""Generate GOAT birthplace index and top-10 state/country leaderboards."""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime
from math import inf, isfinite
from pathlib import Path
from typing import Dict, Iterable, List, Optional

BASE_DIR = Path(__file__).resolve().parents[1]
PUBLIC_DATA_DIR = BASE_DIR / "public" / "data"
DATA_DIR = BASE_DIR / "data"


def normalize_name(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())


US_STATE_ALIASES: Dict[str, str] = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "district of columbia": "DC",
    "d.c.": "DC",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
    "puerto rico": "PR",
}

US_STATE_NAMES: Dict[str, str] = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "DC": "District of Columbia",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "PR": "Puerto Rico",
}


COUNTRY_OVERRIDES: Dict[str, str] = {
    "usa": "US",
    "u.s.a": "US",
    "u.s.": "US",
    "u.s": "US",
    "united states": "US",
    "the bahamas": "BS",
    "bosnia": "BA",
    "bosnia and herzegovina": "BA",
    "congo": "CG",
    "democratic republic of the congo": "CD",
    "republic of the congo": "CG",
    "ivory coast": "CI",
    "cote d'ivoire": "CI",
    "south korea": "KR",
    "north korea": "KP",
    "great britain": "GB",
    "england": "GB",
    "scotland": "GB",
    "wales": "GB",
    "u.k": "GB",
    "united kingdom": "GB",
    "czech republic": "CZ",
    "slovak republic": "SK",
    "trinidad": "TT",
    "trinidad and tobago": "TT",
    "us virgin islands": "VI",
    "virgin islands": "VI",
    "u.s. virgin islands": "VI",
    "serbia and montenegro": "RS",
    "yugoslavia": "RS",
    "soviet union": "RU",
    "ussr": "RU",
}


TEAM_NAME_OVERRIDES: Dict[str, str] = {
    "BAL": "Baltimore Bullets",
    "BUF": "Buffalo Braves",
    "CAP": "Capital Bullets",
    "CIN": "Cincinnati Royals",
    "KCO": "Kansas City-Omaha Kings",
    "KC": "Kansas City Kings",
    "NEO": "New Orleans/Oklahoma City Hornets",
    "NOH": "New Orleans Hornets",
    "NOK": "New Orleans/Oklahoma City Hornets",
    "PHW": "Philadelphia Warriors",
    "SAS": "San Antonio Spurs",
    "SD": "San Diego Rockets",
    "SFW": "San Francisco Warriors",
    "SF": "San Francisco Warriors",
    "SDC": "San Diego Clippers",
    "SEA": "Seattle SuperSonics",
    "STL": "St. Louis Hawks",
    "VAN": "Vancouver Grizzlies",
    "NJ": "New Jersey Nets",
}


@dataclass
class BirthRecord:
    city: Optional[str]
    state: Optional[str]
    country_code: str
    country_name: str


def resolve_country(value: str) -> Optional[str]:
    import pycountry

    token = value.strip().lower()
    if not token:
        return None
    if token in COUNTRY_OVERRIDES:
        return COUNTRY_OVERRIDES[token]
    try:
        match = pycountry.countries.lookup(token)
        return match.alpha_2
    except LookupError:
        return None


def resolve_state(value: str) -> Optional[str]:
    token = value.strip().lower().replace(".", "")
    if not token:
        return None
    if token in US_STATE_ALIASES:
        return US_STATE_ALIASES[token]
    if token.upper() in US_STATE_ALIASES.values():
        return token.upper()
    return None


def parse_birthplace(raw_value: str) -> Optional[BirthRecord]:
    if not raw_value or not raw_value.strip():
        return None
    cleaned = raw_value.replace(";", ",").replace("  ", " ").strip()
    parts = [part.strip() for part in cleaned.split(",") if part.strip()]
    if not parts:
        return None

    # Attempt to identify country from the last segment.
    country_code: Optional[str] = None
    country_name: Optional[str] = None
    state_code: Optional[str] = None
    city: Optional[str] = None

    if len(parts) == 1:
        city = parts[0]
        country_code = "US"
        country_name = "United States"
    else:
        possible_country = parts[-1]
        country_code = resolve_country(possible_country)
        if country_code:
            country_name = possible_country.strip()
            if len(parts) >= 3:
                state_code = resolve_state(parts[-2])
                city = ", ".join(parts[:-2]) if state_code else ", ".join(parts[:-1])
            else:
                city = parts[0]
        else:
            state_code = resolve_state(possible_country)
            if state_code:
                city = ", ".join(parts[:-1])
                country_code = "US"
                country_name = "United States"
            else:
                city = ", ".join(parts[:-1])
                country_code = resolve_country(parts[-1]) or "US"
                country_name = parts[-1]

    if not country_code:
        country_code = "US"
        country_name = country_name or "United States"

    if country_code == "US" and not state_code and len(parts) >= 2:
        candidate = resolve_state(parts[-1])
        if candidate:
            state_code = candidate
            city = ", ".join(parts[:-1])

    return BirthRecord(city=city or None, state=state_code, country_code=country_code, country_name=country_name or country_code)


def load_birth_lookup() -> Dict[str, BirthRecord]:
    lookup: Dict[str, BirthRecord] = {}
    csv_sources = [
        (DATA_DIR / "nba_birthplaces.csv", "player", "birthplace"),
        (DATA_DIR / "nba_draft_birthplaces.csv", "player", "birthplace"),
    ]
    for path, name_col, place_col in csv_sources:
        if not path.exists():
            msg = f"Missing birthplace dataset: {path}"
            raise FileNotFoundError(msg)
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            fieldnames = reader.fieldnames or []
            missing = {name_col, place_col} - set(fieldnames)
            if missing:
                missing_cols = ", ".join(sorted(missing))
                msg = f"{path} is missing required columns: {missing_cols}"
                raise ValueError(msg)
            for row in reader:
                name = (row.get(name_col) or "").strip()
                place = (row.get(place_col) or "").strip()
                record = parse_birthplace(place)
                if not name or not record:
                    continue
                lookup.setdefault(normalize_name(name), record)
    return lookup


def load_manual_overrides() -> Dict[str, BirthRecord]:
    manual: Dict[str, BirthRecord] = {}
    manual_entries = {
        "wiltchamberlain": ("Philadelphia", "PA", "US", "United States"),
        "kareemabduljabbar": ("New York City", "NY", "US", "United States"),
        "karlmalone": ("Summerfield", "LA", "US", "United States"),
        "shaquilleoneal": ("Newark", "NJ", "US", "United States"),
        "magicjohnson": ("Lansing", "MI", "US", "United States"),
        "michaeljordan": ("Brooklyn", "NY", "US", "United States"),
        "billrussell": ("Monroe", "LA", "US", "United States"),
        "larrybird": ("West Baden Springs", "IN", "US", "United States"),
        "jasonkidd": ("San Francisco", "CA", "US", "United States"),
        "scottiepippen": ("Hamburg", "AR", "US", "United States"),
        "johnhavlicek": ("Martins Ferry", "OH", "US", "United States"),
        "hakeemolajuwon": ("Lagos", None, "NG", "Nigeria"),
        "kevingarnett": ("Greenville", "SC", "US", "United States"),
        "elvinhayes": ("Rayville", "LA", "US", "United States"),
        "johnstockton": ("Spokane", "WA", "US", "United States"),
        "garypayton": ("Oakland", "CA", "US", "United States"),
        "charlesbarkley": ("Leeds", "AL", "US", "United States"),
        "mosesmalone": ("Petersburg", "VA", "US", "United States"),
        "robertparish": ("Shreveport", "LA", "US", "United States"),
        "oscarrobertson": ("Charlotte", "TN", "US", "United States"),
        "patrickewing": ("Kingston", None, "JM", "Jamaica"),
        "davecowens": ("Newport", "KY", "US", "United States"),
        "wesunseld": ("Louisville", "KY", "US", "United States"),
        "rasheedwallace": ("Philadelphia", "PA", "US", "United States"),
        "davidrobinson": ("Key West", "FL", "US", "United States"),
        "juliuserving": ("Roosevelt", "NY", "US", "United States"),
        "natethurmond": ("Akron", "OH", "US", "United States"),
        "clydedrexler": ("New Orleans", "LA", "US", "United States"),
        "paulsilas": ("Prescott", "AR", "US", "United States"),
        "dennisjohnson": ("Compton", "CA", "US", "United States"),
        "isiahthomas": ("Chicago", "IL", "US", "United States"),
        "waltfrazier": ("Atlanta", "GA", "US", "United States"),
        "roberthorry": ("Harford County", "MD", "US", "United States"),
        "jerrywest": ("Chelyan", "WV", "US", "United States"),
        "chriswebber": ("Detroit", "MI", "US", "United States"),
        "rickbarry": ("Elizabeth", "NJ", "US", "United States"),
        "reggiemiller": ("Riverside", "CA", "US", "United States"),
        "manuginobili": ("Bahía Blanca", None, "AR", "Argentina"),
        "jacksikma": ("Kankakee", "IL", "US", "United States"),
        "mauricecheeks": ("Chicago", "IL", "US", "United States"),
        "michaelfinley": ("Chicago", "IL", "US", "United States"),
        "markjackson": ("Brooklyn", "NY", "US", "United States"),
        "billbridges": ("Hobbs", "NM", "US", "United States"),
        "horacegrant": ("Augusta", "GA", "US", "United States"),
        "benwallace": ("White Hall", "AL", "US", "United States"),
        "bobdandridge": ("Richmond", "VA", "US", "United States"),
        "kevinmchale": ("Hibbing", "MN", "US", "United States"),
        "dennisrodman": ("Trenton", "NJ", "US", "United States"),
        "cliffordrobinson": ("Buffalo", "NY", "US", "United States"),
        "samperkins": ("Brooklyn", "NY", "US", "United States"),
        "charlesoakley": ("Cleveland", "OH", "US", "United States"),
        "bobmcadoo": ("Greensboro", "NC", "US", "United States"),
        "adriandantley": ("Washington", "DC", "US", "United States"),
        "jamaalwilkes": ("Berkeley", "CA", "US", "United States"),
        "dominiquewilkins": ("Paris", None, "FR", "France"),
        "ronharper": ("Dayton", "OH", "US", "United States"),
        "jeffhornacek": ("Elmhurst", "IL", "US", "United States"),
        "otisthorpe": ("Boynton Beach", "FL", "US", "United States"),
        "latrellsprewell": ("Milwaukee", "WI", "US", "United States"),
        "vladedivac": ("Prijepolje", None, "RS", "Serbia"),
        "jojowhite": ("St. Louis", "MO", "US", "United States"),
        "kevinjohnson": ("Sacramento", "CA", "US", "United States"),
        "elginbaylor": ("Washington", "DC", "US", "United States"),
        "buckwilliams": ("Rocky Mount", "NC", "US", "United States"),
        "timhardaway": ("Chicago", "IL", "US", "United States"),
        "alexenglish": ("Columbia", "SC", "US", "United States"),
        "jamesworthy": ("Gastonia", "NC", "US", "United States"),
        "samcassell": ("Baltimore", "MD", "US", "United States"),
        "dikembemutombo": ("Kinshasa", None, "CD", "Democratic Republic of the Congo"),
        "guswilliams": ("Mount Vernon", "NY", "US", "United States"),
        "lennywilkens": ("Brooklyn", "NY", "US", "United States"),
        "normnixon": ("Macon", "GA", "US", "United States"),
        "pjbrown": ("Detroit", "MI", "US", "United States"),
        "kevinwillis": ("Los Angeles", "CA", "US", "United States"),
        "billlaimbeer": ("Boston", "MA", "US", "United States"),
        "terrycummings": ("Chicago", "IL", "US", "United States"),
        "georgegervin": ("Detroit", "MI", "US", "United States"),
        "daledavis": ("Toccoa", "GA", "US", "United States"),
        "jerrylucas": ("Middletown", "OH", "US", "United States"),
        "boblanier": ("Buffalo", "NY", "US", "United States"),
        "larrynance": ("Anderson", "SC", "US", "United States"),
        "acgreen": ("Portland", "OR", "US", "United States"),
        "natearchibald": ("New York City", "NY", "US", "United States"),
        "gailgoodrich": ("Los Angeles", "CA", "US", "United States"),
        "marquesjohnson": ("Natchitoches", "LA", "US", "United States"),
        "glenrice": ("Flint", "MI", "US", "United States"),
        "alonzomourning": ("Chesapeake", "VA", "US", "United States"),
        "eddiejones": ("Pompano Beach", "FL", "US", "United States"),
        "byronscott": ("Ogden", "UT", "US", "United States"),
    }
    for key, (city, state, country_code, country_name) in manual_entries.items():
        manual[key] = BirthRecord(city=city, state=state, country_code=country_code, country_name=country_name)
    return manual


def load_team_directory() -> Dict[str, str]:
    directory_path = PUBLIC_DATA_DIR / "league_directory.json"
    with directory_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    mapping: Dict[str, str] = {}
    for team in data.get("teams", []):
        tricode = team.get("tricode")
        nickname = team.get("nickname")
        city = team.get("city")
        full_name = team.get("fullName")
        if tricode:
            if full_name and ' ' in full_name:
                mapping[tricode] = full_name
            elif city and nickname:
                mapping[tricode] = f"{city} {nickname}".strip()
            elif full_name:
                mapping[tricode] = full_name
            else:
                mapping[tricode] = tricode
    for code, name in TEAM_NAME_OVERRIDES.items():
        mapping.setdefault(code, name)
    return mapping


def _load_goat_index_players() -> list[dict]:
    path = PUBLIC_DATA_DIR / "goat_index.json"
    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    players = payload.get("players", [])
    if not isinstance(players, list):
        return []
    return players


def _load_goat_system_lookup() -> dict[str, dict]:
    path = PUBLIC_DATA_DIR / "goat_system.json"
    try:
        with path.open("r", encoding="utf-8") as f:
            payload = json.load(f)
    except FileNotFoundError:
        return {}
    players = payload.get("players", [])
    if not isinstance(players, list):
        return {}
    return {normalize_name(player.get("name", "")): player for player in players if player.get("name")}


def _is_valid_score(value: object) -> bool:
    if isinstance(value, (int, float)) and isfinite(value):
        return True
    return False


def _normalise_score(value: object) -> float:
    if isinstance(value, bool):
        # bool is a subclass of int but we never expect it here
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    try:
        parsed = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return float("nan")
    return parsed


def build_player_records() -> List[dict]:
    curated_players = _load_goat_index_players()
    system_lookup = _load_goat_system_lookup()

    birth_lookup = load_birth_lookup()
    manual_overrides = load_manual_overrides()
    birth_lookup.update(manual_overrides)
    team_lookup = load_team_directory()

    combined: dict[str, dict] = {}

    for key, system_player in system_lookup.items():
        combined[key] = system_player.copy()

    for player in curated_players:
        name = player.get("name")
        if not name:
            continue
        key = normalize_name(name)
        base = combined.get(key, {}).copy()
        merged = base.copy()
        merged.update(player)

        # Preserve authoritative ranking + scoring data from the system feed so
        # the birth index mirrors the public GOAT order. Editorial snapshots in
        # ``goat_index.json`` only cover the top tier and can override fields
        # such as ``rank`` or ``goatScore`` when merged blindly, which caused
        # gaps like the missing no. 11, 13, 14, and 16 ranks called out in the
        # last run.
        system_rank = base.get("rank")
        if isinstance(system_rank, (int, float)):
            merged["rank"] = system_rank

        system_score = base.get("goatScore")
        if isinstance(system_score, (int, float)):
            merged["goatScore"] = system_score

        if not merged.get("personId"):
            merged["personId"] = base.get("personId")
        if not merged.get("resume"):
            merged["resume"] = base.get("resume")
        if not merged.get("franchises"):
            merged["franchises"] = base.get("franchises")
        if not merged.get("tier"):
            merged["tier"] = base.get("tier")
        combined[key] = merged

    enriched: list[dict] = []
    for key, player in combined.items():
        name = player.get("name")
        if not name:
            continue
        birth = birth_lookup.get(key)
        if not birth:
            continue

        goat_score_raw = player.get("goatScore")
        goat_score = _normalise_score(goat_score_raw)
        if not _is_valid_score(goat_score):
            continue

        franchises_raw = player.get("franchises") or []
        franchises = [team_lookup.get(code, code) for code in franchises_raw if code]

        rank_value = player.get("rank")
        if isinstance(rank_value, (int, float)):
            try:
                rank_value = int(rank_value)
            except (TypeError, ValueError):  # pragma: no cover - defensive
                rank_value = None
        else:
            rank_value = None

        enriched.append(
            {
                "personId": player.get("personId"),
                "name": name,
                "rank": rank_value,
                "goatScore": round(goat_score, 1),
                "tier": player.get("tier"),
                "resume": player.get("resume"),
                "franchises": franchises,
                "birthCity": birth.city,
                "birthState": birth.state,
                "birthCountry": birth.country_name,
                "birthCountryCode": birth.country_code,
            }
        )

    def sort_key(item: dict) -> tuple:
        rank = item.get("rank")
        if isinstance(rank, int):
            return (rank, item.get("name") or "")
        score = item.get("goatScore")
        return (float("inf"), -(score if isinstance(score, (int, float)) else 0), item.get("name") or "")

    enriched.sort(key=sort_key)
    return enriched


def group_top_players(players: Iterable[dict]) -> tuple[list[dict], list[dict]]:
    def sort_group(entries: Iterable[dict]) -> list[dict]:
        scored: list[tuple[float, dict]] = []
        for entry in entries:
            score = _normalise_score(entry.get("goatScore"))
            if not _is_valid_score(score):
                continue
            scored.append((round(score, 1), entry))
        scored.sort(
            key=lambda pair: (
                -pair[0],
                pair[1].get("rank") if isinstance(pair[1].get("rank"), (int, float)) else inf,
                pair[1].get("name") or "",
            )
        )
        serialised: list[dict] = []
        for ordinal, (score, entry) in enumerate(scored[:10], start=1):
            payload = {
                "personId": entry.get("personId"),
                "name": entry.get("name"),
                "rank": entry.get("rank"),
                "goatScore": score,
                "tier": entry.get("tier"),
                "resume": entry.get("resume"),
                "franchises": [team for team in (entry.get("franchises") or []) if team],
                "birthCity": entry.get("birthCity"),
                "birthState": entry.get("birthState"),
                "birthCountry": entry.get("birthCountry"),
                "birthCountryCode": entry.get("birthCountryCode"),
            }
            payload["groupRank"] = ordinal
            serialised.append(payload)
        return serialised

    state_groups: Dict[str, List[dict]] = defaultdict(list)
    country_groups: Dict[str, List[dict]] = defaultdict(list)
    for player in players:
        state = player.get("birthState")
        country = player.get("birthCountryCode")
        if country == "US" and state:
            state_groups[state].append(player)
        if country:
            country_groups[country].append(player)

    states_payload = []
    for state, entries in state_groups.items():
        top = sort_group(entries)
        headline_player = top[0] if top else None
        states_payload.append(
            {
                "state": state,
                "stateName": US_STATE_NAMES.get(state, state),
                "player": headline_player.get("name") if headline_player else None,
                "birthCity": headline_player.get("birthCity") if headline_player else None,
                "headline": headline_player.get("resume") if headline_player else None,
                "notableTeams": headline_player.get("franchises", []) if headline_player else [],
                "topPlayers": top,
            }
        )

    import pycountry

    countries_payload = []
    for code, entries in country_groups.items():
        top = sort_group(entries)
        headline_player = top[0] if top else None
        try:
            country_name = pycountry.countries.lookup(code).name
        except LookupError:
            country_name = code
        countries_payload.append(
            {
                "country": code,
                "countryName": country_name,
                "player": headline_player.get("name") if headline_player else None,
                "birthCity": headline_player.get("birthCity") if headline_player else None,
                "headline": headline_player.get("resume") if headline_player else None,
                "notableTeams": headline_player.get("franchises", []) if headline_player else [],
                "topPlayers": top,
            }
        )

    states_payload.sort(key=lambda item: item["state"])
    countries_payload.sort(key=lambda item: item["countryName"])
    return states_payload, countries_payload


def write_payload(file_path: Path, payload: dict) -> None:
    file_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    players = build_player_records()
    states, countries = group_top_players(players)
    timestamp = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    write_payload(
        PUBLIC_DATA_DIR / "goat_birth_index.json",
        {"generatedAt": timestamp, "players": players},
    )
    write_payload(
        PUBLIC_DATA_DIR / "state_birth_legends.json",
        {"generatedAt": timestamp, "states": states},
    )
    write_payload(
        PUBLIC_DATA_DIR / "world_birth_legends.json",
        {"generatedAt": timestamp, "countries": countries},
    )


if __name__ == "__main__":
    main()

