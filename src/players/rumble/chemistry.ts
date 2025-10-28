import type {
  Archetype,
  ChemistryEdge,
  MatchupAdjustment,
  Player,
  TeamChemistry,
} from "./types";
import { ERA_PRESETS, eraStyleDistance, inferPlayerEraStyle, type EraPreset, type EraStyle } from "./era";
import { inferArchetypes } from "./archetypes";

const MAX_POSITIVE_SYNERGIES = 4;

function hasArchetype(player: Player, target: Archetype): boolean {
  return player.archetypes.includes(target);
}

function ensureArchetypes(player: Player): void {
  if (!player.archetypes.length) {
    player.archetypes = inferArchetypes(player);
  }
}

function isPlaymaker(player: Player): boolean {
  return (
    hasArchetype(player, "Creator") ||
    hasArchetype(player, "Secondary") ||
    player.astPct >= 22
  );
}

function isConnector(player: Player): boolean {
  return hasArchetype(player, "Connector") || player.astPct >= 16 || player.impact >= 8;
}

function hasSpacingThreat(player: Player): boolean {
  return (
    hasArchetype(player, "Off-ball Shooter") ||
    hasArchetype(player, "Stretch Big") ||
    (Number.isFinite(player.threeP) && player.threeP >= 0.365 && player.threePA_rate >= 0.3)
  );
}

function isInteriorAnchor(player: Player): boolean {
  return (
    hasArchetype(player, "Rim Runner") ||
    hasArchetype(player, "Stretch Big") ||
    hasArchetype(player, "Switch Big") ||
    hasArchetype(player, "Rim Protector")
  );
}

function describeEdge(a: Player, b: Player, delta: number, reasons: string[]): ChemistryEdge | null {
  if (!Number.isFinite(delta) || delta === 0) {
    return null;
  }
  return {
    source: a.id,
    target: b.id,
    weight: delta,
    reasons,
  };
}

export function buildChemistry(players: Player[], eraStyle: EraStyle = "current"): TeamChemistry {
  const entries = players.filter(Boolean);
  entries.forEach(ensureArchetypes);

  const edges: ChemistryEdge[] = [];
  let scoreDelta = 0;
  const reasonAccumulator = new Map<string, number>();
  const preset = ERA_PRESETS[eraStyle];

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      const adjustments: Array<{ value: number; reason: string; order: number }> = [];
      const addAdjustment = (value: number, reason: string) => {
        if (!Number.isFinite(value) || value === 0) {
          return;
        }
        adjustments.push({ value, reason, order: adjustments.length });
      };

      const playmakerA = isPlaymaker(a);
      const playmakerB = isPlaymaker(b);
      const connectorA = isConnector(a);
      const connectorB = isConnector(b);
      const interiorA = isInteriorAnchor(a);
      const interiorB = isInteriorAnchor(b);
      const spacingA = hasSpacingThreat(a);
      const spacingB = hasSpacingThreat(b);
      const poaA = hasArchetype(a, "POA Stopper");
      const poaB = hasArchetype(b, "POA Stopper");
      const rimAnchorA = hasArchetype(a, "Rim Protector") || hasArchetype(a, "Switch Big");
      const rimAnchorB = hasArchetype(b, "Rim Protector") || hasArchetype(b, "Switch Big");
      const eraA = inferPlayerEraStyle(a);
      const eraB = inferPlayerEraStyle(b);

      const paceGap = Math.abs(a.paceZ - b.paceZ);
      if (paceGap < 0.5) {
        addAdjustment(2, "pace fit");
      }

      const creatorShooter =
        (hasArchetype(a, "Creator") || hasArchetype(a, "Secondary")) &&
        (hasArchetype(b, "Off-ball Shooter") || hasArchetype(b, "Stretch Big"));
      const shooterCreator =
        (hasArchetype(b, "Creator") || hasArchetype(b, "Secondary")) &&
        (hasArchetype(a, "Off-ball Shooter") || hasArchetype(a, "Stretch Big"));
      if (creatorShooter || shooterCreator) {
        addAdjustment(3 * preset.threeFactor, "creator → shooter");
      }

      if (a.threePA_rate > 0.5 && b.threePA_rate > 0.5) {
        addAdjustment(2 * preset.spacingBonus, "spacing stack");
      }

      if (a.usg > 28 && b.usg > 28 && a.astPct < 18 && b.astPct < 18) {
        addAdjustment(-5, "usage redundancy");
      }

      if ((interiorA && playmakerB) || (interiorB && playmakerA)) {
        addAdjustment(2 + preset.postBoost * 0.6, "inside-out game");
      }

      const hiLoEligible = preset.postBoost >= 2 && interiorA && interiorB && (connectorA || connectorB || spacingA || spacingB);
      if (hiLoEligible) {
        addAdjustment(1 + preset.postBoost * 0.5, "hi-lo threats");
      }

      if (
        (connectorA && (playmakerB || interiorB || spacingB)) ||
        (connectorB && (playmakerA || interiorA || spacingA))
      ) {
        addAdjustment(1.8 + preset.spacingBonus * 1.2 + preset.postBoost * 0.1, "connector boost");
      }

      if ((poaA && rimAnchorB) || (poaB && rimAnchorA)) {
        addAdjustment(1.5 + preset.handcheck * 0.75, "defensive spine");
      }

      if (a.franchise && a.franchise === b.franchise) {
        addAdjustment(1.2 + preset.postBoost * 0.2, "franchise familiarity");
      }

      if (eraA && eraB) {
        if (eraA === eraB) {
          const familiarityBonus = 1.6 + preset.handcheck * 0.4 + preset.postBoost * 0.2;
          addAdjustment(familiarityBonus, "shared era rhythm");
        } else {
          const eraGap = eraStyleDistance(eraA, eraB);
          if (eraGap >= 2) {
            addAdjustment(-eraGap * (1 + preset.handcheck * 0.2), "era clash");
          }
        }
      }

      if (preset.threeFactor <= 0.3) {
        const eliteDuo = a.impact >= 8.5 && b.impact >= 8.5;
        const balancedUsage =
          (a.usg <= 0.34 || b.astPct >= 0.2 || connectorB) && (b.usg <= 0.34 || a.astPct >= 0.2 || connectorA);
        if (eliteDuo && balancedUsage) {
          addAdjustment(2 + preset.postBoost * 0.2, "all-time duo versatility");
        }
      }

      const defensiveGap =
        !hasArchetype(a, "POA Stopper") &&
        !hasArchetype(a, "Rim Protector") &&
        !hasArchetype(b, "POA Stopper") &&
        !hasArchetype(b, "Rim Protector");
      if (defensiveGap) {
        addAdjustment(-6, "defensive gaps");
      }

      if (adjustments.length) {
        const positive = adjustments
          .filter((entry) => entry.value > 0)
          .sort((a, b) => {
            const diff = Math.abs(b.value) - Math.abs(a.value);
            if (diff !== 0) {
              return diff;
            }
            return a.order - b.order;
          })
          .slice(0, MAX_POSITIVE_SYNERGIES);
        const allowedPositiveOrders = new Set(positive.map((entry) => entry.order));
        const filtered = adjustments.filter(
          (entry) => entry.value <= 0 || allowedPositiveOrders.has(entry.order)
        );

        const delta = filtered.reduce((sum, entry) => sum + entry.value, 0);
        if (delta !== 0) {
          scoreDelta += delta;
          filtered.forEach((entry) => {
            const weight = reasonAccumulator.get(entry.reason) ?? 0;
            reasonAccumulator.set(entry.reason, weight + entry.value);
          });
          const edge = describeEdge(
            a,
            b,
            delta,
            filtered.map((entry) => entry.reason)
          );
          if (edge) {
            edges.push(edge);
          }
        }
      }
    }
  }

  const baseScore = Math.max(0, 100 + scoreDelta);
  const sortedReasons = Array.from(reasonAccumulator.entries())
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 6)
    .map(([reason, weight]) => `${reason} (${weight > 0 ? "+" : ""}${weight.toFixed(1)})`);

  return {
    score: baseScore,
    edges,
    reasons: sortedReasons,
  };
}

