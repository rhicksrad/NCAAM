import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { RosterTeam, RostersDoc } from "../types/ball";
import { getTeams } from "./fetch/bdl.js";
import { fetchActiveRosters } from "./fetch/bdl_active_rosters.js";
import type { SourcePlayerRecord } from "./lib/types.js";
import { SEASON, getSeasonStartYear } from "./lib/season.js";
import { TEAM_METADATA } from "./lib/teams.js";

/**
 * Config
 * - To allow bigger training-camp lists, set:
 *     ALLOW_PRESEASON_SIZES=true
 *     PRESEASON_ROSTER_MAX=25   (optional; default 21)
 * - To tighten/relax regular limits:
 *     REGULAR_ROSTER_MIN=13
 *     REGULAR_ROSTER_MAX=21
 * - TTL can be passed as CLI: `node build_rosters.mjs ttl=12`
 */
const OUT_DIR = path.join(process.cwd(), "public", "data");
const OUT_FILE = path.join(OUT_DIR, "rosters.json");
const FAIL_FILE = path.join(OUT_DIR, "rosters.failed.json");
const HASH_FILE = path.join(OUT_DIR, "rosters.sha256");

function parseTTL(): number {
  const arg = process.argv
    .slice(2)
    .map((t) => t.trim())
    .find((t) => /ttl=/.test(t));
  const fromArgRaw = arg ? Number(arg.replace(/^[^=]*=/, "")) : Number.NaN;
  if (!Number.isNaN(fromArgRaw) && fromArgRaw > 0) return Math.floor(fromArgRaw);

  const fromEnvRaw = Number(process.env.DATA_TTL_HOURS);
  if (!Number.isNaN(fromEnvRaw) && fromEnvRaw > 0) return Math.floor(fromEnvRaw);

  return 6;
}

const TTL_HOURS = parseTTL();
const TARGET_SEASON_START_YEAR = getSeasonStartYear(SEASON);

const ALLOW_PRESEASON_SIZES = String(process.env.ALLOW_PRESEASON_SIZES ?? "").toLowerCase() === "true";
const REGULAR_ROSTER_MIN = Number(process.env.REGULAR_ROSTER_MIN ?? 13) || 13;
const REGULAR_ROSTER_MAX = Number(process.env.REGULAR_ROSTER_MAX ?? 23) || 23;
const PRESEASON_ROSTER_MAX = Number(process.env.PRESEASON_ROSTER_MAX ?? 25) || 25;

type JsonValue = Record<string, unknown>;

async function readJSON<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJSON(p: string, data: unknown): Promise<string> {
  const payload = JSON.stringify(data, null, 2);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, `${payload}\n`);
  return payload;
}

async function writeFailure(reason: JsonValue) {
  await fs.mkdir(path.dirname(FAIL_FILE), { recursive: true });
  const payload = JSON.stringify({ ...reason, at: new Date().toISOString() }, null, 2);
  await fs.writeFile(FAIL_FILE, `${payload}\n`);
}

async function clearFailureFile() {
  try {
    await fs.unlink(FAIL_FILE);
  } catch {
    // ignore
  }
}

function safeTrim(s?: string | null): string | null {
  const t = s?.trim();
  return t && t.length ? t : null;
}

