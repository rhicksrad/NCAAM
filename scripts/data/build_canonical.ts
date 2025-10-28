import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { parse as parseYaml } from "yaml";
import { fetchActiveRosters } from "../fetch/bdl_active_rosters.js";
import { TEAM_METADATA, ensureTeamMetadata } from "../lib/teams.js";
import {
  CanonicalData,
  CoachOverride,
  CoachRecord,
  CoachRecordEntry,
  InjuryOverride,
  InjuryRecord,
  LeagueDataSource,
  OverridesConfig,
  PlayerOverride,
  PlayerRecord,
  SourcePlayerRecord,
  SourceTeamRecord,
  TeamOverride,
  TeamRecord,
  TransactionRecord,
} from "../lib/types.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const CANONICAL_DIR = path.join(ROOT, "data/2025-26/canonical");
const OVERRIDES_PATH = path.join(ROOT, "data/2025-26/manual/overrides.yaml");
export interface BuildOptions {
  activeRosters?: Record<string, SourcePlayerRecord[]>;
  overrides?: OverridesConfig;
}

interface InternalPlayer extends PlayerRecord {
  key: string;
}

interface ChangeLog {
  additions: Set<string>;
  losses: Set<string>;
}

export async function buildCanonicalData(options: Partial<BuildOptions> = {}): Promise<CanonicalData> {
  const overrides = options.overrides ?? (await loadOverrides());
  const active = options.activeRosters ?? (await fetchActiveRosters());

  const primary = createEmptyLeagueSource();

  for (const metadata of TEAM_METADATA) {
    const roster = active[metadata.tricode];
    if (!Array.isArray(roster) || roster.length === 0) {
      throw new Error(`Missing active roster for ${metadata.tricode}`);
    }

    const normalizedRoster = roster.map((player) => {
      const fullName = player.name?.trim() || `${player.first_name ?? ""} ${player.last_name ?? ""}`.trim();
      const playerId = player.playerId ?? (player.id !== undefined ? String(player.id) : undefined);
      const record: SourcePlayerRecord = {
        ...player,
        name: fullName,
        playerId,
        teamId: metadata.teamId,
        teamTricode: metadata.tricode,
        team_abbr: metadata.tricode,
        team_bdl_id: player.team_bdl_id ?? player.id,
      };
      return record;
    });

    primary.teams[metadata.tricode] = {
      teamId: metadata.teamId,
      tricode: metadata.tricode,
      market: metadata.market,
      name: metadata.name,
      roster: normalizedRoster,
      lastSeasonWins: metadata.lastSeasonWins,
      lastSeasonSRS: metadata.lastSeasonSRS,
    };

    for (const player of normalizedRoster) {
      const key = player.playerId ?? player.name;
      if (key) {
        primary.players[key] = player;
      }
    }
  }

  const merged = mergeSources({
    primary,
    overrides,
  });

  return merged;
}

interface MergeOptions {
  primary: LeagueDataSource;
  overrides: OverridesConfig;
}

function createEmptyLeagueSource(): LeagueDataSource {
  return { teams: {}, players: {}, transactions: [], coaches: {}, injuries: [] };
}

function createEmptyTeamRecord(tricode: string): TeamRecord {
  const metadata = ensureTeamMetadata(tricode);
  return {
    teamId: metadata.teamId,
    tricode,
    market: metadata.market,
    name: metadata.name,
    roster: [],
    keyAdditions: [],
    keyLosses: [],
    notes: [],
    lastSeasonWins: metadata.lastSeasonWins,
    lastSeasonSRS: metadata.lastSeasonSRS,
  };
}

function playerKey(player: SourcePlayerRecord | PlayerRecord): string {
  if (player.playerId) {
    return player.playerId;
  }
  return player.name;
}

function normalizeName(name: string): { firstName?: string; lastName?: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) {
    return {};
  }
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function ensureOverridesConfig(raw: unknown): OverridesConfig {
  const overrides: OverridesConfig = {
    teams: {},
    players: {},
    injuries: [],
    coaches: [],
  };
  if (!raw || typeof raw !== "object") {
    return overrides;
  }
  const data = raw as Record<string, unknown>;
  const inner = (data["overrides"] ?? data) as Record<string, unknown>;
  overrides.teams = normalizeTeamOverrides(inner["teams"]);
  overrides.players = normalizePlayerOverrides(inner["players"]);
  overrides.injuries = normalizeInjuryOverrides(inner["injuries"]);
  overrides.coaches = normalizeCoachOverrides(inner["coaches"]);
  return overrides;
}

