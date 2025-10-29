import { NCAAM } from "../lib/sdk/ncaam.js";
import { getConferenceMap } from "../lib/sdk/directory.js";
const app = document.getElementById("app");
app.innerHTML = `<h1>Standings</h1><div id="wrap"></div>`;
const wrap = document.getElementById("wrap");
const today = new Date();
const start = new Date(today.getFullYear(), 10, 1); // Nov 1
const iso = (d) => d.toISOString().slice(0, 10);
const [gamesResponse, conferenceMap] = await Promise.all([
    NCAAM.games(1, 1000, iso(start), iso(today)),
    getConferenceMap(),
]);
const games = gamesResponse.data;
const table = new Map();
function bump(id, team, conf, win) {
    const cur = table.get(id) ?? { team, conf, w: 0, l: 0 };
    if (win)
        cur.w++;
    else
        cur.l++;
    table.set(id, cur);
}
const resolveConference = (teamConf, conferenceId) => {
    if (teamConf && teamConf !== "N/A")
        return teamConf;
    if (!conferenceId)
        return "Unknown";
    const conf = conferenceMap.get(conferenceId);
    return conf?.short_name ?? conf?.name ?? "Unknown";
};
for (const g of games) {
    const hs = g.home_team_score ?? 0, vs = g.visitor_team_score ?? 0;
    if (!hs && !vs)
        continue;
    bump(g.home_team.id, g.home_team.full_name, resolveConference(g.home_team.conference, g.home_team.conference_id), hs > vs);
    bump(g.visitor_team.id, g.visitor_team.full_name, resolveConference(g.visitor_team.conference, g.visitor_team.conference_id), vs > hs);
}
const byConf = new Map();
for (const r of table.values()) {
    const k = r.conf;
    byConf.set(k, [...(byConf.get(k) ?? []), r].sort((a, b) => (b.w - b.l) - (a.w - a.l)));
}
wrap.innerHTML = [...byConf.entries()].sort().map(([conf, rows]) => `
  <section class="card"><h3>${conf}</h3>
  <table><thead><tr><th>Team</th><th>W</th><th>L</th></tr></thead>
  <tbody>${rows.map(r => `<tr><td>${r.team}</td><td>${r.w}</td><td>${r.l}</td></tr>`).join("")}</tbody></table>
  </section>`).join("");
