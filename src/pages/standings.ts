import { NCAAM, type Team } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import { getTeamLogoUrl, getTeamMonogram } from "../lib/ui/logos.js";

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

const groups = new Map<string, Group>();
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
    const label = group.shortName ? `${group.shortName} · ${group.name}` : group.name;
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
      <details class="conference-card card" data-conference="${group.name}">
        <summary class="conference-card__summary">
          <span class="conference-card__label">${label}</span>
          <span class="conference-card__meta">
            <span class="conference-card__count" aria-label="${group.teams.length} teams">${group.teams.length}</span>
            <span class="conference-card__chevron" aria-hidden="true"></span>
          </span>
        </summary>
        <div class="conference-card__body">
          ${body}
        </div>
      </details>
    `;
  })
  .join("");
