/**
 * Axes and scale helpers.
 * @module charts/axes
 */
import { axisBottom, axisLeft, extent, scaleBand, scaleLinear, scalePoint, scaleTime, select } from "../vendor/d3-bundle.js";
import { pixelAlign } from "./frame.js";
import { defaultTheme, formatDate, formatNumber } from "./theme.js";
/**
 * Build x/y scales with sensible defaults.
 *
 * @param options - Scale configuration for each axis.
 */
export function buildScales(options) {
    return {
        x: buildScale(options.x),
        y: buildScale(options.y)
    };
}
function buildScale(definition) {
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
            const scale = scaleBand()
                .domain(definition.domain)
                .range(definition.range)
                .paddingInner(definition.paddingInner ?? 0.2)
                .paddingOuter(definition.paddingOuter ?? 0.1);
            return scale;
        }
        case "point": {
            const scale = scalePoint()
                .domain(definition.domain)
                .range(definition.range)
                .padding(definition.paddingOuter ?? 0.5);
            return scale;
        }
        default:
            throw new Error(`Unsupported scale type: ${definition.type}`);
    }
}
function normalizeNumericDomain(domain) {
    const numeric = domain.filter((d) => typeof d === "number" && Number.isFinite(d));
    if (!numeric.length) {
        return [0, 1];
    }
    const [min, max] = extent(numeric);
    if (min === max) {
        return [min - 1, max + 1];
    }
    return [min, max];
}
function normalizeTimeDomain(domain) {
    const values = domain.filter((d) => d instanceof Date && !Number.isNaN(d.valueOf()));
    if (!values.length) {
        const now = new Date();
        return [new Date(now.getTime() - 3600_000), now];
    }
    const [min, max] = extent(values, (d) => d.valueOf());
    if (min === max) {
        return [new Date(min - 3600_000), new Date(max + 3600_000)];
    }
    return [new Date(min), new Date(max)];
}
function getTickCount(fallback, provided, axis) {
    if (typeof provided === "number")
        return provided;
    if (provided && axis && typeof provided[axis] === "number") {
        return provided[axis];
    }
    return fallback;
}
function inferFormatter(domain) {
    if (domain.length && domain[0] instanceof Date) {
        return (value) => formatDate(value);
    }
    if (domain.length && typeof domain[0] === "number") {
        return (value) => formatNumber(Number(value));
    }
    return (value) => `${value ?? ""}`;
}
/**
 * Draw bottom and left axes with consistent styling.
 *
 * @param g - Parent group element.
 * @param scales - Built scales.
 * @param options - Rendering options.
 */
