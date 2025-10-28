#!/usr/bin/env python3
"""Download and convert the Basketball-Reference schedule into the repo CSV format."""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional

import requests
from bs4 import BeautifulSoup, Comment

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    from backports.zoneinfo import ZoneInfo  # type: ignore

BREF_TEAM_TO_STATS_ID = {
    "ATL": "1610612737",
    "BOS": "1610612738",
    "BRK": "1610612751",
    "CHI": "1610612741",
    "CHO": "1610612766",
    "CHA": "1610612766",
    "CLE": "1610612739",
    "DAL": "1610612742",
    "DEN": "1610612743",
    "DET": "1610612765",
    "GSW": "1610612744",
    "HOU": "1610612745",
    "IND": "1610612754",
    "LAC": "1610612746",
    "LAL": "1610612747",
    "MEM": "1610612763",
    "MIA": "1610612748",
    "MIL": "1610612749",
    "MIN": "1610612750",
    "NOP": "1610612740",
    "NYK": "1610612752",
    "OKC": "1610612760",
    "ORL": "1610612753",
    "PHI": "1610612755",
    "PHO": "1610612756",
    "PHX": "1610612756",
    "POR": "1610612757",
    "SAC": "1610612758",
    "SAS": "1610612759",
    "TOR": "1610612761",
    "UTA": "1610612762",
    "WAS": "1610612764",
}

CSV_HEADERS = [
    "gameId",
    "gameDateTimeEst",
    "gameDay",
    "arenaCity",
    "arenaState",
    "arenaName",
    "gameLabel",
    "gameSubLabel",
    "gameSubtype",
    "gameSequence",
    "seriesGameNumber",
    "seriesText",
    "weekNumber",
    "hometeamId",
    "awayteamId",
]

@dataclass
class ScheduleRow:
    game_id: str
    tipoff_utc: str
    game_day: str
    arena_name: str
    label: str
    sublabel: str
    subtype: str
    sequence: int
    home_id: str
    away_id: str

    def to_csv_row(self) -> list[str]:
        return [
            self.game_id,
            self.tipoff_utc,
            self.game_day,
            "",
            "",
            self.arena_name,
            self.label,
            self.sublabel,
            self.subtype,
            str(self.sequence),
            "",
            "",
            "",
            self.home_id,
            self.away_id,
        ]


