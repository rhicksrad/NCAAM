import { NCAAM, type Standing } from "../lib/sdk/ncaam.js";
import { getConferenceMap, type ConferenceMap } from "../lib/sdk/directory.js";
import {
  getConferenceLogoUrl,
  getConferenceMonogram,
  getTeamLogoUrl,
  getTeamMonogram,
} from "../lib/ui/logos.js";

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
          Open a conference card to view its live win-loss splits directly from the Ball Don't Lie NCAAB feed.
        </p>
      </header>
      <form id="standings-form" class="standings-controls" autocomplete="off">
        <div class="standings-controls__inputs">
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
          <button type="submit" class="button" data-variant="primary">Update season</button>
        </div>
      </form>
      <p id="standings-status" class="standings-status" role="status" aria-live="polite">
        Loading conferences…
      </p>
    </section>
    <div id="standings-directory" class="stack" data-gap="md">
      <p class="standings-directory__placeholder">Preparing conference directory…</p>
    </div>
  </section>
`;

const form = document.getElementById("standings-form") as HTMLFormElement | null;
const seasonInput = document.getElementById("standings-season") as HTMLInputElement | null;
const statusEl = document.getElementById("standings-status") as HTMLParagraphElement | null;
const directoryEl = document.getElementById("standings-directory") as HTMLElement | null;

if (!form || !seasonInput || !statusEl || !directoryEl) {
  throw new Error("Standings view failed to initialize");
}

const formEl = form as HTMLFormElement;
const seasonInputEl = seasonInput as HTMLInputElement;
const statusElement = statusEl as HTMLParagraphElement;
const directoryElement = directoryEl as HTMLElement;

let directory: ConferenceMap | null = null;
let currentSeason: number;
let lastOpenedConferenceId: number | null = null;

const standingsCache = new Map<number, { season: number; records: Standing[] }>();

const params = (() => {
  try {
    return new URLSearchParams(location.search);
  } catch {
    return new URLSearchParams();
  }
})();

const now = new Date();
const fallbackSeason = now.getFullYear();

function parseSeasonFromParams(): number {
  const raw = params.get("season");
  if (!raw) return fallbackSeason;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallbackSeason;
  }
  return Math.min(Math.max(parsed, 2002), 2100);
}

function parseConferenceIdFromParams(): number | null {
  const raw = params.get("conference_id") ?? params.get("conference");
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const initialSeason = parseSeasonFromParams();
currentSeason = initialSeason;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatSeed(value: unknown, index: number): string {
  const numeric = toNumber(value);
  const seed = numeric !== null ? Math.trunc(numeric) : index + 1;
  return escapeHtml(String(seed));
}

function formatInteger(value: unknown): string {
  const numeric = toNumber(value);
  return numeric !== null ? escapeHtml(String(Math.trunc(numeric))) : "—";
}

function formatPercentage(value: unknown): string {
  const numeric = toNumber(value);
  if (numeric === null) {
    return "—";
  }
  const formatted = numeric.toFixed(3);
  return escapeHtml(formatted);
}

function formatGamesBehind(value: unknown): string {
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

function formatRecordString(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "—";
  }
  return escapeHtml(trimmed);
}

function compareStandings(a: Standing, b: Standing): number {
  const seedA = toNumber(a.playoff_seed);
  const seedB = toNumber(b.playoff_seed);
  if (seedA !== null || seedB !== null) {
    if (seedA === null) return 1;
    if (seedB === null) return -1;
    if (seedA !== seedB) return seedA - seedB;
  }

  const pctA = toNumber(a.win_percentage);
  const pctB = toNumber(b.win_percentage);
  if (pctA !== null || pctB !== null) {
    if (pctA === null) return 1;
    if (pctB === null) return -1;
    if (pctA !== pctB) return pctB - pctA;
  }

  const winsA = toNumber(a.wins);
  const winsB = toNumber(b.wins);
  if (winsA !== null || winsB !== null) {
    if (winsA === null) return 1;
    if (winsB === null) return -1;
    if (winsA !== winsB) return winsB - winsA;
  }

  const nameA = (a.team.full_name || a.team.name || "").toLowerCase();
  const nameB = (b.team.full_name || b.team.name || "").toLowerCase();
  return nameA.localeCompare(nameB);
}

function createElementFromMarkup(markup: string): HTMLElement {
  const template = document.createElement("template");
  template.innerHTML = markup.trim();
  const element = template.content.firstElementChild;
  if (!element) {
    throw new Error("Failed to create element from markup");
  }
  return element as HTMLElement;
}

function renderConferenceIdentity(
  conferenceId: number,
  records: Standing[],
): { markup: string; name: string; shortName: string | null } {
  const aliasSet = new Set<string>();
  let name = "Conference";
  let shortName: string | null = null;

  if (directory?.has(conferenceId)) {
    const entry = directory.get(conferenceId)!;
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
    const fallback = records[0]!.team?.conference;
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

function renderStandingsTable(records: Standing[]): string {
  const rows = records
    .map((record, index) => {
      const seed = formatSeed(record.playoff_seed, index);
      const teamCell = renderTeamCell(record);
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

  return `
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
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderTeamCell(record: Standing): string {
  const team = record.team;
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

function updateConferenceIdentity(
  summaryEl: HTMLElement,
  conferenceId: number,
  records: Standing[],
): { name: string; shortName: string | null } {
  const identity = renderConferenceIdentity(conferenceId, records);
  const replacement = createElementFromMarkup(identity.markup);
  const existing = summaryEl.querySelector(".conference-identity");
  if (existing) {
    existing.replaceWith(replacement);
  } else {
    summaryEl.insertBefore(replacement, summaryEl.firstChild);
  }
  const details = summaryEl.closest("details");
  if (details) {
    details.dataset.conferenceName = identity.name;
  }
  return { name: identity.name, shortName: identity.shortName };
}

function updateCountLabel(countEl: HTMLElement, teamCount: number): void {
  if (teamCount > 0) {
    const label = `${teamCount} team${teamCount === 1 ? "" : "s"}`;
    countEl.textContent = label;
    countEl.setAttribute("aria-label", label);
  } else {
    const label = `Season ${currentSeason}`;
    countEl.textContent = label;
    countEl.setAttribute("aria-label", label);
  }
}

function renderStandingsInto(container: HTMLElement, records: Standing[]): void {
  if (!records.length) {
    container.innerHTML = `<p class="standings-card__placeholder">No standings are available for season ${currentSeason}.</p>`;
    return;
  }
  const teamCountLabel = `${records.length} team${records.length === 1 ? "" : "s"}`;
  container.innerHTML = `
    <div class="standings-card__meta">Season ${currentSeason} · ${teamCountLabel}</div>
    ${renderStandingsTable(records)}
    <p class="standings-note">Records refresh as the Ball Don't Lie NCAAB API publishes new results.</p>
  `;
}

function setStatus(message: string, variant: "default" | "error" | "loading" | "success" = "default"): void {
  statusElement.textContent = message;
  if (variant === "error") {
    statusElement.dataset.variant = "error";
  } else if (variant === "loading") {
    statusElement.dataset.variant = "loading";
  } else {
    delete statusElement.dataset.variant;
  }
}

function updateSearchParams(season: number, conferenceId: number | null): void {
  if (typeof history === "undefined" || typeof history.replaceState !== "function") {
    return;
  }
  try {
    const search = new URLSearchParams(location.search);
    search.set("season", String(season));
    if (conferenceId) {
      search.set("conference_id", String(conferenceId));
    } else {
      search.delete("conference_id");
    }
    const query = search.toString();
    const nextUrl = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
    history.replaceState(null, "", nextUrl);
  } catch {
    // ignore URL update failures
  }
}

async function fetchStandingsData(conferenceId: number, season: number): Promise<Standing[]> {
  const response = await NCAAM.standings({ conference_id: conferenceId, season });
  const data = Array.isArray(response?.data) ? response.data : [];
  return data;
}

async function loadStandingsForCard(details: HTMLDetailsElement): Promise<void> {
  const idRaw = details.dataset.conferenceId;
  if (!idRaw) return;
  const conferenceId = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(conferenceId)) {
    return;
  }

  const summary = details.querySelector<HTMLElement>(".conference-card__summary");
  const body = details.querySelector<HTMLElement>(".standings-card__body");
  const countEl = summary?.querySelector<HTMLElement>(".conference-card__count") ?? null;
  if (!summary || !body || !countEl) {
    return;
  }

  const cached = standingsCache.get(conferenceId);
  if (cached && cached.season === currentSeason) {
    renderStandingsInto(body, cached.records);
    updateCountLabel(countEl, cached.records.length);
    const identity = updateConferenceIdentity(summary, conferenceId, cached.records);
    lastOpenedConferenceId = conferenceId;
    updateSearchParams(currentSeason, conferenceId);
    if (cached.records.length > 0) {
      setStatus(`Showing ${cached.records.length} teams for ${identity.name} (${currentSeason}).`, "success");
    } else {
      setStatus(`No standings available for ${identity.name} in ${currentSeason}.`);
    }
    details.dataset.loadedSeason = String(currentSeason);
    return;
  }

  if (details.dataset.loading === "true") {
    return;
  }

  details.dataset.loading = "true";
  body.innerHTML = `<p class="standings-card__placeholder">Loading standings…</p>`;

  try {
    const data = await fetchStandingsData(conferenceId, currentSeason);
    const sorted = data.slice().sort(compareStandings);
    standingsCache.set(conferenceId, { season: currentSeason, records: sorted });

    if (sorted.length === 0) {
      body.innerHTML = `<p class="standings-card__placeholder">No standings are available for season ${currentSeason}.</p>`;
      updateCountLabel(countEl, 0);
      const identity = updateConferenceIdentity(summary, conferenceId, sorted);
      setStatus(`No standings available for ${identity.name} in ${currentSeason}.`);
    } else {
      renderStandingsInto(body, sorted);
      updateCountLabel(countEl, sorted.length);
      const identity = updateConferenceIdentity(summary, conferenceId, sorted);
      setStatus(`Showing ${sorted.length} teams for ${identity.name} (${currentSeason}).`, "success");
    }

    details.dataset.loadedSeason = String(currentSeason);
    lastOpenedConferenceId = conferenceId;
    updateSearchParams(currentSeason, conferenceId);
  } catch (error) {
    console.error(`Unable to load standings for conference ${conferenceId}`, error);
    body.innerHTML = `<p class="standings-card__placeholder standings-card__placeholder--error">We couldn't load the standings right now. Please try again later.</p>`;
    updateCountLabel(countEl, 0);
    setStatus("We couldn't load the standings right now. Please try again shortly.", "error");
  } finally {
    delete details.dataset.loading;
  }
}