interface SlotComparison {
  advantage: number;
  reasons: string[];
}

function compareSlot(attacker: Player, defender: Player, preset: EraPreset): SlotComparison {
  ensureArchetypes(attacker);
  ensureArchetypes(defender);

  let advantage = 0;
  const reasons: string[] = [];

  if (hasArchetype(attacker, "POA Stopper") && hasArchetype(defender, "Creator")) {
    advantage += 3 + preset.handcheck;
    reasons.push("POA vs Creator");
  }

  if (hasArchetype(attacker, "Rim Protector") && hasArchetype(defender, "Rim Runner")) {
    advantage += 2 + preset.postBoost * 0.3;
    reasons.push("Rim protection");
  }

  if (hasArchetype(attacker, "Off-ball Shooter") && !hasArchetype(defender, "Switch Big")) {
    advantage += 2 * preset.threeFactor;
    reasons.push("Spacing advantage");
  }

  return { advantage, reasons };
}

export function evaluateMatchup(teamA: Player[], teamB: Player[], eraStyle: EraStyle = "current"): MatchupAdjustment {
  const limit = Math.min(teamA.length, teamB.length);
  let advantageA = 0;
  let advantageB = 0;
  const reasonsA: string[] = [];
  const reasonsB: string[] = [];
  const preset = ERA_PRESETS[eraStyle];

  for (let i = 0; i < limit; i += 1) {
    const playerA = teamA[i];
    const playerB = teamB[i];
    if (!playerA || !playerB) {
      // ignore empty slots
      continue;
    }
    const forward = compareSlot(playerA, playerB, preset);
    if (forward.advantage !== 0) {
      advantageA += forward.advantage;
      reasonsA.push(`${playerA.name}: ${forward.reasons.join(", ")}`);
    }
    const reverse = compareSlot(playerB, playerA, preset);
    if (reverse.advantage !== 0) {
      advantageB += reverse.advantage;
      reasonsB.push(`${playerB.name}: ${reverse.reasons.join(", ")}`);
    }
  }

  return {
    advantageA,
    advantageB,
    reasonsA,
    reasonsB,
  };
}
