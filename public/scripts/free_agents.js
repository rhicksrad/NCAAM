import { bdl } from '../assets/js/bdl.js';

const ROSTER_SNAPSHOT_URL = new URL('../data/rosters.json', import.meta.url);
const MAX_STATS_PAGES = 320;
const MAX_CANDIDATES = 120;
const MIN_GAMES_PLAYED = 15;
const MIN_MINUTES_PER_GAME = 12;
const MAX_SEASON_PROBES = 4;
const MAX_ACTIVE_ROSTER_PAGES = 16;
const MANUAL_ROSTERED_OVERRIDES = new Set([
  // BDL lagged on the 2025 team option pickup for Keon Johnson (Nets).
  17896041,
]);

const PRECOMPUTED_BOARD_URL = new URL('../data/free_agents_live.json', import.meta.url);

const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function formatNumber(value, fractionDigits = 1) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function formatInteger(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return integerFormatter.format(value);
}

function parseMinutes(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value !== 'string' || value.length === 0) {
    return 0;
  }
  if (value.includes(':')) {
    const [min, sec] = value.split(':');
    const minutes = Number.parseInt(min, 10);
    const seconds = Number.parseInt(sec, 10);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes + seconds / 60;
    }
  }
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatSeasonLabel(season) {
  const next = String(season + 1);
  return `${season}-${next.slice(-2)}`;
}

async function fetchRosterSnapshot() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(ROSTER_SNAPSHOT_URL, 'utf-8');
    const snapshot = JSON.parse(raw);
    const rosterIds = extractRosterIds(snapshot);
    const liveRosterIds = await loadLiveRosterIds();
    mergeRosterIds(rosterIds, liveRosterIds);
    for (const id of MANUAL_ROSTERED_OVERRIDES) {
      rosterIds.add(id);
    }
    return { snapshot, rosterIds };
  }

  const response = await fetch(ROSTER_SNAPSHOT_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load roster snapshot (${response.status})`);
  }
  const snapshot = await response.json();
  const rosterIds = extractRosterIds(snapshot);
  const liveRosterIds = await loadLiveRosterIds();
  mergeRosterIds(rosterIds, liveRosterIds);
  for (const id of MANUAL_ROSTERED_OVERRIDES) {
    rosterIds.add(id);
  }
  return { snapshot, rosterIds };
}

function extractRosterIds(snapshot) {
  const rosterIds = new Set();
  for (const team of snapshot?.teams ?? []) {
    for (const player of team?.roster ?? []) {
      if (player?.id != null) {
        rosterIds.add(player.id);
      }
    }
  }
  return rosterIds;
}

function mergeRosterIds(target, incoming) {
  if (!incoming) return;
  for (const id of incoming) {
    target.add(id);
  }
}

async function loadLiveRosterIds() {
  try {
    return await fetchLiveRosterIds();
  } catch (error) {
    console.warn('Unable to fetch live Ball Don\'t Lie roster snapshot', error);
    return null;
  }
}

async function fetchLiveRosterIds() {
  const rosterIds = new Set();
  let cursor;
  const visited = new Set();

  for (let page = 0; page < MAX_ACTIVE_ROSTER_PAGES; page += 1) {
    const params = new URLSearchParams({ per_page: '100' });
    if (cursor != null) {
      params.set('cursor', String(cursor));
    }

    const payload = await bdl(`/v1/players/active?${params.toString()}`);
    const players = Array.isArray(payload?.data) ? payload.data : [];
    for (const player of players) {
      const id = Number(player?.id);
      if (Number.isFinite(id)) {
        rosterIds.add(id);
      }
    }

    const nextCursor = payload?.meta?.next_cursor;
    if (nextCursor == null || visited.has(String(nextCursor))) {
      break;
    }
    visited.add(String(nextCursor));
    cursor = nextCursor;
  }

  return rosterIds;
}

async function loadPrecomputedBoard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(PRECOMPUTED_BOARD_URL, { cache: 'no-store' });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Failed to load precomputed board (${response.status})`);
    }
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.entries) || payload.entries.length === 0) {
      return null;
    }
    return {
      entries: payload.entries,
      season: payload.season ?? null,
      seasonLabel: payload.seasonLabel ?? payload.season_label ?? null,
      rosterSnapshotFetchedAt: payload.rosterSnapshotFetchedAt ?? payload.roster_snapshot_fetched_at ?? null,
      generatedAt: payload.generated_at ?? null,
    };
  } catch (error) {
    console.warn('Unable to load precomputed free agent board', error);
    return null;
  }
}

