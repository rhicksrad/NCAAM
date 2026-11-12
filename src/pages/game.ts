import "../lib/chrome.js";
import { feed } from "../lib/data.js";
import { $, html, mount, param, raw, type Markup } from "../lib/dom.js";
import { espn, type BoxTeam, type GameDetail, type Play, type Side } from "../lib/espn.js";
import { flowChart, type FlowPoint } from "../lib/charts.js";
import { failure, fmtDay, fmtTime, logoUrl, periodLabel, teamColors, teamHref } from "../lib/ui.js";

const id = param("id") ?? "";
const root = $("#game-root");
let openPeriods: Set<number> | null = null;

function boardTeam(side: Side): Markup {
  const { paint } = teamColors(side.team);
  return html`<a class="board__team" href="${teamHref(side.team.id)}" style="--team:${paint}">
    <img src="${logoUrl(side.team.id, 160)}" data-team="${side.team.id}" data-abbr="${side.team.abbr}" alt="" width="80" height="80">
    <b>${side.rank ? html`<span class="rk">${side.rank}</span>` : ""}${side.team.name}</b>
    <small>${side.record}</small>
  </a>`;
}

function board(d: GameDetail): Markup {
  const g = d.game;
  const played = g.state !== "pre";
  const lead = (g.home.score ?? 0) - (g.away.score ?? 0);
  const periods = Math.max(g.home.lines.length, g.away.lines.length);
  const status =
    g.state === "pre" ? `${fmtDay(g.date)} · ${fmtTime(g.date)}` : g.state === "in" ? `${g.clock} ${periodLabel(g.period)}`.trim() || g.detail : g.detail;
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
            <thead><tr><th></th>${Array.from({ length: periods }, (_, i) => html`<th>${periods === 2 || i < 2 ? i + 1 : i === 2 ? "OT" : `${i - 1}OT`}</th>`)}<th>T</th></tr></thead>
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
  const end = g.state === "post" ? total : lastT;
  if (prev > 0) homeLed += end - prevT;
  else if (prev < 0) awayLed += end - prevT;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const home = teamColors(g.home.team).paint;
  let away = teamColors(g.away.team).paint;
  if (away === home) away = g.away.team.alt && g.away.team.alt !== home ? g.away.team.alt : "#4d5a78";
  const front = homeLed >= awayLed ? g.home.team.name : g.away.team.name;
  return html`<section class="flow">
    <h2>Who had it, and when</h2>
    <p>${front} led for ${mmss(Math.max(homeLed, awayLed))}. ${changes} lead change${changes === 1 ? "" : "s"}, ${ties} tie${ties === 1 ? "" : "s"}. Biggest leads: ${
      g.home.team.abbr
    } by ${bigHome}, ${g.away.team.abbr} by ${bigAway}.</p>
    ${flowChart(points, total, d.periodSeconds, home, away, g.home.team.abbr, g.away.team.abbr)}
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

function compare(d: GameDetail): Markup {
  const g = d.game;
  const a = d.box.find((b) => b.teamId === g.away.team.id)?.stats ?? {};
  const h = d.box.find((b) => b.teamId === g.home.team.id)?.stats ?? {};
  const rows = CMP.filter(([key]) => a[key] && h[key]);
  if (!rows.length) return html``;
  const ca = teamColors(g.away.team).paint;
  let ch = teamColors(g.home.team).paint;
  if (ca === ch) ch = "#4d5a78";
  return html`<section class="sheet">
    <div class="sheet__head"><h2>Tale of the tape</h2><small>${g.away.team.abbr} left, ${g.home.team.abbr} right</small></div>
    <div class="cmp" style="--a:${ca};--b:${ch}">
      ${rows.map(([key, label]) => {
        const av = parseFloat(a[key]!.value) || 0;
        const hv = parseFloat(h[key]!.value) || 0;
        const sum = av + hv || 1;
        return html`<div class="cmp__row"><span>${a[key]!.value}</span><div class="cmp__bar"><i style="width:calc(${((av / sum) * 100).toFixed(1)}% - 2px)"></i><i style="width:calc(${(
          (hv / sum) *
          100
        ).toFixed(1)}% - 2px)"></i><span>${label}</span></div><span>${h[key]!.value}</span></div>`;
      })}
    </div>
  </section>`;
}

function boxTable(box: BoxTeam, side: Side): Markup {
  if (!box.players.length) return html``;
  const ptsCol = box.labels.findIndex((l) => l.toUpperCase() === "PTS");
  const row = (p: BoxTeam["players"][number]) =>
    html`<tr><td class="l"><span class="who"><span>${p.name} <small>${p.pos}</small></span></span></td>${
      p.dnp ? html`<td class="l" colspan="${box.labels.length}"><small>Did not play</small></td>` : p.stats.map((s, i) => html`<td class="${i === ptsCol ? "hot" : ""}">${s}</td>`)
    }</tr>`;
  const starters = box.players.filter((p) => p.starter);
  const bench = box.players.filter((p) => !p.starter);
  return html`<section class="sheet">
    <div class="sheet__head"><h2>${side.team.name}</h2><small>${side.record}</small></div>
    <div class="sheet__scroll"><table>
      <thead><tr><th class="l">Starters</th>${box.labels.map((l) => html`<th>${l}</th>`)}</tr></thead>
      <tbody>${starters.map(row)}</tbody>
      ${bench.length ? html`<thead><tr><th class="l">Bench</th>${box.labels.map((l) => html`<th>${l}</th>`)}</tr></thead><tbody>${bench.map(row)}</tbody>` : ""}
      ${box.totals.length ? html`<tfoot><tr><td class="l"><b>Team</b></td>${box.totals.map((t) => html`<td><b>${t}</b></td>`)}</tr></tfoot>` : ""}
    </table></div>
  </section>`;
}

function playByPlay(d: GameDetail): Markup {
  if (!d.plays.length) return html``;
  const byPeriod = new Map<number, Play[]>();
  for (const p of d.plays) {
    const list = byPeriod.get(p.period) ?? [];
    list.push(p);
    byPeriod.set(p.period, list);
  }
  const latest = Math.max(...byPeriod.keys());
  openPeriods ??= new Set([latest]);
  const g = d.game;
  return html`<section class="sheet" id="pbp">
    <div class="sheet__head"><h2>Play by play</h2><small>${d.plays.length} plays, newest first</small></div>
    ${[...byPeriod.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(
        ([period, plays]) => html`<details data-period="${period}" ${openPeriods?.has(period) ? html`open` : ""}>
          <summary class="pbp-sum">${periodLabel(period)} ${period <= 2 ? "half" : ""}</summary>
          <ol class="pbp">
            ${[...plays].reverse().map(
              (p) => html`<li ${raw(p.scoring ? "data-score" : "")}><span class="t">${p.clock}</span><span class="s">${p.away}-${p.home}</span><span>${
                p.teamId ? html`<b>${p.teamId === g.home.team.id ? g.home.team.abbr : g.away.team.abbr}</b> ` : ""
              }${p.text}</span></li>`,
            )}
          </ol>
        </details>`,
      )}
  </section>`;
}

function paint(d: GameDetail): void {
  const g = d.game;
  document.title = `${g.away.team.name} ${g.away.score ?? ""} at ${g.home.team.name} ${g.home.score ?? ""} — Field House`.replace(/\s+/g, " ");
  const awayBox = d.box.find((b) => b.teamId === g.away.team.id);
  const homeBox = d.box.find((b) => b.teamId === g.home.team.id);
  mount(
    root,
    html`${board(d)}
      <div class="game-cols">
        ${flow(d)}
        ${compare(d)}
        ${awayBox ? boxTable(awayBox, g.away) : ""}
        ${homeBox ? boxTable(homeBox, g.home) : ""}
        ${playByPlay(d)}
        ${
          g.state === "pre"
            ? html`<div class="empty-state"><h2>Not tipped yet</h2><p>The box score and play-by-play fill in here once the ball goes up. This page refreshes itself.</p></div>`
            : ""
        }
        ${d.officials.length ? html`<p class="also"><b>Officials:</b> ${d.officials.join(", ")}</p>` : ""}
      </div>`,
  );
}

root.addEventListener(
  "toggle",
  (event) => {
    const el = event.target as HTMLDetailsElement;
    if (!el.dataset.period || !openPeriods) return;
    if (el.open) openPeriods.add(Number(el.dataset.period));
    else openPeriods.delete(Number(el.dataset.period));
  },
  true,
);

if (!/^\d+$/.test(id)) {
  mount(root, html`<div class="empty-state"><h2>Which game?</h2><p>Pick one from <a href="./games.html">the scoreboard</a>.</p></div>`);
} else {
  feed<GameDetail | null>({
    live: () => espn.summary(id),
    render(data) {
      if (data) paint(data);
      else mount(root, failure("that game", "ESPN returned no game for this id"));
    },
    fail: (error) => mount(root, failure("that game", error)),
    refreshMs: (data) => (data?.game.state === "in" ? 20_000 : data?.game.state === "pre" ? 120_000 : 0),
  });
}