export function drawAxes(g, scales, options) {
    const theme = options.theme ?? defaultTheme;
    const selection = select(g);
    const xScale = scales.x;
    const yScale = scales.y;
    const tickSize = options.tickSize ?? theme.lineWidth;
    const tickPadding = options.tickPadding ?? 8;
    const xTickCount = Math.max(2, getTickCount(Math.round(options.innerWidth / 80), options.tickCount, "x"));
    const yTickCount = Math.max(2, getTickCount(Math.round(options.innerHeight / 60), options.tickCount, "y"));
    const xAxis = axisBottom(xScale)
        .tickSize(tickSize)
        .tickPadding(tickPadding)
        .ticks(xTickCount);
    const yAxis = axisLeft(yScale)
        .tickSize(tickSize)
        .tickPadding(tickPadding)
        .ticks(yTickCount);
    const xDomain = xScale.domain?.();
    const yDomain = yScale.domain?.();
    const xFormatter = options.format?.x ?? inferFormatter(xDomain);
    const yFormatter = options.format?.y ?? inferFormatter(yDomain);
    xAxis.tickFormat((value, index) => xFormatter(value, index));
    yAxis.tickFormat((value, index) => yFormatter(value, index));
    const xGroup = ensureAxisGroup(selection, "x");
    xGroup
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0, ${pixelAlign(options.innerHeight)})`)
        .call(xAxis);
    const yGroup = ensureAxisGroup(selection, "y");
    yGroup.attr("class", "axis axis--y").attr("transform", `translate(${pixelAlign(0)}, 0)`).call(yAxis);
    applyAxisStyles(xGroup, theme);
    applyAxisStyles(yGroup, theme);
    updateAxisLabel(xGroup, options.xLabel, options.innerWidth, theme, "axis-label axis-label--x");
    updateAxisLabel(yGroup, options.yLabel, options.innerHeight, theme, "axis-label axis-label--y", true);
}
function ensureAxisGroup(selection, axis) {
    const className = axis === "x" ? "axis axis--x" : "axis axis--y";
    let group = selection.select(`.axis--${axis}`);
    if (group.empty()) {
        group = selection.append("g").attr("class", className);
    }
    return group;
}
function applyAxisStyles(selection, theme) {
    selection
        .attr("vector-effect", "non-scaling-stroke")
        .attr("shape-rendering", "crispEdges")
        .style("font-family", theme.fontFamily)
        .style("font-size", `${theme.fontSize}px`)
        .style("color", theme.fg)
        .selectAll("path, line")
        .attr("stroke-width", theme.lineWidth)
        .attr("stroke", theme.fgMuted)
        .attr("vector-effect", "non-scaling-stroke");
    selection.selectAll("text").attr("fill", theme.fg).style("font-weight", 500);
}
function updateAxisLabel(group, label, size, theme, className, rotate = false) {
    let text = group.select(`.${className.split(" ").join(".")}`);
    if (!label) {
        text.remove();
        return;
    }
    if (text.empty()) {
        text = group.append("text").attr("class", className);
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
    }
    else {
        text.attr("x", size / 2).attr("y", 40);
    }
    text.text(label);
}
/**
 * Render horizontal gridlines using the y-scale.
 */
export function drawGrid(g, scales, options) {
    const theme = options.theme ?? defaultTheme;
    const selection = select(g);
    const grid = selection.selectAll(".grid").data([null]);
    const gridEnter = grid.enter().append("g").attr("class", "grid");
    const gridGroup = gridEnter.merge(grid);
    const yScale = scales.y;
    const tickCount = Math.max(2, options.tickCount ?? Math.round(options.innerHeight / 60));
    const axis = axisLeft(yScale)
        .tickFormat(() => "")
        .tickSize(-options.innerWidth)
        .ticks(tickCount);
    gridGroup
        .attr("transform", `translate(${pixelAlign(0)}, 0)`)
        .call(axis);
    gridGroup
        .selectAll("line")
        .attr("stroke", theme.grid)
        .attr("stroke-width", theme.gridWidth)
        .attr("vector-effect", "non-scaling-stroke")
        .attr("shape-rendering", "crispEdges")
        .attr("opacity", 0.7);
    gridGroup.selectAll("path").remove();
}
/**
 * Draw a responsive horizontal legend that wraps at the provided width.
 */
export function drawLegend(g, items, options) {
    const theme = options.theme ?? defaultTheme;
    const swatchSize = options.swatchSize ?? 12;
    const gap = options.gap ?? 12;
    const width = Math.max(0, options.width);
    const selection = select(g);
    selection.attr("class", "legend");
    const itemSelection = selection
        .selectAll("g.legend-item")
        .data(items, (d) => d.label);
    const enter = itemSelection
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("tabindex", 0)
        .attr("role", "listitem")
        .attr("aria-label", (d) => d.label);
    enter
        .append("rect")
        .attr("class", "legend-swatch")
        .attr("width", swatchSize)
        .attr("height", swatchSize)
        .attr("rx", Math.min(4, swatchSize / 2))
        .attr("ry", Math.min(4, swatchSize / 2));
    enter
        .append("text")
        .attr("class", "legend-label")
        .attr("x", swatchSize + gap / 2)
        .attr("y", swatchSize / 2)
        .attr("dy", "0.35em")
        .style("font-family", theme.fontFamily)
        .style("font-size", `${theme.fontSize}px`)
        .style("fill", theme.fg);
    const merged = enter.merge(itemSelection);
    const lineHeight = theme.fontSize * 1.6;
    let cursorX = 0;
    let cursorY = 0;
    merged.each(function (d) {
        const group = select(this);
        const label = group.select("text.legend-label");
        label.text(d.label);
        const approxWidth = swatchSize + gap + d.label.length * (theme.fontSize * 0.6);
        if (cursorX + approxWidth > width && cursorX > 0) {
            cursorX = 0;
            cursorY += lineHeight;
        }
        group.attr("transform", `translate(${cursorX}, ${cursorY})`);
        group
            .select("rect.legend-swatch")
            .attr("fill", d.color ?? theme.accent)
            .attr("stroke", theme.fgMuted)
            .attr("stroke-width", theme.lineWidth / 2)
            .attr("vector-effect", "non-scaling-stroke");
        cursorX += approxWidth + gap;
    });
    itemSelection.exit().remove();
}
