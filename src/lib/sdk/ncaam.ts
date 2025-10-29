import { fetchJSON } from './fetch';
import { clearCache, withCache } from './cache';
import type { Game, GameStage, Player, Poll, PollEntry, StandingGroup, StandingRow, Team } from './types';
import { resolveTeamLogo } from '../logos';

const debugEnabled = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const url = new URL(window.location.href);
    return url.searchParams.has('diag') || url.searchParams.has('debug');
  } catch {
    return false;
  }
})();

function debugLog(...args: unknown[]): void {
  if (!debugEnabled) return;
  console.debug('[ncaam-sdk]', ...args);
}

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : (typeof value === 'number' ? String(value) : undefined);
}

function mapTeam(raw: unknown): Team {
  const rec = isRecord(raw) ? raw : {};
  const idValue = asString(rec['id']) ?? asString(rec['team_id']);
  const conferenceId = asNumber(rec['conference_id']);
  const displayName = asString(rec['full_name']) ?? asString(rec['college']) ?? asString(rec['name']) ?? 'Unknown';
  const shortName = asString(rec['name']) ?? displayName;
  const abbreviation = asString(rec['abbreviation']) ?? shortName.slice(0, 6).toUpperCase();
  const team: Team = {
    id: idValue ?? displayName.toLowerCase(),
    name: displayName,
    displayName,
    shortName,
    abbreviation,
    conferenceId: conferenceId ?? undefined,
    conference: asString(rec['conference']) ?? asString(rec['conference_name']) ?? undefined,
    logo: asString(rec['logo']) ?? undefined,
  };
  const localLogo = resolveTeamLogo(team);
  if (localLogo) team.logo = localLogo;
  return team;
}

function mapPlayer(raw: unknown): Player {
  const rec = isRecord(raw) ? raw : {};
  const idValue = asString(rec['id']);
  const teamObj = isRecord(rec['team']) ? rec['team'] : undefined;
  return {
    id: idValue ?? `${asString(rec['first_name']) ?? ''}-${asString(rec['last_name']) ?? ''}`,
    firstName: asString(rec['first_name']) ?? '',
    lastName: asString(rec['last_name']) ?? '',
    position: asString(rec['position']) ?? undefined,
    height: asString(rec['height']) ?? undefined,
    weight: asString(rec['weight']) ?? undefined,
    classYear: asString(rec['class_year']) ?? asString(rec['year']) ?? undefined,
    teamId: teamObj ? String(asNumber(teamObj['id']) ?? asString(teamObj['id']) ?? '') : asString(rec['team_id']) ?? undefined,
    teamName: teamObj ? (asString(teamObj['full_name']) ?? asString(teamObj['name']) ?? undefined) : undefined,
  };
}

function mapGameStage(status: string | undefined, period?: number): { stage: GameStage; status: string } {
  const raw = (status ?? '').toLowerCase();
  const per = period ?? 0;
  if (!raw) return { stage: 'pre', status: 'pre' };
  if (raw.includes('postponed')) return { stage: 'postponed', status: 'Postponed' };
  if (raw.includes('cancel')) return { stage: 'canceled', status: 'Canceled' };
  if (raw.includes('post') || raw.includes('final')) return { stage: 'final', status: 'Final' };
  if (raw.includes('scheduled') || raw.includes('pre')) return { stage: 'pre', status: 'pre' };
  if (raw.includes('halftime')) return { stage: 'live', status: 'HT' };
  if (raw.includes('1st')) return { stage: 'live', status: '1st' };
  if (raw.includes('2nd')) return { stage: 'live', status: '2nd' };
  if (raw.includes('ot')) {
    const parts = raw.match(/(\d+)ot/);
    if (parts && parts[1]) {
      return { stage: 'live', status: `${parts[1]}OT` };
    }
    return { stage: 'live', status: 'OT' };
  }
  if (raw.includes('inprogress') || raw.includes('live')) {
    if (per >= 3) {
      const otCount = per - 2;
      return { stage: 'live', status: otCount === 1 ? 'OT' : `${otCount}OT` };
    }
    return { stage: 'live', status: per === 2 ? '2nd' : '1st' };
  }
  if (per >= 3) {
    const otCount = per - 2;
    return { stage: 'live', status: otCount === 1 ? 'OT' : `${otCount}OT` };
  }
  if (per === 2) return { stage: 'live', status: '2nd' };
  if (per === 1) return { stage: 'live', status: '1st' };
  return { stage: 'unknown', status: status ?? '—' };
}

function formatTipLabel(iso: string): { tipLocal: string; tipLabel: string } {
  const date = new Date(iso);
  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return {
    tipLocal: timeFmt.format(date),
    tipLabel: `${dayFmt.format(date)} · ${timeFmt.format(date)}`,
  };
}

