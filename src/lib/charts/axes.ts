/**
 * Axes and scale helpers.
 * @module charts/axes
 */

import { axisBottom, axisLeft } from "d3-axis";
import type { AxisDomain } from "d3-axis";
import { extent } from "d3-array";
import { scaleBand, scaleLinear, scalePoint, scaleTime, ScaleBand, ScaleLinear, ScalePoint, ScaleTime } from "d3-scale";
import { select } from "d3-selection";
import type { Selection } from "d3-selection";
import { pixelAlign } from "./frame.js";
import { ChartTheme, defaultTheme, formatDate, formatNumber } from "./theme.js";

export type NumericDomain = number;
export type TimeDomain = Date;
export type CategoricalDomain = string | number;

export type SupportedDomain = NumericDomain | TimeDomain | CategoricalDomain;

export type SupportedScale =
  | ScaleLinear<number, number>
  | ScaleTime<number, number>
  | ScaleBand<CategoricalDomain>
  | ScalePoint<CategoricalDomain>;

export interface ScaleDefinition<TDomain extends SupportedDomain> {
  type: "linear" | "time" | "band" | "point";
  domain: readonly TDomain[];
  range: readonly [number, number];
  paddingInner?: number;
  paddingOuter?: number;
  clamp?: boolean;
  nice?: boolean;
}

export interface BuildScalesOptions {
  x: ScaleDefinition<SupportedDomain>;
  y: ScaleDefinition<SupportedDomain>;
}

export interface BuiltScales {
  x: SupportedScale;
  y: SupportedScale;
}

/**
 * Build x/y scales with sensible defaults.
 *
 * @param options - Scale configuration for each axis.
 */
export function buildScales(options: BuildScalesOptions): BuiltScales {
  return {
    x: buildScale(options.x),
    y: buildScale(options.y)
  };
}

function buildScale(definition: ScaleDefinition<SupportedDomain>): SupportedScale {
  switch (definition.type) {
    case "linear": {
      const domain = normalizeNumericDomain(definition.domain);
      const scale = scaleLinear()
        .domain(domain)
        .range(definition.range)
        .clamp(Boolean(definition.clamp));
      if (definition.nice !== false) {
        scale.nice();
      }
      return scale;
    }
    case "time": {
      const domain = normalizeTimeDomain(definition.domain);
      const scale = scaleTime()
        .domain(domain)
        .range(definition.range);
      if (definition.nice !== false) {
        scale.nice();
      }
      return scale;
    }
    case "band": {
      const scale = scaleBand<CategoricalDomain>()
        .domain(definition.domain as CategoricalDomain[])
        .range(definition.range)
        .paddingInner(definition.paddingInner ?? 0.2)
        .paddingOuter(definition.paddingOuter ?? 0.1);
      return scale;
    }
    case "point": {
      const scale = scalePoint<CategoricalDomain>()
        .domain(definition.domain as CategoricalDomain[])
        .range(definition.range)
        .padding(definition.paddingOuter ?? 0.5);
      return scale;
    }
    default:
      throw new Error(`Unsupported scale type: ${definition.type as string}`);
  }
}

function normalizeNumericDomain(domain: readonly SupportedDomain[]): [number, number] {
  const numeric = (domain as number[]).filter((d) => typeof d === "number" && Number.isFinite(d));
  if (!numeric.length) {
    return [0, 1];
  }
  const [min, max] = extent(numeric) as [number, number];
  if (min === max) {
    return [min - 1, max + 1];
  }
  return [min, max];
}

function normalizeTimeDomain(domain: readonly SupportedDomain[]): [Date, Date] {
  const values = (domain as Date[]).filter((d) => d instanceof Date && !Number.isNaN(d.valueOf()));
  if (!values.length) {
    const now = new Date();
    return [new Date(now.getTime() - 3600_000), now];
  }
  const [min, max] = extent(values, (d: Date) => d.valueOf()) as [number, number];
  if (min === max) {
    return [new Date(min - 3600_000), new Date(max + 3600_000)];
  }
  return [new Date(min), new Date(max)];
}

export type AxisFormatter = (value: AxisDomain, index?: number) => string;

export interface AxisFormatOptions {
  x?: AxisFormatter;
  y?: AxisFormatter;
}

export interface AxisOptions {
  innerWidth: number;
  innerHeight: number;
  theme?: ChartTheme;
  xLabel?: string;
  yLabel?: string;
  tickSize?: number;
  tickPadding?: number;
  tickCount?: number | { x?: number; y?: number };
  format?: AxisFormatOptions;
}

