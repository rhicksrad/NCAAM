import { NCAAM } from "../lib/sdk/ncaam.js";

const app = document.getElementById("app")!;
try {
  const { data } = await NCAAM.players(1, 50);
  app.innerHTML = `<h1>Players</h1><ul>${data.map(p => `<li>${p.first_name} ${p.last_name} — ${p.team?.name ?? ""}</li>`).join("")}</ul>`;
} catch {
  app.innerHTML = `<p>Players unavailable.</p>`;
}
