/**
 * Bar series renderer.
 * @module charts/series/bar
 */
import { select } from "d3-selection";
import { defaultTheme } from "../theme.js";
function isBandScale(scale) {
    return typeof scale.bandwidth === "function";
}
function getXPosition(scale, value) {
    if (isBandScale(scale)) {
        const start = scale(value);
        if (typeof start === "number") {
            return start + scale.bandwidth() / 2;
        }
    }
    const result = scale(value instanceof Date ? value : value);
    if (typeof result === "number")
        return result;
    throw new Error("Unable to position bar");
}
function getBaseY(scale, value) {
    const result = scale(value);
    if (typeof result === "number")
        return result;
    throw new Error("Unable to compute bar height");
}
function computeWidth(scale, positions, options) {
    if (isBandScale(scale)) {
        const bw = scale.bandwidth();
        return Math.max(options.minWidth, bw - options.gap);
    }
    const sorted = [...positions].sort((a, b) => a - b);
    let minGap = Infinity;
    for (let i = 1; i < sorted.length; i += 1) {
        const gap = sorted[i] - sorted[i - 1];
        if (gap > 0 && gap < minGap) {
            minGap = gap;
        }
    }
    if (!Number.isFinite(minGap)) {
        minGap = 40;
    }
    return Math.max(options.minWidth, minGap - options.gap);
}
/**
 * Render bar rectangles.
 */
export function renderBars(g, data, scales, options) {
    const theme = options.theme ?? defaultTheme;
    const gap = options.gap ?? 4;
    const minWidth = options.minWidth ?? 4;
    const selection = select(g);
    const join = selection
        .selectAll("rect.series--bar")
        .data(data, (d) => d.x);
    const enter = join
        .enter()
        .append("rect")
        .attr("class", "series series--bar")
        .attr("rx", options.cornerRadius ?? 2)
        .attr("ry", options.cornerRadius ?? 2)
        .attr("vector-effect", "non-scaling-stroke");
    const merged = enter.merge(join);
    const positions = data.map((d) => getXPosition(scales.x, d.x));
    const width = computeWidth(scales.x, positions, { gap, minWidth });
    const baseline = getBaseY(scales.y, options.baseline ?? 0);
    merged
        .attr("fill", theme.accent)
        .attr("stroke", theme.fgMuted)
        .attr("stroke-width", theme.lineWidth / 2)
        .attr("width", Math.max(1, width))
        .attr("role", "presentation")
        .attr("aria-hidden", "true");
    merged.each(function (datum, index) {
        const xPos = positions[index];
        const valueY = getBaseY(scales.y, datum.y);
        const positive = valueY <= baseline;
        const height = Math.max(0, positive ? baseline - valueY : valueY - baseline);
        const y = positive ? valueY : baseline;
        select(this)
            .attr("x", xPos - width / 2)
            .attr("y", Math.min(options.innerHeight, y))
            .attr("height", height);
    });
    join.exit().remove();
    return merged;
}
