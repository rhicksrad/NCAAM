import { API } from "../lib/config.js";
const app = document.getElementById("app");
try {
    const res = await fetch(`${API}/diag`.replace(/\/ncaab\/?$/i, "/diag"), { cache: "no-store" });
    const body = await res.text();
    app.innerHTML = `<h1>Diag</h1><pre>${body}</pre>`;
}
catch {
    app.innerHTML = `<h1>Diag</h1><p>Diag endpoint not available.</p>`;
}
