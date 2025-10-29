import { NCAAM } from "../lib/sdk/ncaam.js";
const app = document.getElementById("app");
app.innerHTML = `<h1>Rankings</h1><p class="card">Simple Elo over last 30 days. Approximate Top-25.</p><table><thead><tr><th>#</th><th>Team ID</th><th>Elo</th></tr></thead><tbody id="rows"></tbody></table>`;
const rows = document.getElementById("rows");
function Elo() {
    const K = 20, map = new Map();
    const get = (id) => map.get(id) ?? 1500;
    const set = (id, v) => map.set(id, v);
    const ex = (a, b) => 1 / (1 + 10 ** ((b - a) / 400));
    return {
        rate(a, b, sa) {
            const Ra = get(a), Rb = get(b), Ea = ex(Ra, Rb);
            set(a, Ra + K * (sa - Ea));
            set(b, Rb + K * ((1 - sa) - (1 - Ea)));
        },
        map
    };
}
const elo = Elo();
const end = new Date();
const start = new Date(end.getTime() - 30 * 864e5);
const iso = (d) => d.toISOString().slice(0, 10);
const { data: games } = await NCAAM.games(1, 500, iso(start), iso(end));
for (const g of games) {
    const hs = g.home_team_score ?? 0, vs = g.visitor_team_score ?? 0;
    if (!hs && !vs)
        continue;
    elo.rate(g.home_team.id, g.visitor_team.id, hs > vs ? 1 : 0);
}
rows.innerHTML = [...elo.map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
    .map(([id, score], i) => `<tr><td>${i + 1}</td><td>${id}</td><td>${score.toFixed(1)}</td></tr>`).join("");
