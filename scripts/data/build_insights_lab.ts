import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { z } from "zod";

import { BallDontLieClient, type BdlGame } from "../fetch/ball_dont_lie_client.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../");
const PUBLIC_DATA_DIR = path.join(ROOT, "public", "data");
const OUTPUT_PATH = path.join(PUBLIC_DATA_DIR, "insights_lab.json");

const SEASON_START = 2010;
const SEASON_END = 2024;

const MONTH_LABELS: Record<number, string> = {
  1: "Jan",
  2: "Feb",
  3: "Mar",
  4: "Apr",
  5: "May",
  6: "Jun",
  7: "Jul",
  8: "Aug",
  9: "Sep",
  10: "Oct",
  11: "Nov",
  12: "Dec",
};

const gameSchema = z
  .object({
    id: z.number().int(),
    date: z.string().min(1),
    datetime: z.string().nullable().optional(),
    season: z.number().int(),
    status: z.string().min(1),
    postseason: z.boolean().optional(),
    home_team_score: z.number().int(),
    visitor_team_score: z.number().int(),
    period: z.number().int().optional(),
    home_team: z
      .object({
        id: z.number().int(),
        abbreviation: z.string().min(1),
      })
      .strip(),
    visitor_team: z
      .object({
        id: z.number().int(),
        abbreviation: z.string().min(1),
      })
      .strip(),
  })
  .strip();

interface TeamGameRow {
  gameId: number;
  season: number;
  date: Date;
  isHome: boolean;
  teamId: number;
  opponentId: number;
  win: boolean;
  teamScore: number;
  opponentScore: number;
  restDays: number | null;
  postseason: boolean;
  period: number;
}

function parseGameDate(game: BdlGame): Date {
  const iso = (game as { datetime?: string | null }).datetime;
  if (iso) {
    return new Date(iso);
  }
  return new Date(`${game.date}T00:00:00Z`);
}

async function fetchGames(client: BallDontLieClient, seasons: number[]): Promise<BdlGame[]> {
  const results: BdlGame[] = [];
  for (const season of seasons) {
    console.log(`Fetching Ball Don't Lie games for ${season}-${season + 1}`);
    const games = await client.paginate<BdlGame>(
      "/v1/games",
      {
        "seasons[]": season,
        per_page: 100,
      },
      100,
      undefined,
      gameSchema,
    );
    results.push(...games);
  }
  return results;
}

function buildTeamRows(games: BdlGame[]): TeamGameRow[] {
  const rows: TeamGameRow[] = [];
  const lastGameByTeam = new Map<number, Date>();

  const sorted = [...games].sort((a, b) => parseGameDate(a).getTime() - parseGameDate(b).getTime());

  for (const game of sorted) {
    const date = parseGameDate(game);
    const postseason = Boolean(game.postseason);
    const period = typeof game.period === "number" && Number.isFinite(game.period) ? game.period : 4;

    const homeTeamId = game.home_team.id;
    const visitorTeamId = game.visitor_team.id;
    const homeScore = game.home_team_score;
    const visitorScore = game.visitor_team_score;

    const homeRest = lastGameByTeam.get(homeTeamId);
    const visitorRest = lastGameByTeam.get(visitorTeamId);

    const homeRestDays = homeRest ? (date.getTime() - homeRest.getTime()) / 86_400_000 : null;
    const visitorRestDays = visitorRest ? (date.getTime() - visitorRest.getTime()) / 86_400_000 : null;

    const homeWin = homeScore > visitorScore;
    const visitorWin = visitorScore > homeScore;

    rows.push({
      gameId: game.id,
      season: game.season,
      date,
      isHome: true,
      teamId: homeTeamId,
      opponentId: visitorTeamId,
      win: homeWin,
      teamScore: homeScore,
      opponentScore: visitorScore,
      restDays: homeRestDays,
      postseason,
      period,
    });

    rows.push({
      gameId: game.id,
      season: game.season,
      date,
      isHome: false,
      teamId: visitorTeamId,
      opponentId: homeTeamId,
      win: visitorWin,
      teamScore: visitorScore,
      opponentScore: homeScore,
      restDays: visitorRestDays,
      postseason,
      period,
    });

    lastGameByTeam.set(homeTeamId, date);
    lastGameByTeam.set(visitorTeamId, date);
  }

  return rows;
}

function buildMonthlyScoring(games: BdlGame[]) {
  const aggregates = new Map<number, { label: string; games: number; total: number; regular: number; regularGames: number; playoffs: number; playoffGames: number }>();

  for (const game of games) {
    const date = parseGameDate(game);
    const month = date.getUTCMonth() + 1;
    const label = MONTH_LABELS[month] ?? String(month);
    const entry = aggregates.get(month) ?? {
      label,
      games: 0,
      total: 0,
      regular: 0,
      regularGames: 0,
      playoffs: 0,
      playoffGames: 0,
    };

    const points = game.home_team_score + game.visitor_team_score;
    entry.games += 1;
    entry.total += points;
    if (game.postseason) {
      entry.playoffGames += 1;
      entry.playoffs += points;
    } else {
      entry.regularGames += 1;
      entry.regular += points;
    }
    aggregates.set(month, entry);
  }

  const months = [...aggregates.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => ({
      month: value.label,
      games: value.games,
      averagePoints: value.games ? value.total / value.games : null,
      regularSeasonAverage: value.regularGames ? value.regular / value.regularGames : null,
      playoffAverage: value.playoffGames ? value.playoffs / value.playoffGames : null,
    }));

  const averages = months.map((entry) => entry.averagePoints).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const swing = averages.length ? Math.max(...averages) - Math.min(...averages) : 0;

  return { months, swing };
}

