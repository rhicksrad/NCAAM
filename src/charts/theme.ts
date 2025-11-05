// src/charts/theme.ts
export const METRIC_DOMAINS = {
  ppg: [0, 30],
  rpg: [0, 15],
  apg: [0, 10],
} as const;

export type Metric = keyof typeof METRIC_DOMAINS;

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
