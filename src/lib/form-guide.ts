// The pregame "Coming in" panel: each side's last five and what is next.
import { html, type Markup } from "./dom.js";
import { espn, type Game, type ScheduleGame, type Side } from "./espn.js";
import { fmtShortDay, gameHref, logo, teamHref } from "./ui.js";

function formSheet(side: Side, games: ScheduleGame[], id: string): Markup {
  const done = games.filter((g) => g.won !== null).slice(-5).reverse();
  const next = games.filter((g) => g.won === null && g.id !== id).slice(0, 1);
  const wins = done.filter((g) => g.won).length;
  const where = (g: ScheduleGame) => (g.neutral ? "vs" : g.home ? "vs" : "at");
  const opp = (g: ScheduleGame) =>
    html`<a class="who" href="${teamHref(g.opponent.id)}">${logo(g.opponent)}<span><small>${where(g)}</small> ${g.oppRank ? html`<span class="rk">${g.oppRank}</span>` : ""}${g.opponent.name}</span></a>`;
  return html`<section class="sheet sheet--wrap">
    <div class="sheet__head"><h2>${side.team.name}</h2><small>${done.length ? `${wins}-${done.length - wins} in the last ${done.length}` : "No games yet"}</small></div>
    <table>
      <tbody>
        ${done.map(
          (g) => html`<tr><td class="l">${fmtShortDay(g.date)}</td><td class="l">${opp(g)}</td><td><a href="${gameHref(g.id)}"><span class="${g.won ? "res-w" : "res-l"}">${g.won ? "W" : "L"}</span> ${g.us}-${g.them}</a></td></tr>`,
        )}
        ${next.map((g) => html`<tr class="later"><td class="l">${fmtShortDay(g.date)}</td><td class="l">${opp(g)}</td><td><small>up next</small></td></tr>`)}
      </tbody>
    </table>
  </section>`;
}

export async function formGuide(g: Game, id: string): Promise<Markup> {
  const [a, h] = await Promise.all([espn.schedule(g.away.team.id), espn.schedule(g.home.team.id)]);
  return html`<div class="form-guide"><h2 class="form-guide__h">Coming in</h2>${formSheet(g.away, a, id)}${formSheet(g.home, h, id)}</div>`;
}
