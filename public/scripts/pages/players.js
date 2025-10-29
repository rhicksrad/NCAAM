import { NCAAM } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
function deriveInitials(team) {
    if (team.abbreviation) {
        const trimmed = team.abbreviation.replace(/[^0-9A-Za-z]/g, "");
        if (trimmed) {
            return trimmed.slice(0, 3).toUpperCase();
        }
    }
    const source = team.full_name ?? team.college ?? team.name;
    if (!source)
        return "NCAAM";
    const words = source
        .replace(/[^0-9A-Za-z\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0) {
        const fallback = source.replace(/[^0-9A-Za-z]/g, "");
        return fallback.slice(0, 3).toUpperCase() || "NCAAM";
    }
    const initials = [];
    for (const word of words) {
        initials.push(word[0]);
        if (initials.length === 3)
            break;
    }
    return initials.join("").toUpperCase();
}
function computeHue(team) {
    const basis = `${team.id}:${team.full_name ?? team.name ?? ""}`;
    let hash = 0;
    for (let i = 0; i < basis.length; i += 1) {
        hash = (hash * 31 + basis.charCodeAt(i)) % 360;
    }
    return hash;
}
function getAccentColors(team) {
    const hue = computeHue(team);
    const primary = `hsl(${hue}, 70%, 48%)`;
    const secondary = `hsl(${(hue + 35) % 360}, 72%, 40%)`;
    return [primary, secondary];
}
function decorateAvatar(el, team) {
    const [primary, secondary] = getAccentColors(team);
    el.textContent = deriveInitials(team);
    el.style.setProperty("--team-accent", primary);
    el.style.setProperty("--team-accent-secondary", secondary);
}
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
const [conferenceMap, teamsResponse] = await Promise.all([
    getConferenceMap(),
    NCAAM.teams(1, 400),
]);
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
    logo.setAttribute("aria-hidden", "true");
    logo.setAttribute("role", "presentation");
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
    const list = document.createElement("div");
    list.className = "roster-grid";
    const sorted = [...players].sort((a, b) => {
        const last = a.last_name.localeCompare(b.last_name, "en", { sensitivity: "base" });
        if (last !== 0)
            return last;
        return a.first_name.localeCompare(b.first_name, "en", { sensitivity: "base" });
    });
    for (const player of sorted) {
        list.append(renderPlayerCard(player));
    }
    container.innerHTML = "";
    container.append(list);
}
function renderPlayerCard(player) {
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
    card.append(header, meta);
    return card;
}
function createMetaRow(label, value) {
    const row = document.createElement("div");
    row.className = "player-card__meta-row";
    row.innerHTML = `<dt>${label}</dt><dd>${value}</dd>`;
    return row;
}
function formatJersey(value) {
    if (!value)
        return "—";
    const trimmed = value.trim();
    return trimmed ? `#${trimmed.replace(/^#/, "")}` : "—";
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
