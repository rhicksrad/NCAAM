import { NCAAM, type Player, type PlayerStatLine, type Team } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import {
  getTeamAccentColors,
  getTeamLogoUrl,
  getTeamMonogram,
} from "../lib/ui/logos.js";

type PlayerSeasonAverage = {
  player_id: number;
  team_id: number | null;
  team_abbreviation: string | null;
  games_played: number;
  avg_seconds: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
};

type PlayerStatsIndex = {
  season: number;
  season_label: string;
  generated: string;
  players: Record<string, PlayerSeasonAverage>;
};

type PlayerTotals = {
  playerId: number;
  games: number;
  seconds: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  teamId: number | null;
  teamAbbreviation: string | null;
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
  <h1>Active Players</h1>
  <p class="page-intro">Browse every Division I roster and open a team to load its current active players.</p>
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

const [conferenceMap, teamsResponse, statsIndex] = await Promise.all([
  getConferenceMap(),
  NCAAM.teams(1, 400),
  fetch(assetUrl("data/player_stats.json"))
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load player stats index (${res.status})`);
      return res.json() as Promise<PlayerStatsIndex>;
    })
    .catch(error => {
      console.warn("Unable to load player stats index", error);
      return null;
    }),
]);

const playerStatsById = new Map<number, PlayerSeasonAverage>();
let playerStatsSeasonLabel: string | undefined = undefined;

if (statsIndex && statsIndex.players) {
  playerStatsSeasonLabel = statsIndex.season_label;
  for (const [key, value] of Object.entries(statsIndex.players)) {
    const id = Number(key);
    if (!Number.isFinite(id)) continue;
    playerStatsById.set(id, value);
  }
}

const playerStatsSeason = statsIndex?.season ?? inferCurrentSeason();
if (!playerStatsSeasonLabel && Number.isFinite(playerStatsSeason)) {
  playerStatsSeasonLabel = formatSeasonLabel(playerStatsSeason);
}

const livePlayerStatsCache = new Map<number, PlayerSeasonAverage | null>();
const livePlayerStatsRequests = new Map<number, Promise<PlayerSeasonAverage | null>>();

const PLAYER_STATS_PAGE_SIZE = 100;
const PLAYER_STATS_MAX_STEPS = 12;

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

  const stats = playerStatsById.get(player.id);
  if (stats && stats.games_played > 0) {
    populatePlayerStatsSection(section, stats);
    return section;
  }

  const cached = livePlayerStatsCache.get(player.id);
  if (cached) {
    populatePlayerStatsSection(section, cached);
    return section;
  }

  if (cached === null) {
    section.innerHTML = `<p class="player-card__stats-empty">No stats available for this player.</p>`;
    return section;
  }

  section.innerHTML = `<p class="player-card__stats-empty">Fetching season averages…</p>`;

  ensurePlayerStats(player).then(result => {
    if (result && result.games_played > 0) {
      populatePlayerStatsSection(section, result);
      return;
    }
    section.innerHTML = `<p class="player-card__stats-empty">No stats available for this player.</p>`;
  });

  return section;
}

function createStatEntry(label: string, value: string): HTMLElement {
  const stat = document.createElement("span");
  stat.className = "player-card__stat";
  stat.dataset.label = label;
  stat.textContent = value;
  stat.setAttribute("aria-label", `${label}: ${value}`);
  return stat;
}

function populatePlayerStatsSection(section: HTMLElement, stats: PlayerSeasonAverage): void {
  section.innerHTML = "";

  const header = document.createElement("div");
  header.className = "player-card__stats-header";

  const title = document.createElement("strong");
  title.textContent = playerStatsSeasonLabel ?? "Season averages";
  header.append(title);

  const summary = document.createElement("span");
  summary.textContent = `${stats.games_played} GP`;
  header.append(summary);

  const grid = document.createElement("div");
  grid.className = "player-card__stats-grid";

  const statsList: Array<[string, string]> = [
    ["MIN", formatMinutes(stats.avg_seconds)],
    ["PTS", formatAverage(stats.pts)],
    ["REB", formatAverage(stats.reb)],
    ["AST", formatAverage(stats.ast)],
    ["STL", formatAverage(stats.stl)],
    ["BLK", formatAverage(stats.blk)],
    ["TOV", formatAverage(stats.tov)],
    ["FG%", formatPercent(stats.fg_pct)],
    ["3P%", formatPercent(stats.fg3_pct)],
    ["FT%", formatPercent(stats.ft_pct)],
  ];

  for (const [label, value] of statsList) {
    grid.append(createStatEntry(label, value));
  }

  section.append(header, grid);
}

function formatJersey(value: string | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  return trimmed ? `#${trimmed.replace(/^#/, "")}` : "—";
}

function formatAverage(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  if (!Number.isFinite(value)) return "—";
  const fixed = value.toFixed(1);
  return fixed.replace(/\.0$/, "");
}

function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  if (!Number.isFinite(value)) return "—";
  const pct = value * 100;
  if (!Number.isFinite(pct)) return "—";
  const fixed = pct.toFixed(1);
  return `${fixed.replace(/\.0$/, "")}%`;
}

function formatMinutes(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—";
  if (!Number.isFinite(value)) return "—";
  const total = Math.round(value);
  if (total <= 0) return "—";
  const minutes = Math.floor(total / 60);
  const seconds = Math.max(0, total - minutes * 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function ensurePlayerStats(player: Player): Promise<PlayerSeasonAverage | null> {
  const existing = playerStatsById.get(player.id);
  if (existing && existing.games_played > 0) {
    return Promise.resolve(existing);
  }

  if (livePlayerStatsCache.has(player.id)) {
    return Promise.resolve(livePlayerStatsCache.get(player.id) ?? null);
  }

  const pending = livePlayerStatsRequests.get(player.id);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      const fetched = await fetchPlayerStatsFromApi(player.id);
      if (fetched && fetched.games_played > 0) {
        playerStatsById.set(player.id, fetched);
        livePlayerStatsCache.set(player.id, fetched);
        return fetched;
      }
      livePlayerStatsCache.set(player.id, null);
      return null;
    } catch (error) {
      livePlayerStatsCache.set(player.id, null);
      console.warn(`Unable to fetch stats for player ${player.id}`, error);
      return null;
    } finally {
      livePlayerStatsRequests.delete(player.id);
    }
  })();

  livePlayerStatsRequests.set(player.id, request);
  return request;
}

