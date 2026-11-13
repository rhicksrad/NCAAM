import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { esc, html, raw } from "../src/lib/dom";
import type { Game } from "../src/lib/espn";
import { atHalf, drama, easternYmd, pctOrDash, periodLabel, rivalColors, shiftYmd, teamColors, whyWatch } from "../src/lib/ui";

describe("html template", () => {
  it("escapes interpolations", () => {
    expect(html`<p>${'<img onerror="x">'}</p>`.value).toBe("<p>&lt;img onerror=&quot;x&quot;&gt;</p>");
    expect(esc("Texas A&M")).toBe("Texas A&amp;M");
  });
  it("passes nested markup and arrays through, drops nullish", () => {
    expect(html`<ul>${["a", "<"].map((x) => html`<li>${x}</li>`)}${null}${false}${raw("<hr>")}</ul>`.value).toBe("<ul><li>a</li><li>&lt;</li><hr></ul>");
    expect(html`${0}`.value).toBe("0");
  });
});

describe("team colours", () => {
  it("picks readable ink", () => {
    expect(teamColors({ color: "#003087", alt: "#ffffff" }).ink).toBe("#fbfaf4");
    expect(teamColors({ color: "#ffcd00", alt: "#000000" }).ink).toBe("#14213a");
  });
  it("swaps a near-white primary for the alternate", () => {
    expect(teamColors({ color: "#ffffff", alt: "#7a0019" }).paint).toBe("#7a0019");
    expect(teamColors({ color: "", alt: "" }).paint).toBe("#14213a");
  });
  it("keeps two red teams distinguishable", () => {
    const c = rivalColors({ color: "#cc0000", alt: "#ffffff" }, { color: "#c8102e", alt: "#000000" });
    expect(c.home).toBe("#cc0000");
    expect(c.away).not.toBe("#c8102e");
    expect(rivalColors({ color: "#003087", alt: "" }, { color: "#cc0000", alt: "" }).away).toBe("#cc0000");
  });
});

describe("dates and periods", () => {
  it("uses the Eastern calendar day", () => {
    expect(easternYmd(new Date("2026-11-12T03:30:00Z"))).toBe("20261111");
    expect(easternYmd(new Date("2026-11-12T15:00:00Z"))).toBe("20261112");
  });
  it("shifts across month and year ends", () => {
    expect(shiftYmd("20261130", 1)).toBe("20261201");
    expect(shiftYmd("20270101", -1)).toBe("20261231");
    expect(shiftYmd("20270228", 1)).toBe("20270301");
  });
  it("labels periods", () => {
    expect(periodLabel(1)).toBe("1st");
    expect(periodLabel(2)).toBe("2nd");
    expect(periodLabel(3)).toMatch(/OT/);
    expect(periodLabel(0)).toBe("");
  });
});

describe("drama ordering", () => {
  const side = (rank: number | null, score: number | null, winner = false) => ({ team: { id: "1", name: "A", mascot: "", abbr: "A", short: "A", color: "", alt: "" }, rank, score, winner, record: "" }) as unknown as Game["home"];
  const game = (over: Partial<Game>): Game => ({ id: "1", date: new Date().toISOString(), state: "post", detail: "Final", clock: "", period: 2, neutral: false, confGame: false, venue: "", city: "", tv: "", note: "", odds: "", home: side(null, 70, true), away: side(null, 60), ...over });
  it("says why the main event is the main event, and nothing it can't back up", () => {
    expect(whyWatch(game({ state: "pre", home: side(3, null), away: side(9, null) }))).toBe("No. 3 against No. 9");
    expect(whyWatch(game({ state: "pre", home: side(null, null), away: side(23, null) }))).toBe("No. 23 is in the building");
    expect(whyWatch(game({ state: "in", period: 2, home: side(null, 61), away: side(null, 59) }))).toBe("A 2-point game in the second half");
    expect(whyWatch(game({ state: "in", period: 3, home: side(null, 70), away: side(null, 70) }))).toBe("Overtime");
    expect(whyWatch(game({ home: side(null, 70, true), away: side(4, 60) }))).toBe("No. 4 went down");
    expect(whyWatch(game({ home: side(null, 70, true), away: side(null, 68) }))).toBe("Decided by 2");
  });
  it("puts live games above upcoming above finished", () => {
    const live = drama(game({ state: "in" }));
    const pre = drama(game({ state: "pre", home: side(1, null), away: side(2, null) }));
    const post = drama(game({ home: side(1, 70, true), away: side(2, 69) }));
    expect(live).toBeGreaterThan(pre);
    expect(pre).toBeGreaterThan(post);
  });
  it("prefers close, ranked and overtime finals", () => {
    expect(drama(game({ home: side(null, 70, true), away: side(null, 69) }))).toBeGreaterThan(drama(game({})));
    expect(drama(game({ home: side(5, 70, true), away: side(null, 60) }))).toBeGreaterThan(drama(game({})));
    expect(drama(game({ detail: "Final/OT" }))).toBeGreaterThan(drama(game({})));
  });
});

describe("small honesties", () => {
  it("shows a dash, not 0.0, for a percentage of no attempts", () => {
    expect(pctOrDash("0.0", "0-0")).toBe("–");
    expect(pctOrDash("0.0", "0-3")).toBe("0.0");
    expect(pctOrDash("50.0", "5-10")).toBe("50.0");
    expect(pctOrDash("41.2", undefined)).toBe("41.2");
  });
  it("calls the break halftime even though the feed's clock says 0:00 1st", () => {
    expect(atHalf({ state: "in", detail: "Halftime" })).toBe(true);
    expect(atHalf({ state: "in", detail: "12:44 - 2nd Half" })).toBe(false);
    expect(atHalf({ state: "post", detail: "Final" })).toBe(false);
  });
});

describe("every school's paint", () => {
  const lum = (hexColor: string) => {
    const n = parseInt(hexColor.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

  it("takes ink that passes WCAG AA for small text, for all of Division I", () => {
    const teams = JSON.parse(readFileSync(new URL("../data/seed/teams.json", import.meta.url), "utf8")).data as Array<{ name: string; color: string; alt: string }>;
    expect(teams.length).toBeGreaterThan(300);
    const failing = teams.map((t) => ({ t, ...teamColors(t) })).filter(({ paint, ink }) => ratio(paint, ink) < 4.5).map(({ t, paint, ink }) => `${t.name} ${paint} on ${ink}`);
    expect(failing).toEqual([]);
  });
});

describe("player slugs", () => {
  it("are computed the same way by the build and the page", async () => {
    const { playerSlug } = await import("../src/lib/slug");
    // @ts-expect-error plain JS build helper
    const build = await import("../scripts/derive-data.mjs");
    for (const name of ["AJ Dybantsa", "Aa'reyon Jones", "Juan Cranford Jr.", "José Pérez", "Kel'el Ware", "Jean-Marc Ollie"]) {
      expect(playerSlug(name)).toBe(build.playerSlug(name));
    }
    expect(playerSlug("AJ Dybantsa")).toBe("aj-dybantsa-1");
    expect(playerSlug("Aa'reyon Jones")).toBe("aareyon-jones-1");
  });
});
