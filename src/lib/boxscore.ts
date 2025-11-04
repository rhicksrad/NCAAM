import type { PlayByPlayEvent, PlayByPlayParticipant, PlayByPlayStatistic } from "./api/ncaam.js";
import type { Game, Team } from "./sdk/ncaam.js";

type NumericStat =
  | "fgm"
  | "fga"
  | "tpm"
  | "tpa"
  | "ftm"
  | "fta"
  | "oreb"
  | "dreb"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "tov"
  | "pf"
  | "pts";

type PlayerIdentity = {
  playerId: number | null;
  teamId: number | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  jerseyNumber?: string | null;
  position?: string | null;
};

export type PlayerBoxScoreLine = PlayerIdentity & {
  starter: boolean;
  order: number;
  seconds: number;
  minutes: number | null;
} & Record<NumericStat, number>;

export type TeamBoxScoreTotals = {
  seconds: number;
  minutes: number | null;
} & Record<NumericStat, number>;

export type TeamBoxScore = {
  teamId: number | null;
  team: Team | null;
  starters: PlayerBoxScoreLine[];
  bench: PlayerBoxScoreLine[];
  players: PlayerBoxScoreLine[];
  totals: TeamBoxScoreTotals;
};

export type GameBoxScore = {
  gameId: number;
  eventsProcessed: number;
  home: TeamBoxScore;
  away: TeamBoxScore;
};

type MutablePlayer = PlayerBoxScoreLine & {
  starter: boolean;
};

type MutableTeam = {
  teamId: number | null;
  team: Team | null;
  players: Map<number, MutablePlayer>;
  orderCounter: number;
  totals: TeamBoxScoreTotals;
};

type BuildBoxScoreOptions = {
  game: Game;
  events: PlayByPlayEvent[];
};

function createEmptyPlayer(identity: PlayerIdentity, order: number): MutablePlayer {
  return {
    ...identity,
    starter: false,
    order,
    seconds: 0,
    minutes: null,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    pts: 0,
  };
}

function createEmptyTotals(): TeamBoxScoreTotals {
  return {
    seconds: 0,
    minutes: null,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    pf: 0,
    pts: 0,
  };
}

function ensureTeam(
  state: Map<number | null, MutableTeam>,
  team: Team | null,
  explicitTeamId?: number | null,
): MutableTeam {
  const teamIdFromTeam = typeof team?.id === "number" && Number.isFinite(team.id) ? team.id : null;
  const resolvedId =
    typeof explicitTeamId === "number" && Number.isFinite(explicitTeamId)
      ? explicitTeamId
      : typeof explicitTeamId === "number"
        ? explicitTeamId
        : teamIdFromTeam;
  const key = resolvedId ?? null;
  let entry = state.get(key);
  if (!entry) {
    entry = {
      teamId: key,
      team: team ?? null,
      players: new Map(),
      orderCounter: 0,
      totals: createEmptyTotals(),
    };
    state.set(key, entry);
  } else if (!entry.team && team) {
    entry.team = team;
  }
  return entry;
}

function ensurePlayer(
  teamState: MutableTeam,
  identity: PlayerIdentity,
  orderHint: number,
): MutablePlayer | null {
  if (identity.playerId === null) {
    return null;
  }
  const existing = teamState.players.get(identity.playerId);
  if (existing) {
    if (identity.firstName && !existing.firstName) existing.firstName = identity.firstName;
    if (identity.lastName && !existing.lastName) existing.lastName = identity.lastName;
    if (identity.fullName && !existing.fullName) existing.fullName = identity.fullName;
    if (identity.jerseyNumber && !existing.jerseyNumber) existing.jerseyNumber = identity.jerseyNumber;
    if (identity.position && !existing.position) existing.position = identity.position;
    return existing;
  }
  const order = orderHint > 0 ? orderHint : ++teamState.orderCounter;
  const created = createEmptyPlayer(identity, order);
  teamState.players.set(identity.playerId, created);
  return created;
}

function applyNumeric(stat: NumericStat, value: number, player: MutablePlayer | null, team: MutableTeam) {
  if (!Number.isFinite(value) || value === 0) {
    return;
  }
  if (player) {
    player[stat] += value;
  }
  team.totals[stat] += value;
}

