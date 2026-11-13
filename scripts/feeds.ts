// The two feeds the browser never asks for itself, baked by snapshot.ts and
// folded in by derive-data.mjs:
//
//  - ESPN's season averages for every player. It is free and open to any
//    origin, but a full crawl is ~80 MB of JSON, so it is fetched once per
//    deploy, never per visit.
//  - Bart Torvik's ratings for the season in progress. His CSVs send no CORS
//    header, so they can only be read at build time.
//
// Everything here is pure and takes its fetcher as an argument, so the tests
// can run it against the recorded fixtures.

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const arr = (v: unknown): J[] => (Array.isArray(v) ? (v as J[]) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const fin = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** ESPN and Torvik both name a season by the year it ends: 2027 is 2026-27. */
export function seasonYear(now = new Date()): number {
  return now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}
export const seasonLabel = (year: number) => `${year - 1}-${String(year).slice(2)}`;

/* ---------- ESPN: every player's season averages ---------- */

export const statsUrl = (year: number, page: number, limit = 1000) =>
  `https://site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&sort=offensive.avgPoints:desc&season=${year}&seasontype=2&limit=${limit}&page=${page}`;

// id, name, ESPN team id, then per game: gp, min, pts, reb, ast, stl, blk, to, and fg/3p/ft as fractions
export type StatLine = [string, string, string, number, number, number, number, number, number, number, number, number | null, number | null, number | null];
export type StatPage = { year: number; count: number; pages: number; lines: StatLine[] };

/** One page of ESPN's by-athlete table. Stats are found by name, never by
 *  position: the labels repeat ("MIN" is both average and total). */
export function normalizeStatPage(json: J): StatPage {
  const names = new Map<string, string[]>();
  for (const c of arr(json?.categories)) names.set(str(c.name), arr(c.names).map(str));
  const lines: StatLine[] = [];
  for (const a of arr(json?.athletes)) {
    const blocks = new Map(arr(a.categories).map((c) => [str(c.name), arr(c.values)] as const));
    const get = (cat: string, stat: string) => fin(blocks.get(cat)?.[names.get(cat)?.indexOf(stat) ?? -1]);
    const per = (cat: string, stat: string) => r1(get(cat, stat) ?? 0);
    // ESPN sends percentages out of 100; the site keeps fractions, and a dash when nothing was tried.
    const pct = (stat: string, tries: string) => {
      const p = get("offensive", stat);
      return p !== undefined && (get("offensive", tries) ?? 0) > 0 ? Math.round(p * 10) / 1000 : null;
    };
    const who = a.athlete ?? {};
    const id = str(who.id), team = str(who.teamId), name = str(who.displayName) || str(who.shortName);
    const gp = get("general", "gamesPlayed") ?? 0;
    if (!id || !team || !name || gp < 1) continue;
    lines.push([
      id, name, team, gp, per("general", "avgMinutes"), per("offensive", "avgPoints"), per("general", "avgRebounds"),
      per("offensive", "avgAssists"), per("defensive", "avgSteals"), per("defensive", "avgBlocks"), per("offensive", "avgTurnovers"),
      pct("fieldGoalPct", "fieldGoalsAttempted"), pct("threePointFieldGoalPct", "threePointFieldGoalsAttempted"), pct("freeThrowPct", "freeThrowsAttempted"),
    ]);
  }
  return {
    year: fin(json?.requestedSeason?.year) ?? 0,
    count: fin(json?.pagination?.count) ?? lines.length,
    pages: fin(json?.pagination?.pages) ?? 1,
    lines,
  };
}

/** Every page of one season, a few at a time. Throws rather than return a
 *  partial table: a short crawl must fall back, not publish holes. */
export async function crawlStats(year: number, get: (url: string) => Promise<J>, { limit = 1000, pool = 3, maxPages = 40 } = {}): Promise<StatPage> {
  const first = normalizeStatPage(await get(statsUrl(year, 1, limit)));
  if (first.year && first.year !== year) throw new Error(`asked ESPN for ${year}, got ${first.year}`);
  if (first.pages > maxPages) throw new Error(`${first.pages} pages: ESPN ignored the page size`);
  const pages = [first];
  let next = 2;
  await Promise.all(
    Array.from({ length: pool }, async () => {
      while (next <= first.pages) pages.push(normalizeStatPage(await get(statsUrl(year, next++, limit))));
    }),
  );
  // Games end while the crawl runs and the sort shifts under it, so the same
  // player can turn up twice and another can slip between pages.
  const byId = new Map<string, StatLine>();
  for (const p of pages) for (const l of p.lines) byId.set(l[0], l);
  if (byId.size < first.count * 0.97) throw new Error(`only ${byId.size} of ${first.count} players`);
  return { ...first, lines: [...byId.values()] };
}

// ESPN's conference codes, as the Sports Reference archive spells them.
const CONF: Record<string, string> = {
  ACC: "ACC", AEAST: "AmEast", AMERICAN: "American", ASUN: "A-Sun", ATL10: "A-10", BELT: "Sun Belt", BIG10: "Big Ten",
  BIG12: "Big 12", BIGE: "Big East", BIGW: "Big West", BSKY: "Big Sky", BSOU: "Big South", COL: "CAA", HOR: "Horizon",
  IVY: "Ivy", LAND: "Southland", MEAC: "MEAC", METRO: "Metro", MIDAM: "MAC", MVC: "MVC", MWEST: "MWC", NEAST: "NEC",
  OVC: "OVC", PAC12: "Pac-12", PAT: "Patriot", SEC: "SEC", SOUTH: "Southern", SUMM: "Summit", SWAC: "SWAC", UAC: "UAC",
  USA: "CUSA", WCC: "WCC",
};
export const confLabel = (abbr: string, name = "") => CONF[abbr] ?? (name.replace(/ (Conference|League)$/, "") || abbr);

type TeamLite = { id: string; name: string; conf: string; confName: string };
// key, name, team, ESPN team id, conf, then the StatLine's numbers. The key is
// "e<ESPN id>" here; derive-data swaps in a Sports Reference career slug.
export type SheetRow = [string | 0, string, string, string, string, ...Array<number | null>];

/** Division I players only: ESPN's table also lists exhibition opponents. */
export function toSheet(lines: StatLine[], teams: TeamLite[]): SheetRow[] {
  const byId = new Map(teams.map((t) => [t.id, t]));
  const rows: SheetRow[] = [];
  for (const l of lines) {
    const t = byId.get(l[2]);
    if (t) rows.push([`e${l[0]}`, l[1], t.name, t.id, confLabel(t.conf, t.confName), ...(l.slice(3) as Array<number | null>)]);
  }
  // Grouped by school: the repeated school, id and conference then cost almost
  // nothing gzipped (~10 KB on a full season). Pages sort for themselves.
  return rows.sort((a, b) => a[3].localeCompare(b[3]) || (b[7] as number) - (a[7] as number));
}

/* ---------- Torvik: the season so far ---------- */

export const torvikUrl = (year: number, file: "team_results" | "fffinal") => `https://barttorvik.com/${year}_${file}.csv`;

/** A CSV line, honouring quotes. Torvik's files repeat header names, so
 *  callers find columns by position (first match wins), never by key. */
function csvRows(text: string): string[][] {
  return text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const out: string[] = [];
      let cell = "", quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (quoted) {
          if (ch === '"' && line[i + 1] === '"') (cell += '"'), i++;
          else if (ch === '"') quoted = false;
          else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") out.push(cell), (cell = "");
        else cell += ch;
      }
      out.push(cell);
      return out.map((c) => c.trim());
    });
}

