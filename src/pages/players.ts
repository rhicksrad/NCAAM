import { NCAAM, type Player, type Team } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import {
  getTeamAccentColors,
  getTeamLogoUrl,
  getTeamMonogram,
} from "../lib/ui/logos.js";

type PlayerIndexEntry = {
  name: string;
  team: string;
  season: string;
  slug: string;
  url?: string;
  season_year?: number;
  name_key?: string;
  team_key?: string;
  conference?: string;
};

type PlayerIndexDocument = {
  seasons?: string[];
  players?: PlayerIndexEntry[];
};

type PlayerStatsSeason = {
  season: string;
  team: string;
  conf: string;
  gp: number | null;
  gs: number | null;
  mp_g: number | null;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  orb_g: number | null;
  drb_g: number | null;
  trb_g: number | null;
  ast_g: number | null;
  stl_g: number | null;
  blk_g: number | null;
  tov_g: number | null;
  pf_g: number | null;
  pts_g: number | null;
};

type PlayerStatsDocument = {
  slug: string;
  name: string;
  seasons: PlayerStatsSeason[];
  source: string;
  last_scraped: string;
};

function decorateAvatar(el: HTMLElement, team: Team): void {
  const logoUrl = getTeamLogoUrl(team);
  el.innerHTML = "";
  el.classList.toggle("roster-team__logo--image", Boolean(logoUrl));
  el.classList.toggle("roster-team__logo--placeholder", !logoUrl);
  el.style.removeProperty("--team-accent");
  el.style.removeProperty("--team-accent-secondary");

  if (logoUrl) {
    el.removeAttribute("aria-hidden");
    el.removeAttribute("role");
    const img = document.createElement("img");
    img.src = logoUrl;
    img.alt = `${team.full_name} logo`;
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 44;
    img.height = 44;
    el.append(img);
    return;
  }

  el.setAttribute("aria-hidden", "true");
  el.setAttribute("role", "presentation");
  const [primary, secondary] = getTeamAccentColors(team);
  el.style.setProperty("--team-accent", primary);
  el.style.setProperty("--team-accent-secondary", secondary);
  el.textContent = getTeamMonogram(team);
}

type RosterState = {
  status: "idle" | "loading" | "loaded" | "error";
  players?: Player[];
};

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing #app container");
}

app.innerHTML = `
  <input class="search" placeholder="Search by team or conference" aria-label="Filter teams">
  <div id="roster-groups" class="conference-groups roster-groups" aria-live="polite"></div>
  <p id="roster-empty" class="empty-state" hidden>No teams match your search.</p>
`;

const searchInputEl = app.querySelector<HTMLInputElement>("input.search");
const rosterGroupsEl = app.querySelector<HTMLDivElement>("#roster-groups");
const emptyStateEl = app.querySelector<HTMLParagraphElement>("#roster-empty");

if (!searchInputEl) {
  throw new Error("Players page failed to initialise search control");
}
if (!rosterGroupsEl) {
  throw new Error("Players page failed to find roster container");
}
if (!emptyStateEl) {
  throw new Error("Players page failed to find empty-state element");
}

const searchInput = searchInputEl;
const rosterGroups = rosterGroupsEl;
const emptyState = emptyStateEl;

const rosterState = new Map<number, RosterState>();

const assetUrl = (path: string) => {
  const base = typeof document !== "undefined" ? document.baseURI : undefined;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const root = base ?? origin ?? "";
  const normalisedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalisedPath, root).toString();
};

