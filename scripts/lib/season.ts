export const SEASON = "2025-26" as const;

export function getSeasonStartYear(season: string): number {
  const [start] = season.split("-");
  const parsed = Number.parseInt(start, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid season string: ${season}`);
  }
  return parsed;
}