function normalizeTeamOverrides(raw: unknown): Record<string, TeamOverride> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const output: Record<string, TeamOverride> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") {
      output[key] = {};
      continue;
    }
    const source = value as Record<string, unknown>;
    const rosterAdd = Array.isArray(source["roster_add"]) ? source["roster_add"] : [];
    const rosterDrop = Array.isArray(source["roster_drop"]) ? (source["roster_drop"] as string[]) : [];
    const notes = Array.isArray(source["notes"]) ? (source["notes"] as string[]) : [];
    const coach = source["coach"] && typeof source["coach"] === "object" ? (source["coach"] as CoachOverride) : undefined;
    output[key] = {
      roster_add: rosterAdd as Array<string | PlayerOverride>,
      roster_drop: rosterDrop,
      notes,
      coach,
    };
  }
  return output;
}

function normalizePlayerOverrides(raw: unknown): Record<string, PlayerOverride> {
  if (!raw || typeof raw !== "object") {
    return {};
  }
  const output: Record<string, PlayerOverride> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const playerOverride: PlayerOverride = { ...((value as Record<string, unknown>) as PlayerOverride) };
    if (!playerOverride.name) {
      playerOverride.name = key;
    }
    output[key] = playerOverride;
  }
  return output;
}

function normalizeInjuryOverrides(raw: unknown): InjuryOverride[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is InjuryOverride => !!entry && typeof entry === "object") as InjuryOverride[];
}

function normalizeCoachOverrides(raw: unknown): CoachOverride[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is CoachOverride => !!entry && typeof entry === "object") as CoachOverride[];
}

async function loadOverrides(): Promise<OverridesConfig> {
  try {
    const contents = await readFile(OVERRIDES_PATH, "utf8");
    const parsed = parseYaml(contents);
    return ensureOverridesConfig(parsed);
  } catch (error) {
    console.warn(`Failed to load overrides: ${(error as Error).message}`);
    return ensureOverridesConfig({});
  }
}

function addPlayerToTeam(
  team: TeamRecord,
  player: InternalPlayer,
  changeLog: Map<string, ChangeLog>,
  markAddition: boolean
) {
  const exists = team.roster.some((existing) => {
    if (existing.playerId && player.playerId) {
      return existing.playerId === player.playerId;
    }
    return existing.name === player.name;
  });
  if (!exists) {
    team.roster.push(player);
    if (markAddition) {
      getChangeLog(changeLog, team.tricode).additions.add(player.name);
      player.isNewAddition = true;
    }
  }
  player.teamTricode = team.tricode;
  player.teamId = team.teamId;
}

function removePlayerFromTeam(team: TeamRecord, player: InternalPlayer, changeLog: Map<string, ChangeLog>) {
  const index = team.roster.findIndex((existing) => {
    if (existing.playerId && player.playerId) {
      return existing.playerId === player.playerId;
    }
    return existing.name === player.name;
  });
  if (index >= 0) {
    team.roster.splice(index, 1);
    getChangeLog(changeLog, team.tricode).losses.add(player.name);
  }
}

