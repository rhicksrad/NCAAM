import { bdl } from '../assets/js/bdl.js';
import { registerCharts, destroyCharts, helpers } from './hub-charts.js';

const API_PREFIX = '/v1';
const PAGE_SIZE = 100;
const REFRESH_INTERVAL_MS = 150000;
const NEXT_SEASON_TIPOFF_DATE = '2025-10-04';
const LAST_COMPLETED_SEASON_FINALE = '2024-06-17';
const FUTURE_SCHEDULE_END = '2026-06-30';
const EARLIEST_ARCHIVE_DATE = '1946-11-01';
const DEMO_GAME_DATES = ['2024-01-15', '2023-12-25', '2024-03-10', '2024-04-14', '2024-06-06'];

const NBA_TEAM_IDS = new Set([
  1610612737,
  1610612738,
  1610612739,
  1610612740,
  1610612741,
  1610612742,
  1610612743,
  1610612744,
  1610612745,
  1610612746,
  1610612747,
  1610612748,
  1610612749,
  1610612750,
  1610612751,
  1610612752,
  1610612753,
  1610612754,
  1610612755,
  1610612756,
  1610612757,
  1610612758,
  1610612759,
  1610612760,
  1610612761,
  1610612762,
  1610612763,
  1610612764,
  1610612765,
  1610612766,
]);

const BDL_TEAM_IDS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
]);

const stageRank = { live: 0, upcoming: 1, final: 2 };

const scoreboardContainer = document.querySelector('[data-scoreboard]');
const startDateInput = document.querySelector('[data-game-date-start]');
const endDateInput = document.querySelector('[data-game-date-end]');
const refreshButton = document.querySelector('[data-manual-refresh]');
const scoreboardViewButtons = document.querySelectorAll('[data-scoreboard-view]');

const metricTargets = {
  gamesTotal: document.querySelector('[data-metric="games-total"]'),
  liveCount: document.querySelector('[data-metric="live-count"]'),
  finalCount: document.querySelector('[data-metric="final-count"]'),
  avgMargin: document.querySelector('[data-metric="avg-margin"]'),
  avgDetail: document.querySelector('[data-metric="avg-detail"]'),
  topTotal: document.querySelector('[data-metric="top-total"]'),
  topDetail: document.querySelector('[data-metric="top-detail"]'),
  scoreboardSummary: document.querySelector('[data-metric="scoreboard-summary"]'),
  marginAnnotation: document.querySelector('[data-metric="margin-annotation"]'),
  dateLabel: document.querySelector('[data-selected-date]'),
  refreshLabel: document.querySelector('[data-refresh]'),
  fetchState: document.querySelector('[data-fetch-state]'),
};

function determineMaxSelectableDate() {
  const today = getTodayIso();
  if (FUTURE_SCHEDULE_END && today <= FUTURE_SCHEDULE_END) {
    return FUTURE_SCHEDULE_END;
  }
  return today;
}

function isLocalDevHost() {
  if (typeof window === 'undefined' || !window.location) {
    return false;
  }
  const hostname = window.location.hostname || '';
  if (!hostname) {
    return false;
  }
  if (hostname === 'localhost' || hostname === '0.0.0.0') {
    return true;
  }
  if (hostname === '::1') {
    return true;
  }
  return hostname.startsWith('127.');
}

function isOffseasonIsoDate(dateIso) {
  if (!isValidIsoDate(dateIso)) {
    return false;
  }
  const finale = parseDateOnly(LAST_COMPLETED_SEASON_FINALE);
  const tipoff = parseDateOnly(NEXT_SEASON_TIPOFF_DATE);
  const target = parseDateOnly(dateIso);
  if (!finale || !tipoff || !target) {
    return false;
  }
  return target.getTime() > finale.getTime() && target.getTime() < tipoff.getTime();
}

function shouldUseDemoSlate(todayIso) {
  if (isOffseasonIsoDate(todayIso)) {
    return true;
  }
  return isLocalDevHost();
}

function pickDemoDate(bounds) {
  const eligible = DEMO_GAME_DATES.filter((date) => {
    if (!isValidIsoDate(date)) {
      return false;
    }
    if (bounds?.min && date < bounds.min) {
      return false;
    }
    if (bounds?.max && date > bounds.max) {
      return false;
    }
    return true;
  });
  if (!eligible.length) {
    return null;
  }
  const index = Math.floor(Math.random() * eligible.length);
  return eligible[index];
}

function determineInitialDate() {
  const today = getTodayIso();
  const bounds = getSelectableBounds();
  const clampedToday = clampDate(today, bounds);
  if (clampedToday && !shouldUseDemoSlate(today)) {
    return clampedToday;
  }
  const demoDate = pickDemoDate(bounds);
  if (demoDate) {
    return demoDate;
  }
  if (bounds) {
    if (bounds.max) {
      return bounds.max;
    }
    if (bounds.min) {
      return bounds.min;
    }
  }
  return today;
}

function determineInitialRange() {
  const initial = determineInitialDate();
  return { start: initial, end: initial };
}

let activeRange = determineInitialRange();
let scoreboardView = 'all';
let latestGames = [];
let latestStats = [];
let lastUpdated = null;
let refreshTimer = null;
let loading = false;

function isNbaTeamId(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric)) {
    return false;
  }
  if (NBA_TEAM_IDS.has(numeric)) {
    return true;
  }
  return BDL_TEAM_IDS.has(numeric);
}

function deriveSeasonFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return month >= 7 ? year : year - 1;
}

function deriveSeasonsForRange(startIso, endIso) {
  const startDate = parseDateOnly(startIso);
  const endDate = parseDateOnly(endIso);
  if (!startDate || !endDate) {
    return [];
  }
  const startSeason = deriveSeasonFromDate(startDate);
  const endSeason = deriveSeasonFromDate(endDate);
  if (startSeason === null || endSeason === null) {
    return [];
  }
  const minSeason = Math.min(startSeason, endSeason);
  const maxSeason = Math.max(startSeason, endSeason);
  const seasons = [];
  for (let season = minSeason; season <= maxSeason; season += 1) {
    seasons.push(season);
  }
  return seasons;
}

