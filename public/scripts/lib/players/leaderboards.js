import { buildScales, drawAxes } from "../charts/axes.js";
import { computeInnerSize, createSVG } from "../charts/frame.js";
import { renderBars } from "../charts/series/bar.js";
import { defaultTheme, formatNumber } from "../charts/theme.js";
import { DEFAULT_METRIC_ORDER, loadLeaderboardDocument, } from "./data.js";
const CHART_DIMENSIONS = {
    width: 720,
    height: 360,
    margin: { top: 28, right: 24, bottom: 52, left: 52 },
};
export async function renderLeaderboardFeature(grid, intro) {
    const skeleton = createSkeletonCard();
    grid.innerHTML = "";
    grid.appendChild(skeleton);
    try {
        const document = await loadLeaderboardDocument();
        const metrics = document.metrics ?? {};
        const orderedIds = buildMetricOrder(metrics);
        if (intro) {
            const updated = new Date(document.generatedAt);
            const updatedText = Number.isNaN(updated.valueOf())
                ? "recent updates"
                : updated.toLocaleDateString();
            intro.textContent = `Top 10 leaders for ${document.season}. Updated ${updatedText}.`;
        }
        grid.innerHTML = "";
        if (!orderedIds.length) {
            grid.innerHTML = `<p class="stat-card stat-card--empty">No leaderboard data available right now.</p>`;
            return;
        }
        for (const id of orderedIds) {
            const metric = metrics[id];
            if (!metric)
                continue;
            grid.appendChild(createLeaderboardCard(id, metric, document));
        }
    }
    catch (error) {
        console.error(error);
        grid.innerHTML = `<p class="stat-card stat-card--error">We couldn't load the leaderboard data. Please try again later.</p>`;
    }
}
function buildMetricOrder(metrics) {
    const available = DEFAULT_METRIC_ORDER.filter((id) => metrics[id]);
    const extras = Object.keys(metrics).filter((id) => !DEFAULT_METRIC_ORDER.includes(id));
    return [...available, ...extras];
}
function createSkeletonCard() {
    const card = document.createElement("article");
    card.className = "stat-card stat-card--loading";
    card.innerHTML = `<div class="stat-card__loading">Loading leaderboards…</div>`;
    return card;
}
function createLeaderboardCard(metricId, metric, leaderboardDoc) {
    const card = document.createElement("article");
    card.className = "stat-card";
    const chartId = `metric-chart-${metricId}`;
    const description = `${metric.label} leaders for ${leaderboardDoc.season}`;
    card.innerHTML = `
    <header class="stat-card__head">
      <div class="stat-card__labels">
        <p class="stat-card__eyebrow">${metric.label}</p>
        <h3 class="stat-card__title">${metric.shortLabel} – Top 10</h3>
      </div>
      <span class="stat-card__season">${leaderboardDoc.season}</span>
    </header>
    <div id="${chartId}" class="stat-card__chart" role="img" aria-label="${description}"></div>
    <ol class="stat-card__list" aria-label="${description}"></ol>
  `;
    const chartHost = card.querySelector(`#${CSS.escape(chartId)}`);
    const list = card.querySelector(".stat-card__list");
    const leaders = (metric.leaders ?? []).slice(0, 10);
    if (chartHost) {
        renderMetricChart(chartHost, metric, leaderboardDoc);
    }
    if (list) {
        list.innerHTML = "";
        leaders.forEach((leader, index) => {
            const item = document.createElement("li");
            item.className = "stat-card__leader";
            item.innerHTML = `
        <span class="stat-card__rank">${index + 1}</span>
        <div class="stat-card__player">
          <span class="stat-card__name">${leader.name}</span>
          <span class="stat-card__team">${leader.team}</span>
        </div>
        <span class="stat-card__value">${leader.valueFormatted ?? formatNumber(leader.value)}</span>
      `;
            list.appendChild(item);
        });
    }
    return card;
}
function renderMetricChart(container, metric, leaderboardDoc) {
    const leaders = (metric.leaders ?? []).slice(0, 10);
    if (!leaders.length) {
        container.innerHTML = `<p class="stat-card__empty">No data available.</p>`;
        return;
    }
    const { width, height, margin } = CHART_DIMENSIONS;
    const { iw, ih } = computeInnerSize(width, height, margin);
    const svg = createSVG(container, width, height, {
        title: `${metric.label} leaders`,
        description: `Top 10 ${metric.label.toLowerCase()} for ${leaderboardDoc.season}`,
    });
    const plot = svg.ownerDocument.createElementNS(svg.namespaceURI, "g");
    plot.setAttribute("transform", `translate(${margin.left},${margin.top})`);
    svg.appendChild(plot);
    const data = leaders.map((leader, index) => ({
        x: index + 1,
        y: leader.value,
    }));
    const scales = buildScales({
        x: {
            type: "band",
            domain: data.map((datum) => datum.x),
            range: [0, iw],
            paddingInner: 0.4,
            paddingOuter: 0.25,
        },
        y: {
            type: "linear",
            domain: [0, Math.max(...data.map((datum) => datum.y)) * 1.05],
            range: [ih, 0],
            nice: true,
            clamp: true,
        },
    });
    drawAxes(plot, scales, {
        innerWidth: iw,
        innerHeight: ih,
        theme: defaultTheme,
        xLabel: "Rank",
        yLabel: metric.shortLabel,
        tickCount: { x: 10, y: 5 },
        format: {
            x: (value) => `#${value}`,
            y: (value) => formatNumber(Number(value)),
        },
    });
    const seriesGroup = svg.ownerDocument.createElementNS(svg.namespaceURI, "g");
    plot.appendChild(seriesGroup);
    renderBars(seriesGroup, data, scales, {
        innerHeight: ih,
        theme: defaultTheme,
        gap: 8,
        cornerRadius: 4,
    });
}