const [conferenceMap, teamsResponse, playersIndexDoc] = await Promise.all([
  getConferenceMap(),
  NCAAM.teams(1, 400),
  fetch(assetUrl("data/players_index.json"))
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load player index (${res.status})`);
      return res.json() as Promise<PlayerIndexDocument>;
    })
    .catch(error => {
      console.warn("Unable to load player index", error);
      return null;
    }),
]);

const playerIndexEntries = Array.isArray(playersIndexDoc?.players) ? playersIndexDoc.players : [];
const playerIndexSeasonsRaw = Array.isArray(playersIndexDoc?.seasons) ? playersIndexDoc.seasons : [];
const playerIndexSeasons = playerIndexSeasonsRaw.filter((value): value is string => typeof value === "string");
playerIndexSeasons.sort((a, b) => seasonLabelToYear(a) - seasonLabelToYear(b));
const latestPlayerIndexSeason = playerIndexSeasons[playerIndexSeasons.length - 1] ?? null;
const playerIndexByKey = new Map<string, PlayerIndexEntry>();
const playerIndexByName = new Map<string, PlayerIndexEntry[]>();

for (const entry of playerIndexEntries) {
  const nameKey = entry.name_key ?? normaliseName(entry.name);
  const teamKey = entry.team_key ?? normaliseTeam(entry.team);
  const lookupKey = `${entry.season}|${teamKey}|${nameKey}`;
  playerIndexByKey.set(lookupKey, entry);
  const bucket = playerIndexByName.get(nameKey) ?? [];
  bucket.push(entry);
  playerIndexByName.set(nameKey, bucket);
}

for (const bucket of playerIndexByName.values()) {
  bucket.sort((a, b) => seasonLabelToYear(a.season) - seasonLabelToYear(b.season));
}

const playerSlugCache = new Map<number, string | null>();
const playerStatsCache = new Map<string, PlayerStatsDocument | null>();
const playerStatsRequests = new Map<string, Promise<PlayerStatsDocument | null>>();

const seenTeams = new Map<number, Team>();
for (const team of teamsResponse.data) {
  if (!team.conference_id) continue;
  if (!conferenceMap.has(team.conference_id)) continue;
  if (!seenTeams.has(team.id)) {
    seenTeams.set(team.id, team);
  }
}

const conferenceGroups = new Map<number, { id: number; name: string; short?: string; teams: Team[] }>();
for (const team of seenTeams.values()) {
  const conference = conferenceMap.get(team.conference_id!);
  if (!conference) continue;
  const bucket = conferenceGroups.get(conference.id) ?? {
    id: conference.id,
    name: conference.name,
    short: conference.short_name ?? undefined,
    teams: [],
  };
  bucket.teams.push(team);
  conferenceGroups.set(conference.id, bucket);
}

const sortedGroups = Array.from(conferenceGroups.values()).sort((a, b) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
);

const conferenceElements: HTMLDetailsElement[] = [];

for (const group of sortedGroups) {
  group.teams.sort((a, b) => a.full_name.localeCompare(b.full_name, "en", { sensitivity: "base" }));

  const details = document.createElement("details");
  details.className = "conference roster-conference";
  details.dataset.conferenceId = String(group.id);

  const summary = document.createElement("summary");
  summary.innerHTML = `<span>${group.short ?? group.name}</span><span class="count">${group.teams.length}</span>`;
  details.append(summary);

  const body = document.createElement("div");
  body.className = "roster-conference__teams";
  details.append(body);

  for (const team of group.teams) {
    body.append(createTeamDetails(team, group));
  }

  rosterGroups.append(details);
  conferenceElements.push(details);
}

function createTeamDetails(team: Team, group: { id: number; name: string; short?: string }): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "roster-team";
  details.dataset.teamId = String(team.id);
  details.dataset.teamSearch = buildSearchIndex(team, group);

  const summary = document.createElement("summary");
  summary.className = "roster-team__header";

  const identity = document.createElement("div");
  identity.className = "roster-team__identity";

  const logo = document.createElement("div");
  logo.className = "roster-team__logo";
  decorateAvatar(logo, team);

  const text = document.createElement("div");
  text.className = "roster-team__text";
  text.innerHTML = `
    <strong class="roster-team__name">${team.full_name}</strong>
    <span class="roster-team__meta">${group.short ?? group.name}${team.abbreviation ? ` · ${team.abbreviation}` : ""}</span>
  `;

  const count = document.createElement("span");
  count.className = "badge roster-team__count";
  count.textContent = "—";
  count.dataset.role = "count";

  identity.append(logo, text);
  summary.append(identity, count);
  details.append(summary);

  const roster = document.createElement("div");
  roster.className = "roster-team__body";
  roster.dataset.role = "roster";
  roster.innerHTML = `<div class="roster-status"><p>Open to load the active roster.</p></div>`;
  details.append(roster);

  details.addEventListener("toggle", () => {
    if (!details.open) return;
    const state = rosterState.get(team.id);
    if (state?.status === "loaded") {
      return;
    }
    if (state?.status === "loading") {
      return;
    }
    loadTeamRoster(team, roster, count);
  });

  return details;
}

async function loadTeamRoster(team: Team, container: HTMLElement, countEl: HTMLElement): Promise<void> {
  rosterState.set(team.id, { status: "loading" });
  container.innerHTML = `<div class="roster-status"><p>Loading roster…</p></div>`;

  try {
    const { data } = await NCAAM.activePlayersByTeam(team.id);
    rosterState.set(team.id, { status: "loaded", players: data });
    renderRoster(container, data);
    countEl.textContent = String(data.length);
    countEl.classList.toggle("roster-team__count--empty", data.length === 0);
  } catch (error) {
    console.error("Failed to load active roster", error);
    rosterState.set(team.id, { status: "error" });
    container.innerHTML = `<div class="roster-status roster-status--error"><p>Unable to load the roster right now.</p><button type="button" class="roster-retry">Try again</button></div>`;
    const retry = container.querySelector<HTMLButtonElement>("button.roster-retry");
    if (retry) {
      retry.addEventListener("click", event => {
        event.stopPropagation();
        loadTeamRoster(team, container, countEl).catch(() => {});
      });
    }
    countEl.textContent = "—";
  }
}

function renderRoster(container: HTMLElement, players: Player[]): void {
  if (players.length === 0) {
    container.innerHTML = `<div class="roster-status roster-status--empty"><p>No active players are listed for this team.</p></div>`;
    return;
  }

  const list = document.createElement("div");
  list.className = "roster-grid";

  const sorted = [...players].sort((a, b) => {
    const last = a.last_name.localeCompare(b.last_name, "en", { sensitivity: "base" });
    if (last !== 0) return last;
    return a.first_name.localeCompare(b.first_name, "en", { sensitivity: "base" });
  });

  for (const player of sorted) {
    list.append(renderPlayerCard(player));
  }

  container.innerHTML = "";
  container.append(list);
}

function renderPlayerCard(player: Player): HTMLElement {
  const card = document.createElement("article");
  card.className = "player-card";

  const header = document.createElement("header");
  header.className = "player-card__header";
  header.innerHTML = `
    <h3 class="player-card__name">${player.first_name} ${player.last_name}</h3>
    <span class="player-card__jersey">${formatJersey(player.jersey_number)}</span>
  `;

  const meta = document.createElement("dl");
  meta.className = "player-card__meta";

  meta.append(createMetaRow("Position", player.position ?? "—"));
  meta.append(createMetaRow("Height", player.height ?? "—"));
  meta.append(createMetaRow("Weight", player.weight ?? "—"));

  const statsSection = renderPlayerStatsSection(player);

  card.append(header, meta, statsSection);
  return card;
}

function createMetaRow(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "player-card__meta-row";
  row.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
  return row;
}

function renderPlayerStatsSection(player: Player): HTMLElement {
  const section = document.createElement("section");
  section.className = "player-card__stats";

  const slug = resolvePlayerSlug(player);
  if (!slug) {
    section.innerHTML = `<p class="player-card__stats-empty">College stats are not available for this player.</p>`;
    return section;
  }

  const cached = playerStatsCache.get(slug);
  if (cached !== undefined) {
    updatePlayerStatsSection(section, slug, cached);
    return section;
  }

  section.innerHTML = `<p class="player-card__stats-empty">Loading college stats…</p>`;

  ensureStatsForSlug(slug)
    .then(doc => {
      updatePlayerStatsSection(section, slug, doc);
    })
    .catch(error => {
      console.error(`Unable to load college stats for ${slug}`, error);
      section.innerHTML = `<p class="player-card__stats-error">Unable to load college stats right now.</p>`;
    });

  return section;
}

function updatePlayerStatsSection(
  section: HTMLElement,
  slug: string,
  doc: PlayerStatsDocument | null,
): void {
  if (doc === null) {
    section.innerHTML = `<p class="player-card__stats-error">Unable to load college stats right now.</p>`;
    return;
  }

  const seasons = Array.isArray(doc.seasons) ? doc.seasons : [];
  if (seasons.length === 0) {
    section.innerHTML = `<p class="player-card__stats-empty">College stats are not available for this player.</p>`;
    return;
  }

  section.innerHTML = "";

  const tableWrapper = document.createElement("div");
  tableWrapper.className = "player-card__stats-scroll";

  const table = createPlayerStatsTable(seasons);
  tableWrapper.append(table);

  section.append(tableWrapper);
}

function createPlayerStatsTable(seasons: PlayerStatsSeason[]): HTMLTableElement {
  const table = document.createElement("table");
  table.className = "player-card__stats-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const headers: Array<[string, boolean]> = [
    ["Season", false],
    ["Team", false],
    ["Conf", false],
    ["GP", true],
    ["GS", true],
    ["MP", true],
    ["FG%", true],
    ["3P%", true],
    ["FT%", true],
    ["ORB", true],
    ["DRB", true],
    ["TRB", true],
    ["AST", true],
    ["STL", true],
    ["BLK", true],
    ["TOV", true],
    ["PF", true],
    ["PTS", true],
  ];

  for (const [label, numeric] of headers) {
    const th = document.createElement("th");
    th.textContent = label;
    if (numeric) {
      th.classList.add("numeric");
    }
    headRow.append(th);
  }

  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const season of seasons) {
    const row = document.createElement("tr");
    appendTableCell(row, season.season);
    appendTableCell(row, season.team || "—");
    appendTableCell(row, season.conf || "—");
    appendTableCell(row, formatInteger(season.gp), true);
    appendTableCell(row, formatInteger(season.gs), true);
    appendTableCell(row, formatDecimal(season.mp_g), true);
    appendTableCell(row, formatPercentValue(season.fg_pct), true);
    appendTableCell(row, formatPercentValue(season.fg3_pct), true);
    appendTableCell(row, formatPercentValue(season.ft_pct), true);
    appendTableCell(row, formatDecimal(season.orb_g), true);
    appendTableCell(row, formatDecimal(season.drb_g), true);
    appendTableCell(row, formatDecimal(season.trb_g), true);
    appendTableCell(row, formatDecimal(season.ast_g), true);
    appendTableCell(row, formatDecimal(season.stl_g), true);
    appendTableCell(row, formatDecimal(season.blk_g), true);
    appendTableCell(row, formatDecimal(season.tov_g), true);
    appendTableCell(row, formatDecimal(season.pf_g), true);
    appendTableCell(row, formatDecimal(season.pts_g), true);
    tbody.append(row);
  }

  table.append(tbody);
  return table;
}

function appendTableCell(row: HTMLTableRowElement, value: string, numeric = false): void {
  const cell = document.createElement("td");
  cell.textContent = value;
  if (numeric) {
    cell.classList.add("numeric");
  }
  row.append(cell);
}

function formatJersey(value: string | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  return trimmed ? `#${trimmed.replace(/^#/, "")}` : "—";
}

function formatInteger(value: number | null): string {
  if (value === null || value === undefined) return "—";
  if (!Number.isFinite(value)) return "—";
  return String(Math.round(value));
}

function formatDecimal(value: number | null, digits = 1): string {
  if (value === null || value === undefined) return "—";
  if (!Number.isFinite(value)) return "—";
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$/, "");
}

