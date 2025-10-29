import { NCAAM } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import { getTeamLogo } from "../lib/ui/logos.js";

const ESCAPE_ATTR_PATTERN = /[&"<>]/g;
const ESCAPE_ATTR_REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  '"': "&quot;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeAttribute(value: string): string {
  return value.replace(ESCAPE_ATTR_PATTERN, match => ESCAPE_ATTR_REPLACEMENTS[match]);
}

const app = document.getElementById("app")!;
app.innerHTML = `<h1>Teams</h1>
<input class="search" placeholder="Filter name or conference">
<div id="list" class="conference-groups"></div>`;

const input = app.querySelector("input.search") as HTMLInputElement;
const list = app.querySelector("#list") as HTMLElement;

const [teamsResponse, conferenceMap] = await Promise.all([
  NCAAM.teams(1, 400),
  getConferenceMap(),
]);

const data = teamsResponse.data.map(team => {
  const conference = team.conference ?? (() => {
    const lookup = team.conference_id ? conferenceMap.get(team.conference_id) : undefined;
    return lookup?.short_name ?? lookup?.name;
  })();
  return {
    ...team,
    conference: conference ?? "N/A",
  };
});

function render(q = "") {
  const ql = q.trim().toLowerCase();
  const openSet = new Set<string>(
    Array.from(list.querySelectorAll<HTMLDetailsElement>("details[open]"))
      .map(details => details.dataset.conference || "")
      .filter(Boolean)
  );

  const groups = new Map<string, typeof data>();

  for (const team of data) {
    const haystack = `${team.full_name} ${team.name} ${team.conference ?? ""}`.toLowerCase();
    if (ql && !haystack.includes(ql)) {
      continue;
    }

    const conference = team.conference ?? "N/A";
    if (!groups.has(conference)) {
      groups.set(conference, []);
    }
    groups.get(conference)!.push(team);
  }

  if (groups.size === 0) {
    list.innerHTML = `<p class="empty-state">No teams match your search.</p>`;
    return;
  }

  const sections = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([conference, teams]) => {
      teams.sort((a, b) => a.full_name.localeCompare(b.full_name));
      const isOpen = openSet.has(conference) || ql.length > 0;
      return `<details class="conference" data-conference="${conference}"${isOpen ? " open" : ""}>
  <summary><span>${conference}</span><span class="count">${teams.length}</span></summary>
  <div class="group grid cols-3">
    ${teams
      .map(team => {
        const logoPath = getTeamLogo(team);
        const altText = escapeAttribute(`${team.full_name} logo`);
        return `<div class="card team-card">
    <img class="team-card__logo" src="${logoPath}" alt="${altText}" loading="lazy">
    <div class="team-card__body">
      <strong>${team.full_name}</strong>
      <div class="badge">${team.conference ?? "N/A"}</div>
    </div>
  </div>`;
      })
      .join("")}
  </div>
</details>`;
    });

  list.innerHTML = sections.join("");
}

render();
input.addEventListener("input", () => render(input.value));
