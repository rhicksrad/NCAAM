/**
 * Area series renderer.
 * @module charts/series/area
 */
import { area as d3Area, curveLinear, curveMonotoneX, select } from "../../vendor/d3-bundle.js";
import { defaultTheme } from "../theme.js";
function position(scale, value) {
    const scaled = scale(value instanceof Date ? value : value);
    if (typeof scaled === "number")
        return scaled;
    if (typeof scale.bandwidth === "function") {
        const band = scale(value);
        const bandwidth = scale.bandwidth();
        if (typeof band === "number") {
            return band + bandwidth / 2;
        }
    }
    throw new Error("Unable to determine area x position");
}
function valueY(scale, value) {
    const scaled = scale(value);
    if (typeof scaled === "number")
        return scaled;
    throw new Error("Unable to determine area y position");
}
/**
 * Render an area shape.
 */
export function renderArea(g, data, scales, options = {}) {
    const theme = options.theme ?? defaultTheme;
    const selection = select(g);
    const path = selection
        .selectAll("path.series--area")
        .data([data]);
    const enter = path
        .enter()
        .append("path")
        .attr("class", "series series--area")
        .attr("vector-effect", "non-scaling-stroke");
    const merged = enter.merge(path);
    const yRange = scales.y.range?.();
    const baseline = options.baseline !== undefined
        ? valueY(scales.y, options.baseline)
        : Array.isArray(yRange)
            ? Math.max(...yRange)
            : 0;
    const areaGenerator = d3Area()
        .defined(options.defined ?? ((datum) => Number.isFinite(datum.y)))
        .x((datum) => position(scales.x, datum.x))
        .y1((datum) => valueY(scales.y, datum.y))
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
    return merged.node();
}
