import { NCAAM } from "../lib/sdk/ncaam.js";
const app = document.getElementById("app");
app.innerHTML = `<h1>Teams</h1><input class="search" placeholder="Filter name or conference"><div id="list" class="grid cols-3"></div>`;
const input = app.querySelector("input.search");
const list = app.querySelector("#list");
const { data } = await NCAAM.teams(1, 400);
function render(q = "") {
    const ql = q.toLowerCase();
    list.innerHTML = data
        .filter(t => (`${t.full_name} ${t.name} ${t.conference ?? ""}`.toLowerCase()).includes(ql))
        .map(t => `<div class="card"><strong>${t.full_name}</strong><div class="badge">${t.conference ?? "N/A"}</div></div>`)
        .join("");
}
render();
input.addEventListener("input", () => render(input.value));