function markStarter(participant: PlayByPlayParticipant | null, player: MutablePlayer | null) {
  if (!participant || !player) {
    return;
  }
  const role = participant.role?.toLowerCase() ?? "";
  if (role.includes("starter") || role.includes("lineup")) {
    player.starter = true;
  }
}

function updateTotalsRebounds(player: MutablePlayer | null, team: MutableTeam) {
  if (player) {
    player.reb = player.oreb + player.dreb;
  }
  team.totals.reb = team.totals.oreb + team.totals.dreb;
}

function inferTeamFromIds(teamId: number | null, fallback: number | null) {
  if (teamId !== null) return teamId;
  if (fallback !== null) return fallback;
  return null;
}

function processFieldGoal(
  stat: PlayByPlayStatistic,
  player: MutablePlayer | null,
  team: MutableTeam,
) {
  applyNumeric("fga", 1, player, team);
  const shotValue = typeof stat.shotValue === "number" && Number.isFinite(stat.shotValue)
    ? stat.shotValue
    : stat.isThreePoint === true
      ? 3
      : 2;
  const isThree = stat.isThreePoint === true || shotValue === 3;
  if (isThree) {
    applyNumeric("tpa", 1, player, team);
  }
  const resultSource = `${stat.result ?? ""} ${stat.qualifier ?? ""}`.toLowerCase();
  const made = /made|good|scored|success/.test(resultSource);
  if (made) {
    applyNumeric("fgm", 1, player, team);
    if (isThree) {
      applyNumeric("tpm", 1, player, team);
    }
    applyNumeric("pts", shotValue, player, team);
  }
}

function processFreeThrow(
  stat: PlayByPlayStatistic,
  player: MutablePlayer | null,
  team: MutableTeam,
) {
  applyNumeric("fta", 1, player, team);
  const value = typeof stat.shotValue === "number" && Number.isFinite(stat.shotValue) ? stat.shotValue : 1;
  const resultSource = `${stat.result ?? ""} ${stat.qualifier ?? ""}`.toLowerCase();
  const made = /made|good|scored|success/.test(resultSource);
  if (made) {
    applyNumeric("ftm", 1, player, team);
    applyNumeric("pts", value, player, team);
  }
}

function processRebound(
  stat: PlayByPlayStatistic,
  player: MutablePlayer | null,
  team: MutableTeam,
) {
  const type = stat.reboundType;
  if (type === "offensive" || type === "team_offensive") {
    applyNumeric("oreb", 1, player, team);
  } else {
    applyNumeric("dreb", 1, player, team);
  }
  updateTotalsRebounds(player, team);
}

function processSeconds(stat: PlayByPlayStatistic, player: MutablePlayer | null, team: MutableTeam) {
  const seconds = typeof stat.seconds === "number" && Number.isFinite(stat.seconds)
    ? stat.seconds
    : 0;
  if (seconds <= 0) {
    return;
  }
  if (player) {
    player.seconds += seconds;
  }
  team.totals.seconds += seconds;
}

function applyStatistic(
  stat: PlayByPlayStatistic,
  participant: PlayByPlayParticipant | null,
  player: MutablePlayer | null,
  team: MutableTeam,
) {
  switch (stat.type) {
    case "field_goal":
      processFieldGoal(stat, player, team);
      break;
    case "free_throw":
      processFreeThrow(stat, player, team);
      break;
    case "assist":
      applyNumeric("ast", 1, player, team);
      break;
    case "steal":
      applyNumeric("stl", 1, player, team);
      break;
    case "block":
      applyNumeric("blk", 1, player, team);
      break;
    case "turnover":
      applyNumeric("tov", 1, player, team);
      break;
    case "foul":
      applyNumeric("pf", 1, player, team);
      break;
    case "rebound":
      processRebound(stat, player, team);
      break;
    case "seconds_played":
      processSeconds(stat, player, team);
      break;
    case "lineup":
      if (player) {
        markStarter(participant, player);
      }
      break;
    default:
      break;
  }
}

