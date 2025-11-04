import { readFileSync } from "fs";

import { describe, expect, it } from "vitest";

import { normalizeGamePlayByPlayResponse } from "../../src/lib/api/ncaam.js";
import { buildBoxScoreFromPlayByPlay } from "../../src/lib/boxscore.js";
import type { Game } from "../../src/lib/sdk/ncaam.js";

type Fixture = {
  data: Array<{
    game_id?: number;
    order?: number;
    type?: string;
    text?: string;
    home_score?: number;
    away_score?: number;
    period?: number;
    clock?: string;
    scoring_play?: boolean;
    score_value?: number | null;
    team?: {
      id?: number;
      name?: string;
      full_name?: string;
      abbreviation?: string;
    } | null;
  }>;
};

const loadFixture = (name: string) => {
  const raw = readFileSync(`tests/fixtures/playbyplay/${name}.json`, "utf8");
  return JSON.parse(raw) as Fixture;
};

describe("boxscore aggregation", () => {
  it("aggregates shooting, hustle, and penalty statistics from play-by-play", () => {
    const raw = loadFixture("basic-game");
    const events = normalizeGamePlayByPlayResponse(raw);
    expect(events).toHaveLength(17);

    const game: Game = {
      id: 1234,
      date: null,
      status: "Final",
      period: 2,
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
    expect(boxScore.home.totals.stl).toBe(1);
    expect(boxScore.home.totals.blk).toBe(1);

    const guard = boxScore.home.players.find(player => player.fullName === "Home Guard");
    expect(guard).toBeDefined();
    expect(guard?.fgm).toBe(1);
    expect(guard?.fga).toBe(1);
    expect(guard?.tpm).toBe(1);
    expect(guard?.tpa).toBe(1);
    expect(guard?.ftm).toBe(1);
    expect(guard?.fta).toBe(1);
    expect(guard?.pts).toBe(4);
    expect(guard?.stl).toBe(1);
    expect(guard?.minutes).toBeNull();

    const wing = boxScore.home.players.find(player => player.fullName === "Home Wing");
    expect(wing?.ast).toBe(1);
    expect(wing?.ftm).toBe(1);
    expect(wing?.fta).toBe(2);
    expect(wing?.tov).toBe(1);

    const big = boxScore.home.players.find(player => player.fullName === "Home Big");
    expect(big?.dreb).toBe(1);
    expect(big?.blk).toBe(1);

    const sixth = boxScore.home.players.find(player => player.fullName === "Home Sixth");
    expect(sixth?.fgm).toBe(1);
    expect(sixth?.fga).toBe(1);
    expect(sixth?.pts).toBe(2);

    // Away team expectations
    expect(boxScore.away.totals.fgm).toBe(1);
    expect(boxScore.away.totals.fga).toBe(2);
    expect(boxScore.away.totals.tpm).toBe(1);
    expect(boxScore.away.totals.tpa).toBe(2);
    expect(boxScore.away.totals.fta).toBe(1);
    expect(boxScore.away.totals.pts).toBe(3);
    expect(boxScore.away.totals.tov).toBe(1);
    expect(boxScore.away.totals.dreb).toBe(1);
    expect(boxScore.away.totals.pf).toBe(1);

    const awayGuard = boxScore.away.players.find(player => player.fullName === "Away Guard");
    expect(awayGuard?.fgm).toBe(1);
    expect(awayGuard?.fga).toBe(2);
    expect(awayGuard?.tpm).toBe(1);
    expect(awayGuard?.tpa).toBe(2);
    expect(awayGuard?.fta).toBe(1);
    expect(awayGuard?.pts).toBe(3);
    expect(awayGuard?.tov).toBe(1);

    const awayWing = boxScore.away.players.find(player => player.fullName === "Away Wing");
    expect(awayWing?.stl).toBe(1);

    const awayCenter = boxScore.away.players.find(player => player.fullName === "Away Center");
    expect(awayCenter?.dreb).toBe(1);
    expect(awayCenter?.pf).toBe(1);
  });
});