def parse_args(argv: Optional[Iterable[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--season",
        default="2025-26",
        help="Season label in YYYY-YY format (default: 2025-26)",
    )
    parser.add_argument(
        "--html-path",
        type=Path,
        help="Optional path to a local Basketball-Reference HTML schedule. When provided, the script skips network fetches.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Output CSV path. Defaults to LeagueScheduleXX_YY.csv under the repo root.",
    )
    parser.add_argument(
        "--url",
        help="Override the Basketball-Reference schedule URL.",
    )
    return parser.parse_args(argv)


def season_to_end_year(season_label: str) -> int:
    parts = season_label.split("-")
    if len(parts) != 2:
        raise ValueError(f"Unexpected season format: {season_label}")
    start = int(parts[0])
    end_suffix = int(parts[1])
    if end_suffix < 100:
        end = (start // 100) * 100 + end_suffix
        if end < start:
            end += 100
    else:
        end = end_suffix
    return end


def fetch_html(url: str) -> str:
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    return response.text


def extract_schedule_table(html: str) -> BeautifulSoup:
    soup = BeautifulSoup(html, "html.parser")
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        if "<table" in comment and "id=\"schedule\"" in comment:
            return BeautifulSoup(comment, "html.parser")
    table = soup.find("table", id="schedule")
    if table:
        return table
    raise RuntimeError("Unable to locate schedule table in source HTML")


def parse_time(date: dt.date, time_text: str) -> dt.datetime:
    if not time_text or time_text.strip().lower() in {"tbd", "na", ""}:
        naive = dt.datetime.combine(date, dt.time(0, 0))
        eastern = naive.replace(tzinfo=ZoneInfo("America/New_York"))
        return eastern.astimezone(ZoneInfo("UTC"))

    time_text = time_text.strip().lower().replace(" ", "")
    if time_text.endswith("a"):
        time_text = f"{time_text[:-1]}am"
    elif time_text.endswith("p"):
        time_text = f"{time_text[:-1]}pm"
    try:
        tip_local = dt.datetime.strptime(time_text, "%I:%M%p")
    except ValueError:
        try:
            tip_local = dt.datetime.strptime(time_text, "%I%p")
        except ValueError as exc:  # pragma: no cover - defensive guard
            raise ValueError(f"Unable to parse tip-off time '{time_text}'") from exc
    tip_datetime = dt.datetime.combine(date, tip_local.time())
    eastern = tip_datetime.replace(tzinfo=ZoneInfo("America/New_York"))
    return eastern.astimezone(ZoneInfo("UTC"))


def infer_label(game_type: str, notes: str, date_value: dt.date) -> str:
    normalized_type = (game_type or "").strip().lower()
    normalized_notes = (notes or "").strip().lower()
    if normalized_type:
        if "preseason" in normalized_type:
            return "Preseason"
        if "cup" in normalized_type:
            return "In-Season Tournament"
        if "play-in" in normalized_type:
            return "Play-In"
        if "playoff" in normalized_type or "final" in normalized_type:
            return "Playoffs"
        if "regular" in normalized_type:
            return "Regular Season"
    if "preseason" in normalized_notes:
        return "Preseason"
    if date_value.month < 10:
        return "Preseason"
    return "Regular Season"


def parse_schedule_rows(table: BeautifulSoup) -> list[ScheduleRow]:
    body = table.find("tbody") or table
    rows: list[ScheduleRow] = []
    sequence_tracker: defaultdict[dt.date, int] = defaultdict(int)

    for tr in body.find_all("tr"):
        if "class" in tr.attrs and "thead" in tr.get("class", []):
            continue
        date_cell = tr.find("th", {"data-stat": "date_game"})
        if not date_cell:
            continue
        csk = date_cell.get("csk")
        if not csk:
            continue
        date_value = dt.datetime.strptime(csk, "%Y%m%d").date()
        time_cell = tr.find("td", {"data-stat": "start_time"})
        start_time = time_cell.get_text(strip=True) if time_cell else ""
        tipoff_utc = parse_time(date_value, start_time)

        visitor_cell = tr.find("td", {"data-stat": "visitor_team_name"})
        home_cell = tr.find("td", {"data-stat": "home_team_name"})
        if not visitor_cell or not home_cell:
            continue
        visitor_link = visitor_cell.find("a")
        home_link = home_cell.find("a")
        visitor_abbr = visitor_link["href"].split("/")[2] if visitor_link and "href" in visitor_link.attrs else visitor_cell.get_text(strip=True)[:3].upper()
        home_abbr = home_link["href"].split("/")[2] if home_link and "href" in home_link.attrs else home_cell.get_text(strip=True)[:3].upper()
        visitor_id = BREF_TEAM_TO_STATS_ID.get(visitor_abbr, "")
        home_id = BREF_TEAM_TO_STATS_ID.get(home_abbr, "")

        arena_cell = tr.find("td", {"data-stat": "arena_name"})
        arena_name = arena_cell.get_text(strip=True) if arena_cell else ""

        type_cell = tr.find("td", {"data-stat": "game_type"})
        notes_cell = tr.find("td", {"data-stat": "notes"})
        game_type = type_cell.get_text(strip=True) if type_cell else ""
        notes = notes_cell.get_text(strip=True) if notes_cell else ""

        label = infer_label(game_type, notes, date_value)
        subtype = ""
        if "cup" in (game_type or "").lower() or "cup" in (notes or "").lower():
            subtype = "In-Season Tournament"
        elif "play-in" in (game_type or "").lower() or "play-in" in (notes or "").lower():
            subtype = "Play-In"
        elif "playoff" in (game_type or "").lower() or "final" in (notes or "").lower():
            subtype = "Playoffs"

        box_cell = tr.find("td", {"data-stat": "box_score_text"})
        game_id = ""
        if box_cell:
            link = box_cell.find("a")
            if link and "href" in link.attrs:
                slug = link["href"].split("/")[-1]
                game_id = slug.replace(".html", "")
        if not game_id:
            game_id = f"sched-{date_value:%Y%m%d}-{visitor_abbr}-{home_abbr}"

        sequence_tracker[date_value] += 1
        sequence = sequence_tracker[date_value]

        rows.append(
            ScheduleRow(
                game_id=game_id,
                tipoff_utc=tipoff_utc.strftime("%Y-%m-%d %H:%M:%S+00:00"),
                game_day=date_value.strftime("%a"),
                arena_name=arena_name,
                label=label,
                sublabel=notes,
                subtype=subtype,
                sequence=sequence,
                home_id=home_id,
                away_id=visitor_id,
            )
        )

    return rows


def write_csv(rows: list[ScheduleRow], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(CSV_HEADERS)
        for row in rows:
            writer.writerow(row.to_csv_row())


def main(argv: Optional[Iterable[str]] = None) -> int:
    args = parse_args(argv)
    season_end_year = season_to_end_year(args.season)
    season_slug = args.season.replace("-", "_")

    if args.output:
        output_path = args.output
    else:
        output_path = Path(__file__).resolve().parent.parent / f"LeagueSchedule{season_slug}.csv"

    url = args.url or f"https://www.basketball-reference.com/leagues/NBA_{season_end_year}_games.html"

    if args.html_path:
        html = args.html_path.read_text(encoding="utf-8")
    else:
        print(f"Fetching schedule from {url}...", file=sys.stderr)
        html = fetch_html(url)

    table = extract_schedule_table(html)
    rows = parse_schedule_rows(table)
    if not rows:
        raise RuntimeError("No schedule rows parsed from Basketball-Reference HTML")
    write_csv(rows, output_path)
    print(f"Wrote {len(rows)} games to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
