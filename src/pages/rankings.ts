import { NCAAM } from "../lib/sdk/ncaam.js";

const app = document.getElementById("app")!;
app.innerHTML = `
  <h1 id="ranking-title">Final 2024 Rankings</h1>
  <p id="ranking-note" class="card">The final AP Top 25 for the 2024 season. New rankings will be available here once they are posted.</p>
  <table>
    <thead>
      <tr><th>#</th><th>Team</th><th>Record</th><th>Points</th><th>1st</th></tr>
    </thead>
    <tbody id="rows"><tr><td colspan="5">Loading final rankings…</td></tr></tbody>
  </table>
`;

const rows = document.getElementById("rows")!;
const title = document.getElementById("ranking-title");
const note = document.getElementById("ranking-note");

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  try {
    return value.toLocaleString();
  } catch {
    return String(value);
  }
}

function toTeamName(entry: { team?: { full_name?: string; name?: string } }): string {
  if (!entry || typeof entry !== "object") {
    return "—";
  }
  const team = entry.team;
  if (!team || typeof team !== "object") {
    return "—";
  }
  return team.full_name || team.name || "—";
}

try {
  const response = await NCAAM.rankings({ season: 2024 });
  const entries = Array.isArray(response?.data) ? response.data : [];
  const apEntries = entries.filter((entry) =>
    entry && typeof entry === "object" && typeof entry.poll === "string" && entry.poll.toLowerCase() === "ap"
  );

  const finalWeek = apEntries.reduce((max, entry) => {
    const week = typeof entry.week === "number" ? entry.week : Number.NEGATIVE_INFINITY;
    return week > max ? week : max;
  }, Number.NEGATIVE_INFINITY);

  const latestEntries = apEntries
    .filter((entry) => entry.week === finalWeek)
    .slice()
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

  if (!Number.isFinite(finalWeek) || latestEntries.length === 0) {
    rows.innerHTML = `<tr><td colspan="5">No AP rankings are available for the conclusion of the 2024 season yet.</td></tr>`;
  } else {
    if (title) {
      title.textContent = `Final 2024 AP Top 25 — Week ${finalWeek}`;
    }
    if (note) {
      note.textContent = `AP Top 25 final poll for the 2024 season (Week ${finalWeek}). New rankings will be available once they are posted.`;
    }
    rows.innerHTML = latestEntries
      .map((entry) => {
        const firstPlace =
          typeof entry.first_place_votes === "number" && entry.first_place_votes > 0
            ? String(entry.first_place_votes)
            : "—";
        const record = entry.record && typeof entry.record === "string" && entry.record.trim() ? entry.record : "—";
        const points = formatNumber(entry.points);
        return `<tr><td>${entry.rank ?? "—"}</td><td>${toTeamName(entry)}</td><td>${record}</td><td>${points}</td><td>${firstPlace}</td></tr>`;
      })
      .join("");
  }
} catch (error) {
  console.error(error);
  rows.innerHTML = `<tr><td colspan="5">We couldn't load the final 2024 rankings. Please try again later.</td></tr>`;
}
