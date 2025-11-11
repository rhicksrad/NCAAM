import { NCAAM } from "../lib/sdk/ncaam.js";
import { getTeamLogoUrl, getTeamMonogram } from "../lib/ui/logos.js";
import { requireOk } from "../lib/health.js";
const app = document.getElementById("app");
app.innerHTML = `
  <h1 id="ranking-title">Season Rankings</h1>
  <form id="ranking-controls" class="rankings-controls" autocomplete="off" aria-label="Ranking filters">
    <label class="rankings-controls__field">
      <span class="rankings-controls__label">Season</span>
      <select id="ranking-season" name="season"></select>
    </label>
    <label class="rankings-controls__field">
      <span class="rankings-controls__label">Week</span>
      <select id="ranking-week" name="week" disabled>
        <option value="latest">Latest available</option>
      </select>
    </label>
    <div class="rankings-controls__actions">
      <button id="ranking-update" class="button" data-variant="primary" type="submit">Update Rankings</button>
    </div>
  </form>
  <p id="ranking-note" class="card">Select a season and week, then choose “Update Rankings” to view the polls.</p>
  <div class="rankings-polls">
    <section class="rankings-poll">
      <h2 id="ap-heading">AP Top 25</h2>
      <div class="table-shell">
        <table aria-describedby="ap-heading">
          <thead>
            <tr><th>#</th><th>Team</th><th>Record</th><th>Points</th><th>1st</th></tr>
          </thead>
          <tbody id="ap-rows"><tr><td colspan="5">Loading AP Top 25…</td></tr></tbody>
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
          <tbody id="coaches-rows"><tr><td colspan="5">Loading Coaches Poll…</td></tr></tbody>
        </table>
      </div>
    </section>
  </div>
`;
await requireOk("data/division-one-programs.json", "Rankings");
const apRows = document.getElementById("ap-rows");
const coachesRows = document.getElementById("coaches-rows");
const title = document.getElementById("ranking-title");
const note = document.getElementById("ranking-note");
const apHeading = document.getElementById("ap-heading");
const coachesHeading = document.getElementById("coaches-heading");
const controls = document.getElementById("ranking-controls");
const seasonSelect = document.getElementById("ranking-season");
const weekSelect = document.getElementById("ranking-week");
const updateButton = document.getElementById("ranking-update");
const DEFAULT_SEASON = 2025;
const DEFAULT_WEEK = "latest";
const EARLIEST_SEASON = 2013;
const updateButtonLabel = updateButton?.textContent ?? "Update Rankings";
const rankingCache = new Map();
const weekCache = new Map();
let pendingSeason = DEFAULT_SEASON;
let pendingWeek = DEFAULT_WEEK;
let renderRequestId = 0;
let weekOptionsRequestId = 0;
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
populateSeasonOptions();
if (seasonSelect) {
    seasonSelect.addEventListener("change", () => {
        const selectedSeason = parseSeasonValue(seasonSelect.value);
        if (selectedSeason !== null) {
            pendingSeason = selectedSeason;
        }
        populateSeasonOptions();
        void refreshWeekOptionsForPendingSeason();
    });
}
if (weekSelect) {
    weekSelect.addEventListener("change", () => {
        pendingWeek = parseWeekSelection(weekSelect.value);
    });
}
if (controls) {
    controls.addEventListener("submit", (event) => {
        event.preventDefault();
        pendingSeason = parseSeasonValue(seasonSelect?.value ?? "") ?? pendingSeason;
        pendingWeek = parseWeekSelection(weekSelect?.value ?? "");
        void applySelections();
    });
}
setLoadingState(true);
await refreshWeekOptionsForPendingSeason();
await applySelections();
function setLoadingState(isLoading) {
    if (!updateButton) {
        return;
    }
    updateButton.disabled = isLoading;
    if (isLoading) {
        updateButton.textContent = "Loading…";
        updateButton.setAttribute("aria-busy", "true");
    }
    else {
        updateButton.textContent = updateButtonLabel;
        updateButton.removeAttribute("aria-busy");
    }
}
function populateSeasonOptions() {
    if (!seasonSelect) {
        return;
    }
    const seasons = getKnownSeasons([pendingSeason]);
    seasonSelect.innerHTML = seasons.map((season) => `<option value="${season}">${season}</option>`).join("");
    const desired = seasons.includes(pendingSeason) ? pendingSeason : seasons[0];
    if (desired !== undefined) {
        seasonSelect.value = String(desired);
        pendingSeason = desired;
    }
}
function getKnownSeasons(extra = []) {
    const currentYear = new Date().getFullYear();
    const latestSeason = Math.max(DEFAULT_SEASON, currentYear);
    const seasons = new Set();
    for (let year = latestSeason; year >= EARLIEST_SEASON; year -= 1) {
        seasons.add(year);
    }
    seasons.add(DEFAULT_SEASON);
    for (const cachedSeason of weekCache.keys()) {
        seasons.add(cachedSeason);
    }
    for (const season of extra) {
        if (Number.isFinite(season)) {
            seasons.add(Math.trunc(season));
        }
    }
    return Array.from(seasons).sort((a, b) => b - a);
}
function parseSeasonValue(value) {
    if (!value) {
        return null;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return parsed;
}
function parseWeekSelection(value) {
    if (value === "latest" || value === "") {
        return "latest";
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return "latest";
    }
    return parsed;
}
async function refreshWeekOptionsForPendingSeason() {
    if (!weekSelect) {
        return;
    }
    const season = pendingSeason;
    const requestId = ++weekOptionsRequestId;
    weekSelect.disabled = true;
    try {
        const weeks = await ensureWeeks(season);
        if (requestId !== weekOptionsRequestId) {
            return;
        }
        renderWeekOptions(weekSelect, weeks, pendingWeek);
        pendingWeek = parseWeekSelection(weekSelect.value);
    }
    catch (error) {
        console.error(error);
        if (requestId !== weekOptionsRequestId) {
            return;
        }
        renderWeekOptions(weekSelect, [], "latest");
        pendingWeek = "latest";
    }
    finally {
        if (requestId === weekOptionsRequestId) {
            weekSelect.disabled = weekSelect.options.length <= 1;
        }
    }
}
function renderWeekOptions(selectEl, weeks, selection) {
    const uniqueWeeks = Array.from(new Set(weeks)).filter((week) => Number.isFinite(week));
    uniqueWeeks.sort((a, b) => b - a);
    const options = ["<option value=\"latest\">Latest available</option>"];
    for (const week of uniqueWeeks) {
        options.push(`<option value="${week}">Week ${week}</option>`);
    }
    selectEl.innerHTML = options.join("");
    if (selection !== "latest" && uniqueWeeks.includes(selection)) {
        selectEl.value = String(selection);
    }
    else {
        selectEl.value = "latest";
    }
}
function updateWeekCacheFromResolved(season, resolvedWeek) {
    if (!Number.isFinite(resolvedWeek ?? NaN)) {
        return;
    }
    const normalizedSeason = Number.isFinite(season) ? Math.trunc(season) : DEFAULT_SEASON;
    const highestResolvedWeek = Math.max(0, Math.trunc(resolvedWeek));
    if (highestResolvedWeek <= 0) {
        return;
    }
    const existingWeeks = weekCache.get(normalizedSeason) ?? [];
    if (existingWeeks.length >= highestResolvedWeek) {
        return;
    }
    const weeks = Array.from({ length: highestResolvedWeek }, (_, index) => index + 1);
    weekCache.set(normalizedSeason, weeks);
    populateSeasonOptions();
}
async function ensureWeeks(season) {
    const normalizedSeason = Number.isFinite(season) ? Math.trunc(season) : DEFAULT_SEASON;
    if (weekCache.has(normalizedSeason)) {
        return weekCache.get(normalizedSeason);
    }
    const { resolvedWeek } = await fetchRankings(normalizedSeason, "latest");
    if (!weekCache.has(normalizedSeason)) {
        const weeks = typeof resolvedWeek === "number" && Number.isFinite(resolvedWeek)
            ? Array.from({ length: resolvedWeek }, (_, index) => index + 1)
            : [];
        weekCache.set(normalizedSeason, weeks);
        populateSeasonOptions();
    }
    return weekCache.get(normalizedSeason) ?? [];
}
async function fetchRankings(season, selection, poll) {
    const normalizedSeason = Number.isFinite(season) ? Math.trunc(season) : DEFAULT_SEASON;
    const normalizedPoll = typeof poll === "string" && poll.trim() ? poll.trim().toLowerCase() : "";
    const cacheKey = normalizedPoll ? `${normalizedSeason}:${normalizedPoll}:${selection}` : `${normalizedSeason}:${selection}`;
    if (rankingCache.has(cacheKey)) {
        return rankingCache.get(cacheKey);
    }
    const params = { season: normalizedSeason };
    if (selection !== "latest") {
        params.week = selection;
    }
    if (normalizedPoll) {
        params.poll = normalizedPoll;
    }
    const response = await NCAAM.rankings(params);
    const entries = Array.isArray(response?.data) ? response.data : [];
    const resolvedWeek = resolveWeekFromEntries(entries, selection, normalizedSeason);
    const cached = { entries, resolvedWeek };
    rankingCache.set(cacheKey, cached);
    if (!normalizedPoll && selection === "latest" && typeof resolvedWeek === "number" && Number.isFinite(resolvedWeek)) {
        rankingCache.set(`${normalizedSeason}:${resolvedWeek}`, cached);
    }
    updateWeekCacheFromResolved(normalizedSeason, resolvedWeek);
    return cached;
}
function resolveWeekFromEntries(entries, selection, season) {
    let resolved = null;
    for (const entry of entries) {
        if (!entry || typeof entry !== "object") {
            continue;
        }
        const entrySeason = typeof entry.season === "number" && Number.isFinite(entry.season) ? Math.trunc(entry.season) : null;
        if (season !== null && entrySeason !== null && entrySeason !== season) {
            continue;
        }
        const week = typeof entry.week === "number" && Number.isFinite(entry.week) ? entry.week : null;
        if (week !== null && (resolved === null || week > resolved)) {
            resolved = week;
        }
    }
    if (resolved !== null) {
        return resolved;
    }
    if (typeof selection === "number" && Number.isFinite(selection)) {
        return selection;
    }
    return null;
}
function extractPollEntries(entries, pollKey, week, season) {
    if (!Number.isFinite(week)) {
        return [];
    }
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
            normalizedKeys.add("usa today coaches poll");
        }
        if (key === "ap" || key === "associated press") {
            normalizedKeys.add("ap");
            normalizedKeys.add("associated press");
            normalizedKeys.add("ap poll");
            normalizedKeys.add("ap top 25");
            normalizedKeys.add("associated press top 25");
        }
    }
    if (normalizedKeys.size === 0) {
        return [];
    }
    return entries
        .filter((entry) => {
        if (!entry || typeof entry !== "object") {
            return false;
        }
        const poll = entry.poll;
        if (typeof poll !== "string") {
            return false;
        }
        if (!normalizedKeys.has(poll.trim().toLowerCase())) {
            return false;
        }
        if (entry.week !== week) {
            return false;
        }
        if (season === null) {
            return true;
        }
        const entrySeason = typeof entry.season === "number" &&
            Number.isFinite(entry.season)
            ? Math.trunc(entry.season)
            : null;
        if (entrySeason === null) {
            return true;
        }
        return entrySeason === season;
    })
        .slice()
        .sort((a, b) => (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY));
}
async function fetchPollEntries(season, selection, base, pollKey, requestedPoll) {
    const baseWeek = base.resolvedWeek;
    let entries = extractPollEntries(base.entries, pollKey, baseWeek, season);
    let resolvedWeek = baseWeek;
    const normalizedRequestedPoll = typeof requestedPoll === "string" && requestedPoll.trim()
        ? requestedPoll.trim().toLowerCase()
        : "";
    if (entries.length > 0 || !normalizedRequestedPoll) {
        return { entries, resolvedWeek };
    }
    const pollResponse = await fetchRankings(season, selection, normalizedRequestedPoll);
    const pollWeek = pollResponse.resolvedWeek;
    const effectiveWeek = pollWeek
        ?? resolvedWeek
        ?? (typeof selection === "number" && Number.isFinite(selection) ? selection : null);
    if (effectiveWeek !== null) {
        entries = extractPollEntries(pollResponse.entries, pollKey, effectiveWeek, season);
    }
    else {
        entries = extractPollEntries(pollResponse.entries, pollKey, pollWeek, season);
    }
    if (pollWeek !== null && pollWeek !== resolvedWeek) {
        resolvedWeek = pollWeek;
    }
    else if (resolvedWeek === null) {
        resolvedWeek = effectiveWeek;
    }
    return { entries, resolvedWeek };
}
async function applySelections() {
    const requestId = ++renderRequestId;
    setLoadingState(true);
    try {
        const season = pendingSeason;
        const weeks = await ensureWeeks(season);
        if (weekSelect) {
            renderWeekOptions(weekSelect, weeks, pendingWeek);
            pendingWeek = parseWeekSelection(weekSelect.value);
        }
        const baseResult = await fetchRankings(season, pendingWeek);
        if (requestId !== renderRequestId) {
            return;
        }
        const apResult = await fetchPollEntries(season, pendingWeek, baseResult, "ap", "ap");
        if (requestId !== renderRequestId) {
            return;
        }
        const coachesResult = await fetchPollEntries(season, pendingWeek, baseResult, ["coaches", "coach"], "coach");
        if (requestId !== renderRequestId) {
            return;
        }
        const candidateWeeks = [];
        for (const maybeWeek of [
            baseResult.resolvedWeek,
            apResult.resolvedWeek,
            coachesResult.resolvedWeek,
            typeof pendingWeek === "number" && Number.isFinite(pendingWeek) ? pendingWeek : null,
        ]) {
            if (typeof maybeWeek === "number" && Number.isFinite(maybeWeek)) {
                candidateWeeks.push(Math.trunc(maybeWeek));
            }
        }
        const resolvedWeek = candidateWeeks.length > 0 ? Math.max(...candidateWeeks) : baseResult.resolvedWeek;
        if (weekSelect) {
            const updatedWeeks = weekCache.get(season) ?? weeks;
            if (updatedWeeks.length !== weeks.length) {
                renderWeekOptions(weekSelect, updatedWeeks, pendingWeek);
                pendingWeek = parseWeekSelection(weekSelect.value);
            }
        }
        renderPoll(apRows, apHeading, apResult.entries, "AP Top 25", season, resolvedWeek);
        renderPoll(coachesRows, coachesHeading, coachesResult.entries, "Coaches Poll", season, resolvedWeek);
        updateSummary(season, resolvedWeek, [
            { label: "AP Top 25", hasData: apResult.entries.length > 0 },
            { label: "Coaches Poll", hasData: coachesResult.entries.length > 0 },
        ]);
    }
    catch (error) {
        console.error(error);
        const message = "We couldn't load the rankings right now. Please try again later.";
        const sanitized = escapeHtml(message);
        apRows.innerHTML = `<tr><td colspan="5">${sanitized}</td></tr>`;
        coachesRows.innerHTML = `<tr><td colspan="5">${sanitized}</td></tr>`;
        if (note) {
            note.textContent = "We ran into a problem loading the rankings. Please try again.";
        }
    }
    finally {
        if (requestId === renderRequestId) {
            setLoadingState(false);
        }
    }
}
function updateSummary(season, week, pollSummaries) {
    if (title) {
        title.textContent = `Season ${season} Rankings`;
    }
    if (!note) {
        return;
    }
    if (!Number.isFinite(week ?? NaN)) {
        note.textContent = `We couldn't find any published rankings for the ${season} season yet. Try another season.`;
        return;
    }
    const availableLabels = pollSummaries.filter((poll) => poll.hasData).map((poll) => poll.label);
    if (availableLabels.length > 0) {
        const summary = availableLabels.join(" and ");
        note.textContent = `${summary} rankings for week ${week} of the ${season} season. Use the controls above to view a different week.`;
    }
    else {
        note.textContent = `No rankings were published for week ${week} of the ${season} season. Try selecting another week.`;
    }
}
function renderPoll(rowsEl, headingEl, entries, label, season, week) {
    if (headingEl) {
        headingEl.textContent = Number.isFinite(week) ? `${label} — Week ${week}` : label;
    }
    if (!Number.isFinite(week) || entries.length === 0) {
        const message = Number.isFinite(week)
            ? `No ${label} rankings are available for week ${week} of the ${season} season yet.`
            : `No ${label} rankings are available for the ${season} season yet.`;
        rowsEl.innerHTML = `<tr><td colspan="5">${escapeHtml(message)}</td></tr>`;
        return;
    }
    rowsEl.innerHTML = entries
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
