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

function asCursor(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function nextCursor(res: unknown): string | undefined {
  if (!isObj(res)) return undefined;
  const meta = (res as URec)['meta'];
  if (!isObj(meta)) return undefined;
  return asCursor((meta as URec)['next_cursor']);
}

function prevCursor(res: unknown): string | undefined {
  if (!isObj(res)) return undefined;
  const meta = (res as URec)['meta'];
  if (!isObj(meta)) return undefined;
  return asCursor((meta as URec)['prev_cursor']);
}

function nextPage(res: unknown): number | undefined {
  if (!isObj(res)) return undefined;
  const meta = (res as URec)['meta'];
  const np1 = isObj(meta) ? (meta as URec)['next_page'] : undefined;
  const np2 = (res as URec)['next_page'];
  const n = typeof np1 === 'number' ? np1 : (typeof np2 === 'number' ? np2 : undefined);
  return n !== undefined ? Number(n) : undefined;
}

function isNotFound(err: unknown): boolean {
  return err instanceof Error && /\b404\b/.test(err.message);
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
  return {
    data: dataArray(res).map(mapGame),
    nextPage: nextPage(res),
    nextCursor: nextCursor(res),
    prevCursor: prevCursor(res)
  };
}

export async function getStandings(season: number, conferenceId?: string): Promise<StandingsRow[]> {
  const res = await Ncaam.standings({ season, conference_id: conferenceId });
  return dataArray(res).map(mapStandingsRow);
}

export async function getRankings(season: number, week?: number): Promise<RankingsRow[]> {
  const load = async (w?: number) => {
    const res = await Ncaam.rankings({ season, week: w });
    return dataArray(res).map(mapRankingsRow);
  };

  try {
    return await load(week);
  } catch (err) {
    if (!isNotFound(err)) throw err;
    if (week !== undefined) {
      try {
        return await load(undefined);
      } catch (retryErr) {
        if (!isNotFound(retryErr)) throw retryErr;
      }
    }
    return [];
  }
}

export async function getPlays(gameId: string, page = 1): Promise<unknown> {
  return Ncaam.plays({ game_id: gameId, page });
}
