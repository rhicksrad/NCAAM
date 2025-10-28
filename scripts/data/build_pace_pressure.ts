import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { z } from "zod";

import { withCache } from "../fetch/cache.js";
import { request } from "../fetch/http.js";
import { BDL_TEAM_ID_TO_TRICODE } from "../fetch/bdl_team_mappings.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const API_BASE = "https://bdlproxy.hicksrch.workers.dev/bdl";
const TARGET_SEASON = 2024;
const SAMPLE_START_DATE = "2025-02-01";
const CACHE_KEY = `pace-pressure-team-games-${TARGET_SEASON}-${SAMPLE_START_DATE ?? "full"}-v1`;
const OUTPUT_PATH = path.join(ROOT, "public/data/pace_pressure.json");
const SCHEDULE_PATH = path.join(ROOT, "public/data/season_25_26_schedule.json");
const TEAMS_LIMIT = 5;

const statSchema = z
  .object({
    id: z.number().int(),
    min: z.union([z.string(), z.null()]).optional(),
    fgm: z.number(),
    fga: z.number(),
    ftm: z.number(),
    fta: z.number(),
    oreb: z.number(),
    dreb: z.number(),
    turnover: z.number(),
    pts: z.number(),
    team: z
      .object({
        id: z.number().int(),
        abbreviation: z.string(),
        full_name: z.string(),
      }).strip(),
    game: z
      .object({
        id: z.number().int(),
        season: z.number().int(),
        postseason: z.boolean().optional(),
        date: z.string(),
        home_team_id: z.number().int(),
        visitor_team_id: z.number().int(),
      }).strip(),
  })
  .strip();

const statsResponseSchema = z
  .object({
    data: z.array(statSchema),
    meta: z
      .object({
        next_cursor: z.union([z.string(), z.number(), z.null()]).optional(),
      })
      .partial()
      .optional(),
  })
  .strip();

type StatEntry = z.infer<typeof statSchema>;

type TeamGameAggregate = {
  gameId: number;
  teamId: number;
  opponentId: number;
  teamName: string;
  teamAbbr: string;
  minutes: number;
  fgm: number;
  fga: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  turnovers: number;
  points: number;
};

type ScheduleTeam = {
  teamId?: number;
  abbreviation?: string;
  backToBacks?: number;
  averageRestDays?: number;
  awayGames?: number;
};

type PacePressureEntry = {
  teamId: number;
  tricode: string;
  team: string;
  abbreviation: string;
  paceProjection: number;
  tempoDelta: number;
  tempoScore: number;
  gamesTracked: number;
  backToBacks?: number | null;
  averageRestDays?: number | null;
  roadGames?: number | null;
  note?: string | null;
};

type PacePressureDoc = {
  generatedAt: string;
  source: string;
  season: string;
  seasonStartYear: number;
  leagueAveragePace: number;
  sampleStartDate?: string;
  teams: PacePressureEntry[];
};

