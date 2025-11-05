// src/charts/theme.ts
import {
  PLAYER_LEADERBOARD_METRIC_KEYS,
  PLAYER_LEADERBOARD_METRICS,
  type PlayerLeaderboardMetricKey,
} from "../lib/players/leaderboard-metrics.js";

type Domain = [number, number];
type MetricDomains = Record<PlayerLeaderboardMetricKey, Domain>;

const DEFAULT_METRIC_DOMAINS: MetricDomains = PLAYER_LEADERBOARD_METRIC_KEYS.reduce(
  (acc, metric) => {
    const [min, max] = PLAYER_LEADERBOARD_METRICS[metric].defaultDomain;
    acc[metric] = [min, max];
    return acc;
  },
  {} as MetricDomains,
);

export const METRIC_DOMAINS: MetricDomains = PLAYER_LEADERBOARD_METRIC_KEYS.reduce(
  (acc, metric) => {
    const [min, max] = DEFAULT_METRIC_DOMAINS[metric];
    acc[metric] = [min, max];
    return acc;
  },
  {} as MetricDomains,
);

export type Metric = PlayerLeaderboardMetricKey;

export function setMetricDomain(metric: Metric, domain: Domain): void {
  const [rawMin, rawMax] = domain;
  const min = Number.isFinite(rawMin) ? rawMin : DEFAULT_METRIC_DOMAINS[metric][0];
  const maxCandidate = Number.isFinite(rawMax)
    ? rawMax
    : DEFAULT_METRIC_DOMAINS[metric][1];
  const max = maxCandidate === min ? min || DEFAULT_METRIC_DOMAINS[metric][1] : maxCandidate;
  METRIC_DOMAINS[metric] = [min, max];
}

export function resetMetricDomains(): void {
  PLAYER_LEADERBOARD_METRIC_KEYS.forEach((metric) => {
    const [min, max] = DEFAULT_METRIC_DOMAINS[metric];
    METRIC_DOMAINS[metric] = [min, max];
  });
}

export const RANK_TIERS = [
  { label: "Top 5", range: [1, 5] },
  { label: "6–10", range: [6, 10] },
  { label: "11–25", range: [11, 25] },
  { label: "26–50", range: [26, 50] },
] as const;

export function tierLabel(rank: number): string {
  const tier = RANK_TIERS.find(({ range }) => rank >= range[0] && rank <= range[1]);
  return tier ? tier.label : "51+";
}

export const RANK_TIER_COLORS: Record<string, string> = {
  "Top 5": "#22d3ee",
  "6–10": "#38bdf8",
  "11–25": "#6366f1",
  "26–50": "#a855f7",
  "51+": "#f97316",
};

export const ROW_HEIGHT = 26;
export const MARGIN = { t: 24, r: 20, b: 36, l: 200 } as const;
export const DEFAULT_WIDTH = 900;

export const VALUE_RAMP = ["#0f172a", "#1d4ed8", "#38bdf8", "#bae6fd"] as const;
