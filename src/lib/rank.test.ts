import { describe, it, expect } from "vitest";
import { rankByGoatScore, toNum } from "@/lib/rank";

describe("ranking", () => {
  it("sorts numerically desc and assigns ranks", () => {
    const players = [
      { name: "LeBron", goatScore: "62.1" },
      { name: "Durant", goatScore: 60.8 },
      { name: "Jokic", goatScore: "90" },
      { name: "Curry", goatScore: "64.9" },
    ];
    const ranked = rankByGoatScore(players);
    expect(ranked.map((p) => p.name)).toEqual(["Jokic", "Curry", "LeBron", "Durant"]);
    expect(ranked.map((p) => p.rank)).toEqual([1, 2, 3, 4]);
  });

  it("puts invalid scores last", () => {
    const ranked = rankByGoatScore([{ goatScore: null }, { goatScore: "0" }, { goatScore: "5" }]);
    expect(ranked.map((p) => toNum(p.goatScore))).toEqual([5, 0, Number.NEGATIVE_INFINITY]);
  });
});
