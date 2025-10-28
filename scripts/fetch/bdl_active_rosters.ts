import type { BdlPlayer } from "./ball_dont_lie_client.js";
import { TEAM_METADATA } from "../lib/teams.js";
import { mapBdlTeamToTricode } from "./bdl_team_mappings.js";
import { formatBdlAuthHeader, requireBallDontLieKey } from "./http.js";

const DEFAULT_PROXY_BASE = "https://bdlproxy.hicksrch.workers.dev/bdl/";
const RAW_BASE = process.env.BDL_PROXY_BASE?.trim() || DEFAULT_PROXY_BASE;
const API_BASE = RAW_BASE.endsWith("/") ? RAW_BASE : `${RAW_BASE}/`;
const ACTIVE_PATH = "v1/players/active";
const MAX_PER_PAGE = 100;
const FLAG_KEYS = ["active", "is_active", "on_team", "on_roster"] as const;

const BDL_UPSTREAM_HOST_PATTERN = /\bballdontlie\.io$/i;

function parsePerPage(): number {
  const fromEnv = Number(process.env.BDL_ACTIVE_PER_PAGE);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.min(Math.max(Math.floor(fromEnv), 1), MAX_PER_PAGE);
  }
  return MAX_PER_PAGE;
}

function normalizeCursor(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text.length ? text : null;
}

function isTrulyActiveRecord(player: Record<string, unknown>): boolean {
  const flags = FLAG_KEYS.map((key) => player[key]).filter((value): value is boolean => typeof value === "boolean");
  if (flags.length === 0) {
    return true;
  }
  return flags.every(Boolean);
}

function comparePlayers(a: ActiveRosterPlayer, b: ActiveRosterPlayer): number {
  const last = a.last_name.localeCompare(b.last_name, "en", { sensitivity: "base" });
  if (last !== 0) {
    return last;
  }
  const first = a.first_name.localeCompare(b.first_name, "en", { sensitivity: "base" });
  if (first !== 0) {
    return first;
  }
  return a.id - b.id;
}

function sortRoster(players: ActiveRosterPlayer[]): ActiveRosterPlayer[] {
  return players.sort(comparePlayers);
}

export const REGULAR_SEASON_MIN = 13;
export const REGULAR_SEASON_MAX = 21;
export const PRESEASON_DEFAULT_MAX = 25;

export interface ActiveRosterFetchMeta {
  totalPlayers: number;
  pages: number;
  perPage: number;
  usedNextCursor: boolean;
  maxPageSize: number;
}

let lastFetchMeta: ActiveRosterFetchMeta | null = null;

export type ActiveRosterPlayer = BdlPlayer & { team_bdl_id: number; team_abbr: string };
export type ActiveRosters = Record<string, ActiveRosterPlayer[]>;

export function getLastActiveRosterFetchMeta(): ActiveRosterFetchMeta | null {
  return lastFetchMeta;
}

export async function fetchActiveRosters(): Promise<ActiveRosters> {
  const perPage = parsePerPage();
  console.log(
    `BDL fetch: GET ${API_BASE}${ACTIVE_PATH} with per_page=${perPage} (max ${MAX_PER_PAGE})`,
  );

  const playerAssignments = new Map<number, string>();
  const seenPlayers = new Set<number>();
  const grouped = new Map<string, ActiveRosterPlayer[]>();

  let cursor: string | null = null;
  let pageIndex = 0;
  let totalPlayers = 0;
  let usedNextCursor = false;
  let maxPageSize = 0;

  while (true) {
    const url = new URL(ACTIVE_PATH, API_BASE);
    url.searchParams.set("per_page", String(perPage));
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (BDL_UPSTREAM_HOST_PATTERN.test(url.hostname)) {
      headers.Authorization = formatBdlAuthHeader(requireBallDontLieKey());
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${url.toString()}`);
    }

    const raw = (await response.json()) as Record<string, unknown>;
    const data = Array.isArray(raw.data) ? raw.data : [];
    const meta = (raw.meta ?? {}) as Record<string, unknown>;

    pageIndex += 1;
    const pagePlayers: ActiveRosterPlayer[] = [];

    for (const entry of data) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const record = entry as Record<string, unknown>;
      if (!isTrulyActiveRecord(record)) {
        continue;
      }

      const id = record.id;
      if (typeof id !== "number" || !Number.isFinite(id)) {
        console.warn("Skipping player with invalid id from Ball Don't Lie active feed.");
        continue;
      }

      const team = record.team as Record<string, unknown> | null | undefined;
      if (!team || typeof team !== "object") {
        console.warn(`Skipping player ${id} with missing team assignment.`);
        continue;
      }

      const teamId = typeof team.id === "number" ? team.id : undefined;
      if (teamId === undefined) {
        console.warn(`Skipping player ${id} with missing Ball Don't Lie team id.`);
        continue;
      }

      const tricode = mapBdlTeamToTricode({ id: teamId, abbreviation: team.abbreviation });

      const previousTeam = playerAssignments.get(id);
      if (previousTeam && previousTeam !== tricode) {
        throw new Error(
          `Player ${id} (${String(record.first_name ?? "")} ${String(
            record.last_name ?? "",
          )}) appears on multiple teams (${previousTeam}, ${tricode}).`,
        );
      }

      if (seenPlayers.has(id)) {
        continue;
      }

      const player = record as BdlPlayer;
      const enriched: ActiveRosterPlayer = {
        ...player,
        team_bdl_id: teamId,
        team_abbr: tricode,
      };

      playerAssignments.set(id, tricode);
      seenPlayers.add(id);

      const bucket = grouped.get(tricode);
      if (bucket) {
        bucket.push(enriched);
      } else {
        grouped.set(tricode, [enriched]);
      }

      pagePlayers.push(enriched);
    }

    totalPlayers += pagePlayers.length;
    maxPageSize = Math.max(maxPageSize, pagePlayers.length);

    const nextCursor = normalizeCursor(meta.next_cursor);
    usedNextCursor = usedNextCursor || Boolean(nextCursor);

    console.log(
      `BDL fetch: page ${pageIndex} returned ${pagePlayers.length} players (next_cursor=${nextCursor ?? "null"})`,
    );

    if (!nextCursor) {
      break;
    }

    cursor = nextCursor;
  }

  const rosters: ActiveRosters = {};
  for (const team of TEAM_METADATA) {
    const tricode = team.tricode.toUpperCase();
    const players = grouped.get(tricode) ?? [];
    rosters[tricode] = sortRoster(players);
  }

  const teamSummaries = Object.entries(rosters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([team, players]) => `${team}:${players.length}`)
    .join(", ");

  console.log(
    `BDL fetch complete: ${totalPlayers} players grouped across ${Object.keys(rosters).length} teams. [${teamSummaries}]`,
  );

  lastFetchMeta = {
    totalPlayers,
    pages: pageIndex,
    perPage,
    usedNextCursor,
    maxPageSize,
  };

  return rosters;
}
