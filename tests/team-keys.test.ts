import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS build helper
import { norm } from "../scripts/team-keys.mjs";

describe("seed data", () => {
  const seed = (n: string) => JSON.parse(readFileSync(new URL(`../data/seed/${n}.json`, import.meta.url), "utf8"));
  it("is complete enough to run the site with ESPN down", () => {
    expect(seed("teams").data.length).toBeGreaterThan(340);
    expect(seed("standings").data.length).toBeGreaterThanOrEqual(30);
    expect(seed("rankings").data[0].ranks.length).toBe(25);
    expect(seed("scoreboard").data.games.length).toBeGreaterThan(0);
  });
  it("normalises school name spellings to one key", () => {
    expect(norm("Saint Mary's (CA)")).toBe("saint mary s ca");
    expect(norm("Ohio St.")).toBe(norm("ohio state"));
    expect(norm("San José State")).toBe("san jose state");
    expect(norm("Texas A&M")).toBe(norm("texas a&m"));
  });
});