function buildCloseMargins(games: BdlGame[]) {
  const buckets = [
    { label: "0-2 pts", min: 0, max: 2, games: 0, marginSum: 0 },
    { label: "3-5 pts", min: 3, max: 5, games: 0, marginSum: 0 },
    { label: "6-10 pts", min: 6, max: 10, games: 0, marginSum: 0 },
    { label: "11-15 pts", min: 11, max: 15, games: 0, marginSum: 0 },
    { label: "16+ pts", min: 16, max: null as number | null, games: 0, marginSum: 0 },
  ];

  for (const game of games) {
    const margin = Math.abs(game.home_team_score - game.visitor_team_score);
    for (const bucket of buckets) {
      if (margin < bucket.min) continue;
      if (bucket.max !== null && margin > bucket.max) continue;
      bucket.games += 1;
      bucket.marginSum += margin;
      break;
    }
  }

  const totalGames = games.length;
  const distribution = buckets
    .filter((bucket) => bucket.games > 0)
    .map((bucket) => ({
      label: bucket.label,
      games: bucket.games,
      share: totalGames ? bucket.games / totalGames : 0,
      averageMargin: bucket.games ? bucket.marginSum / bucket.games : null,
    }));

  const closeShare = distribution
    .filter((bucket) => bucket.label === "0-2 pts" || bucket.label === "3-5 pts")
    .reduce((acc, bucket) => acc + bucket.share, 0);

  return { distribution, closeShare };
}

function restBucket(roadRest: number, homeRest: number): string {
  if (roadRest < 1) return "Back-to-back";
  const diff = roadRest - homeRest;
  if (diff >= 2) return "+2 days";
  if (diff >= 1) return "+1 day";
  if (diff <= -2) return "-2 days";
  if (diff <= -1) return "-1 day";
  return "Even rest";
}

function buildRestImpact(rows: TeamGameRow[]) {
  const byGame = new Map<number, TeamGameRow[]>();
  for (const row of rows) {
    const list = byGame.get(row.gameId);
    if (list) {
      list.push(row);
    } else {
      byGame.set(row.gameId, [row]);
    }
  }

  const buckets = new Map<string, { label: string; games: number; wins: number; marginSum: number }>();
  const order = ["+2 days", "+1 day", "Even rest", "-1 day", "-2 days", "Back-to-back"];
  for (const label of order) {
    buckets.set(label, { label, games: 0, wins: 0, marginSum: 0 });
  }

  for (const pair of byGame.values()) {
    if (pair.length !== 2) continue;
    const road = pair.find((row) => !row.isHome);
    const home = pair.find((row) => row.isHome);
    if (!road || !home) continue;
    if (road.restDays == null || home.restDays == null) continue;

    const label = restBucket(road.restDays, home.restDays);
    const bucket = buckets.get(label);
    if (!bucket) continue;

    bucket.games += 1;
    if (road.win) {
      bucket.wins += 1;
    }
    bucket.marginSum += road.teamScore - road.opponentScore;
  }

  const stats = order
    .map((label) => buckets.get(label)!)
    .filter((bucket) => bucket.games > 0)
    .map((bucket) => ({
      label: bucket.label,
      games: bucket.games,
      winPct: bucket.games ? bucket.wins / bucket.games : null,
      pointMargin: bucket.games ? bucket.marginSum / bucket.games : null,
    }));

  const positive = stats.filter((entry) => entry.label.startsWith("+"));
  const negative = stats.filter((entry) => entry.label.startsWith("-") || entry.label === "Back-to-back");
  const best = positive.reduce<number | null>((acc, entry) => {
    if (entry.winPct == null) return acc;
    if (acc == null || entry.winPct > acc) return entry.winPct;
    return acc;
  }, null);
  const worst = negative.reduce<number | null>((acc, entry) => {
    if (entry.winPct == null) return acc;
    if (acc == null || entry.winPct < acc) return entry.winPct;
    return acc;
  }, null);

  const swing = best != null && worst != null ? best - worst : 0;

  return { buckets: stats, swing };
}

