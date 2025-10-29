import { NCAAM } from "../lib/sdk/ncaam.js";

const app = document.getElementById("app")!;
try {
  const { data } = await NCAAM.games(1, 25);
  app.innerHTML = `<h1>Games</h1><ul>${data.map(g => `<li>${g.date.slice(0, 10)}: ${g.visitor_team.full_name} at ${g.home_team.full_name} (${g.status})</li>`).join("")}</ul>`;
} catch {
  app.innerHTML = `<p>Games unavailable.</p>`;
}
