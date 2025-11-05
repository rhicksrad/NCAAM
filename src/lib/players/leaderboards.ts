import { DEFAULT_METRIC_ORDER, type LeaderboardMetricId } from "./leaderboard-metrics.js";
import {
  type PlayerLeaderboardDocument,
  loadLeaderboardDocument,
} from "./data.js";
import {
  createSkeletonCard,
  renderLeaderboardCards,
  type LeaderboardCardDefinition,
} from "../leaderboards/render.js";

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

    const cards: LeaderboardCardDefinition[] = [];
    orderedIds.forEach((id) => {
      const metric = metrics[id];
      if (!metric) return;

      const leaders = (metric.leaders ?? []).map((leader) => ({
        name: leader.name,
        team: leader.team ?? null,
        value: leader.value,
        valueFormatted: leader.valueFormatted ?? null,
      }));

      cards.push({
        id: String(id),
        title: metric.label,
        seasonLabel: displaySeasonLabel,
        ariaLabel: `${metric.label} leaders for ${displaySeasonLabel}`,
        axisLabel: metric.label,
        leaders,
      });
    });

    if (!cards.length) {
      grid.innerHTML = `<p class="stat-card stat-card--empty">No leaderboard data available right now.</p>`;
      return;
    }

    renderLeaderboardCards(grid, cards, {
      defaultSeasonLabel: displaySeasonLabel,
      axisTickCount: 6,
      limit: 10,
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
