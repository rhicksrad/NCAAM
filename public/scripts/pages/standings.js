import { NCAAM } from "../lib/sdk/ncaam.js";
const app = document.getElementById("app");
app.innerHTML = `<h1>Standings</h1><div id="standings" class="conference-groups"></div>`;
const container = document.getElementById("standings");
const { data: teams } = await NCAAM.teams(1, 400);
const groups = new Map();
for (const team of teams) {
    const conference = team.conference?.trim() || "N/A";
    if (!groups.has(conference)) {
        groups.set(conference, []);
    }
    groups.get(conference).push(team);
}
if (!groups.size) {
    container.innerHTML = `<p class="empty-state">Standings are unavailable right now.</p>`;
}
else {
    const sections = Array.from(groups.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([conference, members]) => {
        members.sort((a, b) => a.full_name.localeCompare(b.full_name));
        const rows = members
            .map((team) => `<tr><td>${team.full_name}</td><td class="numeric">0-0</td><td class="numeric">0.000</td></tr>`)
            .join("");
        return `<details class="conference" data-conference="${conference}">
  <summary><span>${conference}</span><span class="count">${members.length}</span></summary>
  <div class="group">
    <table class="standings-table">
      <thead><tr><th>Team</th><th class="numeric">Record</th><th class="numeric">Win%</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</details>`;
    });
    container.innerHTML = sections.join("");
}
