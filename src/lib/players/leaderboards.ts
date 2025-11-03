import { buildScales, drawAxes } from "../charts/axes.js";
import { computeInnerSize, createSVG } from "../charts/frame.js";
import { defaultTheme, formatNumber } from "../charts/theme.js";
import {
  DEFAULT_METRIC_ORDER,
  type LeaderboardMetricId,
  type PlayerLeaderboardDocument,
  type PlayerLeaderboardMetric,
  loadLeaderboardDocument,
} from "./data.js";

const CHART_DIMENSIONS = {
  width: 720,
  height: 420,
  margin: { top: 24, right: 32, bottom: 40, left: 220 },
} as const;

const CARD_TONE_CLASSES = [
  "stat-card--tone-1",
  "stat-card--tone-2",
  "stat-card--tone-3",
  "stat-card--tone-4",
] as const;

const DEFAULT_SEASON_LABEL = "recent seasons" as const;

function buildSeasonLabel(season: string): string {
  const trimmed = season.trim();
  if (!trimmed) return DEFAULT_SEASON_LABEL;

  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed} season`;
  }

  const shortRangeMatch = trimmed.match(/^(\d{4})-(\d{2})$/);
  if (shortRangeMatch) {
    const startYear = Number.parseInt(shortRangeMatch[1] ?? "", 10);
    const endSuffix = Number.parseInt(shortRangeMatch[2] ?? "", 10);
    if (!Number.isNaN(startYear) && !Number.isNaN(endSuffix)) {
      const startCentury = Math.floor(startYear / 100) * 100;
      const startYearSuffix = startYear % 100;
      let endYear = startCentury + endSuffix;
      if (endYear < startYear || endSuffix < startYearSuffix) {
        endYear += 100;
      }
      return `${startYear}-${endYear} season`;
    }
    return `${trimmed} season`;
  }

  if (/^\d{4}-\d{4}$/.test(trimmed)) {
    return `${trimmed} seasons`;
  }

  return trimmed;
}

function resolveLeaderboardSeasonLabel(document: PlayerLeaderboardDocument): string {
  const season = document.season;
  if (!season) {
    return DEFAULT_SEASON_LABEL;
  }

  return buildSeasonLabel(season);
}

export async function renderLeaderboardFeature(
  grid: HTMLElement,
  meta: HTMLElement | null,
  title?: HTMLElement | null,
): Promise<void> {
  const skeleton = createSkeletonCard();
  grid.innerHTML = "";
  grid.appendChild(skeleton);

  try {
    const document = await loadLeaderboardDocument();
    const metrics = document.metrics ?? {};
    const orderedIds = buildMetricOrder(metrics);
    const displaySeasonLabel = resolveLeaderboardSeasonLabel(document);

    if (title) {
      title.textContent = `Top 10 stat leaders (${displaySeasonLabel})`;
    }

    if (meta) {
      const updated = new Date(document.generatedAt);
      const updatedText = Number.isNaN(updated.valueOf())
        ? "Recently updated"
        : `Updated ${updated.toLocaleDateString()}`;
      meta.textContent = `${updatedText} · Stats aggregated from ${displaySeasonLabel}.`;
    }

    grid.innerHTML = "";
    if (!orderedIds.length) {
      grid.innerHTML = `<p class="stat-card stat-card--empty">No leaderboard data available right now.</p>`;
      return;
    }

    orderedIds.forEach((id, index) => {
      const metric = metrics[id];
      if (!metric) return;
      grid.appendChild(createLeaderboardCard(id, metric, index, displaySeasonLabel));
    });
  } catch (error) {
    console.error(error);
    if (meta) {
      meta.textContent = "Unable to load stat leaders right now.";
    }
    grid.innerHTML = `<p class="stat-card stat-card--error">We couldn't load the leaderboard data. Please try again later.</p>`;
  }
}

function buildMetricOrder(
  metrics: PlayerLeaderboardDocument["metrics"],
): Array<LeaderboardMetricId | string> {
  const available = DEFAULT_METRIC_ORDER.filter((id) => metrics[id]);
  const extras = Object.keys(metrics).filter((id) => !DEFAULT_METRIC_ORDER.includes(id as LeaderboardMetricId));
  return [...available, ...extras];
}

function createSkeletonCard(): HTMLElement {
  const card = document.createElement("article");
  card.className = "stat-card stat-card--loading";
  card.innerHTML = `<div class="stat-card__loading">Loading leaderboards…</div>`;
  return card;
}

