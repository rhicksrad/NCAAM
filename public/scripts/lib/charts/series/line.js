/**
 * Line series renderer.
 * @module charts/series/line
 */
import { line as d3Line, curveLinear, curveMonotoneX } from "d3-shape";
import { select } from "d3-selection";
import { defaultTheme } from "../theme.js";
const prefersReducedMotion = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};
function position(scale, value) {
    const scaled = scale(value instanceof Date ? value : value);
    if (typeof scaled === "number") {
        return scaled;
    }
    if (typeof scale.bandwidth === "function") {
        const band = scale(value);
        const bandwidth = scale.bandwidth();
        if (typeof band === "number") {
            return band + bandwidth / 2;
        }
    }
    throw new Error("Unable to determine line position");
}
function valueY(scale, value) {
    const scaled = scale(value);
    if (typeof scaled === "number") {
        return scaled;
    }
    throw new Error("Unable to determine y position");
}
/**
 * Render a line path.
 */
export function renderLine(g, data, scales, options = {}) {
    const theme = options.theme ?? defaultTheme;
    const selection = select(g);
    const path = selection
        .selectAll("path.series--line")
        .data([data]);
    const enter = path
        .enter()
        .append("path")
        .attr("class", "series series--line")
        .attr("fill", "none")
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round")
        .attr("vector-effect", "non-scaling-stroke");
    const merged = enter.merge(path);
    const lineGenerator = d3Line()
        .defined(options.defined ?? ((datum) => Number.isFinite(datum.y)))
        .x((datum) => position(scales.x, datum.x))
        .y((datum) => valueY(scales.y, datum.y))
        .curve(options.smoothing ? curveMonotoneX : curveLinear);
    const dAttribute = lineGenerator(data);
    merged
        .attr("stroke", options.stroke ?? theme.accent)
        .attr("stroke-width", options.strokeWidth ?? theme.lineWidth * 1.5)
        .attr("aria-label", options.ariaLabel ?? "Line series")
        .attr("d", dAttribute ?? "");
    if (!prefersReducedMotion() && merged.node()) {
        const node = merged.node();
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
    return merged.node();
}
