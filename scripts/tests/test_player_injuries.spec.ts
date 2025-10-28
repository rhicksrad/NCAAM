import { describe, expect, it } from "vitest";

import { classifyInjuryStatus, normalizeInjuryEntry } from "../fetch_injuries.js";
import type { BdlPlayerInjury } from "../fetch/bdl_player_injuries.js";

describe("classifyInjuryStatus", () => {
  it("flags season-ending language as season level", () => {
    const result = classifyInjuryStatus("Out", "Season-ending surgery announced.");
    expect(result.level).toBe("season");
    expect(result.priority).toBe(0);
  });

  it("treats out statuses as caution", () => {
    const result = classifyInjuryStatus("Out", "Sprained ankle");
    expect(result.level).toBe("caution");
  });

  it("treats questionable statuses as monitor", () => {
    const result = classifyInjuryStatus("Questionable", "Game-time decision");
    expect(result.level).toBe("monitor");
  });

  it("marks probable statuses as ready", () => {
    const result = classifyInjuryStatus("Probable", "Expected to play");
    expect(result.level).toBe("ready");
  });
});

describe("normalizeInjuryEntry", () => {
  it("maps player name and team metadata", () => {
    const injury: BdlPlayerInjury = {
      player: {
        id: 56677838,
        first_name: "Kobe",
        last_name: "Bufkin",
        team_id: 1,
      },
      status: "Out",
      return_date: "Nov 17",
      description: "Nov 16: Bufkin (shoulder) is listed as doubtful for Sunday's game against the Trail Blazers.",
      updated_at: "2024-11-16T18:30:00Z",
    };

    const normalized = normalizeInjuryEntry(injury, 0);
    expect(normalized).not.toBeNull();
    expect(normalized?.playerName).toBe("Kobe Bufkin");
    expect(normalized?.teamTricode).toBe("ATL");
    expect(normalized?.teamName).toBe("Atlanta Hawks");
    expect(normalized?.reportLabel).toBe("Nov 16");
    expect(normalized?.statusLevel).toBe("caution");
  });

  it("returns null when player information is incomplete", () => {
    const injury: BdlPlayerInjury = {
      player: {
        first_name: "",
        last_name: "",
      },
      status: "Out",
    };

    const normalized = normalizeInjuryEntry(injury, 0);
    expect(normalized).toBeNull();
  });
});
