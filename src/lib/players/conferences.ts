import { formatDecimal, formatInteger, formatPercent } from "./format.js";
import {
  getConferenceLogoUrl,
  getConferenceMonogram,
  getTeamLogoUrl,
  getTeamMonogram,
} from "../ui/logos.js";
import { type Team } from "../sdk/ncaam.js";
import {
  loadRosterDirectory,
  loadTeamRosterPlayers,
  type ConferenceGroup,
  type TeamRoster,
  type RosterPlayer,
  type PlayerStatsSnapshot,
  type PlayerStatsHistoryEntry,
} from "./roster-directory.js";

type RosterColumn = {
  key: keyof PlayerStatsSnapshot;
  label: string;
  formatter: (value: number | null | undefined) => string;
};

const ROSTER_COLUMNS: RosterColumn[] = [
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

export async function renderConferenceDirectory(
  container: HTMLElement,
  intro: HTMLElement | null,
): Promise<void> {
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
  } catch (error) {
    console.error(error);
    container.innerHTML = `<p class="conference-panel__message conference-panel__message--error">We couldn't reach the roster index. Please refresh to try again.</p>`;
  }
}

function createConferencePanel(group: ConferenceGroup, season: string): HTMLElement {
  const details = document.createElement("details");
  details.className = "conference-panel card";

  const summary = document.createElement("summary");
  summary.className = "conference-panel__summary";

  const aliasSet = new Set<string>([group.name]);
  for (const team of group.teams) {
    aliasSet.add(team.conferenceName);
  }

  const logoUrl = getConferenceLogoUrl(group.name, {
    aliases: Array.from(aliasSet).filter(Boolean),
  });
  const monogram = getConferenceMonogram(group.name);

  const identity = document.createElement("span");
  identity.className = "conference-identity";

  const logo = document.createElement("span");
  logo.className = "conference-identity__logo";
  if (logoUrl) {
    const img = document.createElement("img");
    img.className = "conference-identity__logo-image";
    img.src = logoUrl;
    img.alt = `${group.name} logo`;
    img.loading = "lazy";
    img.decoding = "async";
    logo.append(img);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "conference-identity__logo-fallback";
    fallback.textContent = monogram;
    logo.append(fallback);
  }

  const textWrap = document.createElement("span");
  textWrap.className = "conference-identity__text";

  const title = document.createElement("span");
  title.className = "conference-identity__name";
  title.textContent = group.name;
  textWrap.append(title);

  const subtitleParts: string[] = [];
  if (group.totalPlayers != null) {
    subtitleParts.push(`${group.totalPlayers} players`);
  }
  subtitleParts.push(`Season ${season}`);
  const subtitle = document.createElement("span");
  subtitle.className = "conference-panel__subtitle";
  subtitle.textContent = subtitleParts.join(" · ");
  textWrap.append(subtitle);

  identity.append(logo, textWrap);

  const metaWrap = document.createElement("span");
  metaWrap.className = "conference-card__meta conference-panel__meta";

  const teamCount = document.createElement("span");
  teamCount.className = "conference-card__count";
  const countLabel = `${group.teams.length} team${group.teams.length === 1 ? "" : "s"}`;
  teamCount.textContent = countLabel;
  teamCount.setAttribute("aria-label", countLabel);
  metaWrap.append(teamCount);

  const indicator = document.createElement("span");
  indicator.className = "disclosure-indicator";
  indicator.setAttribute("aria-hidden", "true");
  metaWrap.append(indicator);

  summary.append(identity, metaWrap);

  const body = document.createElement("div");
  body.className = "conference-panel__body";
  body.innerHTML = `<p class="conference-panel__placeholder">Open to load rosters…</p>`;

  details.append(summary, body);

  let loader: Promise<void> | null = null;
  details.addEventListener("toggle", () => {
    if (!details.open || details.dataset.loaded === "true") return;
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

async function hydrateConferenceBody(
  container: HTMLElement,
  teams: TeamRoster[],
  season: string,
): Promise<void> {
  container.innerHTML = "";

  if (!teams.length) {
    container.innerHTML = `<p class="conference-panel__placeholder">Roster data is not available.</p>`;
    return;
  }

  teams.forEach((team) => {
    container.appendChild(renderTeamRoster(team, season));
  });
}

function renderTeamRoster(team: TeamRoster, season: string): HTMLElement {
  const details = document.createElement("details");
  details.className = "team-roster";

  const summary = document.createElement("summary");
  summary.className = "team-roster__summary";

  const logo = createTeamLogo(team);

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

  summary.append(logo, labelContainer, chevron);

  const body = document.createElement("div");
  body.className = "team-roster__body";
  body.innerHTML = `<p class="conference-panel__placeholder">Open to load roster…</p>`;

  details.append(summary, body);

  let loader: Promise<void> | null = null;
  details.addEventListener("toggle", () => {
    if (!details.open || details.dataset.loaded === "true") return;
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

function createTeamLogo(team: TeamRoster): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "team-roster__logo";

  const sdkTeam: Team = {
    id: team.id,
    full_name: team.fullName,
    name: team.name,
    abbreviation: team.abbreviation ?? undefined,
    conference_id: team.conferenceId ?? undefined,
    college: team.fullName,
  };

  const logoUrl = getTeamLogoUrl(sdkTeam);
  if (logoUrl) {
    const img = document.createElement("img");
    img.className = "team-roster__logo-image";
    img.src = logoUrl;
    img.alt = `${team.fullName} logo`;
    img.loading = "lazy";
    img.decoding = "async";
    wrapper.appendChild(img);
    return wrapper;
  }

  const fallback = document.createElement("span");
  fallback.className = "team-roster__logo-fallback";
  fallback.setAttribute("role", "img");
  fallback.setAttribute("aria-label", `${team.fullName} logo`);
  fallback.textContent = getTeamMonogram(sdkTeam);
  wrapper.appendChild(fallback);
  return wrapper;
}

function renderRosterTable(team: TeamRoster, players: RosterPlayer[]): HTMLElement {
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
  } else {
    players.forEach((player) => list.appendChild(createRosterRow(player)));
  }

  table.appendChild(list);
  return table;
}

function createRosterHeader(): HTMLElement {
  const header = document.createElement("div");
  header.className = "team-roster__header";

  const playerColumn = document.createElement("span");
  playerColumn.className = "team-roster__header-title";
  playerColumn.textContent = "Player";
  header.appendChild(playerColumn);

  const seasonHeader = document.createElement("div");
  seasonHeader.className = "team-roster__season-grid team-roster__season-grid--header";

  const seasonLabel = document.createElement("span");
  seasonLabel.className = "team-roster__season-label";
  seasonLabel.textContent = "Season";
  seasonHeader.appendChild(seasonLabel);

  const schoolLabel = document.createElement("span");
  schoolLabel.className = "team-roster__season-team";
  schoolLabel.textContent = "School";
  seasonHeader.appendChild(schoolLabel);

  ROSTER_COLUMNS.forEach((column) => {
    const span = document.createElement("span");
    span.className = "team-roster__stat";
    span.textContent = column.label;
    seasonHeader.appendChild(span);
  });

  header.appendChild(seasonHeader);
  return header;
}

function buildPlayerMeta(player: RosterPlayer): string | null {
  const parts = [
    player.position?.trim() || null,
    player.jersey ? `#${player.jersey}` : null,
    player.height?.trim() || null,
    player.weight?.trim() || null,
  ].filter(Boolean) as string[];

  return parts.length ? parts.join(" · ") : null;
}

function createRosterRow(player: RosterPlayer): HTMLElement {
  const row = document.createElement("li");
  row.className = "team-roster__row";
  row.dataset.player = player.id;

  const profile = document.createElement("div");
  profile.className = "team-roster__profile";

  const name = document.createElement("span");
  name.className = "team-roster__name";
  name.textContent = player.name;
  profile.appendChild(name);

  const meta = buildPlayerMeta(player);
  if (meta) {
    const metaEl = document.createElement("span");
    metaEl.className = "team-roster__meta";
    metaEl.textContent = meta;
    profile.appendChild(metaEl);
  }

  row.appendChild(profile);

  const seasons = document.createElement("div");
  seasons.className = "team-roster__seasons";

  if (!player.history.length) {
    const empty = document.createElement("div");
    empty.className = "team-roster__season-empty";
    empty.textContent = "No college stats available.";
    seasons.appendChild(empty);
  } else {
    player.history.forEach((season) => seasons.appendChild(createSeasonRow(season)));
  }

  row.appendChild(seasons);

  return row;
}

function createSeasonRow(season: PlayerStatsHistoryEntry): HTMLElement {
  const row = document.createElement("div");
  row.className = "team-roster__season-grid";

  const seasonLabel = document.createElement("span");
  seasonLabel.className = "team-roster__season-label";
  seasonLabel.textContent = season.season;
  row.appendChild(seasonLabel);

  const school = document.createElement("span");
  school.className = "team-roster__season-team";
  const teamPieces = [season.team?.trim() || "Unknown school"];
  if (season.conference) {
    teamPieces.push(season.conference);
  }
  school.textContent = teamPieces.join(" · ");
  row.appendChild(school);

  ROSTER_COLUMNS.forEach((column) => {
    const cell = document.createElement("span");
    cell.className = "team-roster__stat";
    cell.dataset.stat = column.label;
    const value = season[column.key];
    cell.textContent = column.formatter(value ?? null);
    row.appendChild(cell);
  });

  return row;
}
