const decimalFormatter = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(1) : "";

const percentFormatter = (value: number): string =>
  Number.isFinite(value) ? `${value.toFixed(1)}%` : "";

export const PLAYER_LEADERBOARD_METRIC_KEYS = [
  "ppg",
  "rpg",
  "apg",
  "stocks",
  "fgPct",
  "fg3Pct",
  "ftPct",
  "mp",
  "turnovers",
] as const;

export type PlayerLeaderboardMetricKey =
  (typeof PLAYER_LEADERBOARD_METRIC_KEYS)[number];

export type LeaderboardMetricId =
  | "points"
  | "rebounds"
  | "assists"
  | "stocks"
  | "fgPct"
  | "fg3Pct"
  | "ftPct"
  | "mp"
  | "turnovers";

export const DEFAULT_METRIC_ORDER: LeaderboardMetricId[] = [
  "points",
  "rebounds",
  "assists",
  "stocks",
  "fgPct",
  "fg3Pct",
  "ftPct",
  "mp",
  "turnovers",
];

export interface PlayerLeaderboardMetricConfig {
  readonly metricId: LeaderboardMetricId;
  readonly label: string;
  readonly shortLabel: string;
  readonly legendLabel: string;
  readonly defaultDomain: [number, number];
  readonly valueFormatter: (value: number) => string;
  readonly valueTransform?: (value: number) => number;
}

export const PLAYER_LEADERBOARD_METRICS: Record<
  PlayerLeaderboardMetricKey,
  PlayerLeaderboardMetricConfig
> = {
  ppg: {
    metricId: "points",
    label: "Points per game",
    shortLabel: "PPG",
    legendLabel: "Average per game",
    defaultDomain: [0, 35],
    valueFormatter: decimalFormatter,
  },
  rpg: {
    metricId: "rebounds",
    label: "Rebounds per game",
    shortLabel: "RPG",
    legendLabel: "Average per game",
    defaultDomain: [0, 20],
    valueFormatter: decimalFormatter,
  },
  apg: {
    metricId: "assists",
    label: "Assists per game",
    shortLabel: "APG",
    legendLabel: "Average per game",
    defaultDomain: [0, 12],
    valueFormatter: decimalFormatter,
  },
  stocks: {
    metricId: "stocks",
    label: "Stocks per game",
    shortLabel: "Stocks",
    legendLabel: "Average per game",
    defaultDomain: [0, 6],
    valueFormatter: decimalFormatter,
  },
  fgPct: {
    metricId: "fgPct",
    label: "Field goal percentage",
    shortLabel: "FG%",
    legendLabel: "Shooting percentage",
    defaultDomain: [0, 100],
    valueFormatter: percentFormatter,
    valueTransform: (value: number) => value * 100,
  },
  fg3Pct: {
    metricId: "fg3Pct",
    label: "Three-point percentage",
    shortLabel: "3P%",
    legendLabel: "Shooting percentage",
    defaultDomain: [0, 100],
    valueFormatter: percentFormatter,
    valueTransform: (value: number) => value * 100,
  },
  ftPct: {
    metricId: "ftPct",
    label: "Free throw percentage",
    shortLabel: "FT%",
    legendLabel: "Shooting percentage",
    defaultDomain: [0, 100],
    valueFormatter: percentFormatter,
    valueTransform: (value: number) => value * 100,
  },
  mp: {
    metricId: "mp",
    label: "Minutes per game",
    shortLabel: "MPG",
    legendLabel: "Average per game",
    defaultDomain: [0, 45],
    valueFormatter: decimalFormatter,
  },
  turnovers: {
    metricId: "turnovers",
    label: "Turnovers per game",
    shortLabel: "TOV",
    legendLabel: "Average per game",
    defaultDomain: [0, 8],
    valueFormatter: decimalFormatter,
  },
};

export function formatMetricValue(
  metric: PlayerLeaderboardMetricKey,
  value: number,
): string {
  const formatter = PLAYER_LEADERBOARD_METRICS[metric]?.valueFormatter;
  return formatter ? formatter(value) : decimalFormatter(value);
}

export function transformMetricValue(
  metric: PlayerLeaderboardMetricKey,
  value: number,
): number {
  const transform = PLAYER_LEADERBOARD_METRICS[metric]?.valueTransform;
  return transform ? transform(value) : value;
}
