import { API, CACHE_TTL_MS } from "../config.js";
function key(path, params) {
    const q = new URLSearchParams(params).toString();
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
    const q = new URLSearchParams(params).toString();
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
    games: (page = 1, per_page = 200, start_date = "", end_date = "") => get("/games", { page, per_page, start_date, end_date }),
};
