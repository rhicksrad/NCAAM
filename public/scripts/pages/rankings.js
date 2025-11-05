import { NCAAM } from "../lib/sdk/ncaam.js";
import { getTeamLogoUrl, getTeamMonogram } from "../lib/ui/logos.js";
const app = document.getElementById("app");
app.innerHTML = `
  <h1 id="ranking-title">Final 2024 Rankings</h1>
  <p id="ranking-note" class="card">The final AP Top 25 and Coaches Poll for the 2024 season will appear here once the ballots are released.</p>
  <div class="rankings-polls">
    <section class="rankings-poll">
      <h2 id="ap-heading">AP Top 25</h2>
      <div class="table-shell">
        <table aria-describedby="ap-heading">
          <thead>
            <tr><th>#</th><th>Team</th><th>Record</th><th>Points</th><th>1st</th></tr>
          </thead>
          <tbody id="ap-rows"><tr><td colspan="5">Loading final AP Top 25…</td></tr></tbody>
        </table>
      </div>
    </section>
    <section class="rankings-poll">
      <h2 id="coaches-heading">Coaches Poll</h2>
      <div class="table-shell">
        <table aria-describedby="coaches-heading">
          <thead>
            <tr><th>#</th><th>Team</th><th>Record</th><th>Points</th><th>1st</th></tr>
          </thead>
          <tbody id="coaches-rows"><tr><td colspan="5">Loading final Coaches Poll…</td></tr></tbody>
        </table>
      </div>
    </section>
  </div>
`;
const apRows = document.getElementById("ap-rows");
const coachesRows = document.getElementById("coaches-rows");
const title = document.getElementById("ranking-title");
const note = document.getElementById("ranking-note");
const apHeading = document.getElementById("ap-heading");
const coachesHeading = document.getElementById("coaches-heading");
function formatNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return "—";
    }
    try {
        return value.toLocaleString();
    }
    catch {
        return String(value);
    }
}
function toTeamName(entry) {
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
    const apResults = extractLatestPoll(entries, "ap");
    const coachesResults = extractLatestPoll(entries, ["coaches", "coach"]);
    renderPoll(apRows, apHeading, apResults, "AP Top 25");
    renderPoll(coachesRows, coachesHeading, coachesResults, "Coaches Poll");
    const summary = [];
    if (Number.isFinite(apResults.week)) {
        summary.push(`AP Top 25 (Week ${apResults.week})`);
    }
    if (Number.isFinite(coachesResults.week)) {
        summary.push(`Coaches Poll (Week ${coachesResults.week})`);
    }
    if (title && summary.length > 0) {
        title.textContent = `Final 2024 Rankings`;
    }
    if (note) {
        if (summary.length > 0) {
            note.textContent = `Final polls for the 2024 season: ${summary.join(" and ")}. New rankings will be published here as they are released.`;
        }
        else {
            note.textContent = `The final AP Top 25 and Coaches Poll for the 2024 season will appear here once the ballots are released.`;
        }
    }
}
catch (error) {
    console.error(error);
    apRows.innerHTML = `<tr><td colspan="5">We couldn't load the final AP Top 25. Please try again later.</td></tr>`;
    coachesRows.innerHTML = `<tr><td colspan="5">We couldn't load the final Coaches Poll. Please try again later.</td></tr>`;
}
function extractLatestPoll(entries, pollKey) {
    const candidateKeys = Array.isArray(pollKey) ? pollKey : [pollKey];
    const normalizedKeys = new Set(candidateKeys
        .map((key) => (typeof key === "string" ? key.trim().toLowerCase() : ""))
        .filter((key) => key.length > 0));
    for (const key of Array.from(normalizedKeys)) {
        if (key === "coaches" || key === "coach") {
            normalizedKeys.add("coach");
            normalizedKeys.add("coaches");
            normalizedKeys.add("coaches poll");
            normalizedKeys.add("usa today coaches");
        }
    }
    if (normalizedKeys.size === 0) {
        return { week: Number.NEGATIVE_INFINITY, entries: [] };
    }
    const pollEntries = entries.filter((entry) => !!entry &&
        typeof entry === "object" &&
        typeof entry.poll === "string" &&
        normalizedKeys.has(entry.poll.trim().toLowerCase()));
    const latestWeek = pollEntries.reduce((max, entry) => {
        const week = typeof entry.week === "number" ? entry.week : Number.NEGATIVE_INFINITY;
        return week > max ? week : max;
    }, Number.NEGATIVE_INFINITY);
    if (!Number.isFinite(latestWeek)) {
        return { week: Number.NEGATIVE_INFINITY, entries: [] };
    }
    const latestEntries = pollEntries
        .filter((entry) => entry.week === latestWeek)
        .slice()
        .sort((a, b) => (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY));
    return { week: latestWeek, entries: latestEntries };
}
function renderPoll(rowsEl, headingEl, pollData, label) {
    if (!Number.isFinite(pollData.week) || pollData.entries.length === 0) {
        rowsEl.innerHTML = `<tr><td colspan="5">No ${label} rankings are available for the conclusion of the 2024 season yet.</td></tr>`;
        if (headingEl) {
            headingEl.textContent = label;
        }
        return;
    }
    if (headingEl) {
        headingEl.textContent = `${label} — Week ${pollData.week}`;
    }
    rowsEl.innerHTML = pollData.entries
        .map((entry) => {
        const firstPlace = typeof entry.first_place_votes === "number" && entry.first_place_votes > 0
            ? String(entry.first_place_votes)
            : "—";
        const record = entry.record && typeof entry.record === "string" && entry.record.trim() ? entry.record : "—";
        const recordCell = escapeHtml(record);
        const points = formatNumber(entry.points);
        const pointsCell = escapeHtml(points);
        const teamCell = renderTeamCell(entry.team, toTeamName(entry));
        const rankCell = escapeHtml(String(entry.rank ?? "—"));
        const firstPlaceCell = escapeHtml(firstPlace);
        return `<tr><td>${rankCell}</td><td>${teamCell}</td><td>${recordCell}</td><td>${pointsCell}</td><td>${firstPlaceCell}</td></tr>`;
    })
        .join("");
}
function renderTeamCell(team, fallbackLabel) {
    const normalizedTeam = team && typeof team === "object" ? normalizeTeam(team) : null;
    const displayLabel = normalizedTeam?.full_name || normalizedTeam?.name || fallbackLabel;
    const teamName = escapeHtml(displayLabel);
    if (!normalizedTeam) {
        return `<span class="rankings-team"><span class="rankings-team__name">${teamName}</span></span>`;
    }
    const altLabel = normalizedTeam.full_name && normalizedTeam.full_name !== "—" ? normalizedTeam.full_name : displayLabel || "Team";
    const alt = escapeHtml(`${altLabel} logo`);
    const logoUrl = getTeamLogoUrl(normalizedTeam);
    if (logoUrl) {
        return `
      <span class="rankings-team">
        <span class="rankings-team__logo">
          <img class="rankings-team__logo-image" src="${logoUrl}" alt="${alt}" loading="lazy" decoding="async">
        </span>
        <span class="rankings-team__name">${teamName}</span>
      </span>
    `.trim();
    }
    const monogram = escapeHtml(getTeamMonogram(normalizedTeam));
    return `
    <span class="rankings-team">
      <span class="rankings-team__logo rankings-team__logo--fallback" role="img" aria-label="${alt}">${monogram}</span>
      <span class="rankings-team__name">${teamName}</span>
    </span>
  `.trim();
}
function normalizeTeam(team) {
    const id = typeof team.id === "number" && Number.isFinite(team.id) ? team.id : null;
    const fullName = typeof team.full_name === "string" && team.full_name.trim() ? team.full_name.trim() : null;
    const name = typeof team.name === "string" && team.name.trim() ? team.name.trim() : null;
    if (id === null && !fullName && !name) {
        return null;
    }
    return {
        id: id ?? hashTeamLabel(fullName ?? name ?? "Team"),
        full_name: fullName ?? name ?? "—",
        name: name ?? fullName ?? "—",
        abbreviation: typeof team.abbreviation === "string" ? team.abbreviation : undefined,
        conference: typeof team.conference === "string" ? team.conference : undefined,
        conference_id: typeof team.conference_id === "number" ? team.conference_id : undefined,
        college: typeof team.college === "string" && team.college.trim() ? team.college.trim() : fullName ?? name ?? undefined,
    };
}
function hashTeamLabel(label) {
    let hash = 0;
    for (let i = 0; i < label.length; i += 1) {
        hash = (hash * 31 + label.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) + 1;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
