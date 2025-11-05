import { formatNumber } from "../charts/theme.js";
import {
  DEFAULT_METRIC_ORDER,
  type LeaderboardMetricId,
  type PlayerLeaderboardDocument,
  type PlayerLeaderboardMetric,
  type PlayerLeaderboardEntry,
  loadLeaderboardDocument,
} from "./data.js";

const NAME_SCALE_MIN = 0.72;
const NAME_SCALE_MAX = 1;
const NAME_SCALE_START = 20;
const NAME_SCALE_END = 42;
const MIN_VISIBLE_RATIO = 0.085;

const ROW_ACCENTS: ReadonlyArray<readonly [string, string]> = [
  ["#4c7fff", "#335eea"],
  ["#ff6aa8", "#ff4280"],
  ["#ffb561", "#ff8e3c"],
  ["#8a7aff", "#6d5cff"],
  ["#42c5a5", "#2e9f86"],
  ["#ff7fcd", "#ff55a8"],
  ["#5aa7ff", "#3f86ff"],
  ["#ffd15a", "#ffa53d"],
  ["#4ed9a6", "#2cbf88"],
  ["#7aa8ff", "#5e8cff"]
] as const;

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

  card.innerHTML = `
    <header class="stat-card__head">
      <h3 class="stat-card__title">${metric.label}</h3>
      <span class="stat-card__season">${seasonLabel}</span>
    </header>
    <div class="stat-card__body">
      <div
        id="${chartId}"
        class="stat-card__chart leaderboard-chart"
        role="group"
        aria-label="${description}"
      ></div>
    </div>
  `;

  const chartHost = card.querySelector(`#${CSS.escape(chartId)}`) as HTMLElement | null;

  if (chartHost) {
    renderMetricChart(chartHost, metric);
  }

  return card;
}

function renderMetricChart(container: HTMLElement, metric: PlayerLeaderboardMetric): void {
  const leaders = (metric.leaders ?? []).slice(0, 10);
  if (!leaders.length) {
    container.innerHTML = `<p class="stat-card__empty">No data available.</p>`;
    return;
  }

  container.innerHTML = "";
  container.classList.add("leaderboard-chart--hydrated");

  const doc = container.ownerDocument;
  const list = doc.createElement("div");
  list.className = "leaderboard-chart__rows";
  container.appendChild(list);

  const maxValue = Math.max(...leaders.map((leader) => leader.value));
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1;

  leaders.forEach((leader, index) => {
    const row = createLeaderboardRow(doc, leader, index, safeMax);
    list.appendChild(row);
  });

  const axis = createLeaderboardAxis(doc, metric, safeMax);
  if (axis) {
    container.appendChild(axis);
  }
}

function createLeaderboardRow(
  doc: Document,
  leader: PlayerLeaderboardEntry,
  index: number,
  maxValue: number,
): HTMLDivElement {
  const row = doc.createElement("div");
  row.className = "leaderboard-chart__row";
  row.dataset.rank = `${index + 1}`;

  const [accentStart, accentEnd] = ROW_ACCENTS[index % ROW_ACCENTS.length] ?? ROW_ACCENTS[0];
  row.style.setProperty("--leaderboard-accent-start", accentStart);
  row.style.setProperty("--leaderboard-accent-end", accentEnd);

  const label = doc.createElement("div");
  label.className = "leaderboard-chart__label";

  const rank = doc.createElement("span");
  rank.className = "leaderboard-chart__rank";
  rank.textContent = String(index + 1).padStart(2, "0");
  label.appendChild(rank);

  const identity = doc.createElement("div");
  identity.className = "leaderboard-chart__identity";

  const name = doc.createElement("span");
  name.className = "leaderboard-chart__name";
  name.textContent = leader.name;
  identity.appendChild(name);

  if (leader.team) {
    const team = doc.createElement("span");
    team.className = "leaderboard-chart__team";
    team.textContent = leader.team;
    identity.appendChild(team);
  }

  label.appendChild(identity);
  row.appendChild(label);

  const metrics = doc.createElement("div");
  metrics.className = "leaderboard-chart__metrics";

  const value = doc.createElement("span");
  value.className = "leaderboard-chart__value";
  value.textContent = leader.valueFormatted ?? formatNumber(leader.value);
  metrics.appendChild(value);

  row.appendChild(metrics);

  const scale = computeNameScale(leader);
  row.style.setProperty("--name-scale", `${scale}`);
  if (leader.team) {
    const teamScale = Math.max(NAME_SCALE_MIN, Math.min(NAME_SCALE_MAX, scale + 0.08));
    row.style.setProperty("--team-scale", `${teamScale}`);
  }

  const ratio = maxValue > 0 ? Math.max(leader.value / maxValue, 0) : 0;
  const fillRatio = ratio > 0 ? Math.max(ratio, MIN_VISIBLE_RATIO) : 0;
  row.style.setProperty("--leaderboard-fill", `${Math.min(fillRatio, 1)}`);

  return row;
}