function enumerateIsoDates(startIso, endIso) {
  const startDate = parseDateOnly(startIso);
  const endDate = parseDateOnly(endIso);
  if (!startDate || !endDate) {
    return [];
  }
  const days = [];
  const cursor = new Date(startDate.getTime());
  while (cursor.getTime() <= endDate.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function getTodayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function isValidIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDateLabel(value) {
  if (!isValidIsoDate(value)) {
    return value ?? '—';
  }
  const date = parseDateOnly(value);
  if (!date) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatRangeLabel(range) {
  if (!range || !isValidIsoDate(range.start) || !isValidIsoDate(range.end)) {
    if (range?.start && isValidIsoDate(range.start)) {
      return formatDateLabel(range.start);
    }
    if (range?.end && isValidIsoDate(range.end)) {
      return formatDateLabel(range.end);
    }
    return '—';
  }
  if (range.start === range.end) {
    return formatDateLabel(range.start);
  }
  const startDate = parseDateOnly(range.start);
  const endDate = parseDateOnly(range.end);
  if (!startDate || !endDate) {
    return `${range.start} – ${range.end}`;
  }
  const startLabel = startDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const endLabel = endDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${startLabel} – ${endLabel}`;
}

function formatTimeLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function getSelectableBounds() {
  return {
    min: EARLIEST_ARCHIVE_DATE,
    max: determineMaxSelectableDate(),
  };
}

function clampDate(value, bounds) {
  if (!bounds) {
    return isValidIsoDate(value) ? value : null;
  }
  if (!isValidIsoDate(value)) {
    return null;
  }
  let next = value;
  if (bounds.min && next < bounds.min) {
    next = bounds.min;
  }
  if (bounds.max && next > bounds.max) {
    next = bounds.max;
  }
  return next;
}

function sanitizeRange(range, options = {}) {
  const bounds = getSelectableBounds();
  let start = clampDate(range?.start, bounds);
  let end = clampDate(range?.end, bounds);
  if (!start && end) {
    start = end;
  }
  if (!end && start) {
    end = start;
  }
  if (!start && !end) {
    const fallback = clampDate(determineInitialDate(), bounds) ?? determineInitialDate();
    start = fallback;
    end = fallback;
  }
  if (start > end) {
    if (options.bias === 'start') {
      end = start;
    } else if (options.bias === 'end') {
      start = end;
    } else {
      end = start;
    }
  }
  return { start, end };
}

function sanitizeActiveRange() {
  activeRange = sanitizeRange(activeRange);
}

function applyRangeToInputs() {
  sanitizeActiveRange();
  const bounds = getSelectableBounds();
  if (startDateInput) {
    startDateInput.value = activeRange.start ?? '';
    if (bounds.min) {
      startDateInput.setAttribute('min', bounds.min);
    }
    const maxCandidate = activeRange.end ?? bounds.max;
    if (maxCandidate) {
      const effectiveMax = bounds.max && maxCandidate > bounds.max ? bounds.max : maxCandidate;
      startDateInput.setAttribute('max', effectiveMax);
    } else if (bounds.max) {
      startDateInput.setAttribute('max', bounds.max);
    }
  }
  if (endDateInput) {
    endDateInput.value = activeRange.end ?? '';
    const minCandidate = activeRange.start ?? bounds.min;
    if (minCandidate) {
      const effectiveMin = bounds.min && minCandidate < bounds.min ? bounds.min : minCandidate;
      endDateInput.setAttribute('min', effectiveMin);
    } else if (bounds.min) {
      endDateInput.setAttribute('min', bounds.min);
    }
    if (bounds.max) {
      endDateInput.setAttribute('max', bounds.max);
    }
  }
}

function updateActiveRange(nextRange, options = {}) {
  const sanitized = sanitizeRange({ ...activeRange, ...nextRange }, options);
  const changed = sanitized.start !== activeRange.start || sanitized.end !== activeRange.end;
  activeRange = sanitized;
  applyRangeToInputs();
  setMetric('dateLabel', formatRangeLabel(activeRange));
  if (changed) {
    scheduleAutoRefresh();
    loadGames();
  }
}

function isTodayWithinRange(range) {
  if (!range || !isValidIsoDate(range.start) || !isValidIsoDate(range.end)) {
    return false;
  }
  const today = getTodayIso();
  return range.start <= today && today <= range.end;
}

function buildSearchParams(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (Array.isArray(value)) {
      const paramKey = key.endsWith('[]') ? key : `${key}[]`;
      value.forEach((entry) => {
        if (entry === undefined || entry === null) {
          return;
        }
        search.append(paramKey, String(entry));
      });
    } else {
      search.set(key, String(value));
    }
  });
  return search;
}

async function request(endpoint, params = {}) {
  const search = buildSearchParams(params);
  const query = search.toString();
  const normalizedEndpoint = endpoint.replace(/^\/+/, '');
  const basePath = `${API_PREFIX}/${normalizedEndpoint}`;
  const path = query ? `${basePath}?${query}` : basePath;
  return bdl(path, { cache: 'no-store' });
}

function createGameKey(game) {
  const numericId = Number(game?.id);
  if (Number.isFinite(numericId) && numericId > 0) {
    return `id-${numericId}`;
  }
  const isoDate = typeof game?.isoDate === 'string' ? game.isoDate : 'date-tba';
  const visitor = game?.visitor?.abbreviation || game?.visitor?.name || 'visitor';
  const home = game?.home?.abbreviation || game?.home?.name || 'home';
  return `${isoDate}|${visitor}|${home}`;
}

async function fetchGamesForRange(startDate, endDate) {
  const { start, end } = sanitizeRange({ start: startDate, end: endDate });
  if (!start || !end) {
    return [];
  }

  const isoDates = enumerateIsoDates(start, end);
  if (!isoDates.length) {
    return [];
  }

  const seasons = deriveSeasonsForRange(start, end);
  const seen = new Map();
  let cursor;

  do {
    const params = {
      dates: isoDates,
      per_page: PAGE_SIZE,
      cursor,
    };
    if (seasons.length) {
      params.seasons = seasons;
    }

    // eslint-disable-next-line no-await-in-loop
    const payload = await request('games', params);
    const data = Array.isArray(payload?.data) ? payload.data : [];
    data.forEach((raw) => {
      const normalized = normalizeGame(raw, start);

      // Keep games where at least one side is an NBA team (preseason exhibitions included).
      const hasNbaSide =
        isNbaTeamId(normalized?.home?.id) || isNbaTeamId(normalized?.visitor?.id);
      if (!hasNbaSide) return;
      const key = createGameKey(normalized);
      if (!seen.has(key)) {
        seen.set(key, normalized);
      }
    });
    cursor = payload?.meta?.next_cursor ?? null;
  } while (cursor);

  return Array.from(seen.values());
}

function createStatKey(row) {
  const statId = Number(row?.id);
  if (Number.isFinite(statId) && statId > 0) {
    return `id-${statId}`;
  }
  const gameId = Number(row?.game?.id);
  const playerId = Number(row?.player?.id);
  if (Number.isFinite(gameId) && Number.isFinite(playerId)) {
    return `gp-${gameId}-${playerId}`;
  }
  const teamId = Number(row?.team?.id);
  const minutes = typeof row?.min === 'string' ? row.min : '';
  return `fallback-${gameId ?? 'game'}-${teamId ?? 'team'}-${playerId ?? 'player'}-${minutes}-${row?.pts ?? '0'}`;
}

function normalizeStatRow(raw, gameLookup) {
  if (!raw) {
    return null;
  }
  const statId = Number(raw?.id);
  const gameId = Number(raw?.game?.id);
  const teamId = Number(raw?.team?.id);
  const playerId = Number(raw?.player?.id);
  const first = typeof raw?.player?.first_name === 'string' ? raw.player.first_name.trim() : '';
  const last = typeof raw?.player?.last_name === 'string' ? raw.player.last_name.trim() : '';
  let name = `${first} ${last}`.trim();
  if (!name) {
    name = typeof raw?.player?.display_name === 'string' ? raw.player.display_name.trim() : '';
  }
  if (!name) {
    name = 'Player';
  }
  const teamName =
    typeof raw?.team?.full_name === 'string'
      ? raw.team.full_name
      : typeof raw?.team?.name === 'string'
      ? raw.team.name
      : 'Team';
  let teamAbbreviation = typeof raw?.team?.abbreviation === 'string' ? raw.team.abbreviation.trim() : '';
  if (!teamAbbreviation && teamName) {
    teamAbbreviation = teamName.slice(0, 3).toUpperCase();
  } else {
    teamAbbreviation = teamAbbreviation.toUpperCase();
  }
  const seconds = parseMinutesToSeconds(raw?.min);
  const game = Number.isFinite(gameId) ? gameLookup.get(gameId) : null;
  return {
    id: Number.isFinite(statId) ? statId : null,
    gameId: Number.isFinite(gameId) ? gameId : null,
    stage: game?.stage ?? null,
    playerId: Number.isFinite(playerId) ? playerId : null,
    playerName: name,
    teamId: Number.isFinite(teamId) ? teamId : null,
    teamName,
    teamAbbreviation,
    minutes: seconds / 60,
    seconds,
    pts: Number(raw?.pts ?? 0),
    ast: Number(raw?.ast ?? 0),
    reb: Number(raw?.reb ?? 0),
    oreb: Number(raw?.oreb ?? 0),
    dreb: Number(raw?.dreb ?? 0),
    stl: Number(raw?.stl ?? 0),
    blk: Number(raw?.blk ?? 0),
    turnover: Number(raw?.turnover ?? 0),
    pf: Number(raw?.pf ?? 0),
    fgm: Number(raw?.fgm ?? 0),
    fga: Number(raw?.fga ?? 0),
    fg3m: Number(raw?.fg3m ?? 0),
    fg3a: Number(raw?.fg3a ?? 0),
    ftm: Number(raw?.ftm ?? 0),
    fta: Number(raw?.fta ?? 0),
  };
}

async function fetchStatsForGames(games) {
  const gameLookup = new Map();
  const gameIds = [];
  games.forEach((game) => {
    const numericId = Number(game?.id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return;
    }
    gameLookup.set(numericId, game);
    gameIds.push(numericId);
  });
  if (!gameIds.length) {
    return [];
  }

  const uniqueIds = Array.from(new Set(gameIds));
  const results = new Map();
  const chunkSize = 10;
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const chunk = uniqueIds.slice(index, index + chunkSize);
    let cursor;
    do {
      const params = {
        game_ids: chunk,
        per_page: PAGE_SIZE,
        cursor,
      };
      // eslint-disable-next-line no-await-in-loop
      const payload = await request('stats', params);
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      rows.forEach((row) => {
        const key = createStatKey(row);
        if (results.has(key)) {
          return;
        }
        const normalized = normalizeStatRow(row, gameLookup);
        if (normalized) {
          results.set(key, normalized);
        }
      });
      cursor = payload?.meta?.next_cursor ?? null;
    } while (cursor);
  }

  return Array.from(results.values());
}

function parseDateTime(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseDateOnly(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function extractStatusIsoDate(status) {
  if (typeof status !== 'string') {
    return null;
  }
  const trimmed = status.trim();
  if (!trimmed) {
    return null;
  }
  if (isValidIsoDate(trimmed)) {
    return trimmed;
  }
  const parsed = parseDateTime(trimmed);
  if (!parsed) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function computeStage(status, period) {
  const normalized = (status ?? '').toString().toLowerCase();
  if (normalized.includes('final')) {
    return 'final';
  }
  if (period === 0) {
    return 'upcoming';
  }
  return 'live';
}

function normalizeTeam(team, score) {
  const abbreviation = team?.abbreviation ?? team?.name?.slice(0, 3) ?? '';
  return {
    id: team?.id ?? null,
    name: team?.full_name ?? team?.name ?? 'Team',
    abbreviation: abbreviation ? abbreviation.toUpperCase() : '',
    score: Number.isFinite(Number(score)) ? Number(score) : 0,
  };
}

function normalizeGame(raw, fallbackIsoDate) {
  const status = typeof raw?.status === 'string' ? raw.status.trim() : '';
  const period = Number.isFinite(Number(raw?.period)) ? Number(raw.period) : 0;
  const time = typeof raw?.time === 'string' ? raw.time.trim() : '';
  const tipoff = parseDateTime(raw?.datetime) ?? parseDateOnly(raw?.date);
  const home = normalizeTeam(raw?.home_team, raw?.home_team_score);
  const visitor = normalizeTeam(raw?.visitor_team, raw?.visitor_team_score);
  const margin = home.score - visitor.score;
  const totalPoints = home.score + visitor.score;
  const seasonTypeRaw = typeof raw?.season_type === 'string' ? raw.season_type.trim() : '';
  const seasonTypeNormalized = seasonTypeRaw.toLowerCase();
  const preseason =
    seasonTypeNormalized.includes('pre') ||
    /\bpre[-\s]?season\b/i.test(seasonTypeRaw) ||
    /\bpre[-\s]?season\b/i.test(status);

  return {
    id: raw?.id,
    isoDate: typeof raw?.date === 'string' ? raw.date : fallbackIsoDate,
    status,
    period,
    time,
    stage: computeStage(status, period),
    postseason: Boolean(raw?.postseason),
    preseason,
    seasonType: seasonTypeRaw,
    tipoff,
    home,
    visitor,
    margin,
    totalPoints,
  };
}

function normalizeStatusText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeClockValue(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const timeMatch = trimmed.match(/(\d{1,2}:\d{1,2}(?:\.\d{1,3})?)$/);
  if (timeMatch) {
    return timeMatch[1];
  }
  return trimmed.replace(/\s+/g, '');
}

function parseElapsedClockValue(value) {
  const sanitized = sanitizeClockValue(value);
  if (!sanitized) {
    return null;
  }
  const match = sanitized.match(/^(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!match) {
    return null;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return null;
  }
  const decimals = match[3] ? Math.min(match[3].length, 3) : 0;
  const precision = decimals ? 10 ** decimals : 1;
  const fractional = match[3] ? Number(match[3].slice(0, decimals)) : 0;
  return {
    sanitized,
    minutes,
    seconds,
    decimals,
    precision,
    fractional,
  };
}

function parseMinutesToSeconds(value) {
  if (typeof value !== 'string') {
    return 0;
  }
  const match = value.trim().match(/^(\d+):(\d{2})$/);
  if (!match) {
    return 0;
  }
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) {
    return 0;
  }
  return minutes * 60 + seconds;
}

function getPeriodDurationSeconds(period) {
  const normalized = Number(period);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return normalized > 4 ? 5 * 60 : 12 * 60;
}

function formatGameClock(game) {
  const sanitized = sanitizeClockValue(game?.time);
  if (!game || game.stage !== 'live') {
    return sanitized;
  }
  const parsed = parseElapsedClockValue(game.time);
  const periodDuration = getPeriodDurationSeconds(game.period);
  if (!parsed || !periodDuration) {
    return sanitized;
  }
  const elapsedUnits =
    parsed.minutes * 60 * parsed.precision +
    parsed.seconds * parsed.precision +
    parsed.fractional;
  const periodUnits = periodDuration * parsed.precision;
  if (!Number.isFinite(elapsedUnits) || elapsedUnits < 0) {
    return sanitized;
  }
  let remainingUnits = periodUnits - elapsedUnits;
  if (remainingUnits < 0) {
    remainingUnits = 0;
  }
  let minutes = Math.floor(remainingUnits / (60 * parsed.precision));
  let remainder = remainingUnits - minutes * 60 * parsed.precision;
  let seconds = Math.floor(remainder / parsed.precision);
  let fractionalUnits = remainder - seconds * parsed.precision;

  if (seconds >= 60) {
    minutes += Math.floor(seconds / 60);
    seconds %= 60;
  }

  if (minutes < 0) {
    minutes = 0;
  }

  let clock = `${minutes}:${String(seconds).padStart(2, '0')}`;
  if (parsed.decimals > 0) {
    const fractionText = String(fractionalUnits)
      .padStart(parsed.decimals, '0')
      .replace(/0+$/, '');
    if (fractionText) {
      clock += `.${fractionText}`;
    }
  }
  return clock;
}

function isHalftimeStatus(status) {
  if (typeof status !== 'string') {
    return false;
  }
  return /\bhalf(?:-|\s)?time\b/i.test(status);
}

function getOvertimeLabelFromPeriod(period) {
  const numeric = Number(period);
  if (!Number.isFinite(numeric) || numeric <= 4) {
    return null;
  }
  const overtimeIndex = numeric - 4;
  return overtimeIndex === 1 ? 'OT' : `${overtimeIndex}OT`;
}

function getOvertimeLabelFromStatus(status) {
  if (typeof status !== 'string') {
    return null;
  }
  const trimmed = status.trim();
  if (!trimmed) {
    return null;
  }
  if (/double\s+overtime/i.test(trimmed)) {
    return '2OT';
  }
  if (/triple\s+overtime/i.test(trimmed)) {
    return '3OT';
  }
  const ordinalMatch = trimmed.match(/\b(\d+)(?:st|nd|rd|th)?\s*(?:OT|overtime)\b/i);
  if (ordinalMatch) {
    const count = Number(ordinalMatch[1]);
    if (Number.isFinite(count)) {
      return count <= 1 ? 'OT' : `${count}OT`;
    }
  }
  const inlineMatch = trimmed.match(/\bOT(?:\s*|-) ?(\d+)\b/i);
  if (inlineMatch) {
    const count = Number(inlineMatch[1]);
    if (Number.isFinite(count)) {
      return count <= 1 ? 'OT' : `${count}OT`;
    }
  }
  if (/\bovertime\b/i.test(trimmed) || /\bOT\b/i.test(trimmed)) {
    return 'OT';
  }
  return null;
}

function deriveOvertimeLabel(status, period) {
  return getOvertimeLabelFromStatus(status) || getOvertimeLabelFromPeriod(period);
}

function formatPeriodLabel(game) {
  if (game.stage === 'final') {
    return 'Final';
  }
  const status = normalizeStatusText(game?.status);
  if (isHalftimeStatus(status)) {
    return 'Halftime';
  }
  const overtimeLabel = deriveOvertimeLabel(status, game?.period);
  if (overtimeLabel) {
    return overtimeLabel;
  }
  const period = Number.isFinite(game?.period) ? Number(game.period) : 0;
  if (period <= 0) {
    return '';
  }
  if (period === 1) return '1st Qtr';
  if (period === 2) return '2nd Qtr';
  if (period === 3) return '3rd Qtr';
  if (period === 4) return '4th Qtr';
  return getOvertimeLabelFromPeriod(period) ?? '';
}

function formatGameStatus(game) {
  const status = normalizeStatusText(game.status);
  const normalized = status.toLowerCase();
  const clock = formatGameClock(game);
  const periodLabel = formatPeriodLabel(game);
  const halftime = isHalftimeStatus(status);
  const overtimeLabel = deriveOvertimeLabel(status, game?.period);

  if (game.stage === 'final' || normalized.includes('final')) {
    return 'Final';
  }

  if (normalized.includes('scheduled')) {
    return 'Scheduled';
  }

  if (halftime) {
    return 'Halftime';
  }

  if (normalized.includes('progress')) {
    if (overtimeLabel) {
      return clock ? `${overtimeLabel} • ${clock}` : overtimeLabel;
    }
    if (periodLabel && clock) {
      return `${status} • ${periodLabel} ${clock}`;
    }
    if (periodLabel) {
      return `${status} • ${periodLabel}`;
    }
    if (clock) {
      return `${status} • ${clock}`;
    }
    return status || 'In Progress';
  }

  if (game.stage === 'upcoming') {
    return status || formatTimeLabel(game.tipoff) || 'Scheduled';
  }

  if (game.stage === 'live') {
    const label = overtimeLabel || periodLabel || status || 'In Progress';
    return clock ? `${label} • ${clock}` : label;
  }

  return status || 'Final';
}

function formatMarginString(game) {
  if (!Number.isFinite(game?.margin)) {
    return null;
  }
  if (game.margin === 0) {
    return 'Level game';
  }
  const leader = game.margin > 0 ? game.home : game.visitor;
  const prefix = game.margin > 0 ? '+' : '−';
  return `${leader.abbreviation || leader.name}: ${prefix}${helpers.formatNumber(Math.abs(game.margin), 0)} pts`;
}

function formatTotalString(game) {
  if (!Number.isFinite(game?.totalPoints) || game.totalPoints <= 0) {
    return null;
  }
  return `${helpers.formatNumber(game.totalPoints, 0)} pts total`;
}

function formatGameMeta(game) {
  if (game.stage === 'upcoming') {
    const tip = formatTimeLabel(game.tipoff);
    return tip ? `Local tip ${tip}` : '';
  }
  const total = formatTotalString(game);
  if (game.postseason) {
    return total ? `${total} • Postseason` : 'Postseason';
  }
  if (game.preseason) {
    return total ? `${total} • Preseason` : 'Preseason';
  }
  return total ?? '';
}

function formatPeriodDetail(game) {
  if (game.stage === 'final') {
    if (game.period > 4) {
      const overtime = game.period - 4;
      return overtime === 1 ? 'Finished in OT' : `Finished in ${overtime}OT`;
    }
    return 'Finished in regulation';
  }
  const periodLabel = formatPeriodLabel(game);
  if (!periodLabel) {
    return null;
  }
  if (periodLabel === 'Halftime') {
    return 'Halftime';
  }
  if (/OT$/i.test(periodLabel)) {
    return periodLabel === 'OT' ? 'In overtime' : `In ${periodLabel}`;
  }
  return `Period: ${periodLabel}`;
}

function formatSignedMargin(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  const magnitude = helpers.formatNumber(Math.abs(value), 0);
  if (value > 0) return `+${magnitude}`;
  if (value < 0) return `−${magnitude}`;
  return '0';
}

function clearScoreboard() {
  if (scoreboardContainer) {
    scoreboardContainer.innerHTML = '';
  }
}

function renderScoreboardState(message) {
  if (!scoreboardContainer) {
    return;
  }
  clearScoreboard();
  const state = document.createElement('p');
  state.className = 'scoreboard-state';
  state.textContent = message;
  scoreboardContainer.appendChild(state);
}

function normalizeScoreboardView(value) {
  if (value === 'live') {
    return 'live';
  }
  if (value === 'upcoming') {
    return 'upcoming';
  }
  return 'all';
}

function updateScoreboardViewButtons() {
  if (!scoreboardViewButtons || !scoreboardViewButtons.length) {
    return;
  }
  scoreboardViewButtons.forEach((button) => {
    const view = normalizeScoreboardView(button.getAttribute('data-scoreboard-view'));
    const isActive = view === scoreboardView;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function filterGamesForView(games) {
  if (!Array.isArray(games)) {
    return [];
  }
  if (scoreboardView === 'upcoming') {
    return games.filter((game) => game.stage === 'upcoming');
  }
  if (scoreboardView === 'live') {
    return games.filter((game) => game.stage === 'live');
  }
  return games;
}

function setScoreboardView(nextView) {
  const normalized = normalizeScoreboardView(nextView);
  if (normalized === scoreboardView) {
    return;
  }
  scoreboardView = normalized;
  updateScoreboardViewButtons();
  renderScoreboard(latestGames);
}

function createTeamRow(team, game, role) {
  const row = document.createElement('div');
  row.className = 'scoreboard-card__row';

  const teamWrapper = document.createElement('div');
  teamWrapper.className = 'scoreboard-card__team';

  const tricode = document.createElement('span');
  tricode.className = 'scoreboard-card__tricode';
  tricode.textContent = team.abbreviation || team.name.slice(0, 3).toUpperCase();

  const name = document.createElement('span');
  name.className = 'scoreboard-card__name';
  name.textContent = team.name;

  teamWrapper.append(tricode, name);

  const score = document.createElement('span');
  score.className = 'scoreboard-card__score';
  const scoreValue = Number.isFinite(team.score) ? team.score : 0;
  score.textContent = helpers.formatNumber(scoreValue, 0);
  if (formatSignedMargin(game.margin) !== null) {
    const isLeader = (game.margin > 0 && role === 'home') || (game.margin < 0 && role === 'visitor');
    if (isLeader && game.margin !== 0) {
      score.classList.add('scoreboard-card__score--lead');
    }
  }

  row.append(teamWrapper, score);
  return row;
}

function createScoreboardCard(game) {
  const card = document.createElement('article');
  card.className = `scoreboard-card scoreboard-card--${game.stage}`;
  card.setAttribute('data-game-id', String(game.id ?? ''));

  const header = document.createElement('header');
  header.className = 'scoreboard-card__header';

  const statusSpan = document.createElement('span');
  statusSpan.className = 'scoreboard-card__status';
  const isoStatus = game.stage === 'upcoming' ? extractStatusIsoDate(game.status) : null;
  const statusLabel = isoStatus ?? formatGameStatus(game);
  statusSpan.textContent = statusLabel;
  if (isoStatus) {
    statusSpan.setAttribute('data-iso-date', isoStatus);
    const friendly = formatDateLabel(isoStatus);
    if (friendly && friendly !== isoStatus) {
      statusSpan.setAttribute('title', friendly);
      statusSpan.setAttribute('aria-label', friendly);
    }
  }
  header.appendChild(statusSpan);

  const metaText = formatGameMeta(game);
  if (metaText) {
    const metaSpan = document.createElement('span');
    metaSpan.className = 'scoreboard-card__meta';
    metaSpan.textContent = metaText;
    header.appendChild(metaSpan);
  }

  const rows = document.createElement('div');
  rows.className = 'scoreboard-card__rows';
  rows.appendChild(createTeamRow(game.visitor, game, 'visitor'));
  rows.appendChild(createTeamRow(game.home, game, 'home'));

  const footer = document.createElement('div');
  footer.className = 'scoreboard-card__footer';
  const margin = game.stage === 'upcoming' ? null : formatMarginString(game);
  if (margin) {
    const marginSpan = document.createElement('span');
    marginSpan.textContent = margin;
    footer.appendChild(marginSpan);
  }
  const periodDetail = formatPeriodDetail(game);
  if (periodDetail) {
    const periodSpan = document.createElement('span');
    periodSpan.textContent = periodDetail;
    footer.appendChild(periodSpan);
  }
  const total = formatTotalString(game);
  if (total) {
    const totalSpan = document.createElement('span');
    totalSpan.textContent = total;
    footer.appendChild(totalSpan);
  }
  if (game.postseason) {
    const postseasonSpan = document.createElement('span');
    postseasonSpan.textContent = 'Postseason matchup';
    footer.appendChild(postseasonSpan);
  } else if (game.preseason) {
    const preseasonSpan = document.createElement('span');
    preseasonSpan.textContent = 'Preseason matchup';
    footer.appendChild(preseasonSpan);
  }

  card.append(header, rows);
  if (footer.childNodes.length) {
    card.appendChild(footer);
  }
  const numericId = Number(game?.id);
  if (Number.isFinite(numericId) && numericId > 0) {
    const actions = document.createElement('div');
    actions.className = 'scoreboard-card__actions';
    const link = document.createElement('a');
    link.className = 'scoreboard-card__link';
    const isLiveOrFinal = game.stage === 'live' || game.stage === 'final';
    const targetPage = isLiveOrFinal ? 'game-tracker.html' : 'game-preview.html';
    link.href = `${targetPage}?gameId=${numericId}`;
    const visitorLabel = game.visitor?.name || game.visitor?.abbreviation || 'Road team';
    const homeLabel = game.home?.name || game.home?.abbreviation || 'Home team';
    link.textContent = isLiveOrFinal ? 'Open live tracker' : 'Matchup preview';
    const ariaLabelAction = isLiveOrFinal ? 'live tracker' : 'matchup preview';
    link.setAttribute('aria-label', `Open ${ariaLabelAction} for ${visitorLabel} at ${homeLabel}`);
    actions.appendChild(link);
    card.appendChild(actions);
  }
  return card;
}

function renderScoreboard(games) {
  if (!scoreboardContainer) {
    return;
  }
  clearScoreboard();
  if (!Array.isArray(games) || !games.length) {
    renderScoreboardState('No NBA games for this date.');
    return;
  }
  const filtered = filterGamesForView(games);
  if (!filtered.length) {
    let message = 'No NBA games for this date.';
    if (scoreboardView === 'live') {
      message = 'No games are live for this date. Check the upcoming slate or completed finals instead.';
    } else if (scoreboardView === 'upcoming') {
      message = 'No upcoming games remain for this date. All matchups have either started or finished.';
    }
    renderScoreboardState(message);
    return;
  }
  const sorted = [...filtered].sort((a, b) => {
    const stageDelta = (stageRank[a.stage] ?? 3) - (stageRank[b.stage] ?? 3);
    if (stageDelta !== 0) {
      return stageDelta;
    }
    const timeA = a.tipoff instanceof Date ? a.tipoff.getTime() : 0;
    const timeB = b.tipoff instanceof Date ? b.tipoff.getTime() : 0;
    if (timeA !== timeB) {
      return timeA - timeB;
    }
    return (a.id ?? 0) - (b.id ?? 0);
  });
  sorted.forEach((game) => {
    scoreboardContainer.appendChild(createScoreboardCard(game));
  });
}

function setMetric(key, value, fallback = '—') {
  const target = metricTargets[key];
  if (!target) {
    return;
  }
  const output = value === null || value === undefined || value === '' ? fallback : value;
  target.textContent = output;
}

function updateMetrics(games) {
  const totalGames = games.length;
  setMetric('gamesTotal', totalGames ? helpers.formatNumber(totalGames, 0) : '0');
  setMetric('dateLabel', formatRangeLabel(activeRange));

  const upcomingCount = games.filter((game) => game.stage === 'upcoming').length;
  const liveCount = games.filter((game) => game.stage === 'live').length;
  setMetric('liveCount', helpers.formatNumber(liveCount, 0));

  const finals = games.filter((game) => game.stage === 'final');
  setMetric('finalCount', helpers.formatNumber(finals.length, 0));

  if (finals.length) {
    const avgMargin =
      finals.reduce((total, game) => total + Math.abs(Number.isFinite(game.margin) ? game.margin : 0), 0) / finals.length;
    setMetric('avgMargin', `${helpers.formatNumber(avgMargin, 1)} pts`);
    setMetric('avgDetail', finals.length === 1 ? 'Across 1 final' : `Across ${finals.length} finals`);
  } else {
    setMetric('avgMargin', '—');
    setMetric('avgDetail', games.length ? 'Awaiting finals' : 'Awaiting results');
  }

  const scoringTeams = [];
  games.forEach((game) => {
    if (game.home.score > 0) {
      scoringTeams.push({
        label: game.home.abbreviation || game.home.name,
        points: game.home.score,
        opponent: game.visitor,
        opponentPoints: game.visitor.score,
        location: 'home',
      });
    }
    if (game.visitor.score > 0) {
      scoringTeams.push({
        label: game.visitor.abbreviation || game.visitor.name,
        points: game.visitor.score,
        opponent: game.home,
        opponentPoints: game.home.score,
        location: 'away',
      });
    }
  });
  const topTeam = scoringTeams.sort((a, b) => b.points - a.points)[0];
  if (topTeam) {
    setMetric('topTotal', `${helpers.formatNumber(topTeam.points, 0)} pts`);
    const opponentLabel = topTeam.opponent.abbreviation || topTeam.opponent.name;
    const opponentPoints = helpers.formatNumber(topTeam.opponentPoints ?? 0, 0);
    const matchupPrefix = topTeam.location === 'away' ? '@' : 'vs';
    setMetric('topDetail', `${matchupPrefix} ${opponentLabel} · ${helpers.formatNumber(topTeam.points, 0)}-${opponentPoints}`);
  } else {
    setMetric('topTotal', '—');
    setMetric('topDetail', games.length ? 'Scores building' : 'No scores yet');
  }

  if (totalGames) {
    const summaryParts = [];
    summaryParts.push(`${helpers.formatNumber(upcomingCount, 0)} upcoming`);
    summaryParts.push(`${helpers.formatNumber(liveCount, 0)} live`);
    summaryParts.push(`${helpers.formatNumber(finals.length, 0)} final${finals.length === 1 ? '' : 's'}`);
    setMetric('scoreboardSummary', summaryParts.join(' · '));
  } else {
    setMetric('scoreboardSummary', 'No games');
  }

  if (finals.length) {
    const closest = finals.reduce((min, game) => {
      const distance = Math.abs(Number.isFinite(game.margin) ? game.margin : Number.POSITIVE_INFINITY);
      return Math.min(min, distance);
    }, Number.POSITIVE_INFINITY);
    if (Number.isFinite(closest) && closest !== Number.POSITIVE_INFINITY) {
      setMetric('marginAnnotation', `Closest final: ${helpers.formatNumber(closest, 0)} pts`);
    } else {
      setMetric('marginAnnotation', 'Final margins logged');
    }
  } else if (liveCount) {
    setMetric('marginAnnotation', 'Live margins updating');
  } else {
    setMetric('marginAnnotation', 'No finals yet');
  }
}

function setRefreshTimestamp(date) {
  if (!metricTargets.refreshLabel) {
    return;
  }
  const label = date instanceof Date && !Number.isNaN(date.getTime()) ? formatTimeLabel(date) : null;
  metricTargets.refreshLabel.textContent = label ?? '—';
}

function setFetchMessage(message = '', type = 'idle') {
  const target = metricTargets.fetchState;
  if (!target) {
    return;
  }
  target.textContent = message;
  target.classList.remove('is-error', 'is-success');
  if (type === 'error') {
    target.classList.add('is-error');
  } else if (type === 'success') {
    target.classList.add('is-success');
  }
}

function fallbackChart(message, options = {}) {
  const { type = 'doughnut', indexAxis, scales } = options ?? {};
  const datasetColor = type === 'bar' ? 'rgba(17, 86, 214, 0.25)' : 'rgba(17, 86, 214, 0.12)';
  const dataValues = type === 'bar' ? [0] : [1];
  const config = {
    type,
    data: {
      labels: [''],
      datasets: [
        {
          data: dataValues,
          backgroundColor: [datasetColor],
          borderWidth: 0,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        title: { display: true, text: message },
      },
    },
  };
  if (type === 'bar') {
    config.options.indexAxis = indexAxis ?? 'x';
    config.options.scales =
      scales ?? {
        x: { beginAtZero: true, display: false },
        y: { display: false },
      };
  } else if (scales) {
    config.options.scales = scales;
  }
  return config;
}

function filterRelevantStats(stats) {
  if (!Array.isArray(stats)) {
    return [];
  }
  return stats.filter((stat) => stat && stat.stage !== 'upcoming');
}

function computePercentage(makes, attempts) {
  const made = Number(makes ?? 0);
  const taken = Number(attempts ?? 0);
  if (!Number.isFinite(made) || !Number.isFinite(taken) || taken <= 0) {
    return null;
  }
  return (made / taken) * 100;
}

function buildMarginChart(games) {
  const relevant = games.filter((game) => game.stage !== 'upcoming');
  const buckets = [
    { label: '0-5', min: 0, max: 5 },
    { label: '6-10', min: 5, max: 10 },
    { label: '11-15', min: 10, max: 15 },
    { label: '16-20', min: 15, max: 20 },
    { label: '21+', min: 20, max: Number.POSITIVE_INFINITY },
  ];
  const counts = buckets.map(() => 0);
  relevant.forEach((game) => {
    const margin = Math.abs(Number.isFinite(game.margin) ? game.margin : 0);
    const index = buckets.findIndex((bucket, bucketIndex) => {
      if (bucketIndex === buckets.length - 1) {
        return margin >= bucket.min;
      }
      return margin >= bucket.min && margin < bucket.max;
    });
    if (index >= 0) {
      counts[index] += 1;
    }
  });
  if (!counts.some((count) => count > 0)) {
    return fallbackChart('Margins not available yet');
  }
  return {
    type: 'bar',
    data: {
      labels: buckets.map((bucket) => bucket.label),
      datasets: [
        {
          label: 'Games',
          data: counts,
          backgroundColor: 'rgba(17, 86, 214, 0.78)',
          borderRadius: 12,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          title: { display: true, text: 'Game count' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  };
}

function buildScoringChart(games) {
  const teams = [];
  games.forEach((game) => {
    if (game.home.score > 0) {
      teams.push({
        label: game.home.abbreviation || game.home.name,
        name: game.home.name,
        points: game.home.score,
        opponent: game.visitor,
      });
    }
    if (game.visitor.score > 0) {
      teams.push({
        label: game.visitor.abbreviation || game.visitor.name,
        name: game.visitor.name,
        points: game.visitor.score,
        opponent: game.home,
      });
    }
  });
  const top = teams.sort((a, b) => b.points - a.points).slice(0, 6);
  if (!top.length) {
    return fallbackChart('Scoring data building');
  }
  const colors = ['#1156d6', '#ef3d5b', '#1f7bff', '#f4b53f', '#6c4fe0', '#11b5c6'];
  return {
    type: 'bar',
    data: {
      labels: top.map((team) => team.label),
      datasets: [
        {
          label: 'Points',
          data: top.map((team) => team.points),
          backgroundColor: top.map((_, index) => colors[index % colors.length]),
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const team = top[context.dataIndex];
              const opponent = team.opponent.abbreviation || team.opponent.name;
              return `${context.formattedValue} vs ${opponent}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: 'Points' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        y: {
          grid: { display: false },
        },
      },
    },
  };
}

