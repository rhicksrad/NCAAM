import { NCAAM } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import { getConferenceLogoUrl, getConferenceMonogram, getTeamLogoUrl, getTeamMonogram, } from "../lib/ui/logos.js";
const app = document.getElementById("app");
if (!app) {
    throw new Error("Standings root element not found");
}
app.innerHTML = `
  <section class="stack" data-gap="lg">
    <section class="card stack" data-gap="md">
      <header class="stack" data-gap="xs">
        <h2 class="section-title">Real-time conference standings</h2>
        <p class="section-summary">
          Pick a conference and season to view the latest win-loss splits directly from the Ball Don't Lie NCAAB feed.
        </p>
      </header>
      <form id="standings-form" class="standings-controls" autocomplete="off">
        <div class="standings-controls__inputs">
          <label class="standings-controls__field">
            <span class="standings-controls__label">Conference</span>
            <select id="standings-conference" name="conference" required>
              <option value="" disabled selected>Loading conferences…</option>
            </select>
          </label>
          <label class="standings-controls__field">
            <span class="standings-controls__label">Season</span>
            <input
              id="standings-season"
              name="season"
              type="number"
              inputmode="numeric"
              min="2002"
              max="2100"
              step="1"
              required
            />
          </label>
        </div>
        <div class="standings-controls__actions">
          <button type="submit" class="button" data-variant="primary">Get standings</button>
        </div>
      </form>
      <p id="standings-status" class="standings-status" role="status" aria-live="polite">
        Choose a conference and season to load live standings.
      </p>
    </section>
    <section id="standings-results" class="card standings-results" hidden>
      <header class="standings-results__header">
        <div id="standings-identity"></div>
        <div id="standings-meta" class="standings-results__meta"></div>
      </header>
      <div class="table-shell">
        <table class="standings-table">
          <thead>
            <tr>
              <th scope="col">Seed</th>
              <th scope="col">Team</th>
              <th scope="col">W</th>
              <th scope="col">L</th>
              <th scope="col">Pct</th>
              <th scope="col">GB</th>
              <th scope="col">Conf</th>
              <th scope="col">Home</th>
              <th scope="col">Away</th>
            </tr>
          </thead>
          <tbody id="standings-rows">
            <tr><td colspan="9">Standings will appear here.</td></tr>
          </tbody>
        </table>
      </div>
      <p class="standings-note">Records refresh as the Ball Don't Lie NCAAB API publishes new results.</p>
    </section>
  </section>
`;
const form = document.getElementById("standings-form");
const conferenceSelect = document.getElementById("standings-conference");
const seasonInput = document.getElementById("standings-season");
const statusEl = document.getElementById("standings-status");
const resultsSection = document.getElementById("standings-results");
const identityEl = document.getElementById("standings-identity");
const metaEl = document.getElementById("standings-meta");
const rowsEl = document.getElementById("standings-rows");
if (!form || !conferenceSelect || !seasonInput || !statusEl || !resultsSection || !identityEl || !metaEl || !rowsEl) {
    throw new Error("Standings view failed to initialize");
}
const formEl = form;
const conferenceSelectEl = conferenceSelect;
const seasonInputEl = seasonInput;
const statusElement = statusEl;
const resultsSectionEl = resultsSection;
const identityElement = identityEl;
const metaElement = metaEl;
const rowsElement = rowsEl;
const submitButton = formEl.querySelector('button[type="submit"]');
let directory = null;
let isLoading = false;
const params = (() => {
    try {
        return new URLSearchParams(location.search);
    }
    catch {
        return new URLSearchParams();
    }
})();
const now = new Date();
const fallbackSeason = now.getFullYear();
function parseSeasonFromParams() {
    const raw = params.get("season");
    if (!raw)
        return fallbackSeason;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed)) {
        return fallbackSeason;
    }
    return Math.min(Math.max(parsed, 2002), 2100);
}
function parseConferenceIdFromParams() {
    const raw = params.get("conference_id") ?? params.get("conference");
    if (!raw)
        return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
}
const initialSeason = parseSeasonFromParams();
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function escapeAttr(value) {
    return escapeHtml(value);
}
function toNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function formatSeed(value, index) {
    const numeric = toNumber(value);
    const seed = numeric !== null ? Math.trunc(numeric) : index + 1;
    return escapeHtml(String(seed));
}
function formatInteger(value) {
    const numeric = toNumber(value);
    return numeric !== null ? escapeHtml(String(Math.trunc(numeric))) : "—";
}
function formatPercentage(value) {
    const numeric = toNumber(value);
    if (numeric === null) {
        return "—";
    }
    const formatted = numeric.toFixed(3);
    return escapeHtml(formatted);
}
function formatGamesBehind(value) {
    const numeric = toNumber(value);
    if (numeric === null) {
        return "—";
    }
    if (Math.abs(numeric) < 0.0005) {
        return "—";
    }
    const rounded = Math.round(numeric * 10) / 10;
    const formatted = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, "");
    return escapeHtml(formatted);
}
function formatRecordString(value) {
    if (!value) {
        return "—";
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return "—";
    }
    return escapeHtml(trimmed);
}
function renderTeamCell(team) {
    const displayName = team.full_name || team.name || "Team";
    const safeName = escapeHtml(displayName);
    const alt = escapeAttr(`${displayName} logo`);
    const logoUrl = getTeamLogoUrl(team);
    if (logoUrl) {
        const src = escapeAttr(logoUrl);
        return `<span class="standings-team"><span class="standings-team__logo"><img class="standings-team__logo-image" src="${src}" alt="${alt}" loading="lazy" decoding="async"></span><span class="standings-team__name">${safeName}</span></span>`;
    }
    const monogram = escapeHtml(getTeamMonogram(team));
    return `<span class="standings-team"><span class="standings-team__logo"><span class="standings-team__logo-fallback" role="img" aria-label="${alt}">${monogram}</span></span><span class="standings-team__name">${safeName}</span></span>`;
}
function compareStandings(a, b) {
    const seedA = toNumber(a.playoff_seed);
    const seedB = toNumber(b.playoff_seed);
    if (seedA !== null || seedB !== null) {
        if (seedA === null)
            return 1;
        if (seedB === null)
            return -1;
        if (seedA !== seedB)
            return seedA - seedB;
    }
    const pctA = toNumber(a.win_percentage);
    const pctB = toNumber(b.win_percentage);
    if (pctA !== null || pctB !== null) {
        if (pctA === null)
            return 1;
        if (pctB === null)
            return -1;
        if (pctA !== pctB)
            return pctB - pctA;
    }
    const winsA = toNumber(a.wins);
    const winsB = toNumber(b.wins);
    if (winsA !== null || winsB !== null) {
        if (winsA === null)
            return 1;
        if (winsB === null)
            return -1;
        if (winsA !== winsB)
            return winsB - winsA;
    }
    const nameA = (a.team.full_name || a.team.name || "").toLowerCase();
    const nameB = (b.team.full_name || b.team.name || "").toLowerCase();
    return nameA.localeCompare(nameB);
}
function renderConferenceIdentity(conferenceId, records) {
    const aliasSet = new Set();
    let name = "Conference";
    let shortName = null;
    if (directory?.has(conferenceId)) {
        const entry = directory.get(conferenceId);
        name = entry.name;
        shortName = entry.short_name ?? null;
        aliasSet.add(entry.name);
        if (entry.short_name) {
            aliasSet.add(entry.short_name);
        }
    }
    for (const standing of records) {
        if (standing.conference?.name) {
            aliasSet.add(standing.conference.name);
            if (!name || name === "Conference") {
                name = standing.conference.name;
            }
        }
        if (standing.conference?.short_name) {
            aliasSet.add(standing.conference.short_name);
            if (!shortName) {
                shortName = standing.conference.short_name;
            }
        }
        if (standing.team?.conference) {
            aliasSet.add(standing.team.conference);
        }
    }
    if (!aliasSet.size && records.length > 0) {
        const fallback = records[0].team?.conference;
        if (fallback) {
            aliasSet.add(fallback);
            name = fallback;
        }
    }
    aliasSet.add(name);
    if (shortName) {
        aliasSet.add(shortName);
    }
    const aliases = Array.from(aliasSet).filter(Boolean);
    const logoUrl = getConferenceLogoUrl(name, { shortName, aliases });
    const alt = escapeAttr(`${name} logo`);
    const monogram = escapeHtml(getConferenceMonogram(name));
    const safeName = escapeHtml(name);
    const safeShort = shortName && shortName !== name ? escapeHtml(shortName) : null;
    const logoMarkup = logoUrl
        ? `<img class="conference-identity__logo-image" src="${escapeAttr(logoUrl)}" alt="${alt}" loading="lazy" decoding="async">`
        : `<span class="conference-identity__logo-fallback" role="img" aria-label="${alt}">${monogram}</span>`;
    const markup = `
    <span class="conference-identity">
      <span class="conference-identity__logo">${logoMarkup}</span>
      <span class="conference-identity__text">
        <span class="conference-identity__name">${safeName}</span>
        ${safeShort ? `<span class="conference-identity__subtext">${safeShort}</span>` : ""}
      </span>
    </span>
  `;
    return { markup, name, shortName };
}
function renderStandings(records, conferenceId, season) {
    if (records.length === 0) {
        resultsSectionEl.hidden = true;
        return;
    }
    const sorted = records.slice().sort(compareStandings);
    rowsElement.innerHTML = sorted
        .map((record, index) => {
        const seed = formatSeed(record.playoff_seed, index);
        const teamCell = renderTeamCell(record.team);
        const wins = formatInteger(record.wins);
        const losses = formatInteger(record.losses);
        const pct = formatPercentage(record.win_percentage);
        const gb = formatGamesBehind(record.games_behind);
        const confRecord = formatRecordString(record.conference_record);
        const homeRecord = formatRecordString(record.home_record);
        const awayRecord = formatRecordString(record.away_record);
        return `<tr>
        <td>${seed}</td>
        <th scope="row">${teamCell}</th>
        <td>${wins}</td>
        <td>${losses}</td>
        <td>${pct}</td>
        <td>${gb}</td>
        <td>${confRecord}</td>
        <td>${homeRecord}</td>
        <td>${awayRecord}</td>
      </tr>`;
    })
        .join("");
    const identity = renderConferenceIdentity(conferenceId, sorted);
    identityElement.innerHTML = identity.markup;
    const teamCountLabel = `${sorted.length} team${sorted.length === 1 ? "" : "s"}`;
    metaElement.textContent = `Season ${season} • ${teamCountLabel}`;
    resultsSectionEl.hidden = false;
}
function setStatus(message, variant = "default") {
    statusElement.textContent = message;
    if (variant === "error") {
        statusElement.dataset.variant = "error";
    }
    else if (variant === "loading") {
        statusElement.dataset.variant = "loading";
    }
    else {
        delete statusElement.dataset.variant;
    }
}
function setLoading(loading) {
    isLoading = loading;
    conferenceSelectEl.disabled = loading;
    seasonInputEl.disabled = loading;
    if (submitButton) {
        submitButton.disabled = loading;
    }
}
function updateSearchParams(conferenceId, season) {
    if (typeof history === "undefined" || typeof history.replaceState !== "function") {
        return;
    }
    try {
        const search = new URLSearchParams(location.search);
        search.set("conference_id", String(conferenceId));
        search.set("season", String(season));
        const query = search.toString();
        const nextUrl = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
        history.replaceState(null, "", nextUrl);
    }
    catch {
        // ignore URL update failures
    }
}
async function loadStandings(conferenceId, season) {
    if (isLoading) {
        return;
    }
    setLoading(true);
    setStatus("Loading standings…", "loading");
    resultsSectionEl.hidden = true;
    try {
        const response = await NCAAM.standings({ conference_id: conferenceId, season });
        const data = Array.isArray(response?.data) ? response.data : [];
        if (data.length === 0) {
            setStatus(`No standings are available for ${season}.`, "default");
            resultsSectionEl.hidden = true;
            return;
        }
        renderStandings(data, conferenceId, season);
        setStatus(`Showing ${data.length} teams for season ${season}.`, "success");
        updateSearchParams(conferenceId, season);
    }
    catch (error) {
        console.error("Unable to load standings", error);
        setStatus("We couldn't load the standings right now. Please try again shortly.", "error");
        resultsSectionEl.hidden = true;
    }
    finally {
        setLoading(false);
    }
}
async function populateConferences() {
    try {
        directory = await getConferenceMap();
    }
    catch (error) {
        console.error("Unable to load conference directory", error);
        setStatus("We couldn't load the conference list. Please refresh and try again.", "error");
        conferenceSelectEl.innerHTML = '<option value="" disabled selected>Unavailable</option>';
        return;
    }
    const entries = Array.from(directory.values()).sort((a, b) => a.name.localeCompare(b.name));
    if (entries.length === 0) {
        conferenceSelectEl.innerHTML = '<option value="" disabled selected>No conferences found</option>';
        setStatus("No conferences are available yet.");
        return;
    }
    conferenceSelectEl.innerHTML = entries
        .map(conference => `<option value="${conference.id}">${escapeHtml(conference.name)}</option>`)
        .join("");
    const fromParams = parseConferenceIdFromParams();
    const defaultConferenceId = fromParams && directory.has(fromParams)
        ? fromParams
        : entries[0].id;
    conferenceSelectEl.value = String(defaultConferenceId);
    if (!seasonInputEl.value) {
        seasonInputEl.value = String(initialSeason);
    }
    await loadStandings(defaultConferenceId, Number.parseInt(seasonInputEl.value, 10));
}
formEl.addEventListener("submit", event => {
    event.preventDefault();
    const conferenceId = Number.parseInt(conferenceSelectEl.value, 10);
    const season = Number.parseInt(seasonInputEl.value, 10);
    if (!Number.isFinite(conferenceId) || !Number.isFinite(season)) {
        setStatus("Please choose a valid conference and season.", "error");
        return;
    }
    void loadStandings(conferenceId, season);
});
seasonInputEl.value = String(initialSeason);
void populateConferences();
