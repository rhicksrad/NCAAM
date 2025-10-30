import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SEASON, getSeasonStartYear } from "../lib/season.js";

const DEFAULT_API_BASE = (process.env.NCAAM_WORKER_URL || process.env.NCAAM_API_BASE || "")
  .toString()
  .trim() || "https://ncaam.hicksrch.workers.dev/v1";
const DEFAULT_PER_PAGE = 100;
const MAX_PAGES = 4000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const OUTPUT_PATH = path.join(ROOT, "public", "data", "player_stats.json");

interface StatsResponseMeta {
  next_page?: number | null;
  next_cursor?: string | number | null;
}

interface PlayerStatsResponse {
  data?: PlayerStatLine[];
  meta?: StatsResponseMeta | null;
}

interface PlayerStub {
  id?: number | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface TeamStub {
  id?: number | null;
  abbreviation?: string | null;
}

interface PlayerStatLine {
  id?: number | null;
  player?: PlayerStub | null;
  team?: TeamStub | null;
  min?: string | null;
  fgm?: number | null;
  fga?: number | null;
  fg3m?: number | null;
  fg3a?: number | null;
  ftm?: number | null;
  fta?: number | null;
  oreb?: number | null;
  dreb?: number | null;
  reb?: number | null;
  ast?: number | null;
  stl?: number | null;
  blk?: number | null;
  turnover?: number | null;
  pf?: number | null;
  pts?: number | null;
}

interface PlayerTotals {
  playerId: number;
  teamId: number | null;
  teamAbbr: string | null;
  games: number;
  seconds: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pts: number;
}

interface PlayerAverage {
  player_id: number;
  team_id: number | null;
  team_abbreviation: string | null;
  games_played: number;
  avg_seconds: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
}

interface PlayerStatIndex {
  season: number;
  season_label: string;
  generated: string;
  player_count: number;
  players: Record<string, PlayerAverage>;
}

function parseArgs(): { season: number } {
  const [, , ...rest] = process.argv;
  for (const arg of rest) {
    const [key, rawValue] = arg.split("=");
    if (key === "--season" && rawValue) {
      const parsed = Number(rawValue);
      if (Number.isFinite(parsed) && parsed > 0) {
        return { season: parsed };
      }
    }
  }
  return { season: getSeasonStartYear(SEASON) };
}

function parseNumber(value: number | string | null | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function parseMinutes(value: string | null | undefined): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const [minutePart, secondPart] = trimmed.split(":");
  const minutes = Number.parseInt(minutePart ?? "0", 10);
  const seconds = Number.parseInt(secondPart ?? "0", 10);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return 0;
  }
  return Math.max(0, minutes * 60 + seconds);
}

function createTotals(playerId: number): PlayerTotals {
  return {
    playerId,
    teamId: null,
    teamAbbr: null,
    games: 0,
    seconds: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pts: 0,
  };
}

function accumulate(totals: PlayerTotals, line: PlayerStatLine): void {
  totals.games += 1;
  totals.seconds += parseMinutes(line.min);
  totals.fgm += parseNumber(line.fgm);
  totals.fga += parseNumber(line.fga);
  totals.fg3m += parseNumber(line.fg3m);
  totals.fg3a += parseNumber(line.fg3a);
  totals.ftm += parseNumber(line.ftm);
  totals.fta += parseNumber(line.fta);
  totals.reb += parseNumber(line.reb);
  totals.ast += parseNumber(line.ast);
  totals.stl += parseNumber(line.stl);
  totals.blk += parseNumber(line.blk);
  totals.tov += parseNumber(line.turnover);
  totals.pts += parseNumber(line.pts);
  if (line.team) {
    const id = Number(line.team.id);
    if (Number.isFinite(id)) {
      totals.teamId = id;
    }
    if (line.team.abbreviation) {
      totals.teamAbbr = line.team.abbreviation;
    }
  }
}

