import { select } from "d3-selection";
import { buildScales, drawAxes, drawGrid } from "../lib/charts/axes.js";
import { computeInnerSize, createSVG } from "../lib/charts/frame.js";
import { renderBars } from "../lib/charts/series/bar.js";
import { createTooltip } from "../lib/charts/tooltip.js";
import { applyTheme, defaultTheme, formatNumber, } from "../lib/charts/theme.js";
import { NCAAM } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import { getTeamAccentColors, getTeamLogoUrl, getTeamMonogram, } from "../lib/ui/logos.js";
const LEADERBOARD_METRIC_ORDER = [
    "mp",
    "fgPct",
    "fg3Pct",
    "ftPct",
    "rebounds",
    "assists",
    "stocks",
    "turnovers",
    "points",
];
const LEADERBOARD_COLOR_PALETTE = [
    "#2563eb",
    "#db2777",
    "#0ea5e9",
    "#f97316",
    "#7c3aed",
    "#10b981",
    "#facc15",
    "#ec4899",
    "#14b8a6",
];
const LEADERBOARD_DEFAULT_MINIMUM_REQUIREMENT = {
    type: "games",
    value: 10,
};
const LEADERBOARD_MINIMUM_REQUIREMENTS = {
    mp: { type: "games", value: 12 },
    fgPct: { type: "games", value: 15 },
    fg3Pct: { type: "games", value: 15 },
    ftPct: { type: "freeThrowAttempts", value: 25 },
    rebounds: { type: "games", value: 12 },
    assists: { type: "games", value: 12 },
    stocks: { type: "games", value: 12 },
    turnovers: { type: "games", value: 12 },
    points: { type: "games", value: 12 },
};
const LEADERBOARD_PRESENTATION = {
    mp: {
        kicker: "Iron five",
        title: "Minutes workhorses",
        description: "Largest workloads in 2024-25 by average minutes played.",
        accentColor: "#2563eb",
    },
    fgPct: {
        kicker: "Shot makers",
        title: "Field goal efficiency",
        description: "Highest overall field-goal percentages among qualified players.",
        accentColor: "#16a34a",
    },
    fg3Pct: {
        kicker: "Arc assassins",
        title: "Three-point accuracy",
        description: "Sharpest shooters from deep with at least 15 games played.",
        accentColor: "#8b5cf6",
    },
    ftPct: {
        kicker: "Stripe snipers",
        title: "Free throw percentage",
        description: "Steadiest performers at the charity stripe after at least 25 attempts this season.",
        accentColor: "#f97316",
    },
    rebounds: {
        kicker: "Glass cleaners",
        title: "Top rebound totals",
        description: "Offensive and defensive boards per game for the slate's best rebounders.",
        accentColor: "#0ea5e9",
        stacked: {
            segments: [
                { id: "orb", label: "Offensive per game", stat: "orb_g", color: "#ec4899" },
                { id: "drb", label: "Defensive per game", stat: "drb_g", color: "#2563eb" },
            ],
            views: [
                { id: "total", label: "Total", segmentIds: ["orb", "drb"], useTotal: true },
                { id: "orb", label: "Off", segmentIds: ["orb"] },
                { id: "drb", label: "Def", segmentIds: ["drb"] },
            ],
            defaultView: "total",
            totalStat: "trb_g",
        },
    },
    assists: {
        kicker: "Assist engines",
        title: "Playmakers on the slate",
        description: "Primary table-setters leading the country in helpers per night.",
        accentColor: "#14b8a6",
    },
    stocks: {
        kicker: "Stocks hawks",
        title: "Steals + blocks leaders",
        description: "Disruptive defenders filling the steals and blocks columns.",
        accentColor: "#7c3aed",
        stacked: {
            segments: [
                { id: "stl", label: "Steals per game", stat: "stl_g", color: "#f97316" },
                { id: "blk", label: "Blocks per game", stat: "blk_g", color: "#22d3ee" },
            ],
            views: [
                { id: "total", label: "Total", segmentIds: ["stl", "blk"], useTotal: true },
                { id: "stl", label: "Steals", segmentIds: ["stl"] },
                { id: "blk", label: "Blocks", segmentIds: ["blk"] },
            ],
            defaultView: "total",
        },
    },
    turnovers: {
        kicker: "Care factor",
        title: "Turnovers per game",
        description: "Most giveaways among players meeting the minimum games threshold.",
        accentColor: "#facc15",
    },
    points: {
        kicker: "Slate scorers",
        title: "Top player points",
        description: "Highest scoring averages per game for the 2024-25 campaign.",
        accentColor: "#2563eb",
    },
};
const LEADERBOARD_PERCENT_METRICS = new Set(["fgPct", "fg3Pct", "ftPct"]);
const LEADERBOARD_AXIS_LABELS = {
    mp: "Minutes per game",
    fgPct: "Field-goal percentage",
    fg3Pct: "Three-point percentage",
    ftPct: "Free-throw percentage",
    rebounds: "Rebounds per game",
    assists: "Assists per game",
    stocks: "Stocks per game",
    turnovers: "Turnovers per game",
    points: "Points per game",
};
function decorateAvatar(el, team) {
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
const app = document.getElementById("app");
if (!app) {
    throw new Error("Missing #app container");
}
app.innerHTML = `
  <section id="player-leaderboard" class="player-leaderboard" aria-live="polite" aria-busy="true">
    <div class="player-leaderboard__status">Loading 2024-25 player leaderboards…</div>
  </section>
  <section class="player-rosters">
    <div class="player-rosters__header">
      <div class="player-rosters__titles">
        <h2 class="player-rosters__title">Active rosters</h2>
        <p class="player-rosters__season hero__season-note">2025-2026 Active Players</p>
      </div>
      <div class="player-rosters__search">
        <input class="search" placeholder="Search by team or conference" aria-label="Filter teams">
      </div>
    </div>
    <div id="roster-groups" class="conference-groups roster-groups" aria-live="polite"></div>
    <p id="roster-empty" class="empty-state" hidden>No teams match your search.</p>
  </section>
`;
const leaderboardSectionEl = app.querySelector("#player-leaderboard");
if (!leaderboardSectionEl) {
    throw new Error("Players page failed to find leaderboard container");
}
const searchInputEl = app.querySelector("input.search");
const rosterGroupsEl = app.querySelector("#roster-groups");
const emptyStateEl = app.querySelector("#roster-empty");
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
const rosterState = new Map();
const normaliseBasePath = (pathname) => {
    if (!pathname || pathname === "/") {
        return "/";
    }
    if (pathname.endsWith("/")) {
        return pathname;
    }
    const lastSlashIndex = pathname.lastIndexOf("/");
    if (lastSlashIndex === -1) {
        return "/";
    }
    const lastSegment = pathname.slice(lastSlashIndex + 1);
    if (lastSegment && !lastSegment.includes(".")) {
        return `${pathname}/`;
    }
    const withoutFile = pathname.slice(0, lastSlashIndex + 1);
    return withoutFile === "" ? "/" : withoutFile;
};
let assetBase;
const resolveAssetBase = () => {
    try {
        const scriptRoot = new URL("../../", import.meta.url);
        scriptRoot.pathname = normaliseBasePath(scriptRoot.pathname);
        scriptRoot.search = "";
        scriptRoot.hash = "";
        return scriptRoot.toString();
    }
    catch {
        // Ignore script URL resolution errors and fall back to DOM-based heuristics.
    }
    if (typeof document !== "undefined") {
        try {
            const baseElement = document.querySelector("base[href]");
            const href = baseElement?.href ?? document.baseURI;
            if (href) {
                const baseUrl = new URL(href, typeof window !== "undefined" && window.location ? window.location.href : undefined);
                baseUrl.pathname = normaliseBasePath(baseUrl.pathname);
                baseUrl.search = "";
                baseUrl.hash = "";
                return baseUrl.toString();
            }
        }
        catch {
            // Ignore invalid base tags and fall back to window-derived paths.
        }
    }
    if (typeof window !== "undefined" && window.location) {
        try {
            const { origin, pathname } = window.location;
            const basePath = normaliseBasePath(pathname ?? "");
            return `${origin ?? ""}${basePath}`;
        }
        catch {
            // Ignore window resolution errors and fall through to the default case.
        }
    }
    return null;
};
const getAssetBase = () => {
    if (assetBase !== undefined) {
        return assetBase;
    }
    assetBase = resolveAssetBase();
    return assetBase;
};
const assetUrl = (path) => {
    const base = getAssetBase();
    const normalisedPath = path.startsWith("/") ? path.slice(1) : path;
    if (!base) {
        return path;
    }
    try {
        return new URL(normalisedPath, base).toString();
    }
    catch {
        return path;
    }
};
const [conferenceMap, teamsResponse, playersIndexDoc] = await Promise.all([
    getConferenceMap(),
    NCAAM.teams(1, 400),
    fetch(assetUrl("data/players_index.json"))
        .then(res => {
        if (!res.ok)
            throw new Error(`Failed to load player index (${res.status})`);
        return res.json();
    })
        .catch(error => {
        console.warn("Unable to load player index", error);
        return null;
    }),
]);
const playerIndexEntries = Array.isArray(playersIndexDoc?.players) ? playersIndexDoc.players : [];
const playerIndexSeasonsRaw = Array.isArray(playersIndexDoc?.seasons) ? playersIndexDoc.seasons : [];
const playerIndexSeasons = playerIndexSeasonsRaw.filter((value) => typeof value === "string");
playerIndexSeasons.sort((a, b) => seasonLabelToYear(a) - seasonLabelToYear(b));
const latestPlayerIndexSeason = playerIndexSeasons[playerIndexSeasons.length - 1] ?? null;
const playerIndexByKey = new Map();
const playerIndexByName = new Map();
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
const playerSlugCache = new Map();
const playerStatsCache = new Map();
const playerStatsRequests = new Map();
void loadPlayerLeaderboards(leaderboardSectionEl);
const seenTeams = new Map();
for (const team of teamsResponse.data) {
    if (!team.conference_id)
        continue;
    if (!conferenceMap.has(team.conference_id))
        continue;
    if (!seenTeams.has(team.id)) {
        seenTeams.set(team.id, team);
    }
}
const conferenceGroups = new Map();
for (const team of seenTeams.values()) {
    const conference = conferenceMap.get(team.conference_id);
    if (!conference)
        continue;
    const bucket = conferenceGroups.get(conference.id) ?? {
        id: conference.id,
        name: conference.name,
        short: conference.short_name ?? undefined,
        teams: [],
    };
    bucket.teams.push(team);
    conferenceGroups.set(conference.id, bucket);
}
const sortedGroups = Array.from(conferenceGroups.values()).sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
const conferenceElements = [];
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
function createTeamDetails(team, group) {
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
        if (!details.open)
            return;
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
async function loadTeamRoster(team, container, countEl) {
    rosterState.set(team.id, { status: "loading" });
    container.innerHTML = `<div class="roster-status"><p>Loading roster…</p></div>`;
    try {
        const { data } = await NCAAM.activePlayersByTeam(team.id);
        rosterState.set(team.id, { status: "loaded", players: data });
        renderRoster(container, data);
        countEl.textContent = String(data.length);
        countEl.classList.toggle("roster-team__count--empty", data.length === 0);
    }
    catch (error) {
        console.error("Failed to load active roster", error);
        rosterState.set(team.id, { status: "error" });
        container.innerHTML = `<div class="roster-status roster-status--error"><p>Unable to load the roster right now.</p><button type="button" class="roster-retry">Try again</button></div>`;
        const retry = container.querySelector("button.roster-retry");
        if (retry) {
            retry.addEventListener("click", event => {
                event.stopPropagation();
                loadTeamRoster(team, container, countEl).catch(() => { });
            });
        }
        countEl.textContent = "—";
    }
}
function renderRoster(container, players) {
    if (players.length === 0) {
        container.innerHTML = `<div class="roster-status roster-status--empty"><p>No active players are listed for this team.</p></div>`;
        return;
    }
    const list = document.createElement("ul");
    list.className = "roster-list";
    list.setAttribute("role", "list");
    const sorted = [...players].sort((a, b) => {
        const last = a.last_name.localeCompare(b.last_name, "en", { sensitivity: "base" });
        if (last !== 0)
            return last;
        return a.first_name.localeCompare(b.first_name, "en", { sensitivity: "base" });
    });
    for (const player of sorted) {
        const item = document.createElement("li");
        item.className = "roster-list__item";
        item.append(renderPlayerCard(player));
        list.append(item);
    }
    container.innerHTML = "";
    container.append(list);
}
function renderPlayerCard(player) {
    const card = document.createElement("article");
    card.className = "player-card";
    const header = document.createElement("header");
    header.className = "player-card__header";
    const name = document.createElement("h3");
    name.className = "player-card__name";
    const nameText = document.createElement("span");
    nameText.className = "player-card__name-text";
    nameText.textContent = `${player.first_name} ${player.last_name}`.trim();
    const detailParts = [];
    const jersey = formatJersey(player.jersey_number);
    if (jersey !== "—")
        detailParts.push(jersey);
    const position = player.position?.trim();
    if (position)
        detailParts.push(position);
    const height = player.height?.trim();
    if (height)
        detailParts.push(height);
    const weight = player.weight?.trim();
    if (weight)
        detailParts.push(weight);
    const details = document.createElement("span");
    details.className = "player-card__name-meta";
    details.textContent = detailParts.length > 0 ? detailParts.join(" • ") : "—";
    name.append(nameText, details);
    header.append(name);
    const statsSection = renderPlayerStatsSection(player);
    card.append(header, statsSection);
    return card;
}
function renderPlayerStatsSection(player) {
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
function updatePlayerStatsSection(section, slug, doc) {
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
function createPlayerStatsTable(seasons) {
    const table = document.createElement("table");
    table.className = "player-card__stats-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const headers = [
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
function appendTableCell(row, value, numeric = false) {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (numeric) {
        cell.classList.add("numeric");
    }
    row.append(cell);
}
function formatJersey(value) {
    if (!value)
        return "—";
    const trimmed = value.trim();
    return trimmed ? `#${trimmed.replace(/^#/, "")}` : "—";
}
function formatInteger(value) {
    if (value === null || value === undefined)
        return "—";
    if (!Number.isFinite(value))
        return "—";
    return String(Math.round(value));
}
function formatDecimal(value, digits = 1) {
    if (value === null || value === undefined)
        return "—";
    if (!Number.isFinite(value))
        return "—";
    const fixed = value.toFixed(digits);
    return fixed.replace(/\.0+$/, "");
}
function formatPercentValue(value) {
    if (value === null || value === undefined)
        return "—";
    if (!Number.isFinite(value))
        return "—";
    const pct = value * 100;
    if (!Number.isFinite(pct))
        return "—";
    const fixed = pct.toFixed(1);
    return `${fixed.replace(/\.0$/, "")}%`;
}
function resolvePlayerSlug(player) {
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
    let match;
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
function ensureStatsForSlug(slug) {
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
            const json = (await response.json());
            json.seasons = Array.isArray(json.seasons) ? json.seasons : [];
            playerStatsCache.set(slug, json);
            return json;
        }
        catch (error) {
            console.error(`Network error while fetching stats for ${slug}`, error);
            playerStatsCache.set(slug, null);
            return null;
        }
        finally {
            playerStatsRequests.delete(slug);
        }
    })();
    playerStatsRequests.set(slug, request);
    return request;
}
async function loadPlayerLeaderboards(container) {
    container.setAttribute("aria-busy", "true");
    try {
        const response = await fetch(assetUrl("data/player_stat_leaders_2024-25.json"));
        if (!response.ok) {
            throw new Error(`Failed to load leaderboard data (${response.status})`);
        }
        const doc = (await response.json());
        await renderPlayerLeaderboards(container, doc);
    }
    catch (error) {
        console.error("Unable to load 2024-25 player leaderboards", error);
        container.innerHTML = `<div class="player-leaderboard__status player-leaderboard__status--error">Unable to load player leaderboards right now.</div>`;
    }
    finally {
        container.setAttribute("aria-busy", "false");
    }
}
async function renderPlayerLeaderboards(container, doc) {
    container.classList.add("player-leaderboard--ready");
    container.innerHTML = "";
    const intro = document.createElement("header");
    intro.className = "player-leaderboard__intro";
    const title = document.createElement("h2");
    title.className = "player-leaderboard__title";
    title.textContent = `${doc.season || "2024-25"} Player Leaderboards`;
    const description = document.createElement("p");
    description.className = "player-leaderboard__description";
    description.textContent = "Top 10 players in core per-game stats for the 2024-25 season.";
    intro.append(title, description);
    const updated = formatLeaderboardUpdatedAt(doc.generatedAt);
    if (updated) {
        const meta = document.createElement("p");
        meta.className = "player-leaderboard__meta";
        meta.textContent = `Updated ${updated}`;
        intro.append(meta);
    }
    container.append(intro);
    const grid = document.createElement("div");
    grid.className = "player-leaderboard__grid";
    let rendered = 0;
    const cardPromises = LEADERBOARD_METRIC_ORDER.map(async (metricId, index) => {
        const metric = doc.metrics?.[metricId];
        if (!metric || !Array.isArray(metric.leaders) || metric.leaders.length === 0) {
            return null;
        }
        const fallbackColor = LEADERBOARD_COLOR_PALETTE[index % LEADERBOARD_COLOR_PALETTE.length];
        const card = await createLeaderboardCard(metricId, metric, fallbackColor, doc);
        return card;
    });
    const cards = (await Promise.all(cardPromises)).filter((card) => Boolean(card));
    cards.forEach(card => {
        grid.append(card);
        rendered += 1;
    });
    if (rendered === 0) {
        container.innerHTML = `<div class="player-leaderboard__status player-leaderboard__status--empty">Leaderboard data is not available at the moment.</div>`;
        return;
    }
    container.append(grid);
}
function getLeaderboardMinimumRequirement(metricId) {
    const requirement = LEADERBOARD_MINIMUM_REQUIREMENTS[metricId];
    if (requirement &&
        typeof requirement.value === "number" &&
        Number.isFinite(requirement.value) &&
        requirement.value >= 0 &&
        requirement.type) {
        return requirement;
    }
    return LEADERBOARD_DEFAULT_MINIMUM_REQUIREMENT;
}
function formatLeaderboardMinimumNote(requirement) {
    switch (requirement.type) {
        case "freeThrowAttempts":
            return `Minimum ${requirement.value} free throw attempts`;
        case "games":
        default:
            return `Minimum ${requirement.value} games played`;
    }
}
function formatLeaderboardMinimumEmptyState(requirement) {
    switch (requirement.type) {
        case "freeThrowAttempts":
            return `No players meet the minimum ${requirement.value} free throw attempts yet.`;
        case "games":
        default:
            return `No players meet the minimum ${requirement.value}-game requirement yet.`;
    }
}
function leaderboardEntryMeetsMinimumRequirement(entry, requirement) {
    if (requirement.value <= 0) {
        return true;
    }
    switch (requirement.type) {
        case "freeThrowAttempts": {
            const attempts = entry.attempts;
            if (typeof attempts === "number" && Number.isFinite(attempts)) {
                return attempts >= requirement.value;
            }
            return true;
        }
        case "games":
        default: {
            const games = entry.games;
            if (typeof games !== "number" || !Number.isFinite(games)) {
                return false;
            }
            return games >= requirement.value;
        }
    }
}
async function createLeaderboardCard(metricId, metric, fallbackColor, doc) {
    const presentation = LEADERBOARD_PRESENTATION[metricId];
    const accentColor = presentation?.accentColor ?? fallbackColor;
    const card = document.createElement("article");
    card.className = "player-leaderboard__card";
    card.dataset.metric = metricId;
    card.style.setProperty("--leaderboard-card-color", accentColor);
    const header = document.createElement("header");
    header.className = "player-leaderboard__card-header";
    if (presentation?.kicker) {
        const kicker = document.createElement("p");
        kicker.className = "player-leaderboard__card-kicker";
        kicker.textContent = presentation.kicker;
        header.append(kicker);
    }
    const title = document.createElement("h3");
    title.className = "player-leaderboard__card-title";
    title.textContent = presentation?.title || metric.shortLabel || metricId.toUpperCase();
    const subtitle = document.createElement("p");
    subtitle.className = "player-leaderboard__card-subtitle";
    subtitle.textContent = presentation?.description || metric.label || metric.shortLabel || metricId;
    header.append(title, subtitle);
    card.append(header);
    const minimumRequirement = getLeaderboardMinimumRequirement(metricId);
    if (minimumRequirement.value > 0) {
        const note = document.createElement("p");
        note.className = "player-leaderboard__note";
        note.textContent = formatLeaderboardMinimumNote(minimumRequirement);
        card.append(note);
    }
    const leaders = metric.leaders
        .filter(isValidLeaderboardEntry)
        .filter(leader => leaderboardEntryMeetsMinimumRequirement(leader, minimumRequirement))
        .slice(0, 10);
    if (leaders.length === 0) {
        const empty = document.createElement("p");
        empty.className = "player-leaderboard__status player-leaderboard__status--empty";
        empty.textContent =
            minimumRequirement.value > 0
                ? formatLeaderboardMinimumEmptyState(minimumRequirement)
                : "No data available.";
        card.append(empty);
        return card;
    }
    if (presentation?.stacked) {
        const stackedContent = await createStackedLeaderboardContent(metricId, leaders, doc.season, presentation.stacked);
        if (stackedContent) {
            card.append(stackedContent);
            return card;
        }
        const empty = document.createElement("p");
        empty.className = "player-leaderboard__status player-leaderboard__status--empty";
        empty.textContent = "No data available.";
        card.append(empty);
        return card;
    }
    const maxValue = leaders.reduce((max, leader) => Math.max(max, leader.value), 0);
    if (maxValue <= 0) {
        const empty = document.createElement("p");
        empty.className = "player-leaderboard__status player-leaderboard__status--empty";
        empty.textContent = "No data available.";
        card.append(empty);
        return card;
    }
    const chartContainer = document.createElement("div");
    card.append(chartContainer);
    const chartTitle = presentation?.title || metric.shortLabel || metric.label || metricId.toUpperCase();
    const chartDescription = presentation?.description ||
        `Bar chart showing the top 10 players ranked by ${metric.label || metric.shortLabel || metricId}.`;
    mountLeaderboardChart(chartContainer, leaders, {
        metricId,
        accentColor,
        yLabel: getLeaderboardAxisLabel(metricId, metric),
        title: chartTitle,
        description: chartDescription,
    });
    const list = document.createElement("ol");
    list.className = "player-leaderboard__list";
    list.setAttribute("role", "list");
    leaders.forEach((leader, index) => {
        list.append(createLeaderboardListItem(metricId, leader, index, maxValue));
    });
    card.append(list);
    return card;
}
function createLeaderboardListItem(metricId, leader, index, maxValue) {
    const item = document.createElement("li");
    item.className = "player-leaderboard__item";
    item.dataset.rank = String(index + 1);
    const ratio = maxValue > 0 ? Math.max(0, Math.min(leader.value / maxValue, 1)) : 0;
    item.style.setProperty("--leaderboard-fill", ratio.toFixed(4));
    const bar = document.createElement("div");
    bar.className = "player-leaderboard__bar";
    const barSegment = document.createElement("span");
    barSegment.className = "player-leaderboard__bar-segment player-leaderboard__bar-segment--active";
    barSegment.style.setProperty("--leaderboard-segment-color", "var(--leaderboard-card-color)");
    barSegment.style.width = `${(ratio * 100).toFixed(4)}%`;
    bar.append(barSegment);
    const rank = document.createElement("span");
    rank.className = "player-leaderboard__rank";
    rank.textContent = String(index + 1);
    const info = document.createElement("div");
    info.className = "player-leaderboard__info";
    const nameEl = document.createElement(leader.url ? "a" : "span");
    nameEl.className = "player-leaderboard__name";
    nameEl.textContent = leader.name;
    if (leader.url) {
        const link = nameEl;
        link.href = leader.url;
        link.target = "_blank";
        link.rel = "noreferrer noopener";
    }
    const team = document.createElement("span");
    team.className = "player-leaderboard__team";
    const meta = [];
    if (leader.team) {
        meta.push(leader.team);
    }
    const attempts = leader.attempts;
    if (metricId === "ftPct" && typeof attempts === "number" && Number.isFinite(attempts)) {
        meta.push(`${attempts} FTA`);
    }
    else if (typeof leader.games === "number" && Number.isFinite(leader.games)) {
        meta.push(`${leader.games} GP`);
    }
    team.textContent = meta.join(" · ");
    info.append(nameEl, team);
    const value = document.createElement("span");
    value.className = "player-leaderboard__value";
    value.textContent = formatLeaderboardValue(metricId, leader);
    item.append(bar, rank, info, value);
    return item;
}
function mountLeaderboardChart(container, leaders, options) {
    const theme = createLeaderboardChartTheme(options.accentColor);
    container.classList.add("player-leaderboard__chart");
    let surface = container.querySelector('[data-chart-surface="true"]');
    if (!surface) {
        surface = document.createElement("div");
        surface.className = "player-leaderboard__chart-surface";
        surface.dataset.chartSurface = "true";
        container.append(surface);
    }
    let tooltip = null;
    const ensureTooltip = () => {
        if (!tooltip) {
            tooltip = createTooltip(container);
        }
        return tooltip;
    };
    const margin = { top: 48, right: 32, bottom: 110, left: 68 };
    const isPercentMetric = usesPercentScale(options.metricId);
    const render = () => {
        const tooltipHandle = ensureTooltip();
        tooltipHandle.hide();
        applyTheme(container, theme);
        const width = container.clientWidth || 640;
        const height = Math.max(320, margin.top + margin.bottom + leaders.length * 28);
        surface.innerHTML = "";
        const svg = createSVG(surface, width, height, {
            title: options.title,
            description: options.description,
        });
        const plot = select(svg)
            .append("g")
            .attr("transform", `translate(${margin.left}, ${margin.top})`);
        const { iw, ih } = computeInnerSize(width, height, margin);
        const data = leaders.map(leader => ({
            x: leader.name,
            y: Math.max(0, leader.value),
            leader,
        }));
        const maxValue = data.reduce((max, datum) => Math.max(max, datum.y), 0);
        const safeMax = maxValue > 0 ? maxValue : 1;
        const paddedMax = safeMax < 1 ? safeMax * 1.05 : safeMax * 1.1;
        const scales = buildScales({
            x: {
                type: "band",
                domain: data.map(datum => datum.x),
                range: [0, iw],
                paddingInner: 0.4,
                paddingOuter: 0.2,
            },
            y: {
                type: "linear",
                domain: [0, paddedMax],
                range: [ih, 0],
                nice: true,
            },
        });
        drawGrid(plot.append("g").node(), scales, {
            innerWidth: iw,
            innerHeight: ih,
            theme,
        });
        const bars = renderBars(plot.append("g").node(), data, scales, {
            theme,
            gap: 12,
            minWidth: 16,
            cornerRadius: 4,
            baseline: 0,
            innerHeight: ih,
        });
        const formatAxis = (value) => isPercentMetric
            ? formatNumber(value, { style: "percent", digits: value < 0.5 ? 1 : 0 })
            : formatNumber(value, { digits: value >= 10 ? 0 : 1 });
        const axisGroup = plot.append("g").node();
        drawAxes(axisGroup, scales, {
            innerWidth: iw,
            innerHeight: ih,
            theme,
            xLabel: "Players",
            yLabel: options.yLabel,
            format: {
                x: value => abbreviatePlayerName(String(value ?? "")),
                y: value => formatAxis(Number(value)),
            },
        });
        const xAxis = select(axisGroup).select(".axis--x");
        xAxis
            .selectAll("text")
            .attr("transform", "rotate(-35)")
            .attr("text-anchor", "end")
            .attr("dx", "-0.6em")
            .attr("dy", "0.35em");
        const showTooltip = (target, datum) => {
            const rect = target.getBoundingClientRect();
            const parentRect = container.getBoundingClientRect();
            const x = rect.left - parentRect.left + rect.width / 2;
            const y = rect.top - parentRect.top - 12;
            tooltipHandle.show(x, y, formatLeaderboardTooltip(options.metricId, datum.leader));
        };
        const moveTooltip = (target) => {
            const rect = target.getBoundingClientRect();
            const parentRect = container.getBoundingClientRect();
            const x = rect.left - parentRect.left + rect.width / 2;
            const y = rect.top - parentRect.top - 12;
            tooltipHandle.move(x, y);
        };
        bars
            .attr("tabindex", 0)
            .attr("focusable", "true")
            .attr("aria-hidden", null)
            .attr("role", "img")
            .attr("aria-label", datum => `${datum.leader.name}: ${formatLeaderboardValue(options.metricId, datum.leader)}`)
            .on("mouseenter", function (event, datum) {
            showTooltip(this, datum);
        })
            .on("mouseleave", () => {
            tooltipHandle.hide();
        })
            .on("mousemove", function () {
            moveTooltip(this);
        })
            .on("focus", function (event, datum) {
            showTooltip(this, datum);
        })
            .on("blur", () => {
            tooltipHandle.hide();
        });
    };
    render();
    if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => {
            window.requestAnimationFrame(render);
        });
        observer.observe(container);
    }
}
function createLeaderboardChartTheme(accentColor) {
    if (!accentColor) {
        return defaultTheme;
    }
    return {
        ...defaultTheme,
        accent: accentColor,
        accentMuted: accentColor,
    };
}
function usesPercentScale(metricId) {
    return LEADERBOARD_PERCENT_METRICS.has(metricId);
}
function abbreviatePlayerName(name) {
    const trimmed = name.trim();
    if (!trimmed) {
        return name;
    }
    const parts = trimmed.split(/\s+/);
    const suffixes = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
    let last = parts[parts.length - 1];
    if (suffixes.has(last.replace(/[^a-z0-9]/gi, "").toLowerCase()) && parts.length > 2) {
        last = parts[parts.length - 2];
    }
    const first = parts[0] ?? "";
    const initial = first.charAt(0);
    if (!initial) {
        return last;
    }
    return `${initial.toUpperCase()}. ${last}`;
}
function formatLeaderboardTooltip(metricId, leader) {
    const value = formatLeaderboardValue(metricId, leader);
    const meta = [];
    if (leader.team) {
        meta.push(leader.team);
    }
    if (typeof leader.games === "number" && Number.isFinite(leader.games)) {
        meta.push(`${leader.games} GP`);
    }
    return [
        `<strong>${escapeHtml(leader.name)}</strong>`,
        escapeHtml(value),
        meta.length
            ? `<span class="player-leaderboard__tooltip-meta">${escapeHtml(meta.join(" · "))}</span>`
            : "",
    ]
        .filter(Boolean)
        .join("<br>");
}
function getLeaderboardAxisLabel(metricId, metric) {
    return (LEADERBOARD_AXIS_LABELS[metricId] ??
        metric.shortLabel ??
        metric.label ??
        LEADERBOARD_PRESENTATION[metricId]?.title ??
        metricId.toUpperCase());
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, character => {
        switch (character) {
            case "&":
                return "&amp;";
            case "<":
                return "&lt;";
            case ">":
                return "&gt;";
            case '"':
                return "&quot;";
            case "'":
                return "&#39;";
            default:
                return character;
        }
    });
}
async function createStackedLeaderboardContent(metricId, leaders, seasonLabel, config) {
    const processed = (await Promise.all(leaders.map(async (leader) => {
        const statsDoc = await ensureStatsForSlug(leader.slug);
        if (!statsDoc) {
            return null;
        }
        const season = findSeasonForLeaderboard(statsDoc, seasonLabel);
        if (!season) {
            return null;
        }
        const breakdown = {};
        let hasValue = false;
        for (const segment of config.segments) {
            const raw = season[segment.stat];
            const numeric = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
            const safeValue = numeric > 0 ? numeric : Math.max(0, numeric);
            breakdown[segment.id] = safeValue;
            if (safeValue > 0) {
                hasValue = true;
            }
        }
        const segmentSum = config.segments.reduce((sum, segment) => sum + (breakdown[segment.id] ?? 0), 0);
        const totalRaw = config.totalStat ? season[config.totalStat] : null;
        const totalCandidate = typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : segmentSum;
        const total = totalCandidate > 0 ? totalCandidate : Math.max(0, totalCandidate);
        if (!hasValue && total <= 0) {
            return null;
        }
        return {
            leader,
            breakdown,
            total,
        };
    }))).filter((entry) => Boolean(entry));
    if (processed.length === 0) {
        return null;
    }
    const container = document.createElement("div");
    container.className = "player-leaderboard__body";
    const controls = document.createElement("div");
    controls.className = "player-leaderboard__controls";
    const toggleButtons = [];
    if (config.views.length > 1) {
        const toggle = document.createElement("div");
        toggle.className = "player-leaderboard__view-toggle";
        config.views.forEach(view => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "player-leaderboard__view-button";
            button.dataset.view = view.id;
            button.textContent = view.label;
            toggle.append(button);
            toggleButtons.push(button);
        });
        controls.append(toggle);
    }
    const legend = document.createElement("ul");
    legend.className = "player-leaderboard__legend";
    const legendEntries = config.segments.map(segment => {
        const item = document.createElement("li");
        item.className = "player-leaderboard__legend-item";
        item.dataset.segment = segment.id;
        const swatch = document.createElement("span");
        swatch.className = "player-leaderboard__legend-swatch";
        swatch.style.setProperty("--leaderboard-legend-color", segment.color);
        const label = document.createElement("span");
        label.className = "player-leaderboard__legend-label";
        label.textContent = segment.label;
        item.append(swatch, label);
        legend.append(item);
        return { id: segment.id, element: item };
    });
    controls.append(legend);
    const list = document.createElement("ol");
    list.className = "player-leaderboard__list";
    list.setAttribute("role", "list");
    const items = processed.map((entry, index) => {
        const item = document.createElement("li");
        item.className = "player-leaderboard__item";
        item.dataset.rank = String(index + 1);
        const bar = document.createElement("div");
        bar.className = "player-leaderboard__bar";
        const segmentElements = new Map();
        config.segments.forEach(segment => {
            const segEl = document.createElement("span");
            segEl.className = "player-leaderboard__bar-segment";
            segEl.style.setProperty("--leaderboard-segment-color", segment.color);
            bar.append(segEl);
            segmentElements.set(segment.id, segEl);
        });
        const rank = document.createElement("span");
        rank.className = "player-leaderboard__rank";
        rank.textContent = String(index + 1);
        const info = document.createElement("div");
        info.className = "player-leaderboard__info";
        const nameEl = document.createElement(entry.leader.url ? "a" : "span");
        nameEl.className = "player-leaderboard__name";
        nameEl.textContent = entry.leader.name;
        if (entry.leader.url) {
            const link = nameEl;
            link.href = entry.leader.url;
            link.target = "_blank";
            link.rel = "noreferrer noopener";
        }
        const team = document.createElement("span");
        team.className = "player-leaderboard__team";
        const meta = [];
        if (entry.leader.team) {
            meta.push(entry.leader.team);
        }
        if (typeof entry.leader.games === "number" && Number.isFinite(entry.leader.games)) {
            meta.push(`${entry.leader.games} GP`);
        }
        team.textContent = meta.join(" · ");
        info.append(nameEl, team);
        const valueEl = document.createElement("span");
        valueEl.className = "player-leaderboard__value";
        valueEl.textContent = "—";
        item.append(bar, rank, info, valueEl);
        list.append(item);
        return { entry, element: item, valueEl, segmentElements };
    });
    container.append(controls, list);
    const initialView = config.views.find(view => view.id === config.defaultView) ?? config.views[0];
    if (!initialView) {
        return container;
    }
    function updateView(viewId) {
        const view = config.views.find(v => v.id === viewId) ?? initialView;
        const computations = processed.map(entry => computeStackedView(entry, view));
        const maxValue = computations.reduce((max, current) => Math.max(max, current.baseValue), 0);
        items.forEach((itemState, index) => {
            const computation = computations[index];
            const baseValue = Number.isFinite(computation.baseValue)
                ? Math.max(0, computation.baseValue)
                : 0;
            const ratio = maxValue > 0 ? Math.max(0, Math.min(baseValue / maxValue, 1)) : 0;
            itemState.element.style.setProperty("--leaderboard-fill", ratio.toFixed(4));
            itemState.valueEl.textContent = formatDecimal(baseValue, 1);
            config.segments.forEach(segment => {
                const segmentEl = itemState.segmentElements.get(segment.id);
                if (!segmentEl) {
                    return;
                }
                const segmentData = computation.segments.find(seg => seg.id === segment.id);
                const isActive = Boolean(segmentData && view.segmentIds.includes(segment.id) && segmentData.value > 0);
                const width = segmentData && maxValue > 0
                    ? Math.max(0, Math.min(segmentData.value / maxValue, 1)) * 100
                    : 0;
                segmentEl.style.width = `${width.toFixed(4)}%`;
                segmentEl.classList.toggle("player-leaderboard__bar-segment--hidden", !view.segmentIds.includes(segment.id));
                segmentEl.classList.toggle("player-leaderboard__bar-segment--active", isActive);
            });
        });
        toggleButtons.forEach(button => {
            button.classList.toggle("is-active", button.dataset.view === view.id);
        });
        legendEntries.forEach(entry => {
            entry.element.classList.toggle("is-active", view.segmentIds.includes(entry.id));
        });
    }
    if (toggleButtons.length > 0) {
        toggleButtons.forEach(button => {
            button.addEventListener("click", () => {
                const viewId = button.dataset.view;
                if (viewId) {
                    updateView(viewId);
                }
            });
        });
    }
    updateView(initialView.id);
    return container;
}
function computeStackedView(entry, view) {
    const activeSegments = view.segmentIds.map(id => ({
        id,
        raw: Math.max(0, entry.breakdown[id] ?? 0),
    }));
    const rawSum = activeSegments.reduce((sum, segment) => sum + segment.raw, 0);
    const baseCandidate = view.useTotal ? entry.total : rawSum;
    const baseValue = Number.isFinite(baseCandidate)
        ? Math.max(0, baseCandidate)
        : Math.max(0, rawSum);
    const denominator = rawSum > 0 ? rawSum : baseValue;
    const scale = view.useTotal && denominator > 0 ? baseValue / denominator : 1;
    const segments = activeSegments.map(segment => ({
        id: segment.id,
        value: Math.max(0, segment.raw * scale),
    }));
    return { baseValue, segments };
}
function findSeasonForLeaderboard(doc, seasonLabel) {
    if (!doc || !Array.isArray(doc.seasons) || doc.seasons.length === 0) {
        return null;
    }
    if (seasonLabel) {
        const match = doc.seasons.find(season => season.season === seasonLabel);
        if (match) {
            return match;
        }
    }
    return doc.seasons[doc.seasons.length - 1] ?? null;
}
function isValidLeaderboardEntry(entry) {
    return Boolean(entry && typeof entry.value === "number" && Number.isFinite(entry.value));
}
function formatLeaderboardValue(metricId, entry) {
    if (entry.valueFormatted) {
        return entry.valueFormatted;
    }
    const value = entry.value;
    if (!Number.isFinite(value)) {
        return "—";
    }
    switch (metricId) {
        case "fgPct":
        case "fg3Pct":
        case "ftPct":
            return formatPercentValue(value);
        default:
            return formatDecimal(value, 1);
    }
}
function formatLeaderboardUpdatedAt(value) {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}
function normaliseName(value) {
    return value
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
        .replace(/[^a-z0-9]/g, "");
}
function normaliseTeam(value) {
    return value
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/men's|mens|women's|womens/gi, "")
        .replace(/\b(men|women|basketball)\b/gi, "")
        .replace(/[^a-z0-9]/g, "");
}
function seasonLabelToYear(label) {
    const match = label.match(/(\d{4})/);
    if (!match)
        return 0;
    const start = Number.parseInt(match[1], 10);
    if (!Number.isFinite(start))
        return 0;
    return start + 1;
}
function buildSearchIndex(team, group) {
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
function applyFilter(query) {
    const q = query.trim().toLowerCase();
    let visibleConferences = 0;
    for (const conference of conferenceElements) {
        const teams = conference.querySelectorAll(".roster-team");
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
        }
        else {
            conference.open = false;
        }
    }
    emptyState.hidden = visibleConferences > 0;
}
searchInput.addEventListener("input", () => {
    applyFilter(searchInput.value);
});
applyFilter("");
