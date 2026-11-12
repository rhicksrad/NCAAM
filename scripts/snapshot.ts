// Bake a snapshot of ESPN's feeds into dist/data/live so pages paint from a
// same-origin file before (or instead of) asking ESPN.
//
//   tsx scripts/snapshot.ts            live fetch, falling back per file to data/seed
//   tsx scripts/snapshot.ts --seed     copy data/seed only (offline builds, tests)
//   tsx scripts/snapshot.ts --reseed   rebuild data/seed from tests/fixtures/espn
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedDir = path.join(root, "data/seed");
const fixtureDir = path.join(root, "tests/fixtures/espn");
const outDir = path.join(root, "dist/data/live");
const mode = process.argv.includes("--reseed") ? "reseed" : process.argv.includes("--seed") ? "seed" : "live";

type Json = Record<string, unknown>;

async function fetchJson(url: string): Promise<Json> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "field-house-snapshot" }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`${res.status} from ${new URL(url).pathname}`);
      return (await res.json()) as Json;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastError;
}

const fixture = async (name: string): Promise<Json> => JSON.parse(await readFile(path.join(fixtureDir, name), "utf8")) as Json;

function withConferences(teams: Team[], conferences: Conference[]) {
  const byTeam = new Map<string, Conference>();
  for (const c of conferences) for (const row of c.rows) byTeam.set(row.team.id, c);
  return teams.map((t) => ({ ...t, conf: byTeam.get(t.id)?.abbr ?? "", confName: byTeam.get(t.id)?.name ?? "" }));
}

/** ESPN's season number is the year the season ends in. */
function currentSeason(now = new Date()): number {
  return now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

async function gather(source: "live" | "fixtures") {
  const live = source === "live";
  const season = currentSeason();
  const out: Record<string, unknown> = {};
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
    let raw = live ? await fetchJson(ESPN_URLS.standings(season)) : await fixture(`standings-${season}.json`).catch(() => fixture("standings-2027.json"));
    conferences = normalizeStandings(raw);
    if (conferences.length < 20) {
      // Before the first games are played ESPN can return an empty table.
      raw = live ? await fetchJson(ESPN_URLS.standings(season - 1)) : await fixture("standings-2026.json");
      conferences = normalizeStandings(raw);
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
  return { out, errors };
}

const NAMES = ["standings", "teams", "rankings", "scoreboard", "news"] as const;

if (mode === "reseed") {
  const { out, errors } = await gather("fixtures");
  if (errors.length) throw new Error(`reseed failed: ${errors.join("; ")}`);
  await mkdir(seedDir, { recursive: true });
  const at = new Date().toISOString();
  for (const name of NAMES) await writeFile(path.join(seedDir, `${name}.json`), JSON.stringify({ at, data: out[name] }) + "\n");
  console.log("seed rebuilt from fixtures");
} else {
  await mkdir(outDir, { recursive: true });
  const { out, errors } = mode === "live" ? await gather("live") : { out: {} as Record<string, unknown>, errors: [] as string[] };
  const at = new Date().toISOString();
  const used: string[] = [];
  for (const name of NAMES) {
    const target = path.join(outDir, `${name}.json`);
    if (out[name] !== undefined) {
      await writeFile(target, JSON.stringify({ at, data: out[name] }));
      used.push(`${name}=live`);
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
