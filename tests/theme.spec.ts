/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { buildScales, drawAxes } from "../src/lib/charts/axes";
import { computeInnerSize } from "../src/lib/charts/frame";
import {
  ChartTheme,
  chooseTextColor,
  darkTheme,
  defaultTheme,
  formatNumber
} from "../src/lib/charts/theme";

const SVG_NS = "http://www.w3.org/2000/svg";

describe("chart theme", () => {
  it("provides complete token sets", () => {
    const themes: ChartTheme[] = [defaultTheme, darkTheme];
    for (const theme of themes) {
      expect(typeof theme.fontFamily).toBe("string");
      expect(typeof theme.fontSize).toBe("number");
      expect(Array.isArray(theme.categorical)).toBe(true);
      expect(theme.categorical.length).toBeGreaterThanOrEqual(12);
      expect(Array.isArray(theme.sequential.cool)).toBe(true);
      expect(Array.isArray(theme.sequential.warm)).toBe(true);
    }
  });

  it("formats compact numbers", () => {
    expect(formatNumber(1234)).toBe("1.2k");
    expect(formatNumber(0.456, { style: "percent", digits: 0 })).toBe("46%");
  });

  it("keeps tick density within bounds", () => {
    const container = document.createElementNS(SVG_NS, "svg");
    const group = document.createElementNS(SVG_NS, "g");
    container.appendChild(group);

    const { iw, ih } = computeInnerSize(320, 240, { top: 0, right: 0, bottom: 0, left: 0 });

    const scales = buildScales({
      x: { type: "linear", domain: [0, 100], range: [0, iw] },
      y: { type: "linear", domain: [0, 100], range: [ih, 0] }
    });

    drawAxes(group, scales, {
      innerWidth: iw,
      innerHeight: ih,
      theme: defaultTheme
    });

    const xTicks = group.querySelectorAll(".axis--x .tick").length;
    const yTicks = group.querySelectorAll(".axis--y .tick").length;
    const maxXTicks = Math.max(2, Math.round(iw / 80)) + 2;
    const maxYTicks = Math.max(2, Math.round(ih / 60)) + 2;
    expect(xTicks).toBeLessThanOrEqual(maxXTicks);
    expect(yTicks).toBeLessThanOrEqual(maxYTicks);
  });

  it("chooses contrasting text colors", () => {
    expect(chooseTextColor("#000000")).toBe("white");
    expect(chooseTextColor("#ffffff")).toBe("black");
    expect(chooseTextColor("rgb(200, 50, 50)")).toBe("white");
  });
});
