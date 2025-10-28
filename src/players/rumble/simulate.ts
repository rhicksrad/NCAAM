import type { Player, SimResult } from "./types";
import { buildChemistry, evaluateMatchup } from "./chemistry";
import {
  ERA_PRESETS,
  ERA_STYLE_ORDER,
  inferPlayerEraStyle,
  isEraStyle,
  type EraPreset,
  type EraStyle,
} from "./era";

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

type ArchetypeTraitProfile = {
  spacing?: number;
  three?: number;
  pace?: number;
  switching?: number;
  handle?: number;
  post?: number;
  rebound?: number;
  physicality?: number;
};

const ARCHETYPE_TRAITS: Record<Player["archetypes"][number], ArchetypeTraitProfile> = {
  Creator: { handle: 1, spacing: 0.2, pace: 0.35 },
  Secondary: { handle: 0.7, spacing: 0.35 },
  "Off-ball Shooter": { spacing: 1, three: 1 },
  "Rim Runner": { pace: 0.8, post: 0.35, rebound: 0.4 },
  "Stretch Big": { spacing: 0.9, three: 0.9 },
  "Switch Big": { switching: 1, spacing: 0.3, pace: 0.25 },
  "POA Stopper": { physicality: 0.7 },
  "Rim Protector": { post: 0.8, rebound: 0.6, physicality: 0.3 },
  Connector: { spacing: 0.55, pace: 0.45 },
};

export interface SimulationOptions {
  games?: number;
  eraStyle?: EraStyle;
  eraNorm?: boolean;
  rng?: () => number;
}

function defaultRng(): number {
  return Math.random();
}

function gaussianNoise(rng: () => number): number {
  // Box-Muller transform
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = rng();
  }
  while (v === 0) {
    v = rng();
  }
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function averageImpact(players: Player[]): number {
  if (!players.length) {
    return 0;
  }
  return players.reduce((sum, player) => sum + player.impact, 0) / players.length;
}

function normalizeEraStyle(options: Pick<SimulationOptions, "eraStyle" | "eraNorm">): EraStyle {
  if (isEraStyle(options.eraStyle)) {
    return options.eraStyle;
  }
  if (typeof options.eraNorm === "boolean") {
    return options.eraNorm ? "nineties" : "current";
  }
  return "current";
}

export function simulateSeries(
  teamA: Player[],
  teamB: Player[],
  optionsOrGames?: SimulationOptions | number,
  legacyEra?: EraStyle | boolean
): SimResult {
  let options: SimulationOptions;
  if (typeof optionsOrGames === "number") {
    options = { games: optionsOrGames };
    if (typeof legacyEra === "boolean") {
      options.eraNorm = legacyEra;
    } else if (isEraStyle(legacyEra)) {
      options.eraStyle = legacyEra;
    }
  } else {
    options = { ...(optionsOrGames ?? {}) };
  }

  const games = Number.isFinite(options.games) && options.games ? Math.max(1, Math.floor(options.games)) : 100;
  const rng = options.rng ?? defaultRng;
  const eraStyle = normalizeEraStyle(options);
  const preset = ERA_PRESETS[eraStyle] ?? ERA_PRESETS.current;
  const chemistryA = buildChemistry(teamA, eraStyle);
  const chemistryB = buildChemistry(teamB, eraStyle);
  const matchup = evaluateMatchup(teamA, teamB, eraStyle);

  const baseStrengthA = teamStrength(teamA, teamB, chemistryA.score, matchup.advantageA, preset, eraStyle);
  const baseStrengthB = teamStrength(teamB, teamA, chemistryB.score, matchup.advantageB, preset, eraStyle);

  const margins: number[] = [];
  let totalScoreA = 0;
  let totalScoreB = 0;
  let teamAWins = 0;
  let teamBWins = 0;

  const possScale = preset.poss / 100;

  for (let i = 0; i < games; i += 1) {
    const noiseA = gaussianNoise(rng) * 4 * preset.variance;
    const noiseB = gaussianNoise(rng) * 4 * preset.variance;
    const baseScoreA = 100 * possScale + (baseStrengthA / 2) * possScale;
    const baseScoreB = 100 * possScale + (baseStrengthB / 2) * possScale;
    const scoreA = baseScoreA + noiseA;
    const scoreB = baseScoreB + noiseB;
    const margin = scoreA - scoreB;
    if (margin >= 0) {
      teamAWins += 1;
    } else {
      teamBWins += 1;
    }
    totalScoreA += scoreA;
    totalScoreB += scoreB;
    margins.push(margin);
  }

  return {
    teamAWins,
    teamBWins,
    avgScoreA: margins.length ? totalScoreA / margins.length : 0,
    avgScoreB: margins.length ? totalScoreB / margins.length : 0,
    margins,
  };
}