function mapGame(raw: unknown): Game {
  const rec = isRecord(raw) ? raw : {};
  const idValue = asString(rec['id']) ?? asString(rec['game_id']);
  const date = asString(rec['date']) ?? new Date().toISOString();
  const { tipLocal, tipLabel } = formatTipLabel(date);
  const { stage, status } = mapGameStage(asString(rec['status']), asNumber(rec['period']));
  const homeTeam = mapTeam(rec['home_team']);
  const awayTeam = mapTeam(rec['visitor_team']);
  return {
    id: idValue ?? `${homeTeam.id}-${awayTeam.id}-${date}`,
    dateUTC: date,
    tipLocal,
    tipLabel,
    stage,
    status,
    home: { team: homeTeam, score: asNumber(rec['home_score']) ?? undefined },
    away: { team: awayTeam, score: asNumber(rec['away_score']) ?? undefined },
    neutralSite: Boolean(rec['neutral_site']),
  };
}

function mapPollEntry(raw: unknown): PollEntry | null {
  const rec = isRecord(raw) ? raw : {};
  const teamRaw = isRecord(rec['team']) ? rec['team'] : undefined;
  const rank = asNumber(rec['rank']);
  if (!teamRaw || rank === undefined) return null;
  const entry: PollEntry = {
    rank,
    team: mapTeam(teamRaw),
    record: asString(rec['record']) ?? undefined,
  };
  const fp = asNumber(rec['first_place_votes']);
  if (fp !== undefined) entry.firstPlaceVotes = fp;
  const pts = asNumber(rec['points']);
  if (pts !== undefined) entry.points = pts;
  return entry;
}

function pollDisplayName(poll: string): string {
  const normalized = poll.toLowerCase();
  if (normalized === 'ap') return 'AP Top 25';
  if (normalized === 'coaches') return "USA Today Coaches";
  if (normalized === 'net') return 'NET Rankings';
  return poll.replace(/\b\w/g, c => c.toUpperCase());
}

async function fetchAllPages(path: string, params: Record<string, unknown> = {}): Promise<unknown[]> {
  const pageSize = 200;
  let page = 1;
  const out: unknown[] = [];
  while (true) {
    const res = await fetchJSON<AnyRecord>(path, {
      params: { ...params, per_page: pageSize, page },
    });
    const data = Array.isArray(res?.data) ? res.data : [];
    if (!data.length) break;
    out.push(...data);
    if (!res?.meta || typeof res.meta !== 'object') {
      if (data.length < pageSize) break;
    }
    const next = (res.meta as AnyRecord | undefined)?.next_page;
    if (!next || !Number(next)) break;
    page = Number(next);
    if (page <= 1) break;
  }
  return out;
}

const TEAMS_TTL = 6 * 60 * 60 * 1000; // 6 hours
const STANDINGS_TTL = 60 * 60 * 1000; // 1 hour
const RANKINGS_TTL = 10 * 60 * 1000; // 10 minutes
const SCOREBOARD_TTL = 90 * 1000; // 90 seconds
const ROSTER_TTL = 2 * 60 * 60 * 1000; // 2 hours

export async function teams(): Promise<Team[]> {
  return withCache('teams:v1', TEAMS_TTL, async () => {
    const data = await fetchAllPages('/teams');
    return data.map(mapTeam);
  });
}

export async function team(id: string, enable?: string | string[]): Promise<Team> {
  const key = Array.isArray(enable) ? enable.join(',') : enable;
  const cacheKey = key ? `team:${id}:${key}` : `team:${id}`;
  return withCache(cacheKey, TEAMS_TTL / 2, async () => {
    const params = key ? { enable: key } : undefined;
    const res = await fetchJSON<AnyRecord>(`/teams/${id}`, { params });
    const data = isRecord(res) && isRecord(res.data) ? res.data : res;
    return mapTeam(data);
  });
}

export async function scoreboard(dateISO: string): Promise<Game[]> {
  const date = dateISO.slice(0, 10);
  return withCache(`scoreboard:${date}`, SCOREBOARD_TTL, async () => {
    const res = await fetchJSON<AnyRecord>('/games', { params: { 'dates[]': date, per_page: 200 } });
    const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    return data.map(mapGame).sort((a, b) => a.dateUTC.localeCompare(b.dateUTC));
  });
}

