import { API, CACHE_TTL_MS } from "../config.js";
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
function key(path, params) {
    const q = buildSearchParams(params).toString();
    return `NCAAM:${path}?${q}`;
}
async function get(path, params = {}) {
    const k = key(path, params), now = Date.now();
    try {
        const c = localStorage.getItem(k);
        if (c) {
            const { t, v } = JSON.parse(c);
            if (now - t < CACHE_TTL_MS)
                return v;
        }
    }
    catch { }
    const q = buildSearchParams(params).toString();
    const url = `${API}${path}${q ? `?${q}` : ""}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok)
        throw new Error(`API ${res.status}`);
    const v = await res.json();
    try {
        localStorage.setItem(k, JSON.stringify({ t: now, v }));
    }
    catch { }
    return v;
}
export const NCAAM = {
    teams: (page = 1, per_page = 200) => get("/teams", { page, per_page }),
    players: (page = 1, per_page = 200, search = "") => get("/players", { page, per_page, search }),
    activePlayersByTeam: (teamId) => get("/players/active", { "team_ids[]": teamId, per_page: 100 }),
    games: (page = 1, per_page = 200, start_date = "", end_date = "") => get("/games", { page, per_page, start_date, end_date }),
    conferences: () => get("/conferences"),
    playerStats: ({ season, postseason, teamIds, playerIds, page = 1, perPage = 100, cursor, } = {}) => {
        const params = { page, per_page: perPage };
        if (typeof season === "number" && Number.isFinite(season))
            params.season = season;
        if (postseason)
            params.postseason = true;
        if (cursor !== undefined && cursor !== null)
            params.cursor = cursor;
        if (Array.isArray(teamIds) && teamIds.length > 0)
            params["team_ids[]"] = teamIds;
        if (Array.isArray(playerIds) && playerIds.length > 0)
            params["player_ids[]"] = playerIds;
        return get("/stats", params);
    },
};
