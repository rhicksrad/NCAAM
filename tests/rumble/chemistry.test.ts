import { describe, expect, it } from "vitest";
import { buildChemistry, evaluateMatchup } from "../../src/players/rumble/chemistry";
import type { Player } from "../../src/players/rumble/types";

const basePlayer: Omit<Player, "id" | "name"> = {
  era: "Modern",
  pos: "G",
  franchise: "Test",
  threeP: 0.37,
  threePA_rate: 0.55,
  astPct: 0.24,
  usg: 0.27,
  stl: 0.025,
  blk: 0.01,
  paceZ: 0.2,
  impact: 7,
  archetypes: ["Creator"],
};

function createPlayer(id: string, name: string, overrides: Partial<Player> = {}): Player {
  return { id, name, ...basePlayer, ...overrides };
}

describe("buildChemistry", () => {
  it("rewards creator to shooter pairings", () => {
    const creator = createPlayer("1", "Creator", {});
    const shooter = createPlayer("2", "Shooter", {
      archetypes: ["Off-ball Shooter"],
      threeP: 0.41,
      threePA_rate: 0.62,
      astPct: 0.12,
      usg: 0.19,
    });

    const chemistry = buildChemistry([creator, shooter]);
    expect(chemistry.score).toBeGreaterThan(100);
    expect(chemistry.edges).toHaveLength(1);
    expect(chemistry.edges[0].reasons).toContain("creator → shooter");
  });

  it("limits the number of positive synergies for a pairing", () => {
    const initiator = createPlayer("10", "Initiator", {
      archetypes: ["Creator", "Connector", "POA Stopper"],
      astPct: 0.31,
      usg: 0.3,
      threePA_rate: 0.58,
      threeP: 0.39,
      paceZ: 0.4,
    });
    const versatileBig = createPlayer("11", "Versatile Big", {
      archetypes: ["Off-ball Shooter", "Stretch Big", "Rim Runner", "Rim Protector", "Connector"],
      threeP: 0.38,
      threePA_rate: 0.6,
      astPct: 0.18,
      usg: 0.22,
      paceZ: 0.35,
    });

    const chemistry = buildChemistry([initiator, versatileBig], "nineties");
    expect(chemistry.edges).toHaveLength(1);
    const [edge] = chemistry.edges;
    expect(edge.reasons).toEqual([
      "creator → shooter",
      "inside-out game",
      "connector boost",
      "defensive spine",
    ]);
    expect(edge.weight).toBeCloseTo(11.96, 2);
    expect(chemistry.score).toBeCloseTo(111.96, 2);
  });

  it("penalizes defensive gaps", () => {
    const scorer = createPlayer("3", "Scorer", {
      archetypes: ["Creator"],
      astPct: 0.15,
      usg: 0.31,
      stl: 0.01,
      blk: 0.005,
    });
    const twin = createPlayer("4", "Twin", {
      archetypes: ["Secondary"],
      astPct: 0.14,
      usg: 0.3,
      stl: 0.01,
      blk: 0.005,
      threePA_rate: 0.2,
    });

    const chemistry = buildChemistry([scorer, twin]);
    expect(chemistry.score).toBeLessThan(100);
    expect(chemistry.edges[0].reasons).toContain("defensive gaps");
  });
});

describe("evaluateMatchup", () => {
  it("identifies POA advantages", () => {
    const stopper = createPlayer("5", "Stopper", {
      archetypes: ["POA Stopper"],
    });
    const creator = createPlayer("6", "Primary", {
      archetypes: ["Creator"],
    });

    const adjustment = evaluateMatchup([stopper], [creator]);
    expect(adjustment.advantageA).toBeGreaterThan(0);
    expect(adjustment.reasonsA[0]).toContain("Stopper");
  });
});
