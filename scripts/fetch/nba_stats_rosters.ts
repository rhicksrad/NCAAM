import { TEAM_METADATA } from "../lib/teams.js";
import {
  CoachRecord,
  InjuryRecord,
  LeagueDataSource,
  SourcePlayerRecord,
  SourceTeamRecord,
  TransactionRecord,
} from "../lib/types.js";
import { loadCanonicalLeagueSource } from "./canonical_cache.js";

const NBA_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.nba.com/",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

interface NbaStatsResultSet {
  name: string;
  rowSet: Array<Array<string | number>>;
  headers: string[];
}

export async function fetchNbaStatsRosters(season: string): Promise<LeagueDataSource> {
  const canonicalFallback = await loadCanonicalLeagueSource();

  const teams: Record<string, Partial<SourceTeamRecord>> = {};
  const players: Record<string, SourcePlayerRecord> = {};
  const coaches: Record<string, CoachRecord> = canonicalFallback
    ? Object.fromEntries(
        Object.entries(canonicalFallback.coaches).map(([team, record]) => [
          team,
          { ...record },
        ])
      )
    : {};
  const transactions: TransactionRecord[] = canonicalFallback
    ? canonicalFallback.transactions.map((transaction) => ({ ...transaction }))
    : [];
  const injuries: InjuryRecord[] = canonicalFallback
    ? canonicalFallback.injuries.map((injury) => ({ ...injury }))
    : [];

  for (const meta of TEAM_METADATA) {
    const teamKey = meta.tricode;
    try {
      const url =
        `https://stats.nba.com/stats/commonteamroster?LeagueID=00&Season=${encodeURIComponent(
          season
        )}&TeamID=${meta.teamId}`;
      const response = await fetch(url, {
        headers: NBA_HEADERS,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
      }
      const json = (await response.json()) as { resultSets?: NbaStatsResultSet[] };
      if (!json.resultSets) {
        throw new Error("Missing resultSets in response");
      }
      const rosterSet = json.resultSets.find((set) => set.name === "CommonTeamRoster");
      const coachSet = json.resultSets.find((set) => set.name === "Coaches");
      const roster: SourcePlayerRecord[] = [];

      if (rosterSet) {
        const nameIndex = rosterSet.headers.indexOf("PLAYER");
        const pidIndex = rosterSet.headers.indexOf("PLAYER_ID");
        const posIndex = rosterSet.headers.indexOf("POSITION");
        for (const row of rosterSet.rowSet) {
          const name = typeof row[nameIndex] === "string" ? (row[nameIndex] as string).trim() : "";
          if (!name) continue;
          const playerId = pidIndex >= 0 ? String(row[pidIndex]) : undefined;
          const position = posIndex >= 0 ? (row[posIndex] as string | undefined) : undefined;
          const record: SourcePlayerRecord = {
            playerId,
            name,
            position: position?.trim() || undefined,
            teamId: meta.teamId,
            teamTricode: meta.tricode,
          };
          roster.push(record);
          if (playerId) {
            players[playerId] = record;
          } else {
            players[name] = record;
          }
        }
      }

      let coach: CoachRecord | undefined;
      if (coachSet && coachSet.rowSet.length > 0) {
        const row = coachSet.rowSet[0];
        const nameIndex = coachSet.headers.indexOf("COACH_NAME");
        const roleIndex = coachSet.headers.indexOf("COACH_TYPE");
        const coachName =
          nameIndex >= 0 && typeof row[nameIndex] === "string" ? (row[nameIndex] as string).trim() : undefined;
        if (coachName) {
          coach = {
            name: coachName,
            role: roleIndex >= 0 ? ((row[roleIndex] as string | undefined)?.trim() || undefined) : undefined,
          };
          coaches[teamKey] = coach;
        }
      }

      teams[teamKey] = {
        teamId: meta.teamId,
        tricode: meta.tricode,
        market: meta.market,
        name: meta.name,
        roster,
        coach,
        lastSeasonWins: meta.lastSeasonWins,
        lastSeasonSRS: meta.lastSeasonSRS,
      };
    } catch (error) {
      console.warn(`Failed to fetch NBA Stats roster for ${teamKey}: ${(error as Error).message}`);
      const fallbackTeam = canonicalFallback?.teams[teamKey];
      if (fallbackTeam) {
        const roster = (fallbackTeam.roster ?? []).map((player) => ({ ...player }));
        const fallbackCoach = coaches[teamKey] ?? (fallbackTeam.coach ? { ...fallbackTeam.coach } : undefined);
        if (fallbackCoach) {
          coaches[teamKey] = { ...fallbackCoach };
        }
        teams[teamKey] = {
          teamId: fallbackTeam.teamId ?? meta.teamId,
          tricode: fallbackTeam.tricode ?? meta.tricode,
          market: fallbackTeam.market ?? meta.market,
          name: fallbackTeam.name ?? meta.name,
          roster,
          coach: fallbackCoach ? { ...fallbackCoach } : undefined,
          lastSeasonWins: fallbackTeam.lastSeasonWins ?? meta.lastSeasonWins,
          lastSeasonSRS: fallbackTeam.lastSeasonSRS ?? meta.lastSeasonSRS,
        };
        for (const player of roster) {
          const key = player.playerId ?? player.name;
          players[key] = { ...player };
        }
      } else {
        teams[teamKey] = {
          teamId: meta.teamId,
          tricode: meta.tricode,
          market: meta.market,
          name: meta.name,
          roster: [],
          lastSeasonWins: meta.lastSeasonWins,
          lastSeasonSRS: meta.lastSeasonSRS,
        };
      }
    }
  }

  return { teams, players, transactions, coaches, injuries };
}