function toAverage(totals: PlayerTotals): PlayerAverage {
  const games = Math.max(1, totals.games);
  return {
    player_id: totals.playerId,
    team_id: totals.teamId,
    team_abbreviation: totals.teamAbbr,
    games_played: totals.games,
    avg_seconds: totals.seconds / games,
    pts: totals.pts / games,
    reb: totals.reb / games,
    ast: totals.ast / games,
    stl: totals.stl / games,
    blk: totals.blk / games,
    tov: totals.tov / games,
    fg_pct: totals.fga > 0 ? totals.fgm / totals.fga : null,
    fg3_pct: totals.fg3a > 0 ? totals.fg3m / totals.fg3a : null,
    ft_pct: totals.fta > 0 ? totals.ftm / totals.fta : null,
  };
}

async function fetchStatsPage({
  page,
  season,
  cursor,
}: {
  page: number;
  season: number;
  cursor?: string | number | null;
}): Promise<PlayerStatsResponse> {
  const params = new URLSearchParams({
    per_page: String(DEFAULT_PER_PAGE),
    page: String(page),
    season: String(season),
  });
  if (cursor !== undefined && cursor !== null) {
    params.set("cursor", String(cursor));
  }
  const url = `${DEFAULT_API_BASE}/stats?${params.toString()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const snippet = await response.text().catch(() => "");
    throw new Error(`Failed to fetch stats from ${url} — ${response.status} ${response.statusText}${
      snippet ? `\n${snippet}` : ""
    }`);
  }
  return (await response.json()) as PlayerStatsResponse;
}

async function buildIndex(season: number): Promise<PlayerStatIndex> {
  const totals = new Map<number, PlayerTotals>();
  let page = 1;
  let cursor: string | number | undefined;

  for (let attempts = 0; attempts < MAX_PAGES; attempts += 1) {
    const result = await fetchStatsPage({ page, season, cursor });
    const rows = Array.isArray(result.data) ? result.data : [];
    for (const row of rows) {
      const playerId = Number(row.player?.id);
      if (!Number.isFinite(playerId) || playerId <= 0) {
        continue;
      }
      const bucket = totals.get(playerId) ?? createTotals(playerId);
      accumulate(bucket, row);
      totals.set(playerId, bucket);
    }

    const meta = result.meta ?? {};
    const nextCursor = meta.next_cursor;
    if (nextCursor !== undefined && nextCursor !== null && String(nextCursor).length > 0) {
      cursor = nextCursor;
      continue;
    }

    const nextPage = typeof meta.next_page === "number" ? meta.next_page : null;
    if (nextPage && nextPage !== page) {
      page = nextPage;
      cursor = undefined;
      continue;
    }

    if (rows.length < DEFAULT_PER_PAGE) {
      break;
    }

    page += 1;
  }

  const entries: [string, PlayerAverage][] = [];
  for (const [playerId, bucket] of totals.entries()) {
    entries.push([String(playerId), toAverage(bucket)]);
  }

  entries.sort(([aId], [bId]) => Number(aId) - Number(bId));

  return {
    season,
    season_label: `${season}-${String(season + 1).slice(-2)}`,
    generated: new Date().toISOString(),
    player_count: entries.length,
    players: Object.fromEntries(entries),
  };
}

async function main() {
  const { season } = parseArgs();
  console.log(`Fetching NCAAM player stats for season ${season} using ${DEFAULT_API_BASE}`);
  try {
    const index = await buildIndex(season);
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
    console.log(`Wrote ${index.player_count} player averages to ${path.relative(ROOT, OUTPUT_PATH)}`);
    return;
  } catch (error) {
    console.warn(`Falling back to sample player stats after fetch failure: ${String(error)}`);
    const fallbackPath = path.join(ROOT, "data", "sample_player_stats.json");
    try {
      const raw = await fs.readFile(fallbackPath, "utf8");
      const fallback = JSON.parse(raw) as PlayerStatIndex;
      await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
      await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
      console.warn(`Wrote fallback stats from ${path.relative(ROOT, fallbackPath)} to ${path.relative(ROOT, OUTPUT_PATH)}`);
      return;
    } catch (fallbackError) {
      console.error(`Failed to load fallback stats: ${String(fallbackError)}`);
      process.exitCode = 1;
    }
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