function createLeaderboardAxis(
  doc: Document,
  metric: PlayerLeaderboardMetric,
  maxValue: number,
): HTMLElement | null {
  if (!(Number.isFinite(maxValue) && maxValue > 0)) {
    return null;
  }

  const ticks = buildAxisTicks(maxValue);
  if (ticks.length <= 1) {
    return null;
  }

  const axis = doc.createElement("footer");
  axis.className = "leaderboard-chart__axis";

  const ticksContainer = doc.createElement("div");
  ticksContainer.className = "leaderboard-chart__axis-track";

  ticks.forEach((tick) => {
    const tickEl = doc.createElement("span");
    tickEl.className = "leaderboard-chart__axis-tick";
    tickEl.textContent = formatNumber(tick);
    const ratio = maxValue > 0 ? Math.min(Math.max(tick / maxValue, 0), 1) : 0;
    tickEl.style.setProperty("--tick-position", `${ratio}`);
    ticksContainer.appendChild(tickEl);
  });

  axis.appendChild(ticksContainer);

  const label = doc.createElement("span");
  label.className = "leaderboard-chart__axis-label";
  label.textContent = metric.label;
  axis.appendChild(label);

  return axis;
}

function buildAxisTicks(maxValue: number, count = 4): number[] {
  if (!(Number.isFinite(maxValue) && maxValue > 0)) {
    return [0, 1];
  }

  const desired = Math.max(2, count);
  const step = computeTickStep(maxValue, desired - 1);
  if (!(Number.isFinite(step) && step > 0)) {
    return [0, maxValue];
  }

  const ticks: number[] = [0];
  for (let value = step; value < maxValue; value += step) {
    ticks.push(Number.parseFloat(value.toFixed(6)));
    if (ticks.length >= desired - 1) {
      break;
    }
  }
  if (ticks[ticks.length - 1] !== maxValue) {
    ticks.push(maxValue);
  }
  return ticks;
}

function computeTickStep(maxValue: number, segments: number): number {
  const rawStep = maxValue / Math.max(1, segments);
  if (!(Number.isFinite(rawStep) && rawStep > 0)) {
    return 0;
  }

  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;

  let niceNormalized: number;
  if (normalized < 1.5) {
    niceNormalized = 1;
  } else if (normalized < 3) {
    niceNormalized = 2;
  } else if (normalized < 7) {
    niceNormalized = 5;
  } else {
    niceNormalized = 10;
  }

  return niceNormalized * magnitude;
}

function computeNameScale(leader: PlayerLeaderboardEntry): number {
  const label = leader.team ? `${leader.name} (${leader.team})` : leader.name;
  const length = label.length;
  if (length <= NAME_SCALE_START) {
    return NAME_SCALE_MAX;
  }
  if (length >= NAME_SCALE_END) {
    return NAME_SCALE_MIN;
  }
  const progress = (length - NAME_SCALE_START) / (NAME_SCALE_END - NAME_SCALE_START);
  const scale = NAME_SCALE_MAX - progress * (NAME_SCALE_MAX - NAME_SCALE_MIN);
  return Number(scale.toFixed(3));
}