function normalizeMinutes(seconds: number): number | null {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return seconds / 60;
}

function finalizeTeam(team: MutableTeam): TeamBoxScore {
  const players = Array.from(team.players.values());
  for (const player of players) {
    player.minutes = normalizeMinutes(player.seconds);
    player.reb = player.oreb + player.dreb;
  }
  team.totals.minutes = normalizeMinutes(team.totals.seconds);
  team.totals.reb = team.totals.oreb + team.totals.dreb;

  players.sort((a, b) => {
    if (a.starter !== b.starter) {
      return a.starter ? -1 : 1;
    }
    if (b.seconds !== a.seconds) {
      return b.seconds - a.seconds;
    }
    return a.order - b.order;
  });

  const starters = players.filter(player => player.starter);
  const bench = players.filter(player => !player.starter);

  return {
    teamId: team.teamId,
    team: team.team,
    players,
    starters,
    bench,
    totals: team.totals,
  };
}

function participantIdentity(part: PlayByPlayParticipant): PlayerIdentity {
  return {
    playerId: part.id ?? null,
    teamId: part.teamId ?? null,
    firstName: part.firstName ?? null,
    lastName: part.lastName ?? null,
    fullName: part.fullName ?? null,
    jerseyNumber: part.jerseyNumber ?? null,
    position: part.position ?? null,
  };
}

function statisticIdentity(
  stat: PlayByPlayStatistic,
  fallbackTeamId: number | null,
): PlayerIdentity {
  return {
    playerId: stat.playerId,
    teamId: stat.teamId ?? fallbackTeamId,
  };
}

export function buildBoxScoreFromPlayByPlay({ game, events }: BuildBoxScoreOptions): GameBoxScore {
  const homeTeam = game.home_team ?? null;
  const awayTeam = game.visitor_team ?? null;
  const homeId = typeof homeTeam?.id === "number" ? homeTeam.id : null;
  const awayId = typeof awayTeam?.id === "number" ? awayTeam.id : null;

  const teamState = new Map<number | null, MutableTeam>();
  ensureTeam(teamState, homeTeam, homeId);
  ensureTeam(teamState, awayTeam, awayId);

  let processedEvents = 0;

  for (const event of events) {
    processedEvents += 1;
    const teamId = inferTeamFromIds(event.teamId, event.possessionTeamId);
    const team = ensureTeam(
      teamState,
      teamId === homeId ? homeTeam : teamId === awayId ? awayTeam : null,
      teamId,
    );

    for (const participant of event.participants) {
      const identity = participantIdentity(participant);
      const resolvedTeamId = inferTeamFromIds(identity.teamId ?? null, teamId);
      identity.teamId = resolvedTeamId;
      const participantTeam = ensureTeam(
        teamState,
        resolvedTeamId === homeId ? homeTeam : resolvedTeamId === awayId ? awayTeam : team.team,
        resolvedTeamId ?? teamId ?? null,
      );
      const player = ensurePlayer(participantTeam, identity, participant.order ?? 0);
      if (player) {
        markStarter(participant, player);
      }
    }

    for (const stat of event.statistics) {
      const statIdentity = statisticIdentity(stat, teamId);
      statIdentity.teamId = inferTeamFromIds(statIdentity.teamId ?? null, teamId);
      const targetTeam = ensureTeam(
        teamState,
        statIdentity.teamId === homeId
          ? homeTeam
          : statIdentity.teamId === awayId
            ? awayTeam
            : statIdentity.teamId !== null
              ? null
              : team.team,
        statIdentity.teamId ?? team.teamId ?? null,
      );
      const participant = event.participants.find(part => part.id === statIdentity.playerId) ?? null;
      const player = ensurePlayer(targetTeam, statIdentity, participant?.order ?? 0);
      applyStatistic(stat, participant ?? null, player, targetTeam);
    }
  }

  const homeBox = finalizeTeam(ensureTeam(teamState, homeTeam, homeId));
  const awayBox = finalizeTeam(ensureTeam(teamState, awayTeam, awayId));

  return {
    gameId: game.id,
    eventsProcessed: processedEvents,
    home: homeBox,
    away: awayBox,
  };
}

