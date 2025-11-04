import { API, CACHE_TTL_MS } from "../config.js";
const SAFE_PAGE_SIZE = 100;
const MAX_PAGINATION_REQUESTS = 50;
function buildSearchParams(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null)
            continue;
        if (Array.isArray(value)) {
            for (const entry of value) {
                if (entry === undefined || entry === null)
                    continue;
                search.append(key, String(entry));
            }
            continue;
        }
        if (typeof value === "boolean") {
            search.append(key, value ? "true" : "false");
            continue;
        }
        search.append(key, String(value));
    }
    return search;
}
function normalizePath(path) {
    if (!path) {
        return "/";
    }
    return path.startsWith("/") ? path : `/${path}`;
}
function key(path, params) {
    const normalizedPath = normalizePath(path);
    const q = buildSearchParams(params).toString();
    return q ? `NCAAM:${normalizedPath}?${q}` : `NCAAM:${normalizedPath}`;
}
function readCache(cacheKey, now) {
    try {
        const cached = localStorage.getItem(cacheKey);
        if (!cached)
            return null;
        const { t, v } = JSON.parse(cached);
        if (typeof t === "number" && now - t < CACHE_TTL_MS) {
            return v;
        }
    }
    catch { }
    return null;
}
function writeCache(cacheKey, now, value) {
    try {
        localStorage.setItem(cacheKey, JSON.stringify({ t: now, v: value }));
    }
    catch { }
}
async function get(path, params = {}) {
    const cacheKey = key(path, params);
    const now = Date.now();
    const cached = readCache(cacheKey, now);
    if (cached !== null) {
        return cached;
    }
    const normalizedPath = normalizePath(path);
    const q = buildSearchParams(params).toString();
    const url = q ? `${API}${normalizedPath}?${q}` : `${API}${normalizedPath}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok)
        throw new Error(`API ${res.status}`);
    const value = (await res.json());
    writeCache(cacheKey, now, value);
    return value;
}
function resolveNextPage(meta, currentPage) {
    if (!meta) {
        return null;
    }
    const { next_page, current_page, total_pages } = meta;
    if (typeof next_page === "number" && Number.isFinite(next_page)) {
        return next_page === currentPage ? null : next_page;
    }
    if (next_page === null) {
        return null;
    }
    if (typeof current_page === "number" &&
        Number.isFinite(current_page) &&
        typeof total_pages === "number" &&
        Number.isFinite(total_pages)) {
        if (current_page >= total_pages) {
            return null;
        }
        return current_page + 1;
    }
    return null;
}
function shouldRetryWithPagination(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return /^API 4\d\d/.test(error.message);
}
async function getTeamsPaginated(page, perPage) {
    const desiredTotal = perPage > 0 ? perPage : SAFE_PAGE_SIZE;
    const cacheKey = key("/teams", { page, per_page: desiredTotal });
    const now = Date.now();
    const cached = readCache(cacheKey, now);
    if (cached !== null) {
        return cached;
    }
    const aggregated = [];
    let currentPage = page;
    let remaining = desiredTotal;
    let lastMeta;
    let iterations = 0;
    while (iterations < MAX_PAGINATION_REQUESTS) {
        iterations += 1;
        const pageSize = Math.min(SAFE_PAGE_SIZE, Math.max(remaining, 1));
        const response = await get("/teams", {
            page: currentPage,
            per_page: pageSize,
        });
        const pageData = Array.isArray(response.data) ? response.data : [];
        aggregated.push(...pageData);
        lastMeta = response.meta;
        if (aggregated.length >= desiredTotal) {
            break;
        }
        if (pageData.length === 0) {
            break;
        }
        const nextPage = resolveNextPage(lastMeta, currentPage);
        if (!nextPage || nextPage === currentPage) {
            break;
        }
        currentPage = nextPage;
        remaining = desiredTotal - aggregated.length;
    }
    const result = {
        data: aggregated.slice(0, desiredTotal),
        meta: lastMeta,
    };
    writeCache(cacheKey, now, result);
    return result;
}
export const NCAAM = {
    teams: async (page = 1, per_page = 200) => {
        if (per_page > SAFE_PAGE_SIZE) {
            return getTeamsPaginated(page, per_page);
        }
        try {
            return await get("/teams", { page, per_page });
        }
        catch (error) {
            if (shouldRetryWithPagination(error)) {
                return getTeamsPaginated(page, per_page);
            }
            throw error;
        }
    },
    players: (page = 1, per_page = 200, search = "") => get("/players", { page, per_page, search }),
    activePlayers: (per_page = SAFE_PAGE_SIZE, cursor, season) => {
        const params = {
            per_page,
            cursor,
        };
        if (season !== undefined && season !== null && `${season}`.length > 0) {
            params["seasons[]"] = season;
        }
        return get("/players/active", params);
    },
    activePlayersByTeam: (teamId, season) => {
        const params = { "team_ids[]": teamId, per_page: 100 };
        if (season !== undefined && season !== null && `${season}`.length > 0) {
            params["seasons[]"] = season;
        }
        return get("/players/active", params);
    },
    games: (page = 1, per_page = 200, start_date = "", end_date = "") => get("/games", { page, per_page, start_date, end_date }),
    game: async (gameId) => {
        if (gameId === null || gameId === undefined) {
            return null;
        }
        const normalized = typeof gameId === "string" ? gameId.trim() : gameId;
        if (normalized === "" || normalized === null) {
            return null;
        }
        const idSegment = typeof normalized === "string" ? normalized : String(normalized);
        try {
            const response = await get(`/games/${idSegment}`);
            const game = response?.data ?? null;
            return game && typeof game === "object" ? game : null;
        }
        catch (error) {
            if (error instanceof Error && /^API 404/.test(error.message)) {
                return null;
            }
            throw error;
        }
    },
    plays: (gameId) => get("/plays", { game_id: gameId }),
    conferences: () => get("/conferences"),
    rankings: (params = {}) => get("/rankings", params),
};
