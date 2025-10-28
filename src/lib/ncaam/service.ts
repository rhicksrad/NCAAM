import { Ncaam } from './api';
import { mapTeam, mapPlayer, mapGame, mapStandingsRow, mapRankingsRow } from './map';
import type { Team, Player, Game, StandingsRow, RankingsRow, Paged } from './types';

type URec = Record<string, unknown>;

function isObj(v: unknown): v is URec { return typeof v === 'object' && v !== null; }

function dataArray(res: unknown): unknown[] {
  if (isObj(res) && Array.isArray((res as URec)['data'])) return (res as URec)['data'] as unknown[];
  if (Array.isArray(res)) return res as unknown[];
  return [];
}

function nextPage(res: unknown): number | undefined {
  if (!isObj(res)) return undefined;
  const meta = (res as URec)['meta'];
  const np1 = isObj(meta) ? (meta as URec)['next_page'] : undefined;
  const np2 = (res as URec)['next_page'];
  const n = typeof np1 === 'number' ? np1 : (typeof np2 === 'number' ? np2 : undefined);
  return n !== undefined ? Number(n) : undefined;
}

export async function getTeams(params?: Record<string, string | number>): Promise<Team[]> {
  const res = await Ncaam.teams(params);
  return dataArray(res).map(mapTeam);
}

export async function getPlayers(params?: Record<string, string | number>): Promise<Player[]> {
  const res = await Ncaam.players(params);
  return dataArray(res).map(mapPlayer);
}

export async function getPlayer(id: string): Promise<Player> {
  const res = await Ncaam.player(id);
  const d = isObj(res) ? (res as URec)['data'] : undefined;
  return mapPlayer(d ?? res);
}

export async function getGames(params?: Record<string, string | number>): Promise<Paged<Game>> {
  const res = await Ncaam.games(params);
  return { data: dataArray(res).map(mapGame), nextPage: nextPage(res) };
}

export async function getStandings(season: number, conferenceId?: string): Promise<StandingsRow[]> {
  const res = await Ncaam.standings({ season, conference_id: conferenceId });
  return dataArray(res).map(mapStandingsRow);
}

export async function getRankings(season: number, week?: number): Promise<RankingsRow[]> {
  const res = await Ncaam.rankings({ season, week });
  return dataArray(res).map(mapRankingsRow);
}

export async function getPlays(gameId: string, page = 1): Promise<unknown> {
  return Ncaam.plays({ game_id: gameId, page });
}
