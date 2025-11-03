import { NCAAM, type Team } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import {
  getConferenceLogoUrl,
  getConferenceMonogram,
  getTeamLogoUrl,
  getTeamMonogram,
} from "../lib/ui/logos.js";

const app = document.getElementById("app")!;
app.innerHTML = `
  <section class="card stack" data-gap="md">
    <header class="stack" data-gap="xs">
      <h2 class="section-title">Conference standings directory</h2>
      <p class="section-summary">Alphabetized conference groupings with placeholder records until the live feed unlocks.</p>
    </header>
    <div id="wrap" class="conference-groups stack" data-gap="sm"></div>
  </section>
`;
const wrap = document.getElementById("wrap")!;

const [teamsResponse, conferenceMap] = await Promise.all([
  NCAAM.teams(1, 500),
  getConferenceMap(),
]);

const teams = teamsResponse.data;

type Group = {
  key: string;
  name: string;
  shortName?: string | null;
  teams: Team[];
};

type ConferenceIdentity = {
  key: string;
  name: string;
  shortName: string | null;
  logoUrl?: string;
  monogram: string;
};

const groups = new Map<string, Group>();
const conferenceIdentities = new Map<string, ConferenceIdentity>();

function ensureConferenceIdentity(group: Group): ConferenceIdentity {
  const key = group.key;
  const existing = conferenceIdentities.get(key);
  if (existing) {
    return existing;
  }

  const aliasSet = new Set<string>([group.name, group.shortName ?? ""]);
  for (const team of group.teams) {
    if (team.conference && team.conference !== group.name) {
      aliasSet.add(team.conference);
    }
  }

  const logoUrl = getConferenceLogoUrl(group.name, {
    shortName: group.shortName ?? null,
    aliases: Array.from(aliasSet).filter(Boolean),
  });

  const identity: ConferenceIdentity = {
    key,
    name: group.name,
    shortName: group.shortName ?? null,
    logoUrl,
    monogram: getConferenceMonogram(group.name),
  };
  conferenceIdentities.set(key, identity);
  return identity;
}

for (const conference of conferenceMap.values()) {
  const key = `id-${conference.id}`;
  groups.set(key, {
    key,
    name: conference.name,
    shortName: conference.short_name ?? null,
    teams: [],
  });
}

const independentKey = "independent";
if (!groups.has(independentKey)) {
  groups.set(independentKey, {
    key: independentKey,
    name: "Independent",
    teams: [],
  });
}

function findGroupForTeam(team: Team): Group {
  if (team.conference_id != null) {
    const byId = groups.get(`id-${team.conference_id}`);
    if (byId) return byId;
  }

  if (team.conference && team.conference !== "N/A") {
    const normalized = team.conference.trim().toLowerCase();
    for (const group of groups.values()) {
      if (group.name.trim().toLowerCase() === normalized) return group;
      if (group.shortName && group.shortName.trim().toLowerCase() === normalized) {
        return group;
      }
    }

    const key = `name-${normalized}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: team.conference,
        shortName: null,
        teams: [],
      });
    }
    return groups.get(key)!;
  }

  return groups.get(independentKey)!;
}

for (const team of teams) {
  const group = findGroupForTeam(team);
  group.teams.push(team);
}

function renderTeamCell(team: Team): string {
  const displayName = team.full_name ?? team.name ?? "Team";
  const logoUrl = getTeamLogoUrl(team);
  const logo = logoUrl
    ? `<img class="standings-team__logo-image" src="${logoUrl}" alt="${displayName} logo" loading="lazy" decoding="async">`
    : `<span class="standings-team__logo-fallback" role="img" aria-label="${displayName} logo">${getTeamMonogram(team)}</span>`;

  return `<span class="standings-team"><span class="standings-team__logo">${logo}</span><span class="standings-team__name">${displayName}</span></span>`;
}

const orderedGroups = Array.from(groups.values()).sort((a, b) => {
  return a.name.localeCompare(b.name);
});

wrap.innerHTML = orderedGroups
  .map(group => {
    const identity = ensureConferenceIdentity(group);
    const shortName = identity.shortName && identity.shortName !== identity.name ? identity.shortName : null;
    const label = shortName ? `${shortName} · ${identity.name}` : identity.name;
    const logoMarkup = identity.logoUrl
      ? `<img class="conference-identity__logo-image" src="${identity.logoUrl}" alt="${identity.name} logo" loading="lazy" decoding="async">`
      : `<span class="conference-identity__logo-fallback">${identity.monogram}</span>`;
    const teamCountLabel = `${group.teams.length} team${group.teams.length === 1 ? "" : "s"}`;
    const teamRows = group.teams
      .slice()
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map(team => `
        <tr>
          <th scope="row">${renderTeamCell(team)}</th>
          <td>0</td>
          <td>0</td>
          <td>0.000</td>
        </tr>
      `)
      .join("");

    const body = teamRows
      ? `<div class="table-shell">
          <table class="standings-table">
            <thead>
              <tr><th scope="col">Team</th><th scope="col">W</th><th scope="col">L</th><th scope="col">Pct</th></tr>
            </thead>
            <tbody>${teamRows}</tbody>
          </table>
        </div>`
      : `<p class="empty">No teams assigned.</p>`;

    return `
      <details class="conference-card card" data-conference-key="${group.key}" data-conference="${identity.name}">
        <summary class="conference-card__summary">
          <span class="conference-identity">
            <span class="conference-identity__logo">${logoMarkup}</span>
            <span class="conference-identity__text">
              <span class="conference-identity__name">${identity.name}</span>
              ${shortName ? `<span class="conference-identity__subtext">${shortName}</span>` : ""}
            </span>
          </span>
          <span class="conference-card__meta">
            <span class="conference-card__count" aria-label="${teamCountLabel}">${teamCountLabel}</span>
            <span class="disclosure-indicator" aria-hidden="true"></span>
          </span>
        </summary>
        <div class="conference-card__body">
          ${body}
        </div>
      </details>
    `;
  })
  .join("");