function formatPercentValue(value: number | null): string {
  if (value === null || value === undefined) return "—";
  if (!Number.isFinite(value)) return "—";
  const pct = value * 100;
  if (!Number.isFinite(pct)) return "—";
  const fixed = pct.toFixed(1);
  return `${fixed.replace(/\.0$/, "")}%`;
}

function resolvePlayerSlug(player: Player): string | null {
  const cached = playerSlugCache.get(player.id);
  if (cached !== undefined) {
    return cached;
  }

  const fullName = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
  if (!fullName) {
    playerSlugCache.set(player.id, null);
    return null;
  }

  const nameKey = normaliseName(fullName);
  const teamName = player.team?.full_name ?? player.team?.name ?? "";
  const teamKey = normaliseTeam(teamName);

  let match: PlayerIndexEntry | undefined;
  if (teamKey) {
    if (latestPlayerIndexSeason) {
      match = playerIndexByKey.get(`${latestPlayerIndexSeason}|${teamKey}|${nameKey}`);
    }
    if (!match) {
      for (let i = playerIndexSeasons.length - 1; i >= 0; i -= 1) {
        const season = playerIndexSeasons[i];
        const candidate = playerIndexByKey.get(`${season}|${teamKey}|${nameKey}`);
        if (candidate) {
          match = candidate;
          break;
        }
      }
    }
  }

  if (!match) {
    const bucket = playerIndexByName.get(nameKey) ?? [];
    if (bucket.length > 0) {
      match = bucket[bucket.length - 1];
    }
  }

  if (!match) {
    playerSlugCache.set(player.id, null);
    console.warn(`No College Basketball Reference slug for ${fullName} (${teamName || "unknown team"})`);
    return null;
  }

  playerSlugCache.set(player.id, match.slug);
  return match.slug;
}