function buildBalanceChart(games) {
  const relevant = games.filter((game) => game.home.score > 0 || game.visitor.score > 0);
  if (!relevant.length) {
    return fallbackChart('Score data pending', {
      type: 'bar',
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true, display: false },
        y: { display: false },
      },
    });
  }
  const entries = relevant
    .map((game) => {
      const visitorAbbr = game.visitor.abbreviation || game.visitor.name;
      const homeAbbr = game.home.abbreviation || game.home.name;
      const margin = Number.isFinite(game.margin)
        ? game.margin
        : (Number(game.home.score) || 0) - (Number(game.visitor.score) || 0);
      const total = Number(game.home.score || 0) + Number(game.visitor.score || 0);
      return {
        x: margin,
        stage: game.stage,
        label: `${visitorAbbr} @ ${homeAbbr}`,
        visitorAbbr,
        homeAbbr,
        visitorScore: Number(game.visitor.score || 0),
        homeScore: Number(game.home.score || 0),
        total,
      };
    })
    .sort((a, b) => {
      const diff = Math.abs(a.x) - Math.abs(b.x);
      if (diff !== 0) {
        return diff;
      }
      return b.total - a.total;
    })
    .slice(0, 14);

  const datasetEntries = entries.map((entry, index) => ({ ...entry, y: index }));

  const stagePalette = {
    final: {
      home: 'rgba(17, 86, 214, 0.85)',
      visitor: 'rgba(239, 61, 91, 0.85)',
      neutral: 'rgba(154, 165, 196, 0.8)',
    },
    live: {
      home: 'rgba(17, 86, 214, 0.65)',
      visitor: 'rgba(239, 61, 91, 0.72)',
      neutral: 'rgba(154, 165, 196, 0.6)',
    },
  };

  const colors = datasetEntries.map((entry) => {
    const palette = stagePalette[entry.stage] ?? stagePalette.live;
    if (Math.abs(entry.x) < 0.5) {
      return palette.neutral;
    }
    return entry.x > 0 ? palette.home : palette.visitor;
  });

  const maxMagnitude = Math.max(...datasetEntries.map((entry) => Math.abs(entry.x)), 1);
  const marginPadding = Math.max(2, Math.ceil(maxMagnitude * 0.1));

  const yDomainMax = datasetEntries.length > 0 ? datasetEntries.length - 1 : 0;

  return {
    type: 'bar',
    data: {
      datasets: [
        {
          label: 'Margin (home - visitor)',
          data: datasetEntries,
          parsing: false,
          backgroundColor: colors,
          borderRadius: 8,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const raw = context.raw || {};
              const pieces = [];
              if (raw.label) {
                pieces.push(raw.label);
              }
              if (raw.stage) {
                pieces.push(raw.stage.charAt(0).toUpperCase() + raw.stage.slice(1));
              }
              const margin = formatSignedMargin(raw.x);
              if (margin) {
                pieces.push(`Margin ${margin}`);
              }
              pieces.push(`${raw.visitorAbbr ?? 'Visitor'} ${helpers.formatNumber(raw.visitorScore ?? 0, 0)}`);
              pieces.push(`${raw.homeAbbr ?? 'Home'} ${helpers.formatNumber(raw.homeScore ?? 0, 0)}`);
              if (Number.isFinite(raw.total) && raw.total > 0) {
                pieces.push(`Total ${helpers.formatNumber(raw.total, 0)}`);
              }
              return pieces;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          min: -1 * (maxMagnitude + marginPadding),
          max: maxMagnitude + marginPadding,
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
          title: { display: true, text: 'Point margin (home - visitor)' },
          ticks: {
            callback(value) {
              return formatSignedMargin(value);
            },
          },
        },
        y: {
          type: 'linear',
          min: -0.5,
          max: yDomainMax + 0.5,
          offset: true,
          ticks: {
            stepSize: 1,
            callback(value) {
              const index = Number(value);
              if (Number.isInteger(index)) {
                return datasetEntries[index]?.label ?? '';
              }
              return '';
            },
          },
          grid: { display: false },
        },
      },
    },
  };
}

