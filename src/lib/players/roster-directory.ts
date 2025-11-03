import { NCAAM, type Player, type Team, type Conference } from "../sdk/ncaam.js";
import {
  loadPlayerIndexDocument,
  loadPlayerStatsDocument,
  pickSeasonStats,
  type PlayerIndexDocument,
  type PlayerIndexEntry,
  type PlayerStatsSeason,
} from "./data.js";

export type PlayerStatsSnapshot = {
  gp: number | null;
  mp_g: number | null;
  pts_g: number | null;
  trb_g: number | null;
  ast_g: number | null;
  stl_g: number | null;
  blk_g: number | null;
  fg_pct: number | null;
  fg3_pct: number | null;
  ft_pct: number | null;
};

export type RosterPlayer = {
  id: string;
  name: string;
  team: string;
  position: string | null;
  jersey: string | null;
  height: string | null;
  weight: string | null;
  stats: PlayerStatsSnapshot | null;
};

export type TeamRoster = {
  id: number;
  name: string;
  fullName: string;
  abbreviation: string | null;
  conferenceId: number | null;
  conferenceName: string;
};

export type ConferenceGroup = {
  id: number | null;
  name: string;
  teams: TeamRoster[];
  totalPlayers: number | null;
};

export type RosterDirectory = {
  season: string;
  conferences: ConferenceGroup[];
  totals: {
    players: number | null;
    teams: number;
  };
};

const ACTIVE_ROSTER_SEASON = "2025-2026";

type MutableConferenceGroup = {
  id: number | null;
  name: string;
  teams: TeamRoster[];
  totalPlayers: number | null;
};

type PlayerIndexLookup = {
  byName: Map<string, PlayerIndexEntry[]>;
  byNameTeam: Map<string, PlayerIndexEntry[]>;
};

const teamRosterCache = new Map<number, Promise<RosterPlayer[]>>();
let playerIndexLookupPromise: Promise<PlayerIndexLookup> | null = null;

function parseSeasonEndYear(label: string): number | null {
  const match = label.match(/^(\d{4})-(\d{2}|\d{4})$/);
  if (!match) {
    return null;
  }
  const startYear = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(startYear)) {
    return null;
  }

  const endFragment = match[2] ?? "";
  if (endFragment.length === 2) {
    const suffix = Number.parseInt(endFragment, 10);
    if (!Number.isFinite(suffix)) {
      return null;
    }
    const baseCentury = Math.floor(startYear / 100) * 100;
    let endYear = baseCentury + suffix;
    if (endYear <= startYear) {
      endYear += 100;
    }
    return endYear;
  }

  const endYear = Number.parseInt(endFragment, 10);
  return Number.isFinite(endYear) ? endYear : null;
}

function parseSeasonStartYear(label: string): number | null {
  const match = label.match(/^(\d{4})/);
  if (!match) {
    return null;
  }
  const startYear = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(startYear) ? startYear : null;
}

function buildConferenceNameLookup(conferences: Conference[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const conference of conferences) {
    if (!conference || typeof conference.id !== "number") continue;
    const label = conference.short_name?.trim() || conference.name?.trim();
    if (label && label.length) {
      map.set(conference.id, label);
    }
  }
  return map;
}

function resolveConferenceName(
  conferenceId: number | null | undefined,
  conferenceMap: Map<number, string>,
): string {
  if (conferenceId == null) {
    return "Independents";
  }
  return conferenceMap.get(conferenceId) ?? `Conference ${conferenceId}`;
}

function ensureTeamMap(teams: Team[]): Map<number, Team> {
  const map = new Map<number, Team>();
  for (const team of teams) {
    if (!team || typeof team.id !== "number") continue;
    map.set(team.id, team);
  }
  return map;
}

function normaliseName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length ? trimmed : "Unknown";
}

function normaliseKey(value: string | null | undefined): string | null {
  const text = value?.normalize("NFD");
  if (!text) {
    return null;
  }
  const stripped = text.replace(/[\p{M}]+/gu, "");
  const collapsed = stripped.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (!collapsed) {
    return null;
  }
  return collapsed.toLowerCase();
}

