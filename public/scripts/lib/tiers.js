export function groupByTier(ranked) {
  const map = new Map();
  const list = Array.isArray(ranked) ? ranked : [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const key = entry.tier ?? "Uncategorized";
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(entry);
  }
  return map;
}

export function orderedTierNames(ranked) {
  const map = groupByTier(ranked);
  return Array.from(map.entries())
    .sort(([, a], [, b]) => {
      const bestA = Number.isFinite(a?.[0]?.rank) ? a[0].rank : Number.POSITIVE_INFINITY;
      const bestB = Number.isFinite(b?.[0]?.rank) ? b[0].rank : Number.POSITIVE_INFINITY;
      return bestA - bestB;
    })
    .map(([tier]) => tier);
}