async function seasonHasStats(season) {
  const params = new URLSearchParams({ per_page: '1', postseason: 'false' });
  params.append('seasons[]', String(season));
  const payload = await bdl(`/v1/stats?${params.toString()}`);
  return Array.isArray(payload?.data) && payload.data.length > 0;
}

async function resolveTargetSeason(snapshotSeasonStartYear) {
  const now = new Date();
  const fallback = now.getUTCFullYear() - (now.getUTCMonth() < 9 ? 1 : 0);
  let probe = Number.isFinite(snapshotSeasonStartYear)
    ? snapshotSeasonStartYear - 1
    : fallback;

  for (let attempt = 0; attempt < MAX_SEASON_PROBES; attempt += 1) {
    if (probe < 1979) break;
    if (await seasonHasStats(probe)) {
      return probe;
    }
    probe -= 1;
  }
  return probe;
}

function createAggregate(player) {
  return {
    profile: player,
    totals: {
      points: 0,
      assists: 0,
      rebounds: 0,
      steals: 0,
      blocks: 0,
      minutes: 0,
    },
    games: 0,
    lastTeam: null,
    lastGameDate: null,
  };
}

function updateLastTeam(aggregate, entry) {
  const gameDate = entry?.game?.date ? Date.parse(entry.game.date) : Number.NaN;
  if (Number.isNaN(gameDate)) {
    return;
  }
  if (!aggregate.lastGameDate || gameDate >= aggregate.lastGameDate) {
    aggregate.lastGameDate = gameDate;
    aggregate.lastTeam = entry?.team ?? aggregate.lastTeam;
  }
}

async function fetchFreeAgentAggregates({ season, rosterIds, maxPages = MAX_STATS_PAGES }) {
  const aggregates = new Map();
  let cursor;
  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({ per_page: '100', postseason: 'false' });
    params.append('seasons[]', String(season));
    if (cursor) params.set('cursor', cursor);
    const response = await bdl(`/v1/stats?${params.toString()}`);

    for (const entry of response?.data ?? []) {
      const player = entry?.player;
      const playerId = player?.id;
      if (playerId == null || rosterIds.has(playerId)) continue;

      const aggregate = aggregates.get(playerId) ?? createAggregate(player);
      const totals = aggregate.totals;
      totals.points += Number(entry?.pts) || 0;
      totals.assists += Number(entry?.ast) || 0;
      totals.rebounds += Number(entry?.reb) || 0;
      totals.steals += Number(entry?.stl) || 0;
      totals.blocks += Number(entry?.blk) || 0;
      totals.minutes += parseMinutes(entry?.min);
      aggregate.games += 1;
      updateLastTeam(aggregate, entry);
      aggregates.set(playerId, aggregate);
    }

    cursor = response?.meta?.next_cursor;
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      if (page === 0 || (page + 1) % 25 === 0 || !cursor) {
        console.log(`Aggregated ${aggregates.size} players after ${page + 1} pages (cursor=${cursor ?? 'end'})`);
      }
    }
    if (!cursor) break;
  }
  return aggregates;
}

