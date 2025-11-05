import { axisBottom, interpolateRgbBasis, scaleLinear, select } from "../lib/vendor/d3-bundle.js";
import { PLAYER_LEADERBOARD_METRICS, formatMetricValue, } from "../lib/players/leaderboard-metrics.js";
import { DEFAULT_WIDTH, MARGIN, METRIC_DOMAINS, RANK_TIER_COLORS, tierLabel, ROW_HEIGHT, VALUE_RAMP, } from "./theme.js";
export function renderLeaderboard(opts) {
    const { el, data, metric = "ppg", colorMode = "value", width = DEFAULT_WIDTH, rowH = ROW_HEIGHT, margin = MARGIN, } = opts;
    const root = typeof el === "string" ? document.querySelector(el) : el;
    if (!root) {
        throw new Error("renderLeaderboard target not found");
    }
    const valueKey = metric;
    const rankKey = `rank_${metric}`;
    const domain = METRIC_DOMAINS[metric] ?? [0, 1];
    const config = PLAYER_LEADERBOARD_METRICS[metric];
    const rows = [...data]
        .filter((row) => Number.isFinite(row[valueKey]) && Number.isFinite(row[rankKey]))
        .sort((a, b) => a[rankKey] - b[rankKey])
        .slice(0, 50);
    const marginBox = { ...margin };
    const originalMarginLeft = marginBox.l;
    const labelPad = 16;
    if (rows.length > 0) {
        const labels = rows.map((datum) => `#${datum[rankKey]} ${datum.name} (${datum.team})`);
        let labelWidth = 0;
        if (typeof document !== "undefined") {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (context) {
                const doc = root.ownerDocument ?? document;
                const view = doc.defaultView;
                const baseStyles = view ? view.getComputedStyle(doc.documentElement) : null;
                const fontFamily = baseStyles?.getPropertyValue("--font-body").trim() || baseStyles?.fontFamily ||
                    "system-ui, -apple-system, 'Segoe UI', sans-serif";
                const fontSize = baseStyles?.getPropertyValue("--font-size").trim() || baseStyles?.fontSize || "14px";
                context.font = `600 ${fontSize} ${fontFamily}`;
                labelWidth = Math.max(0, ...labels.map((label) => context.measureText(label).width));
            }
        }
        if (!labelWidth) {
            const approxCharWidth = 7;
            labelWidth = Math.max(0, ...labels.map((label) => label.length * approxCharWidth));
        }
        marginBox.l = Math.max(marginBox.l, Math.ceil(labelWidth) + labelPad);
    }
    const effectiveWidth = width + (marginBox.l - originalMarginLeft);
    const height = marginBox.t + marginBox.b + rows.length * rowH;
    root.innerHTML = "";
    const svg = select(root)
        .append("svg")
        .attr("class", "players-leaderboard__svg")
        .attr("width", effectiveWidth)
        .attr("height", height);
    const g = svg.append("g").attr("transform", `translate(${marginBox.l},${marginBox.t})`);
    const innerWidth = effectiveWidth - marginBox.l - marginBox.r;
    const innerHeight = height - marginBox.t - marginBox.b;
    const x = scaleLinear().domain(domain).range([0, innerWidth]);
    const interpolate = interpolateRgbBasis(Array.from(VALUE_RAMP));
    const colorValue = (value) => {
        const [d0, d1] = domain;
        const span = d1 - d0 || 1;
        const t = Math.max(0, Math.min(1, (value - d0) / span));
        return interpolate(t);
    };
    const rankDomain = ["Top 5", "6–10", "11–25", "26–50", "51+"];
    const colorRank = (label) => RANK_TIER_COLORS[label] ?? RANK_TIER_COLORS["51+"];
    const barHeight = rowH - 8;
    const formatValue = (value) => formatMetricValue(metric, value);
    rows.forEach((datum, index) => {
        const group = g
            .append("g")
            .attr("class", "players-leaderboard__row")
            .attr("transform", `translate(0, ${index * rowH})`);
        const value = datum[valueKey];
        const rank = datum[rankKey];
        const clamped = Math.min(domain[1], Math.max(domain[0], value));
        group
            .append("rect")
            .attr("class", "players-leaderboard__bar")
            .attr("x", 0)
            .attr("y", 4)
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("height", barHeight)
            .attr("width", x(clamped))
            .attr("fill", colorMode === "rank" ? colorRank(tierLabel(rank)) : colorValue(value));
        group
            .append("text")
            .attr("class", "players-leaderboard__label")
            .attr("x", -12)
            .attr("y", rowH / 2 + 4)
            .attr("text-anchor", "end")
            .attr("font-weight", 600)
            .text(`#${rank} ${datum.name} (${datum.team})`);
        group
            .append("text")
            .attr("class", "players-leaderboard__value")
            .attr("x", x(clamped) + 8)
            .attr("y", rowH / 2 + 4)
            .text(formatValue(value));
        if (value > domain[1]) {
            group
                .append("text")
                .attr("class", "players-leaderboard__outlier")
                .attr("x", x(domain[1]) + 12)
                .attr("y", rowH / 2 + 4)
                .text(`+${formatValue(value - domain[1])}`)
                .append("title")
                .text(`${formatValue(value)} (${metric.toUpperCase()})`);
        }
    });
    const axis = axisBottom(x)
        .ticks(6)
        .tickFormat((tick) => formatValue(Number(tick)))
        .tickSizeOuter(0);
    const axisGroup = g
        .append("g")
        .attr("class", "players-leaderboard__axis")
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(axis);
    axisGroup
        .selectAll("path, line")
        .attr("stroke", "var(--players-axis-stroke, #334155)")
        .attr("stroke-width", 1);
    axisGroup
        .selectAll("text")
        .attr("fill", "var(--players-axis-text, #cbd5f5)")
        .attr("font-size", 12)
        .attr("font-family", "var(--font-sans, 'Inter', system-ui)");
    const legend = svg
        .append("g")
        .attr("class", "players-leaderboard__legend")
        .attr("transform", `translate(${marginBox.l}, ${marginBox.t - 12})`);
    if (colorMode === "value") {
        const gradientId = `players-leaderboard-ramp-${metric}`;
        const defs = svg.append("defs");
        const gradient = defs
            .append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "0%");
        VALUE_RAMP.forEach((stopColor, index) => {
            gradient
                .append("stop")
                .attr("offset", `${(index / (VALUE_RAMP.length - 1)) * 100}%`)
                .attr("stop-color", stopColor);
        });
        legend
            .append("rect")
            .attr("width", 160)
            .attr("height", 10)
            .attr("rx", 4)
            .attr("fill", `url(#${gradientId})`);
        legend
            .append("text")
            .attr("x", 168)
            .attr("y", 9)
            .attr("class", "players-leaderboard__legend-label")
            .text(`${config?.shortLabel ?? metric.toUpperCase()} (${config?.legendLabel ?? "Average per game"})`);
    }
    else {
        rankDomain.forEach((tier, index) => {
            const item = legend
                .append("g")
                .attr("class", "players-leaderboard__legend-item")
                .attr("transform", `translate(${index * 120}, -10)`);
            item
                .append("rect")
                .attr("width", 12)
                .attr("height", 12)
                .attr("rx", 3)
                .attr("fill", colorRank(tier));
            item
                .append("text")
                .attr("x", 18)
                .attr("y", 10)
                .attr("class", "players-leaderboard__legend-label")
                .text(tier);
        });
    }
}