function normalizeNameParts(name?: string | null): { first: string; last: string } {
  const raw = (name ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return { first: "", last: "" };
  const parts = raw.split(" ");
  if (parts.length === 1) return { first: parts[0] ?? "", last: "" };
  const first = parts[0] ?? "";
  const last = parts.slice(1).join(" ");
  return { first, last };
}

/**
 * Only keep truly active players.
 * Handles different upstream flags without exploding if absent.
 */
function isTrulyActive(p: SourcePlayerRecord): boolean {
  const flags = [
    // common fields we’ve seen in BDL outputs or mirrors
    (p as any).active,
    (p as any).is_active,
    (p as any).on_team,
    (p as any).on_roster,
  ]
    .filter((v) => typeof v === "boolean") as boolean[];

  if (flags.length) return flags.every(Boolean);

  // If no explicit flags, do a light heuristic:
  // - must have a numeric ID
  // - must have either a team id on record OR be coming from a per-team roster list
  const id = typeof (p as any).id === "number"
    ? (p as any).id
    : Number.parseInt((p as any).playerId ?? "", 10);

  const teamIdGuess =
    typeof (p as any).team_id === "number"
      ? (p as any).team_id
      : Number.parseInt((p as any).teamId ?? "", 10);

  return Number.isFinite(id) && (Number.isFinite(teamIdGuess) || Boolean((p as any).team_bdl_id));
}

function toRosterPlayer(player: SourcePlayerRecord): RosterTeam["roster"][number] {
  const idValue =
    typeof (player as any).id === "number"
      ? (player as any).id
      : (() => {
          const parsed = Number.parseInt((player as any).playerId ?? "", 10);
          return Number.isFinite(parsed) ? parsed : NaN;
        })();

  if (!Number.isFinite(idValue)) {
    throw new RosterFetchError("invalid_player_id", `Invalid player id for ${String((player as any).name) || "unknown player"}`, { player });
  }

  const first = safeTrim((player as any).first_name);
  const last = safeTrim((player as any).last_name);

  const { first: ff, last: lf } = normalizeNameParts((player as any).name);

  return {
    id: idValue,
    first_name: first ?? ff,
    last_name: last ?? lf,
    position: safeTrim((player as any).position),
    jersey_number: safeTrim((player as any).jersey_number),
    height: safeTrim((player as any).height),
    weight: safeTrim((player as any).weight),
  };
}

function isCacheFresh(doc: RostersDoc | null): boolean {
  if (!doc?.fetched_at || !doc?.ttl_hours) return false;
  const freshUntil = new Date(doc.fetched_at).getTime() + doc.ttl_hours * 3_600_000;
  return Number.isFinite(freshUntil) && Date.now() < freshUntil;
}

function formatFailure(reason: string, details: JsonValue = {}): JsonValue {
  return { error: reason, ...details };
}

async function writeHash(jsonString: string) {
  const hash = createHash("sha256").update(jsonString).digest("hex");
  await fs.mkdir(path.dirname(HASH_FILE), { recursive: true });
  await fs.writeFile(HASH_FILE, `${hash}\n`);
  return hash;
}

class RosterFetchError extends Error {
  reason: string;
  details: JsonValue;
  constructor(reason: string, message: string, details: JsonValue = {}) {
    super(message);
    this.reason = reason;
    this.details = details;
  }
}

async function buildRosterFromBallDontLie(): Promise<RostersDoc> {
  const [teams, activeRosters] = await Promise.all([getTeams(), fetchActiveRosters()]);
  if (!teams.length) throw new RosterFetchError("no_teams", "No teams returned by API.");

  console.log(`Fetching Ball Don't Lie active rosters for ${SEASON} (season start ${TARGET_SEASON_START_YEAR}).`);

  const teamsById = new Map(teams.map((t) => [t.id, t]));
  const rosterTeams: RosterTeam[] = [];
  let totalPlayers = 0;

  for (const metadata of TEAM_METADATA) {
    const tri = String(metadata.tricode).toUpperCase();
    const rosterRaw = activeRosters[tri];

    if (!Array.isArray(rosterRaw) || rosterRaw.length === 0) {
      throw new RosterFetchError("missing_team_roster", `No active roster for ${tri}.`);
    }

    const teamBdlId = (rosterRaw[0] as any)?.team_bdl_id;
    if (typeof teamBdlId !== "number") {
      throw new RosterFetchError("invalid_team_mapping", `Missing Ball Don't Lie team id for ${tri}.`);
    }

    const teamInfo = teamsById.get(teamBdlId);
    if (!teamInfo) {
      throw new RosterFetchError("unknown_team", `Unknown Ball Don't Lie team id ${teamBdlId} for ${tri}.`);
    }

    // Strict active filter + normalization
    const normalizedRoster = rosterRaw
      .filter(isTrulyActive)
      .map(toRosterPlayer)
      .filter((p) => p.first_name || p.last_name) // ditch nameless ghosts
      .sort((a, b) => {
        const aName = `${a.last_name} ${a.first_name}`.toLowerCase();
        const bName = `${b.last_name} ${b.first_name}`.toLowerCase();
        return aName.localeCompare(bName);
      });

    // dedupe by id (keep first)
    const deduped: RosterTeam["roster"][number][] = [];
    const seen = new Set<number>();
    for (const p of normalizedRoster) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        deduped.push(p);
      }
    }

    totalPlayers += deduped.length;

    rosterTeams.push({
      id: teamInfo.id,
      abbreviation: teamInfo.abbreviation,
      full_name: teamInfo.full_name,
      roster: deduped,
    });

    console.log(`${teamInfo.abbreviation}: ${deduped.length} active players`);
    const maxAllowed = ALLOW_PRESEASON_SIZES ? PRESEASON_ROSTER_MAX : REGULAR_ROSTER_MAX;
    if (deduped.length < REGULAR_ROSTER_MIN || deduped.length > maxAllowed) {
      console.warn(`Suspicious roster size for ${teamInfo.abbreviation}: ${deduped.length} (min=${REGULAR_ROSTER_MIN}, max=${maxAllowed})`);
    }
  }

  // League-wide sanity without blocking preseason spikes
  const teamsCount = TEAM_METADATA.length;
  const minLeague = teamsCount * REGULAR_ROSTER_MIN;
  const maxLeague = teamsCount * (ALLOW_PRESEASON_SIZES ? PRESEASON_ROSTER_MAX : REGULAR_ROSTER_MAX);
  if (totalPlayers < minLeague || totalPlayers > maxLeague) {
    console.warn(`League player count looks off: ${totalPlayers} [${minLeague}..${maxLeague}].`);
    if (!ALLOW_PRESEASON_SIZES) {
      throw new RosterFetchError("suspicious_total", "Suspicious league player count detected.", { totalPlayers, minLeague, maxLeague });
    }
  }

  rosterTeams.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

  return {
    fetched_at: new Date().toISOString(),
    ttl_hours: TTL_HOURS,
    source: "ball_dont_lie",
    season: SEASON,
    season_start_year: TARGET_SEASON_START_YEAR,
    teams: rosterTeams,
  };
}

