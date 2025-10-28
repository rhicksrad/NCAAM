import type { Team, Player, Game, StandingsRow, RankingsRow } from './types';

type URec = Record<string, unknown>;

function isObj(v: unknown): v is URec { return typeof v === 'object' && v !== null; }
function asStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : (typeof v === 'number' ? String(v) : undefined);
}
function asNum(v: unknown): number | undefined {
  return typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined);
}
function prop(o: unknown, k: string): unknown { return isObj(o) ? (o as URec)[k] : undefined; }
function uuid(): string {
  try { return (crypto as Crypto).randomUUID(); } catch { return Math.random().toString(36).slice(2); }
}

export function mapTeam(t: unknown): Team {
  const id = asStr(prop(t, 'id')) ?? asStr(prop(t, 'team_id')) ?? asStr(prop(t, 'slug')) ?? uuid();
  const name = asStr(prop(t, 'full_name')) ?? asStr(prop(t, 'name')) ?? 'Unknown Team';
  const shortName = asStr(prop(t, 'abbreviation')) ?? asStr(prop(t, 'short_name')) ?? name;
  const conf = isObj(prop(t, 'conference')) ? asStr(prop(prop(t, 'conference'), 'name')) : asStr(prop(t, 'conference_name'));
  const logo = asStr(prop(t, 'logo'));
  return { id, name, shortName, conference: conf, logo };
}

export function mapPlayer(p: unknown): Player {
  const id = asStr(prop(p, 'id')) ?? asStr(prop(p, 'player_id')) ?? uuid();
  const firstName = asStr(prop(p, 'first_name')) ?? asStr(prop(p, 'firstName')) ?? '';
  const lastName = asStr(prop(p, 'last_name')) ?? asStr(prop(p, 'lastName')) ?? '';
  const position = asStr(prop(p, 'position'));
  const team = prop(p, 'team');
  const teamId = isObj(team) ? asStr(prop(team, 'id')) : asStr(prop(p, 'team_id'));
  const classYear = asStr(prop(p, 'class_year')) ?? asStr(prop(p, 'year'));
  const eligibility = asStr(prop(p, 'eligibility'));
  const height = asStr(prop(p, 'height'));
  const weight = asStr(prop(p, 'weight'));
  return { id, firstName, lastName, position, teamId, classYear, eligibility, height, weight };
}

export function mapGame(g: unknown): Game {
  const id = asStr(prop(g, 'id')) ?? asStr(prop(g, 'game_id')) ?? uuid();
  const date = asStr(prop(g, 'date')) ?? asStr(prop(g, 'datetime')) ?? '';
  const homeTeam = prop(g, 'home_team');
  const awayTeam = prop(g, 'visitor_team');
  const homeTeamId = asStr(isObj(homeTeam) ? prop(homeTeam, 'id') : prop(g, 'home_team_id')) ?? '';
  const awayTeamId = asStr(isObj(awayTeam) ? prop(awayTeam, 'id') : prop(g, 'away_team_id')) ?? '';
  const homeScore = asNum(prop(g, 'home_team_score')) ?? asNum(prop(g, 'home_score'));
  const awayScore = asNum(prop(g, 'visitor_team_score')) ?? asNum(prop(g, 'away_score'));
  const status = asStr(prop(g, 'status')) ?? asStr(prop(g, 'period'));
  const neutralSite = Boolean(prop(g, 'neutral_site'));
  return { id, date, homeTeamId, awayTeamId, homeScore, awayScore, status, neutralSite };
}

export function mapStandingsRow(r: unknown): StandingsRow {
  const team = prop(r, 'team');
  const teamId = asStr(isObj(team) ? prop(team, 'id') : prop(r, 'team_id')) ?? '';
  const wins = asNum(prop(r, 'wins')) ?? asNum(prop(r, 'overall_wins')) ?? 0;
  const losses = asNum(prop(r, 'losses')) ?? asNum(prop(r, 'overall_losses')) ?? 0;
  const confWins = asNum(prop(r, 'conference_wins')) ?? asNum(prop(r, 'conf_wins'));
  const confLosses = asNum(prop(r, 'conference_losses')) ?? asNum(prop(r, 'conf_losses'));
  return { teamId, wins, losses, confWins, confLosses };
}

export function mapRankingsRow(r: unknown): RankingsRow {
  const team = prop(r, 'team');
  const teamId = asStr(isObj(team) ? prop(team, 'id') : prop(r, 'team_id')) ?? '';
  const rank = asNum(prop(r, 'rank')) ?? asNum(prop(r, 'ap_rank')) ?? asNum(prop(r, 'net_rank')) ?? 0;
  const poll = (asStr(prop(r, 'poll')) ?? asStr(prop(r, 'source')) ?? 'AP') as RankingsRow['poll'];
  const week = asNum(prop(r, 'week'));
  return { rank, teamId, poll, week };
}
