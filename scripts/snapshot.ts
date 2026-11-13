// Bake a snapshot of ESPN's feeds into dist/data/live so pages paint from a
// same-origin file before (or instead of) asking ESPN. Two of the files are
// never refetched by the browser: this season's player averages (a full ESPN
// crawl) and Bart Torvik's ratings (no CORS). See scripts/feeds.ts.
//
//   tsx scripts/snapshot.ts            live fetch, falling back per file to data/seed
//   tsx scripts/snapshot.ts --seed     copy data/seed only (offline builds, tests)
//   tsx scripts/snapshot.ts --reseed   rebuild data/seed from tests/fixtures
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TeamEntry } from "../src/lib/data.js";
import {
  ESPN_URLS,
  normalizeNews,
  normalizeRankings,
  normalizeScoreboard,
  normalizeStandings,
  normalizeTeams,
  scoreboardDay,
  type Conference,
  type Team,
} from "../src/lib/espn.js";
import { crawlStats, normalizeStatPage, parseTorvik, seasonLabel, seasonYear, toSheet, torvikUrl } from "./feeds.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedDir = path.join(root, "data/seed");
const fixtureDir = path.join(root, "tests/fixtures/espn");
const outDir = path.join(root, "dist/data/live");
const mode = process.argv.includes("--reseed") ? "reseed" : process.argv.includes("--seed") ? "seed" : "live";

type Json = Record<string, unknown>;

type Get = { timeout?: number; tries?: number; signal?: AbortSignal };

async function fetchBody(url: string, { timeout = 20_000, tries = 3, signal }: Get = {}): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const timer = AbortSignal.timeout(timeout);
      const res = await fetch(url, {
        headers: { Accept: "application/json, text/csv", "User-Agent": "field-house-snapshot" },
        signal: signal ? AbortSignal.any([timer, signal]) : timer,
      });
      if (res.ok) return res;
      lastError = new Error(`${res.status} from ${new URL(url).pathname}`);
      // A missing page will still be missing in a second.
      if (res.status < 500 && res.status !== 408 && res.status !== 429) break;
    } catch (error) {
      lastError = error;
      if (signal?.aborted) break;
    }
    if (attempt < tries - 1) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw lastError;
}

const fetchJson = async (url: string, opts?: Get): Promise<Json> => (await (await fetchBody(url, opts)).json()) as Json;
const fetchText = async (url: string, opts?: Get): Promise<string> => (await fetchBody(url, opts)).text();

const fixture = async (name: string): Promise<Json> => JSON.parse(await readFile(path.join(fixtureDir, name), "utf8")) as Json;
const torvikFixture = (file: string) => readFile(path.join(root, "tests/fixtures/torvik", file), "utf8");

// The last deploy's copy of a build-only file. A fresh one saves recrawling
// ESPN every half hour; an old one still beats the seed when a crawl fails.
const DEPLOYED = "https://rhicksrad.github.io/NCAAM/data/live/";
async function deployed(name: string, year: number): Promise<{ at: string; data: Json; age: number } | undefined> {
  try {
    const prev = (await fetchJson(`${DEPLOYED}${name}.json`, { timeout: 15_000, tries: 1 })) as { at?: string; data?: Json };
    const age = Date.now() - Date.parse(prev.at ?? "");
    // Last season's copy counts too: that is what is served until the new one has games.
    if (prev.data && (prev.data.year === year || prev.data.year === year - 1) && age >= 0) return { at: prev.at!, data: prev.data, age };
  } catch {
    /* first deploy, or Pages is down: crawl */
  }
  return undefined;
}

function withConferences(teams: Team[], conferences: Conference[]) {
  const byTeam = new Map<string, Conference>();
  for (const c of conferences) for (const row of c.rows) byTeam.set(row.team.id, c);
  return teams.map((t) => ({ ...t, conf: byTeam.get(t.id)?.abbr ?? "", confName: byTeam.get(t.id)?.name ?? "" }));
}