function averagePace(players: Player[]): number {
  if (!players.length) {
    return 0;
  }
  return players.reduce((sum, player) => sum + player.paceZ, 0) / players.length;
}

function countArchetype(players: Player[], archetype: Player["archetypes"][number]): number {
  return players.filter((player) => player.archetypes.includes(archetype)).length;
}

function countShooters(players: Player[]): number {
  return players.filter((player) =>
    player.archetypes.includes("Off-ball Shooter") ||
    player.archetypes.includes("Stretch Big") ||
    (Number.isFinite(player.threeP) && player.threeP >= 0.365 && player.threePA_rate >= 0.35)
  ).length;
}

function isInterior(player: Player): boolean {
  const pos = player.pos?.toUpperCase() ?? "";
  if (pos.includes("C")) return true;
  if (pos.includes("F")) return true;
  return player.archetypes.some((tag) =>
    tag === "Rim Runner" || tag === "Stretch Big" || tag === "Switch Big" || tag === "Rim Protector"
  );
}

function countInterior(players: Player[]): number {
  return players.filter((player) => isInterior(player)).length;
}

function countGuardCreators(players: Player[]): number {
  return players.filter((player) => {
    const pos = player.pos?.toUpperCase() ?? "";
    const isGuard = pos.includes("G");
    return isGuard && player.archetypes.includes("Creator");
  }).length;
}

function teamStrength(
  team: Player[],
  opponent: Player[],
  chemistryScore: number,
  matchupAdvantage: number,
  preset: EraPreset,
  eraStyle: EraStyle
): number {
  if (!team.length) {
    return 0;
  }

  const chemistryDelta = chemistryScore - 100;
  const impact = averageImpact(team) * 6;
  const pace = averagePace(team) * 4;
  const matchupBonus = matchupAdvantage * (2 + preset.handcheck * 0.25);

  const shooters = countShooters(team);
  const opponentShooters = countShooters(opponent);
  const spacingBonus = shooters * 4 * preset.threeFactor;
  const shooterDiffBonus = (shooters - opponentShooters) * 2.5 * preset.threeFactor;

  const interiorCount = countInterior(team);
  const postBonus = interiorCount * preset.postBoost;
  const orbBonus = interiorCount * Math.max(0, (preset.orb - 1) * 6);

  const poaStoppers = countArchetype(team, "POA Stopper");
  const guardCreators = countGuardCreators(team);
  const handcheckBonus = preset.handcheck * (poaStoppers * 1.5 - guardCreators);

  const eraComfort = calculateEraAdjustment(team, eraStyle, preset);
  const spacingMismatchPenalty = calculateSpacingMismatchPenalty(team, preset);

  const rawStrength =
    chemistryDelta +
    impact +
    pace +
    matchupBonus +
    spacingBonus +
    shooterDiffBonus +
    postBonus +
    orbBonus +
    handcheckBonus +
    eraComfort +
    spacingMismatchPenalty;

  return normalizeStrength(rawStrength);
}

