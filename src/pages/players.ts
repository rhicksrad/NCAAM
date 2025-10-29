import { NCAAM } from "../lib/sdk/ncaam.js";
import type { ActivePlayer, Conference, Team } from "../lib/sdk/ncaam.js";

const app = document.getElementById("app");
if (!app) throw new Error("Missing app root");

app.innerHTML = `
  <section class="card">
    <h1>Active Players</h1>
    <p>Browse conferences and open a team to fetch the live active roster.</p>
  </section>
  <section id="roster-tree" class="roster-tree">
    <div class="roster-status"><p>Loading conferences and teams…</p></div>
  </section>
`;

const treeElement = document.getElementById("roster-tree");
if (!(treeElement instanceof HTMLElement)) throw new Error("Missing roster tree container");
const tree = treeElement;

type ConferenceGroup = { info: ConferenceSummary; teams: Team[] };
type ConferenceSummary = { id: number; name: string; short_name?: string | null };

const INDEPENDENT_KEY = -1;
const rosterCache = new Map<number, ActivePlayer[]>();

void bootstrap();

async function bootstrap(): Promise<void> {
  renderStatus(tree, "Loading conferences and teams…", "info");
  try {
    const [conferences, teams] = await Promise.all([fetchConferences(), fetchTeams()]);
    if (!teams.length) {
      renderStatus(tree, "No teams were returned from the API.", "empty");
      return;
    }
    const groups = groupTeamsByConference(conferences, teams);
    renderConferences(tree, groups);
  } catch (error) {
    console.error("Failed to load conferences or teams", error);
    renderRetry(tree, "Unable to load conferences or teams.", bootstrap);
  }
}

function groupTeamsByConference(conferences: Conference[], teams: Team[]): ConferenceGroup[] {
  const map = new Map<number, ConferenceSummary>();
  for (const conference of conferences) {
    map.set(conference.id, { id: conference.id, name: conference.name, short_name: conference.short_name });
  }

  const grouped = new Map<number, ConferenceGroup>();

  for (const team of teams) {
    const confId = team.conference_id ?? INDEPENDENT_KEY;
    const existing = grouped.get(confId);
    if (existing) {
      existing.teams.push(team);
    } else {
      const info = map.get(confId) ?? createIndependentSummary(confId);
      grouped.set(confId, { info, teams: [team] });
    }
  }

  const sorted = Array.from(grouped.values())
    .map(({ info, teams: groupTeams }) => ({
      info,
      teams: groupTeams.slice().sort((a, b) => a.full_name.localeCompare(b.full_name, "en", { sensitivity: "base" })),
    }))
    .sort((a, b) => a.info.name.localeCompare(b.info.name, "en", { sensitivity: "base" }));

  return sorted;
}

function createIndependentSummary(id: number): ConferenceSummary {
  return { id, name: "Independent", short_name: "Independent" };
}

function renderConferences(container: HTMLElement, groups: ConferenceGroup[]): void {
  container.innerHTML = "";
  for (const group of groups) {
    container.append(createConferenceDetails(group));
  }
}

function createConferenceDetails(group: ConferenceGroup): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "roster-conference";
  details.dataset.conferenceId = String(group.info.id);

  const summary = document.createElement("summary");
  summary.className = "roster-conference__summary";

  const name = document.createElement("span");
  name.className = "roster-conference__name";
  name.textContent = group.info.short_name ?? group.info.name;
  summary.append(name);

  const meta = document.createElement("span");
  meta.className = "roster-conference__meta";

  const count = document.createElement("span");
  count.className = "roster-conference__count";
  count.textContent = `${group.teams.length} ${group.teams.length === 1 ? "team" : "teams"}`;
  meta.append(count);
  meta.append(createCaret());
  summary.append(meta);

  details.append(summary);

  const teamsContainer = document.createElement("div");
  teamsContainer.className = "roster-conference__teams";
  for (const team of group.teams) {
    teamsContainer.append(createTeamDetails(team));
  }

  details.append(teamsContainer);
  return details;
}

function createTeamDetails(team: Team): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "roster-team";
  details.dataset.teamId = String(team.id);

  const summary = document.createElement("summary");
  summary.className = "roster-team__summary";

  const name = document.createElement("span");
  name.className = "roster-team__name";
  name.textContent = team.full_name;
  summary.append(name);

  const meta = document.createElement("span");
  meta.className = "roster-team__meta";
  if (team.abbreviation) {
    const abbr = document.createElement("span");
    abbr.className = "roster-team__abbr";
    abbr.textContent = team.abbreviation;
    meta.append(abbr);
  }
  meta.append(createCaret());
  summary.append(meta);

  details.append(summary);

  const body = document.createElement("div");
  body.className = "roster-team__body";
  body.dataset.teamRoster = "true";
  body.append(createStatus("Open this team to load the active roster.", "info"));
  details.append(body);

  details.addEventListener("toggle", () => {
    if (details.open) {
      void loadTeamRoster(details, team);
    }
  });

  return details;
}

