import { buildRosterPlayers, loadPlayerIndexDocument } from "./data.js";
import { formatDecimal, formatInteger, formatPercent } from "./format.js";
const ROSTER_COLUMNS = [
    { key: "gp", label: "GP", formatter: (value) => formatInteger(value) },
    { key: "mp_g", label: "MIN", formatter: (value) => formatDecimal(value, 1) },
    { key: "pts_g", label: "PTS", formatter: (value) => formatDecimal(value, 1) },
    { key: "trb_g", label: "REB", formatter: (value) => formatDecimal(value, 1) },
    { key: "ast_g", label: "AST", formatter: (value) => formatDecimal(value, 1) },
    { key: "stl_g", label: "STL", formatter: (value) => formatDecimal(value, 1) },
    { key: "blk_g", label: "BLK", formatter: (value) => formatDecimal(value, 1) },
    { key: "fg_pct", label: "FG%", formatter: (value) => formatPercent(value) },
    { key: "fg3_pct", label: "3P%", formatter: (value) => formatPercent(value) },
    { key: "ft_pct", label: "FT%", formatter: (value) => formatPercent(value) },
];
export async function renderConferenceDirectory(container, intro) {
    container.innerHTML = `<p class="conference-panel__loading">Loading conferences…</p>`;
    try {
        const index = await loadPlayerIndexDocument();
        const players = (index.players ?? []).filter((player) => player.conference && player.team);
        if (!players.length) {
            container.innerHTML = `<p class="conference-panel__message">No conference roster data is available right now.</p>`;
            return;
        }
        const groups = buildConferenceGroups(players);
        const uniqueTeams = new Set(players.map((player) => `${player.conference}::${player.team}`));
        if (intro) {
            const season = index.seasons?.[0] ?? players[0]?.season ?? "current season";
            intro.textContent = `${groups.length} conferences, ${uniqueTeams.size} teams, ${players.length} players tracked for ${season}.`;
        }
        container.innerHTML = "";
        groups.forEach((group) => {
            container.appendChild(createConferencePanel(group));
        });
    }
    catch (error) {
        console.error(error);
        container.innerHTML = `<p class="conference-panel__message conference-panel__message--error">We couldn't reach the roster index. Please refresh to try again.</p>`;
    }
}
function buildConferenceGroups(entries) {
    const map = new Map();
    for (const entry of entries) {
        const conference = entry.conference;
        const team = entry.team;
        if (!conference || !team)
            continue;
        if (!map.has(conference)) {
            map.set(conference, new Map());
        }
        const teamMap = map.get(conference);
        if (!teamMap.has(team)) {
            teamMap.set(team, []);
        }
        teamMap.get(team).push(entry);
    }
    const groups = [];
    for (const [name, teams] of map.entries()) {
        let totalPlayers = 0;
        for (const roster of teams.values()) {
            totalPlayers += roster.length;
        }
        groups.push({ name, teams, totalPlayers });
    }
    groups.sort((a, b) => a.name.localeCompare(b.name));
    return groups;
}
function createConferencePanel(group) {
    const details = document.createElement("details");
    details.className = "conference-panel card";
    const summary = document.createElement("summary");
    summary.className = "conference-panel__summary";
    summary.innerHTML = `
    <div class="conference-panel__summary-content">
      <h3 class="conference-panel__title">${group.name}</h3>
      <p class="conference-panel__meta">${group.teams.size} teams · ${group.totalPlayers} players</p>
    </div>
    <span class="conference-panel__chevron" aria-hidden="true"></span>
  `;
    const body = document.createElement("div");
    body.className = "conference-panel__body";
    body.innerHTML = `<p class="conference-panel__placeholder">Open to load rosters…</p>`;
    details.append(summary, body);
    let loader = null;
    details.addEventListener("toggle", () => {
        if (!details.open || details.dataset.loaded === "true")
            return;
        if (!loader) {
            loader = hydrateConferenceBody(body, group)
                .then(() => {
                details.dataset.loaded = "true";
            })
                .catch((error) => {
                console.error(error);
                body.innerHTML = `<p class="conference-panel__placeholder conference-panel__placeholder--error">Unable to load rosters for ${group.name}. Please try again later.</p>`;
            })
                .finally(() => {
                loader = null;
            });
        }
    });
    return details;
}
async function hydrateConferenceBody(container, group) {
    container.innerHTML = "";
    const teams = [...group.teams.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [teamName, rosterEntries] of teams) {
        const roster = await buildRosterPlayers(rosterEntries);
        container.appendChild(renderTeamRoster(teamName, roster));
    }
}
function renderTeamRoster(teamName, roster) {
    const card = document.createElement("article");
    card.className = "team-roster";
    const header = document.createElement("header");
    header.className = "team-roster__head";
    header.innerHTML = `
    <div class="team-roster__labels">
      <h4 class="team-roster__title">${teamName}</h4>
      <p class="team-roster__meta">${roster.length} players</p>
    </div>
  `;
    const table = document.createElement("div");
    table.className = "team-roster__table";
    table.appendChild(createRosterHeader());
    const list = document.createElement("ul");
    list.className = "team-roster__list";
    list.setAttribute("aria-label", `${teamName} roster`);
    if (!roster.length) {
        const empty = document.createElement("li");
        empty.className = "team-roster__row team-roster__row--empty";
        empty.textContent = "Roster data is not available.";
        list.appendChild(empty);
    }
    else {
        roster.forEach((player) => list.appendChild(createRosterRow(player)));
    }
    table.appendChild(list);
    card.append(header, table);
    return card;
}
function createRosterHeader() {
    const header = document.createElement("div");
    header.className = "team-roster__row team-roster__row--header";
    const name = document.createElement("span");
    name.textContent = "Player";
    header.appendChild(name);
    ROSTER_COLUMNS.forEach((column) => {
        const span = document.createElement("span");
        span.textContent = column.label;
        header.appendChild(span);
    });
    return header;
}
function createRosterRow(player) {
    const row = document.createElement("li");
    row.className = "team-roster__row";
    row.dataset.player = player.entry.slug;
    const nameCell = document.createElement("span");
    nameCell.className = "team-roster__name";
    if (player.entry.url) {
        const link = document.createElement("a");
        link.href = player.entry.url;
        link.target = "_blank";
        link.rel = "noreferrer noopener";
        link.textContent = player.entry.name;
        nameCell.appendChild(link);
    }
    else {
        nameCell.textContent = player.entry.name;
    }
    const team = document.createElement("span");
    team.className = "team-roster__team";
    team.textContent = player.entry.team;
    nameCell.appendChild(team);
    row.appendChild(nameCell);
    ROSTER_COLUMNS.forEach((column) => {
        const cell = document.createElement("span");
        cell.className = "team-roster__stat";
        cell.dataset.stat = column.label;
        const stats = player.stats;
        const value = stats ? stats[column.key] : null;
        cell.textContent = column.formatter(value ?? null);
        row.appendChild(cell);
    });
    return row;
}
