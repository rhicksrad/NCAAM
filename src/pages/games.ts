import "../lib/chrome.js";
import { feed, snapshot, type FeedInfo } from "../lib/data.js";
import { $, html, mount, onSegment, param, segmented, setParams } from "../lib/dom.js";
import { espn, type Game } from "../lib/espn.js";
import { drama, easternYmd, failure, fmtLongDay, shiftYmd, staleNote, ticket, ymdToDate } from "../lib/ui.js";

const today = easternYmd();
let day = /^\d{8}$/.test(param("date") ?? "") ? (param("date") as string) : today;
let filter = param("show") ?? "all";
let games: Game[] = [];
let info: FeedInfo = { live: false, at: "", stale: false };
let current: { refresh: () => void } | null = null;
let generation = 0;

const wk = new Intl.DateTimeFormat(undefined, { weekday: "short" });

function paintStrip(): void {
  const days = Array.from({ length: 11 }, (_, i) => shiftYmd(day, i - 5));
  mount(
    "#datestrip",
    html`<a href="?date=${shiftYmd(day, -7)}" data-day="${shiftYmd(day, -7)}" aria-label="Back one week"><b>‹</b></a>
      <div class="datestrip__days">
        ${days.map((d) => {
          const date = ymdToDate(d);
          return html`<a href="?date=${d}" data-day="${d}" ${d === day ? html`aria-current="date"` : ""} ${d === today ? html`data-today` : ""}>
            <small>${d === today ? "Today" : wk.format(date)}</small><b>${date.getDate()}</b>
          </a>`;
        })}
      </div>
      <a href="?date=${shiftYmd(day, 7)}" data-day="${shiftYmd(day, 7)}" aria-label="Forward one week"><b>›</b></a>
      <label>Pick<input type="date" aria-label="Jump to a date" value="${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}"></label>`,
  );
  $("#datestrip").querySelector('[aria-current="date"]')?.scrollIntoView({ block: "nearest", inline: "center" });
}

function paint(): void {
  const shown = games.filter((g) =>
    filter === "ranked" ? g.home.rank || g.away.rank : filter === "live" ? g.state === "in" : filter === "close" ? isClose(g) : true,
  );
  const sorted = [...shown].sort((a, b) => {
    const rank = (g: Game) => (g.state === "in" ? 0 : g.state === "pre" ? 1 : 2);
    return rank(a) - rank(b) || a.date.localeCompare(b.date) || drama(b) - drama(a);
  });
  $("#games-sub").textContent = `${fmtLongDay(ymdToDate(day))}. ${games.length} game${games.length === 1 ? "" : "s"}${
    shown.length !== games.length ? `, ${shown.length} shown` : ""
  }.`;
  mount(
    "#games-list",
    html`${staleNote(info)}${
      sorted.length
        ? sorted.map(ticket)
        : html`<div class="empty-state"><h2>${games.length ? "Nothing matches" : "No games"}</h2><p>${
            games.length ? "Try a different filter." : "Nobody tips off on this date. Try another day."
          }</p></div>`
    }`,
  );
}

function isClose(g: Game): boolean {
  return g.state !== "pre" && g.home.score !== null && g.away.score !== null && Math.abs(g.home.score - g.away.score) <= 5;
}

function load(): void {
  const mine = ++generation;
  mount("#games-list", html`<p class="loading" role="status">Loading the slate…</p>`);
  current = feed<Game[]>({
    saved: day === today ? () => snapshot("scoreboard").then((s) => ({ at: s.at, data: s.data.day === day || !s.data.day ? s.data.games : [] })) : undefined,
    live: () => espn.scoreboard(day),
    render(data, meta) {
      if (mine !== generation) return;
      if (!meta.live && !data.length) return;
      games = data;
      info = meta;
      paint();
    },
    fail: (error) => mine === generation && mount("#games-list", failure("that day's games", error)),
    refreshMs: (data) => (mine === generation && data.some((g) => g.state === "in") ? 30_000 : 0),
  });
}

function go(next: string): void {
  if (!/^\d{8}$/.test(next) || next === day) return;
  day = next;
  setParams({ date: day === today ? null : day });
  paintStrip();
  load();
}

$("#datestrip").addEventListener("click", (event) => {
  const link = (event.target as Element).closest<HTMLAnchorElement>("a[data-day]");
  if (!link || event.metaKey || event.ctrlKey) return;
  event.preventDefault();
  go(link.dataset.day ?? "");
});
$("#datestrip").addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  if (input.type === "date" && input.value) go(input.value.replace(/-/g, ""));
});
document.addEventListener("keydown", (event) => {
  if ((event.target as HTMLElement).closest("input,select,dialog")) return;
  if (event.key === "ArrowLeft") go(shiftYmd(day, -1));
  if (event.key === "ArrowRight") go(shiftYmd(day, 1));
});

mount(
  "#games-tools",
  html`<div class="segmented" id="games-filter" role="group" aria-label="Show">${segmented(
    [
      { value: "all", label: "All" },
      { value: "ranked", label: "Top 25" },
      { value: "live", label: "Live" },
      { value: "close", label: "Within 5" },
    ],
    filter,
  )}</div>`,
);
onSegment($("#games-filter"), (value) => {
  filter = value;
  setParams({ show: value === "all" ? null : value });
  paint();
});

paintStrip();
load();
void current;
