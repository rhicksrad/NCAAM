import { execFile } from 'node:child_process';
import { setDefaultResultOrder } from 'node:dns';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

try {
  setDefaultResultOrder('ipv4first');
} catch {
  // noop — environment may not support altering DNS result order
}

const ROOT = resolve(new URL('../../', import.meta.url).pathname);
const OUTPUT_PATH = resolve(ROOT, 'public', 'data', 'team-height-snapshot.json');
const DEFAULT_BASE = 'https://ncaam.hicksrch.workers.dev';
const LOG_PROGRESS = process.env.NCAAM_HEIGHT_DEBUG === '1';
const STALE_WINDOW_MS = (() => {
  const raw = process.env.NCAAM_HEIGHT_STALE_MS;
  if (!raw) return 1000 * 60 * 60 * 12; // 12 hours
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1000 * 60 * 60 * 12;
})();
const TEAM_CHUNK_SIZE = (() => {
  const raw = process.env.NCAAM_HEIGHT_TEAM_CHUNK;
  if (!raw) return 20;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
})();
function normalizeBaseUrl(input) {
  if (!input) return DEFAULT_BASE;
  let base = input.trim();
  if (!base) return DEFAULT_BASE;
  base = base.replace(/\/+$/, '');
  if (base.endsWith('/ncaab/v1')) {
    return base.slice(0, -'/ncaab/v1'.length);
  }
  if (base.endsWith('/v1')) {
    return base.slice(0, -'/v1'.length);
  }
  return base;
}

const WORKER_BASE = normalizeBaseUrl(process.env.NCAAM_WORKER_URL ?? process.env.NCAAM_WORKER_BASE ?? DEFAULT_BASE);

function buildUrl(pathname) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return new URL(`${WORKER_BASE}${normalizedPath}`);
}

