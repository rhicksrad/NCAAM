import "../lib/chrome.js";
import { feed, snapshot, type FeedInfo } from "../lib/data.js";
import { $, html, mount, param, setParams } from "../lib/dom.js";
import { espn, type Conference } from "../lib/espn.js";
import { failure, logo, staleNote, teamHref } from "../lib/ui.js";

let conferences: Conference[] = [];
let pick = param("conf") ?? "";
let info: FeedInfo = { live: false, at: "", stale: false };

function streak(value: string) {
  if (!value) return "";
  return html`<span class="${value.startsWith("W") ? "up" : value.startsWith("L") ? "down" : "flat"}">${value}</span>`;
}

function table(conf: Conference) {
  return html`<section class="sheet" id="conf-${conf.id}">
    <div class="sheet__head"><h2>${conf.name.replace(/ Conference$/, "")}</h2><small>${conf.rows.length} teams</small></div>
    <div class="sheet__scroll">
      <table>
        <thead><tr><th class="l">Team</th><th>Conf</th><th>All</th><th>Home</th><th>Away</th><th>Strk</th></tr></thead>
        <tbody>
          ${conf.rows.map(
            (r) => html`<tr>
              <td class="l"><a class="who" href="${teamHref(r.team.id)}">${logo(r.team)}<span>${r.team.name}</span></a></td>
              <td class="hot">${r.conf || "0-0"}</td><td>${r.overall}</td><td>${r.home}</td><td>${r.away}</td><td>${streak(r.streak)}</td>
            </tr>`,
          )}
        </tbody>
      </table>
    </div>
  </section>`;
}

function paint(): void {
  const select = document.querySelector<HTMLSelectElement>("#conf-pick");
  if (!select) {
    mount(
      "#standings-tools",
      html`<div class="field"><label for="conf-pick">Conference</label><select id="conf-pick">
        <option value="">All ${conferences.length}</option>
        ${conferences.map((c) => html`<option value="${c.id}" ${c.id === pick ? html`selected` : ""}>${c.name}</option>`)}
      </select></div>`,
    );
    $("#conf-pick").addEventListener("change", (event) => {
      pick = (event.target as HTMLSelectElement).value;
      setParams({ conf: pick || null });
      paint();
    });
  }
  const shown = pick ? conferences.filter((c) => c.id === pick) : conferences;
  const games = conferences.some((c) => c.rows.some((r) => r.overall && r.overall !== "0-0"));
  $("#standings-sub").textContent = games
    ? "Every conference race, sorted by league record."
    : "Nobody has played yet. Everyone is undefeated, enjoy it.";
  mount("#standings-root", html`${staleNote(info)}<div class="conf-grid">${shown.map(table)}</div>`);
}

feed<Conference[]>({
  saved: () => snapshot("standings"),
  live: () => espn.standings(),
  render(data, meta) {
    if (!data.length && conferences.length) return;
    conferences = data;
    info = meta;
    paint();
  },
  fail: (error) => mount("#standings-root", failure("the standings", error)),
});