async function gather(source: "live" | "fixtures") {
  const live = source === "live";
  const season = seasonYear();
  const fresh = process.env.SNAPSHOT === "require-live"; // the nightly contract check never reuses
  const out: Record<string, unknown> = {};
  const stamps: Record<string, string> = {};
  const errors: string[] = [];
  const step = async (name: string, run: () => Promise<unknown>) => {
    try {
      out[name] = await run();
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  let conferences: Conference[] = [];
  await step("standings", async () => {
    conferences = normalizeStandings(live ? await fetchJson(ESPN_URLS.standings(season)) : await fixture("standings-2027.json"));
    if (conferences.length < 20 && live) {
      // Before the first games are played ESPN can return an empty table.
      conferences = normalizeStandings(await fetchJson(ESPN_URLS.standings(season - 1)));
    }
    if (conferences.length < 20) throw new Error(`only ${conferences.length} conferences`);
    return conferences;
  });
  await step("teams", async () => {
    const teams = normalizeTeams(live ? await fetchJson(ESPN_URLS.teams()) : await fixture("teams.json"));
    if (teams.length < 300) throw new Error(`only ${teams.length} teams`);
    return withConferences(teams, conferences);
  });
  await step("rankings", async () => {
    const polls = normalizeRankings(live ? await fetchJson(ESPN_URLS.rankings()) : await fixture("rankings.json"));
    if (!polls.some((p) => p.ranks.length >= 20)) throw new Error("no full poll");
    return polls;
  });
  await step("scoreboard", async () => {
    const raw = live ? await fetchJson(ESPN_URLS.scoreboard()) : await fixture("scoreboard-today.json");
    return { day: scoreboardDay(raw), games: normalizeScoreboard(raw) };
  });
  await step("news", async () => normalizeNews(live ? await fetchJson(ESPN_URLS.news()) : await fixture("news.json")));

  // Build-only feeds. Both name their season by the year it ends and fall back
  // a year while the new one has no games (October into November).
  const seedTeams = async () => (JSON.parse(await readFile(path.join(seedDir, "teams.json"), "utf8")) as { data: TeamEntry[] }).data;
  const teams = (out.teams as TeamEntry[] | undefined)?.some((t) => t.conf) ? (out.teams as TeamEntry[]) : await seedTeams();
  const reuse = async (name: string, hours: number, run: (year: number) => Promise<Json | undefined>) => {
    const prev = live ? await deployed(name, season) : undefined;
    if (prev && !fresh && prev.age < hours * 3_600_000) {
      stamps[name] = prev.at;
      return prev.data;
    }
    try {
      const data = (await run(season)) ?? (live ? await run(season - 1) : undefined);
      if (!data) throw new Error(`no ${seasonLabel(season)} games yet, nor ${seasonLabel(season - 1)}`);
      return data;
    } catch (error) {
      if (!prev) throw error;
      // Keep the last good copy, honestly dated, and still report the failure.
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)} (kept the copy from ${prev.at})`);
      stamps[name] = prev.at;
      return prev.data;
    }
  };
  await Promise.all([
    step("averages", () =>
      reuse("averages", 2, async (year) => {
        // One deadline for the whole crawl, and no stragglers once it fails.
        const stop = new AbortController();
        const signal = AbortSignal.any([AbortSignal.timeout(150_000), stop.signal]);
        const page = live
          ? await crawlStats(year, (url) => fetchJson(url, { timeout: 60_000, signal })).finally(() => stop.abort())
          : normalizeStatPage(await fixture("player-stats-2027.json"));
        const rows = toSheet(page.lines, teams);
        if (!rows.length) return undefined;
        if (live && rows.length < 300) throw new Error(`only ${rows.length} Division I players`);
        return { year: page.year || year, season: seasonLabel(page.year || year), rows };
      }),
    ),
    step("torvik", () =>
      reuse("torvik", 3, async (year) => {
        // A 404 means Torvik hasn't opened this season yet; anything else is a failure.
        const results = live
          ? await fetchText(torvikUrl(year, "team_results")).catch((e: Error) => (/^404 /.test(e.message) ? "" : Promise.reject(e)))
          : await torvikFixture("2027_team_results.csv");
        if (!results) return undefined;
        // Shooting splits are a nicety; never let them block the ratings.
        const ff = live ? await fetchText(torvikUrl(year, "fffinal")).catch(() => "") : await torvikFixture("2027_fffinal.csv");
        const rows = parseTorvik(results, ff);
        if (live && rows.length < 300) return undefined;
        return { year: live ? year : 2027, cols: ["team", "conf", "w", "g", "adjO", "adjD", "barthag", "tempo", "fg3", "efg"], rows };
      }),
    ),
  ]);
  return { out, stamps, errors };
}

const NAMES = ["standings", "teams", "rankings", "scoreboard", "news", "averages", "torvik"] as const;

if (mode === "reseed") {
  const { out, errors } = await gather("fixtures");
  if (errors.length) throw new Error(`reseed failed: ${errors.join("; ")}`);
  await mkdir(seedDir, { recursive: true });
  const at = new Date().toISOString();
  for (const name of NAMES) await writeFile(path.join(seedDir, `${name}.json`), JSON.stringify({ at, data: out[name] }) + "\n");
  console.log("seed rebuilt from fixtures");
} else {
  await mkdir(outDir, { recursive: true });
  const { out, stamps, errors } = mode === "live" ? await gather("live") : { out: {} as Record<string, unknown>, stamps: {} as Record<string, string>, errors: [] as string[] };
  const at = new Date().toISOString();
  const used: string[] = [];
  for (const name of NAMES) {
    const target = path.join(outDir, `${name}.json`);
    if (out[name] !== undefined) {
      await writeFile(target, JSON.stringify({ at: stamps[name] ?? at, data: out[name] }));
      used.push(`${name}=${stamps[name] ? "kept" : "live"}`);
    } else {
      const seed = path.join(seedDir, `${name}.json`);
      if (!existsSync(seed)) throw new Error(`no live data and no seed for ${name}`);
      await writeFile(target, await readFile(seed, "utf8"));
      used.push(`${name}=seed`);
    }
  }
  console.log(`snapshot: ${used.join(" ")}`);
  for (const e of errors) console.warn(`snapshot warning: ${e}`);
  if (process.env.SNAPSHOT === "require-live" && errors.length) process.exit(1);
}