async function runCurl(url) {
  return new Promise((resolve, reject) => {
    execFile('curl', ['-sS', '-f', '--connect-timeout', '20', url], { encoding: 'utf8', maxBuffer: 25 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const details = stderr?.trim() || error.message;
        reject(new Error(`curl request failed for ${url}: ${details}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(pathname, params = new URLSearchParams(), attempt = 0) {
  const search = params instanceof URLSearchParams ? params : buildSearchParams(params);
  const url = buildUrl(pathname);
  url.search = search.toString();
  try {
    const body = await runCurl(url.toString());
    return JSON.parse(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const transient = /\b5\d{2}\b/.test(message) || message.toLowerCase().includes('timed out');
    if ((message.includes('429') || transient) && attempt < 6) {
      await sleep(1200 * (attempt + 1));
      return fetchJson(pathname, params, attempt + 1);
    }
    throw new Error(`Failed to fetch ${url.toString()}: ${message}`);
  }
}

function buildSearchParams(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry === undefined || entry === null) continue;
        search.append(key, String(entry));
      }
    } else {
      search.append(key, String(value));
    }
  }
  return search;
}

async function paginate(pathname, params = {}, pageSize = 100) {
  const results = [];
  let cursor;
  let nextPage = 1;

  while (true) {
    const search = buildSearchParams(params);
    if (!search.has('per_page')) {
      search.set('per_page', String(pageSize));
    }
    if (cursor !== undefined && cursor !== null) {
      search.set('cursor', String(cursor));
    } else if (nextPage !== undefined && nextPage !== null) {
      search.set('page', String(nextPage));
    }

    const payload = await fetchJson(pathname, search);
    const data = Array.isArray(payload?.data) ? payload.data : [];
    results.push(...data);
    if (LOG_PROGRESS) {
      const pageLabel = search.get('cursor') ?? search.get('page') ?? String(results.length);
      console.log(`[team-heights] fetched ${data.length} records from ${pathname} (cursor/page: ${pageLabel})`);
    }

    const meta = payload?.meta ?? {};
    const nextCursor = meta?.next_cursor;
    if (nextCursor !== undefined && nextCursor !== null && String(nextCursor).length > 0) {
      cursor = nextCursor;
      nextPage = undefined;
      await sleep(200);
      continue;
    }

    const metaNextPage = meta?.next_page;
    if (typeof metaNextPage === 'number' && Number.isFinite(metaNextPage)) {
      cursor = undefined;
      nextPage = metaNextPage;
      await sleep(200);
      continue;
    }

    const totalPages = typeof meta?.total_pages === 'number' ? meta.total_pages : undefined;
    const currentPage = typeof meta?.current_page === 'number' ? meta.current_page : undefined;
    if (
      totalPages !== undefined &&
      currentPage !== undefined &&
      Number.isFinite(totalPages) &&
      Number.isFinite(currentPage) &&
      currentPage < totalPages
    ) {
      cursor = undefined;
      nextPage = currentPage + 1;
      await sleep(200);
      continue;
    }

    break;
  }

  return results;
}

function parseHeightInches(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/["″]/gu, '')
    .replace(/(?:feet|foot|ft|inches|inch|in|cm)/giu, '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (!cleaned) return null;
  const normalized = cleaned
    .replace(/['’′]\s*/gu, "'")
    .replace(/\s+/gu, '-');
  const match = normalized.match(/^(\d+)(?:[-′'’](\d+))?$/u);
  if (!match) return null;
  const feet = Number.parseInt(match[1], 10);
  const inches = match[2] ? Number.parseInt(match[2], 10) : 0;
  if (!Number.isFinite(feet) || feet <= 0) return null;
  if (!Number.isFinite(inches) || inches < 0) return null;
  return feet * 12 + inches;
}

async function fetchTeams() {
  const teams = await paginate('/v1/teams', {});
  return teams
    .map(team => ({
      id: team?.id,
      full_name: team?.full_name,
      abbreviation: team?.abbreviation,
      conference: team?.conference ?? null,
      conference_id: team?.conference_id ?? null,
    }))
    .filter(team => Number.isInteger(team.id) && Number.isInteger(team.conference_id));
}

function summarizeRoster(team, roster) {
  const heights = [];
  for (const player of roster) {
    const inches = parseHeightInches(player?.height ?? null);
    if (inches !== null) {
      heights.push(inches);
    }
  }
  const sampleSize = heights.length;
  if (sampleSize === 0) {
    return {
      team_id: team.id,
      team: team.full_name,
      abbreviation: team.abbreviation ?? null,
      conference: team.conference,
      roster_count: Array.isArray(roster) ? roster.length : 0,
      measured_count: 0,
      average_height_inches: null,
    };
  }
  const total = heights.reduce((sum, value) => sum + value, 0);
  const average = total / sampleSize;
  return {
    team_id: team.id,
    team: team.full_name,
    abbreviation: team.abbreviation ?? null,
    conference: team.conference,
    roster_count: Array.isArray(roster) ? roster.length : 0,
    measured_count: sampleSize,
    average_height_inches: Number.parseFloat(average.toFixed(2)),
  };
}

export async function buildTeamHeightSnapshot() {
  const teams = await fetchTeams();
  if (teams.length === 0) {
    throw new Error('No teams returned from worker.');
  }

  const rosterMap = new Map();
  for (let index = 0; index < teams.length; index += TEAM_CHUNK_SIZE) {
    const chunk = teams.slice(index, index + TEAM_CHUNK_SIZE);
    const ids = chunk.map(team => team.id);
    const players = await paginate('/v1/players/active', { 'team_ids[]': ids }, 100);
    for (const player of players) {
      const teamInfo = player?.team;
      if (!teamInfo) continue;
      const rawId = teamInfo.id;
      const teamId = typeof rawId === 'number' ? rawId : Number.parseInt(String(rawId), 10);
      if (!Number.isInteger(teamId)) continue;
      if (!rosterMap.has(teamId)) {
        rosterMap.set(teamId, []);
      }
      rosterMap.get(teamId).push(player);
    }
    if (index + TEAM_CHUNK_SIZE < teams.length) {
      await sleep(400);
    }
  }

  const aggregates = teams.map(team => {
    const roster = rosterMap.get(team.id) ?? [];
    return summarizeRoster(team, roster);
  });

  const withAverage = aggregates.filter(entry => entry && entry.average_height_inches !== null);
  const withoutAverage = aggregates.filter(entry => entry && entry.average_height_inches === null);
  withAverage.sort((a, b) => b.average_height_inches - a.average_height_inches);

  return {
    generated_at: new Date().toISOString(),
    source: `${WORKER_BASE}/v1/players/active`,
    team_count: teams.length,
    measured_team_count: withAverage.length,
    teams: [...withAverage, ...withoutAverage],
  };
}

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readSnapshot(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function isFresh(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const generated = snapshot.generated_at;
  if (typeof generated !== 'string') return false;
  const ts = Date.parse(generated);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < STALE_WINDOW_MS;
}

async function writeSnapshot(snapshot) {
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const body = `${JSON.stringify(snapshot, null, 2)}\n`;
  await writeFile(OUTPUT_PATH, body, 'utf8');
  return snapshot;
}

export async function ensureTeamHeightSnapshot() {
  const forceRefresh = /^(1|true|yes)$/iu.test(process.env.NCAAM_REFRESH_HEIGHTS ?? '');
  if (!forceRefresh && (await fileExists(OUTPUT_PATH))) {
    try {
      const current = await readSnapshot(OUTPUT_PATH);
      if (isFresh(current)) {
        return current;
      }
    } catch (error) {
      console.warn('Unable to reuse existing team height snapshot, rebuilding.', error);
    }
  }

  const snapshot = await buildTeamHeightSnapshot();
  await writeSnapshot(snapshot);
  return snapshot;
}

export async function refreshTeamHeightSnapshot() {
  const snapshot = await buildTeamHeightSnapshot();
  await writeSnapshot(snapshot);
  return snapshot;
}

if (process.argv[1] && process.argv[1].endsWith('ensure-team-heights.js')) {
  ensureTeamHeightSnapshot()
    .then(snapshot => {
      console.log(`Prepared team height snapshot for ${snapshot.measured_team_count}/${snapshot.team_count} teams.`);
    })
    .catch(error => {
      console.error('Failed to ensure team height snapshot.', error);
      process.exitCode = 1;
    });
}
