import { API, CACHE_TTL_MS } from "../config.js";

type JSONV = any;
function key(path:string, params:Record<string,string|number>) {
  const q = new URLSearchParams(params as Record<string,string>).toString();
  return `NCAAM:${path}?${q}`;
}
async function get<T=JSONV>(path:string, params:Record<string,string|number>={}) {
  const k = key(path, params), now = Date.now();
  try {
    const c = localStorage.getItem(k);
    if (c) {
      const { t, v } = JSON.parse(c);
      if (now - t < CACHE_TTL_MS) return v as T;
    }
  } catch {}
  const q = new URLSearchParams(params as Record<string,string>).toString();
  const url = `${API}${path}${q ? `?${q}` : ""}`;
  const res = await fetch(url, { headers:{ "Accept":"application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const v = await res.json();
  try { localStorage.setItem(k, JSON.stringify({ t: now, v })); } catch {}
  return v as T;
}

export type Team = { id:number; full_name:string; name:string; conference?:string; abbreviation?:string };
export type Player = { id:number; first_name:string; last_name:string; team?:Team; position?:string; };
export type Game = { id:number; date:string; status:string; home_team:Team; visitor_team:Team; home_team_score?:number; visitor_team_score?:number; };

export const NCAAM = {
  teams: (page=1, per_page=200) => get<{data:Team[]}>("/teams", { page, per_page }),
  players: (page=1, per_page=200, search="") => get<{data:Player[]}>("/players", { page, per_page, search }),
  games: (page=1, per_page=200, start_date="", end_date="") => get<{data:Game[]}>("/games", { page, per_page, start_date, end_date }),
};
