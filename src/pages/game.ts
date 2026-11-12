import "../lib/chrome.js";
import { feed, snapshot } from "../lib/data.js";
import { $, html, mount, param, raw, type Markup } from "../lib/dom.js";
import { espn, type BoxTeam, type GameDetail, type Side } from "../lib/espn.js";
import { flowChart, type FlowPoint } from "../lib/flow.js";
import { atHalf, failure, missing, notFound, fmtDay, fmtStamp, fmtTime, logoUrl, pctOrDash, periodLabel, rivalColors, teamColors, teamHref } from "../lib/ui.js";

const id = param("id") ?? "";
const root = $("#game-root");
let openPeriods: Set<number> | null = null;
let form: Markup | null = null;
let formAsked = false;

function boardTeam(side: Side): Markup {
  const { paint } = teamColors(side.team);
  return html`<a class="board__team" href="${teamHref(side.team.id)}" style="--team:${paint}">
    ${
      side.team.noLogo
        ? html`<span class="logo--blank" aria-hidden="true">${side.team.abbr.slice(0, 3)}</span>`
        : html`<img src="${logoUrl(side.team.id, 160)}" data-team="${side.team.id}" data-abbr="${side.team.abbr}" alt="" width="80" height="80">`
    }
    <b>${side.rank ? html`<span class="rk">${side.rank}</span>` : ""}<span class="wide">${side.team.name}</span><span class="narrow">${side.team.name.length > 9 ? side.team.abbr || side.team.name : side.team.name}</span></b>
    <small>${side.record}</small>
  </a>`;
}

