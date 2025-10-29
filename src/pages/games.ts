import { NCAAM } from "../lib/sdk/ncaam.js";
const app = document.getElementById("app")!;
app.innerHTML = `<h1>Games</h1>
<div class="card" id="controls">
  <label>Start <input type="date" id="start"></label>
  <label>End <input type="date" id="end"></label>
  <button id="load" class="badge">Load</button>
</div>
<ul id="list" class="clean"></ul>`;
const $ = (id:string)=>document.getElementById(id) as HTMLInputElement;
const list = document.getElementById("list")!;
const today = new Date(); const toYMD = (d:Date)=>d.toISOString().slice(0,10);
$("end").value = toYMD(today);
$("start").value = toYMD(new Date(today.getTime() - 7*864e5));
async function run() {
  list.innerHTML = `<li class="card">Loading…</li>`;
  const { data } = await NCAAM.games(1, 200, $("start").value, $("end").value);
  list.innerHTML = data.map(g => {
    const d = g.date?.slice(0,10) ?? "";
    return `<li class="card"><strong>${d}</strong> — ${g.visitor_team.full_name} at ${g.home_team.full_name} <span class="badge">${g.status}</span></li>`;
  }).join("");
}
document.getElementById("load")!.addEventListener("click", run);
await run();
