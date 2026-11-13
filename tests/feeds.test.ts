import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { confLabel, crawlStats, normalizeStatPage, parseTorvik, seasonLabel, seasonYear, statsUrl, toSheet } from "../scripts/feeds";
// @ts-expect-error plain JS build helper
import { linkCareers, nameKey } from "../scripts/derive-data.mjs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const stats = () => JSON.parse(read("./fixtures/espn/player-stats-2027.json"));
const teams = () => JSON.parse(read("../data/seed/teams.json")).data;

describe("season naming", () => {
  it("names a season by the year it ends, from October on", () => {
    expect(seasonYear(new Date("2026-09-30T12:00:00Z"))).toBe(2026);
    expect(seasonYear(new Date("2026-10-01T12:00:00Z"))).toBe(2027);
    expect(seasonYear(new Date("2027-04-07T12:00:00Z"))).toBe(2027);
    expect(seasonLabel(2027)).toBe("2026-27");
    expect(seasonLabel(2000)).toBe("1999-00");
  });
});

describe("ESPN season averages", () => {
  it("reads a recorded page by stat name", () => {
    const page = normalizeStatPage(stats());
    expect(page).toMatchObject({ year: 2027, count: 7114, pages: 8 });
    const dior = page.lines.find((l) => l[1] === "Dior Johnson")!;
    expect(dior.slice(2, 6)).toEqual(["2116", 3, 33.7, 31]);
    expect(dior[11]).toBe(0.659);
  });

  it("keeps Division I players only, grouped by school", () => {
    const rows = toSheet(normalizeStatPage(stats()).lines, teams());
    expect(rows.length).toBe(16);
    expect(rows.every((r) => String(r[0]).startsWith("e"))).toBe(true);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1]![3].localeCompare(rows[i]![3])).toBeLessThanOrEqual(0);
    expect(rows.find((r) => r[1] === "Dior Johnson")!.slice(0, 5)).toEqual(["e4432741", "Dior Johnson", "UCF", "2116", "Big 12"]);
  });

  it("gives a dash, not zero, when nothing was tried", () => {
    const json = {
      categories: [{ name: "general", names: ["gamesPlayed"] }, { name: "offensive", names: ["threePointFieldGoalPct", "threePointFieldGoalsAttempted"] }],
      athletes: [{ athlete: { id: "1", teamId: "2", displayName: "A" }, categories: [{ name: "general", values: [2] }, { name: "offensive", values: [0, 0] }] }],
    };
    expect(normalizeStatPage(json).lines[0]![12]).toBeNull();
  });

  const page = (n: number, ids: string[], count = 5, year = 2027) => ({
    requestedSeason: { year },
    pagination: { count, pages: 3 },
    categories: [{ name: "general", names: ["gamesPlayed"] }],
    athletes: ids.map((id) => ({ athlete: { id, teamId: "1", displayName: `P${id}` }, categories: [{ name: "general", values: [1] }] })),
    n,
  });

  it("crawls every page and drops players seen twice", async () => {
    const asked: string[] = [];
    const pages: Record<number, string[]> = { 1: ["1", "2"], 2: ["2", "3"], 3: ["4", "5"] };
    const out = await crawlStats(2027, async (url) => {
      asked.push(url);
      const n = Number(/page=(\d+)/.exec(url)![1]);
      return page(n, pages[n]!);
    }, { limit: 2 });
    expect(asked.sort()).toEqual([1, 2, 3].map((n) => statsUrl(2027, n, 2)).sort());
    expect(out.lines.map((l) => l[0]).sort()).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("refuses a short crawl, a wrong season and a failed page", async () => {
    await expect(crawlStats(2027, async (u) => page(1, u.includes("page=1") ? ["1"] : [], 50))).rejects.toThrow(/of 50/);
    await expect(crawlStats(2027, async () => page(1, ["1"], 1, 2026))).rejects.toThrow(/got 2026/);
    await expect(crawlStats(2027, async (u) => (u.includes("page=2") ? Promise.reject(new Error("boom")) : page(1, ["1"])))).rejects.toThrow("boom");
  });

  it("spells conferences the way the archive does", () => {
    expect(confLabel("BIG12")).toBe("Big 12");
    expect(confLabel("MWEST")).toBe("MWC");
    expect(confLabel("NEW", "Brand New Conference")).toBe("Brand New");
    expect(confLabel("NEW")).toBe("NEW");
  });
});

describe("Torvik ratings", () => {
  it("reads the recorded files, skipping teams with no games", () => {
    const rows = parseTorvik(read("./fixtures/torvik/2027_team_results.csv"), read("./fixtures/torvik/2027_fffinal.csv"));
    expect(rows.length).toBe(19);
    expect(rows[0]).toEqual(["Duke", "ACC", 2, 3, 120.2, 91.1, 0.96, 71, null, null]);
  });

  it("honours quotes, repeated headers and the four factors join", () => {
    const results = 'rank,team,conf,record,adjoe,rank,adjde,rank,barthag,rank,adjt\n1,"Saint Mary\'s, CA",WCC,3-1,115.04,9,95.0,2,0.9,3,66.66\n2,Idle,WCC,0-0,100,1,100,1,0.5,1,60\n';
    const ff = "TeamName,eFG%,Rk,3P%\n\"Saint Mary's, CA\",55.55,1,38.04\nIdle,0,2,0\n";
    expect(parseTorvik(results, ff)).toEqual([["Saint Mary's, CA", "WCC", 3, 4, 115, 95, 0.9, 66.7, 38, 55.6]]);
    expect(parseTorvik(results)[0]!.slice(8)).toEqual([null, null]);
  });

  it("throws on anything that isn't a results file", () => {
    expect(() => parseTorvik("<!doctype html><html>checking your browser</html>")).toThrow(/not a Torvik/);
  });
});

describe("linking this season's players to their careers", () => {
  it("matches names whatever the suffix or punctuation", () => {
    expect(nameKey("Patrick Ngongba II")).toBe(nameKey("Patrick Ngongba"));
    expect(nameKey("Ja'Kobe Walter")).toBe("jakobe walter");
    expect(nameKey("José Pérez Jr.")).toBe("jose perez");
  });

  const a = (slug: string, key: string, teamId: string, seasons = 1) => ({ slug, key, teamId, seasons });
  it("links at the same school, and a transfer only when the name is unique", () => {
    const archive = [a("x-1", "x", "1"), a("y-1", "y", "2"), a("z-1", "z", "3"), a("z-2", "z", "4")];
    const current = [{ key: "x", teamId: "1" }, { key: "y", teamId: "9" }, { key: "z", teamId: "5" }, { key: "new", teamId: "1" }];
    expect(linkCareers(current, archive)).toEqual(["x-1", "y-1", null, null]);
  });

  it("never hands one career to two players, or a finished one to a freshman", () => {
    expect(linkCareers([{ key: "y", teamId: "8" }, { key: "y", teamId: "9" }], [a("y-1", "y", "2")])).toEqual([null, null]);
    expect(linkCareers([{ key: "y", teamId: "2" }, { key: "y", teamId: "9" }], [a("y-1", "y", "2")])).toEqual(["y-1", null]);
    expect(linkCareers([{ key: "y", teamId: "9" }], [a("y-1", "y", "2", 5)])).toEqual([null]);
    expect(linkCareers([{ key: "y", teamId: "9" }], [a("y-1", "y", "2", 4)])).toEqual(["y-1"]);
  });
});