function board(d: GameDetail): Markup {
  const g = d.game;
  const played = g.state !== "pre";
  const lead = (g.home.score ?? 0) - (g.away.score ?? 0);
  const periods = Math.max(g.home.lines.length, g.away.lines.length);
  const status =
    g.state === "pre" ? `${fmtDay(g.date)} · ${fmtTime(g.date)}` : atHalf(g) ? "Halftime" : g.state === "in" ? `${g.clock} ${periodLabel(g.period)}`.trim() || g.detail : g.detail;
  const meta = [g.venue, g.city, g.tv, d.attendance ? `${d.attendance.toLocaleString()} in the building` : "", g.odds].filter(Boolean);
  return html`<section class="board" aria-label="Scoreboard">
    <p class="board__status" ${raw(g.state === "in" ? "data-live" : "")}>${status}</p>
    <div class="board__teams">
      ${boardTeam(g.away)}
      <div class="board__score" aria-label="${g.away.team.name} ${g.away.score ?? ""}, ${g.home.team.name} ${g.home.score ?? ""}">
        ${
          played
            ? html`<span class="${g.state === "post" && lead > 0 ? "dim" : ""}">${g.away.score ?? 0}</span><i>–</i><span class="${
                g.state === "post" && lead < 0 ? "dim" : ""
              }">${g.home.score ?? 0}</span>`
            : html`<i>at</i>`
        }
      </div>
      ${boardTeam(g.home)}
    </div>
    ${
      played && periods
        ? html`<table class="board__line">
            <thead><tr><td></td>${Array.from({ length: periods }, (_, i) => html`<th>${periods === 2 || i < 2 ? i + 1 : i === 2 ? "OT" : `${i - 1}OT`}</th>`)}<th>T</th></tr></thead>
            <tbody>
              ${[g.away, g.home].map(
                (s) => html`<tr><td>${s.team.abbr}</td>${Array.from({ length: periods }, (_, i) => html`<td>${s.lines[i] ?? ""}</td>`)}<td>${s.score ?? ""}</td></tr>`,
              )}
            </tbody>
          </table>`
        : ""
    }
    ${meta.length ? html`<p class="board__meta">${meta.join(" · ")}</p>` : ""}
  </section>`;
}

function flow(d: GameDetail): Markup {
  const scoring = d.plays.filter((p) => p.scoring);
  if (scoring.length < 4) return html``;
  const g = d.game;
  const points: FlowPoint[] = scoring.map((p) => ({ t: p.t, diff: p.home - p.away }));
  const lastT = d.plays[d.plays.length - 1]?.t ?? 0;
  const regulation = d.periodSeconds === 1200 ? 2400 : d.periodSeconds * 4;
  const total = Math.max(regulation, lastT);
  let changes = 0, ties = 0, homeLed = 0, awayLed = 0, prev = 0, prevT = 0, bigHome = 0, bigAway = 0, lastLeader = 0;
  for (const p of points) {
    const span = p.t - prevT;
    if (prev > 0) homeLed += span;
    else if (prev < 0) awayLed += span;
    if (p.diff === 0 && prev !== 0) ties++;
    const leader = Math.sign(p.diff);
    if (leader !== 0 && lastLeader !== 0 && leader !== lastLeader) changes++;
    if (leader !== 0) lastLeader = leader;
    bigHome = Math.max(bigHome, p.diff);
    bigAway = Math.max(bigAway, -p.diff);
    prev = p.diff;
    prevT = p.t;
  }
  const live = g.state === "in";
  const end = g.state === "post" ? total : lastT;
  if (prev > 0) homeLed += end - prevT;
  else if (prev < 0) awayLed += end - prevT;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const { home, away } = rivalColors(g.home.team, g.away.team);
  const front = homeLed >= awayLed ? g.home.team.name : g.away.team.name;
  return html`<section class="flow">
    <h2>${live ? "Who has it, and since when" : "Who had it, and when"}</h2>
    <p>${front} ${live ? "has led" : "led"} for ${mmss(Math.max(homeLed, awayLed))}. ${changes} lead change${changes === 1 ? "" : "s"}, ${ties} tie${ties === 1 ? "" : "s"}. ${
      bigHome && bigAway
        ? `Biggest leads: ${g.home.team.abbr} by ${bigHome}, ${g.away.team.abbr} by ${bigAway}.`
        : `${bigHome ? g.away.team.name : g.home.team.name} ${live ? "has not led" : "never led"}; the biggest gap ${live ? "has been" : "was"} ${Math.max(bigHome, bigAway)}.`
    }</p>
    ${flowChart(points, total, d.periodSeconds, home, away, g.home.team.abbr, g.away.team.abbr, end, matchMedia("(max-width: 560px)").matches)}
  </section>`;
}

const CMP: Array<[key: string, label: string]> = [
  ["fieldGoalPct", "FG%"],
  ["threePointFieldGoalPct", "3PT%"],
  ["freeThrowPct", "FT%"],
  ["totalRebounds", "Rebounds"],
  ["offensiveRebounds", "Off. boards"],
  ["assists", "Assists"],
  ["turnovers", "Turnovers"],
  ["steals", "Steals"],
  ["blocks", "Blocks"],
  ["pointsInPaint", "Paint pts"],
  ["fastBreakPoints", "Fast break"],
];

const ATTEMPTS: Record<string, string> = {
  fieldGoalPct: "fieldGoalsMade-fieldGoalsAttempted",
  threePointFieldGoalPct: "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
  freeThrowPct: "freeThrowsMade-freeThrowsAttempted",
};

function compare(d: GameDetail): Markup {
  const g = d.game;
  const a = d.box.find((b) => b.teamId === g.away.team.id)?.stats ?? {};
  const h = d.box.find((b) => b.teamId === g.home.team.id)?.stats ?? {};
  const rows = CMP.filter(([key]) => a[key] && h[key]);
  if (!rows.length) return html``;
  const { home: ch, away: ca } = rivalColors(g.home.team, g.away.team);
  return html`<section class="sheet">
    <div class="sheet__head"><h2>Tale of the tape</h2><small>${g.away.team.name} left, ${g.home.team.name} right</small></div>
    <div class="cmp" style="--a:${ca};--b:${ch}">
      ${rows.map(([key, label]) => {
        const show = (stats: typeof a) => (ATTEMPTS[key] ? pctOrDash(stats[key]!.value, stats[ATTEMPTS[key]!]?.value) : stats[key]!.value);
        const av = parseFloat(show(a)) || 0;
        const hv = parseFloat(show(h)) || 0;
        const max = Math.max(av, hv) || 1;
        return html`<div class="cmp__row">
          <span>${show(a)}</span>
          <i class="cmp__a" style="transform:scaleX(${(av / max).toFixed(3)})"></i>
          <b>${label}</b>
          <i class="cmp__b" style="transform:scaleX(${(hv / max).toFixed(3)})"></i>
          <span>${show(h)}</span>
        </div>`;
      })}
    </div>
  </section>`;
}

/** Before the tip there is no box score, so show how each side has been
 *  playing. Only a game that has not started pays for this code. */
function askForm(d: GameDetail): void {
  if (formAsked) return;
  formAsked = true;
  import("../lib/form-guide.js")
    .then((m) => m.formGuide(d.game, id))
    .then((markup) => {
      form = markup;
      const slot = document.querySelector("#form-slot");
      if (slot) mount(slot, form);
    })
    .catch(() => undefined);
}

function boxTable(box: BoxTeam, side: Side, live: boolean): Markup {
  if (!box.players.length) return html``;
  const ptsCol = box.labels.findIndex((l) => l.toUpperCase() === "PTS");
  const row = (p: BoxTeam["players"][number]) =>
    html`<tr><td class="l"><span class="who"><span>${p.name} <small>${p.pos}</small></span></span></td>${
      p.dnp ? html`<td class="l" colspan="${box.labels.length}"><small>${live ? "Not in yet" : "Did not play"}</small></td>` : p.stats.map((s, i) => html`<td class="${i === ptsCol ? "hot" : ""}">${s}</td>`)
    }</tr>`;
  const starters = box.players.filter((p) => p.starter);
  const bench = box.players.filter((p) => !p.starter);
  return html`<section class="sheet">
    <div class="sheet__head"><h2>${side.team.name}</h2><small>${side.record}</small></div>
    <div class="sheet__scroll" tabindex="0" role="region" aria-label="${side.team.name} box score"><table>
      <thead><tr><th class="l">Starters</th>${box.labels.map((l) => html`<th>${l}</th>`)}</tr></thead>
      <tbody>${starters.map(row)}</tbody>
      ${bench.length ? html`<thead><tr><th class="l">Bench</th>${box.labels.map((l) => html`<th>${l}</th>`)}</tr></thead><tbody>${bench.map(row)}</tbody>` : ""}
      ${box.totals.length ? html`<tfoot><tr><td class="l"><b>Team</b></td>${box.totals.map((t) => html`<td><b>${t}</b></td>`)}</tr></tfoot>` : ""}
    </table></div>
  </section>`;
}

/** How many plays a period shows before it is asked for the rest. A full game
 *  is 500 rows; laying all of them out was most of this page's load. */
const FIRST_PLAYS = 40;
let shown: GameDetail | null = null;
const fullPeriods = new Set<number>();

function periodPlays(d: GameDetail, period: number): Markup {
  const g = d.game;
  const plays = d.plays.filter((p) => p.period === period).reverse();
  const cut = fullPeriods.has(period) ? plays : plays.slice(0, FIRST_PLAYS);
  return html`${cut.map(
    (p) => html`<li ${raw(p.scoring ? "data-score" : "")}><span class="t">${p.clock}</span><span class="s">${p.away}-${p.home}</span><span>${
      p.teamId ? html`<b>${p.teamId === g.home.team.id ? g.home.team.abbr : g.away.team.abbr}</b> ` : ""
    }${p.text}</span></li>`,
  )}${
    plays.length > cut.length
      ? html`<li class="pbp__more"><button type="button" data-more="${period}">Show the other ${plays.length - cut.length} plays</button></li>`
      : ""
  }`;
}

function playByPlay(d: GameDetail): Markup {
  if (!d.plays.length) return html``;
  const periods = [...new Set(d.plays.map((p) => p.period))].sort((a, b) => b - a);
  openPeriods ??= new Set([periods[0]!]);
  return html`<section class="sheet" id="pbp">
    <div class="sheet__head"><h2>Play by play</h2><small>${d.plays.length} plays, newest first</small></div>
    ${periods.map(
      (period) => html`<details data-period="${period}" ${openPeriods?.has(period) ? html`open` : ""}>
        <summary class="pbp-sum">${periodLabel(period)} ${period <= 2 ? "half" : ""}</summary>
        <ol class="pbp" tabindex="0" aria-label="${periodLabel(period)} ${period <= 2 ? "half" : ""} plays">${
          // A closed period costs nothing until someone opens it.
          openPeriods?.has(period) ? periodPlays(d, period) : ""
        }</ol>
      </details>`,
    )}
  </section>`;
}

function paint(d: GameDetail, saved = false): void {
  const g = d.game;
  shown = d;
  document.title = `${g.away.team.name} ${g.away.score ?? ""} at ${g.home.team.name} ${g.home.score ?? ""} — Field House`.replace(/\s+/g, " ");
  const awayBox = d.box.find((b) => b.teamId === g.away.team.id);
  const homeBox = d.box.find((b) => b.teamId === g.home.team.id);
  mount(
    root,
    html`<h1 class="sr-only">${g.away.team.name} at ${g.home.team.name}</h1>${board(d)}
      <div class="game-cols">
        ${flow(d)}
        ${compare(d)}
        ${awayBox ? boxTable(awayBox, g.away, g.state === "in") : ""}
        ${homeBox ? boxTable(homeBox, g.home, g.state === "in") : ""}
        ${playByPlay(d)}
        ${
          g.state === "pre" && !saved
            ? html`<div id="form-slot">${form ?? ""}</div>
                <p class="also"><b>Not tipped yet.</b> The box score and play-by-play fill in here once the ball goes up. This page refreshes itself.</p>`
            : ""
        }
        ${d.officials.length ? html`<p class="also"><b>Officials:</b> ${d.officials.join(", ")}</p>` : ""}
      </div>`,
  );
  if (g.state === "pre" && !saved) askForm(d);
}

root.addEventListener(
  "toggle",
  (event) => {
    const el = event.target as HTMLDetailsElement;
    if (!el.dataset.period || !openPeriods) return;
    const period = Number(el.dataset.period);
    if (el.open) openPeriods.add(period);
    else openPeriods.delete(period);
    const list = el.querySelector("ol");
    if (el.open && list && !list.childElementCount && shown) mount(list, periodPlays(shown, period));
  },
  true,
);

root.addEventListener("click", (event) => {
  const more = (event.target as Element).closest<HTMLElement>("[data-more]");
  const list = more?.closest("ol");
  if (!more || !list || !shown) return;
  fullPeriods.add(Number(more.dataset.more));
  mount(list, periodPlays(shown, Number(more.dataset.more)));
  list.focus(); // the button is gone; keep the keyboard in the list it was in
});

if (!/^\d+$/.test(id)) {
  mount(root, html`<div class="empty-state"><h2>Which game?</h2><p>Pick one from <a href="./games.html">the scoreboard</a>.</p></div>`);
} else {
  // The saved slate usually knows this game: put its scoreboard up at once and
  // let the box score and plays arrive under it.
  snapshot("scoreboard")
    .then((s) => {
      const game = s.data.games.find((g) => g.id === id);
      if (game && !shown) {
        mount(root, html`<h1 class="sr-only">${game.away.team.name} at ${game.home.team.name}</h1>${board({ game, box: [], plays: [], winProb: [], attendance: null, officials: [], periodSeconds: 1200 })}<p class="loading" role="status">Fetching the box score…</p>`);
      }
    })
    .catch(() => undefined);
  feed<GameDetail | null>({
    live: () => espn.summary(id),
    render(data) {
      if (data) paint(data);
      else mount(root, missing("game", "./games.html", "the scoreboard"));
    },
    // ESPN is not answering. If the game is on the saved scoreboard, show what
    // we knew about it then instead of an empty page.
    fail: (error) =>
      snapshot("scoreboard")
        .then((s) => {
          const game = s.data.games.find((g) => g.id === id);
          if (!game) throw error;
          paint({ game, box: [], plays: [], winProb: [], attendance: null, officials: [], periodSeconds: 1200 }, true);
          root.insertAdjacentHTML(
            "afterbegin",
            String(html`<p class="notice" role="status">ESPN's feed didn't answer just now. This is the scoreboard as saved ${fmtStamp(s.at)}; the box score is not on file. <a href="">Try again</a>.</p>`),
          );
        })
        .catch(() => mount(root, notFound(error) ? missing("game", "./games.html", "the scoreboard") : failure("that game"))),
    refreshMs: (data) => (data?.game.state === "in" ? 20_000 : data?.game.state === "pre" ? 120_000 : 0),
  });
}
