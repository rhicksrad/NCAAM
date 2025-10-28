import { load } from "cheerio";
import { brefTeam, fetchBref } from "./bref.js";
import { ensureTeamMetadata } from "../lib/teams.js";
import type {
  CoachRecord,
  LeagueDataSource,
  SourcePlayerRecord,
  SourceTeamRecord,
} from "../lib/types.js";

const BBR_BASE = "https://www.basketball-reference.com";

function parseRosterFromHtml(html: string, teamId: string, tricode: string) {
  const $ = load(html);
  const roster: SourcePlayerRecord[] = [];

  $("table#roster tbody tr").each((_, element) => {
    const name = $(element).find("th[data-stat='player'] a").text().trim();
    if (!name) {
      return;
    }
    const pos = $(element).find("td[data-stat='pos']").text().trim();
    const player: SourcePlayerRecord = {
      name,
      position: pos || undefined,
      teamId,
      teamTricode: tricode,
    };
    roster.push(player);
  });

  const coachText = $(
    "table#coach-staff tbody tr:first-child td[data-stat='coach_name']"
  )
    .text()
    .trim();

  const coach: CoachRecord | undefined = coachText ? { name: coachText } : undefined;

  return { roster, coach };
}

export async function fetchBbrRosterForTeam(teamAbbr: string, seasonEndYear: number) {
  const meta = ensureTeamMetadata(teamAbbr);
  const code = brefTeam(teamAbbr);
  const url = `${BBR_BASE}/teams/${code}/${seasonEndYear}.html`;
  const html = await fetchBref(url);
  const { roster, coach } = parseRosterFromHtml(html, meta.teamId, meta.tricode);
  return { team: teamAbbr, players: roster, coach };
}

export interface BbrRosterResult {
  rosters: LeagueDataSource;
  missing: string[];
}

export async function fetchBbrRosters(
  teamAbbrs: string[],
  seasonEndYear: number
): Promise<BbrRosterResult> {
  const teams: Record<string, Partial<SourceTeamRecord>> = {};
  const players: Record<string, SourcePlayerRecord> = {};
  const coaches: Record<string, CoachRecord> = {};
  const missing: string[] = [];
  let totalPlayers = 0;

  for (const abbr of teamAbbrs) {
    const meta = ensureTeamMetadata(abbr);
    try {
      const { players: roster, coach } = await fetchBbrRosterForTeam(abbr, seasonEndYear);
      teams[abbr] = {
        teamId: meta.teamId,
        tricode: meta.tricode,
        market: meta.market,
        name: meta.name,
        roster,
        coach,
        lastSeasonWins: meta.lastSeasonWins,
        lastSeasonSRS: meta.lastSeasonSRS,
      };
      if (coach) {
        coaches[abbr] = coach;
      }
      for (const player of roster) {
        const key = player.playerId ?? player.name;
        players[key] = player;
      }
      totalPlayers += roster.length;
      if (roster.length === 0) {
        console.warn(`BRef: 0 parsed players for ${abbr}; marking missing and continuing.`);
        missing.push(abbr);
      }
    } catch (error) {
      missing.push(abbr);
      teams[abbr] = {
        teamId: meta.teamId,
        tricode: meta.tricode,
        market: meta.market,
        name: meta.name,
        roster: [],
        lastSeasonWins: meta.lastSeasonWins,
        lastSeasonSRS: meta.lastSeasonSRS,
      };
      console.warn(`BRef fetch failed for ${abbr}: ${String(error)}`);
    }
  }

  if (totalPlayers === 0) {
    console.warn(
      "BRef: parsed 0 players across all teams; treating as enrichment-only and continuing."
    );
  }

  return {
    rosters: {
      teams,
      players,
      transactions: [],
      coaches,
      injuries: [],
    },
    missing,
  };
}
