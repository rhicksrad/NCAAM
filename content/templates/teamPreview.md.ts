import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  LeagueContext,
  PlayerRecord,
  PlayerScoringAverage,
  PlayerScoringDataset,
  PlayerScoringIndex,
  TeamRecord,
} from "../../scripts/lib/types.js";

export interface TeamPreviewContent {
  heading: string;
  introParagraphs: string[];
  returningCore: string[];
  returningCoreDescriptors: string[];
  coreStrength: string;
  primaryRisk: string;
  swingFactor: string;
  seasonLabel: string;
}

const RISK_WORDS: Record<"low" | "medium" | "high", string> = {
  low: "low",
  medium: "medium",
  high: "elevated",
};

const TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const SCORING_PATH = path.join(TEMPLATE_ROOT, "data/2025-26/canonical/player_scoring_averages.json");

let FALLBACK_SCORING: PlayerScoringIndex | null = null;

function loadFallbackScoring(): PlayerScoringIndex {
  if (FALLBACK_SCORING) {
    return FALLBACK_SCORING;
  }
  try {
    const raw = readFileSync(SCORING_PATH, "utf8");
    const payload = JSON.parse(raw) as PlayerScoringDataset;
    const index: PlayerScoringIndex = { byId: {}, byName: {} };
    const players = Array.isArray(payload?.players) ? payload.players : [];
    for (const entry of players) {
      const playerId = typeof entry?.playerId === "string" ? entry.playerId.trim() : "";
      if (!playerId) {
        continue;
      }
      const record: PlayerScoringAverage = {
        playerId,
        pointsPerGame: typeof entry.pointsPerGame === "number" && Number.isFinite(entry.pointsPerGame)
          ? entry.pointsPerGame
          : 0,
        gamesPlayed: typeof entry.gamesPlayed === "number" && Number.isFinite(entry.gamesPlayed)
          ? Math.max(0, Math.round(entry.gamesPlayed))
          : 0,
        name: entry.name ?? null,
        firstName: entry.firstName ?? null,
        lastName: entry.lastName ?? null,
      };
      index.byId[playerId] = record;
      const nameKeys = new Set<string>();
      const combined = record.name ?? `${record.firstName ?? ""} ${record.lastName ?? ""}`;
      nameKeys.add(normalizeNameKey(combined));
      nameKeys.add(normalizeNameKey(`${record.lastName ?? ""} ${record.firstName ?? ""}`));
      for (const key of nameKeys) {
        if (!key) {
          continue;
        }
        const existing = index.byName[key];
        if (!existing || record.pointsPerGame > existing.pointsPerGame) {
          index.byName[key] = record;
        }
      }
    }
    FALLBACK_SCORING = index;
  } catch (error) {
    console.warn("Unable to load fallback scoring averages.", error);
    FALLBACK_SCORING = { byId: {}, byName: {} };
  }
  return FALLBACK_SCORING;
}

type PositionBucket = "guard" | "wing" | "big" | "flex";

interface RosterBuckets {
  guards: PlayerRecord[];
  wings: PlayerRecord[];
  bigs: PlayerRecord[];
  flex: PlayerRecord[];
}

interface AnchorPiece {
  descriptor: string;
  playerName: string | null;
}

interface AnchorSummary {
  summary: string;
  descriptors: string[];
  players: string[];
}

