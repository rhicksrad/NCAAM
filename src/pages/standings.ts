import { NCAAM } from "../lib/sdk/ncaam.js";
const app = document.getElementById("app")!;
app.innerHTML = `<h1>Standings</h1><div id="wrap"></div>`;
const wrap = document.getElementById("wrap")!;
const today = new Date();
const start = new Date(today.getFullYear(), 10, 1); // Nov 1
const iso = (d:Date)=>d.toISOString().slice(0,10);
const { data: games } = await NCAAM.games(1, 1000, iso(start), iso(today));
type Row = { team:string; conf:string; w:number; l:number };
const table = new Map<number, Row>();
function bump(id:number, team:string, conf:string, win:boolean) {
  const cur = table.get(id) ?? { team, conf, w:0, l:0 };
  if (win) cur.w++; else cur.l++;
  table.set(id, cur);
}
for (const g of games) {
  const hs = g.home_team_score ?? 0, vs = g.visitor_team_score ?? 0;
  if (!hs && !vs) continue;
  bump(g.home_team.id, g.home_team.full_name, g.home_team.conference ?? "Unknown", hs > vs);
  bump(g.visitor_team.id, g.visitor_team.full_name, g.visitor_team.conference ?? "Unknown", vs > hs);
}
const byConf = new Map<string, Row[]>();
for (const r of table.values()) {
  const k = r.conf;
  byConf.set(k, [...(byConf.get(k) ?? []), r].sort((a,b)=>(b.w-b.l)-(a.w-a.l)));
}
wrap.innerHTML = [...byConf.entries()].sort().map(([conf, rows]) => `
  <section class="card"><h3>${conf}</h3>
  <table><thead><tr><th>Team</th><th>W</th><th>L</th></tr></thead>
  <tbody>${rows.map(r=>`<tr><td>${r.team}</td><td>${r.w}</td><td>${r.l}</td></tr>`).join("")}</tbody></table>
  </section>`).join("");