function computeImpactScore(metrics) {
  if (!metrics) return 0;
  const {
    points = 0,
    assists = 0,
    rebounds = 0,
    steals = 0,
    blocks = 0,
    games = 0,
    minutes = 0,
  } = metrics;
  const durability = Math.min(games, 82) / 82;
  const workload = minutes > 0 ? minutes / 36 : 0;
  const productivity =
    points * 1.1 +
    assists * 0.9 +
    rebounds * 0.6 +
    steals * 1.2 +
    blocks * 1.0;
  return Number.parseFloat((productivity + durability * 4 + workload).toFixed(3));
}

function deriveMetricsFromAggregate(aggregate) {
  if (!aggregate || aggregate.games === 0) return null;
  const { totals, games } = aggregate;
  const perGame = (value) => (games > 0 ? value / games : 0);
  return {
    points: perGame(totals.points),
    assists: perGame(totals.assists),
    rebounds: perGame(totals.rebounds),
    steals: perGame(totals.steals),
    blocks: perGame(totals.blocks),
    minutes: perGame(totals.minutes),
    games,
  };
}

function resolveTeamLabel(profile, seedSnapshot) {
  const fromPlayers = profile?.team;
  if (fromPlayers?.full_name) {
    return {
      name: fromPlayers.full_name,
      abbreviation: fromPlayers.abbreviation || '',
    };
  }
  const fromSeed = seedSnapshot?.lastTeam;
  if (fromSeed?.full_name) {
    return {
      name: fromSeed.full_name,
      abbreviation: fromSeed.abbreviation || '',
    };
  }
  return { name: 'Free agent pool', abbreviation: '' };
}

function createMetric(label, value) {
  const wrapper = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  wrapper.append(dt, dd);
  return wrapper;
}

function renderIdentity(player) {
  const identity = document.createElement('div');
  identity.className = 'free-agent-radar__identity';

  const name = document.createElement('h3');
  name.className = 'free-agent-radar__name';
  name.textContent = player.name;
  identity.append(name);

  if (player.position) {
    const pos = document.createElement('span');
    pos.className = 'free-agent-radar__position';
    pos.textContent = player.position;
    identity.append(pos);
  }

  return identity;
}

function renderScore(score) {
  const scoreNode = document.createElement('div');
  scoreNode.className = 'free-agent-radar__score';

  const label = document.createElement('span');
  label.className = 'free-agent-radar__score-label';
  label.textContent = 'Impact score';

  const value = document.createElement('span');
  value.className = 'free-agent-radar__score-value';
  value.textContent = formatNumber(score, 1);

  scoreNode.append(label, value);
  return scoreNode;
}

function renderMeta(teamLabel, metrics, seasonLabel) {
  const meta = document.createElement('p');
  meta.className = 'free-agent-radar__meta';
  const parts = [];
  parts.push(`Last team: ${teamLabel}`);
  if (Number.isFinite(metrics.minutes) && metrics.minutes > 0) {
    parts.push(`${formatNumber(metrics.minutes, 1)} minutes/night`);
  }
  parts.push(`${formatInteger(metrics.games)} games in ${seasonLabel}`);
  meta.textContent = parts.join(' · ');
  return meta;
}

function renderMetrics(metrics) {
  const list = document.createElement('dl');
  list.className = 'free-agent-radar__metrics';
  list.append(
    createMetric('Points', formatNumber(metrics.points, 1)),
    createMetric('Assists', formatNumber(metrics.assists, 1)),
    createMetric('Rebounds', formatNumber(metrics.rebounds, 1)),
  );
  return list;
}

function renderRow(entry, index) {
  const item = document.createElement('li');
  item.className = 'free-agent-radar__item';

  const rank = document.createElement('span');
  rank.className = 'free-agent-radar__rank';
  rank.textContent = String(index + 1);
  item.append(rank);

  const body = document.createElement('div');
  body.className = 'free-agent-radar__body';
  body.append(renderIdentity(entry), renderMeta(entry.teamLabel, entry.metrics, entry.seasonLabel), renderMetrics(entry.metrics));
  item.append(body);

  item.append(renderScore(entry.score));
  return item;
}

