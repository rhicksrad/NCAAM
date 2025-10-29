import { API } from "../lib/config.js";
const app = document.getElementById("app");
async function diag(u) {
    try {
        const r = await fetch(u, { cache: "no-store" });
        const t = await r.text();
        return `<section class="card"><h3>${u}</h3><pre>${r.status} ${r.statusText}\n${t.slice(0, 2000)}</pre></section>`;
    }
    catch (e) {
        return `<section class="card"><h3>${u}</h3><pre>error: ${String(e)}</pre></section>`;
    }
}
const endpoints = [
    `${API}/diag`.replace(/\/ncaab\/?$/i, "/diag"),
    `${API}/teams`,
    `${API}/players?page=1&per_page=1`,
    `${API}/games?page=1&per_page=1`
];
let html = `<h1>Diag</h1>`;
for (const u of endpoints)
    html += await diag(u);
app.innerHTML = html;
