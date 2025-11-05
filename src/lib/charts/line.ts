/**
 * Line series renderer.
 * @module charts/line
 */

import {
  line as d3Line,
  curveLinear,
  curveMonotoneX,
  select
} from "../vendor/d3-bundle.js";
import type { Selection } from "d3";
import type { BuiltScales } from "./axes.js";
import { ChartTheme, defaultTheme } from "./theme.js";

export interface LineDatum {
  x: number | Date;
  y: number;
}

export interface LineOptions {
  theme?: ChartTheme;
  smoothing?: boolean;
  stroke?: string;
  strokeWidth?: number;
  ariaLabel?: string;
  defined?: (datum: LineDatum) => boolean;
}

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

function position(scale: any, value: number | Date): number {
  const scaled = scale(value instanceof Date ? value : value as any);
  if (typeof scaled === "number") {
    return scaled;
  }
  if (typeof scale.bandwidth === "function") {
    const band = scale(value as any);
    const bandwidth = scale.bandwidth();
    if (typeof band === "number") {
      return band + bandwidth / 2;
    }
  }
  throw new Error("Unable to determine line position");
}

function valueY(scale: any, value: number): number {
  const scaled = scale(value);
  if (typeof scaled === "number") {
    return scaled;
  }
  throw new Error("Unable to determine y position");
}

/**
 * Render a line path.
 */
export function renderLine(
  g: SVGGElement,
  data: readonly LineDatum[],
  scales: BuiltScales,
  options: LineOptions = {}
): SVGPathElement {
  const theme = options.theme ?? defaultTheme;
  const strokeWidth = options.strokeWidth ?? theme.lineWidth;
  const selection = select(g);
  const path = selection
    .selectAll<SVGPathElement>("path.series--line")
    .data([data]);
  const enter = path
    .enter()
    .append("path")
    .attr("class", "series series--line")
    .attr("fill", "none")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("vector-effect", "non-scaling-stroke");

  const merged: Selection<SVGPathElement, readonly LineDatum[]> = enter.merge(path);

  const lineGenerator = d3Line<LineDatum>()
    .defined(options.defined ?? ((datum: LineDatum) => Number.isFinite(datum.y)))
    .x((datum: LineDatum) => position(scales.x, datum.x))
    .y((datum: LineDatum) => valueY(scales.y, datum.y))
    .curve(options.smoothing ? curveMonotoneX : curveLinear);

  const dAttribute = lineGenerator(data);
  merged
    .attr("stroke", options.stroke ?? theme.accent)
    .attr("stroke-width", strokeWidth)
    .attr("aria-label", options.ariaLabel ?? "Line series")
    .attr("d", dAttribute ?? "");

  if (!prefersReducedMotion() && merged.node()) {
    const node = merged.node()!;
    const totalLength = node.getTotalLength();
    node.style.transition = "none";
    node.style.strokeDasharray = `${totalLength} ${totalLength}`;
    node.style.strokeDashoffset = `${totalLength}`;
    // Force layout
    void node.getBoundingClientRect();
    node.style.transition = "stroke-dashoffset 320ms ease";
    node.style.strokeDashoffset = "0";
  }

  path.exit().remove();
  return merged.node()!;
}