function clearCachedStandings(): void {
  standingsCache.clear();
  const cards = directoryElement.querySelectorAll<HTMLDetailsElement>(".standings-card");
  cards.forEach(details => {
    const body = details.querySelector<HTMLElement>(".standings-card__body");
    const summary = details.querySelector<HTMLElement>(".conference-card__summary");
    const countEl = summary?.querySelector<HTMLElement>(".conference-card__count") ?? null;
    if (body) {
      body.innerHTML = `<p class="standings-card__placeholder">Open to load standings for season ${currentSeason}.</p>`;
    }
    if (countEl) {
      updateCountLabel(countEl, 0);
    }
    delete details.dataset.loadedSeason;
    if (details.open) {
      void loadStandingsForCard(details);
    }
  });
}

function createConferenceCard(conferenceId: number): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "conference-card card standings-card";
  details.dataset.conferenceId = String(conferenceId);

  const summary = document.createElement("summary");
  summary.className = "conference-card__summary";
  const identity = renderConferenceIdentity(conferenceId, []);
  summary.append(createElementFromMarkup(identity.markup));

  const meta = document.createElement("span");
  meta.className = "conference-card__meta";

  const count = document.createElement("span");
  count.className = "conference-card__count";
  const seasonLabel = `Season ${currentSeason}`;
  count.textContent = seasonLabel;
  count.setAttribute("aria-label", seasonLabel);
  meta.append(count);

  const indicator = document.createElement("span");
  indicator.className = "disclosure-indicator";
  indicator.setAttribute("aria-hidden", "true");
  meta.append(indicator);

  summary.append(meta);
  details.append(summary);

  const body = document.createElement("div");
  body.className = "conference-card__body standings-card__body";
  body.innerHTML = `<p class="standings-card__placeholder">Open to load standings for season ${currentSeason}.</p>`;
  details.append(body);

  details.addEventListener("toggle", () => {
    if (!details.open) return;
    void loadStandingsForCard(details);
  });

  return details;
}

