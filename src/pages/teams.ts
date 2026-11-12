import "../lib/chrome.js";
import { snapshot, type TeamEntry } from "../lib/data.js";
import { $, html, mount, param, setParams } from "../lib/dom.js";
import { failure, logo, teamHref, teamStyle } from "../lib/ui.js";

let teams: TeamEntry[] = [];
let query = param("q") ?? "";

function paint(): void {
  const q = query.trim().toLowerCase();
  const shown = q ? teams.filter((t) => `${t.name} ${t.mascot} ${t.abbr} ${t.confName} ${t.conf}`.toLowerCase().includes(q)) : teams;
  const groups = new Map<string, TeamEntry[]>();
  for (const t of shown) {
    const key = t.confName || "Independent";
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  $("#teams-sub").textContent = q
    ? `${shown.length} of ${teams.length} programs match “${query.trim()}”.`
    : `All ${teams.length} Division I programs in ${groups.size} conferences. Type to find yours.`;
  mount(
    "#teams-root",
    shown.length
      ? html`${[...groups.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(
            ([name, list]) => html`<section class="conf-block">
              <h2>${name.replace(/ Conference$/, "")}</h2>
              <div class="team-grid">
                ${list.map(
                  (t) => html`<a class="team-chip" href="${teamHref(t.id)}" style="${teamStyle(t)}">${logo(t)}<span>${t.name}<small>${t.mascot}</small></span></a>`,
                )}
              </div>
            </section>`,
          )}`
      : html`<div class="empty-state"><h2>No such school</h2><p>Nothing in Division I matches that. Check the spelling, or try the mascot.</p></div>`,
  );
}

mount(
  "#teams-tools",
  html`<div class="field"><label for="team-q">Find</label><input id="team-q" type="search" placeholder="School, mascot or conference" autocomplete="off" value="${query}"></div>`,
);
$("#team-q").addEventListener("input", (event) => {
  query = (event.target as HTMLInputElement).value;
  setParams({ q: query.trim() || null });
  paint();
});

snapshot("teams")
  .then((saved) => {
    teams = saved.data;
    paint();
  })
  .catch((error) => mount("#teams-root", failure("the team directory", error)));
