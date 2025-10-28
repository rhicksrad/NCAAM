export type ScoreLike = number | string | null | undefined;

export const toNum = (v: ScoreLike): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : Number.NEGATIVE_INFINITY;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
  }
  return Number.NEGATIVE_INFINITY;
};

export interface HasScore<T = unknown> { goatScore: ScoreLike }
export interface Ranked<T> extends T { rank: number; goatScore: ScoreLike }

export function rankByGoatScore<T extends HasScore>(players: T[]): Ranked<T>[] {
  const sorted = [...players].sort((a, b) => toNum(b.goatScore) - toNum(a.goatScore));
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}