function formatList(values: string[]): string {
  if (values.length === 0) {
    return "";
  }
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function normalizedRoster(team: TeamRecord): TeamRecord["roster"] {
  const roster = team.roster ?? [];
  if (roster.length === 0) {
    return roster;
  }
  const filtered = roster.filter((player) => {
    if (!player.teamTricode) {
      return true;
    }
    return player.teamTricode === team.tricode;
  });
  return filtered.length > 0 ? filtered : roster;
}

function classifyPosition(positionRaw?: string): PositionBucket {
  const position = positionRaw?.toUpperCase() ?? "";
  const isGuard = position.includes("G");
  const isForward = position.includes("F");
  const isCenter = position.includes("C");
  if (isGuard && !isForward && !isCenter) {
    return "guard";
  }
  if (isCenter && !isForward && !isGuard) {
    return "big";
  }
  if (isForward && !isCenter && !isGuard) {
    return "wing";
  }
  if (isForward && isCenter) {
    return "big";
  }
  if (isForward || (isGuard && isForward)) {
    return "wing";
  }
  if (isGuard) {
    return "guard";
  }
  return "flex";
}

function bucketRoster(team: TeamRecord): RosterBuckets {
  const buckets: RosterBuckets = { guards: [], wings: [], bigs: [], flex: [] };
  for (const player of normalizedRoster(team)) {
    const bucket = classifyPosition(player.position);
    switch (bucket) {
      case "guard":
        buckets.guards.push(player);
        break;
      case "wing":
        buckets.wings.push(player);
        break;
      case "big":
        buckets.bigs.push(player);
        break;
      default:
        buckets.flex.push(player);
        break;
    }
  }
  return buckets;
}

function buildDuplicateNameSet(players: PlayerRecord[]): Set<string> {
  const counts = new Map<string, number>();
  for (const player of players) {
    if (!player.name) continue;
    counts.set(player.name, (counts.get(player.name) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
}

function normalizeNameKey(value?: string | null): string {
  if (!value) {
    return "";
  }
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function scoringRecordForPlayer(player: PlayerRecord, scoring: PlayerScoringIndex): PlayerScoringAverage | undefined {
  const id = player.playerId?.trim();
  if (id && scoring.byId[id]) {
    return scoring.byId[id];
  }
  const candidateKeys = new Set<string>();
  candidateKeys.add(normalizeNameKey(player.name));
  candidateKeys.add(normalizeNameKey(`${player.firstName ?? ""} ${player.lastName ?? ""}`));
  candidateKeys.add(normalizeNameKey(`${player.lastName ?? ""} ${player.firstName ?? ""}`));
  for (const key of candidateKeys) {
    if (!key) {
      continue;
    }
    const record = scoring.byName[key];
    if (record) {
      return record;
    }
  }
  return undefined;
}

function pickPrimaryPlayer(players: PlayerRecord[], duplicates: Set<string>): PlayerRecord | undefined {
  for (const player of players) {
    if (player.name && !duplicates.has(player.name)) {
      return player;
    }
  }
  return players[0];
}

function buildScoringAnchorPieces(team: TeamRecord, ctx: LeagueContext): AnchorPiece[] {
  const roster = normalizedRoster(team);
  if (roster.length === 0) {
    return [];
  }
  const scoring = ctx.playerScoring ?? loadFallbackScoring();
  const enriched = roster.map((player, index) => {
    const record = scoringRecordForPlayer(player, scoring);
    const points = record?.pointsPerGame ?? 0;
    const games = record?.gamesPlayed ?? 0;
    return { player, points, games, index };
  });
  const sorted = [...enriched].sort((a, b) => {
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    if (b.games !== a.games) {
      return b.games - a.games;
    }
    return a.index - b.index;
  });
  const withStats = sorted.filter((entry) => entry.points > 0 || entry.games > 0);
  const queue = [...withStats];
  for (const entry of sorted) {
    if (!withStats.includes(entry)) {
      queue.push(entry);
    }
  }
  const targetCount = Math.min(3, roster.length);
  const seen = new Set<string>();
  const selected: typeof sorted = [];
  for (const entry of queue) {
    if (selected.length >= targetCount) {
      break;
    }
    const name = entry.player.name;
    if (!name) {
      continue;
    }
    const key = entry.player.playerId ?? name;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    selected.push(entry);
  }
  const pieces = selected
    .map((entry) => {
      const name = entry.player.name ?? null;
      if (!name) {
        return null;
      }
      const bucket = classifyPosition(entry.player.position);
      const label = bucket === "guard" ? "guard" : bucket === "wing" ? "wing" : bucket === "big" ? "big" : null;
      const descriptor = label ? `${label} ${name}` : name;
      return { descriptor, playerName: name } satisfies AnchorPiece;
    })
    .filter((value): value is AnchorPiece => Boolean(value));
  return pieces;
}

function buildFallbackAnchors(team: TeamRecord, duplicates: Set<string>): AnchorSummary {
  const buckets = bucketRoster(team);
  const pieces: AnchorPiece[] = [];
  const guard = pickPrimaryPlayer(buckets.guards, duplicates);
  const wing = pickPrimaryPlayer(buckets.wings, duplicates);
  const big = pickPrimaryPlayer(buckets.bigs, duplicates);
  if (guard) {
    pieces.push({ descriptor: `guard ${guard.name}`, playerName: guard.name ?? null });
  }
  if (wing) {
    pieces.push({ descriptor: `wing ${wing.name}`, playerName: wing.name ?? null });
  }
  if (big) {
    pieces.push({ descriptor: `big ${big.name}`, playerName: big.name ?? null });
  }
  if (pieces.length === 0) {
    const roster = normalizedRoster(team);
    if (roster.length === 0) {
      return {
        summary: "The roster is still being finalized around training-camp invites.",
        descriptors: [],
        players: [],
      };
    }
    if (roster.length === 1) {
      const solo = roster[0].name ?? null;
      return {
        summary: `${solo ?? "A core piece"} is the first pillar for the staff to build around.`,
        descriptors: solo ? [solo] : [],
        players: solo ? [solo] : [],
      };
    }
    const fallbackNames = roster
      .map((player) => player.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 2);
    return {
      summary: `The staff is leaning on ${formatList(fallbackNames)} as table-setters.`,
      descriptors: fallbackNames,
      players: fallbackNames,
    };
  }
  const descriptors = pieces.map((piece) => piece.descriptor);
  const players = pieces
    .map((piece) => piece.playerName)
    .filter((name): name is string => Boolean(name));
  const anchorSummary = formatList(descriptors);
  return {
    summary: `${anchorSummary} headline the returning core.`,
    descriptors,
    players,
  };
}

function describeAnchors(team: TeamRecord, ctx: LeagueContext, duplicates: Set<string>): AnchorSummary {
  const scoringPieces = buildScoringAnchorPieces(team, ctx);
  if (scoringPieces.length > 0) {
    const descriptors = scoringPieces.map((piece) => piece.descriptor);
    const players = scoringPieces
      .map((piece) => piece.playerName)
      .filter((name): name is string => Boolean(name));
    return {
      summary: `${formatList(descriptors)} headline the returning core.`,
      descriptors,
      players,
    };
  }
  return buildFallbackAnchors(team, duplicates);
}

function formatWins(wins?: number): string | null {
  if (wins === undefined || wins === null || !Number.isFinite(wins)) {
    return null;
  }
  return `${wins}-win`;
}

function formatSrs(srs?: number): string | null {
  if (srs === undefined || srs === null || !Number.isFinite(srs)) {
    return null;
  }
  const rounded = Number(srs.toFixed(1));
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded} SRS`;
}

function seasonPerformanceParagraph(team: TeamRecord, anchor: AnchorSummary): string {
  const winsText = formatWins(team.lastSeasonWins);
  const srsText = formatSrs(team.lastSeasonSRS);
  const metrics = [winsText, srsText].filter(Boolean).join(" and ");
  const descriptor = (() => {
    const wins = team.lastSeasonWins ?? 0;
    if (!Number.isFinite(wins)) {
      return "evaluation";
    }
    if (wins >= 55) {
      return "title-or-bust";
    }
    if (wins >= 48) {
      return "upper-tier playoff";
    }
    if (wins >= 41) {
      return "playoff chase";
    }
    if (wins >= 32) {
      return "retooling";
    }
    return "development";
  })();
  const contextPart = metrics
    ? `fresh off a ${metrics} finish that sets a ${descriptor} tone`
    : `tracking a ${descriptor} approach after last season`;
  return `${team.market} enters camp ${contextPart}. ${anchor.summary}`;
}

function selectHighlightNames(
  players: PlayerRecord[],
  duplicates: Set<string>,
  limit: number
): string[] {
  const unique = players.filter((player) => player.name && !duplicates.has(player.name)).slice(0, limit);
  if (unique.length >= limit) {
    return unique.map((player) => player.name!);
  }
  const seen = new Set(unique.map((player) => player.name));
  const extras = players
    .filter((player) => player.name && !seen.has(player.name))
    .slice(0, limit - unique.length);
  return [...unique, ...extras].map((player) => player.name!).filter((name) => Boolean(name));
}

function rosterBalanceParagraph(team: TeamRecord, duplicates: Set<string>): string {
  const buckets = bucketRoster(team);
  const total = normalizedRoster(team).length;
  if (total === 0) {
    return "Roster spots remain open, so the front office will spend camp auditioning depth pieces.";
  }
  const counts: string[] = [];
  if (buckets.guards.length) {
    counts.push(`${buckets.guards.length} guard${buckets.guards.length === 1 ? "" : "s"}`);
  }
  if (buckets.wings.length) {
    counts.push(`${buckets.wings.length} wing/forward${buckets.wings.length === 1 ? "" : "s"}`);
  }
  if (buckets.bigs.length) {
    counts.push(`${buckets.bigs.length} center${buckets.bigs.length === 1 ? "" : "s"}`);
  }
  if (buckets.flex.length) {
    counts.push(`${buckets.flex.length} combo piece${buckets.flex.length === 1 ? "" : "s"}`);
  }
  const countLine = counts.length ? formatList(counts) : `${total} versatile contributors`;
  const highlightPieces: string[] = [];
  if (buckets.guards.length > 0) {
    const names = selectHighlightNames(buckets.guards, duplicates, 2);
    if (names.length > 0) {
      highlightPieces.push(`perimeter creation from ${formatList(names)}`);
    }
  }
  if (buckets.wings.length > 0) {
    const names = selectHighlightNames(buckets.wings, duplicates, 2);
    if (names.length > 0) {
      highlightPieces.push(`switchable wings such as ${formatList(names)}`);
    }
  }
  if (buckets.bigs.length > 0) {
    const names = selectHighlightNames(buckets.bigs, duplicates, 2);
    if (names.length > 0) {
      highlightPieces.push(`interior size via ${formatList(names)}`);
    }
  }
  if (buckets.flex.length > 0) {
    const names = selectHighlightNames(buckets.flex, duplicates, 2);
    if (names.length > 0) {
      highlightPieces.push(`hybrid depth from ${formatList(names)}`);
    }
  }
  const highlightLine = highlightPieces.length
    ? `with ${formatList(highlightPieces)} shaping the rotation battles.`
    : "and the staff will experiment with flexible role players to sort out the rotation.";
  return `The roster lists ${countLine}, ${highlightLine}`;
}

function campFocusParagraph(team: TeamRecord, ctx: LeagueContext, duplicates: Set<string>): string {
  const wins = team.lastSeasonWins ?? 0;
  const swing = swingFactor(team, duplicates);
  const focus = (() => {
    if (!Number.isFinite(wins) || wins <= 28) {
      return "building chemistry and developmental reps sits at the top of the agenda";
    }
    if (wins <= 40) {
      return "establishing a firmer identity on both ends becomes the focal point";
    }
    if (wins <= 50) {
      return "the staff will refine lineup versatility to climb the standings";
    }
    return "honing playoff-ready counters is the chief priority";
  })();
  const injuries = ctx.injuries.filter((injury) => {
    const rosterNames = new Set(normalizedRoster(team).map((player) => player.name));
    return rosterNames.has(injury.playerName);
  });
  if (injuries.length > 0) {
    const names = formatList(injuries.map((injury) => injury.playerName));
    return `With ${names} on the injury report, ${focus} while monitoring availability. ${swing}`;
  }
  return `From there, ${focus}. ${swing}`;
}

function summarizeAdditions(team: TeamRecord, duplicates: Set<string>): string {
  const rosterNames = new Set(normalizedRoster(team).map((player) => player.name));
  const additions = team.keyAdditions.filter((name) => rosterNames.has(name));
  if (additions.length === 0) {
    return rosterBalanceParagraph(team, duplicates);
  }
  return `${formatList(additions)} ${additions.length === 1 ? "joins" : "join"} the depth chart and reshapes the training-camp competitions.`;
}

function summarizeLosses(team: TeamRecord, ctx: LeagueContext, duplicates: Set<string>): string {
  const focusLine = campFocusParagraph(team, ctx, duplicates);
  if (team.keyLosses.length === 0) {
    return focusLine;
  }
  if (team.keyLosses.length === 1) {
    return `${team.keyLosses[0]} exited, putting more weight on camp priorities. ${focusLine}`;
  }
  if (team.keyLosses.length <= 3) {
    return `Multiple departures (${formatList(team.keyLosses)}) force creative solutions. ${focusLine}`;
  }
  return `Significant outgoing volume (${formatList(team.keyLosses)}) shapes every drill. ${focusLine}`;
}

function coreStrength(team: TeamRecord): string {
  const srs = team.lastSeasonSRS ?? 0;
  const wins = team.lastSeasonWins ?? 0;
  const buckets = bucketRoster(team);
  if (srs > 7 || wins >= 55) {
    return "An elite efficiency baseline powers everything—expect crisp pace-and-space principles to carry over.";
  }
  if (srs > 3 || wins >= 48) {
    return "A balanced attack with multiple creators keeps the nightly floor high and the ceiling real.";
  }
  if (buckets.bigs.length >= 3 && buckets.guards.length >= 3) {
    return "Depth across the positional spectrum lets the staff mix-and-match without sacrificing identity.";
  }
  if (buckets.guards.length >= buckets.wings.length + buckets.bigs.length) {
    return "Perimeter firepower is the strength—expect tempo and dribble creation to define the approach.";
  }
  if (srs > -1) {
    return "Familiar lineups and defined roles should keep the performance steady even as tweaks are tested.";
  }
  return "Growth upside is the selling point, with young pieces earning larger responsibilities.";
}

function primaryRisk(team: TeamRecord, ctx: LeagueContext): string {
  const buckets = bucketRoster(team);
  const injuries = ctx.injuries.filter((injury) => {
    const rosterNames = new Set(normalizedRoster(team).map((player) => player.name));
    return rosterNames.has(injury.playerName);
  });
  if (injuries.length > 0) {
    const severity = injuries.some((injury) => injury.severity === "high")
      ? "high"
      : injuries.some((injury) => injury.severity === "medium")
      ? "medium"
      : "low";
    return `Health is the loudest question mark with a ${RISK_WORDS[severity]}-grade injury stack to monitor.`;
  }
  if (buckets.bigs.length < 2) {
    return "Frontcourt depth is thin, so foul trouble or injuries inside could quickly snowball.";
  }
  if (buckets.guards.length < 3) {
    return "Ball-handling is light; any setback to the primary creators would stress the offense.";
  }
  if (team.keyAdditions.length > 4) {
    return "Integrating so many new faces could scramble the defensive communication early.";
  }
  if (team.keyLosses.length > team.keyAdditions.length + 2) {
    return "Replacing outgoing production without proven scorers is the immediate hurdle.";
  }
  return "The margin for error tightens if perimeter shooting variance swings the wrong way.";
}

function swingFactor(team: TeamRecord, duplicates: Set<string>): string {
  const buckets = bucketRoster(team);
  const roster = normalizedRoster(team);
  if (roster.length === 0) {
    return "Training camp is about establishing a rotation hierarchy from scratch.";
  }
  const guard = pickPrimaryPlayer(buckets.guards, duplicates);
  if (guard) {
    return `${guard.name}'s lead guard reps will determine how dynamic the offense looks.`;
  }
  const wing = pickPrimaryPlayer(buckets.wings, duplicates);
  if (wing) {
    return `${wing.name} unlocking downhill force on the wing is the X-factor.`;
  }
  const big = pickPrimaryPlayer(buckets.bigs, duplicates);
  if (big) {
    return `${big.name} anchoring the interior defense changes the trajectory of the season.`;
  }
  return `${roster[0].name} maintaining two-way consistency is the swing skill.`;
}

export function buildTeamPreviewContent(team: TeamRecord, ctx: LeagueContext): TeamPreviewContent {
  const duplicates = buildDuplicateNameSet(ctx.players);
  const anchors = describeAnchors(team, ctx, duplicates);
  return {
    heading: `${team.market} ${team.name}`,
    introParagraphs: [
      seasonPerformanceParagraph(team, anchors),
      summarizeAdditions(team, duplicates),
      summarizeLosses(team, ctx, duplicates),
    ],
    returningCore: anchors.players,
    returningCoreDescriptors: anchors.descriptors,
    coreStrength: coreStrength(team),
    primaryRisk: primaryRisk(team, ctx),
    swingFactor: swingFactor(team, duplicates),
    seasonLabel: ctx.season,
  };
}

export function renderTeamPreview(team: TeamRecord, ctx: LeagueContext): string {
  const content = buildTeamPreviewContent(team, ctx);
  const lines: string[] = [];
  lines.push(`# ${content.heading}`);
  lines.push("");
  lines.push(...content.introParagraphs);
  lines.push("");
  lines.push(`**Core strength:** ${content.coreStrength}`);
  lines.push(`**Primary risk:** ${content.primaryRisk}`);
  lines.push(`**Swing factor:** ${content.swingFactor}`);
  lines.push("");
  lines.push(`_Season: ${content.seasonLabel}_`);
  return lines.join("\n");
}
