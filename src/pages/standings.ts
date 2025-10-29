import { NCAAM, type Team } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";

const app = document.getElementById("app")!;
app.innerHTML = `<h1>Standings</h1><div id="wrap" class="conference-groups"></div>`;
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
          <th scope="row">${team.full_name}</th>
          <td>0</td>
          <td>0</td>
          <td>0.000</td>
        </tr>
      `)
      .join("");

    const body = teamRows
      ? `<table class="standings-table">
          <thead>
            <tr><th scope="col">Team</th><th scope="col">W</th><th scope="col">L</th><th scope="col">Pct</th></tr>
          </thead>
          <tbody>${teamRows}</tbody>
        </table>`
      : `<p class="empty">No teams assigned.</p>`;

    return `
      <details class="conference" data-conference="${group.name}">
        <summary><span>${label}</span><span class="count">${group.teams.length}</span></summary>
        <div class="group">
          ${body}
        </div>
      </details>
    `;
  })
  .join("");