function getTickCount(
  fallback: number,
  provided?: number | { x?: number; y?: number },
  axis?: "x" | "y"
): number {
  if (typeof provided === "number") return provided;
  if (provided && axis && typeof provided[axis] === "number") {
    return provided[axis];
  }
  return fallback;
}

function inferFormatter(domain: readonly SupportedDomain[]): AxisFormatter {
  if (domain.length && domain[0] instanceof Date) {
    return (value: AxisDomain) => formatDate(value as Date);
  }
  if (domain.length && typeof domain[0] === "number") {
    return (value: AxisDomain) => formatNumber(Number(value));
  }
  return (value: AxisDomain) => `${value ?? ""}`;
}

/**
 * Draw bottom and left axes with consistent styling.
 *
 * @param g - Parent group element.
 * @param scales - Built scales.
 * @param options - Rendering options.
 */
export function drawAxes(
  g: SVGGElement,
  scales: BuiltScales,
  options: AxisOptions
): void {
  const theme = options.theme ?? defaultTheme;
  const selection = select(g);
  const xScale = scales.x;
  const yScale = scales.y;
  const tickSize = options.tickSize ?? theme.gridWidth;
  const tickPadding = options.tickPadding ?? 8;
  const xTickCount = Math.max(2, getTickCount(Math.round(options.innerWidth / 80), options.tickCount, "x"));
  const yTickCount = Math.max(2, getTickCount(Math.round(options.innerHeight / 60), options.tickCount, "y"));

  const xAxis = axisBottom(xScale as any)
    .tickSize(tickSize)
    .tickPadding(tickPadding)
    .ticks(xTickCount);

  const yAxis = axisLeft(yScale as any)
    .tickSize(tickSize)
    .tickPadding(tickPadding)
    .ticks(yTickCount);

  const xDomain = (xScale as any).domain?.() as readonly SupportedDomain[];
  const yDomain = (yScale as any).domain?.() as readonly SupportedDomain[];

  const xFormatter = options.format?.x ?? inferFormatter(xDomain);
  const yFormatter = options.format?.y ?? inferFormatter(yDomain);

  xAxis.tickFormat((value: AxisDomain, index: number) => xFormatter(value, index));
  yAxis.tickFormat((value: AxisDomain, index: number) => yFormatter(value, index));

  const xGroup = ensureAxisGroup(selection, "x");
  xGroup
    .attr("class", "axis axis--x")
    .attr("transform", `translate(0, ${pixelAlign(options.innerHeight)})`)
    .call(xAxis as any);

  const yGroup = ensureAxisGroup(selection, "y");
  yGroup.attr("class", "axis axis--y").attr("transform", `translate(${pixelAlign(0)}, 0)`).call(yAxis as any);

  applyAxisStyles(xGroup, theme);
  applyAxisStyles(yGroup, theme);

  updateAxisLabel(xGroup, options.xLabel, options.innerWidth, theme, "axis-label axis-label--x");
  updateAxisLabel(yGroup, options.yLabel, options.innerHeight, theme, "axis-label axis-label--y", true);
}

function ensureAxisGroup(selection: Selection<SVGGElement, unknown, null, undefined>, axis: "x" | "y") {
  const className = axis === "x" ? "axis axis--x" : "axis axis--y";
  let group = selection.select<SVGGElement>(`.axis--${axis}`);
  if (group.empty()) {
    group = selection.append("g").attr("class", className);
  }
  return group;
}

function applyAxisStyles(selection: Selection<SVGGElement, unknown, null, undefined>, theme: ChartTheme) {
  selection
    .attr("vector-effect", "non-scaling-stroke")
    .attr("shape-rendering", "crispEdges")
    .style("font-family", theme.fontFamily)
    .style("font-size", `${theme.fontSize}px`)
    .style("color", theme.fgMuted);

  selection
    .selectAll("path, line")
    .attr("stroke-width", theme.gridWidth)
    .attr("stroke", theme.grid)
    .attr("stroke-opacity", theme.gridAlpha)
    .attr("vector-effect", "non-scaling-stroke");

  selection
    .selectAll("text")
    .attr("fill", theme.fgMuted)
    .style("font-weight", 500);
}