async function populateConferences(): Promise<void> {
  setStatus("Loading conferences…", "loading");
  directoryElement.innerHTML = `<p class="standings-directory__placeholder">Loading conferences…</p>`;

  try {
    directory = await getConferenceMap();
  } catch (error) {
    console.error("Unable to load conference directory", error);
    directoryElement.innerHTML = `<p class="standings-directory__placeholder standings-directory__placeholder--error">We couldn't load the conference list. Please refresh and try again.</p>`;
    setStatus("We couldn't load the conference list. Please refresh and try again.", "error");
    return;
  }

  const entries = Array.from(directory.values()).sort((a, b) => a.name.localeCompare(b.name));
  if (entries.length === 0) {
    directoryElement.innerHTML = `<p class="standings-directory__placeholder">No conferences are available yet.</p>`;
    setStatus("No conferences are available yet.");
    return;
  }

  directoryElement.innerHTML = "";
  entries.forEach(entry => {
    directoryElement.appendChild(createConferenceCard(entry.id));
  });

  setStatus(`Open a conference to view standings for season ${currentSeason}.`);

  const targetConference = parseConferenceIdFromParams();
  if (targetConference && directory.has(targetConference)) {
    const card = directoryElement.querySelector<HTMLDetailsElement>(`details.standings-card[data-conference-id="${targetConference}"]`);
    if (card) {
      card.open = true;
      void loadStandingsForCard(card);
    }
  }
}

formEl.addEventListener("submit", event => {
  event.preventDefault();
  const raw = Number.parseInt(seasonInputEl.value, 10);
  if (!Number.isFinite(raw)) {
    setStatus("Please choose a valid season.", "error");
    return;
  }
  const clamped = Math.min(Math.max(raw, 2002), 2100);
  currentSeason = clamped;
  seasonInputEl.value = String(clamped);
  setStatus(`Season ${clamped} selected. Open a conference to load standings.`, "success");
  updateSearchParams(currentSeason, lastOpenedConferenceId);
  clearCachedStandings();
});

seasonInputEl.value = String(initialSeason);

void populateConferences();
