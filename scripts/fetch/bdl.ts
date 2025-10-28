import {
  BallDontLieClient,
  type BallDontLieClientOptions,
  type BdlGame,
  type BdlPlayer,
  type BdlTeam,
  buildTeamMap as buildTeamMapWithClient,
  createTeamMap,
  normalizeTeamName,
} from "./ball_dont_lie_client.js";

const defaultClient = new BallDontLieClient();

export type { BallDontLieClientOptions, BdlGame, BdlPlayer, BdlTeam };
export { BallDontLieClient, buildTeamMapWithClient as buildTeamMap, createTeamMap, normalizeTeamName };

export function getClient(): BallDontLieClient {
  return defaultClient;
}

export function getTeams(): Promise<BdlTeam[]> {
  return defaultClient.getTeams();
}

export function getActivePlayersByTeam(teamId: number, season?: number): Promise<BdlPlayer[]> {
  return defaultClient.getActivePlayersByTeam(teamId, season);
}

export function getRosterMapByTeamIds(
  teamIds: number[],
  season?: number,
): Promise<Record<number, BdlPlayer[]>> {
  return defaultClient.getRosterMapByTeamIds(teamIds, season);
}

export function getPreseasonSchedule(season: number): Promise<BdlGame[]> {
  return defaultClient.getPreseasonSchedule(season);
}
