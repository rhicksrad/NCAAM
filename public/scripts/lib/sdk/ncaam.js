import { API } from "../config.js";
async function get(path, params = {}) {
    const q = new URLSearchParams(params).toString();
    const url = `${API}${path}${q ? `?${q}` : ""}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok)
        throw new Error(`API ${res.status}`);
    return res.json();
}
export const NCAAM = {
    teams: (page = 1, per_page = 50) => get("/teams", { page, per_page }),
    players: (page = 1, per_page = 50, search = "") => get("/players", { page, per_page, search }),
    games: (page = 1, per_page = 50, dates = "") => get("/games", { page, per_page, dates })
};
