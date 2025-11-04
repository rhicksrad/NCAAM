import { readFileSync } from "fs";

import { describe, expect, it } from "vitest";

import { normalizeGamePlayByPlayResponse } from "../../src/lib/api/ncaam.js";
import { buildBoxScoreFromPlayByPlay } from "../../src/lib/boxscore.js";
import type { Game } from "../../src/lib/sdk/ncaam.js";

const loadFixture = (name: string) => {
  const raw = readFileSync(`tests/fixtures/playbyplay/${name}.json`, "utf8");
  return JSON.parse(raw) as unknown;
};

describe("boxscore aggregation", () => {
  it("aggregates shooting, hustle, and penalty statistics from play-by-play", () => {
    const raw = loadFixture("basic-game");
    const events = normalizeGamePlayByPlayResponse(raw as { data: unknown[] });
    expect(events).toHaveLength(16);

    const game: Game = {
      id: 1234,
      date: null,
      status: "Final",
      period: 5,
      home_team: {
        id: 10,
        full_name: "Home Team",
        name: "Home",
        abbreviation: "HME",
      },
      visitor_team: {
        id: 20,
        full_name: "Away Team",
        name: "Away",
        abbreviation: "AWY",
      },
      home_score: 7,
      away_score: 3,
      home_score_h1: null,
      away_score_h1: null,
      home_score_h2: null,
      away_score_h2: null,
      home_score_ot: null,
      away_score_ot: null,
    };

    const boxScore = buildBoxScoreFromPlayByPlay({ game, events });

    expect(boxScore.eventsProcessed).toBe(events.length);

    // Home team expectations
    expect(boxScore.home.totals.fgm).toBe(2);
    expect(boxScore.home.totals.fga).toBe(2);
    expect(boxScore.home.totals.tpm).toBe(1);
    expect(boxScore.home.totals.tpa).toBe(1);
    expect(boxScore.home.totals.ftm).toBe(2);
    expect(boxScore.home.totals.fta).toBe(3);
    expect(boxScore.home.totals.pts).toBe(7);
    expect(boxScore.home.totals.oreb).toBe(1);
    expect(boxScore.home.totals.dreb).toBe(1);
    expect(boxScore.home.totals.ast).toBe(1);
    expect(boxScore.home.totals.tov).toBe(1);

    const guard = boxScore.home.players.find(player => player.playerId === 101);
    expect(guard).toBeDefined();
    expect(guard?.fgm).toBe(1);
    expect(guard?.fga).toBe(1);
    expect(guard?.tpm).toBe(1);
    expect(guard?.tpa).toBe(1);
    expect(guard?.ftm).toBe(2);
    expect(guard?.fta).toBe(3);
    expect(guard?.pts).toBe(5);
    expect(guard?.starter).toBe(true);
    expect(guard?.seconds).toBe(1200);

    const wing = boxScore.home.players.find(player => player.playerId === 102);
    expect(wing?.ast).toBe(1);
    expect(wing?.tov).toBe(1);

    const big = boxScore.home.players.find(player => player.playerId === 103);
    expect(big?.blk).toBe(1);
    expect(big?.dreb).toBe(1);

    const bench = boxScore.home.players.find(player => player.playerId === 104);
    expect(bench?.starter).toBe(false);
    expect(bench?.oreb).toBe(1);
    expect(bench?.fgm).toBe(1);
    expect(bench?.pts).toBe(2);

    expect(boxScore.home.starters.map(player => player.playerId)).toEqual(
      expect.arrayContaining([101, 102, 103]),
    );
    expect(boxScore.home.bench.map(player => player.playerId)).toEqual(
      expect.arrayContaining([104]),
    );

    // Away team expectations
    expect(boxScore.away.totals.fgm).toBe(1);
    expect(boxScore.away.totals.fga).toBe(2);
    expect(boxScore.away.totals.tpm).toBe(1);
    expect(boxScore.away.totals.tpa).toBe(1);
    expect(boxScore.away.totals.pts).toBe(3);
    expect(boxScore.away.totals.tov).toBe(1);
    expect(boxScore.away.totals.dreb).toBe(1);

    const awayGuard = boxScore.away.players.find(player => player.playerId === 201);
    expect(awayGuard?.fgm).toBe(1);
    expect(awayGuard?.fga).toBe(2);
    expect(awayGuard?.tpm).toBe(1);
    expect(awayGuard?.tpa).toBe(1);
    expect(awayGuard?.pts).toBe(3);
    expect(awayGuard?.seconds).toBe(900);

    const awayWing = boxScore.away.players.find(player => player.playerId === 202);
    expect(awayWing?.stl).toBe(1);
    expect(awayWing?.pf).toBe(1);

    const awayCenter = boxScore.away.players.find(player => player.playerId === 203);
    expect(awayCenter?.pf).toBe(1);

    const scoringEvents = events.filter(event => event.isScoringPlay);
    expect(scoringEvents).toHaveLength(5);
  });
});

