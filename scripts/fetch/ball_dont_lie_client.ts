import { z } from "zod";

import { DEFAULT_TTL_MS, withCache } from "./cache.js";
import { request } from "./http.js";

const DEFAULT_API_BASE = "https://bdlproxy.hicksrch.workers.dev/bdl";

const metaSchema = z
  .object({
    next_page: z.number().int().nullable().optional(),
    next_cursor: z.union([z.string(), z.number(), z.null()]).optional(),
    per_page: z.number().int().optional(),
    total_pages: z.number().int().optional(),
    current_page: z.number().int().optional(),
  })
  .partial();

const teamSchema = z
  .object({
    id: z.number().int(),
    abbreviation: z.string().min(1),
    full_name: z.string().min(1),
    city: z.string().optional(),
    division: z.string().optional(),
    conference: z.string().optional(),
  })
  .strip();

const nestedTeamSchema = teamSchema.pick({ id: true, abbreviation: true, full_name: true }).extend({
  city: z.string().optional(),
});

const playerSchema = z
  .object({
    id: z.number().int(),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    position: z.string().nullable().optional(),
    jersey_number: z.string().nullable().optional(),
    height: z.string().nullable().optional(),
    weight: z.string().nullable().optional(),
    team: nestedTeamSchema,
  })
  .strip();

const gameSchema = z
  .object({
    id: z.number().int(),
    date: z.string().min(1),
    season: z.number().int(),
    status: z.string().min(1),
    season_type: z.string().optional(),
    postseason: z.boolean().optional(),
    home_team_score: z.number().int(),
    visitor_team_score: z.number().int(),
    home_team: nestedTeamSchema,
    visitor_team: nestedTeamSchema,
  })
  .strip();

const pageSchema = z
  .object({
    data: z.array(z.unknown()),
    meta: metaSchema.optional(),
  })
  .strip();

export type BdlTeam = z.infer<typeof teamSchema>;
export type BdlPlayer = z.infer<typeof playerSchema>;
export type BdlGame = z.infer<typeof gameSchema>;

export interface TeamMap {
  byAbbr: Record<string, BdlTeam>;
  byName: Record<string, BdlTeam>;
}

export interface BallDontLieClientOptions {
  /** Base URL for API requests. Defaults to https://bdlproxy.hicksrch.workers.dev/bdl */
  baseUrl?: string;
  /** Cache TTL used for top-level resource snapshots. Defaults to DEFAULT_TTL_MS */
  ttlMs?: number;
}

type QueryValue = string | number | boolean | undefined;

function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export class BallDontLieClient {
  readonly #baseUrl: string;
  readonly #ttlMs: number;

  constructor(options: BallDontLieClientOptions = {}) {
    this.#baseUrl = options.baseUrl ?? DEFAULT_API_BASE;
    this.#ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  get ttlMs(): number {
    return this.#ttlMs;
  }

  private buildUrl(pathname: string, params: URLSearchParams): string {
    const base = this.#baseUrl.replace(/\/+$/, "");
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const full = `${base}${normalizedPath}`;
    const url = new URL(full);
    url.search = params.toString();
    return url.toString();
  }

  async paginate<T>(
    basePath: string,
    params: Record<string, QueryValue>,
    pageSize = 100,
    pageLimit?: number,
    parser?: z.ZodType<T>,
  ): Promise<T[]> {
    const results: T[] = [];
    let cursor: string | number | undefined;
    let nextPage: number | undefined;
    let attempts = 0;

    while (true) {
      attempts += 1;
      if (pageLimit && attempts > pageLimit) {
        break;
      }

      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        search.append(key, String(value));
      }
      if (cursor !== undefined) {
        search.set("cursor", String(cursor));
      } else if (nextPage !== undefined) {
        search.set("page", String(nextPage));
      }
      if (!search.has("per_page")) {
        search.set("per_page", String(pageSize));
      }

      const url = this.buildUrl(basePath, search);
      const raw = await request<unknown>(url);
      const parsedPage = pageSchema.parse(raw);
      const dataArray = Array.isArray(parsedPage.data) ? parsedPage.data : [];
      const items = parser ? dataArray.map((entry) => parser.parse(entry)) : (dataArray as T[]);
      results.push(...items);

      const meta = parsedPage.meta ?? {};
      const nextCursor = meta.next_cursor;
      if (nextCursor !== undefined && nextCursor !== null && String(nextCursor).length > 0) {
        cursor = nextCursor;
        nextPage = undefined;
        continue;
      }

      const metaNextPage = meta.next_page;
      if (typeof metaNextPage === "number" && Number.isFinite(metaNextPage)) {
        cursor = undefined;
        nextPage = metaNextPage;
        continue;
      }

      const totalPages = typeof meta.total_pages === "number" && Number.isFinite(meta.total_pages) ? meta.total_pages : undefined;
      const currentPage =
        typeof meta.current_page === "number" && Number.isFinite(meta.current_page) ? meta.current_page : undefined;
      if (totalPages !== undefined && currentPage !== undefined && currentPage < totalPages) {
        cursor = undefined;
        nextPage = currentPage + 1;
        continue;
      }

      break;
    }

    return results;
  }

  async getTeams(): Promise<BdlTeam[]> {
    return withCache("teams", this.#ttlMs, async () => {
      const url = this.buildUrl("/v1/teams", new URLSearchParams());
      const raw = await request<unknown>(url);
      const parsed = pageSchema.parse(raw);
      return parsed.data.map((team) => teamSchema.parse(team));
    });
  }

  async getActivePlayersByTeam(teamId: number, season?: number): Promise<BdlPlayer[]> {
    const cacheKey = season !== undefined ? `players-active-${teamId}-${season}` : `players-active-${teamId}`;
    return withCache(cacheKey, this.#ttlMs, async () => {
      const params: Record<string, QueryValue> = { "team_ids[]": teamId };
      if (season !== undefined) {
        params["seasons[]"] = season;
      }

      const players = await this.paginate<BdlPlayer>(
        "/v1/players/active",
        params,
        100,
        undefined,
        playerSchema,
      );

      return players.filter((player) => player.team?.id === teamId);
    });
  }

  async getRosterMapByTeamIds(teamIds: number[], season?: number): Promise<Record<number, BdlPlayer[]>> {
    const entries = await Promise.all(
      teamIds.map(async (teamId) => {
        const roster = await this.getActivePlayersByTeam(teamId, season);
        return [teamId, roster] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  async getPreseasonSchedule(season: number): Promise<BdlGame[]> {
    return withCache(`games-preseason-${season}`, this.#ttlMs, async () => {
      const games = await this.paginate<BdlGame>(
        "/v1/games",
        { "seasons[]": season, season_type: "Pre Season" },
        100,
        undefined,
        gameSchema,
      );
      return games.filter((game) => {
        const type = game.season_type?.toLowerCase();
        return type === "pre season" || type === "preseason";
      });
    });
  }
}

export function createTeamMap(teams: BdlTeam[]): TeamMap {
  const byAbbr: Record<string, BdlTeam> = {};
  const byName: Record<string, BdlTeam> = {};
  for (const team of teams) {
    byAbbr[team.abbreviation.toUpperCase()] = team;
    byName[normalizeTeamName(team.full_name)] = team;
  }
  return { byAbbr, byName };
}

export function buildTeamMap(client: BallDontLieClient): Promise<TeamMap> {
  return client.getTeams().then((teams) => createTeamMap(teams));
}

export { normalizeTeamName };