function updateAxisLabel(
  group: Selection<SVGGElement, unknown, null, undefined>,
  label: string | undefined,
  size: number,
  theme: ChartTheme,
  className: string,
  rotate = false
) {
  let text = group.select<SVGTextElement>(`.${className.split(" ").join(".")}`);
  if (!label) {
    text.remove();
    return;
  }
  if (text.empty()) {
    text = group.append("text").attr("class", className) as Selection<SVGTextElement, unknown, null, undefined> ;
  }
  text
    .attr("fill", theme.fg)
    .attr("font-weight", 600)
    .attr("text-anchor", "middle")
    .style("font-family", theme.fontFamily)
    .style("font-size", `${theme.fontSize}px`);

  if (rotate) {
    text
      .attr("transform", `rotate(-90) translate(${-size / 2}, ${-40})`)
      .attr("dy", "0")
      .attr("x", 0)
      .attr("y", 0);
  } else {
    text.attr("x", size / 2).attr("y", 40);
  }
  text.text(label);
}

export interface GridOptions {
  innerWidth: number;
  innerHeight: number;
  theme?: ChartTheme;
  tickCount?: number;
}

/**
 * Render horizontal gridlines using the y-scale.
 */
export function drawGrid(
  g: SVGGElement,
  scales: BuiltScales,
  options: GridOptions
): void {
  const theme = options.theme ?? defaultTheme;
  const selection = select(g);
  const grid = selection.selectAll<SVGGElement>(".grid").data([null]);
  const gridEnter = grid.enter().append("g").attr("class", "grid");
  const gridGroup = gridEnter.merge(grid as any);
  const yScale = scales.y;
  const tickCount = Math.max(2, options.tickCount ?? Math.round(options.innerHeight / 60));
  const axis = axisLeft(yScale as any)
    .tickFormat(() => "")
    .tickSize(-options.innerWidth)
    .ticks(tickCount);
  gridGroup
    .attr("transform", `translate(${pixelAlign(0)}, 0)`)
    .call(axis as any);

  gridGroup
    .selectAll("line")
    .attr("stroke", theme.grid)
    .attr("stroke-width", theme.gridWidth)
    .attr("stroke-opacity", theme.gridAlpha)
    .attr("vector-effect", "non-scaling-stroke")
    .attr("shape-rendering", "crispEdges")
    .attr("opacity", theme.gridAlpha);

  gridGroup.selectAll("path").remove();
}

export interface LegendItem {
  label: string;
  color?: string;
}

export interface LegendOptions {
  width: number;
  theme?: ChartTheme;
  swatchSize?: number;
  gap?: number;
}

/**
 * Draw a responsive horizontal legend that wraps at the provided width.
 */
export function drawLegend(
  g: SVGGElement,
  items: readonly LegendItem[],
  options: LegendOptions
): void {
  const theme = options.theme ?? defaultTheme;
  const swatchSize = options.swatchSize ?? theme.legendDotSize;
  const gap = options.gap ?? 12;
  const width = Math.max(0, options.width);
  const selection = select(g);
  selection.attr("class", "legend");

  const itemSelection = selection
    .selectAll<SVGGElement>("g.legend-item")
    .data(items, (d: LegendItem) => d.label);
  const enter = itemSelection
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("tabindex", 0)
    .attr("role", "listitem")
    .attr("aria-label", (d: LegendItem) => d.label);

  enter
    .append("rect")
    .attr("class", "legend-swatch")
    .attr("width", swatchSize)
    .attr("height", swatchSize)
    .attr("rx", Math.min(theme.barRadius, swatchSize / 2))
    .attr("ry", Math.min(theme.barRadius, swatchSize / 2));

  enter
    .append("text")
    .attr("class", "legend-label")
    .attr("x", swatchSize + gap / 2)
    .attr("y", swatchSize / 2)
    .attr("dy", "0.35em")
    .style("font-family", theme.fontFamily)
    .style("font-size", `${theme.fontSize}px`)
    .style("fill", theme.fg);

  const merged = enter.merge(itemSelection as any);

  const lineHeight = theme.fontSize * 1.6;
  let cursorX = 0;
  let cursorY = 0;

  merged.each(function (this: SVGGElement, d: LegendItem) {
    const group = select(this as SVGGElement);
    const label = group.select<SVGTextElement>("text.legend-label");
    label.text(d.label);
    const approxWidth = swatchSize + gap + d.label.length * (theme.fontSize * 0.6);
    if (cursorX + approxWidth > width && cursorX > 0) {
      cursorX = 0;
      cursorY += lineHeight;
    }
    group.attr("transform", `translate(${cursorX}, ${cursorY})`);
    group
      .select<SVGRectElement>("rect.legend-swatch")
      .attr("fill", d.color ?? theme.accent)
      .attr("stroke", theme.fgMuted)
      .attr("stroke-width", Math.max(0.5, theme.lineWidth / 2))
      .attr("vector-effect", "non-scaling-stroke");
    cursorX += approxWidth + gap;
  });

  itemSelection.exit().remove();
}
