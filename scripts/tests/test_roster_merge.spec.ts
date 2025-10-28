import { describe, expect, it } from "vitest";
import { mergeSources } from "../data/build_canonical.js";
import { LeagueDataSource, OverridesConfig, SourcePlayerRecord } from "../lib/types.js";

const emptySource: LeagueDataSource = {
  teams: {},
  players: {},
  transactions: [],
  coaches: {},
  injuries: [],
};

describe("mergeSources", () => {
  it("applies overrides to swap Anthony Davis and Luka Doncic", () => {
    const ad: SourcePlayerRecord = {
      name: "Anthony Davis",
      position: "PF",
      teamId: "1610612747",
      teamTricode: "LAL",
    };
    const luka: SourcePlayerRecord = {
      name: "Luka Doncic",
      position: "PG",
      teamId: "1610612742",
      teamTricode: "DAL",
    };

    const nbaStats: LeagueDataSource = {
      teams: {
        LAL: {
          teamId: "1610612747",
          tricode: "LAL",
          market: "Los Angeles",
          name: "Lakers",
          roster: [ad],
        },
        DAL: {
          teamId: "1610612742",
          tricode: "DAL",
          market: "Dallas",
          name: "Mavericks",
          roster: [luka],
        },
      },
      players: {},
      transactions: [],
      coaches: {},
      injuries: [],
    };

    const overrides: OverridesConfig = {
      teams: {},
      players: {
        "Anthony Davis": { name: "Anthony Davis", team: "DAL", position: "C" },
        "Luka Doncic": { name: "Luka Doncic", team: "LAL", position: "PG" },
      },
      injuries: [],
      coaches: [],
    };

    const canonical = mergeSources({
      nbaStats,
      bbr: emptySource,
      overrides,
      primary: emptySource,
    });

    const lakers = canonical.teams.find((team) => team.tricode === "LAL");
    const mavs = canonical.teams.find((team) => team.tricode === "DAL");

    expect(lakers?.roster.some((player) => player.name === "Luka Doncic")).toBe(true);
    expect(lakers?.roster.some((player) => player.name === "Anthony Davis")).toBe(false);
    expect(mavs?.roster.some((player) => player.name === "Anthony Davis")).toBe(true);
    expect(mavs?.roster.some((player) => player.name === "Luka Doncic")).toBe(false);
  });
});