function ensureStatsForSlug(slug: string): Promise<PlayerStatsDocument | null> {
  const cached = playerStatsCache.get(slug);
  if (cached !== undefined) {
    return Promise.resolve(cached);
  }

  const pending = playerStatsRequests.get(slug);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      const response = await fetch(assetUrl(`data/players/${slug}.json`));
      if (!response.ok) {
        console.error(`Failed to fetch local stats for ${slug} (${response.status})`);
        playerStatsCache.set(slug, null);
        return null;
      }
      const json = (await response.json()) as PlayerStatsDocument;
      json.seasons = Array.isArray(json.seasons) ? json.seasons : [];
      playerStatsCache.set(slug, json);
      return json;
    } catch (error) {
      console.error(`Network error while fetching stats for ${slug}`, error);
      playerStatsCache.set(slug, null);
      return null;
    } finally {
      playerStatsRequests.delete(slug);
    }
  })();

  playerStatsRequests.set(slug, request);
  return request;
}

function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normaliseTeam(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/men's|mens|women's|womens/gi, "")
    .replace(/\b(men|women|basketball)\b/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

function seasonLabelToYear(label: string): number {
  const match = label.match(/(\d{4})/);
  if (!match) return 0;
  const start = Number.parseInt(match[1], 10);
  if (!Number.isFinite(start)) return 0;
  return start + 1;
}


function buildSearchIndex(team: Team, group: { name: string; short?: string }): string {
  return [
    team.full_name,
    team.name,
    team.abbreviation ?? "",
    team.college ?? "",
    group.name,
    group.short ?? "",
  ]
    .join(" ")
    .toLowerCase();
}



function applyFilter(query: string): void {
  const q = query.trim().toLowerCase();
  let visibleConferences = 0;

  for (const conference of conferenceElements) {
    const teams = conference.querySelectorAll<HTMLDetailsElement>(".roster-team");
    let visibleTeams = 0;
    teams.forEach(teamEl => {
      const match = !q || (teamEl.dataset.teamSearch ?? "").includes(q);
      if (!match) {
        teamEl.open = false;
      }
      teamEl.toggleAttribute("hidden", !match);
      if (match) {
        visibleTeams += 1;
      }
    });
    const showConference = visibleTeams > 0;
    conference.toggleAttribute("hidden", !showConference);
    if (showConference) {
      visibleConferences += 1;
    } else {
      conference.open = false;
    }
  }

  emptyState.hidden = visibleConferences > 0;
}

searchInput.addEventListener("input", () => {
  applyFilter(searchInput.value);
});

applyFilter("");
