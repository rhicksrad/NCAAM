import { inferArchetypes } from "./archetypes";
import { decodeMatchup, readHash } from "./state";
import type { Player } from "./types";
import { createRumbleExperience, type RumbleExperience } from "./ui";

interface RawProfile {
  id?: string | number;
  personId?: string | number;
  name: string;
  era?: string | null;
  position?: string | null;
  team?: string | null;
  teamAbbr?: string | null;
  archetype?: string | null;
  bdl?: {
    id?: string | number | null;
  } | null;
  goatImpact?: number | null;
}

interface GoatRecord {
  personId?: string | number;
  name?: string;
  careerSpan?: string | null;
  primeWindow?: string | null;
  franchises?: string[];
}

interface CareerTotals {
  games: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
}

interface CareerSlice {
  totals?: CareerTotals | null;
  seasons?: number[] | null;
}

interface CareerRecord {
  regular?: CareerSlice | null;
  postseason?: CareerSlice | null;
}

interface CareerDataset {
  players?: Record<string, CareerRecord> | null;
  byName?: Record<string, CareerRecord> | null;
}

interface PlayerIndexEntry {
  id?: number | string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface EnrichmentContext {
  careerById: Map<string, CareerRecord>;
  careerByName: Map<string, CareerRecord>;
  nameToCareerId: Map<string, string>;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash >>>= 0;
  }
  return hash >>> 0;
}

function seededRange(hash: number, min: number, max: number): number {
  const fraction = hash / 0xffffffff;
  return min + (max - min) * fraction;
}

function parseArchetype(label: string | null | undefined): string[] {
  if (!label) {
    return [];
  }
  const normalized = label.toLowerCase();
  const tags: string[] = [];
  if (normalized.includes("creator")) tags.push("Creator");
  if (normalized.includes("shooter")) tags.push("Off-ball Shooter");
  if (normalized.includes("rim")) tags.push("Rim Runner");
  if (normalized.includes("switch")) tags.push("Switch Big");
  if (normalized.includes("protector")) tags.push("Rim Protector");
  if (normalized.includes("connector") || normalized.includes("glue")) tags.push("Connector");
  if (normalized.includes("secondary")) tags.push("Secondary");
  if (normalized.includes("stopper")) tags.push("POA Stopper");
  if (normalized.includes("stretch")) tags.push("Stretch Big");
  return tags;
}

const TOTAL_FIELDS = [
  "games",
  "minutes",
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fouls",
  "fgm",
  "fga",
  "fg3m",
  "fg3a",
  "ftm",
  "fta",
  "oreb",
  "dreb",
] as const satisfies readonly (keyof CareerTotals)[];

type TotalField = (typeof TOTAL_FIELDS)[number];

function normalizeName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function toCareerMap(dataset: CareerDataset | null | undefined): EnrichmentContext {
  const careerById = new Map<string, CareerRecord>();
  const careerByName = new Map<string, CareerRecord>();
  const nameToCareerId = new Map<string, string>();

  if (dataset?.players && typeof dataset.players === "object") {
    Object.entries(dataset.players).forEach(([key, record]) => {
      careerById.set(String(key), record ?? {});
    });
  }

  if (dataset?.byName && typeof dataset.byName === "object") {
    Object.entries(dataset.byName).forEach(([rawName, record]) => {
      const normalized = normalizeName(rawName);
      if (normalized) {
        careerByName.set(normalized, record ?? {});
      }
    });
  }

  return { careerById, careerByName, nameToCareerId };
}

function mergeTotals(primary?: CareerTotals | null, secondary?: CareerTotals | null): CareerTotals | null {
  if (!primary && !secondary) {
    return null;
  }
  const result: Record<TotalField, number> = {} as Record<TotalField, number>;
  TOTAL_FIELDS.forEach((field) => {
    const base = primary?.[field] ?? 0;
    const extra = secondary?.[field] ?? 0;
    result[field] = base + extra;
  });
  return result as CareerTotals;
}

function collectSeasons(record: CareerRecord | null | undefined): number[] {
  const buckets = new Set<number>();
  const segments: Array<CareerSlice | null | undefined> = [record?.regular, record?.postseason];
  segments.forEach((slice) => {
    if (!slice?.seasons) {
      return;
    }
    slice.seasons.forEach((year) => {
      if (Number.isFinite(year)) {
        buckets.add(Number(year));
      }
    });
  });
  return Array.from(buckets.values()).sort((a, b) => a - b);
}

