import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  normalizeNews,
  normalizeRankings,
  normalizeRoster,
  normalizeSchedule,
  normalizeScoreboard,
  normalizeStandings,
  normalizeSummary,
  normalizeTeam,
  normalizeTeams,
  scoreboardDay,
} from "../src/lib/espn";

const fx = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/espn/${name}.json`, import.meta.url), "utf8"));

describe("ESPN normalisers against recorded feeds", () => {
  it("reads a scoreboard day", () => {
    const json = fx("scoreboard-20261111");
    const games = normalizeScoreboard(json);
    expect(games.length).toBeGreaterThan(5);
    expect(scoreboardDay(json)).toBe("20261111");
    expect(scoreboardDay({ day: { date: "2027-01-02" } })).toBe("20270102");
    expect(scoreboardDay({})).toBe("");
    for (const g of games) {
      expect(g.id).toMatch(/^\d+$/);
      expect(["pre", "in", "post"]).toContain(g.state);
      expect(g.home.team.name).not.toBe("");
      expect(g.away.team.name).not.toBe("");
      expect(Number.isNaN(Date.parse(g.date))).toBe(false);
    }
    const finals = games.filter((g) => g.state === "post");
    expect(finals.length).toBeGreaterThan(0);
    for (const g of finals) {
      expect(typeof g.home.score).toBe("number");
      expect(g.home.winner !== g.away.winner).toBe(true);
    }
  });

  it("reads the polls", () => {
    const polls = normalizeRankings(fx("rankings"));
    expect(polls.length).toBeGreaterThan(0);
    const ap = polls[0]!;
    expect(ap.ranks.length).toBe(25);
    expect(ap.ranks[0]!.rank).toBe(1);
    expect(ap.ranks.every((r) => r.team.id !== "")).toBe(true);
  });

  it("reads every conference's standings", () => {
    const confs = normalizeStandings(fx("standings-2027"));
    expect(confs.length).toBeGreaterThanOrEqual(30);
    const teams = confs.flatMap((c) => c.rows);
    expect(teams.length).toBeGreaterThan(340);
    expect(new Set(teams.map((r) => r.team.id)).size).toBe(teams.length);
  });

  it("reads the team directory with colours", () => {
    const teams = normalizeTeams(fx("teams"));
    expect(teams.length).toBeGreaterThan(340);
    const duke = teams.find((t) => t.id === "150")!;
    expect(duke.name).toBe("Duke");
    expect(duke.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps only safe ESPN news links", () => {
    const news = normalizeNews(fx("news"));
    expect(news.length).toBeGreaterThan(3);
    for (const n of news) {
      expect(n.headline).not.toBe("");
      expect(new URL(n.url).protocol).toBe("https:");
      expect(new URL(n.url).hostname).toMatch(/(^|\.)espn\.com$/);
    }
  });

  it("reads a team page: detail, roster, schedule", () => {
    expect(normalizeTeam(fx("team-150")).team.id).toBe("150");
    const roster = normalizeRoster(fx("team-150-roster"));
    expect(roster.length).toBeGreaterThan(8);
    expect(roster.every((p) => p.name !== "")).toBe(true);
    const schedule = normalizeSchedule(fx("team-150-schedule"), "150");
    expect(schedule.length).toBeGreaterThan(20);
  });

  it("reads a finished game with box score and plays", () => {
    const d = normalizeSummary(fx("summary-final"))!;
    expect(d.game.state).toBe("post");
    expect(d.box.length).toBe(2);
    expect(d.box.every((b) => b.players.length >= 5)).toBe(true);
    expect(d.plays.length).toBeGreaterThan(100);
    expect(d.periodSeconds).toBe(1200);
  });

  it("reads a game that has not tipped", () => {
    const d = normalizeSummary(fx("summary-pre"))!;
    expect(d.game.state).toBe("pre");
    expect(d.plays.length).toBe(0);
  });

  it("survives junk without throwing", () => {
    for (const junk of [{}, { events: "no" }, { rankings: [null, 3], events: [null], athletes: [7] }, { children: [{}, null] }, { sports: [] }]) {
      expect(normalizeScoreboard(junk)).toEqual([]);
      expect(normalizeRankings(junk)).toEqual([]);
      expect(normalizeStandings(junk)).toEqual([]);
      expect(normalizeTeams(junk)).toEqual([]);
      expect(normalizeNews(junk)).toEqual([]);
      expect(normalizeRoster(junk)).toEqual([]);
      expect(normalizeSummary(junk)).toBeNull();
    }
  });
});
