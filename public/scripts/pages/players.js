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
const LEADERBOARD_DEFAULT_MINIMUM_SAMPLE_SIZE = 10;
const LEADERBOARD_MINIMUM_SAMPLE_SIZE = {
    mp: 12,
    fgPct: 15,
    fg3Pct: 15,
    ftPct: 15,
    rebounds: 12,
    assists: 12,
    stocks: 12,
    turnovers: 12,
    points: 12,
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
  <input class="search" placeholder="Search by team or conference" aria-label="Filter teams">
  <div id="roster-groups" class="conference-groups roster-groups" aria-live="polite"></div>
  <p id="roster-empty" class="empty-state" hidden>No teams match your search.</p>
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
const assetUrl = (path) => {
    const base = typeof document !== "undefined" ? document.baseURI : undefined;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const root = base ?? origin ?? "";
    const normalisedPath = path.startsWith("/") ? path.slice(1) : path;
    return new URL(normalisedPath, root).toString();
};
void loadPlayerLeaderboards(leaderboardSectionEl);
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
        renderPlayerLeaderboards(container, doc);
    }
    catch (error) {
        console.error("Unable to load 2024-25 player leaderboards", error);
        container.innerHTML = `<div class="player-leaderboard__status player-leaderboard__status--error">Unable to load player leaderboards right now.</div>`;
    }
    finally {
        container.setAttribute("aria-busy", "false");
    }
}
function renderPlayerLeaderboards(container, doc) {
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
    LEADERBOARD_METRIC_ORDER.forEach((metricId, index) => {
        const metric = doc.metrics?.[metricId];
        if (!metric || !Array.isArray(metric.leaders) || metric.leaders.length === 0) {
            return;
        }
        const color = LEADERBOARD_COLOR_PALETTE[index % LEADERBOARD_COLOR_PALETTE.length];
        const card = createLeaderboardCard(metricId, metric, color);
        grid.append(card);
        rendered += 1;
    });
    if (rendered === 0) {
        container.innerHTML = `<div class="player-leaderboard__status player-leaderboard__status--empty">Leaderboard data is not available at the moment.</div>`;
        return;
    }
    container.append(grid);
}
function getLeaderboardMinimumSample(metricId) {
    const raw = LEADERBOARD_MINIMUM_SAMPLE_SIZE[metricId];
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
        return raw;
    }
    return LEADERBOARD_DEFAULT_MINIMUM_SAMPLE_SIZE;
}
function leaderboardEntryMeetsMinimumSample(entry, minimumGames) {
    if (minimumGames <= 0) {
        return true;
    }
    const games = entry.games;
    if (typeof games !== "number" || !Number.isFinite(games)) {
        return false;
    }
    return games >= minimumGames;
}
function createLeaderboardCard(metricId, metric, accentColor) {
    const card = document.createElement("article");
    card.className = "player-leaderboard__card";
    card.style.setProperty("--leaderboard-card-color", accentColor);
    const header = document.createElement("header");
    header.className = "player-leaderboard__card-header";
    const title = document.createElement("h3");
    title.className = "player-leaderboard__card-title";
    title.textContent = metric.shortLabel || metricId.toUpperCase();
    const subtitle = document.createElement("p");
    subtitle.className = "player-leaderboard__card-subtitle";
    subtitle.textContent = metric.label || metric.shortLabel || metricId;
    header.append(title, subtitle);
    card.append(header);
    const minimumGames = getLeaderboardMinimumSample(metricId);
    if (minimumGames > 0) {
        const note = document.createElement("p");
        note.className = "player-leaderboard__note";
        note.textContent = `Minimum ${minimumGames} games played`;
        card.append(note);
    }
    const leaders = metric.leaders
        .filter(isValidLeaderboardEntry)
        .filter(leader => leaderboardEntryMeetsMinimumSample(leader, minimumGames))
        .slice(0, 10);
    if (leaders.length === 0) {
        const empty = document.createElement("p");
        empty.className = "player-leaderboard__status player-leaderboard__status--empty";
        empty.textContent =
            minimumGames > 0
                ? `No players meet the minimum ${minimumGames}-game requirement yet.`
                : "No data available.";
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
    if (typeof leader.games === "number" && Number.isFinite(leader.games)) {
        meta.push(`${leader.games} GP`);
    }
    team.textContent = meta.join(" · ");
    info.append(nameEl, team);
    const value = document.createElement("span");
    value.className = "player-leaderboard__value";
    value.textContent = formatLeaderboardValue(metricId, leader);
    item.append(rank, info, value);
    return item;
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
