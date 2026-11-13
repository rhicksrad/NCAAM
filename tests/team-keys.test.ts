import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error plain JS build helper
import { loadResolver, norm } from "../scripts/team-keys.mjs";

describe("seed data", () => {
  const seed = (n: string) => JSON.parse(readFileSync(new URL(`../data/seed/${n}.json`, import.meta.url), "utf8"));
  it("is complete enough to run the site with ESPN down", () => {
    expect(seed("teams").data.length).toBeGreaterThan(340);
    expect(seed("standings").data.length).toBeGreaterThanOrEqual(30);
    expect(seed("rankings").data[0].ranks.length).toBe(25);
    expect(seed("scoreboard").data.games.length).toBeGreaterThan(0);
    expect(seed("averages").data).toMatchObject({ year: 2027, season: "2026-27" });
    expect(seed("averages").data.rows.length).toBeGreaterThan(0);
    expect(seed("torvik").data.rows.length).toBeGreaterThan(0);
  });
  it("normalises school name spellings to one key", () => {
    expect(norm("Saint Mary's (CA)")).toBe("saint mary s ca");
    expect(norm("Ohio St.")).toBe(norm("ohio state"));
    expect(norm("San José State")).toBe("san jose state");
    expect(norm("Texas A&M")).toBe(norm("texas a&m"));
  });
  it("resolves Torvik and NCAA shorthand to the right ESPN program", () => {
    const teams = seed("teams").data;
    const { resolve } = loadResolver(new URL("../data/raw/logos/metadata.json", import.meta.url).pathname, teams);
    const name = (n: string) => teams.find((t: { id: string }) => t.id === resolve(n))?.name;
    expect(name("Northern Ariz.")).toBe("Northern Arizona");
    expect(name("Fla. Atlantic")).toBe("Florida Atlantic");
    expect(name("N.C. A&T")).toBe("North Carolina A&T");
    expect(name("Utah Valley")).toBe("Utah Valley");
    expect(name("USC Upstate")).toBe("South Carolina Upstate");
    expect(name("Marquette")).toBe("Marquette");
    expect(name("Michigan St.")).toBe("Michigan State");
    for (const [team] of seed("torvik").data.rows) expect(resolve(team), team).toBeTruthy();
  });
});
