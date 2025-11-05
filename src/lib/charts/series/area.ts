/**
 * Area series renderer.
 * @module charts/series/area
 */

import {
  area as d3Area,
  curveLinear,
  curveMonotoneX,
  select,
  type Selection
} from "d3";
import type { BuiltScales } from "../axes.js";
import { ChartTheme, defaultTheme } from "../theme.js";

export interface AreaDatum {
  x: number | Date;
  y: number;
}

export interface AreaOptions {
  theme?: ChartTheme;
  smoothing?: boolean;
  fill?: string;
  opacity?: number;
  baseline?: number;
  defined?: (datum: AreaDatum) => boolean;
  stroke?: string;
  strokeWidth?: number;
}

function position(scale: any, value: number | Date): number {
  const scaled = scale(value instanceof Date ? value : value as any);
  if (typeof scaled === "number") return scaled;
  if (typeof scale.bandwidth === "function") {
    const band = scale(value as any);
    const bandwidth = scale.bandwidth();
    if (typeof band === "number") {
      return band + bandwidth / 2;
    }
  }
  throw new Error("Unable to determine area x position");
}

function valueY(scale: any, value: number): number {
  const scaled = scale(value);
  if (typeof scaled === "number") return scaled;
  throw new Error("Unable to determine area y position");
}

/**
 * Render an area shape.
 */
export function renderArea(
  g: SVGGElement,
  data: readonly AreaDatum[],
  scales: BuiltScales,
  options: AreaOptions = {}
): SVGPathElement {
  const theme = options.theme ?? defaultTheme;
  const selection = select(g);
  const path = selection
    .selectAll<SVGPathElement>("path.series--area")
    .data([data]);
  const enter = path
    .enter()
    .append("path")
    .attr("class", "series series--area")
    .attr("vector-effect", "non-scaling-stroke");

  const merged: Selection<SVGPathElement, readonly AreaDatum[]> = enter.merge(path);
  const yRange = (scales.y as any).range?.() as [number, number];
  const baseline =
    options.baseline !== undefined
      ? valueY(scales.y, options.baseline)
      : Array.isArray(yRange)
        ? Math.max(...yRange)
        : 0;

  const areaGenerator = d3Area<AreaDatum>()
    .defined(options.defined ?? ((datum: AreaDatum) => Number.isFinite(datum.y)))
    .x((datum: AreaDatum) => position(scales.x, datum.x))
    .y1((datum: AreaDatum) => valueY(scales.y, datum.y))
    .y0(() => baseline)
    .curve(options.smoothing ? curveMonotoneX : curveLinear);

  const dAttribute = areaGenerator(data);
  const strokeColor = options.stroke ?? theme.accent;
  const strokeWidth = options.strokeWidth ?? Math.max(1, theme.lineWidth);

  merged
    .attr("fill", options.fill ?? theme.accentMuted)
    .attr("fill-opacity", options.opacity ?? 0.6)
    .attr("stroke", strokeColor)
    .attr("stroke-width", strokeWidth)
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .attr("d", dAttribute ?? "");

  path.exit().remove();
  return merged.node()!;
}
