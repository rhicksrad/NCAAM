import type { Ranked } from "./rank";

export type TierName = string;

export function groupByTier<T extends { tier: TierName }>(ranked: Ranked<T>[]): Map<TierName, Ranked<T>[]> {
  const map = new Map<TierName, Ranked<T>[]>();
  for (const entry of ranked) {
    if (!entry) continue;
    const key = (entry.tier ?? "Uncategorized") as TierName;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(entry);
  }
  return map;
}

export function orderedTierNames<T extends { tier: TierName }>(ranked: Ranked<T>[]): TierName[] {
  const map = groupByTier(ranked);
  return [...map.entries()]
    .sort(([, a], [, b]) => {
      const bestA = a?.[0]?.rank ?? Number.POSITIVE_INFINITY;
      const bestB = b?.[0]?.rank ?? Number.POSITIVE_INFINITY;
      return bestA - bestB;
    })
    .map(([tier]) => tier);
}