async function loadTeamRoster(details: HTMLDetailsElement, team: Team, force = false): Promise<void> {
  if (!force && details.dataset.rosterLoaded === "true") {
    return;
  }
  if (details.dataset.rosterLoading === "true") {
    return;
  }

  if (force) {
    rosterCache.delete(team.id);
    delete details.dataset.rosterLoaded;
  }

  details.dataset.rosterLoading = "true";
  const container = details.querySelector<HTMLElement>("[data-team-roster]");
  if (!container) {
    details.dataset.rosterLoading = "false";
    return;
  }

  replaceChildren(container, createStatus("Loading active roster…", "info"));

  try {
    const players = await getRoster(team.id);
    if (!players.length) {
      replaceChildren(container, createStatus("No active players are currently listed for this team.", "empty"));
    } else {
      const list = renderRoster(players, team);
      replaceChildren(container, list);
    }
    details.dataset.rosterLoaded = "true";
  } catch (error) {
    console.error(`Failed to load roster for ${team.full_name}`, error);
    replaceChildren(
      container,
      createRetryStatus("Unable to load the active roster.", () => {
        void loadTeamRoster(details, team, true);
      }),
    );
  } finally {
    details.dataset.rosterLoading = "false";
  }
}

async function getRoster(teamId: number): Promise<ActivePlayer[]> {
  const cached = rosterCache.get(teamId);
  if (cached) {
    return cached;
  }

  const { data } = await NCAAM.activeRoster(teamId);
  const players = Array.isArray(data) ? data.slice() : [];
  players.sort(comparePlayers);
  rosterCache.set(teamId, players);
  return players;
}

function comparePlayers(a: ActivePlayer, b: ActivePlayer): number {
  const last = a.last_name.localeCompare(b.last_name, "en", { sensitivity: "base" });
  if (last !== 0) return last;
  const first = a.first_name.localeCompare(b.first_name, "en", { sensitivity: "base" });
  if (first !== 0) return first;
  return a.id - b.id;
}

function renderRoster(players: ActivePlayer[], team: Team): HTMLElement {
  const list = document.createElement("ul");
  list.className = "roster-player-grid";
  for (const player of players) {
    list.append(createPlayerCard(player, team));
  }
  return list;
}

function createPlayerCard(player: ActivePlayer, team: Team): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "player-card";

  const header = document.createElement("div");
  header.className = "player-card__header";

  const name = document.createElement("h4");
  name.className = "player-card__name";
  name.textContent = `${player.first_name} ${player.last_name}`;
  header.append(name);

  if (player.jersey_number) {
    const badge = document.createElement("span");
    badge.className = "player-card__badge";
    badge.textContent = `#${player.jersey_number}`;
    header.append(badge);
  }

  item.append(header);

  const meta = document.createElement("dl");
  meta.className = "player-card__meta";
  appendMeta(meta, "Position", player.position ?? "—");
  appendMeta(meta, "Height", player.height ?? "—");
  appendMeta(meta, "Weight", player.weight ?? "—");
  appendMeta(meta, "Jersey", player.jersey_number ? `#${player.jersey_number}` : "—");
  appendMeta(meta, "College", player.team?.college ?? team.college ?? "—");
  item.append(meta);

  return item;
}

function appendMeta(container: HTMLElement, label: string, value: string): void {
  const wrapper = document.createElement("div");
  wrapper.className = "player-card__meta-item";

  const dt = document.createElement("dt");
  dt.textContent = label;
  wrapper.append(dt);

  const dd = document.createElement("dd");
  dd.textContent = value;
  wrapper.append(dd);

  container.append(wrapper);
}

async function fetchConferences(): Promise<Conference[]> {
  const { data } = await NCAAM.conferences(1, 200);
  return Array.isArray(data) ? data : [];
}

async function fetchTeams(): Promise<Team[]> {
  const teams: Team[] = [];
  const perPage = 200;
  let page = 1;
  while (true) {
    const { data } = await NCAAM.teams(page, perPage);
    if (!Array.isArray(data) || !data.length) {
      break;
    }
    teams.push(...data);
    if (data.length < perPage) {
      break;
    }
    page += 1;
  }
  return teams;
}

function renderStatus(target: HTMLElement, message: string, kind: "info" | "error" | "empty"): void {
  replaceChildren(target, createStatus(message, kind));
}

function renderRetry(target: HTMLElement, message: string, action: () => void): void {
  replaceChildren(target, createRetryStatus(message, action));
}

function createStatus(message: string, kind: "info" | "error" | "empty"): HTMLDivElement {
  const status = document.createElement("div");
  status.className = "roster-status";
  if (kind === "error") status.classList.add("roster-status--error");
  if (kind === "empty") status.classList.add("roster-status--empty");
  const p = document.createElement("p");
  p.textContent = message;
  status.append(p);
  return status;
}

function createRetryStatus(message: string, action: () => void): HTMLDivElement {
  const status = createStatus(message, "error");
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Retry";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  });
  status.append(button);
  return status;
}

function createCaret(): HTMLSpanElement {
  const caret = document.createElement("span");
  caret.className = "roster-summary__caret";
  caret.setAttribute("aria-hidden", "true");
  caret.textContent = "▸";
  return caret;
}

function replaceChildren(target: HTMLElement, node: Node): void {
  target.innerHTML = "";
  target.append(node);
}
