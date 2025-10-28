import { describe, it, expect } from "vitest";
import { rankByGoatScore } from "@/lib/rank";
import { orderedTierNames, groupByTier } from "@/lib/tiers";

describe("tier helpers", () => {
  it("orders tiers by best global rank", () => {
    const ranked = rankByGoatScore([
      { name: "Jokic", goatScore: "90", tier: "Ascendant" },
      { name: "Curry", goatScore: "64.9", tier: "Pantheon" },
      { name: "LeBron", goatScore: "62.1", tier: "Pantheon" },
    ]);
    const order = orderedTierNames(ranked);
    expect(order[0]).toBe("Ascendant");
    const map = groupByTier(ranked);
    expect(map.get("Pantheon")?.[0].name).toBe("Curry");
  });
});