function calculateEraAdjustment(team: Player[], eraStyle: EraStyle, preset: EraPreset): number {
  let counted = 0;
  let comfortSum = 0;
  const eraCounts = new Map<EraStyle, number>();
  const eraIndex = ERA_STYLE_ORDER.indexOf(eraStyle);

  team.forEach((player) => {
    const playerEra = inferPlayerEraStyle(player);
    if (!playerEra) {
      return;
    }
    counted += 1;
    eraCounts.set(playerEra, (eraCounts.get(playerEra) ?? 0) + 1);
    const playerIndex = ERA_STYLE_ORDER.indexOf(playerEra);
    const diff = eraIndex - playerIndex;
    let contribution: number;
    if (diff === 0) {
      contribution = 6 + preset.handcheck * 0.5 + preset.postBoost * 0.2;
    } else if (diff > 0) {
      contribution = 4 + diff * 1.25 + preset.handcheck * 0.25;
    } else {
      contribution = diff * 0.75;
    }
    comfortSum += contribution;
  });

  if (counted === 0) {
    return 0;
  }

  const averageComfort = comfortSum / counted;
  const matchingCount = eraCounts.get(eraStyle) ?? 0;
  const matchingShare = matchingCount / counted;
  const matchBonus = matchingShare > 0 ? Math.max(0, (matchingShare - 0.35) * 8) : 0;

  const dominantCount = eraCounts.size ? Math.max(...Array.from(eraCounts.values())) : 0;
  const cohesionBonus = dominantCount > 0 ? Math.max(0, (dominantCount / counted - 0.5) * 5) : 0;

  const archetypeAdjustment = calculateArchetypeEraPenalty(team, preset);

  return averageComfort + matchBonus + cohesionBonus + archetypeAdjustment;
}

function normalizeStrength(value: number): number {
  if (value === 0) {
    return 0;
  }
  return Math.tanh(value / 45) * 45;
}

function calculateSpacingMismatchPenalty(team: Player[], preset: EraPreset): number {
  if (preset.threeFactor >= 0.6) {
    return 0;
  }

  const relianceAllowance = 0.12 + preset.spacingBonus * 0.15 + preset.threeFactor * 0.2;
  const severityScale =
    (1 - clamp(preset.threeFactor, 0, 1)) * (1.6 + preset.handcheck * 0.3 + preset.postBoost * 0.25);

  if (severityScale <= 0) {
    return 0;
  }

  let penalty = 0;
  team.forEach((player) => {
    const rate = clamp01(player.threePA_rate);
    if (rate <= relianceAllowance) {
      return;
    }

    let reliance = rate - relianceAllowance;
    if (rate >= 0.45 && preset.threeFactor === 0) {
      reliance += (rate - 0.45) * 0.75;
    }

    const archetypeBoost = player.archetypes.some(
      (tag) => tag === "Off-ball Shooter" || tag === "Stretch Big"
    )
      ? 1.4
      : player.archetypes.some((tag) => tag === "Creator" || tag === "Secondary")
        ? 1.1
        : 1;

    penalty += reliance * archetypeBoost;
  });

  if (penalty === 0) {
    return 0;
  }

  const scale = 8 + severityScale * 2.5;
  return -penalty * scale;
}

function calculateArchetypeEraPenalty(team: Player[], preset: EraPreset): number {
  if (!team.length) {
    return 0;
  }

  const spacingValue = clamp(preset.spacingBonus, 0, 1);
  const threeValue = clamp(preset.threeFactor, 0, 1);
  const paceValue = clamp(preset.poss / 100, 0, 1);
  const handcheckValue = clamp(preset.handcheck / 3, 0, 1);
  const postValue = clamp(preset.postBoost / 5, 0, 1);
  const reboundValue = clamp((preset.orb - 1) / 0.2, 0, 1);

  const spacingPenalty = 1 - spacingValue;
  const threePenalty = 1 - threeValue;
  const pacePenalty = 1 - paceValue;
  const switchingPenalty = clamp(spacingPenalty * 0.8 + threePenalty * 0.2, 0, 1);

  let total = 0;

  team.forEach((player) => {
    player.archetypes.forEach((tag) => {
      const traits = ARCHETYPE_TRAITS[tag];
      if (!traits) {
        return;
      }

      if (traits.spacing) {
        total -= traits.spacing * spacingPenalty * 5;
      }
      if (traits.three) {
        total -= traits.three * threePenalty * 6;
      }
      if (traits.pace) {
        total -= traits.pace * pacePenalty * 3.5;
      }
      if (traits.switching) {
        total -= traits.switching * switchingPenalty * 3;
      }
      if (traits.handle) {
        total -= traits.handle * handcheckValue * 2.5;
      }
      if (traits.post) {
        total += traits.post * postValue * 3;
      }
      if (traits.rebound) {
        total += traits.rebound * reboundValue * 3;
      }
      if (traits.physicality) {
        total += traits.physicality * handcheckValue * 2;
      }
    });
  });

  return total;
}
