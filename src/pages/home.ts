import "../lib/chrome.js";
import { feed, snapshot, type FeedInfo } from "../lib/data.js";
import { $, html, mount, onSegment, segmented } from "../lib/dom.js";
import { espn, type Game, type Poll } from "../lib/espn.js";
import { drama, failure, fmtLongDay, logo, staleNote, teamHref, ticket } from "../lib/ui.js";

type Order = "best" | "time";
const ORDER_KEY = "fh:order";
let order: Order = localStorage.getItem(ORDER_KEY) === "time" ? "time" : "best";
let games: Game[] = [];
let info: FeedInfo = { live: false, at: "", stale: false };

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function paintHero(): void {
  const first = games[0];
  const day = first ? new Date(first.date) : new Date();
  mount("#hero-date", html`${fmtLongDay(day)}`);
  const live = games.filter((g) => g.state === "in").length;
  const done = games.filter((g) => g.state === "post").length;
  const ranked = games.filter((g) => g.home.rank || g.away.rank).length;
  if (!games.length) {
    mount("#hero-tally", html`The gym is dark. No Division I games on the schedule today.`);
    return;
  }
  const bits = [
    html`<b>${plural(games.length, "game")}</b> on the slate`,
    live ? html`<b>${live}</b> live right now` : done === games.length ? html`all of them final` : done ? html`<b>${done}</b> in the books` : "",
    ranked ? html`<b>${ranked}</b> with a ranked team` : "",
  ].filter(Boolean);
  mount("#hero-tally", html`${bits.map((b, i) => html`${i ? ", " : ""}${b}`)}.`);
}

function paintGames(): void {
  const sorted = [...games].sort((a, b) => (order === "best" ? drama(b) - drama(a) : 0) || a.date.localeCompare(b.date));
  mount(
    "#home-games",
    games.length
      ? html`${sorted.map(ticket)}`
      : html`<div class="empty-state"><h2>No games today</h2><p>Check <a href="./games.html">the full schedule</a> for the next tip.</p></div>`,
  );
  const host = $("#home-games");
  host.parentElement?.querySelectorAll(":scope > .notice").forEach((n) => n.remove());
  const note = staleNote(info);
  if (note) host.insertAdjacentHTML("beforebegin", String(note));
}

function movement(rank: number, prev: number) {
  if (!prev) return html`<span class="mv up" title="New this week">new</span>`;
  const delta = prev - rank;
  if (delta === 0) return html`<span class="mv flat" aria-label="No change">–</span>`;
  return delta > 0
    ? html`<span class="mv up" aria-label="Up ${delta}">▲${delta}</span>`
    : html`<span class="mv down" aria-label="Down ${-delta}">▼${-delta}</span>`;
}

function paintPoll(polls: Poll[]): void {
  const poll = polls.find((p) => p.id === "ap") ?? polls[0];
  if (!poll) return;
  $("#poll-h").textContent = "In the rafters";
  mount(
    "#home-poll",
    html`<ol class="poll-list" aria-label="${poll.name}, ${poll.week}">
      ${poll.ranks.map(
        (r) => html`<li>
          <span class="pos">${r.rank}</span>
          ${logo(r.team)}
          <a href="${teamHref(r.team.id)}">${r.team.name}</a>
          <small>${r.record}</small>
          ${movement(r.rank, r.prev)}
        </li>`,
      )}
    </ol>`,
  );
}

mount("#home-sort", segmented([{ value: "best", label: "Best first" }, { value: "time", label: "By tip time" }], order));
onSegment($("#home-sort"), (value) => {
  order = value === "time" ? "time" : "best";
  localStorage.setItem(ORDER_KEY, order);
  paintGames();
});

feed<Game[]>({
  saved: () => snapshot("scoreboard").then((s) => ({ at: s.at, data: s.data.games })),
  live: () => espn.scoreboard(),
  render(data, meta) {
    games = data;
    info = meta;
    paintHero();
    paintGames();
  },
  fail: (error) => {
    mount("#home-games", failure("tonight's games", error));
    mount("#hero-tally", html`The scorer's table isn't answering.`);
  },
  refreshMs: (data) => (data.some((g) => g.state === "in") ? 30_000 : 300_000),
});

feed<Poll[]>({
  saved: () => snapshot("rankings"),
  live: () => espn.rankings(),
  render: paintPoll,
  fail: (error) => mount("#home-poll", failure("the poll", error)),
});

feed({
  saved: () => snapshot("news"),
  live: () => espn.news(),
  render(items) {
    if (!items.length) return;
    $("#home-news-wrap").hidden = false;
    mount(
      "#home-news",
      html`${items.slice(0, 6).map((n) => html`<li><a href="${n.url}" rel="noopener">${n.headline}<small>ESPN</small></a></li>`)}`,
    );
  },
  fail: () => undefined,
});
