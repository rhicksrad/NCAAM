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
const resolveDataUrl = (path) => {
    if (ABSOLUTE_URL_PATTERN.test(path)) {
        return path;
    }
    const normalized = path.replace(/^\/+/, "");
    if (DATA_BASE_URL) {
        return new URL(normalized, DATA_BASE_URL).href;
    }
    return normalized;
};
export async function loadJson(path, where) {
    const response = await requireOk(resolveDataUrl(path), where);
    return (await response.json());
}
export const PLAYER_DATA_PATHS = {
    leaderboard: "data/player_stat_leaders_2024-25.json",
    index: "data/players_index.json",
    playerStats: (slug) => `data/players/${slug}.json`,
};
export const DEFAULT_METRIC_ORDER = [
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
export async function loadLeaderboardDocument() {
    return await loadJson(PLAYER_DATA_PATHS.leaderboard, "Players leaderboard");
}
export async function loadPlayerIndexDocument() {
    return await loadJson(PLAYER_DATA_PATHS.index, "Players index");
}
const playerDocumentCache = new Map();
export async function loadPlayerStatsDocument(slug) {
    if (!playerDocumentCache.has(slug)) {
        const load = loadJson(PLAYER_DATA_PATHS.playerStats(slug), `Player stats ${slug}`).catch((error) => {
            playerDocumentCache.delete(slug);
            throw error;
        });
        playerDocumentCache.set(slug, load);
    }
    return await playerDocumentCache.get(slug);
}
export function pickSeasonStats(document, season) {
    const seasons = document.seasons ?? [];
    const exact = seasons.find((entry) => entry.season === season);
    if (exact)
        return exact;
    return seasons.length ? seasons[seasons.length - 1] : null;
}
export async function buildRosterPlayers(entries) {
    const roster = await Promise.all(entries.map(async (entry) => {
        try {
            const document = await loadPlayerStatsDocument(entry.slug);
            const stats = pickSeasonStats(document, entry.season);
            return { entry, stats };
        }
        catch (error) {
            console.error(`Unable to load stats for ${entry.slug}`, error);
            return { entry, stats: null };
        }
    }));
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
