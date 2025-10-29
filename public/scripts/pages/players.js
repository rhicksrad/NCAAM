import { NCAAM } from "../lib/sdk/ncaam.js";
const app = document.getElementById("app");
app.innerHTML = `<h1>Players</h1><input class="search" placeholder="Search players"><ul id="list" class="clean"></ul>`;
const input = app.querySelector("input.search");
const list = app.querySelector("#list");
let page = 1;
const acc = [];
async function load() {
    const { data } = await NCAAM.players(page, 200);
    acc.push(...data);
    if (data.length === 200) {
        page++;
        await load();
    }
}
await load();
function render(q = "") {
    const ql = q.toLowerCase();
    list.innerHTML = acc
        .filter(p => (`${p.first_name} ${p.last_name} ${p.team?.name ?? ""}`.toLowerCase()).includes(ql))
        .slice(0, 600)
        .map(p => `<li class="card">${p.first_name} ${p.last_name} — <span class="badge">${p.team?.full_name ?? "No team"}</span></li>`)
        .join("");
}
render();
input.addEventListener("input", () => render(input.value));
