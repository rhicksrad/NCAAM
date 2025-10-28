import { getTeams } from "./bdl.js";
import type { BdlTeam } from "./bdl.js";
import { request } from "./http.js";
import { SEASON } from "../lib/season.js";
import { TEAM_METADATA } from "../lib/teams.js";
import type { LeagueDataSource, SourcePlayerRecord, SourceTeamRecord } from "../lib/types.js";

export interface BallDontLieRosters extends LeagueDataSource {
  teamAbbrs: string[];
}

export const MAX_TEAM_ACTIVE = 30;

const API_BASE = "https://bdlproxy.hicksrch.workers.dev/bdl";
const PER_PAGE = 100;
const MAX_RETRIES = 2;

type BdlApiPlayer = {
  id: number;
  first_name: string;
  last_name: string;
  position: string | null;
  team?: { id: number; abbreviation: string; full_name: string } | null;
};

function resolveSeasonStartYear(season: string): number {
  const [start] = season.split("-");
  const parsed = Number.parseInt(start, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid season string: ${season}`);
  }
  return parsed;
}

function toSourcePlayer(player: BdlApiPlayer, teamId: string, tricode: string): SourcePlayerRecord {
  const fullName = `${player.first_name} ${player.last_name}`.trim();
  return {
    playerId: String(player.id),
    name: fullName,
    position: player.position ?? undefined,
    teamId,
    teamTricode: tricode,
  };
}

async function http<T>(path: string, qs: Record<string, string | number | undefined>): Promise<T> {
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(`${API_BASE}/v1/${normalizedPath}`);
  Object.entries(qs).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });

  return request<T>(url.toString());
}

async function fetchTeamPlayers(teamId: number, season: number): Promise<BdlApiPlayer[]> {
  let cursor: number | string | undefined;
  const playersById = new Map<number, BdlApiPlayer>();

  while (true) {
    const result: { data: BdlApiPlayer[]; meta?: { next_cursor?: number | null } } = await http(
      "players",
      {
        "team_ids[]": teamId,
        per_page: PER_PAGE,
        active: "true",
        "seasons[]": season,
        cursor,
      },
    );

    for (const player of result.data) {
      if (player.team?.id === teamId) {
        playersById.set(player.id, player);
      }
    }

    const nextCursor = result.meta?.next_cursor ?? null;
    if (!nextCursor) {
      break;
    }
    cursor = nextCursor;
  }

  return Array.from(playersById.values());
}

export async function fetchBallDontLieRosters(
  targetSeason: number = resolveSeasonStartYear(SEASON),
): Promise<BallDontLieRosters> {
  const bdlTeams = await getTeams();
  if (!bdlTeams.length) {
    throw new Error("Ball Don't Lie returned no teams");
  }

  const bdlByAbbr = new Map<string, BdlTeam>(
    bdlTeams.map((team) => [team.abbreviation.toUpperCase(), team]),
  );

  const teams: Record<string, SourceTeamRecord> = {};
  const players: Record<string, SourcePlayerRecord> = {};
  const teamAbbrs: string[] = [];
  let totalPlayers = 0;

  for (const teamMeta of TEAM_METADATA) {
    const abbr = teamMeta.tricode.toUpperCase();
    const bdlTeam = bdlByAbbr.get(abbr);
    if (!bdlTeam) {
      throw new Error(`Cannot map NBA ${teamMeta.teamId} (${abbr}) to Ball Don't Lie team`);
    }

    const nbaId = Number.parseInt(teamMeta.teamId, 10);
    const attemptSeasons = Array.from(new Set([targetSeason, targetSeason - 1]))
      .slice(0, MAX_RETRIES)
      .filter((season) => Number.isFinite(season));

    let rosterPlayers: BdlApiPlayer[] = [];

    for (const season of attemptSeasons) {
      try {
        const fetched = await fetchTeamPlayers(bdlTeam.id, season);
        if (fetched.length > 0) {
          rosterPlayers = fetched;
          if (season !== targetSeason) {
            console.warn(
              `BDL fallback: used season ${season} for ${teamMeta.tricode} (NBA ${nbaId}, BDL ${bdlTeam.id})`,
            );
          }
          break;
        }
      } catch (error) {
        if (season === attemptSeasons[attemptSeasons.length - 1]) {
          throw error;
        }
      }
    }

    if (rosterPlayers.length === 0) {
      console.warn(
        `BDL WARNING — 0 players for ${teamMeta.tricode} (NBA ${nbaId}) mapped to BDL ${bdlTeam.id} in seasons ${attemptSeasons.join(
          " or ",
        )}`,
      );
      continue;
    }

    if (rosterPlayers.length > MAX_TEAM_ACTIVE) {
      console.warn(
        `Team ${teamMeta.tricode} mapped to BDL ${bdlTeam.id} returned ${rosterPlayers.length} players; trimming to ${MAX_TEAM_ACTIVE}.`,
      );
    }

    const roster = rosterPlayers
      .slice(0, MAX_TEAM_ACTIVE)
      .map((player) => toSourcePlayer(player, teamMeta.teamId, teamMeta.tricode));

    totalPlayers += roster.length;

    teams[teamMeta.tricode] = {
      teamId: teamMeta.teamId,
      tricode: teamMeta.tricode,
      market: teamMeta.market,
      name: teamMeta.name,
      roster,
      lastSeasonWins: teamMeta.lastSeasonWins,
      lastSeasonSRS: teamMeta.lastSeasonSRS,
    };

    for (const player of roster) {
      const key = player.playerId ?? player.name;
      players[key] = player;
    }

    teamAbbrs.push(teamMeta.tricode);
  }

  if (totalPlayers < 360) {
    console.warn(
      `Ball Don't Lie returned ${totalPlayers} total players; downstream data may be incomplete until rosters populate.`,
    );
  }

  return {
    teamAbbrs: teamAbbrs.sort(),
    teams,
    players,
    transactions: [],
    coaches: {},
    injuries: [],
  };
}