function buildOvertime(rows: TeamGameRow[], totalGames: number) {
  const byGame = new Map<number, TeamGameRow[]>();
  for (const row of rows) {
    const list = byGame.get(row.gameId);
    if (list) {
      list.push(row);
    } else {
      byGame.set(row.gameId, [row]);
    }
  }

  const labels = ["Regulation", "1 OT", "2 OT", "3 OT", "4+ OT"] as const;
  const buckets = new Map<string, { label: string; games: number; roadWins: number }>();
  for (const label of labels) {
    buckets.set(label, { label, games: 0, roadWins: 0 });
  }

  for (const pair of byGame.values()) {
    if (pair.length !== 2) continue;
    const road = pair.find((row) => !row.isHome);
    if (!road) continue;
    const overtimePeriods = Math.max(0, road.period - 4);
    const label =
      overtimePeriods <= 0
        ? "Regulation"
        : overtimePeriods === 1
          ? "1 OT"
          : overtimePeriods === 2
            ? "2 OT"
            : overtimePeriods === 3
              ? "3 OT"
              : "4+ OT";
    const bucket = buckets.get(label);
    if (!bucket) continue;
    bucket.games += 1;
    if (road.win) {
      bucket.roadWins += 1;
    }
  }

  return labels
    .map((label) => buckets.get(label)!)
    .filter((bucket) => bucket.games > 0)
    .map((bucket) => ({
      label: bucket.label,
      games: bucket.games,
      share: totalGames ? bucket.games / totalGames : 0,
      roadWinPct: bucket.games ? bucket.roadWins / bucket.games : null,
    }));
}

function buildSeasonScoring(games: BdlGame[]) {
  const aggregates = new Map<number, { games: number; total: number; regular: number; regularGames: number; playoffs: number; playoffGames: number }>();

  for (const game of games) {
    const entry = aggregates.get(game.season) ?? {
      games: 0,
      total: 0,
      regular: 0,
      regularGames: 0,
      playoffs: 0,
      playoffGames: 0,
    };
    const points = game.home_team_score + game.visitor_team_score;
    entry.games += 1;
    entry.total += points;
    if (game.postseason) {
      entry.playoffGames += 1;
      entry.playoffs += points;
    } else {
      entry.regularGames += 1;
      entry.regular += points;
    }
    aggregates.set(game.season, entry);
  }

  const seasons = [...aggregates.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([season, value]) => ({
      season,
      averagePoints: value.games ? value.total / value.games : null,
      regularSeasonAverage: value.regularGames ? value.regular / value.regularGames : null,
      playoffAverage: value.playoffGames ? value.playoffs / value.playoffGames : null,
    }));

  const averages = seasons
    .map((entry) => entry.averagePoints)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const swing = averages.length ? Math.max(...averages) - Math.min(...averages) : 0;

  return { seasons, swing };
}

function buildHomeRoadSplits(rows: TeamGameRow[]) {
  const aggregates = new Map<number, { homeGames: number; homeWins: number; roadGames: number; roadWins: number }>();
  for (const row of rows) {
    const entry = aggregates.get(row.season) ?? { homeGames: 0, homeWins: 0, roadGames: 0, roadWins: 0 };
    if (row.isHome) {
      entry.homeGames += 1;
      if (row.win) entry.homeWins += 1;
    } else {
      entry.roadGames += 1;
      if (row.win) entry.roadWins += 1;
    }
    aggregates.set(row.season, entry);
  }

  const seasons = [...aggregates.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([season, value]) => ({
      season,
      homeWinPct: value.homeGames ? value.homeWins / value.homeGames : null,
      roadWinPct: value.roadGames ? value.roadWins / value.roadGames : null,
      gap: value.homeGames && value.roadGames
        ? (value.homeWins / value.homeGames) - (value.roadWins / value.roadGames)
        : null,
    }));

  const recent = seasons.filter((entry) => entry.gap != null);
  const latest = recent.length ? recent[recent.length - 1] : null;

  return { seasons, latestGap: latest?.gap ?? null };
}

async function main(): Promise<void> {
  const seasons = [];
  for (let year = SEASON_START; year <= SEASON_END; year += 1) {
    seasons.push(year);
  }

  const client = new BallDontLieClient();
  const games = await fetchGames(client, seasons);
  if (!games.length) {
    throw new Error("No games returned from Ball Don't Lie — check season range or API key");
  }

  const teamRows = buildTeamRows(games);

  const seasonalScoring = buildMonthlyScoring(games);
  const closeMargins = buildCloseMargins(games);
  const restImpact = buildRestImpact(teamRows);
  const overtime = buildOvertime(teamRows, games.length);
  const seasonScoring = buildSeasonScoring(games);
  const homeRoadSplits = buildHomeRoadSplits(teamRows);

  const payload = {
    generatedAt: new Date().toISOString(),
    sampleSize: games.length,
    seasonRange: { start: seasons[0], end: seasons[seasons.length - 1] },
    seasonalScoring,
    closeMargins,
    restImpact,
    overtime: { categories: overtime },
    seasonAverages: seasonScoring,
    homeRoadSplits,
  };

  await mkdir(PUBLIC_DATA_DIR, { recursive: true });
  console.log(`Writing insights lab snapshot to ${OUTPUT_PATH}`);
  console.log(`Seasons processed: ${seasons[0]}-${seasons[seasons.length - 1]} (${games.length} games)`);
await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

const ENTRY_PATH = process.argv[1] ? path.resolve(process.argv[1]) : null;
const SHOULD_RUN = !ENTRY_PATH || ENTRY_PATH === SCRIPT_PATH;

if (SHOULD_RUN) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