function collectPlayerTotals(stats) {
  const totals = new Map();
  filterRelevantStats(stats).forEach((stat) => {
    if (!stat?.playerName) {
      return;
    }
    const teamKey = Number.isFinite(stat.teamId) ? stat.teamId : stat.teamName;
    const playerKey = Number.isFinite(stat.playerId) ? stat.playerId : stat.playerName;
    const key = `${playerKey}-${teamKey ?? 'team'}`;
    if (!totals.has(key)) {
      totals.set(key, {
        key,
        playerId: stat.playerId,
        name: stat.playerName,
        teamId: stat.teamId,
        teamName: stat.teamName,
        teamAbbreviation: stat.teamAbbreviation || stat.teamName || 'Team',
        pts: 0,
        ast: 0,
        reb: 0,
        oreb: 0,
        stl: 0,
        blk: 0,
        fgm: 0,
        fga: 0,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        turnover: 0,
        seconds: 0,
        games: new Set(),
      });
    }
    const entry = totals.get(key);
    entry.pts += Number(stat.pts ?? 0);
    entry.ast += Number(stat.ast ?? 0);
    entry.reb += Number(stat.reb ?? 0);
    entry.oreb += Number(stat.oreb ?? 0);
    entry.stl += Number(stat.stl ?? 0);
    entry.blk += Number(stat.blk ?? 0);
    entry.fgm += Number(stat.fgm ?? 0);
    entry.fga += Number(stat.fga ?? 0);
    entry.fg3m += Number(stat.fg3m ?? 0);
    entry.fg3a += Number(stat.fg3a ?? 0);
    entry.ftm += Number(stat.ftm ?? 0);
    entry.fta += Number(stat.fta ?? 0);
    entry.turnover += Number(stat.turnover ?? 0);
    entry.seconds += Number(stat.seconds ?? 0);
    if (Number.isFinite(stat.gameId)) {
      entry.games.add(stat.gameId);
    }
  });
  return totals;
}