function createLeaderboardCard(
  metricId: LeaderboardMetricId | string,
  metric: PlayerLeaderboardMetric,
  orderIndex: number,
  seasonLabel: string,
): HTMLElement {
  const card = document.createElement("article");
  card.className = "stat-card";
  card.dataset.metricId = metricId;
  const toneClass = CARD_TONE_CLASSES[orderIndex % CARD_TONE_CLASSES.length];
  card.classList.add(toneClass);
  const chartId = `metric-chart-${metricId}`;
  const description = `${metric.label} leaders for ${seasonLabel}`;
  const leaders = (metric.leaders ?? []).slice(0, 10);

  card.innerHTML = `
    <header class="stat-card__head">
      <h3 class="stat-card__title">${metric.label}</h3>
      <span class="stat-card__season">${seasonLabel}</span>
    </header>
    <div class="stat-card__body">
      <div id="${chartId}" class="stat-card__chart" role="img" aria-label="${description}"></div>
    </div>
    <ol class="stat-card__list" aria-label="${description}"></ol>
  `;

  const chartHost = card.querySelector(`#${CSS.escape(chartId)}`) as HTMLElement | null;
  const list = card.querySelector(".stat-card__list") as HTMLOListElement | null;

  if (chartHost) {
    renderMetricChart(chartHost, metric, seasonLabel);
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

function renderMetricChart(
  container: HTMLElement,
  metric: PlayerLeaderboardMetric,
  seasonLabel: string,
): void {
  const leaders = (metric.leaders ?? []).slice(0, 10);
  if (!leaders.length) {
    container.innerHTML = `<p class="stat-card__empty">No data available.</p>`;
    return;
  }

  const { width, height, margin } = CHART_DIMENSIONS;
  const { iw, ih } = computeInnerSize(width, height, margin);
  const svg = createSVG(container, width, height, {
    title: `${metric.label} leaders`,
    description: `${metric.label} leaders for ${seasonLabel}`,
  });

  const plot = svg.ownerDocument.createElementNS(svg.namespaceURI, "g") as SVGGElement;
  plot.setAttribute("transform", `translate(${margin.left},${margin.top})`);
  svg.appendChild(plot);

  const maxValue = Math.max(...leaders.map((leader) => leader.value));
  const scales = buildScales({
    x: {
      type: "linear",
      domain: [0, maxValue * 1.1],
      range: [0, iw],
      nice: true,
      clamp: true,
    },
    y: {
      type: "band",
      domain: leaders.map((leader) => leader.name),
      range: [0, ih],
      paddingInner: 0.18,
      paddingOuter: 0.12,
    },
  });

  const barLayer = svg.ownerDocument.createElementNS(svg.namespaceURI, "g") as SVGGElement;
  barLayer.setAttribute("class", "leaderboard-bars");
  plot.appendChild(barLayer);

  const defs = ensureDefs(svg);
  const gradientId = `${svg.dataset.chartId ?? "chart"}-bar-gradient`;
  const colors = resolveChartColors(container);
  const gradient = createGradient(defs, gradientId, colors.accentMuted, colors.accent);

  const yScale = scales.y as { (value: string): number | undefined; bandwidth?: () => number };
  const xScale = scales.x as (value: number) => number;
  const band = typeof yScale.bandwidth === "function" ? yScale.bandwidth() : ih / Math.max(1, leaders.length);
  const barHeight = Math.max(14, band - 10);

  leaders.forEach((leader) => {
    const rowGroup = svg.ownerDocument.createElementNS(svg.namespaceURI, "g") as SVGGElement;
    rowGroup.setAttribute("class", "leaderboard-row");
    const y = (yScale(leader.name) ?? 0) + (band - barHeight) / 2;
    rowGroup.setAttribute("transform", `translate(0, ${y})`);

    const track = svg.ownerDocument.createElementNS(svg.namespaceURI, "rect") as SVGRectElement;
    track.setAttribute("class", "leaderboard-bar-track");
    track.setAttribute("x", "0");
    track.setAttribute("y", "0");
    track.setAttribute("width", `${iw}`);
    track.setAttribute("height", `${barHeight}`);
    track.setAttribute("fill", colors.track);
    track.setAttribute("rx", "14");
    track.setAttribute("ry", "14");
    rowGroup.appendChild(track);

    const bar = svg.ownerDocument.createElementNS(svg.namespaceURI, "rect") as SVGRectElement;
    bar.setAttribute("class", "leaderboard-bar");
    bar.setAttribute("x", "0");
    bar.setAttribute("y", "0");
    bar.setAttribute("height", `${barHeight}`);
    bar.setAttribute("rx", "14");
    bar.setAttribute("ry", "14");
    bar.setAttribute("fill", `url(#${gradientId})`);
    bar.setAttribute("stroke", colors.accentStroke);
    bar.setAttribute("stroke-width", "1");

    const valuePosition = xScale(leader.value);
    const clampedWidth = Math.max(0, Math.min(iw, valuePosition));
    bar.setAttribute("width", `${clampedWidth}`);
    rowGroup.appendChild(bar);

    const label = svg.ownerDocument.createElementNS(svg.namespaceURI, "text") as SVGTextElement;
    label.setAttribute("class", "bar-value");
    label.setAttribute("y", `${barHeight / 2}`);
    label.setAttribute("dy", "0.35em");
    label.textContent = leader.valueFormatted ?? formatNumber(leader.value);

    const showInside = clampedWidth > iw * 0.65;
    const labelOffset = showInside ? clampedWidth - 14 : clampedWidth + 16;
    label.setAttribute("x", `${labelOffset}`);
    label.setAttribute("text-anchor", showInside ? "end" : "start");
    label.setAttribute("fill", showInside ? colors.onAccent : colors.text);
    rowGroup.appendChild(label);

    barLayer.appendChild(rowGroup);
  });

  drawAxes(plot, scales, {
    innerWidth: iw,
    innerHeight: ih,
    theme: defaultTheme,
    tickCount: { x: 4, y: leaders.length },
    format: {
      x: (value) => formatNumber(Number(value)),
      y: (value) => {
        const leader = leaders.find((entry) => entry.name === value);
        if (leader?.team) {
          return `${leader.name} (${leader.team})`;
        }
        return `${value ?? ""}`;
      },
    },
  });
}

function ensureDefs(svg: SVGSVGElement): SVGDefsElement {
  const existing = svg.querySelector("defs");
  if (existing) return existing as SVGDefsElement;
  const defs = svg.ownerDocument.createElementNS(svg.namespaceURI, "defs") as SVGDefsElement;
  svg.insertBefore(defs, svg.firstChild);
  return defs;
}

function createGradient(
  defs: SVGDefsElement,
  id: string,
  from: string,
  to: string,
): SVGLinearGradientElement {
  let gradient = defs.querySelector(`#${CSS.escape(id)}`) as SVGLinearGradientElement | null;
  if (!gradient) {
    gradient = defs.ownerDocument.createElementNS(defs.namespaceURI, "linearGradient") as SVGLinearGradientElement;
    gradient.id = id;
    gradient.setAttribute("x1", "0%");
    gradient.setAttribute("y1", "0%");
    gradient.setAttribute("x2", "100%");
    gradient.setAttribute("y2", "0%");
    defs.appendChild(gradient);
  } else {
    gradient.replaceChildren();
  }

  const start = defs.ownerDocument.createElementNS(defs.namespaceURI, "stop") as SVGStopElement;
  start.setAttribute("offset", "0%");
  start.setAttribute("stop-color", from);
  start.setAttribute("stop-opacity", "1");

  const end = defs.ownerDocument.createElementNS(defs.namespaceURI, "stop") as SVGStopElement;
  end.setAttribute("offset", "100%");
  end.setAttribute("stop-color", to);
  end.setAttribute("stop-opacity", "1");

  gradient.appendChild(start);
  gradient.appendChild(end);
  return gradient;
}

function resolveChartColors(container: HTMLElement) {
  const view = container.ownerDocument?.defaultView;
  const styles = view ? view.getComputedStyle(container) : null;

  const accent = pickColor(styles?.getPropertyValue("--chart-accent")) ?? defaultTheme.accent;
  const accentMuted = pickColor(styles?.getPropertyValue("--chart-accent-muted")) ?? defaultTheme.accentMuted;
  const track =
    pickColor(styles?.getPropertyValue("--chart-accent-track")) ?? accentMuted;
  const text = pickColor(styles?.getPropertyValue("--stat-card-ink")) ?? defaultTheme.fg;
  const onAccent = pickColor(styles?.getPropertyValue("--stat-card-on-accent")) ?? "#ffffff";
  const accentStroke = pickColor(styles?.getPropertyValue("--chart-accent-stroke")) ?? accent;

  return { accent, accentMuted, track, text, onAccent, accentStroke };
}

function pickColor(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
