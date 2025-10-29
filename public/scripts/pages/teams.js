import { NCAAM } from "../lib/sdk/ncaam.js";
const app = document.getElementById("app");
try {
    const { data } = await NCAAM.teams(1, 100);
    app.innerHTML = `<h1>Teams</h1><ul>${data.map(t => `<li>${t.full_name}</li>`).join("")}</ul>`;
}
catch (e) {
    app.innerHTML = `<p>Teams unavailable.</p>`;
}
