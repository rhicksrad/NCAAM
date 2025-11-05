/**
 * Scatter series renderer.
 * @module charts/scatter
 */

import { select } from "../vendor/d3-bundle.js";
import type { Selection } from "d3";
import type { BuiltScales } from "./axes.js";
import { ChartTheme, defaultTheme } from "./theme.js";

export interface ScatterDatum {
  x: number | Date | string;
  y: number;
  r?: number;
  color?: string;
}

export interface ScatterOptions {
  theme?: ChartTheme;
  radius?: number;
  stroke?: string;
}

function position(scale: any, value: ScatterDatum["x"]): number {
  if (typeof scale.bandwidth === "function") {
    const band = scale(value as any);
    const bandwidth = scale.bandwidth();
    if (typeof band === "number") {
      return band + bandwidth / 2;
    }
  }
  const scaled = scale(value instanceof Date ? value : (value as any));
  if (typeof scaled === "number") {
    return scaled;
  }
  throw new Error("Unable to determine scatter point position");
}

function positionY(scale: any, value: number): number {
  const scaled = scale(value);
  if (typeof scaled === "number") {
    return scaled;
  }
  throw new Error("Unable to determine scatter y position");
}

/**
 * Render scatter plot points.
 */
export function renderScatter<Datum extends ScatterDatum>(
  g: SVGGElement,
  data: readonly Datum[],
  scales: BuiltScales,
  options: ScatterOptions = {},
): Selection<SVGCircleElement, Datum, SVGGElement, unknown> {
  const theme = options.theme ?? defaultTheme;
  const baseRadius = options.radius ?? theme.legendDotSize / 2;
  const strokeColor = options.stroke ?? theme.bg;

  const selection = select(g);
  const join = selection
    .selectAll<SVGCircleElement>("circle.series--scatter")
    .data(data, (d: any) => `${d.x}-${d.y}`);

  const enter = join
    .enter()
    .append("circle")
    .attr("class", "series series--scatter")
    .attr("vector-effect", "non-scaling-stroke");

  const merged = enter.merge(join);

  merged
    .attr("cx", (datum: Datum) => position(scales.x, datum.x))
    .attr("cy", (datum: Datum) => positionY(scales.y, datum.y))
    .attr("r", (datum: Datum) => {
      if (Number.isFinite(datum.r)) {
        return Math.max(1, Number(datum.r));
      }
      return Math.max(1, baseRadius);
    })
    .attr("fill", (datum: Datum) => datum.color ?? theme.accent)
    .attr("stroke", strokeColor)
    .attr("stroke-width", Math.max(0.5, theme.lineWidth / 1.5))
    .attr("opacity", 0.9)
    .attr("role", "presentation")
    .attr("aria-hidden", "true");

  join.exit().remove();
  return merged;
}