async function main() {
  const existing = await readJSON<RostersDoc>(OUT_FILE);
  if (isCacheFresh(existing)) {
    console.log("rosters.json cache still fresh; skipping fetch");
    return;
  }

  try {
    const doc = await buildRosterFromBallDontLie();

    const jsonString = await writeJSON(OUT_FILE, doc);
    const hash = await writeHash(jsonString);

    await clearFailureFile();

    const teamCount = doc.teams.reduce((sum, team) => sum + team.roster.length, 0);
    console.log(`Wrote ${OUT_FILE} with ${teamCount} players (Ball Don't Lie; sha256 ${hash.slice(0, 8)}…).`);
  } catch (error) {
    const fetchError =
      error instanceof RosterFetchError
        ? error
        : new RosterFetchError(
            "exception",
            error instanceof Error ? error.message : String(error),
          );

    const failurePayload = formatFailure(fetchError.reason, {
      ...(fetchError.details ?? {}),
      message: fetchError.message,
    });
    await writeFailure(failurePayload);
    console.warn("Aborting roster write; Ball Don't Lie roster fetch failed.");
    throw fetchError;
  }
}

main().catch(async (error) => {
  console.error("Roster fetch run failed:", error);
  if (error instanceof RosterFetchError) {
    // Failure file already populated in the main workflow.
  } else {
    await writeFailure(formatFailure("exception", { message: String(error) }));
  }
  process.exitCode = 1;
});