function buildPlayerIndexLookup(document: PlayerIndexDocument): PlayerIndexLookup {
  const byName = new Map<string, PlayerIndexEntry[]>();
  const byNameTeam = new Map<string, PlayerIndexEntry[]>();
  const entries = document.players ?? [];

  for (const entry of entries) {
    const nameKey = normaliseKey(entry.name_key ?? entry.name);
    if (!nameKey) continue;
    if (!byName.has(nameKey)) {
      byName.set(nameKey, []);
    }
    byName.get(nameKey)!.push(entry);

    const teamKey = normaliseKey(entry.team_key ?? entry.team);
    if (teamKey) {
      const combinedKey = `${nameKey}::${teamKey}`;
      if (!byNameTeam.has(combinedKey)) {
        byNameTeam.set(combinedKey, []);
      }
      byNameTeam.get(combinedKey)!.push(entry);
    }
  }

  return { byName, byNameTeam } satisfies PlayerIndexLookup;
}

async function getPlayerIndexLookup(): Promise<PlayerIndexLookup> {
  if (!playerIndexLookupPromise) {
    playerIndexLookupPromise = loadPlayerIndexDocument()
      .then((document) => buildPlayerIndexLookup(document))
      .catch((error) => {
        playerIndexLookupPromise = null;
        throw error;
      });
  }
  return await playerIndexLookupPromise;
}

function buildTeamKeyCandidates(team: TeamRoster, playerTeam: Player["team"] | undefined): string[] {
  const keys = new Set<string>();
  const candidates = [
    team.fullName,
    team.name,
    team.abbreviation,
    playerTeam?.full_name,
    playerTeam?.name,
    playerTeam?.abbreviation,
  ];
  for (const candidate of candidates) {
    const key = normaliseKey(candidate);
    if (key) {
      keys.add(key);
    }
  }
  return [...keys];
}

function extractSeasonYear(entry: PlayerIndexEntry): number | null {
  if (typeof entry.season_year === "number" && Number.isFinite(entry.season_year)) {
    return entry.season_year;
  }
  return parseSeasonEndYear(entry.season ?? "");
}

function pickPlayerIndexEntry(
  lookup: PlayerIndexLookup,
  nameKey: string,
  teamKeys: string[],
  seasonEndYear: number | null,
): PlayerIndexEntry | null {
  const candidates: PlayerIndexEntry[] = [];
  const seen = new Set<PlayerIndexEntry>();

  for (const teamKey of teamKeys) {
    const teamEntries = lookup.byNameTeam.get(`${nameKey}::${teamKey}`) ?? [];
    for (const entry of teamEntries) {
      if (seen.has(entry)) continue;
      seen.add(entry);
      candidates.push(entry);
    }
  }

  const nameEntries = lookup.byName.get(nameKey) ?? [];
  for (const entry of nameEntries) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    candidates.push(entry);
  }

  if (!candidates.length) {
    return null;
  }

  let filtered = candidates;

  if (seasonEndYear !== null) {
    const seasonMatches = candidates.filter((entry) => extractSeasonYear(entry) === seasonEndYear);
    if (seasonMatches.length) {
      filtered = seasonMatches;
    }
  }

  if (teamKeys.length) {
    const teamMatches = filtered.filter((entry) => {
      const entryKey = normaliseKey(entry.team_key ?? entry.team);
      return entryKey ? teamKeys.includes(entryKey) : false;
    });
    if (teamMatches.length) {
      filtered = teamMatches;
    }
  }

  filtered.sort((a, b) => (extractSeasonYear(b) ?? 0) - (extractSeasonYear(a) ?? 0));
  return filtered[0] ?? null;
}

function toPlayerStatsSnapshot(season: PlayerStatsSeason | null): PlayerStatsSnapshot | null {
  if (!season) {
    return null;
  }
  return {
    gp: season.gp ?? null,
    mp_g: season.mp_g ?? null,
    pts_g: season.pts_g ?? null,
    trb_g: season.trb_g ?? null,
    ast_g: season.ast_g ?? null,
    stl_g: season.stl_g ?? null,
    blk_g: season.blk_g ?? null,
    fg_pct: season.fg_pct ?? null,
    fg3_pct: season.fg3_pct ?? null,
    ft_pct: season.ft_pct ?? null,
  } satisfies PlayerStatsSnapshot;
}