export async function rankings(season: number): Promise<Poll[]> {
  return withCache(`rankings:${season}`, RANKINGS_TTL, async () => {
    const res = await fetchJSON<AnyRecord>('/rankings', { params: { season } });
    const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    const buckets = new Map<string, Map<number, PollEntry[]>>();
    for (const row of data) {
      const rec = isRecord(row) ? row : {};
      const pollName = asString(rec['poll']);
      const week = asNumber(rec['week']);
      const entry = mapPollEntry(rec);
      if (!pollName || entry === null) continue;
      const pollKey = pollName.toLowerCase();
      if (!buckets.has(pollKey)) buckets.set(pollKey, new Map());
      const weekMap = buckets.get(pollKey)!;
      const weekKey = week ?? 0;
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, []);
      weekMap.get(weekKey)!.push(entry);
    }

    const polls: Poll[] = [];
    const fetchedAt = new Date().toISOString();
    for (const [pollKey, weekMap] of buckets.entries()) {
      const weeks = Array.from(weekMap.keys());
      const latestWeek = weeks.length ? Math.max(...weeks) : undefined;
      const entries = latestWeek !== undefined ? weekMap.get(latestWeek)! : Array.from(weekMap.values())[0] ?? [];
      entries.sort((a, b) => a.rank - b.rank);
      polls.push({
        poll: pollKey,
        displayName: pollDisplayName(pollKey),
        season,
        week: latestWeek,
        entries,
        fetchedAt,
      });
    }

    polls.sort((a, b) => {
      const order = ['ap', 'coaches'];
      const ai = order.indexOf(a.poll);
      const bi = order.indexOf(b.poll);
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return polls;
  });
}

export async function standings(season: number): Promise<StandingGroup[]> {
  return withCache(`standings:${season}`, STANDINGS_TTL, async () => {
    const conferencesRes = await fetchJSON<AnyRecord>('/conferences', { params: { per_page: 200 } });
    const conferences = Array.isArray(conferencesRes?.data)
      ? conferencesRes.data
      : Array.isArray(conferencesRes)
        ? conferencesRes
        : [];
    const groups: StandingGroup[] = [];
    for (const conf of conferences) {
      if (!isRecord(conf)) continue;
      const confId = asNumber(conf['id']);
      if (confId === undefined) continue;
      const name = asString(conf['short_name']) ?? asString(conf['name']) ?? `Conf ${confId}`;
      try {
        const res = await fetchJSON<AnyRecord>('/standings', { params: { season, conference_id: confId } });
        const rowsData = Array.isArray(res?.data) ? res.data : [];
        const rows: StandingRow[] = rowsData.map(row => {
          const rec = isRecord(row) ? row : {};
          const teamObj = isRecord(rec['team']) ? rec['team'] : undefined;
          const wins = asNumber(rec['wins']) ?? 0;
          const losses = asNumber(rec['losses']) ?? 0;
          const conferenceRecord = asString(rec['conference_record']) ?? undefined;
          let confWins: number | undefined;
          let confLosses: number | undefined;
          if (conferenceRecord) {
            const [w, l] = conferenceRecord.split('-');
            confWins = Number(w);
            confLosses = Number(l);
          }
          const rowOut: StandingRow = {
            team: mapTeam(teamObj),
            wins,
            losses,
            conferenceWins: confWins ?? asNumber(rec['conference_wins']) ?? undefined,
            conferenceLosses: confLosses ?? asNumber(rec['conference_losses']) ?? undefined,
          };
          if (!rowOut.team.record) {
            rowOut.team.record = { overall: `${wins}-${losses}` };
            if (rowOut.conferenceWins !== undefined && rowOut.conferenceLosses !== undefined) {
              rowOut.team.record.conference = `${rowOut.conferenceWins}-${rowOut.conferenceLosses}`;
            }
          }
          return rowOut;
        });
        if (rows.length) {
          rows.sort((a, b) => {
            const aPct = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
            const bPct = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
            if (bPct !== aPct) return bPct - aPct;
            return b.wins - a.wins;
          });
          groups.push({ conferenceId: confId, conferenceName: name, rows });
        }
      } catch (err) {
        debugLog('standings fetch failed', confId, err);
      }
    }
    return groups;
  });
}

export function invalidateScoreboard(dateISO: string): void {
  clearCache(`scoreboard:${dateISO.slice(0, 10)}`);
}

async function fetchPlayersPage(teamId: string, page: number): Promise<unknown[]> {
  const res = await fetchJSON<AnyRecord>('/players', {
    params: { 'team_ids[]': teamId, per_page: 100, page },
  });
  return Array.isArray(res?.data) ? res.data : [];
}

export async function teamRoster(teamId: string): Promise<Player[]> {
  return withCache(`teamRoster:${teamId}`, ROSTER_TTL, async () => {
    const all: Player[] = [];
    let page = 1;
    while (true) {
      const data = await fetchPlayersPage(teamId, page);
      if (!data.length) break;
      all.push(...data.map(mapPlayer));
      if (data.length < 100) break;
      page += 1;
      if (page > 10) break;
    }
    return all;
  });
}

export async function player(id: string): Promise<Player> {
  const res = await fetchJSON<AnyRecord>(`/players/${id}`);
  const data = isRecord(res) && isRecord(res.data) ? res.data : res;
  return mapPlayer(data);
}