async function fetchPlayerStatsFromApi(playerId: number): Promise<PlayerSeasonAverage | null> {
  const totals = createPlayerTotals(playerId);
  const season = playerStatsSeason;
  let page = 1;
  let cursor: string | number | undefined;

  for (let attempts = 0; attempts < PLAYER_STATS_MAX_STEPS; attempts += 1) {
    const response = await NCAAM.playerStats({
      playerIds: [playerId],
      perPage: PLAYER_STATS_PAGE_SIZE,
      page,
      cursor,
      ...(Number.isFinite(season) ? { season } : {}),
    });

    const rows = Array.isArray(response.data) ? response.data : [];
    if (rows.length === 0 && attempts === 0) {
      break;
    }

    for (const row of rows) {
      const rowPlayerId = Number(row.player?.id ?? playerId);
      if (!Number.isFinite(rowPlayerId) || rowPlayerId !== playerId) {
        continue;
      }
      accumulatePlayerTotals(totals, row);
    }

    const meta = response.meta ?? {};
    const nextCursor = meta.next_cursor;
    if (nextCursor !== undefined && nextCursor !== null && String(nextCursor).length > 0) {
      cursor = nextCursor;
      continue;
    }

    if (typeof meta.next_page === "number" && meta.next_page > page) {
      page = meta.next_page;
      cursor = undefined;
      continue;
    }

    if (rows.length < PLAYER_STATS_PAGE_SIZE) {
      break;
    }

    page += 1;
    cursor = undefined;
  }

  if (totals.games === 0) {
    return null;
  }

  const average = totalsToAverage(totals);
  if (!playerStatsSeasonLabel && Number.isFinite(season)) {
    playerStatsSeasonLabel = formatSeasonLabel(season);
  }
  return average;
}

function createPlayerTotals(playerId: number): PlayerTotals {
  return {
    playerId,
    games: 0,
    seconds: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    teamId: null,
    teamAbbreviation: null,
  };
}

function accumulatePlayerTotals(totals: PlayerTotals, line: PlayerStatLine): void {
  totals.games += 1;
  totals.seconds += parseMinutesToSeconds(line.min ?? null);
  totals.pts += safeStatNumber(line.pts);
  totals.reb += safeStatNumber(line.reb);
  totals.ast += safeStatNumber(line.ast);
  totals.stl += safeStatNumber(line.stl);
  totals.blk += safeStatNumber(line.blk);
  totals.tov += safeStatNumber(line.turnover);
  totals.fgm += safeStatNumber(line.fgm);
  totals.fga += safeStatNumber(line.fga);
  totals.fg3m += safeStatNumber(line.fg3m);
  totals.fg3a += safeStatNumber(line.fg3a);
  totals.ftm += safeStatNumber(line.ftm);
  totals.fta += safeStatNumber(line.fta);

  if (line.team && Number.isFinite(line.team.id)) {
    totals.teamId = line.team.id;
  }
  if (line.team?.abbreviation) {
    totals.teamAbbreviation = line.team.abbreviation;
  }
}

function totalsToAverage(totals: PlayerTotals): PlayerSeasonAverage {
  const games = Math.max(1, totals.games);
  return {
    player_id: totals.playerId,
    team_id: totals.teamId,
    team_abbreviation: totals.teamAbbreviation,
    games_played: totals.games,
    avg_seconds: totals.seconds / games,
    pts: totals.pts / games,
    reb: totals.reb / games,
    ast: totals.ast / games,
    stl: totals.stl / games,
    blk: totals.blk / games,
    tov: totals.tov / games,
    fg_pct: totals.fga > 0 ? totals.fgm / totals.fga : null,
    fg3_pct: totals.fg3a > 0 ? totals.fg3m / totals.fg3a : null,
    ft_pct: totals.fta > 0 ? totals.ftm / totals.fta : null,
  };
}

function safeStatNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseMinutesToSeconds(value: string | null | undefined): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const [minutePart, secondPart] = trimmed.split(":");
  const minutes = Number.parseInt(minutePart ?? "0", 10);
  const seconds = Number.parseInt(secondPart ?? "0", 10);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return 0;
  }
  return Math.max(0, minutes * 60 + seconds);
}

function formatSeasonLabel(season: number): string {
  const next = String(season + 1);
  return `${season}-${next.slice(-2)}`;
}

function inferCurrentSeason(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return month >= 6 ? year : year - 1;
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
