import { API, CACHE_TTL_MS } from "../config.js";

type JSONV = any;
type QueryPrimitive = string | number | boolean;
type QueryValue = QueryPrimitive | readonly QueryPrimitive[] | QueryPrimitive[] | null | undefined;
type QueryParams = Record<string, QueryValue>;

function buildSearchParams(params: QueryParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        search.append(key, String(entry));
      }
    } else {
      search.set(key, String(value));
    }
  }
  return search;
}

function key(path: string, params: QueryParams) {
  const q = buildSearchParams(params).toString();
  return `NCAAM:${path}?${q}`;
}

async function get<T = JSONV>(path: string, params: QueryParams = {}) {
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
  conference_id?: number | null;
  conference?: string;
  abbreviation?: string;
  college?: string | null;
};
export type Player = { id:number; first_name:string; last_name:string; team?:Team; position?:string; };
export type Game = { id:number; date:string; status:string; home_team:Team; visitor_team:Team; home_team_score?:number; visitor_team_score?:number; };
export type Conference = { id:number; name:string; short_name?:string };

export type ActivePlayer = Player & {
  jersey_number?: string | null;
  height?: string | null;
  weight?: string | null;
};

type TeamsResponse = { data: Team[] };
type PlayersResponse = { data: Player[] };
export type ActivePlayersResponse = {
  data: ActivePlayer[];
  meta?: { next_cursor?: string | number | null; per_page?: number };
};

type TeamsOptions = {
  conference_id?: number | null;
  search?: string;
  page?: number;
  cursor?: string | number | null;
};

type ActivePlayersOptions = {
  teamId?: number;
  teamIds?: number[];
  perPage?: number;
  cursor?: string | number | null;
  search?: string;
};

export const NCAAM = {
  teams: (page = 1, per_page = 200, options: TeamsOptions = {}) => {
    const params: QueryParams = { page, per_page };
    if (options.conference_id !== undefined && options.conference_id !== null) params.conference_id = options.conference_id;
    if (options.search) params.search = options.search;
    if (options.cursor !== undefined && options.cursor !== null) params.cursor = options.cursor;
    return get<TeamsResponse>("/teams", params);
  },
  players: (page = 1, per_page = 200, search = "") => {
    const params: QueryParams = { page, per_page };
    if (search) params.search = search;
    return get<PlayersResponse>("/players", params);
  },
  playersActive: (options: ActivePlayersOptions = {}) => {
    const params: QueryParams = {};
    const perPage = options.perPage ?? 100;
    params.per_page = perPage;
    if (options.search) params.search = options.search;
    if (options.cursor !== undefined && options.cursor !== null) params.cursor = options.cursor;
    if (Array.isArray(options.teamIds) && options.teamIds.length) {
      params["team_ids[]"] = options.teamIds;
    } else if (typeof options.teamId === "number") {
      params["team_ids[]"] = options.teamId;
    }
    return get<ActivePlayersResponse>("/players/active", params);
  },
  games: (page = 1, per_page = 200, start_date = "", end_date = "") => get<{data:Game[]}>("/games", { page, per_page, start_date, end_date }),
  conferences: () => get<{data:Conference[]}>("/conferences"),
};
