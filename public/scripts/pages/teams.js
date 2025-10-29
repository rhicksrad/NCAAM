import { NCAAM } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
import { getTeamAccentColors, getTeamLogoUrl, getTeamMonogram, } from "../lib/ui/logos.js";
const app = document.getElementById("app");
app.innerHTML = `<h1>Teams</h1>
<input class="search" placeholder="Filter name or conference">
<div id="list" class="conference-groups"></div>`;
const input = app.querySelector("input.search");
const list = app.querySelector("#list");
const [teamsResponse, conferenceMap] = await Promise.all([
    NCAAM.teams(1, 400),
    getConferenceMap(),
]);
const data = teamsResponse.data.map(team => {
    const conference = team.conference ?? (() => {
        const lookup = team.conference_id ? conferenceMap.get(team.conference_id) : undefined;
        return lookup?.short_name ?? lookup?.name;
    })();
    const [accentPrimary, accentSecondary] = getTeamAccentColors(team);
    return {
        ...team,
        conference: conference ?? "N/A",
        logoUrl: getTeamLogoUrl(team),
        accentPrimary,
        accentSecondary,
        monogram: getTeamMonogram(team),
    };
});
function render(q = "") {
    const ql = q.trim().toLowerCase();
    const openSet = new Set(Array.from(list.querySelectorAll("details[open]"))
        .map(details => details.dataset.conference || "")
        .filter(Boolean));
    const groups = new Map();
    for (const team of data) {
        const haystack = `${team.full_name} ${team.name} ${team.conference ?? ""}`.toLowerCase();
        if (ql && !haystack.includes(ql)) {
            continue;
        }
        const conference = team.conference ?? "N/A";
        if (!groups.has(conference)) {
            groups.set(conference, []);
        }
        groups.get(conference).push(team);
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
            const logo = team.logoUrl
                ? `<img class="team-card__logo-image" src="${team.logoUrl}" alt="${team.full_name} logo" loading="lazy" decoding="async">`
                : `<span class="team-card__logo-placeholder" aria-hidden="true" style="--team-accent:${team.accentPrimary}; --team-accent-secondary:${team.accentSecondary};">${team.monogram}</span>`;
            const meta = team.abbreviation ? `${team.conference} · ${team.abbreviation}` : team.conference;
            return `<article class="card team-card">
  <div class="team-card__logo">${logo}</div>
  <div class="team-card__body">
    <strong class="team-card__name">${team.full_name}</strong>
    <span class="team-card__meta">${meta}</span>
  </div>
</article>`;
        })
            .join("")}
  </div>
</details>`;
    });
    list.innerHTML = sections.join("");
}
render();
input.addEventListener("input", () => render(input.value));
