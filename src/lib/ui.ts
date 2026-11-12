// Shared renderers and formatters.
import { html, raw, type Markup } from "./dom.js";
import type { FeedInfo } from "./data.js";
import type { Game, Side, Team } from "./espn.js";

const INK = "#14213a";
const LINE = "#fbfaf4";

function luminance(hexColor: string): number {
  const n = parseInt(hexColor.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** A team's paint colour and a readable ink for text on it. Near-white
 *  primaries fall back to the alternate colour so banners don't vanish. */
export function teamColors(team: Pick<Team, "color" | "alt">): { paint: string; ink: string } {
  let paint = team.color || INK;
  if (luminance(paint) > 0.8 && team.alt && luminance(team.alt) < 0.8) paint = team.alt;
  if (luminance(paint) < 0.012) paint = INK; // a school's black reads as our navy ink
  return { paint, ink: luminance(paint) > 0.42 ? INK : LINE };
}

function rgb(hexColor: string): [number, number, number] {
  const n = parseInt(hexColor.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Two paints for a head-to-head chart that a reader can tell apart, even
 *  when both schools wear red. Home keeps its colour; away gives way. */
export function rivalColors(home: Pick<Team, "color" | "alt">, away: Pick<Team, "color" | "alt">): { home: string; away: string } {
  const h = teamColors(home).paint;
  const far = (c: string) => {
    const [r1, g1, b1] = rgb(h);
    const [r2, g2, b2] = rgb(c);
    return Math.hypot(r1 - r2, g1 - g2, b1 - b2) > 110 && luminance(c) < 0.75;
  };
  const candidates = [teamColors(away).paint, away.alt, "#4d5a78", INK].filter((c): c is string => Boolean(c));
  return { home: h, away: candidates.find(far) ?? "#4d5a78" };
}

export function teamStyle(team: Pick<Team, "color" | "alt">): string {
  const { paint, ink } = teamColors(team);
  return `--team:${paint};--team-ink:${ink}`;
}

/** ESPN's image combiner serves any team logo at any size; a local 32px copy
 *  and then a lettered disc back it up (see the error handler in chrome.ts). */
export function logoUrl(id: string, px: number): string {
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${encodeURIComponent(id)}.png&h=${px}&w=${px}`;
}

export function logo(team: Pick<Team, "id" | "abbr" | "name">, cls = "logo", px = 56): Markup {
  if (!team.id) return html`<span class="${cls} logo--blank" aria-hidden="true">${team.abbr.slice(0, 3)}</span>`;
  return html`<img class="${cls}" src="${logoUrl(team.id, px)}" data-team="${team.id}" data-abbr="${team.abbr}" alt="" width="${px / 2}" height="${px / 2}" loading="lazy" decoding="async">`;
}

export const teamHref = (id: string) => `./team.html?id=${encodeURIComponent(id)}`;
export const gameHref = (id: string) => `./game.html?id=${encodeURIComponent(id)}`;

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const shortDayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const longDayFmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const stampFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export const fmtTime = (iso: string) => (iso ? timeFmt.format(new Date(iso)) : "");
export const fmtDay = (iso: string) => (iso ? dayFmt.format(new Date(iso)) : "");
export const fmtShortDay = (iso: string) => (iso ? shortDayFmt.format(new Date(iso)) : "");
export const fmtLongDay = (d: Date) => longDayFmt.format(d);
export const fmtStamp = (iso: string) => (iso ? stampFmt.format(new Date(iso)) : "");

/** College hoops lives on Eastern time; ESPN's "day" does too. */
export function easternYmd(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return parts.replace(/-/g, "");
}

export function ymdToDate(ymd: string): Date {
  return new Date(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)), 12);
}

export function shiftYmd(ymd: string, days: number): string {
  const d = ymdToDate(ymd);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export function periodLabel(period: number): string {
  if (period <= 0) return "";
  if (period === 1) return "1st";
  if (period === 2) return "2nd";
  return period === 3 ? "OT" : `${period - 2}OT`;
}

function stub(game: Game): Markup {
  if (game.state === "post") {
    const extra = /\bOT\b|\d+OT/i.exec(game.detail)?.[0] ?? "";
    return html`<b>Final</b>${extra ? html`<span>${extra}</span>` : ""}`;
  }
  if (game.state === "in") {
    if (/half/i.test(game.detail) && !/\d:\d/.test(game.detail)) return html`<b>Half</b><span>Live</span>`;
    return html`<b>${game.clock || "Live"}</b><span>${periodLabel(game.period) || "Live"}</span>`;
  }
  if (/postponed|canceled|cancelled/i.test(game.detail)) return html`<b>Off</b><span>${game.detail.slice(0, 9)}</span>`;
  if (/TBD/i.test(game.detail)) return html`<b>TBD</b>`;
  const [clock = "", meridiem = ""] = fmtTime(game.date).split(/\s+/);
  return html`<b>${clock}</b><span>${meridiem}</span>`;
}

function sideRow(side: Side, other: Side, state: Game["state"]): Markup {
  const decided = state === "post" && side.score !== null && other.score !== null;
  const won = decided && (side.winner || (side.score ?? 0) > (other.score ?? 0));
  const lost = decided && !won;
  return html`<div class="side" ${raw(won ? "data-won" : lost ? "data-lost" : "")}>
    ${logo(side.team)}
    <span class="side__name">${side.rank ? html`<span class="rk">${side.rank}</span>` : ""}${side.team.short || side.team.name}${
      side.record ? html`<small>${side.record}</small>` : ""
    }</span>
    <span class="side__score">${side.score ?? ""}</span>
  </div>`;
}

export function ticket(game: Game): Markup {
  const where = [game.tv, game.neutral ? game.city : ""].filter(Boolean).join(" · ") || game.venue;
  const tag = game.state === "pre" ? game.odds : game.state === "in" && game.tv ? "" : "";
  const label = `${game.away.team.name} at ${game.home.team.name}, ${game.detail}`;
  return html`<a class="ticket" href="${gameHref(game.id)}" data-state="${game.state}" data-id="${game.id}" aria-label="${label}">
    <div class="ticket__stub">${stub(game)}</div>
    <div class="ticket__body">
      ${sideRow(game.away, game.home, game.state)}
      ${sideRow(game.home, game.away, game.state)}
      <div class="ticket__foot"><span>${game.note || where}</span>${tag ? html`<span class="tag">${tag}</span>` : ""}</div>
    </div>
  </a>`;
}

/** How much a neutral fan should care right now. Bigger floats to the top. */
export function drama(game: Game): number {
  // Any ranked team outweighs tip time; a better rank outweighs a worse one.
  const ranked = (game.home.rank ? 46 - game.home.rank : 0) + (game.away.rank ? 46 - game.away.rank : 0);
  const both = game.home.rank && game.away.rank ? 30 : 0;
  const margin = Math.abs((game.home.score ?? 0) - (game.away.score ?? 0));
  if (game.state === "in") {
    const late = game.period >= 2 ? 40 : 0;
    const overtime = game.period > 2 ? 60 : 0;
    return 1000 + late + overtime + Math.max(0, 30 - margin * 2) + ranked + both;
  }
  if (game.state === "pre") return 500 + ranked * 2 + both - Math.min(40, Math.max(0, (Date.parse(game.date) - Date.now()) / 36e5));
  const upset = (game.home.rank && !game.home.winner && !game.away.rank) || (game.away.rank && !game.away.winner && !game.home.rank) ? 45 : 0;
  const overtime = /OT/i.test(game.detail) ? 30 : 0;
  return Math.max(0, 24 - margin * 2) + ranked * 1.5 + both + upset + overtime;
}

/** The little amber note that says when the page is not showing live data. */
export function staleNote(info: FeedInfo): Markup | "" {
  if (info.live) return "";
  return html`<p class="notice" role="status">${
    info.stale ? "ESPN's feed didn't answer just now. " : ""
  }Showing the copy saved ${fmtStamp(info.at)}.</p>`;
}

export function failure(what: string, error: unknown): Markup {
  const detail = error instanceof Error ? error.message : String(error);
  return html`<div class="empty-state" role="alert">
    <h2>Whistle on the play</h2>
    <p>We couldn't load ${what}. ESPN's public feed may be down or blocked on your network. <a href="">Try again</a>.</p>
    <p><small>${detail}</small></p>
  </div>`;
}

export const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
