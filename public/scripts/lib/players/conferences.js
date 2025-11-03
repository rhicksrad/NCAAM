import { formatDecimal, formatInteger, formatPercent } from "./format.js";
import { loadRosterDirectory, loadTeamRosterPlayers, } from "./roster-directory.js";
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
        const directory = await loadRosterDirectory();
        const groups = directory.conferences ?? [];
        const totalTeams = directory.totals?.teams ?? 0;
        if (!groups.length) {
            container.innerHTML = `<p class="conference-panel__message">No conference roster data is available right now.</p>`;
            return;
        }
        if (intro) {
            const season = directory.season ?? "current season";
            const pieces = [`${groups.length} conferences`, `${totalTeams} teams`];
            if (directory.totals?.players != null) {
                pieces.push(`${directory.totals.players} players`);
            }
            intro.textContent = `${pieces.join(", ")} tracked for ${season}.`;
        }
        container.innerHTML = "";
        groups.forEach((group) => {
            container.appendChild(createConferencePanel(group, directory.season));
        });
    }
    catch (error) {
        console.error(error);
        container.innerHTML = `<p class="conference-panel__message conference-panel__message--error">We couldn't reach the roster index. Please refresh to try again.</p>`;
    }
}
function createConferencePanel(group, season) {
    const details = document.createElement("details");
    details.className = "conference-panel card";
    const summary = document.createElement("summary");
    summary.className = "conference-panel__summary";
    const summaryContent = document.createElement("div");
    summaryContent.className = "conference-panel__summary-content";
    const title = document.createElement("h3");
    title.className = "conference-panel__title";
    title.textContent = group.name;
    const meta = document.createElement("p");
    meta.className = "conference-panel__meta";
    meta.textContent = `${group.teams.length} teams${group.totalPlayers != null ? ` · ${group.totalPlayers} players` : ""}`;
    summaryContent.append(title, meta);
    const chevron = document.createElement("span");
    chevron.className = "conference-panel__chevron";
    chevron.setAttribute("aria-hidden", "true");
    summary.append(summaryContent, chevron);
    const body = document.createElement("div");
    body.className = "conference-panel__body";
    body.innerHTML = `<p class="conference-panel__placeholder">Open to load rosters…</p>`;
    details.append(summary, body);
    let loader = null;
    details.addEventListener("toggle", () => {
        if (!details.open || details.dataset.loaded === "true")
            return;
        if (!loader) {
            loader = hydrateConferenceBody(body, group.teams, season)
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
async function hydrateConferenceBody(container, teams, season) {
    container.innerHTML = "";
    if (!teams.length) {
        container.innerHTML = `<p class="conference-panel__placeholder">Roster data is not available.</p>`;
        return;
    }
    teams.forEach((team) => {
        container.appendChild(renderTeamRoster(team, season));
    });
}
function renderTeamRoster(team, season) {
    const details = document.createElement("details");
    details.className = "team-roster";
    const summary = document.createElement("summary");
    summary.className = "team-roster__summary";
    const labelContainer = document.createElement("div");
    labelContainer.className = "team-roster__labels";
    const title = document.createElement("h4");
    title.className = "team-roster__title";
    title.textContent = team.fullName;
    const meta = document.createElement("p");
    meta.className = "team-roster__meta";
    meta.textContent = "Open to load roster";
    labelContainer.append(title, meta);
    const chevron = document.createElement("span");
    chevron.className = "team-roster__chevron";
    chevron.setAttribute("aria-hidden", "true");
    summary.append(labelContainer, chevron);
    const body = document.createElement("div");
    body.className = "team-roster__body";
    body.innerHTML = `<p class="conference-panel__placeholder">Open to load roster…</p>`;
    details.append(summary, body);
    let loader = null;
    details.addEventListener("toggle", () => {
        if (!details.open || details.dataset.loaded === "true")
            return;
        if (!loader) {
            body.innerHTML = `<p class="conference-panel__placeholder">Loading roster…</p>`;
            loader = loadTeamRosterPlayers(team, season)
                .then((players) => {
                const table = renderRosterTable(team, players);
                body.innerHTML = "";
                body.appendChild(table);
                meta.textContent = `${players.length} players`;
                details.dataset.loaded = "true";
            })
                .catch((error) => {
                console.error(error);
                body.innerHTML = `<p class="conference-panel__placeholder conference-panel__placeholder--error">Unable to load roster for ${team.fullName}. Please try again later.</p>`;
            })
                .finally(() => {
                loader = null;
            });
        }
    });
    return details;
}
function renderRosterTable(team, players) {
    const table = document.createElement("div");
    table.className = "team-roster__table";
    table.appendChild(createRosterHeader());
    const list = document.createElement("ul");
    list.className = "team-roster__list";
    list.setAttribute("aria-label", `${team.fullName} roster`);
    if (!players.length) {
        const empty = document.createElement("li");
        empty.className = "team-roster__row team-roster__row--empty";
        empty.textContent = "Roster data is not available.";
        list.appendChild(empty);
    }
    else {
        players.forEach((player) => list.appendChild(createRosterRow(player)));
    }
    table.appendChild(list);
    return table;
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
function buildPlayerMeta(player) {
    const parts = [
        player.position?.trim() || null,
        player.jersey ? `#${player.jersey}` : null,
        player.height?.trim() || null,
        player.weight?.trim() || null,
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : null;
}
function createRosterRow(player) {
    const row = document.createElement("li");
    row.className = "team-roster__row";
    row.dataset.player = player.id;
    const nameCell = document.createElement("span");
    nameCell.className = "team-roster__name";
    nameCell.textContent = player.name;
    const meta = buildPlayerMeta(player);
    if (meta) {
        const metaEl = document.createElement("span");
        metaEl.className = "team-roster__team";
        metaEl.textContent = meta;
        nameCell.appendChild(metaEl);
    }
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
