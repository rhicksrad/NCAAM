import { API, CACHE_TTL_MS } from "../config.js";

type JSONV = any;
type QueryValue = string | number | boolean | Array<string | number | boolean> | null | undefined;

function buildSearchParams(params: Record<string, QueryValue>): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry === undefined || entry === null) continue;
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

function key(path:string, params:Record<string,QueryValue>) {
  const q = buildSearchParams(params).toString();
  return `NCAAM:${path}?${q}`;
}
async function get<T=JSONV>(path:string, params:Record<string,QueryValue>={}) {
  const k = key(path, params), now = Date.now();
  try {
    const c = localStorage.getItem(k);
    if (c) {
      const { t, v } = JSON.parse(c);
      if (now - t < CACHE_TTL_MS) return v as T;
    }
  } catch {}
  const q = buildSearchParams(params).toString();
  const url = `${API}${path}${q ? `?${q}` : ""}`;
  const res = await fetch(url, { headers:{ "Accept":"application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const v = await res.json();
  try { localStorage.setItem(k, JSON.stringify({ t: now, v })); } catch {}
  return v as T;
}

export type Team = {
  id: number;
  full_name: string;
  name: string;
  conference_id?: number;
  conference?: string;
  abbreviation?: string;
  college?: string;
};
export type Player = {
  id: number;
  first_name: string;
  last_name: string;
  team?: Team;
  position?: string;
  jersey_number?: string;
  height?: string;
  weight?: string;
};
export type Game = { id:number; date:string; status:string; home_team:Team; visitor_team:Team; home_team_score?:number; visitor_team_score?:number; };
export type Conference = { id:number; name:string; short_name?:string };
export type PlayerStatLine = {
  id: number;
  min?: string | null;
  fgm?: number;
  fga?: number;
  fg3m?: number;
  fg3a?: number;
  ftm?: number;
  fta?: number;
  oreb?: number;
  dreb?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  turnover?: number;
  pf?: number;
  pts?: number;
  season?: number;
  game?: Game & { season?: number; postseason?: boolean };
  team?: Team;
  player?: Player;
};

export type PlayerStatsOptions = {
  season?: number;
  postseason?: boolean;
  teamIds?: number[];
  playerIds?: number[];
  page?: number;
  perPage?: number;
  cursor?: string | number;
};

export const NCAAM = {
  teams: (page=1, per_page=200) => get<{data:Team[]}>("/teams", { page, per_page }),
  players: (page=1, per_page=200, search="") => get<{data:Player[]}>("/players", { page, per_page, search }),
  activePlayersByTeam: (teamId:number) => get<{data:Player[]}>("/players/active", { "team_ids[]": teamId, per_page: 100 }),
  games: (page=1, per_page=200, start_date="", end_date="") => get<{data:Game[]}>("/games", { page, per_page, start_date, end_date }),
  conferences: () => get<{data:Conference[]}>("/conferences"),
  playerStats: ({
    season,
    postseason,
    teamIds,
    playerIds,
    page = 1,
    perPage = 100,
    cursor,
  }: PlayerStatsOptions = {}) => {
    const params: Record<string, QueryValue> = { page, per_page: perPage };
    if (typeof season === "number" && Number.isFinite(season)) params.season = season;
    if (postseason) params.postseason = true;
    if (cursor !== undefined && cursor !== null) params.cursor = cursor;
    if (Array.isArray(teamIds) && teamIds.length > 0) params["team_ids[]"] = teamIds;
    if (Array.isArray(playerIds) && playerIds.length > 0) params["player_ids[]"] = playerIds;
    return get<{ data: PlayerStatLine[]; meta?: { next_page?: number | null; next_cursor?: string | number | null } }>(
      "/stats",
      params,
    );
  },
};