function getChangeLog(changeLog: Map<string, ChangeLog>, tricode: string): ChangeLog {
  if (!changeLog.has(tricode)) {
    changeLog.set(tricode, { additions: new Set(), losses: new Set() });
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return changeLog.get(tricode)!;
}

function mergeSources(options: MergeOptions): CanonicalData {
  const { primary, overrides } = options;
  const teamMap = new Map<string, TeamRecord>();
  const playerMap = new Map<string, InternalPlayer>();
  const changeLog = new Map<string, ChangeLog>();

  for (const meta of TEAM_METADATA) {
    teamMap.set(meta.tricode, createEmptyTeamRecord(meta.tricode));
  }

  const applySourceRoster = (sourceTeams: Record<string, Partial<SourceTeamRecord>>) => {
    for (const [tricode, data] of Object.entries(sourceTeams)) {
      const team = teamMap.get(tricode) ?? createEmptyTeamRecord(tricode);
      teamMap.set(tricode, team);
      if (data.coach && !team.coach) {
        team.coach = { ...data.coach };
      }
      if (typeof data.lastSeasonWins === "number") {
        team.lastSeasonWins = data.lastSeasonWins;
      }
      if (typeof data.lastSeasonSRS === "number") {
        team.lastSeasonSRS = data.lastSeasonSRS;
      }
      if (!data.roster) continue;
      for (const sourcePlayer of data.roster) {
        const key = playerKey(sourcePlayer);
        if (!key) continue;
        const existing = playerMap.get(key);
        const { firstName, lastName } = normalizeName(sourcePlayer.name);
        if (!existing) {
          const player: InternalPlayer = {
            key,
            name: sourcePlayer.name,
            playerId: sourcePlayer.playerId,
            position: sourcePlayer.position,
            firstName,
            lastName,
            teamId: sourcePlayer.teamId ?? team.teamId,
            teamTricode: sourcePlayer.teamTricode ?? tricode,
            source: "ball_dont_lie",
          };
          playerMap.set(key, player);
          addPlayerToTeam(team, player, changeLog, false);
        } else {
          if (sourcePlayer.position && !existing.position) {
            existing.position = sourcePlayer.position;
          }
          addPlayerToTeam(team, existing, changeLog, false);
        }
      }
    }
  };

  if (primary?.teams) {
    applySourceRoster(primary.teams as Record<string, Partial<SourceTeamRecord>>);
  }

  applyOverrides({ overrides, teamMap, playerMap, changeLog });

  const teams = Array.from(teamMap.values()).map((team) => {
    const change = changeLog.get(team.tricode);
    const keyAdditions = Array.from(change?.additions ?? []).sort();
    const keyLosses = Array.from(change?.losses ?? []).sort();
    const roster = team.roster.slice().sort((a, b) => a.name.localeCompare(b.name));
    return {
      ...team,
      roster,
      keyAdditions,
      keyLosses,
    };
  });

  teams.sort((a, b) => a.tricode.localeCompare(b.tricode));

  const players = Array.from(playerMap.values())
    .map((player) => {
      const { key: _key, ...rest } = player;
      return rest;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const injuries: InjuryRecord[] = [
    ...(primary?.injuries ?? []),
    ...overrides.injuries,
  ].map((injury) => ({ ...injury }));

  const coachEntries: CoachRecordEntry[] = teams
    .filter((team) => team.coach)
    .map((team) => ({
      teamTricode: team.tricode,
      name: team.coach?.name ?? "",
      role: team.coach?.role,
      isNew: team.coach?.isNew,
    }));

  const transactions: TransactionRecord[] = [
    ...(primary?.transactions ?? []),
  ].map((transaction) => ({ ...transaction }));

  return {
    teams,
    players,
    transactions,
    coaches: coachEntries,
    injuries,
  };
}

interface ApplyOverridesContext {
  overrides: OverridesConfig;
  teamMap: Map<string, TeamRecord>;
  playerMap: Map<string, InternalPlayer>;
  changeLog: Map<string, ChangeLog>;
}

function applyOverrides(context: ApplyOverridesContext) {
  const { overrides, teamMap, playerMap, changeLog } = context;

  for (const [tricode, teamOverride] of Object.entries(overrides.teams)) {
    const team = teamMap.get(tricode) ?? createEmptyTeamRecord(tricode);
    teamMap.set(tricode, team);
    if (teamOverride.notes) {
      for (const note of teamOverride.notes) {
        if (!team.notes.includes(note)) {
          team.notes.push(note);
        }
      }
    }
    if (teamOverride.coach) {
      team.coach = {
        name: teamOverride.coach.name,
        role: teamOverride.coach.role,
        isNew: teamOverride.coach.isNew ?? true,
      };
    }
    if (Array.isArray(teamOverride.roster_drop)) {
      for (const name of teamOverride.roster_drop) {
        const player = findPlayer(playerMap, name);
        if (player) {
          removePlayerFromTeam(team, player, changeLog);
          player.teamTricode = undefined;
          player.teamId = undefined;
        }
      }
    }
    if (Array.isArray(teamOverride.roster_add)) {
      for (const entry of teamOverride.roster_add) {
        if (typeof entry === "string") {
          const key = entry;
          const { firstName, lastName } = normalizeName(entry);
          const player: InternalPlayer = {
            key,
            name: entry,
            firstName,
            lastName,
            teamId: team.teamId,
            teamTricode: team.tricode,
            source: "override",
            position: undefined,
          } as InternalPlayer;
          playerMap.set(key, player);
          addPlayerToTeam(team, player, changeLog, true);
        } else if (entry && typeof entry === "object") {
          const overridePlayer = entry as PlayerOverride;
          const key = overridePlayer.name ?? `${team.tricode}-${team.roster.length + 1}`;
          const { firstName, lastName } = normalizeName(overridePlayer.name ?? "");
          const player: InternalPlayer = {
            key,
            name: overridePlayer.name ?? key,
            firstName,
            lastName,
            position: overridePlayer.position,
            teamId: team.teamId,
            teamTricode: team.tricode,
            source: "override",
          } as InternalPlayer;
          playerMap.set(key, player);
          addPlayerToTeam(team, player, changeLog, true);
        }
      }
    }
  }

  for (const playerOverride of Object.values(overrides.players)) {
    const targetName = playerOverride.name ?? "";
    const player = findPlayer(playerMap, targetName) ?? createOrRegisterPlayer(playerMap, targetName);
    if (playerOverride.position) {
      player.position = playerOverride.position;
    }
    if (playerOverride.status) {
      player.status = playerOverride.status;
    }
    if (playerOverride.team) {
      const targetTeam = teamMap.get(playerOverride.team) ?? createEmptyTeamRecord(playerOverride.team);
      teamMap.set(playerOverride.team, targetTeam);
      const currentTeam = player.teamTricode ? teamMap.get(player.teamTricode) : undefined;
      if (currentTeam && currentTeam.tricode !== targetTeam.tricode) {
        removePlayerFromTeam(currentTeam, player, changeLog);
      }
      addPlayerToTeam(targetTeam, player, changeLog, true);
    }
    if (playerOverride.teamId) {
      player.teamId = playerOverride.teamId;
    }
  }

  for (const coachOverride of overrides.coaches) {
    if (!coachOverride.team) continue;
    const team = teamMap.get(coachOverride.team) ?? createEmptyTeamRecord(coachOverride.team);
    teamMap.set(coachOverride.team, team);
    team.coach = {
      name: coachOverride.name,
      role: coachOverride.role,
      isNew: coachOverride.isNew ?? true,
    };
  }
}

function findPlayer(map: Map<string, InternalPlayer>, name: string): InternalPlayer | undefined {
  for (const player of map.values()) {
    if (player.name === name) {
      return player;
    }
  }
  return undefined;
}

function createOrRegisterPlayer(map: Map<string, InternalPlayer>, name: string): InternalPlayer {
  const key = name;
  let player = map.get(key);
  if (!player) {
    const { firstName, lastName } = normalizeName(name);
    player = {
      key,
      name,
      firstName,
      lastName,
      source: "override",
    } as InternalPlayer;
    map.set(key, player);
  }
  return player;
}

async function writeCanonicalOutputs(data: CanonicalData) {
  await mkdir(CANONICAL_DIR, { recursive: true });
  const teamsPath = path.join(CANONICAL_DIR, "teams.json");
  const playersPath = path.join(CANONICAL_DIR, "players.json");
  const transactionsPath = path.join(CANONICAL_DIR, "transactions.json");
  const coachesPath = path.join(CANONICAL_DIR, "coaches.json");
  const injuriesPath = path.join(CANONICAL_DIR, "injuries.json");

  await Promise.all([
    writeFile(teamsPath, JSON.stringify(data.teams, null, 2) + "\n", "utf8"),
    writeFile(playersPath, JSON.stringify(data.players, null, 2) + "\n", "utf8"),
    writeFile(transactionsPath, JSON.stringify(data.transactions, null, 2) + "\n", "utf8"),
    writeFile(coachesPath, JSON.stringify(data.coaches, null, 2) + "\n", "utf8"),
    writeFile(injuriesPath, JSON.stringify(data.injuries, null, 2) + "\n", "utf8"),
  ]);
}

async function run() {
  const data = await buildCanonicalData();
  await writeCanonicalOutputs(data);
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { mergeSources };
