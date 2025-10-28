export const toNum = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
  }
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(numeric) ? numeric : Number.NEGATIVE_INFINITY;
  }
  return Number.NEGATIVE_INFINITY;
};

export function rankByGoatScore(players) {
  const list = Array.isArray(players) ? players : [];
  const sorted = list.slice().sort((a, b) => toNum(b?.goatScore) - toNum(a?.goatScore));
  return sorted.map((player, index) => ({ ...player, rank: index + 1 }));
}