async function resolvePlayerStats(
  player: Player,
  team: TeamRoster,
  seasonLabel: string,
  seasonEndYear: number | null,
): Promise<PlayerStatsSnapshot | null> {
  const nameKey = normaliseKey(`${player.first_name ?? ""} ${player.last_name ?? ""}`);
  if (!nameKey) {
    return null;
  }

  try {
    const lookup = await getPlayerIndexLookup();
    const teamKeys = buildTeamKeyCandidates(team, player.team);
    const entry = pickPlayerIndexEntry(lookup, nameKey, teamKeys, seasonEndYear);
    if (!entry) {
      return null;
    }
    const document = await loadPlayerStatsDocument(entry.slug);
    const seasonStats = pickSeasonStats(document, seasonLabel);
    return toPlayerStatsSnapshot(seasonStats);
  } catch (error) {
    console.error(`Unable to load stats for ${player.first_name} ${player.last_name}`, error);
    return null;
  }
}

function buildRosterPlayer(teamName: string, player: Player, stats: PlayerStatsSnapshot | null): RosterPlayer {
  const first = player.first_name?.trim() ?? "";
  const last = player.last_name?.trim() ?? "";
  const name = `${first} ${last}`.trim() || first || last || "Unknown";
  return {
    id: `bdl-${player.id}`,
    name,
    team: teamName,
    position: player.position?.trim() ?? null,
    jersey: player.jersey_number?.trim() ?? null,
    height: player.height?.trim() ?? null,
    weight: player.weight?.trim() ?? null,
    stats,
  } satisfies RosterPlayer;
}

async function fetchTeamRosterPlayers(team: TeamRoster, seasonLabel: string): Promise<RosterPlayer[]> {
  const seasonStartYear = parseSeasonStartYear(seasonLabel);
  const seasonEndYear = parseSeasonEndYear(seasonLabel);
  const seasonParam = seasonStartYear ?? seasonEndYear ?? undefined;

  const response = await NCAAM.activePlayersByTeam(team.id, seasonParam);
  const players = Array.isArray(response.data) ? response.data : [];

  const roster = await Promise.all(
    players.map(async (player) => {
      const stats = await resolvePlayerStats(player, team, seasonLabel, seasonEndYear);
      return buildRosterPlayer(team.fullName, player, stats);
    }),
  );

  roster.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return roster;
}

export async function loadRosterDirectory(): Promise<RosterDirectory> {
  const [{ data: teams = [] }, { data: conferences = [] }] = await Promise.all([
    NCAAM.teams(1, 400),
    NCAAM.conferences(),
  ]);

  const conferenceMap = buildConferenceNameLookup(conferences ?? []);
  const teamMap = ensureTeamMap(teams ?? []);
  const groups = new Map<string, MutableConferenceGroup>();

  for (const teamRecord of teamMap.values()) {
    const conferenceId = teamRecord.conference_id ?? null;
    const conferenceName = resolveConferenceName(conferenceId, conferenceMap);
    const groupKey = `${conferenceId ?? "independent"}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        id: conferenceId,
        name: conferenceName,
        teams: [],
        totalPlayers: null,
      });
    }

    const fullName = normaliseName(teamRecord.full_name ?? teamRecord.name);
    const shortName = normaliseName(teamRecord.name ?? teamRecord.full_name ?? fullName);
    const abbreviation = teamRecord.abbreviation?.trim() ?? null;

    const teamRoster: TeamRoster = {
      id: teamRecord.id,
      name: shortName,
      fullName,
      abbreviation,
      conferenceId,
      conferenceName,
    };

    groups.get(groupKey)!.teams.push(teamRoster);
  }

  const orderedGroups = [...groups.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  orderedGroups.forEach((group) => {
    group.teams.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));
  });

  const totalTeams = orderedGroups.reduce((sum, group) => sum + group.teams.length, 0);

  return {
    season: ACTIVE_ROSTER_SEASON,
    conferences: orderedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      totalPlayers: group.totalPlayers,
      teams: group.teams.map((team) => ({
        id: team.id,
        name: team.name,
        fullName: team.fullName,
        abbreviation: team.abbreviation,
        conferenceId: team.conferenceId,
        conferenceName: team.conferenceName,
      })),
    })),
    totals: {
      players: null,
      teams: totalTeams,
    },
  } satisfies RosterDirectory;
}

export async function loadTeamRosterPlayers(team: TeamRoster, seasonLabel = ACTIVE_ROSTER_SEASON): Promise<RosterPlayer[]> {
  if (!teamRosterCache.has(team.id)) {
    const load = fetchTeamRosterPlayers(team, seasonLabel).catch((error) => {
      teamRosterCache.delete(team.id);
      throw error;
    });
    teamRosterCache.set(team.id, load);
  }
  return await teamRosterCache.get(team.id)!;
}
