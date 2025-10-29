import { NCAAM } from "../lib/sdk/ncaam.js";
import { NCAA_LOGO_ALIASES, NCAA_LOGO_INDEX } from "../lib/data/ncaa-logo-map.js";
const STOPWORDS = new Set(["and", "of", "the", "university", "college", "for", "at", "in"]);
const app = document.getElementById("app");
if (!app) {
    throw new Error("Missing #app container");
}
app.innerHTML = `
  <section class="players-page">
    <header class="players-page__header">
      <h1 class="players-page__title">Active Players</h1>
      <p class="players-page__intro">Browse live Division I rosters by conference and drill into any team to see every active player.</p>
    </header>
    <div class="players-page__status" data-status></div>
    <div class="players-page__list" data-conference-list hidden></div>
  </section>
`;
const statusTarget = app.querySelector("[data-status]");
if (!statusTarget) {
    throw new Error("Players page layout failed to initialize");
}
const listTarget = app.querySelector("[data-conference-list]");
if (!listTarget) {
    throw new Error("Players page layout failed to initialize");
}
const statusEl = statusTarget;
const listEl = listTarget;
statusEl.setAttribute("aria-live", "polite");
listEl.setAttribute("hidden", "");
const conferenceStates = new Map();
let conferencesLoading = false;
void loadConferences();
async function loadConferences() {
    if (conferencesLoading) {
        return;
    }
    conferencesLoading = true;
    showPageStatus("loading", "Loading conferences…");
    listEl.setAttribute("hidden", "");
    listEl.innerHTML = "";
    conferenceStates.clear();
    try {
        const { data } = await NCAAM.conferences();
        if (!data.length) {
            showPageStatus("empty", "No conferences are available right now.");
            return;
        }
        hidePageStatus();
        renderConferences(data);
    }
    catch (error) {
        const message = describeError(error, "Unable to load conferences. Please try again.");
        showPageStatus("error", message, { retry: true });
    }
    finally {
        conferencesLoading = false;
    }
}
function renderConferences(conferences) {
    const sorted = [...conferences].sort((a, b) => a.name.localeCompare(b.name));
    const fragment = document.createDocumentFragment();
    for (const conference of sorted) {
        const state = createConferenceState(conference);
        conferenceStates.set(conference.id, state);
        fragment.appendChild(state.detailsEl);
    }
    listEl.removeAttribute("hidden");
    listEl.appendChild(fragment);
}
function createConferenceState(conference) {
    const details = document.createElement("details");
    details.className = "players-conference";
    details.dataset.conferenceId = String(conference.id);
    const summary = document.createElement("summary");
    summary.className = "players-conference__summary";
    const titleWrap = document.createElement("div");
    titleWrap.className = "players-conference__heading";
    const title = document.createElement("span");
    title.className = "players-conference__name";
    title.textContent = conference.name;
    titleWrap.appendChild(title);
    if (conference.short_name && conference.short_name !== conference.name) {
        const short = document.createElement("span");
        short.className = "players-conference__badge";
        short.textContent = conference.short_name;
        titleWrap.appendChild(short);
    }
    const count = document.createElement("span");
    count.className = "players-conference__count";
    count.textContent = "Tap to load teams";
    summary.appendChild(titleWrap);
    summary.appendChild(count);
    details.appendChild(summary);
    const content = document.createElement("div");
    content.className = "players-conference__content";
    content.appendChild(createStatusElement("Open the conference to load its teams.", "hint"));
    details.appendChild(content);
    const state = {
        conference,
        detailsEl: details,
        contentEl: content,
        countEl: count,
        teams: [],
        loadingTeams: false,
        loadedTeams: false,
        error: null,
    };
    details.addEventListener("toggle", () => {
        if (details.open) {
            void ensureConferenceTeams(state);
        }
    });
    return state;
}
async function ensureConferenceTeams(state) {
    if (state.loadingTeams || state.loadedTeams) {
        return;
    }
    state.loadingTeams = true;
    state.error = null;
    renderConferenceState(state);
    try {
        const teams = await fetchConferenceTeams(state.conference.id);
        state.teams = teams.map(team => createTeamState(team, state));
        state.loadedTeams = true;
    }
    catch (error) {
        state.error = describeError(error, "Unable to load teams for this conference.");
    }
    finally {
        state.loadingTeams = false;
        renderConferenceState(state);
    }
}
function renderConferenceState(state) {
    const content = state.contentEl;
    content.innerHTML = "";
    if (state.loadingTeams) {
        state.countEl.textContent = "Loading…";
        content.appendChild(createStatusElement("Loading teams…", "loading"));
        return;
    }
    if (state.error) {
        state.countEl.textContent = "Retry";
        const status = createStatusElement(state.error, "error");
        const button = createActionButton("Retry", () => {
            state.error = null;
            void ensureConferenceTeams(state);
        });
        status.appendChild(button);
        content.appendChild(status);
        return;
    }
    if (!state.loadedTeams) {
        state.countEl.textContent = "Tap to load teams";
        content.appendChild(createStatusElement("Open the conference to load its teams.", "hint"));
        return;
    }
    if (!state.teams.length) {
        state.countEl.textContent = "0 teams";
        content.appendChild(createStatusElement("No teams found for this conference.", "empty"));
        return;
    }
    state.countEl.textContent = `${state.teams.length} ${state.teams.length === 1 ? "team" : "teams"}`;
    const container = document.createElement("div");
    container.className = "players-conference__teams";
    for (const teamState of state.teams) {
        container.appendChild(teamState.detailsEl);
    }
    content.appendChild(container);
}
function createTeamState(team, conference) {
    const details = document.createElement("details");
    details.className = "players-team";
    details.dataset.teamId = String(team.id);
    const summary = document.createElement("summary");
    summary.className = "players-team__summary";
    const identity = document.createElement("div");
    identity.className = "players-team__identity";
    const logo = document.createElement("img");
    logo.className = "players-team__logo";
    logo.alt = `${team.full_name ?? team.name} logo`;
    logo.loading = "lazy";
    const logoPath = findTeamLogo(team);
    if (logoPath) {
        logo.src = logoPath;
    }
    else {
        logo.src = "/assets/logos/ncaam-mark.svg";
        logo.classList.add("players-team__logo--fallback");
    }
    logo.addEventListener("error", () => {
        if (logo.src.endsWith("ncaam-mark.svg")) {
            return;
        }
        logo.src = "/assets/logos/ncaam-mark.svg";
        logo.classList.add("players-team__logo--fallback");
    });
    identity.appendChild(logo);
    const textWrap = document.createElement("div");
    textWrap.className = "players-team__text";
    const name = document.createElement("span");
    name.className = "players-team__name";
    name.textContent = team.full_name ?? team.name;
    textWrap.appendChild(name);
    const meta = document.createElement("span");
    meta.className = "players-team__meta";
    const metaParts = [team.college, team.abbreviation].filter(Boolean);
    meta.textContent = metaParts.join(" • ");
    textWrap.appendChild(meta);
    identity.appendChild(textWrap);
    const count = document.createElement("span");
    count.className = "players-team__count";
    count.textContent = "Tap to load roster";
    summary.appendChild(identity);
    summary.appendChild(count);
    details.appendChild(summary);
    const body = document.createElement("div");
    body.className = "players-team__body";
    details.appendChild(body);
    const state = {
        team,
        conference,
        detailsEl: details,
        bodyEl: body,
        countEl: count,
        logoPath,
        players: [],
        loading: false,
        loaded: false,
        error: null,
    };
    renderTeamState(state);
    details.addEventListener("toggle", () => {
        if (details.open) {
            void loadTeamRoster(state);
        }
    });
    return state;
}
async function loadTeamRoster(state, force = false) {
    if (state.loading) {
        return;
    }
    if (state.loaded && !force) {
        return;
    }
    state.loading = true;
    state.error = null;
    renderTeamState(state);
    try {
        const players = await fetchTeamRoster(state.team.id);
        state.players = players;
        state.loaded = true;
    }
    catch (error) {
        state.error = describeError(error, "Unable to load this roster. Please try again.");
        state.loaded = false;
    }
    finally {
        state.loading = false;
        renderTeamState(state);
    }
}
function renderTeamState(state) {
    const { bodyEl, countEl } = state;
    bodyEl.innerHTML = "";
    if (state.loading) {
        countEl.textContent = "Loading…";
        bodyEl.appendChild(createStatusElement("Loading active roster…", "loading"));
        return;
    }
    if (state.error) {
        countEl.textContent = "Retry";
        const status = createStatusElement(state.error, "error");
        const button = createActionButton("Retry", () => {
            void loadTeamRoster(state, true);
        });
        status.appendChild(button);
        bodyEl.appendChild(status);
        return;
    }
    if (!state.loaded) {
        countEl.textContent = "Tap to load roster";
        bodyEl.appendChild(createStatusElement("Open this team to load the active roster.", "hint"));
        return;
    }
    if (!state.players.length) {
        countEl.textContent = "No active players";
        bodyEl.appendChild(createStatusElement("No active players are listed for this team.", "empty"));
        return;
    }
    countEl.textContent = `${state.players.length} ${state.players.length === 1 ? "player" : "players"}`;
    const grid = document.createElement("div");
    grid.className = "players-team__grid";
    for (const player of state.players) {
        grid.appendChild(buildPlayerCard(player));
    }
    bodyEl.appendChild(grid);
}
function buildPlayerCard(player) {
    const card = document.createElement("article");
    card.className = "player-card";
    const header = document.createElement("header");
    header.className = "player-card__header";
    const name = document.createElement("h3");
    name.className = "player-card__name";
    const nameText = `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim() || "Unnamed Player";
    name.textContent = nameText;
    header.appendChild(name);
    const tags = document.createElement("div");
    tags.className = "player-card__tags";
    if (player.position) {
        const positionTag = document.createElement("span");
        positionTag.className = "player-card__tag";
        positionTag.textContent = player.position;
        tags.appendChild(positionTag);
    }
    if (player.jersey_number) {
        const jerseyTag = document.createElement("span");
        jerseyTag.className = "player-card__tag";
        jerseyTag.textContent = `#${player.jersey_number}`;
        tags.appendChild(jerseyTag);
    }
    if (tags.childElementCount) {
        header.appendChild(tags);
    }
    card.appendChild(header);
    const meta = document.createElement("dl");
    meta.className = "player-card__meta";
    appendMeta(meta, "Team", player.team?.full_name ?? player.team?.college ?? null);
    appendMeta(meta, "Height", player.height ?? null);
    appendMeta(meta, "Weight", player.weight ?? null);
    if (meta.childElementCount) {
        card.appendChild(meta);
    }
    return card;
}
function appendMeta(meta, label, value) {
    if (!value) {
        return;
    }
    const item = document.createElement("div");
    item.className = "player-card__meta-item";
    const term = document.createElement("dt");
    term.className = "player-card__meta-label";
    term.textContent = label;
    const desc = document.createElement("dd");
    desc.className = "player-card__meta-value";
    desc.textContent = value;
    item.appendChild(term);
    item.appendChild(desc);
    meta.appendChild(item);
}
async function fetchConferenceTeams(conferenceId) {
    const perPage = 100;
    let page = 1;
    const teams = [];
    while (true) {
        const { data } = await NCAAM.teams(page, perPage, { conference_id: conferenceId });
        if (!Array.isArray(data) || !data.length) {
            break;
        }
        const filtered = data.filter(team => team.conference_id === conferenceId);
        teams.push(...filtered);
        if (data.length < perPage) {
            break;
        }
        page += 1;
    }
    teams.sort((a, b) => (a.full_name ?? a.name).localeCompare(b.full_name ?? b.name));
    return teams;
}
async function fetchTeamRoster(teamId) {
    const perPage = 100;
    let cursor;
    const players = [];
    const seen = new Set();
    while (true) {
        const { data, meta } = await NCAAM.playersActive({ teamId, perPage, cursor });
        for (const entry of data) {
            if (!entry || typeof entry !== "object") {
                continue;
            }
            if (entry.team?.id !== teamId) {
                continue;
            }
            if (seen.has(entry.id)) {
                continue;
            }
            seen.add(entry.id);
            players.push(entry);
        }
        const next = meta?.next_cursor;
        if (next === undefined || next === null || String(next).length === 0) {
            break;
        }
        cursor = next;
    }
    players.sort((a, b) => {
        const last = (a.last_name ?? "").localeCompare(b.last_name ?? "", "en", { sensitivity: "base" });
        if (last !== 0) {
            return last;
        }
        return (a.first_name ?? "").localeCompare(b.first_name ?? "", "en", { sensitivity: "base" });
    });
    return players;
}
function findTeamLogo(team) {
    const candidates = [];
    const seen = new Set();
    const pushCandidate = (value) => {
        if (!value) {
            return;
        }
        const slug = toSlug(value);
        if (!slug || seen.has(slug)) {
            return;
        }
        seen.add(slug);
        candidates.push(slug);
    };
    pushCandidate(team.full_name ?? null);
    pushCandidate(team.college ? `${team.college} ${team.name}` : null);
    pushCandidate(team.college ?? null);
    pushCandidate(team.name ?? null);
    pushCandidate(team.abbreviation ?? null);
    for (const slug of candidates) {
        const canonical = NCAA_LOGO_ALIASES[slug] ?? slug;
        const entry = NCAA_LOGO_INDEX[canonical];
        if (entry) {
            return `/${entry.path}`;
        }
    }
    return null;
}
function toSlug(value) {
    const normalized = value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalized) {
        return "";
    }
    const tokens = normalized
        .split(" ")
        .filter(token => token && !STOPWORDS.has(token));
    return tokens.join("-");
}
function showPageStatus(variant, message, options = {}) {
    statusEl.hidden = false;
    statusEl.innerHTML = "";
    const status = createStatusElement(message, variant);
    if (options.retry) {
        const button = createActionButton("Retry", () => {
            void loadConferences();
        });
        status.appendChild(button);
    }
    statusEl.appendChild(status);
}
function hidePageStatus() {
    statusEl.innerHTML = "";
    statusEl.hidden = true;
}
function createStatusElement(message, variant) {
    const wrapper = document.createElement("div");
    wrapper.className = `players-status players-status--${variant}`;
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    wrapper.appendChild(paragraph);
    return wrapper;
}
function createActionButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "players-button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
}
function describeError(error, fallback) {
    if (error instanceof Error && error.message.trim().length) {
        return error.message;
    }
    return fallback;
}