function parseMinutes(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  const parts = trimmed.split(":");
  if (parts.length === 1) {
    const minutes = Number.parseFloat(parts[0]);
    return Number.isFinite(minutes) ? minutes : 0;
  }
  const minutes = Number.parseFloat(parts[0]);
  const seconds = Number.parseFloat(parts[1]);
  const total = (Number.isFinite(minutes) ? minutes : 0) + (Number.isFinite(seconds) ? seconds / 60 : 0);
  return total;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function computePossessions(team: TeamGameAggregate, opponent: TeamGameAggregate): number {
  const offensiveRebFactor = safeDivide(team.oreb, team.oreb + opponent.dreb);
  const opponentOffensiveRebFactor = safeDivide(opponent.oreb, opponent.oreb + team.dreb);
  const teamEstimate =
    team.fga +
    0.4 * team.fta -
    1.07 * offensiveRebFactor * (team.fga - team.fgm) +
    team.turnovers;
  const opponentEstimate =
    opponent.fga +
    0.4 * opponent.fta -
    1.07 * opponentOffensiveRebFactor * (opponent.fga - opponent.fgm) +
    opponent.turnovers;
  return 0.5 * (teamEstimate + opponentEstimate);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (max <= min) {
    return clamp(value, 0, 1);
  }
  return clamp((value - min) / (max - min), 0, 1);
}

async function fetchSeasonTeamGames(): Promise<TeamGameAggregate[]> {
  return withCache(CACHE_KEY, undefined, async () => {
    const aggregates = new Map<string, TeamGameAggregate>();
    let cursor: string | number | null | undefined;
    let page = 0;

    while (true) {
      page += 1;
      const params = new URLSearchParams({
        "seasons[]": String(TARGET_SEASON),
        postseason: "false",
        per_page: "100",
      });
      if (SAMPLE_START_DATE) {
        params.set("start_date", SAMPLE_START_DATE);
      }
      if (cursor !== undefined && cursor !== null) {
        params.set("cursor", String(cursor));
      }
      const url = `${API_BASE}/v1/stats?${params.toString()}`;
      const payload = statsResponseSchema.parse(await request<unknown>(url));
      const stats = payload.data;
      for (const stat of stats) {
        if (stat.game.postseason) {
          continue;
        }
        const teamId = stat.team.id;
        const tricode = BDL_TEAM_ID_TO_TRICODE.get(teamId);
        if (!tricode) {
          continue;
        }
        const gameId = stat.game.id;
        const isHome = stat.game.home_team_id === teamId;
        const opponentId = isHome ? stat.game.visitor_team_id : stat.game.home_team_id;
        const key = `${gameId}-${teamId}`;
        const existing = aggregates.get(key);
        if (existing) {
          existing.minutes += parseMinutes(stat.min ?? null);
          existing.fgm += stat.fgm;
          existing.fga += stat.fga;
          existing.ftm += stat.ftm;
          existing.fta += stat.fta;
          existing.oreb += stat.oreb;
          existing.dreb += stat.dreb;
          existing.turnovers += stat.turnover;
          existing.points += stat.pts;
        } else {
          aggregates.set(key, {
            gameId,
            teamId,
            opponentId,
            teamName: stat.team.full_name,
            teamAbbr: stat.team.abbreviation,
            minutes: parseMinutes(stat.min ?? null),
            fgm: stat.fgm,
            fga: stat.fga,
            ftm: stat.ftm,
            fta: stat.fta,
            oreb: stat.oreb,
            dreb: stat.dreb,
            turnovers: stat.turnover,
            points: stat.pts,
          });
        }
      }

      if (page === 1 || page % 25 === 0) {
        console.log(`Fetched ${aggregates.size} team-game rows through page ${page}`);
      }

      const nextCursor = payload.meta?.next_cursor;
      if (nextCursor === undefined || nextCursor === null || String(nextCursor).length === 0) {
        break;
      }
      cursor = nextCursor;
    }

    return Array.from(aggregates.values());
  });
}

async function loadScheduleTeams(): Promise<Map<string, ScheduleTeam>> {
  const raw = JSON.parse(await readFile(SCHEDULE_PATH, "utf8")) as { teams?: ScheduleTeam[] };
  const entries = Array.isArray(raw?.teams) ? raw.teams : [];
  const map = new Map<string, ScheduleTeam>();
  for (const entry of entries) {
    const abbr = typeof entry.abbreviation === "string" ? entry.abbreviation.toUpperCase() : undefined;
    if (!abbr) continue;
    map.set(abbr, entry);
  }
  return map;
}

function formatNote(
  tempoDelta: number,
  restDiff: number | null,
  backToBacks: number | null,
  leagueBackToBacks: number | null,
): string | null {
  const pieces: string[] = [];
  if (Number.isFinite(tempoDelta)) {
    const deltaAbs = Math.abs(tempoDelta);
    if (tempoDelta >= 0.5) {
      pieces.push(`Played ${deltaAbs.toFixed(1)} possessions faster than league average last season.`);
    } else if (tempoDelta <= -0.5) {
      pieces.push(`Sat ${deltaAbs.toFixed(1)} possessions slower than league average last season.`);
    } else {
      pieces.push("Tempo hovered near league average last season.");
    }
  }
  if (restDiff !== null && Number.isFinite(restDiff)) {
    if (restDiff > 0.2) {
      pieces.push("Compressed rest windows amplify the physical tax.");
    } else if (restDiff < -0.2) {
      pieces.push("Extra rest should help sustain their transition burst.");
    }
  }
  if (
    backToBacks !== null &&
    Number.isFinite(backToBacks) &&
    leagueBackToBacks !== null &&
    Number.isFinite(leagueBackToBacks)
  ) {
    if (backToBacks - leagueBackToBacks >= 2) {
      pieces.push("Back-to-back load ranks above the league norm.");
    } else if (backToBacks - leagueBackToBacks <= -2) {
      pieces.push("Light back-to-back slate eases the grind.");
    }
  }
  if (!pieces.length) {
    return null;
  }
  return pieces.join(" ");
}

async function buildPacePressure(): Promise<PacePressureDoc> {
  const [teamGames, scheduleTeams] = await Promise.all([fetchSeasonTeamGames(), loadScheduleTeams()]);
  const teamGameMap = new Map<string, TeamGameAggregate>();
  for (const entry of teamGames) {
    teamGameMap.set(`${entry.gameId}-${entry.teamId}`, entry);
  }

  const teamBuckets = new Map<number, {
    team: string;
    abbreviation: string;
    tricode: string;
    paceSum: number;
    games: number;
    schedule?: ScheduleTeam;
  }>();

  let leaguePaceSum = 0;
  let leagueGames = 0;

  for (const entry of teamGames) {
    const opponent = teamGameMap.get(`${entry.gameId}-${entry.opponentId}`);
    if (!opponent) {
      continue;
    }
    if (entry.minutes <= 0) {
      continue;
    }
    const teamMinutes = entry.minutes / 5;
    if (teamMinutes <= 0) {
      continue;
    }
    const possessions = computePossessions(entry, opponent);
    if (!Number.isFinite(possessions) || possessions <= 0) {
      continue;
    }
    const pace = (possessions * 48) / teamMinutes;
    if (!Number.isFinite(pace) || pace <= 0) {
      continue;
    }
    const tricode = BDL_TEAM_ID_TO_TRICODE.get(entry.teamId);
    if (!tricode) {
      continue;
    }

    const bucket = teamBuckets.get(entry.teamId) ?? {
      team: entry.teamName,
      abbreviation: entry.teamAbbr,
      tricode,
      paceSum: 0,
      games: 0,
      schedule: scheduleTeams.get(tricode) ?? undefined,
    };
    bucket.paceSum += pace;
    bucket.games += 1;
    teamBuckets.set(entry.teamId, bucket);

    leaguePaceSum += pace;
    leagueGames += 1;
  }

  if (!leagueGames) {
    throw new Error("No pace data available from Ball Don't Lie stats feed");
  }

  const leagueAveragePace = leaguePaceSum / leagueGames;

  const entries: PacePressureEntry[] = [];

  const paceValues: number[] = [];
  const restDiffValues: number[] = [];
  const backToBackValues: number[] = [];

  let leagueRestAverage: number | null = null;
  let leagueBackToBackAverage: number | null = null;
  const scheduleEntries = Array.from(scheduleTeams.values());
  if (scheduleEntries.length) {
    const restTotals = scheduleEntries
      .map((team) => team.averageRestDays)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (restTotals.length) {
      leagueRestAverage = restTotals.reduce((sum, value) => sum + value, 0) / restTotals.length;
    }
    const backToBackTotals = scheduleEntries
      .map((team) => team.backToBacks)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (backToBackTotals.length) {
      leagueBackToBackAverage =
        backToBackTotals.reduce((sum, value) => sum + value, 0) / backToBackTotals.length;
    }
  }

  for (const [teamId, bucket] of teamBuckets.entries()) {
    if (!bucket.games) {
      continue;
    }
    const paceProjection = bucket.paceSum / bucket.games;
    paceValues.push(paceProjection);
    const schedule = bucket.schedule;
    let restDiff: number | null = null;
    if (schedule && typeof schedule.averageRestDays === "number" && Number.isFinite(schedule.averageRestDays) && leagueRestAverage !== null) {
      restDiff = leagueRestAverage - schedule.averageRestDays;
      restDiffValues.push(restDiff);
    }
    if (schedule && typeof schedule.backToBacks === "number" && Number.isFinite(schedule.backToBacks)) {
      backToBackValues.push(schedule.backToBacks);
    }
    entries.push({
      teamId,
      tricode: bucket.tricode,
      team: bucket.team,
      abbreviation: bucket.abbreviation,
      paceProjection,
      tempoDelta: paceProjection - leagueAveragePace,
      tempoScore: 0,
      gamesTracked: bucket.games,
      backToBacks: schedule?.backToBacks ?? null,
      averageRestDays: schedule?.averageRestDays ?? null,
      roadGames: schedule?.awayGames ?? null,
      note: null,
    });
  }

  const paceMin = Math.min(...paceValues);
  const paceMax = Math.max(...paceValues);
  const restDiffMin = restDiffValues.length ? Math.min(...restDiffValues) : 0;
  const restDiffMax = restDiffValues.length ? Math.max(...restDiffValues) : 0;
  const backToBackMin = backToBackValues.length ? Math.min(...backToBackValues) : 0;
  const backToBackMax = backToBackValues.length ? Math.max(...backToBackValues) : 0;

  const ranked = entries
    .map((entry) => {
      const restDiff =
        leagueRestAverage !== null && entry.averageRestDays !== null && entry.averageRestDays !== undefined
          ? leagueRestAverage - entry.averageRestDays
          : null;
      const restComponent =
        restDiff !== null ? normalize(restDiff, restDiffMin, restDiffMax) : 0.5;
      const backToBackComponent =
        entry.backToBacks !== null && entry.backToBacks !== undefined
          ? normalize(entry.backToBacks, backToBackMin, backToBackMax)
          : 0.5;
      const paceComponent = normalize(entry.paceProjection, paceMin, paceMax);
      const tempoScore =
        100 * (0.6 * paceComponent + 0.2 * restComponent + 0.2 * backToBackComponent);
      return {
        ...entry,
        tempoScore: Math.round(clamp(tempoScore, 0, 100)),
        note: formatNote(entry.tempoDelta, restDiff, entry.backToBacks ?? null, leagueBackToBackAverage ?? null),
      };
    })
    .sort((a, b) => b.paceProjection - a.paceProjection)
    .slice(0, TEAMS_LIMIT);

  return {
    generatedAt: new Date().toISOString(),
    source: "Ball Don't Lie", // explicit attribution
    season: "2024-25",
    seasonStartYear: TARGET_SEASON,
    leagueAveragePace,
    ...(SAMPLE_START_DATE ? { sampleStartDate: SAMPLE_START_DATE } : {}),
    teams: ranked,
  };
}

async function main(): Promise<void> {
  const doc = await buildPacePressure();
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`Wrote pace_pressure.json with ${doc.teams.length} teams (league pace ${doc.leagueAveragePace.toFixed(2)})`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