function deriveEraFromSeasons(seasons: number[]): string | null {
  if (!seasons.length) {
    return null;
  }
  const start = seasons[0];
  const end = seasons[seasons.length - 1];
  const startDecade = Math.floor(start / 10) * 10;
  const endDecade = Math.floor(end / 10) * 10;
  if (startDecade === endDecade) {
    return `${startDecade}s`;
  }
  return `${startDecade}s–${endDecade}s`;
}

function computePaceZ(seasons: number[]): number {
  if (!seasons.length) {
    return 0;
  }
  const average = seasons.reduce((total, year) => total + year, 0) / seasons.length;
  const centered = (average - 2000) / 25;
  if (centered > 1) return 1;
  if (centered < -1) return -1;
  return centered;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function minutesFromTotals(totals: CareerTotals | null): number {
  if (!totals) {
    return 0;
  }
  return safeDivide(totals.minutes, 60);
}

function computeUsage(totals: CareerTotals | null, minutes: number): number {
  if (!totals || minutes <= 0) {
    return 0;
  }
  const possessionEvents = totals.fga + 0.44 * totals.fta + totals.turnovers;
  if (possessionEvents <= 0) {
    return 0;
  }
  const expectedPossessions = (minutes / 48) * 100;
  if (expectedPossessions <= 0) {
    return 0;
  }
  const share = possessionEvents / expectedPossessions;
  return Math.max(0, Math.min(60, share * 100));
}

function computeAssistShare(totals: CareerTotals | null): number {
  if (!totals) {
    return 0;
  }
  const ballEvents = totals.fga + 0.44 * totals.fta + totals.turnovers + totals.assists;
  if (ballEvents <= 0) {
    return 0;
  }
  const share = totals.assists / ballEvents;
  return Math.max(0, Math.min(60, share * 100));
}

function computeImpactScore(
  totals: CareerTotals | null,
  minutes: number,
  usage: number,
  assistShare: number,
  goatImpact: number | null | undefined
): number {
  if (!totals || minutes <= 0) {
    return goatImpact && Number.isFinite(goatImpact) ? Math.max(2, goatImpact / 3.5) : 4;
  }

  const pointsPer36 = (totals.points / minutes) * 36;
  const reboundsPer36 = (totals.rebounds / minutes) * 36;
  const assistsPer36 = (totals.assists / minutes) * 36;
  const stocksPer36 = ((totals.steals + totals.blocks) / minutes) * 36;
  const threePointPct = safeDivide(totals.fg3m, totals.fg3a);

  const base =
    pointsPer36 * 0.28 +
    reboundsPer36 * 0.18 +
    assistsPer36 * 0.25 +
    stocksPer36 * 0.35;

  const spacing = (threePointPct - 0.34) * 35;
  const creation = Math.max(0, assistShare - 18) * 0.25;
  const load = Math.max(0, usage - 22) * 0.3;

  let impact = base / 4 + spacing + creation + load;

  if (goatImpact && Number.isFinite(goatImpact)) {
    impact = Math.max(impact, goatImpact / 3.2);
  }

  if (impact < 2) {
    return 2;
  }
  if (impact > 13) {
    return 13;
  }
  return impact;
}

function findCareerRecord(profile: RawProfile, context: EnrichmentContext): { id: string; record: CareerRecord } | null {
  const candidateIds = new Set<string>();
  if (profile.bdl?.id !== null && profile.bdl?.id !== undefined) {
    candidateIds.add(String(profile.bdl.id));
  }
  if (profile.personId !== null && profile.personId !== undefined) {
    candidateIds.add(String(profile.personId));
  }
  if (profile.id !== null && profile.id !== undefined) {
    candidateIds.add(String(profile.id));
  }

  const normalizedName = normalizeName(profile.name);
  if (normalizedName) {
    const mappedId = context.nameToCareerId.get(normalizedName);
    if (mappedId) {
      candidateIds.add(mappedId);
    }
  }

  for (const id of candidateIds) {
    const record = context.careerById.get(id);
    if (record) {
      return { id, record };
    }
  }

  if (normalizedName) {
    const record = context.careerByName.get(normalizedName);
    if (record) {
      return { id: normalizedName, record };
    }
  }

  return null;
}

function enrichProfile(profile: RawProfile, context: EnrichmentContext): Player {
  const fallbackId = String(profile.personId ?? profile.id ?? profile.name);
  const match = findCareerRecord(profile, context);
  const resolvedId = match?.id ?? fallbackId;
  const name = profile.name || resolvedId;
  const seedBase = `${resolvedId}:${name}`;
  const baseHash = hashString(seedBase);
  const totals = mergeTotals(match?.record?.regular?.totals ?? null, match?.record?.postseason?.totals ?? null);
  const minutesPlayed = minutesFromTotals(totals);
  const usage = computeUsage(totals, minutesPlayed);
  const assistShare = computeAssistShare(totals);
  const threeP = safeDivide(totals?.fg3m ?? 0, totals?.fg3a ?? 0);
  const threeRate = safeDivide(totals?.fg3a ?? 0, totals?.fga ?? 0);
  const stealsRate = minutesPlayed > 0 ? (totals?.steals ?? 0) / minutesPlayed : 0;
  const blocksRate = minutesPlayed > 0 ? (totals?.blocks ?? 0) / minutesPlayed : 0;
  const seasons = collectSeasons(match?.record);
  const paceZ = computePaceZ(seasons);
  const impactScore = computeImpactScore(totals, minutesPlayed, usage, assistShare, profile.goatImpact);

  const player: Player = {
    id: resolvedId,
    name,
    era: profile.era ?? deriveEraFromSeasons(seasons) ?? null,
    pos: profile.position ?? null,
    franchise: profile.teamAbbr ?? profile.team ?? null,
    threeP:
      Number.isFinite(threeP) && threeP >= 0
        ? threeP
        : seededRange(hashString(`${seedBase}:3P`), 0.26, 0.45),
    threePA_rate:
      Number.isFinite(threeRate) && threeRate >= 0
        ? threeRate
        : seededRange(hashString(`${seedBase}:3PA`), 0.18, 0.65),
    astPct:
      Number.isFinite(assistShare) && assistShare >= 0
        ? assistShare
        : seededRange(hashString(`${seedBase}:AST`), 10, 38),
    usg: Number.isFinite(usage) && usage > 0 ? usage : seededRange(hashString(`${seedBase}:USG`), 18, 32),
    stl:
      Number.isFinite(stealsRate) && stealsRate >= 0
        ? Math.min(0.12, Math.max(0.0, stealsRate))
        : seededRange(hashString(`${seedBase}:STL`), 0.01, 0.045),
    blk:
      Number.isFinite(blocksRate) && blocksRate >= 0
        ? Math.min(0.12, Math.max(0.0, blocksRate))
        : seededRange(hashString(`${seedBase}:BLK`), 0.005, 0.045),
    paceZ: Number.isFinite(paceZ) ? paceZ : seededRange(hashString(`${seedBase}:PACE`), -1, 1),
    impact: Number.isFinite(impactScore) ? impactScore : seededRange(baseHash, 3, 11),
    archetypes: parseArchetype(profile.archetype).map((tag) => tag as Player["archetypes"][number]),
  };

  if (!player.archetypes.length) {
    player.archetypes = inferArchetypes(player);
  }

  return player;
}

function deriveEra(span: string | null | undefined): string | null {
  if (!span) {
    return null;
  }
  const matches = span.match(/\d{4}/g);
  if (!matches || !matches.length) {
    return null;
  }
  const start = Number.parseInt(matches[0], 10);
  const end = Number.parseInt(matches[matches.length - 1], 10);
  if (!Number.isFinite(start)) {
    return null;
  }
  const startDecade = Math.floor(start / 10) * 10;
  const endDecade = Number.isFinite(end) ? Math.floor(end / 10) * 10 : startDecade;
  if (startDecade === endDecade) {
    return `${startDecade}s`;
  }
  return `${startDecade}s–${endDecade}s`;
}

function createProfileKey(profile: Pick<RawProfile, "personId" | "id" | "name">): string {
  if (profile.personId !== undefined && profile.personId !== null) {
    return String(profile.personId);
  }
  if (profile.id !== undefined && profile.id !== null) {
    return String(profile.id);
  }
  const normalized = normalizeName(profile.name);
  return normalized ?? profile.name.toLowerCase();
}

function enrichFromGoat(record: GoatRecord): RawProfile | null {
  if (!record || !record.name) {
    return null;
  }
  const franchises = Array.isArray(record.franchises) ? record.franchises : [];
  return {
    id: record.personId ?? record.name,
    personId: record.personId,
    name: record.name,
    era: deriveEra(record.primeWindow ?? record.careerSpan ?? null),
    team: franchises.length ? franchises[0] ?? null : null,
    teamAbbr: franchises.length ? franchises[0] ?? null : null,
    position: null,
    archetype: null,
    goatImpact: record.goatComponents?.impact ?? null,
  };
}

async function fetchProfiles(): Promise<Player[]> {
  const [profilesResponse, goatResponse, careerResponse, indexResponse] = await Promise.all([
    fetch(new URL("data/player_profiles.json", document.baseURI)),
    fetch(new URL("data/goat_system.json", document.baseURI)).catch(() => null),
    fetch(new URL("data/history/player_careers.json", document.baseURI)).catch(() => null),
    fetch(new URL("data/history/players.index.json", document.baseURI)).catch(() => null),
  ]);

  if (!profilesResponse.ok) {
    throw new Error(`Failed to load player profiles: ${profilesResponse.status}`);
  }

  const [json, careerJson, indexJson] = await Promise.all([
    profilesResponse.json(),
    careerResponse && careerResponse.ok ? careerResponse.json() : Promise.resolve(null),
    indexResponse && indexResponse.ok ? indexResponse.json() : Promise.resolve(null),
  ]);

  const context = (() => {
    const base = toCareerMap(careerJson as CareerDataset | null);
    const indexData = indexJson as { players?: PlayerIndexEntry[] | null } | null;
    if (Array.isArray(indexData?.players)) {
      indexData.players.forEach((entry) => {
        const normalized = normalizeName(entry.full_name ?? `${entry.first_name ?? ""} ${entry.last_name ?? ""}`);
        if (!normalized) {
          return;
        }
        if (entry.id !== null && entry.id !== undefined) {
          base.nameToCareerId.set(normalized, String(entry.id));
        }
      });
    }
    return base;
  })();

  const playerRecords = new Map<string, RawProfile>();

  const pushProfile = (profile: RawProfile | null | undefined) => {
    if (!profile || !profile.name) {
      return;
    }
    const key = createProfileKey(profile);
    if (playerRecords.has(key)) {
      const existing = playerRecords.get(key)!;
      if ((!existing.era || existing.era === "") && profile.era) {
        existing.era = profile.era;
      }
      if ((!existing.team || existing.team === "") && profile.team) {
        existing.team = profile.team;
      }
      if ((!existing.teamAbbr || existing.teamAbbr === "") && profile.teamAbbr) {
        existing.teamAbbr = profile.teamAbbr;
      }
      if ((!existing.position || existing.position === "") && profile.position) {
        existing.position = profile.position;
      }
      if ((!existing.archetype || existing.archetype === "") && profile.archetype) {
        existing.archetype = profile.archetype;
      }
      if ((!existing.bdl || !existing.bdl.id) && profile.bdl?.id) {
        existing.bdl = { ...(existing.bdl ?? {}), id: profile.bdl.id };
      }
      if ((existing.goatImpact === null || existing.goatImpact === undefined) && profile.goatImpact !== null && profile.goatImpact !== undefined) {
        existing.goatImpact = profile.goatImpact;
      }
      return;
    }
    playerRecords.set(key, { ...profile });
  };

  const profiles = Array.isArray(json?.players) ? json.players : [];
  profiles.forEach((profile: RawProfile) => pushProfile(profile));

  if (goatResponse && goatResponse.ok) {
    try {
      const goatJson = await goatResponse.json();
      const goatPlayers = Array.isArray(goatJson?.players) ? goatJson.players : [];
      goatPlayers.forEach((record: GoatRecord) => {
        const enriched = enrichFromGoat(record);
        if (enriched) {
          pushProfile(enriched);
        }
      });
    } catch (goatError) {
      console.warn("Unable to load GOAT system player pool", goatError);
    }
  }

  const merged = Array.from(playerRecords.values()).map((profile) => enrichProfile(profile, context));
  merged.sort((a, b) => a.name.localeCompare(b.name));
  return merged;
}

const DEFAULT_PRESETS: Record<string, string[]> = {
  "96Bulls": ["michael-jordan", "scottie-pippen", "dennis-rodman", "ron-harper", "steve-kerr"],
  "17Warriors": ["stephen-curry", "kevin-durant", "klay-thompson", "draymond-green", "andre-iguodala"],
};

type SetupOptions = {
  trigger?: HTMLElement;
  root: HTMLElement;
  mode?: "overlay" | "inline";
};

export async function mountRosterRumble({ trigger, root, mode = "overlay" }: SetupOptions): Promise<RumbleExperience> {
  const initialState = readHash();
  const experience = await createRumbleExperience({
    root,
    getPlayerPool: fetchProfiles,
    presets: DEFAULT_PRESETS,
    mode,
  });

  if (initialState) {
    experience.open(initialState);
  }

  if (trigger) {
    trigger.addEventListener("click", () => {
      experience.open();
    });
  }

  return experience;
}

export { decodeMatchup, readHash };
export type { Player };