// team, conf, w, g, adjO, adjD, barthag, tempo, 3P%, eFG% (percents, as the archive keeps them)
export type TorvikRow = [string, string, number, number, number, number, number, number, number | null, number | null];

/** team_results.csv (required) joined with fffinal.csv (optional, only for
 *  shooting). Teams that haven't played yet are left out: their numbers are
 *  pure preseason projection. */
export function parseTorvik(results: string, fourFactors = ""): TorvikRow[] {
  const [head = [], ...lines] = csvRows(results);
  const at = (name: string) => head.findIndex((h) => h.toLowerCase() === name);
  const col = { team: at("team"), conf: at("conf"), record: at("record"), o: at("adjoe"), d: at("adjde"), bart: at("barthag"), tempo: at("adjt") };
  if (Object.values(col).some((i) => i < 0)) throw new Error(`not a Torvik results file: ${head.slice(0, 5).join(",")}`);
  const ff = new Map<string, [number | null, number | null]>();
  const [ffHead = [], ...ffLines] = fourFactors ? csvRows(fourFactors) : [];
  const fTeam = ffHead.indexOf("TeamName"), fEfg = ffHead.indexOf("eFG%"), f3 = ffHead.indexOf("3P%");
  if (fTeam >= 0 && fEfg >= 0 && f3 >= 0) {
    for (const l of ffLines) {
      const efg = Number(l[fEfg]), three = Number(l[f3]);
      // Early in the year a team with no games is a row of zeros.
      if (efg > 0) ff.set(l[fTeam]!, [Number.isFinite(three) ? r1(three) : null, r1(efg)]);
    }
  }
  const rows: TorvikRow[] = [];
  for (const l of lines) {
    const m = /^(\d+)-(\d+)$/.exec(l[col.record] ?? "");
    const team = l[col.team] ?? "";
    if (!m || !team) continue;
    const w = Number(m[1]), g = w + Number(m[2]);
    const o = Number(l[col.o]), d = Number(l[col.d]), b = Number(l[col.bart]), t = Number(l[col.tempo]);
    if (!g || ![o, d, b, t].every(Number.isFinite)) continue;
    rows.push([team, l[col.conf] ?? "", w, g, r1(o), r1(d), Math.round(b * 1000) / 1000, r1(t), ...(ff.get(team) ?? [null, null])]);
  }
  return rows;
}
