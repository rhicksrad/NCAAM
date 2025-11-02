/**
 * Area series renderer.
 * @module charts/series/area
 */
import { area as d3Area, curveLinear, curveMonotoneX } from "d3-shape";
import { select } from "d3-selection";
import { defaultTheme } from "../theme";
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
    const path = selection.selectAll("path.series--area").data([null]);
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
        .defined(options.defined ?? ((d) => Number.isFinite(d.y)))
        .x((d) => position(scales.x, d.x))
        .y1((d) => valueY(scales.y, d.y))
        .y0(() => baseline)
        .curve(options.smoothing ? curveMonotoneX : curveLinear);
    const dAttribute = areaGenerator(data);
    merged
        .attr("fill", options.fill ?? theme.accentMuted)
        .attr("fill-opacity", options.opacity ?? 0.6)
        .attr("d", dAttribute ?? "");
    path.exit().remove();
    return merged.node();
}
