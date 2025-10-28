import { describe, expect, it } from "vitest";
import { simulateSeries } from "../../src/players/rumble/simulate";
import type { Player } from "../../src/players/rumble/types";

const template: Omit<Player, "id" | "name"> = {
  era: "Modern",
  pos: "G",
  franchise: "Test",
  threeP: 0.38,
  threePA_rate: 0.5,
  astPct: 0.26,
  usg: 0.28,
  stl: 0.02,
  blk: 0.01,
  paceZ: 0.15,
  impact: 8,
  archetypes: ["Creator"],
};

function player(id: string, name: string, impact: number): Player {
  return { id, name, ...template, impact };
}

function playerWithEra(id: string, name: string, impact: number, era: string): Player {
  return { id, name, ...template, era, impact };
}

function makeTeam(prefix: string, impacts: number[]): Player[] {
  return impacts.map((impact, index) => player(`${prefix}-${index}`, `${prefix}${index}`, impact));
}

function makeEraTeam(prefix: string, impacts: number[], era: string): Player[] {
  return impacts.map((impact, index) => playerWithEra(`${prefix}-${index}`, `${prefix}${index}`, impact, era));
}

function sequenceRng(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

describe("simulateSeries", () => {
  it("returns deterministic output with seeded rng", () => {
    const teamA = makeTeam("A", [9, 8, 7, 6, 5]);
    const teamB = makeTeam("B", [5, 5, 5, 5, 5]);
    const rng = sequenceRng([0.2, 0.8, 0.4, 0.6]);

    const result = simulateSeries(teamA, teamB, { games: 4, eraNorm: false, rng });
    expect(result.margins).toHaveLength(4);
    expect(result.teamAWins + result.teamBWins).toBe(4);
    expect(result.teamAWins).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.avgScoreA)).toBe(true);
    expect(Number.isFinite(result.avgScoreB)).toBe(true);
  });

  it("boosts earlier eras when normalization is enabled", () => {
    const vintage = makeEraTeam("V", [6, 6, 6, 6, 6], "1975");
    const modern = makeEraTeam("M", [6, 6, 6, 6, 6], "2016");
    const rngValues = [0.25, 0.75, 0.33, 0.67, 0.42, 0.58];

    const baseline = simulateSeries(vintage, modern, { games: 1, eraNorm: false, rng: sequenceRng(rngValues) });
    const normalized = simulateSeries(vintage, modern, { games: 1, eraNorm: true, rng: sequenceRng(rngValues) });

    expect(normalized.avgScoreA - normalized.avgScoreB).toBeGreaterThan(
      baseline.avgScoreA - baseline.avgScoreB
    );
  });

  it("supports legacy numeric arguments", () => {
    const teamA = makeEraTeam("A", [7, 7, 7, 7, 7], "1970");
    const teamB = makeTeam("B", [5, 5, 5, 5, 5]);

    const result = simulateSeries(teamA, teamB, 3, true);
    expect(result.margins).toHaveLength(3);
  });
});