function collectTeamTotals(stats) {
  const totals = new Map();
  filterRelevantStats(stats).forEach((stat) => {
    if (!stat?.teamName) {
      return;
    }
    const key = Number.isFinite(stat.teamId) ? stat.teamId : stat.teamName;
    if (!totals.has(key)) {
      totals.set(key, {
        teamId: stat.teamId,
        teamName: stat.teamName,
        teamAbbreviation: stat.teamAbbreviation || stat.teamName || 'Team',
        pts: 0,
        fgm: 0,
        fga: 0,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        oreb: 0,
        reb: 0,
        stl: 0,
        blk: 0,
        turnover: 0,
        games: new Set(),
      });
    }
    const entry = totals.get(key);
    entry.pts += Number(stat.pts ?? 0);
    entry.fgm += Number(stat.fgm ?? 0);
    entry.fga += Number(stat.fga ?? 0);
    entry.fg3m += Number(stat.fg3m ?? 0);
    entry.fg3a += Number(stat.fg3a ?? 0);
    entry.ftm += Number(stat.ftm ?? 0);
    entry.fta += Number(stat.fta ?? 0);
    entry.oreb += Number(stat.oreb ?? 0);
    entry.reb += Number(stat.reb ?? 0);
    entry.stl += Number(stat.stl ?? 0);
    entry.blk += Number(stat.blk ?? 0);
    entry.turnover += Number(stat.turnover ?? 0);
    if (Number.isFinite(stat.gameId)) {
      entry.games.add(stat.gameId);
    }
  });
  return totals;
}

