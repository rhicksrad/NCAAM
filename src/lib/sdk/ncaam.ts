import { API, CACHE_TTL_MS } from "../config.js";

type JSONV = any;
type QueryValue = string | number | boolean | Array<string | number | boolean> | null | undefined;

type PaginationMeta = {
  next_page?: number | null;
  current_page?: number | null;
  total_pages?: number | null;
};

type PaginatedResponse<T> = {
  data: T[];
  meta?: PaginationMeta;
};

const SAFE_PAGE_SIZE = 100;
const MAX_PAGINATION_REQUESTS = 50;

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

function key(path: string, params: Record<string, QueryValue>) {
  const q = buildSearchParams(params).toString();
  return `NCAAM:${path}?${q}`;
}

function readCache<T>(cacheKey: string, now: number): T | null {
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    const { t, v } = JSON.parse(cached) as { t: number; v: T };
    if (typeof t === "number" && now - t < CACHE_TTL_MS) {
      return v;
    }
  } catch {}
  return null;
}

function writeCache<T>(cacheKey: string, now: number, value: T): void {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ t: now, v: value }));
  } catch {}
}

async function get<T = JSONV>(path: string, params: Record<string, QueryValue> = {}) {
  const cacheKey = key(path, params);
  const now = Date.now();
  const cached = readCache<T>(cacheKey, now);
  if (cached !== null) {
    return cached;
  }

  const q = buildSearchParams(params).toString();
  const url = `${API}${path}${q ? `?${q}` : ""}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const value = (await res.json()) as T;
  writeCache(cacheKey, now, value);
  return value;
}

function resolveNextPage(meta: PaginationMeta | undefined, currentPage: number): number | null {
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
  if (
    typeof current_page === "number" &&
    Number.isFinite(current_page) &&
    typeof total_pages === "number" &&
    Number.isFinite(total_pages)
  ) {
    if (current_page >= total_pages) {
      return null;
    }
    return current_page + 1;
  }
  return null;
}

function shouldRetryWithPagination(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /^API 4\d\d/.test(error.message);
}

async function getTeamsPaginated(page: number, perPage: number): Promise<PaginatedResponse<Team>> {
  const desiredTotal = perPage > 0 ? perPage : SAFE_PAGE_SIZE;
  const cacheKey = key("/teams", { page, per_page: desiredTotal });
  const now = Date.now();
  const cached = readCache<PaginatedResponse<Team>>(cacheKey, now);
  if (cached !== null) {
    return cached;
  }

  const aggregated: Team[] = [];
  let currentPage = page;
  let remaining = desiredTotal;
  let lastMeta: PaginationMeta | undefined;
  let iterations = 0;

  while (iterations < MAX_PAGINATION_REQUESTS) {
    iterations += 1;
    const pageSize = Math.min(SAFE_PAGE_SIZE, Math.max(remaining, 1));
    const response = await get<PaginatedResponse<Team>>("/teams", {
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

  const result: PaginatedResponse<Team> = {
    data: aggregated.slice(0, desiredTotal),
    meta: lastMeta,
  };

  writeCache(cacheKey, now, result);
  return result;
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
export const NCAAM = {
  teams: async (page = 1, per_page = 200) => {
    if (per_page > SAFE_PAGE_SIZE) {
      return getTeamsPaginated(page, per_page);
    }
    try {
      return await get<PaginatedResponse<Team>>("/teams", { page, per_page });
    } catch (error) {
      if (shouldRetryWithPagination(error)) {
        return getTeamsPaginated(page, per_page);
      }
      throw error;
    }
  },
  players: (page=1, per_page=200, search="") => get<{data:Player[]}>("/players", { page, per_page, search }),
  activePlayersByTeam: (teamId:number) => get<{data:Player[]}>("/players/active", { "team_ids[]": teamId, per_page: 100 }),
  games: (page=1, per_page=200, start_date="", end_date="") => get<{data:Game[]}>("/games", { page, per_page, start_date, end_date }),
  conferences: () => get<{data:Conference[]}>("/conferences"),
};
