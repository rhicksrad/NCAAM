import { requireOk } from "../health.js";

const ABSOLUTE_URL_PATTERN = /^(?:https?:)?\/\//i;

const DATA_BASE_URL = (() => {
  if (typeof window !== "undefined" && typeof window.location !== "undefined") {
    return new URL(".", window.location.href).href;
  }

  if (typeof document !== "undefined" && typeof document.baseURI === "string") {
    return new URL(".", document.baseURI).href;
  }

  if (typeof import.meta !== "undefined" && import.meta.url) {
    return new URL(".", import.meta.url).href;
  }

  return null;
})();

const resolveDataUrl = (path: string): string => {
  if (ABSOLUTE_URL_PATTERN.test(path)) {
    return path;
  }

  const normalized = path.replace(/^\/+/, "");

  if (DATA_BASE_URL) {
    return new URL(normalized, DATA_BASE_URL).href;
  }

  return normalized;
};

export async function loadJson<T>(path: string, where: string): Promise<T> {
  const response = await requireOk(resolveDataUrl(path), where);
  return (await response.json()) as T;
}

export const PLAYER_DATA_PATHS = {
  leaderboard: "data/player_stat_leaders_2024-25.json",
  index: "data/players_index.json",
  playerStats: (slug: string) => `data/players/${slug}.json`,
} as const;

export type LeaderboardMetricId =
  | "points"
  | "rebounds"
  | "assists"
  | "stocks"
  | "fgPct"
  | "fg3Pct"
  | "ftPct"
  | "mp"
  | "turnovers";

export const DEFAULT_METRIC_ORDER: LeaderboardMetricId[] = [
  "points",
  "rebounds",
  "assists",
  "stocks",
  "fgPct",
  "fg3Pct",
  "ftPct",
  "mp",
  "turnovers",
];

export type PlayerLeaderboardEntry = {
  name: string;
  team: string;
  slug: string;
  url?: string;
  games?: number | null;
  value: number;
  valueFormatted?: string;
};

export type PlayerLeaderboardMetric = {
  label: string;
  shortLabel: string;
  leaders: PlayerLeaderboardEntry[];
};

export type PlayerLeaderboardDocument = {
  season: string;
  seasonYear?: number | null;
  generatedAt: string;
  metrics: Record<string, PlayerLeaderboardMetric | undefined>;
};

export type PlayerIndexEntry = {
  name: string;
  team: string;
  season: string;
  slug: string;
  url?: string;
  season_year?: number;
  name_key?: string;
  team_key?: string;
  conference?: string;
};

export type PlayerIndexDocument = {
  seasons?: string[];
  players?: PlayerIndexEntry[];
};

export type PlayerStatsSeason = {
  season: string;
  team: string;
  conf: string;
  gp: number | null;
  gs: number | null;
  mp_g: number | null;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
  orb_g: number | null;
  drb_g: number | null;
  trb_g: number | null;
  ast_g: number | null;
  stl_g: number | null;
  blk_g: number | null;
  tov_g: number | null;
  pf_g: number | null;
  pts_g: number | null;
};

export type PlayerStatsDocument = {
  slug: string;
  name: string;
  seasons: PlayerStatsSeason[];
  source: string;
  last_scraped: string;
};

export type RosterPlayer = {
  entry: PlayerIndexEntry;
  stats: PlayerStatsSeason | null;
};

export async function loadLeaderboardDocument(): Promise<PlayerLeaderboardDocument> {
  return await loadJson<PlayerLeaderboardDocument>(PLAYER_DATA_PATHS.leaderboard, "Players leaderboard");
}

export async function loadPlayerIndexDocument(): Promise<PlayerIndexDocument> {
  return await loadJson<PlayerIndexDocument>(PLAYER_DATA_PATHS.index, "Players index");
}

const playerDocumentCache = new Map<string, Promise<PlayerStatsDocument>>();

export async function loadPlayerStatsDocument(slug: string): Promise<PlayerStatsDocument> {
  if (!playerDocumentCache.has(slug)) {
    const load = loadJson<PlayerStatsDocument>(PLAYER_DATA_PATHS.playerStats(slug), `Player stats ${slug}`).catch((error) => {
      playerDocumentCache.delete(slug);
      throw error;
    });
    playerDocumentCache.set(slug, load);
  }

  return await playerDocumentCache.get(slug)!;
}

export function pickSeasonStats(document: PlayerStatsDocument, season: string): PlayerStatsSeason | null {
  const seasons = document.seasons ?? [];
  const exact = seasons.find((entry) => entry.season === season);
  if (exact) return exact;
  return seasons.length ? seasons[seasons.length - 1] : null;
}

export async function buildRosterPlayers(entries: PlayerIndexEntry[]): Promise<RosterPlayer[]> {
  const roster = await Promise.all(
    entries.map(async (entry) => {
      try {
        const document = await loadPlayerStatsDocument(entry.slug);
        const stats = pickSeasonStats(document, entry.season);
        return { entry, stats } satisfies RosterPlayer;
      } catch (error) {
        console.error(`Unable to load stats for ${entry.slug}`, error);
        return { entry, stats: null } satisfies RosterPlayer;
      }
    }),
  );

  roster.sort((a, b) => {
    const aPts = a.stats?.pts_g ?? 0;
    const bPts = b.stats?.pts_g ?? 0;
    if (bPts !== aPts) {
      return bPts - aPts;
    }
    return a.entry.name.localeCompare(b.entry.name);
  });

  return roster;
}
