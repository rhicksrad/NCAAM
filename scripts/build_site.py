"""Generate a minimal static site for GitHub Pages using repository data."""
from __future__ import annotations

import csv
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "TeamHistories.csv"
OUTPUT_DIR = ROOT / "public"
OUTPUT_FILE = OUTPUT_DIR / "index.html"


def load_active_franchises(path: Path) -> list[dict[str, str]]:
    """Return active franchise records sorted by season founded then name."""
    teams: list[dict[str, str]] = []
    with path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            # "2100" indicates active franchises according to the data dictionary.
            if row.get("seasonActiveTill") == "2100":
                teams.append(row)

    def sort_key(team: dict[str, str]) -> tuple[int, str]:
        founded = team.get("seasonFounded", "")
        try:
            founded_year = int(founded)
        except ValueError:
            founded_year = 9999
        return founded_year, team.get("teamName", "")

    teams.sort(key=sort_key)
    return teams


def summarize_by_decade(teams: list[dict[str, str]]) -> list[tuple[str, int]]:
    """Return (decade, count) tuples sorted chronologically."""
    decade_counts: Counter[str] = Counter()
    for team in teams:
        founded_raw = team.get("seasonFounded", "").strip()
        try:
            founded_year = int(founded_raw)
        except ValueError:
            # Skip rows without a parsable founding year.
            continue

        decade_start = (founded_year // 10) * 10
        label = f"{decade_start}s"
        decade_counts[label] += 1

    return sorted(decade_counts.items(), key=lambda item: int(item[0][:4]))


def render_html(teams: list[dict[str, str]], generated_at: datetime) -> str:
    timestamp = generated_at.strftime("%Y-%m-%d %H:%M UTC")
    repository = os.environ.get("GITHUB_REPOSITORY", "your-username/NBA")
    decades = summarize_by_decade(teams)
    rows = "\n          ".join(
        f"<tr><td>{team['teamCity'].strip()}</td><td>{team['teamName'].strip()}</td>"
        f"<td>{team['teamAbbrev'].strip()}</td><td>{team['seasonFounded'].strip()}</td></tr>"
        for team in teams
    )
    decade_rows = "\n          ".join(
        f"<tr><td>{decade}</td><td>{count}</td></tr>" for decade, count in decades
    )

    return f"""<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>NBA Active Franchises Snapshot</title>
  <style>
    :root {{
      color-scheme: light dark;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }}
    body {{
      margin: 2rem auto;
      max-width: 900px;
      line-height: 1.6;
      padding: 0 1rem;
    }}
    header {{
      text-align: center;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 1.5rem;
    }}
    th, td {{
      border: 1px solid rgba(0,0,0,0.2);
      padding: 0.5rem;
      text-align: left;
    }}
    th {{
      background: rgba(0,0,0,0.05);
    }}
    caption {{
      caption-side: bottom;
      font-size: 0.9rem;
      color: rgba(0,0,0,0.7);
      margin-top: 0.75rem;
    }}
  </style>
</head>
<body>
  <header>
    <h1>NBA Active Franchises Snapshot</h1>
    <p>This lightweight page is generated automatically from <code>TeamHistories.csv</code> in this repository.</p>
    <p><strong>{len(teams)}</strong> franchises are marked as active in the dataset.</p>
    <p class=\"timestamp\">Last generated: {timestamp}</p>
  </header>
  <main>
    <section>
      <h2>Current franchise eras</h2>
      <p>The table lists each active franchise along with the city, nickname, historical abbreviation, and the first season in the current era.</p>
      <table>
        <thead>
          <tr>
            <th scope=\"col\">City</th>
            <th scope=\"col\">Nickname</th>
            <th scope=\"col\">Abbrev.</th>
            <th scope=\"col\">Season Founded</th>
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
        <caption>Data source: <code>TeamHistories.csv</code> &mdash; generated automatically on each push.</caption>
      </table>
    </section>
    <section>
      <h2>Active franchises by founding decade</h2>
      <p>This quick snapshot shows how many modern franchises entered the league in each decade, offering an early look at potential era-based analyses.</p>
      <table>
        <thead>
          <tr>
            <th scope=\"col\">Decade</th>
            <th scope=\"col\">Active Franchises</th>
          </tr>
        </thead>
        <tbody>
          {decade_rows}
        </tbody>
      </table>
    </section>
  </main>
  <footer>
    <p>View the source on <a href=\"https://github.com/{repository}\">GitHub</a>.</p>
  </footer>
</body>
</html>
"""


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # The repository now ships a hand-crafted single page app in
    # ``public/index.html``. The original version of this script generated a
    # minimal HTML table that overwrote the richer experience during the
    # GitHub Pages build. Detect the presence of the new front-end (keyed off
    # its document title) and leave it untouched so the published site matches
    # local previews.
    if OUTPUT_FILE.exists():
        existing = OUTPUT_FILE.read_text(encoding="utf-8", errors="ignore")
        if "NBA Intelligence Hub" in existing:
            print("Detected prebuilt NBA Intelligence Hub UI; skipping auto-generation.")
            return

    teams = load_active_franchises(DATA_FILE)
    html = render_html(teams, datetime.now(tz=timezone.utc))
    OUTPUT_FILE.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    main()
