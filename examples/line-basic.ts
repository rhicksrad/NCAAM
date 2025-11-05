/**
 * Basic line and area chart example with keyboard-focusable points.
 */

import { extent, select } from "../src/lib/vendor/d3-bundle.js";
import { buildScales, drawAxes, drawGrid, drawLegend } from "../src/lib/charts/axes";
import { computeInnerSize, createSVG } from "../src/lib/charts/frame";
import { renderArea } from "../src/lib/charts/area";
import { renderLine } from "../src/lib/charts/line";
import { createTooltip } from "../src/lib/charts/tooltip";
import { applyTheme, defaultTheme, formatDate, formatNumber, resolveColor } from "../src/lib/charts/theme";

type LineDatum = {
  x: Date;
  y: number;
};

const margin = { top: 56, right: 32, bottom: 64, left: 72 };

const data: LineDatum[] = [
  { x: new Date("2024-11-01"), y: 68 },
  { x: new Date("2024-12-01"), y: 70 },
  { x: new Date("2025-01-01"), y: 74 },
  { x: new Date("2025-02-01"), y: 73 },
  { x: new Date("2025-03-01"), y: 78 },
  { x: new Date("2025-04-01"), y: 80 }
];

function render(container: HTMLElement) {
  applyTheme(container, defaultTheme);
  container.innerHTML = "";
  const tooltip = createTooltip(container);
  const width = container.clientWidth || 680;
  const height = 380;
  const svg = createSVG(container, width, height, {
    title: "Season efficiency",
    description: "Monthly offensive efficiency"
  });

  const plot = select(svg)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const { iw, ih } = computeInnerSize(width, height, margin);
  const xDomain = extent(data, (d) => d.x) as [Date, Date];
  const yValues = data.map((d) => d.y);
  const yMin = Math.min(...yValues, 60);
  const yMax = Math.max(...yValues) + 5;

  const scales = buildScales({
    x: {
      type: "time",
      domain: xDomain,
      range: [0, iw],
      nice: true
    },
    y: {
      type: "linear",
      domain: [yMin, yMax],
      range: [ih, 0],
      nice: true
    }
  });

  drawGrid(plot.append("g").node() as SVGGElement, scales, {
    innerWidth: iw,
    innerHeight: ih,
    theme: defaultTheme
  });

  renderArea(plot.append("g").node() as SVGGElement, data, scales, {
    theme: {
      ...defaultTheme,
      accentMuted: resolveColor(0, { palette: "cool" })
    },
    fill: resolveColor(1, { palette: "cool" }),
    opacity: 0.35,
    smoothing: true,
    baseline: yMin
  });

  renderLine(plot.append("g").node() as SVGGElement, data, scales, {
    theme: defaultTheme,
    stroke: resolveColor(2, { palette: "cool" }),
    smoothing: true,
    strokeWidth: 2.5
  });

  const focusLayer = plot.append("g").attr("class", "series series--points");
  const points = focusLayer
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
    .attr("r", 4.5)
    .attr("fill", resolveColor(2, { palette: "cool" }))
    .attr("stroke", defaultTheme.bg)
    .attr("stroke-width", 2)
    .attr("tabindex", 0)
    .attr("cx", (d) => (scales.x as any)(d.x))
    .attr("cy", (d) => (scales.y as any)(d.y));

  const moveTooltip = (target: Element, datum: LineDatum) => {
    const rect = target.getBoundingClientRect();
    const parentRect = container.getBoundingClientRect();
    const x = rect.left - parentRect.left + rect.width / 2;
    const y = rect.top - parentRect.top - 16;
    tooltip.show(
      x,
      y,
      `<strong>${formatDate(datum.x)}</strong><br>${formatNumber(datum.y)} pts`
    );
  };

  points
    .on("mouseenter", function (event, datum) {
      moveTooltip(this as Element, datum);
    })
    .on("mouseleave", () => tooltip.hide())
    .on("focus", function (event, datum) {
      moveTooltip(this as Element, datum);
    })
    .on("blur", () => tooltip.hide())
    .on("mousemove", function (event, datum) {
      moveTooltip(this as Element, datum);
    });

  drawAxes(plot.append("g").node() as SVGGElement, scales, {
    innerWidth: iw,
    innerHeight: ih,
    xLabel: "Month",
    yLabel: "Points per 100 possessions",
    theme: defaultTheme,
    format: {
      x: (value) => formatDate(value as Date, { month: "short" }),
      y: (value) => formatNumber(value as number)
    }
  });

  const legendGroup = plot.append("g").attr("transform", `translate(0, ${-margin.top + 16})`);
  drawLegend(legendGroup.node() as SVGGElement, [{ label: "Offensive efficiency" }], {
    width: iw,
    theme: defaultTheme,
    swatchSize: 12,
    gap: 16
  });
}

export function mountLineExample(selector: string) {
  if (typeof document === "undefined") return;
  const container = document.querySelector<HTMLElement>(selector);
  if (!container) return;

  const draw = () => {
    container.innerHTML = "";
    render(container);
  };

  draw();
  const observer = new ResizeObserver(() => {
    window.requestAnimationFrame(draw);
  });
  observer.observe(container);
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    mountLineExample("#line-basic");
  });
}