function computePerGame(value, gameCount) {
  const numericValue = Number(value);
  const gamesPlayed = Number(gameCount);
  if (!Number.isFinite(numericValue) || !Number.isFinite(gamesPlayed) || gamesPlayed <= 0) {
    return 0;
  }
  return numericValue / gamesPlayed;
}

function buildPlayerPointLeadersChart(stats) {
  const totals = collectPlayerTotals(stats);
  const ranked = Array.from(totals.values())
    .map((entry) => {
      const gameCount = entry.games.size;
      return {
        ...entry,
        gameCount,
        pointsPerGame: computePerGame(entry.pts, gameCount),
      };
    })
    .filter((entry) => entry.pointsPerGame > 0)
    .sort((a, b) => {
      const delta = b.pointsPerGame - a.pointsPerGame;
      if (delta !== 0) {
        return delta;
      }
      const totalDelta = b.pts - a.pts;
      if (totalDelta !== 0) {
        return totalDelta;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);
  if (!ranked.length) {
    return fallbackChart('Player points building');
  }
  const colors = ['#1156d6', '#ef3d5b', '#1f7bff', '#f4b53f', '#6c4fe0', '#11b5c6', '#0b2545', '#2bb7da'];
  return {
    type: 'bar',
    data: {
      labels: ranked.map((entry) => `${entry.name} (${entry.teamAbbreviation})`),
      datasets: [
        {
          label: 'Points per game',
          data: ranked.map((entry) => entry.pointsPerGame),
          backgroundColor: ranked.map((_, index) => colors[index % colors.length]),
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const entry = ranked[context.dataIndex];
              const games = entry.gameCount === 1 ? 'game' : 'games';
              return `${helpers.formatNumber(entry.pointsPerGame, 1)} points per game across ${entry.gameCount} ${games}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
          title: { display: true, text: 'Points per game' },
        },
        y: {
          grid: { display: false },
        },
      },
    },
  };
}

function buildAssistLeadersChart(stats) {
  const totals = collectPlayerTotals(stats);
  const ranked = Array.from(totals.values())
    .map((entry) => {
      const gameCount = entry.games.size;
      return {
        ...entry,
        gameCount,
        assistsPerGame: computePerGame(entry.ast, gameCount),
        pointsPerGame: computePerGame(entry.pts, gameCount),
      };
    })
    .filter((entry) => entry.assistsPerGame > 0)
    .sort((a, b) => {
      const delta = b.assistsPerGame - a.assistsPerGame;
      if (delta !== 0) {
        return delta;
      }
      const pointDelta = b.pointsPerGame - a.pointsPerGame;
      if (pointDelta !== 0) {
        return pointDelta;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);
  if (!ranked.length) {
    return fallbackChart('Assist data building');
  }
  const colors = ['#11b5c6', '#6c4fe0', '#1156d6', '#ef3d5b', '#1f7bff', '#f4b53f', '#0b2545', '#2bb7da'];
  return {
    type: 'bar',
    data: {
      labels: ranked.map((entry) => `${entry.name} (${entry.teamAbbreviation})`),
      datasets: [
        {
          label: 'Assists per game',
          data: ranked.map((entry) => entry.assistsPerGame),
          backgroundColor: ranked.map((_, index) => colors[index % colors.length]),
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const entry = ranked[context.dataIndex];
              const games = entry.gameCount === 1 ? 'game' : 'games';
              return `${helpers.formatNumber(entry.assistsPerGame, 1)} assists per game across ${entry.gameCount} ${games}`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
          title: { display: true, text: 'Assists per game' },
        },
        y: {
          grid: { display: false },
        },
      },
    },
  };
}

function buildReboundLeadersChart(stats) {
  const totals = collectPlayerTotals(stats);
  const ranked = Array.from(totals.values())
    .map((entry) => {
      const gameCount = entry.games.size;
      const offensive = Number(entry.oreb ?? 0);
      const defensiveRaw = Math.max(Number(entry.reb ?? 0) - offensive, 0);
      const offensivePerGame = computePerGame(offensive, gameCount);
      const defensivePerGame = computePerGame(defensiveRaw, gameCount);
      return {
        ...entry,
        gameCount,
        offensive,
        defensiveRaw,
        offensivePerGame,
        defensivePerGame,
        totalPerGame: offensivePerGame + defensivePerGame,
      };
    })
    .filter((entry) => entry.totalPerGame > 0)
    .sort((a, b) => {
      const totalDelta = b.totalPerGame - a.totalPerGame;
      if (totalDelta !== 0) {
        return totalDelta;
      }
      const offensiveDelta = b.offensivePerGame - a.offensivePerGame;
      if (offensiveDelta !== 0) {
        return offensiveDelta;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);
  if (!ranked.length) {
    return fallbackChart('Rebound data building', {
      type: 'bar',
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true, display: false },
        y: { display: false },
      },
    });
  }
  const labels = ranked.map((entry) => `${entry.name} (${entry.teamAbbreviation})`);
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Offensive per game',
          data: ranked.map((entry) => entry.offensivePerGame),
          backgroundColor: 'rgba(239, 61, 91, 0.82)',
          stack: 'rebounds',
        },
        {
          label: 'Defensive per game',
          data: ranked.map((entry) => entry.defensivePerGame),
          backgroundColor: 'rgba(17, 86, 214, 0.82)',
          stack: 'rebounds',
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            footer(items) {
              if (!items?.length) {
                return '';
              }
              const entry = ranked[items[0].dataIndex];
              const games = entry.gameCount === 1 ? 'game' : 'games';
              return `Avg ${helpers.formatNumber(entry.totalPerGame, 1)} rebounds per game (${helpers.formatNumber(entry.reb, 0)} total across ${entry.gameCount} ${games})`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          ticks: { precision: 1 },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
          title: { display: true, text: 'Rebounds per game' },
        },
        y: {
          stacked: true,
          grid: { display: false },
        },
      },
    },
  };
}

function buildStocksLeadersChart(stats) {
  const totals = collectPlayerTotals(stats);
  const ranked = Array.from(totals.values())
    .map((entry) => {
      const gameCount = entry.games.size;
      const steals = Number(entry.stl ?? 0);
      const blocks = Number(entry.blk ?? 0);
      const stealsPerGame = computePerGame(steals, gameCount);
      const blocksPerGame = computePerGame(blocks, gameCount);
      return {
        ...entry,
        gameCount,
        steals,
        blocks,
        stealsPerGame,
        blocksPerGame,
        stocks: steals + blocks,
        stocksPerGame: stealsPerGame + blocksPerGame,
      };
    })
    .filter((entry) => entry.stocksPerGame > 0)
    .sort((a, b) => {
      const stockDelta = b.stocksPerGame - a.stocksPerGame;
      if (stockDelta !== 0) {
        return stockDelta;
      }
      const stealDelta = b.stealsPerGame - a.stealsPerGame;
      if (stealDelta !== 0) {
        return stealDelta;
      }
      const blockDelta = b.blocksPerGame - a.blocksPerGame;
      if (blockDelta !== 0) {
        return blockDelta;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);
  if (!ranked.length) {
    return fallbackChart('Stocks data building', {
      type: 'bar',
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true, display: false },
        y: { display: false },
      },
    });
  }
  const labels = ranked.map((entry) => `${entry.name} (${entry.teamAbbreviation})`);
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Steals per game',
          data: ranked.map((entry) => entry.stealsPerGame),
          backgroundColor: 'rgba(17, 86, 214, 0.82)',
          stack: 'stocks',
        },
        {
          label: 'Blocks per game',
          data: ranked.map((entry) => entry.blocksPerGame),
          backgroundColor: 'rgba(17, 181, 198, 0.72)',
          stack: 'stocks',
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              const value = helpers.formatNumber(context.parsed.x ?? context.parsed, 1);
              return `${context.dataset.label}: ${value}`;
            },
            afterBody(items) {
              const entry = ranked[items[0]?.dataIndex ?? 0];
              if (!entry) {
                return '';
              }
              const games = entry.gameCount === 1 ? 'game' : 'games';
              return `Avg ${helpers.formatNumber(entry.stocksPerGame, 1)} stocks per game (${helpers.formatNumber(entry.stocks, 0)} total across ${entry.gameCount} ${games})`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          stacked: true,
          ticks: { precision: 1 },
          title: { display: true, text: 'Stocks per game (steals + blocks)' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        y: {
          stacked: true,
          grid: { display: false },
        },
      },
    },
  };
}

function buildReboundBattleChart(stats) {
  const totals = collectTeamTotals(stats);
  const ranked = Array.from(totals.values())
    .map((entry) => {
      const gameCount = entry.games.size;
      const offensive = Number(entry.oreb ?? 0);
      const total = Number(entry.reb ?? 0);
      const defensive = Math.max(total - offensive, 0);
      const offensivePerGame = computePerGame(offensive, gameCount);
      const defensivePerGame = computePerGame(defensive, gameCount);
      return {
        ...entry,
        gameCount,
        offensive,
        defensive,
        total,
        offensivePerGame,
        defensivePerGame,
        totalPerGame: offensivePerGame + defensivePerGame,
      };
    })
    .filter((entry) => entry.totalPerGame > 0)
    .sort((a, b) => b.totalPerGame - a.totalPerGame)
    .slice(0, 8);
  if (!ranked.length) {
    return fallbackChart('Rebound data building');
  }
  return {
    type: 'bar',
    data: {
      labels: ranked.map((entry) => entry.teamAbbreviation),
      datasets: [
        {
          label: 'Offensive per game',
          data: ranked.map((entry) => entry.offensivePerGame),
          backgroundColor: 'rgba(239, 61, 91, 0.82)',
          stack: 'rebounds',
        },
        {
          label: 'Defensive per game',
          data: ranked.map((entry) => entry.defensivePerGame),
          backgroundColor: 'rgba(17, 86, 214, 0.82)',
          stack: 'rebounds',
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            footer(items) {
              if (!items?.length) {
                return '';
              }
              const entry = ranked[items[0].dataIndex];
              const games = entry.gameCount === 1 ? 'game' : 'games';
              return `Avg ${helpers.formatNumber(entry.totalPerGame, 1)} rebounds per game (${helpers.formatNumber(entry.total, 0)} total across ${entry.gameCount} ${games})`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { precision: 1 },
          title: { display: true, text: 'Rebounds per game' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
      },
    },
  };
}

function buildShootingEfficiencyChart(stats) {
  const totals = collectTeamTotals(stats);
  const ranked = Array.from(totals.values())
    .map((entry) => ({
      ...entry,
      fgPct: computePercentage(entry.fgm, entry.fga),
      fg3Pct: computePercentage(entry.fg3m, entry.fg3a),
      ftPct: computePercentage(entry.ftm, entry.fta),
    }))
    .filter((entry) => entry.fga > 0 || entry.fg3a > 0 || entry.fta > 0)
    .sort((a, b) => b.fga - a.fga)
    .slice(0, 6);
  if (!ranked.length) {
    return fallbackChart('Shooting data building');
  }
  return {
    type: 'bar',
    data: {
      labels: ranked.map((entry) => entry.teamAbbreviation),
      datasets: [
        {
          label: 'FG%',
          data: ranked.map((entry) => entry.fgPct ?? 0),
          backgroundColor: 'rgba(17, 86, 214, 0.82)',
        },
        {
          label: '3P%',
          data: ranked.map((entry) => entry.fg3Pct ?? 0),
          backgroundColor: 'rgba(239, 61, 91, 0.78)',
        },
        {
          label: 'FT%',
          data: ranked.map((entry) => entry.ftPct ?? 0),
          backgroundColor: 'rgba(244, 181, 63, 0.78)',
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              const entry = ranked[context.dataIndex];
              const value = context.parsed.y ?? context.parsed;
              if (context.dataset.label === 'FG%') {
                return `FG: ${helpers.formatNumber(value ?? 0, 1)}% (${helpers.formatNumber(entry.fgm, 0)}-${helpers.formatNumber(entry.fga, 0)})`;
              }
              if (context.dataset.label === '3P%') {
                return `3P: ${helpers.formatNumber(value ?? 0, 1)}% (${helpers.formatNumber(entry.fg3m, 0)}-${helpers.formatNumber(entry.fg3a, 0)})`;
              }
              return `FT: ${helpers.formatNumber(value ?? 0, 1)}% (${helpers.formatNumber(entry.ftm, 0)}-${helpers.formatNumber(entry.fta, 0)})`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          ticks: {
            callback(value) {
              return `${value}%`;
            },
          },
          title: { display: true, text: 'Percentage' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
      },
    },
  };
}

function buildFreeThrowVolumeChart(stats) {
  const totals = collectPlayerTotals(stats);
  const ranked = Array.from(totals.values())
    .map((entry) => {
      const gameCount = entry.games.size;
      return {
        ...entry,
        gameCount,
        attemptsPerGame: computePerGame(entry.fta, gameCount),
        makesPerGame: computePerGame(entry.ftm, gameCount),
      };
    })
    .filter((entry) => entry.attemptsPerGame > 0)
    .sort((a, b) => {
      const attemptDelta = b.attemptsPerGame - a.attemptsPerGame;
      if (attemptDelta !== 0) {
        return attemptDelta;
      }
      const makeDelta = b.makesPerGame - a.makesPerGame;
      if (makeDelta !== 0) {
        return makeDelta;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);
  if (!ranked.length) {
    return fallbackChart('Free throw data building');
  }
  return {
    type: 'bar',
    data: {
      labels: ranked.map((entry) => `${entry.name} (${entry.teamAbbreviation})`),
      datasets: [
        {
          label: 'Attempts per game',
          data: ranked.map((entry) => entry.attemptsPerGame),
          backgroundColor: 'rgba(239, 61, 91, 0.82)',
        },
        {
          label: 'Makes per game',
          data: ranked.map((entry) => entry.makesPerGame),
          backgroundColor: 'rgba(17, 86, 214, 0.82)',
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label(context) {
              const entry = ranked[context.dataIndex];
              if (context.dataset.label === 'Attempts per game') {
                return `${helpers.formatNumber(entry.attemptsPerGame, 1)} attempts per game`;
              }
              return `${helpers.formatNumber(entry.makesPerGame, 1)} makes per game`;
            },
            footer(items) {
              if (!items?.length) {
                return '';
              }
              const entry = ranked[items[0].dataIndex];
              const pct = computePercentage(entry.ftm, entry.fta);
              const games = entry.gameCount === 1 ? 'game' : 'games';
              if (pct === null) {
                return '';
              }
              return `FT% ${helpers.formatNumber(pct, 1)}% (${helpers.formatNumber(entry.ftm, 0)}-${helpers.formatNumber(entry.fta, 0)} total across ${entry.gameCount} ${games})`;
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
          title: { display: true, text: 'Free throws per game' },
        },
        y: {
          grid: { display: false },
        },
      },
    },
  };
}

function buildDefenseImpactChart(stats) {
  const totals = collectTeamTotals(stats);
  const ranked = Array.from(totals.values())
    .map((entry) => {
      const gameCount = entry.games.size;
      const steals = Number(entry.stl ?? 0);
      const blocks = Number(entry.blk ?? 0);
      const stealsPerGame = computePerGame(steals, gameCount);
      const blocksPerGame = computePerGame(blocks, gameCount);
      return {
        ...entry,
        gameCount,
        steals,
        blocks,
        stealsPerGame,
        blocksPerGame,
        total: steals + blocks,
        totalPerGame: stealsPerGame + blocksPerGame,
      };
    })
    .filter((entry) => entry.totalPerGame > 0)
    .sort((a, b) => b.totalPerGame - a.totalPerGame)
    .slice(0, 8);
  if (!ranked.length) {
    return fallbackChart('Defensive play data building');
  }
  return {
    type: 'bar',
    data: {
      labels: ranked.map((entry) => entry.teamAbbreviation),
      datasets: [
        {
          label: 'Steals per game',
          data: ranked.map((entry) => entry.stealsPerGame),
          backgroundColor: 'rgba(17, 181, 198, 0.85)',
        },
        {
          label: 'Blocks per game',
          data: ranked.map((entry) => entry.blocksPerGame),
          backgroundColor: 'rgba(108, 79, 224, 0.82)',
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            footer(items) {
              if (!items?.length) {
                return '';
              }
              const entry = ranked[items[0].dataIndex];
              const games = entry.gameCount === 1 ? 'game' : 'games';
              return `Avg ${helpers.formatNumber(entry.totalPerGame, 1)} disruptions per game (${helpers.formatNumber(entry.total, 0)} total across ${entry.gameCount} ${games})`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 1 },
          title: { display: true, text: 'Plays per game' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
      },
    },
  };
}

function buildUsageEfficiencyChart(stats) {
  const totals = collectPlayerTotals(stats);
  const aggregated = Array.from(totals.values())
    .map((entry) => ({
      ...entry,
      gameCount: entry.games.size,
      usageTotal: entry.fga + 0.44 * entry.fta + entry.turnover,
    }))
    .map((entry) => ({
      ...entry,
      usagePerGame: computePerGame(entry.usageTotal, entry.gameCount),
      pointsPerGame: computePerGame(entry.pts, entry.gameCount),
    }))
    .filter((entry) => entry.usagePerGame > 0 && entry.pointsPerGame > 0)
    .sort((a, b) => b.usagePerGame - a.usagePerGame)
    .slice(0, 15);
  if (!aggregated.length) {
    return fallbackChart('Usage data building');
  }
  const points = aggregated.map((entry) => {
    const averageMinutes = entry.gameCount ? entry.seconds / 60 / entry.gameCount : entry.seconds / 60;
    const radius = Math.max(6, Math.min(18, averageMinutes * 0.8));
    const fgPct = computePercentage(entry.fgm, entry.fga);
    return {
      x: entry.usagePerGame,
      y: entry.pointsPerGame,
      r: radius,
      name: entry.name,
      team: entry.teamAbbreviation,
      fgPct,
      games: entry.gameCount,
      usagePerGame: entry.usagePerGame,
      pointsPerGame: entry.pointsPerGame,
    };
  });
  return {
    type: 'bubble',
    data: {
      datasets: [
        {
          label: 'Usage to points',
          data: points,
          parsing: false,
          backgroundColor: 'rgba(17, 86, 214, 0.45)',
          borderColor: 'rgba(17, 86, 214, 0.9)',
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              const raw = context.raw || {};
              const prefix = raw.name ? `${raw.name} (${raw.team})` : 'Player';
              const games = raw.games === 1 ? 'game' : 'games';
              const fgPct = Number.isFinite(raw.fgPct) ? `${helpers.formatNumber(raw.fgPct, 1)}% FG` : 'FG% N/A';
              return [
                `${prefix}`,
                `Usage involvement ${helpers.formatNumber(raw.usagePerGame ?? raw.x, 1)} per game`,
                `Points ${helpers.formatNumber(raw.pointsPerGame ?? raw.y, 1)} per game`,
                `${fgPct}`,
                `${raw.games} ${games}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: 'Usage involvement per game (FGA + 0.44 FTA + TOV)' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Points per game' },
          grid: { color: 'rgba(17, 86, 214, 0.12)' },
        },
      },
    },
  };
}

function rebuildCharts() {
  destroyCharts();
  registerCharts([
    {
      element: '#player-point-leaders',
      async createConfig() {
        return buildPlayerPointLeadersChart(latestStats);
      },
    },
    {
      element: '#assist-leaders',
      async createConfig() {
        return buildAssistLeadersChart(latestStats);
      },
    },
    {
      element: '#rebound-leaders',
      async createConfig() {
        return buildReboundLeadersChart(latestStats);
      },
    },
    {
      element: '#stocks-leaders',
      async createConfig() {
        return buildStocksLeadersChart(latestStats);
      },
    },
    {
      element: '#margin-spread',
      async createConfig() {
        return buildMarginChart(latestGames);
      },
    },
    {
      element: '#scoring-leaders',
      async createConfig() {
        return buildScoringChart(latestGames);
      },
    },
    {
      element: '#score-balance',
      async createConfig() {
        return buildBalanceChart(latestGames);
      },
    },
    {
      element: '#rebound-battle',
      async createConfig() {
        return buildReboundBattleChart(latestStats);
      },
    },
    {
      element: '#shooting-efficiency',
      async createConfig() {
        return buildShootingEfficiencyChart(latestStats);
      },
    },
    {
      element: '#free-throw-volume',
      async createConfig() {
        return buildFreeThrowVolumeChart(latestStats);
      },
    },
    {
      element: '#defense-plays',
      async createConfig() {
        return buildDefenseImpactChart(latestStats);
      },
    },
    {
      element: '#usage-efficiency',
      async createConfig() {
        return buildUsageEfficiencyChart(latestStats);
      },
    },
  ]);
}

function scheduleAutoRefresh() {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
  sanitizeActiveRange();
  if (isTodayWithinRange(activeRange)) {
    refreshTimer = window.setInterval(() => {
      loadGames({ silent: true });
    }, REFRESH_INTERVAL_MS);
  }
}

async function loadGames(options = {}) {
  if (loading) {
    return;
  }
  sanitizeActiveRange();
  loading = true;
  const { silent = false } = options;
  const previousGames = latestGames;
  const previousStats = latestStats;
  if (refreshButton) {
    refreshButton.disabled = true;
  }
  if (!silent && (!previousGames || !previousGames.length)) {
    renderScoreboardState('Loading games…');
  }
  setFetchMessage('Refreshing…');
  try {
    const games = await fetchGamesForRange(activeRange.start, activeRange.end);
    latestGames = games;
    lastUpdated = new Date();
    updateMetrics(games);
    renderScoreboard(games);
    setRefreshTimestamp(lastUpdated);
    setFetchMessage(`Updated ${formatTimeLabel(lastUpdated)}`, 'success');
    try {
      latestStats = await fetchStatsForGames(games);
    } catch (statsError) {
      console.warn('Unable to load slate stats', statsError);
      latestStats = [];
    }
    rebuildCharts();
  } catch (error) {
    console.error('Unable to load live games data', error);
    const rawMessage = typeof error?.message === 'string' ? error.message : '';
    const unauthorized = rawMessage.includes('401');
    const message = unauthorized
      ? 'Authorization failed via proxy. Please notify the site operator.'
      : 'Refresh failed';
    setFetchMessage(message, 'error');
    if (previousGames && previousGames.length) {
      latestGames = previousGames;
      latestStats = previousStats;
      updateMetrics(previousGames);
      renderScoreboard(previousGames);
    } else {
      renderScoreboardState('Unable to load games right now.');
      updateMetrics([]);
    }
    rebuildCharts();
  } finally {
    loading = false;
    if (refreshButton) {
      refreshButton.disabled = false;
    }
  }
}

function initControls() {
  if (startDateInput) {
    startDateInput.addEventListener('change', (event) => {
      const bounds = getSelectableBounds();
      const nextValue = clampDate(event.target.value, bounds);
      if (!nextValue) {
        applyRangeToInputs();
        return;
      }
      updateActiveRange({ start: nextValue }, { bias: 'start' });
    });
  }
  if (endDateInput) {
    endDateInput.addEventListener('change', (event) => {
      const bounds = getSelectableBounds();
      const nextValue = clampDate(event.target.value, bounds);
      if (!nextValue) {
        applyRangeToInputs();
        return;
      }
      updateActiveRange({ end: nextValue }, { bias: 'end' });
    });
  }
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      loadGames();
    });
  }
  if (scoreboardViewButtons && scoreboardViewButtons.length) {
    const preset = Array.from(scoreboardViewButtons).find(
      (button) => button.getAttribute('aria-pressed') === 'true',
    );
    if (preset) {
      scoreboardView = normalizeScoreboardView(preset.getAttribute('data-scoreboard-view'));
    }
    scoreboardViewButtons.forEach((button) => {
      const view = button.getAttribute('data-scoreboard-view');
      button.addEventListener('click', () => {
        setScoreboardView(view);
      });
    });
    updateScoreboardViewButtons();
  }
}

function init() {
  sanitizeActiveRange();
  applyRangeToInputs();
  initControls();
  updateMetrics([]);
  renderScoreboardState('Loading games…');
  loadGames();
  scheduleAutoRefresh();
}

init();
