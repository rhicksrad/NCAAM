import { API, CACHE_TTL_MS } from "../config.js";
function buildSearchParams(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null)
            continue;
        if (Array.isArray(value)) {
            for (const entry of value) {
                search.append(key, String(entry));
            }
        }
        else {
            search.set(key, String(value));
        }
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
    teams: (page = 1, per_page = 200, options = {}) => {
        const params = { page, per_page };
        if (options.conference_id !== undefined && options.conference_id !== null)
            params.conference_id = options.conference_id;
        if (options.search)
            params.search = options.search;
        if (options.cursor !== undefined && options.cursor !== null)
            params.cursor = options.cursor;
        return get("/teams", params);
    },
    players: (page = 1, per_page = 200, search = "") => {
        const params = { page, per_page };
        if (search)
            params.search = search;
        return get("/players", params);
    },
    playersActive: (options = {}) => {
        const params = {};
        const perPage = options.perPage ?? 100;
        params.per_page = perPage;
        if (options.search)
            params.search = options.search;
        if (options.cursor !== undefined && options.cursor !== null)
            params.cursor = options.cursor;
        if (Array.isArray(options.teamIds) && options.teamIds.length) {
            params["team_ids[]"] = options.teamIds;
        }
        else if (typeof options.teamId === "number") {
            params["team_ids[]"] = options.teamId;
        }
        return get("/players/active", params);
    },
    games: (page = 1, per_page = 200, start_date = "", end_date = "") => get("/games", { page, per_page, start_date, end_date }),
    conferences: () => get("/conferences"),
};
