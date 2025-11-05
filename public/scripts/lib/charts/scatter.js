/**
 * Scatter series renderer.
 * @module charts/scatter
 */
import { select } from "../vendor/d3-bundle.js";
import { defaultTheme } from "./theme.js";
function position(scale, value) {
    if (typeof scale.bandwidth === "function") {
        const band = scale(value);
        const bandwidth = scale.bandwidth();
        if (typeof band === "number") {
            return band + bandwidth / 2;
        }
    }
    const scaled = scale(value instanceof Date ? value : value);
    if (typeof scaled === "number") {
        return scaled;
    }
    throw new Error("Unable to determine scatter point position");
}
function positionY(scale, value) {
    const scaled = scale(value);
    if (typeof scaled === "number") {
        return scaled;
    }
    throw new Error("Unable to determine scatter y position");
}
/**
 * Render scatter plot points.
 */
export function renderScatter(g, data, scales, options = {}) {
    const theme = options.theme ?? defaultTheme;
    const baseRadius = options.radius ?? theme.legendDotSize / 2;
    const strokeColor = options.stroke ?? theme.bg;
    const selection = select(g);
    const join = selection
        .selectAll("circle.series--scatter")
        .data(data, (d) => `${d.x}-${d.y}`);
    const enter = join
        .enter()
        .append("circle")
        .attr("class", "series series--scatter")
        .attr("vector-effect", "non-scaling-stroke");
    const merged = enter.merge(join);
    merged
        .attr("cx", (datum) => position(scales.x, datum.x))
        .attr("cy", (datum) => positionY(scales.y, datum.y))
        .attr("r", (datum) => {
        if (Number.isFinite(datum.r)) {
            return Math.max(1, Number(datum.r));
        }
        return Math.max(1, baseRadius);
    })
        .attr("fill", (datum) => datum.color ?? theme.accent)
        .attr("stroke", strokeColor)
        .attr("stroke-width", Math.max(0.5, theme.lineWidth / 1.5))
        .attr("opacity", 0.9)
        .attr("role", "presentation")
        .attr("aria-hidden", "true");
    join.exit().remove();
    return merged;
}
