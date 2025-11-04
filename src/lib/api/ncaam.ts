import { API } from "../config.js";

function normalizePath(path: string): string {
  if (typeof path !== "string" || path.length === 0) {
    return "/";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

function buildRequestInit(init: RequestInit = {}): RequestInit {
  const headers = new Headers({ Accept: "application/json" });
  if (init.headers instanceof Headers) {
    init.headers.forEach((value, key) => headers.set(key, value));
  } else if (init.headers && typeof init.headers === "object") {
    for (const [key, value] of Object.entries(init.headers)) {
      if (value != null) {
        headers.set(key, String(value));
      }
    }
  }

  return {
    ...init,
    headers,
    method: init.method ?? "GET",
  };
}

export async function ncaam<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const normalizedPath = normalizePath(path);
  const url = `${API}${normalizedPath}`;
  const response = await fetch(url, buildRequestInit(init));
  if (!response.ok) {
    throw new Error(`NCAAM ${response.status} ${response.statusText} for ${normalizedPath}`);
  }
  return response.json() as Promise<T>;
}

type RawMaybeNumber = number | string | null | undefined;
type RawMaybeString = string | number | null | undefined;

type RawTeam = {
  id?: RawMaybeNumber;
  abbreviation?: RawMaybeString;
  name?: RawMaybeString;
  full_name?: RawMaybeString;
};

type RawParticipant = {
  id?: RawMaybeNumber;
  first_name?: RawMaybeString;
  last_name?: RawMaybeString;
  full_name?: RawMaybeString;
  jersey_number?: RawMaybeString;
  position?: RawMaybeString;
  type?: RawMaybeString;
  order?: RawMaybeNumber;
  sequence?: RawMaybeNumber;
  team?: RawTeam | null;
};

type RawStatistic = {
  id?: RawMaybeNumber;
  type?: RawMaybeString;
  result?: RawMaybeString;
  qualifier?: RawMaybeString;
  shot_type?: RawMaybeString;
  shot_value?: RawMaybeNumber;
  player?: RawParticipant | null;
  player_id?: RawMaybeNumber;
  team?: RawTeam | null;
  team_id?: RawMaybeNumber;
  free_throw?: {
    number?: RawMaybeNumber;
    total?: RawMaybeNumber;
  } | null;
  turnover_type?: RawMaybeString;
  foul_type?: RawMaybeString;
  rebound_type?: RawMaybeString;
  sub_type?: RawMaybeString;
  value?: RawMaybeNumber;
  seconds?: RawMaybeNumber;
  duration?: RawMaybeNumber;
};

type RawPlayByPlayEvent = {
  id?: RawMaybeNumber;
  sequence?: RawMaybeNumber;
  order?: RawMaybeNumber;
  clock?: RawMaybeString;
  period?: RawMaybeNumber;
  text?: RawMaybeString;
  description?: RawMaybeString;
  team?: RawTeam | null;
  possession?: RawTeam | null;
  home_score?: RawMaybeNumber;
  away_score?: RawMaybeNumber;
  participants?: RawParticipant[] | null;
  statistics?: RawStatistic[] | null;
};

type RawPlayByPlayResponse = {
  data?: RawPlayByPlayEvent[] | null;
};

export type PlayByPlayTeam = {
  id: number | null;
  abbreviation?: string | null;
  name?: string | null;
  fullName?: string | null;
};

export type PlayByPlayParticipant = {
  id: number | null;
  teamId: number | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  jerseyNumber?: string | null;
  position?: string | null;
  role?: string | null;
  order?: number | null;
};

export type PlayByPlayStatisticType =
  | "field_goal"
  | "free_throw"
  | "rebound"
  | "assist"
  | "block"
  | "steal"
  | "turnover"
  | "foul"
  | "lineup"
  | "jump_ball"
  | "substitution"
  | "timeout"
  | "violation"
  | "seconds_played"
  | "unknown";

export type PlayByPlayStatistic = {
  type: PlayByPlayStatisticType;
  playerId: number | null;
  teamId: number | null;
  result?: string | null;
  shotValue?: number | null;
  shotType?: string | null;
  isThreePoint?: boolean | null;
  reboundType?: "offensive" | "defensive" | "team_offensive" | "team_defensive" | null;
  turnoverType?: string | null;
  foulType?: string | null;
  qualifier?: string | null;
  freeThrowNumber?: number | null;
  freeThrowTotal?: number | null;
  technical?: boolean;
  flagrant?: boolean;
  seconds?: number | null;
};

export type PlayByPlayEvent = {
  id: string;
  sequence: number;
  period: number | null;
  clock: string | null;
  description: string;
  homeScore: number | null;
  awayScore: number | null;
  teamId: number | null;
  team: PlayByPlayTeam | null;
  possessionTeamId: number | null;
  participants: PlayByPlayParticipant[];
  statistics: PlayByPlayStatistic[];
  isScoringPlay: boolean;
};

function toNumber(value: RawMaybeNumber): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function toInteger(value: RawMaybeNumber): number | null {
  const numeric = toNumber(value);
  if (numeric === null) {
    return null;
  }
  const rounded = Math.trunc(numeric);
  return Number.isFinite(rounded) ? rounded : null;
}

function toStringValue(value: RawMaybeString): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function normalizeTeam(team: RawTeam | null | undefined): PlayByPlayTeam | null {
  if (!team || (team.id == null && team.abbreviation == null && team.name == null && team.full_name == null)) {
    return null;
  }
  const id = toInteger(team.id);
  return {
    id,
    abbreviation: toStringValue(team.abbreviation),
    name: toStringValue(team.name),
    fullName: toStringValue(team.full_name),
  };
}

function normalizeParticipant(raw: RawParticipant, fallbackTeamId: number | null): PlayByPlayParticipant | null {
  const id = toInteger(raw.id);
  const teamId = toInteger(raw.team?.id ?? fallbackTeamId);
  const firstName = toStringValue(raw.first_name);
  const lastName = toStringValue(raw.last_name);
  const fullName = toStringValue(raw.full_name) ??
    (firstName || lastName ? [firstName, lastName].filter(Boolean).join(" ") : null);
  const jerseyNumber = toStringValue(raw.jersey_number);
  const position = toStringValue(raw.position);
  const role = toStringValue(raw.type);
  const order = toInteger(raw.sequence ?? raw.order);

  if (id === null && fullName === null && role === null && jerseyNumber === null) {
    return null;
  }

  return {
    id,
    teamId,
    firstName,
    lastName,
    fullName,
    jerseyNumber,
    position,
    role,
    order,
  };
}

const THREE_POINT_PATTERN = /\b3(?:pt|\s?pointer)\b/i;
const OFFENSIVE_PATTERN = /offen/i;
const DEFENSIVE_PATTERN = /defen/i;
const TECHNICAL_PATTERN = /technical/i;
const FLAGRANT_PATTERN = /flagrant/i;
const MADE_PATTERN = /made|good|scored|success/i;
const MISSED_PATTERN = /miss/i;
const FREE_THROW_PATTERN = /free[_\s-]*throw/i;

function isThreePoint(stat: RawStatistic, qualifier: string | null, shotType: string | null): boolean | null {
  if (stat.shot_value != null) {
    const value = toNumber(stat.shot_value);
    if (value === 3) {
      return true;
    }
    if (value === 2) {
      return false;
    }
  }
  if (shotType && THREE_POINT_PATTERN.test(shotType)) {
    return true;
  }
  if (qualifier && THREE_POINT_PATTERN.test(qualifier)) {
    return true;
  }
  return null;
}

function resolvePlayerId(stat: RawStatistic): number | null {
  const fromPlayer = toInteger(stat.player?.id ?? stat.player_id);
  if (fromPlayer !== null) {
    return fromPlayer;
  }
  return null;
}

function resolveTeamId(stat: RawStatistic, fallbackTeamId: number | null): number | null {
  const fromTeam = toInteger(stat.team?.id ?? stat.team_id);
  if (fromTeam !== null) {
    return fromTeam;
  }
  return fallbackTeamId;
}

function normalizeStatistic(
  raw: RawStatistic,
  fallbackTeamId: number | null,
  participants: PlayByPlayParticipant[],
): PlayByPlayStatistic | null {
  const rawType = toStringValue(raw.type)?.toLowerCase() ?? "";
  const qualifier = toStringValue(raw.qualifier);
  const shotType = toStringValue(raw.shot_type);
  const result = toStringValue(raw.result);
  const playerId = resolvePlayerId(raw);
  const teamId = resolveTeamId(raw, fallbackTeamId);

  const base: PlayByPlayStatistic = {
    type: "unknown",
    playerId,
    teamId,
    result,
    qualifier,
    shotType,
    shotValue: null,
    isThreePoint: null,
    reboundType: null,
    turnoverType: null,
    foulType: null,
    freeThrowNumber: null,
    freeThrowTotal: null,
    technical: false,
    flagrant: false,
    seconds: null,
  };

  const detectPlayerByRole = (role: string) => {
    const participant = participants.find(part =>
      part.id !== null && part.id !== undefined && typeof part.role === "string" && part.role.toLowerCase().includes(role),
    );
    return participant?.id ?? null;
  };

  if (FREE_THROW_PATTERN.test(rawType) || FREE_THROW_PATTERN.test(qualifier ?? "")) {
    base.type = "free_throw";
    base.shotValue = toNumber(raw.shot_value) ?? 1;
    base.isThreePoint = false;
    base.freeThrowNumber = toInteger(raw.free_throw?.number);
    base.freeThrowTotal = toInteger(raw.free_throw?.total);
    base.playerId = playerId ?? detectPlayerByRole("free");
    base.technical = TECHNICAL_PATTERN.test(qualifier ?? "") || TECHNICAL_PATTERN.test(raw.foul_type ?? "");
    base.flagrant = FLAGRANT_PATTERN.test(qualifier ?? "") || FLAGRANT_PATTERN.test(raw.foul_type ?? "");
    return base;
  }

  if (rawType.includes("field") || rawType.includes("shot")) {
    base.type = "field_goal";
    base.shotValue = toNumber(raw.shot_value);
    base.isThreePoint = isThreePoint(raw, qualifier, shotType);
    base.playerId = playerId ?? detectPlayerByRole("shoot");
    return base;
  }

  if (rawType.includes("assist")) {
    base.type = "assist";
    base.playerId = playerId ?? detectPlayerByRole("assist");
    return base;
  }

  if (rawType.includes("block")) {
    base.type = "block";
    base.playerId = playerId ?? detectPlayerByRole("block");
    return base;
  }

  if (rawType.includes("steal")) {
    base.type = "steal";
    base.playerId = playerId ?? detectPlayerByRole("steal");
    return base;
  }

  if (rawType.includes("turnover") || rawType.includes("lost ball") || rawType.includes("bad pass")) {
    base.type = "turnover";
    base.playerId = playerId ?? detectPlayerByRole("turnover");
    base.turnoverType = toStringValue(raw.turnover_type);
    return base;
  }

  if (rawType.includes("rebound")) {
    const subtype = toStringValue(raw.rebound_type ?? raw.sub_type ?? qualifier);
    const reboundType = (() => {
      if (subtype) {
        if (OFFENSIVE_PATTERN.test(subtype)) {
          return "offensive";
        }
        if (DEFENSIVE_PATTERN.test(subtype)) {
          return "defensive";
        }
      }
      return null;
    })();
    base.type = "rebound";
    base.playerId = playerId ?? detectPlayerByRole("rebound");
    if (reboundType === "offensive" && base.playerId === null && teamId !== null) {
      base.reboundType = "team_offensive";
    } else if (reboundType === "defensive" && base.playerId === null && teamId !== null) {
      base.reboundType = "team_defensive";
    } else {
      base.reboundType = reboundType;
    }
    return base;
  }

  if (rawType.includes("foul")) {
    base.type = "foul";
    base.playerId = playerId ?? detectPlayerByRole("foul");
    const foulType = toStringValue(raw.foul_type ?? qualifier);
    base.foulType = foulType;
    base.technical = TECHNICAL_PATTERN.test(foulType ?? "");
    base.flagrant = FLAGRANT_PATTERN.test(foulType ?? "");
    return base;
  }

  if (rawType.includes("lineup") || rawType.includes("starter")) {
    base.type = "lineup";
    base.playerId = playerId ?? detectPlayerByRole("start");
    return base;
  }

  if (rawType.includes("jump")) {
    base.type = "jump_ball";
    return base;
  }

  if (rawType.includes("substitution")) {
    base.type = "substitution";
    base.playerId = playerId ?? detectPlayerByRole("sub");
    return base;
  }

  if (rawType.includes("timeout")) {
    base.type = "timeout";
    return base;
  }

  if (rawType.includes("violation")) {
    base.type = "violation";
    return base;
  }

  if (rawType.includes("second") || rawType.includes("minute") || rawType.includes("duration")) {
    base.type = "seconds_played";
    const rawSeconds = toNumber(raw.seconds ?? raw.value ?? raw.duration);
    if (rawSeconds !== null) {
      base.seconds = rawSeconds;
    }
    base.playerId = playerId ?? detectPlayerByRole("play");
    return base;
  }

  if (rawType || qualifier || shotType) {
    return base;
  }

  return null;
}

function hasPositiveResult(stat: PlayByPlayStatistic): boolean {
  if (stat.type === "field_goal" || stat.type === "free_throw") {
    if (stat.result && MADE_PATTERN.test(stat.result)) {
      return true;
    }
    if (stat.result && MISSED_PATTERN.test(stat.result)) {
      return false;
    }
  }
  return false;
}

function normalizeEvent(event: RawPlayByPlayEvent, fallbackSequence: number): PlayByPlayEvent | null {
  const sequence = toInteger(event.sequence ?? event.order) ?? fallbackSequence;
  const id = toStringValue(event.id) ?? `event-${sequence}`;
  const clock = toStringValue(event.clock);
  const period = toInteger(event.period);
  const description = toStringValue(event.text ?? event.description) ?? "";
  const team = normalizeTeam(event.team);
  const possessionTeamId = normalizeTeam(event.possession)?.id ?? null;
  const homeScore = toInteger(event.home_score);
  const awayScore = toInteger(event.away_score);

  const participants = Array.isArray(event.participants)
    ? event.participants
        .map(part => normalizeParticipant(part, team?.id ?? null))
        .filter((part): part is PlayByPlayParticipant => part !== null)
    : [];

  const stats: PlayByPlayStatistic[] = Array.isArray(event.statistics)
    ? event.statistics
        .map(stat => normalizeStatistic(stat, team?.id ?? null, participants))
        .filter((stat): stat is PlayByPlayStatistic => stat !== null)
    : [];

  const isScoringPlay = stats.some(stat => hasPositiveResult(stat));

  return {
    id,
    sequence,
    period,
    clock,
    description,
    homeScore,
    awayScore,
    teamId: team?.id ?? null,
    team,
    possessionTeamId,
    participants,
    statistics: stats,
    isScoringPlay,
  };
}

export function normalizeGamePlayByPlayResponse(raw: RawPlayByPlayResponse | null | undefined): PlayByPlayEvent[] {
  if (!raw || !Array.isArray(raw.data)) {
    return [];
  }
  const result: PlayByPlayEvent[] = [];
  let fallbackSequence = 0;
  for (const event of raw.data) {
    fallbackSequence += 1;
    const normalized = normalizeEvent(event, fallbackSequence);
    if (!normalized) {
      continue;
    }
    result.push(normalized);
  }
  result.sort((a, b) => a.sequence - b.sequence);
  return result;
}

export async function getGamePlayByPlay(gameId: number | string | null | undefined): Promise<PlayByPlayEvent[]> {
  if (gameId === null || gameId === undefined) {
    return [];
  }
  const normalizedId = typeof gameId === "string" ? gameId.trim() : gameId;
  if (normalizedId === "") {
    return [];
  }
  const response = await ncaam<RawPlayByPlayResponse>(`/games/${normalizedId}/playbyplay`);
  return normalizeGamePlayByPlayResponse(response);
}

