/**
 * Basic categorical bar chart example.
 */

import { select } from "d3-selection";
import { buildScales, drawAxes, drawGrid } from "../src/lib/charts/axes";
import { computeInnerSize, createSVG } from "../src/lib/charts/frame";
import { renderBars } from "../src/lib/charts/series/bar";
import { createTooltip } from "../src/lib/charts/tooltip";
import { applyTheme, defaultTheme, formatNumber, resolveColor } from "../src/lib/charts/theme";

type ExampleDatum = {
  x: string;
  y: number;
};

const margin = { top: 56, right: 24, bottom: 64, left: 72 };

const data: ExampleDatum[] = [
  { x: "Connecticut", y: 82 },
  { x: "Purdue", y: 78 },
  { x: "Houston", y: 74 },
  { x: "Arizona", y: 70 },
  { x: "Tennessee", y: 68 },
  { x: "North Carolina", y: 67 }
];

function attachTooltip(container: HTMLElement) {
  const tooltip = createTooltip(container);
  return {
    show(target: Element, datum: ExampleDatum) {
      const rect = target.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      const x = rect.left - parentRect.left + rect.width / 2;
      const y = rect.top - parentRect.top - 12;
      tooltip.show(x, y, `<strong>${datum.x}</strong><br>${formatNumber(datum.y)} pts`);
    },
    move(target: Element) {
      const rect = target.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      const x = rect.left - parentRect.left + rect.width / 2;
      const y = rect.top - parentRect.top - 12;
      tooltip.move(x, y);
    },
    hide() {
      tooltip.hide();
    }
  };
}

function render(container: HTMLElement) {
  applyTheme(container, defaultTheme);
  container.innerHTML = "";
  const tooltip = attachTooltip(container);
  const width = container.clientWidth || 640;
  const height = 360;
  const svg = createSVG(container, width, height, {
    title: "Top offenses",
    description: "Bar chart of adjusted offensive rating"
  });

  const plot = select(svg)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  const { iw, ih } = computeInnerSize(width, height, margin);
  const maxValue = Math.max(...data.map((d) => d.y)) * 1.1;
  const scales = buildScales({
    x: {
      type: "band",
      domain: data.map((d) => d.x),
      range: [0, iw],
      paddingInner: 0.4,
      paddingOuter: 0.2
    },
    y: {
      type: "linear",
      domain: [0, maxValue],
      range: [ih, 0],
      nice: true
    }
  });

  drawGrid(plot.append("g").node() as SVGGElement, scales, { innerWidth: iw, innerHeight: ih, theme: defaultTheme });

  const bars = renderBars(plot.append("g").node() as SVGGElement, data, scales, {
    theme: {
      ...defaultTheme,
      accent: resolveColor(0)
    },
    gap: 8,
    minWidth: 12,
    innerHeight: ih,
    baseline: 0
  });

  bars
    .attr("tabindex", 0)
    .attr("fill", (datum, i) => resolveColor(i))
    .on("mouseenter", function (event, datum) {
      tooltip.show(this as Element, datum);
    })
    .on("mouseleave", () => tooltip.hide())
    .on("focus", function (event, datum) {
      tooltip.show(this as Element, datum);
    })
    .on("blur", () => tooltip.hide())
    .on("mousemove", function () {
      tooltip.move(this as Element);
    });

  drawAxes(plot.append("g").node() as SVGGElement, scales, {
    innerWidth: iw,
    innerHeight: ih,
    xLabel: "Program",
    yLabel: "Points per 100 possessions",
    theme: defaultTheme,
    format: {
      y: (value) => formatNumber(value as number)
    }
  });
}

export function mountBarExample(selector: string) {
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
    mountBarExample("#bar-basic");
  });
}
