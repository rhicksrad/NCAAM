/**
 * Chart framing utilities.
 * @module charts/frame
 */

import { applyTheme, defaultTheme } from "./theme.js";
import type { ChartTheme } from "./theme.js";

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CreateSVGOptions {
  title?: string;
  description?: string;
  id?: string;
  theme?: ChartTheme;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Create an accessible, responsive SVG element within a container.
 *
 * @param container - Host element for the SVG.
 * @param width - Initial width in pixels.
 * @param height - Initial height in pixels.
 * @param options - Title/description metadata.
 */
export function createSVG(
  container: HTMLElement,
  width: number,
  height: number,
  options: CreateSVGOptions = {}
): SVGSVGElement {
  const doc = container.ownerDocument ?? document;
  const theme = options.theme ?? defaultTheme;
  if (!container.classList.contains("chart-surface")) {
    container.classList.add("chart-surface");
  }
  applyTheme(container, theme);
  const svg = doc.createElementNS(SVG_NS, "svg");
  const viewWidth = Math.max(1, width);
  const viewHeight = Math.max(1, height);
  const existingCount = container.querySelectorAll("svg.chart").length;
  const baseId =
    options.id ??
    `${container.id || container.getAttribute("data-chart-id") || "chart"}-${existingCount + 1}`;
  const titleId = `${baseId}-title`;
  const descId = `${baseId}-desc`;

  svg.setAttribute("class", "chart");
  svg.setAttribute("role", "img");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("viewBox", `0 0 ${viewWidth} ${viewHeight}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("vector-effect", "non-scaling-stroke");
  svg.setAttribute("shape-rendering", "geometricPrecision");
  svg.dataset.chartId = baseId;

  const title = doc.createElementNS(SVG_NS, "title");
  title.textContent = options.title ?? "Data visualization";
  title.id = titleId;
  const desc = doc.createElementNS(SVG_NS, "desc");
  desc.textContent = options.description ?? "An interactive chart";
  desc.id = descId;
  svg.appendChild(title);
  svg.appendChild(desc);
  svg.setAttribute("aria-labelledby", `${titleId} ${descId}`);

  container.appendChild(svg);
  return svg;
}

/**
 * Compute inner chart dimensions based on margin convention.
 *
 * @param width - Outer width.
 * @param height - Outer height.
 * @param margin - Margin in pixels.
 */
export function computeInnerSize(
  width: number,
  height: number,
  margin: Margin
): { iw: number; ih: number } {
  const iw = Math.max(0, width - margin.left - margin.right);
  const ih = Math.max(0, height - margin.top - margin.bottom);
  return { iw, ih };
}

/**
 * Align 1px strokes to device pixels for crisp rendering.
 *
 * @param value - Value in pixels.
 */
export function pixelAlign(value: number): number {
  return Math.round(value) + 0.5;
}