function buildCandidateRecord(id, aggregate, season) {
  const metrics = deriveMetricsFromAggregate(aggregate);
  if (!metrics) return null;
  if (metrics.games < MIN_GAMES_PLAYED || metrics.minutes < MIN_MINUTES_PER_GAME) {
    return null;
  }
  const score = computeImpactScore(metrics);
  const team = resolveTeamLabel(aggregate.profile, { lastTeam: aggregate.lastTeam, player: aggregate.profile });
  const seasonLabel = formatSeasonLabel(season);
  const name = `${aggregate.profile?.first_name ?? ''} ${aggregate.profile?.last_name ?? ''}`.trim();
  return {
    id,
    name,
    position: aggregate.profile?.position || '',
    teamLabel: team.abbreviation ? `${team.name} (${team.abbreviation})` : team.name,
    metrics,
    score,
    seasonLabel,
  };
}

export async function getActiveFreeAgents() {
  const { snapshot, rosterIds } = await fetchRosterSnapshot();
  const season = await resolveTargetSeason(snapshot?.season_start_year);
  const aggregates = await fetchFreeAgentAggregates({ season, rosterIds });

  const candidates = [];
  for (const [id, aggregate] of aggregates) {
    const record = buildCandidateRecord(id, aggregate, season);
    if (record) {
      candidates.push(record);
    }
  }

  candidates.sort((a, b) => b.score - a.score || b.metrics.points - a.metrics.points);
  const entries = candidates.slice(0, MAX_CANDIDATES);
  return {
    entries,
    season,
    seasonLabel: formatSeasonLabel(season),
    rosterSnapshotFetchedAt: snapshot?.fetched_at ?? null,
  };
}

export async function renderFreeAgents() {
  const list = document.querySelector('[data-free-agent-list]');
  const subtitle = document.querySelector('[data-free-agent-subtitle]');
  const footnote = document.querySelector('[data-free-agent-footnote]');
  if (!list || !subtitle || !footnote) return;

  try {
    const precomputed = await loadPrecomputedBoard();
    const { entries: freeAgents, seasonLabel, rosterSnapshotFetchedAt, generatedAt } =
      precomputed ?? (await getActiveFreeAgents());
    list.innerHTML = '';

    if (freeAgents.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'free-agent-radar__placeholder';
      empty.textContent = 'No free agent production signals available at the moment.';
      list.append(empty);
      subtitle.textContent = 'Ball Don\'t Lie returned an empty free agent board — monitoring for the next update.';
      footnote.textContent = '';
      return;
    }

    freeAgents.slice(0, 20).forEach((entry, index) => {
      list.append(renderRow(entry, index));
    });

    const resolvedLabel = seasonLabel ?? freeAgents[0]?.seasonLabel ?? null;
    subtitle.textContent = resolvedLabel
      ? `Ranking unsigned players by ${resolvedLabel} regular-season output (Ball Don\'t Lie).`
      : "Ranking unsigned players by their latest regular-season production (Ball Don't Lie).";
    const updatedAtSource = rosterSnapshotFetchedAt ?? generatedAt ?? null;
    const updatedAt = updatedAtSource ? new Date(updatedAtSource) : new Date();
    const timestamp = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(updatedAt);
    const freshnessLabel = rosterSnapshotFetchedAt
      ? `roster snapshot updated ${timestamp}`
      : generatedAt
        ? `board generated ${timestamp}`
        : `refreshed ${timestamp}`;
    footnote.textContent = `Source: Ball Don\'t Lie free agent feed via Worker proxy — ${freshnessLabel}.`;
  } catch (error) {
    list.innerHTML = '';
    const fallback = document.createElement('li');
    fallback.className = 'free-agent-radar__placeholder';
    fallback.textContent = `Free agent board failed: ${error instanceof Error ? error.message : String(error)}`;
    list.append(fallback);
    subtitle.textContent = 'Live data required — no cached board shown.';
    footnote.textContent = '';
    console.error('Free agent radar failed to render', error);
  }
}
