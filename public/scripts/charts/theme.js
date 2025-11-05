// src/charts/theme.ts
import { PLAYER_LEADERBOARD_METRIC_KEYS, PLAYER_LEADERBOARD_METRICS, } from "../lib/players/leaderboard-metrics.js";
const DEFAULT_METRIC_DOMAINS = PLAYER_LEADERBOARD_METRIC_KEYS.reduce((acc, metric) => {
    const [min, max] = PLAYER_LEADERBOARD_METRICS[metric].defaultDomain;
    acc[metric] = [min, max];
    return acc;
}, {});
export const METRIC_DOMAINS = PLAYER_LEADERBOARD_METRIC_KEYS.reduce((acc, metric) => {
    const [min, max] = DEFAULT_METRIC_DOMAINS[metric];
    acc[metric] = [min, max];
    return acc;
}, {});
export function setMetricDomain(metric, domain) {
    const [rawMin, rawMax] = domain;
    const min = Number.isFinite(rawMin) ? rawMin : DEFAULT_METRIC_DOMAINS[metric][0];
    const maxCandidate = Number.isFinite(rawMax)
        ? rawMax
        : DEFAULT_METRIC_DOMAINS[metric][1];
    const max = maxCandidate === min ? min || DEFAULT_METRIC_DOMAINS[metric][1] : maxCandidate;
    METRIC_DOMAINS[metric] = [min, max];
}
export function resetMetricDomains() {
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
];
export function tierLabel(rank) {
    const tier = RANK_TIERS.find(({ range }) => rank >= range[0] && rank <= range[1]);
    return tier ? tier.label : "51+";
}
export const RANK_TIER_COLORS = {
    "Top 5": "#22d3ee",
    "6–10": "#38bdf8",
    "11–25": "#6366f1",
    "26–50": "#a855f7",
    "51+": "#f97316",
};
export const ROW_HEIGHT = 26;
export const MARGIN = { t: 24, r: 20, b: 36, l: 200 };
export const DEFAULT_WIDTH = 900;
export const VALUE_RAMP = ["#0f172a", "#1d4ed8", "#38bdf8", "#bae6fd"];
