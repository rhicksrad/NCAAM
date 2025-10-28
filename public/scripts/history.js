import { fetchSeasonAggregate } from '../assets/js/bdl.js';
import { enablePanZoom, enhanceUsaInsets } from './map-utils.js';

const LATEST_COMPLETED_SEASON = 2024;
const EARLIEST_SEASON = 1979;
const PLAYERS_MIN_URL = 'data/history/players.index.min.json';
const PLAYERS_FULL_URL = 'data/history/players.index.json';
const BIRTHPLACES_URL = 'data/history/player_birthplaces.json';
const WORLD_LEGENDS_URL = 'data/world_birth_legends.json';
const STATE_LEGENDS_URL = 'data/state_birth_legends.json';
const GOAT_BIRTH_INDEX_URL = 'data/goat_birth_index.json';
const PLAYER_CAREERS_URL = 'data/history/player_careers.json';
const GOAT_DATA_SOURCES = [
  { url: 'data/goat_system.json', label: 'GOAT system snapshot' },
  { url: 'data/goat_index.json', label: 'GOAT index export' },
  { url: 'data/goat_recent.json', label: 'GOAT recent snapshot' },
];

const numberFormatter = new Intl.NumberFormat('en-US');
const decimalFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

const stateNames = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DC: 'District of Columbia',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  IA: 'Iowa',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  MA: 'Massachusetts',
  MD: 'Maryland',
  ME: 'Maine',
  MI: 'Michigan',
  MN: 'Minnesota',
  MO: 'Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  NC: 'North Carolina',
  ND: 'North Dakota',
  NE: 'Nebraska',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NV: 'Nevada',
  NY: 'New York',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  VT: 'Vermont',
  WA: 'Washington',
  WI: 'Wisconsin',
  WV: 'West Virginia',
  WY: 'Wyoming',
  PR: 'Puerto Rico',
};

const selectors = {
  searchInput: document.querySelector('[data-history="player-search"]'),
  searchResults: document.querySelector('[data-history="player-results"]'),
  playerCard: document.querySelector('[data-history="player-card"]'),
  visualsGrid: document.querySelector('[data-history="visuals-grid"]'),
  visualsSection: document.querySelector('[data-history="player-visuals"]'),
  mapRoot: document.querySelector('[data-state-map-tiles]'),
  atlasTitle: document.querySelector('[data-atlas-title]'),
  atlasCaption: document.querySelector('[data-atlas-caption]'),
  atlasToggle: document.querySelector('[data-atlas-toggle]'),
  atlasSpotlight: document.querySelector('[data-state-spotlight]'),
  spotlightHeading: document.querySelector('[data-spotlight-heading]'),
};

function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\p{M}]+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

async function loadJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
}

function parseGeneratedAt(value) {
  if (typeof value !== 'string') return Number.NEGATIVE_INFINITY;
  const timestamp = new Date(value);
  const time = timestamp.getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

async function loadLatestGoatDocument() {
  const results = await Promise.all(
    GOAT_DATA_SOURCES.map((source) =>
      loadJson(source.url)
        .then((data) => ({ source, data, failed: false }))
        .catch((error) => ({ source, error, failed: true })),
    ),
  );

  const available = [];
  let lastError = null;

  for (const result of results) {
    if (result.failed) {
      console.warn(`GOAT data source unavailable (${result.source.label}):`, result.error);
      lastError = result.error;
      continue;
    }
    const { source, data } = result;
    if (data && typeof data === 'object' && Array.isArray(data.players) && data.players.length) {
      available.push({
        source,
        data,
        generatedAt: parseGeneratedAt(data.generatedAt),
        playerCount: data.players.length,
      });
    } else {
      console.warn(`GOAT data source missing players (${source.label})`);
      lastError = new Error(`GOAT data source ${source.url} missing players`);
    }
  }

  if (!available.length) {
    throw lastError ?? new Error('Unable to load GOAT data from configured sources');
  }

  const byFreshness = [...available].sort((a, b) => b.generatedAt - a.generatedAt);
  const freshest = byFreshness[0];
  const maxCoverage = Math.max(...available.map((entry) => entry.playerCount));
  // Prefer fresher exports so long as they contain at least half of the deepest
  // roster (and never less than 500 players) to avoid truncated releases wiping
  // out the history visualisations.
  const coverageThreshold = Math.max(500, Math.floor(maxCoverage * 0.5));
  const preferredByFreshness = byFreshness.find((entry) => entry.playerCount >= coverageThreshold);

  if (preferredByFreshness) {
    if (preferredByFreshness.source.url !== freshest.source.url) {
      console.info(
        `Falling back to broader GOAT data from ${preferredByFreshness.source.label} (${preferredByFreshness.source.url}) due to limited coverage in fresher exports.`,
      );
    } else if (byFreshness.length > 1 && preferredByFreshness.generatedAt === Number.NEGATIVE_INFINITY) {
      console.warn('GOAT data missing generatedAt timestamps; defaulting to first available source.');
    }
    return preferredByFreshness.data;
  }

  const byCoverage = [...available].sort((a, b) => {
    if (b.playerCount !== a.playerCount) return b.playerCount - a.playerCount;
    return b.generatedAt - a.generatedAt;
  });
  const bestCoverage = byCoverage[0];
  if (bestCoverage.source.url !== freshest.source.url) {
    console.info(
      `Falling back to GOAT data from ${bestCoverage.source.label} (${bestCoverage.source.url}) to maximise player coverage.`,
    );
  }
  return bestCoverage.data;
}

function normalizeCareerSegment(segment) {
  const totalsInput = segment?.totals ?? {};
  const totals = {};
  for (const key of CAREER_TOTAL_KEYS) {
    const value = Number(totalsInput[key] ?? 0);
    totals[key] = Number.isFinite(value) ? value : 0;
  }
  const seasonCandidates = Array.isArray(segment?.seasons) ? segment.seasons : [];
  const seasons = Array.from(
    new Set(
      seasonCandidates
        .map((entry) => Number(entry))
        .filter((season) => Number.isFinite(season)),
    ),
  ).sort((a, b) => a - b);
  return { totals, seasons };
}

function buildCareerCaches(document) {
  const byId = new Map();
  const byName = new Map();

  const players = document?.players;
  if (players && typeof players === 'object') {
    for (const [id, entry] of Object.entries(players)) {
      const playerId = Number(id);
      if (!Number.isFinite(playerId)) {
        continue;
      }
      byId.set(playerId, {
        regular: normalizeCareerSegment(entry?.regular ?? {}),
        postseason: normalizeCareerSegment(entry?.postseason ?? {}),
      });
    }
  }

  const byNameDocument = document?.byName;
  if (byNameDocument && typeof byNameDocument === 'object') {
    for (const [rawName, entry] of Object.entries(byNameDocument)) {
      if (typeof rawName !== 'string' || !rawName.trim()) {
        continue;
      }
      const key = normalizeName(rawName);
      if (!key) {
        continue;
      }
      byName.set(key, {
        regular: normalizeCareerSegment(entry?.regular ?? {}),
        postseason: normalizeCareerSegment(entry?.postseason ?? {}),
      });
    }
  }

  return { byId, byName };
}

function formatCareerSnapshotNote() {
  if (!cachedCareerGeneratedAt) {
    return "Showing cached career totals from the Ball Don't Lie archive snapshot.";
  }
  const timestamp = new Date(cachedCareerGeneratedAt);
  if (Number.isNaN(timestamp.getTime())) {
    return "Showing cached career totals from the Ball Don't Lie archive snapshot.";
  }
  const formatted = cachedCareerTimestampFormatter.format(timestamp);
  return `Showing cached career totals captured ${formatted} UTC from the Ball Don't Lie archive snapshot.`;
}

function renderCachedCareer(totalsContainer, cachedCareer, contextMessage) {
  if (contextMessage) {
    totalsContainer.append(createElement('p', 'history-player__hint', contextMessage));
  }
  totalsContainer.append(
    createElement('p', 'history-player__hint', formatCareerSnapshotNote()),
  );
  totalsContainer.append(renderTotalsTable('Regular season', cachedCareer.regular));
  totalsContainer.append(renderTotalsTable('Postseason', cachedCareer.postseason));
}

function formatInches(value) {
  if (!value) return null;
  if (!value.includes('-')) return value;
  const [feet, inches] = value.split('-');
  return `${Number(feet)}'${inches}"`;
}

function formatWeight(value) {
  if (!value) return null;
  return `${value} lbs`;
}

function joinParts(parts, fallback = '--') {
  const filtered = parts.filter((part) => part && String(part).trim().length);
  return filtered.length ? filtered.join(' • ') : fallback;
}

function parseMinutes(value) {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const [minutes, seconds] = trimmed.split(':').map((part) => Number(part));
  if (!Number.isFinite(minutes)) return 0;
  const secs = Number.isFinite(seconds) ? seconds : 0;
  return minutes * 60 + secs;
}

function sumStat(target, key, value) {
  target[key] = (target[key] ?? 0) + value;
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = Math.abs(total % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function computePerGame(total, games) {
  if (!games) return 0;
  return total / games;
}

function safePercent(value) {
  if (!Number.isFinite(value)) return null;
  return percentFormatter.format(Math.max(0, Math.min(value, 1)));
}

function computePercentile(value, sortedValues, { higherIsBetter = true } = {}) {
  if (!Number.isFinite(value) || !Array.isArray(sortedValues) || sortedValues.length === 0) {
    return null;
  }
  const count = sortedValues.length;
  if (higherIsBetter) {
    let low = 0;
    let high = count;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (sortedValues[mid] <= value) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return (low / count) * 100;
  }
  let low = 0;
  let high = count;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sortedValues[mid] < value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  const greaterOrEqual = count - low;
  return (greaterOrEqual / count) * 100;
}

function normalizePercentile(percentile) {
  if (percentile == null) return null;
  const bounded = Math.max(0, Math.min(percentile, 100));
  const display = bounded === 100 ? 100 : Math.floor(bounded * 10) / 10;
  return { bounded, display };
}

function buildTierScore(tier) {
  const order = [
    'Inner Circle',
    'Legend',
    'Icon',
    'All-Star',
    'Starter',
    'Rotation',
    'Reserve',
    'Prospect',
    'Development',
  ];
  if (!tier) return 0;
  const index = order.indexOf(tier);
  if (index === -1) return 0;
  return order.length - index;
}

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) {
    el.textContent = text;
  }
  return el;
}

function resolveSeasonRange(player) {
  const draftYear = Number.parseInt(player?.draft_year ?? '', 10);
  const start = Number.isFinite(draftYear)
    ? Math.max(EARLIEST_SEASON, draftYear - 1)
    : EARLIEST_SEASON;
  return { start, end: LATEST_COMPLETED_SEASON };
}

function multiplyStat(value, games) {
  const numericValue = Number(value);
  const numericGames = Number(games);
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericGames)) return 0;
  return Math.round(numericValue * numericGames);
}

async function loadPrewarmedCareer(playerId) {
  const url = `data/bdl/season_averages/${playerId}.json`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function normalizeSeasonAverageRow(payload) {
  if (!payload) return null;
  if (Array.isArray(payload?.data)) {
    return payload.data[0] ?? null;
  }
  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }
  return null;
}

function seasonHasGames(payload) {
  const row = normalizeSeasonAverageRow(payload);
  if (!row) return false;
  const games = Number(row.games_played ?? row.games ?? row.gamesPlayed ?? 0);
  return Number.isFinite(games) && games > 0;
}

function createEmptyTotals() {
  return {
    games: 0,
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fouls: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    fg3a: 0,
    ftm: 0,
    fta: 0,
    oreb: 0,
    dreb: 0,
  };
}

function buildTotalsFromRecords(records, key) {
  const totals = createEmptyTotals();
  const seasonSet = new Set();
  for (const record of records) {
    const payload = key === 'post' ? record.post : record.reg;
    const row = normalizeSeasonAverageRow(payload);
    if (!row) continue;
    const games = Number(row.games_played ?? row.games ?? row.gamesPlayed ?? 0);
    if (!Number.isFinite(games) || games <= 0) continue;
    totals.games += games;
    totals.minutes += multiplyStat(parseMinutes(row.min), games);
    sumStat(totals, 'points', multiplyStat(row.pts ?? row.points ?? 0, games));
    sumStat(totals, 'rebounds', multiplyStat(row.reb ?? row.rebounds ?? 0, games));
    sumStat(totals, 'assists', multiplyStat(row.ast ?? row.assists ?? 0, games));
    sumStat(totals, 'steals', multiplyStat(row.stl ?? row.steals ?? 0, games));
    sumStat(totals, 'blocks', multiplyStat(row.blk ?? row.blocks ?? 0, games));
    sumStat(totals, 'turnovers', multiplyStat(row.turnover ?? row.turnovers ?? 0, games));
    sumStat(totals, 'fouls', multiplyStat(row.pf ?? row.fouls ?? 0, games));
    sumStat(totals, 'fgm', multiplyStat(row.fgm ?? 0, games));
    sumStat(totals, 'fga', multiplyStat(row.fga ?? 0, games));
    sumStat(totals, 'fg3m', multiplyStat(row.fg3m ?? 0, games));
    sumStat(totals, 'fg3a', multiplyStat(row.fg3a ?? 0, games));
    sumStat(totals, 'ftm', multiplyStat(row.ftm ?? 0, games));
    sumStat(totals, 'fta', multiplyStat(row.fta ?? 0, games));
    sumStat(totals, 'oreb', multiplyStat(row.oreb ?? 0, games));
    sumStat(totals, 'dreb', multiplyStat(row.dreb ?? 0, games));
    const seasonValue = Number(row.season ?? record.season);
    if (Number.isFinite(seasonValue)) {
      seasonSet.add(seasonValue);
    }
  }
  const seasonList = Array.from(seasonSet).sort((a, b) => a - b);
  return { totals, seasons: seasonList };
}

function buildCareerTotals(records) {
  const sorted = [...records].sort((a, b) => a.season - b.season);
  return {
    regular: buildTotalsFromRecords(sorted, 'reg'),
    postseason: buildTotalsFromRecords(sorted, 'post'),
  };
}

async function fetchCareerStats(player, { onCached } = {}) {
  const playerId = player?.id;
  if (!Number.isFinite(playerId)) {
    throw new Error('Cannot fetch career stats without a valid player id.');
  }

  const { start, end } = resolveSeasonRange(player);
  const currentYear = new Date().getFullYear();
  const prewarmed = await loadPrewarmedCareer(playerId);
  const recordsBySeason = new Map();
  if (Array.isArray(prewarmed)) {
    for (const entry of prewarmed) {
      const season = Number(entry?.season);
      if (!Number.isFinite(season)) continue;
      const reg = entry.reg ?? entry.regular ?? entry;
      const post = entry.post ?? entry.postseason ?? null;
      recordsBySeason.set(season, { season, reg, post });
    }
  }

  const callback = typeof onCached === 'function' ? onCached : null;
  const historicalRecords = [];
  for (const [season, record] of recordsBySeason.entries()) {
    if (season < start || season > end || season >= currentYear) continue;
    if (seasonHasGames(record.reg) || seasonHasGames(record.post)) {
      historicalRecords.push({ season, reg: record.reg, post: record.post });
    }
  }

  let needsHydration = false;
  for (let season = start; season <= end; season += 1) {
    const isHistorical = season < currentYear;
    if (!isHistorical || !recordsBySeason.has(season)) {
      needsHydration = true;
      break;
    }
  }

  if (callback && historicalRecords.length) {
    callback(buildCareerTotals(historicalRecords), { needsHydration });
  }

  const collected = [];
  let seenGames = historicalRecords.length > 0;
  let emptyStreak = 0;

  for (let season = start; season <= end; season += 1) {
    const isHistorical = season < currentYear;
    let record = recordsBySeason.get(season);
    if (!record || !isHistorical) {
      const [reg, post] = await Promise.all([
        fetchSeasonAggregate({ season, playerId, postseason: false }),
        fetchSeasonAggregate({ season, playerId, postseason: true }),
      ]);
      record = { season, reg, post };
      recordsBySeason.set(season, record);
    }

    if (!record) continue;
    const hasData = seasonHasGames(record.reg) || seasonHasGames(record.post);
    if (!hasData) {
      if (seenGames) {
        emptyStreak += 1;
        if (emptyStreak >= 3) {
          break;
        }
      }
      continue;
    }

    seenGames = true;
    emptyStreak = 0;
    collected.push({ season: record.season, reg: record.reg, post: record.post });
  }

  return buildCareerTotals(collected);
}

function renderTotalsTable(title, data) {
  const { totals, seasons } = data;
  if (!totals.games) {
    const wrapper = createElement('div', 'history-player__totals');
    wrapper.append(createElement('h4', 'history-player__totals-heading', title));
    wrapper.append(
      createElement('p', 'history-player__totals-empty', 'No games recorded in the archive yet.'),
    );
    return wrapper;
  }
  const wrapper = createElement('div', 'history-player__totals');
  wrapper.append(createElement('h4', 'history-player__totals-heading', title));
  const subhead = createElement(
    'p',
    'history-player__totals-meta',
    `${totals.games} games • ${seasons.length} seasons (${seasons[0]}–${seasons[seasons.length - 1]})`,
  );
  wrapper.append(subhead);
  const table = createElement('table', 'history-player__totals-table');
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th scope="col">Stat</th>
      <th scope="col">Total</th>
      <th scope="col">Per game</th>
    </tr>
  `;
  table.append(thead);
  const tbody = document.createElement('tbody');
  const rows = [
    ['Minutes', formatDuration(totals.minutes), formatDuration(computePerGame(totals.minutes, totals.games))],
    ['Points', numberFormatter.format(totals.points), decimalFormatter.format(computePerGame(totals.points, totals.games))],
    ['Rebounds', numberFormatter.format(totals.rebounds), decimalFormatter.format(computePerGame(totals.rebounds, totals.games))],
    ['Assists', numberFormatter.format(totals.assists), decimalFormatter.format(computePerGame(totals.assists, totals.games))],
    ['Steals', numberFormatter.format(totals.steals), decimalFormatter.format(computePerGame(totals.steals, totals.games))],
    ['Blocks', numberFormatter.format(totals.blocks), decimalFormatter.format(computePerGame(totals.blocks, totals.games))],
    ['Turnovers', numberFormatter.format(totals.turnovers), decimalFormatter.format(computePerGame(totals.turnovers, totals.games))],
    ['Personal fouls', numberFormatter.format(totals.fouls), decimalFormatter.format(computePerGame(totals.fouls, totals.games))],
    ['Field goals', `${numberFormatter.format(totals.fgm)}/${numberFormatter.format(totals.fga)}`, safePercent(totals.fga ? totals.fgm / totals.fga : null) ?? '—'],
    ['Three-pointers', `${numberFormatter.format(totals.fg3m)}/${numberFormatter.format(totals.fg3a)}`, safePercent(totals.fg3a ? totals.fg3m / totals.fg3a : null) ?? '—'],
    ['Free throws', `${numberFormatter.format(totals.ftm)}/${numberFormatter.format(totals.fta)}`, safePercent(totals.fta ? totals.ftm / totals.fta : null) ?? '—'],
  ];
  for (const [label, total, perGame] of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <th scope="row">${label}</th>
      <td>${total}</td>
      <td>${perGame}</td>
    `;
    tbody.append(tr);
  }
  table.append(tbody);
  wrapper.append(table);
  return wrapper;
}

function renderPlayerMetadata(player, birthplace) {
  const fragments = [];
  const name = `${player.first_name} ${player.last_name}`.trim();
  fragments.push(createElement('h3', 'history-player__name', name));

  const infoLine = joinParts([
    player.position,
    formatInches(player.height),
    formatWeight(player.weight),
  ]);
  fragments.push(createElement('p', 'history-player__bio', infoLine));

  const secondary = [];
  if (player.team?.full_name) {
    secondary.push(player.team.full_name);
  }
  if (player.college) {
    secondary.push(player.college);
  }
  if (player.draft_year) {
    const draftBits = joinParts([
      `Draft ${player.draft_year}`,
      player.draft_round ? `Rd ${player.draft_round}` : null,
      player.draft_number ? `Pick ${player.draft_number}` : null,
    ]);
    secondary.push(draftBits);
  }
  if (birthplace) {
    const locationParts = [];
    if (birthplace.city) locationParts.push(birthplace.city);
    if (birthplace.stateName) locationParts.push(birthplace.stateName);
    if (birthplace.country && birthplace.country !== 'USA') locationParts.push(birthplace.country);
    if (locationParts.length) secondary.push(`Born in ${locationParts.join(', ')}`);
  }
  if (secondary.length) {
    fragments.push(createElement('p', 'history-player__meta', secondary.join(' • ')));
  }
  return fragments;
}

function renderPlayerCard(player, birthplace) {
  if (!selectors.playerCard) return;
  selectors.playerCard.innerHTML = '';
  const header = createElement('header', 'history-player__header');
  for (const fragment of renderPlayerMetadata(player, birthplace)) {
    header.append(fragment);
  }
  selectors.playerCard.append(header);
  const totalsContainer = createElement('div', 'history-player__totals-wrapper');
  selectors.playerCard.append(totalsContainer);
  return totalsContainer;
}

function renderVisuals(goatEntry, references) {
  if (!selectors.visualsGrid || !selectors.visualsSection) return;
  selectors.visualsGrid.innerHTML = '';
  if (!goatEntry) {
    selectors.visualsSection.classList.add('history-visuals--empty');
    selectors.visualsGrid.append(
      createElement(
        'p',
        'history-visuals__empty',
        'No GOAT analytics available for this player yet. We update tiers once new tracking data lands.',
      ),
    );
    return;
  }
  selectors.visualsSection.classList.remove('history-visuals--empty');
  const careerLength = (() => {
    if (!goatEntry.careerSpan) return null;
    const parts = goatEntry.careerSpan.split('-').map((part) => Number(part));
    if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return null;
    return parts[1] - parts[0] + 1;
  })();
  const primeLength = (() => {
    if (!goatEntry.primeWindow) return null;
    const parts = goatEntry.primeWindow.split('-').map((part) => Number(part));
    if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return null;
    return parts[1] - parts[0] + 1;
  })();
  const franchiseCount = Array.isArray(goatEntry.franchises) ? goatEntry.franchises.length : null;
  const visuals = [
    {
      label: 'GOAT score',
      value: goatEntry.goatScore,
      display: decimalFormatter.format(goatEntry.goatScore ?? 0),
      percentile: computePercentile(goatEntry.goatScore ?? null, references.goatScore),
    },
    {
      label: 'GOAT rank',
      value: goatEntry.rank,
      display: goatEntry.rank ? `#${numberFormatter.format(goatEntry.rank)}` : '—',
      percentile: computePercentile(goatEntry.rank ?? null, references.goatRank, { higherIsBetter: false }),
    },
    {
      label: 'Impact',
      value: goatEntry.goatComponents?.impact,
      display: decimalFormatter.format(goatEntry.goatComponents?.impact ?? 0),
      percentile: computePercentile(goatEntry.goatComponents?.impact ?? null, references.impact),
    },
    {
      label: 'Stage',
      value: goatEntry.goatComponents?.stage,
      display: decimalFormatter.format(goatEntry.goatComponents?.stage ?? 0),
      percentile: computePercentile(goatEntry.goatComponents?.stage ?? null, references.stage),
    },
    {
      label: 'Longevity',
      value: goatEntry.goatComponents?.longevity,
      display: decimalFormatter.format(goatEntry.goatComponents?.longevity ?? 0),
      percentile: computePercentile(goatEntry.goatComponents?.longevity ?? null, references.longevity),
    },
    {
      label: 'Versatility',
      value: goatEntry.goatComponents?.versatility,
      display: decimalFormatter.format(goatEntry.goatComponents?.versatility ?? 0),
      percentile: computePercentile(goatEntry.goatComponents?.versatility ?? null, references.versatility),
    },
    {
      label: 'Career win %',
      value: goatEntry.winPct,
      display: goatEntry.winPct != null ? percentFormatter.format(goatEntry.winPct) : '—',
      percentile: computePercentile(goatEntry.winPct ?? null, references.winPct),
    },
    {
      label: 'Playoff win %',
      value: goatEntry.playoffWinPct,
      display: goatEntry.playoffWinPct != null ? percentFormatter.format(goatEntry.playoffWinPct) : '—',
      percentile: computePercentile(goatEntry.playoffWinPct ?? null, references.playoffWinPct),
    },
    {
      label: 'Career length',
      value: careerLength,
      display: careerLength ? `${careerLength} years` : '—',
      percentile: computePercentile(careerLength ?? null, references.careerLength),
    },
    {
      label: 'Prime window',
      value: primeLength,
      display: primeLength ? `${primeLength} years` : '—',
      percentile: computePercentile(primeLength ?? null, references.primeLength),
    },
    {
      label: 'Franchise footprint',
      value: franchiseCount,
      display: franchiseCount != null ? `${franchiseCount} teams` : '—',
      percentile: computePercentile(franchiseCount ?? null, references.franchiseCount),
    },
  ];
  for (const metric of visuals) {
    const card = createElement('article', 'history-visual');
    card.append(createElement('h4', 'history-visual__label', metric.label));
    card.append(createElement('p', 'history-visual__value', metric.display));
    const meter = createElement('div', 'history-visual__meter');
    const fill = createElement('div', 'history-visual__meter-fill');
    const percentileInfo = normalizePercentile(metric.percentile);
    if (percentileInfo) {
      fill.style.width = `${percentileInfo.bounded}%`;
      fill.setAttribute('aria-valuenow', percentileInfo.display.toFixed(1));
    } else {
      fill.style.width = '0%';
      fill.classList.add('history-visual__meter-fill--empty');
    }
    meter.append(fill);
    card.append(meter);
    if (percentileInfo) {
      card.append(
        createElement('p', 'history-visual__percentile', `${percentileInfo.display.toFixed(1)} percentile`),
      );
    } else {
      card.append(createElement('p', 'history-visual__percentile history-visual__percentile--empty', 'Pending data'));
    }
    selectors.visualsGrid.append(card);
  }
}

function renderSearchResults(players, term) {
  if (!selectors.searchResults) return;
  selectors.searchResults.innerHTML = '';
  if (!term || !term.trim()) {
    selectors.searchResults.append(
      createElement('li', 'history-search__hint', 'Enter a player name to start searching the archive.'),
    );
    return;
  }
  const normalizedTerm = term.trim().toLowerCase();
  const matches = players
    .filter((player) => `${player.first} ${player.last}`.toLowerCase().includes(normalizedTerm))
    .slice(0, 15);
  if (!matches.length) {
    selectors.searchResults.append(createElement('li', 'history-search__hint', 'No players matched that search.'));
    return;
  }
  for (const match of matches) {
    const item = createElement('li', 'history-search__result');
    const button = createElement('button', 'history-search__button', `${match.first} ${match.last}`.trim());
    button.type = 'button';
    button.dataset.playerId = String(match.id);
    if (match.position) {
      button.append(createElement('span', 'history-search__position', match.position));
    }
    item.append(button);
    selectors.searchResults.append(item);
  }
}

function resolveBirthplace(nameKey, lookup) {
  const entries = lookup[nameKey];
  if (!Array.isArray(entries) || !entries.length) return null;
  return entries[0];
}

function buildGoatReferences(goatPlayers) {
  const refs = {
    goatScore: [],
    goatRank: [],
    impact: [],
    stage: [],
    longevity: [],
    versatility: [],
    winPct: [],
    playoffWinPct: [],
    careerLength: [],
    primeLength: [],
    franchiseCount: [],
  };
  for (const player of goatPlayers) {
    if (Number.isFinite(player.goatScore)) refs.goatScore.push(player.goatScore);
    if (Number.isFinite(player.rank)) refs.goatRank.push(player.rank);
    if (Number.isFinite(player.goatComponents?.impact)) refs.impact.push(player.goatComponents.impact);
    if (Number.isFinite(player.goatComponents?.stage)) refs.stage.push(player.goatComponents.stage);
    if (Number.isFinite(player.goatComponents?.longevity)) refs.longevity.push(player.goatComponents.longevity);
    if (Number.isFinite(player.goatComponents?.versatility)) refs.versatility.push(player.goatComponents.versatility);
    if (Number.isFinite(player.winPct)) refs.winPct.push(player.winPct);
    if (Number.isFinite(player.playoffWinPct)) refs.playoffWinPct.push(player.playoffWinPct);
    if (player.careerSpan) {
      const parts = player.careerSpan.split('-').map((part) => Number(part));
      if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
        refs.careerLength.push(parts[1] - parts[0] + 1);
      }
    }
    if (player.primeWindow) {
      const parts = player.primeWindow.split('-').map((part) => Number(part));
      if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
        refs.primeLength.push(parts[1] - parts[0] + 1);
      }
    }
    if (Array.isArray(player.franchises)) {
      refs.franchiseCount.push(player.franchises.length);
    }
  }
  for (const key of Object.keys(refs)) {
    refs[key].sort((a, b) => a - b);
  }
  return refs;
}

function buildCountryCodeMap(worldLegends) {
  const map = new Map();
  if (!worldLegends || !Array.isArray(worldLegends.countries)) {
    return map;
  }
  for (const entry of worldLegends.countries) {
    if (entry.country && entry.countryName) {
      map.set(entry.countryName.toLowerCase(), entry.country);
    }
  }
  return map;
}

function buildBirthplaceLookup(rawLookup, goatBirthPlayers) {
  const merged = {};
  if (rawLookup && typeof rawLookup === 'object') {
    for (const [key, entries] of Object.entries(rawLookup)) {
      if (!Array.isArray(entries)) continue;
      merged[key] = entries.map((entry) => ({ ...entry }));
    }
  }

  if (Array.isArray(goatBirthPlayers)) {
    for (const player of goatBirthPlayers) {
      if (!player || typeof player !== 'object') continue;
      const nameKey = normalizeName(player.name);
      if (!nameKey) continue;

      const city = typeof player.birthCity === 'string' && player.birthCity.trim().length
        ? player.birthCity.trim()
        : null;
      const state = typeof player.birthState === 'string' && player.birthState.trim().length
        ? player.birthState.trim().toUpperCase()
        : null;
      const stateName = state ? stateNames[state] ?? state : null;
      const countryCodeRaw = typeof player.birthCountryCode === 'string' && player.birthCountryCode.trim().length
        ? player.birthCountryCode.trim().toUpperCase()
        : null;
      const countryRaw = typeof player.birthCountry === 'string' && player.birthCountry.trim().length
        ? player.birthCountry.trim()
        : null;
      const country = countryCodeRaw === 'US' ? 'USA' : countryRaw ?? countryCodeRaw ?? null;

      if (!city && !state && !country) {
        continue;
      }

      const record = {
        city: city ?? null,
        stateName: stateName ?? null,
        state: state ?? null,
        country: country ?? null,
        source: 'goat_birth_index.json',
      };
      if (countryCodeRaw) {
        record.countryCode = countryCodeRaw;
      }

      const existing = Array.isArray(merged[nameKey]) ? merged[nameKey].slice() : [];
      const existingIndex = existing.findIndex((entry) => entry && entry.source === record.source);
      if (existingIndex >= 0) {
        const current = { ...existing[existingIndex] };
        if (record.city) current.city = record.city;
        if (record.stateName) current.stateName = record.stateName;
        if (record.state) current.state = record.state;
        if (record.country) current.country = record.country;
        if (record.countryCode) current.countryCode = record.countryCode;
        existing[existingIndex] = current;
        merged[nameKey] = existing;
      } else {
        merged[nameKey] = [record, ...existing];
      }
    }
  }

  return merged;
}

function selectGoatEntry(player, goatIndex) {
  const nameKey = normalizeName(`${player.first_name} ${player.last_name}`);
  const matches = goatIndex.get(nameKey);
  if (!matches || !matches.length) return null;
  if (matches.length === 1) return matches[0];
  const draftYear = Number(player.draft_year);
  if (Number.isFinite(draftYear)) {
    const filtered = matches.filter((entry) => {
      if (!entry.careerSpan) return false;
      const [start] = entry.careerSpan.split('-').map((part) => Number(part));
      if (!Number.isFinite(start)) return false;
      return Math.abs(start - draftYear) <= 2;
    });
    if (filtered.length === 1) return filtered[0];
    if (filtered.length > 1) return filtered[0];
  }
  return matches[0];
}

function buildAtlas(players, birthplaces, goatIndex, countryCodes) {
  const domestic = new Map();
  const international = new Map();
  for (const player of players) {
    const nameKey = normalizeName(`${player.first_name} ${player.last_name}`);
    const birthplace = resolveBirthplace(nameKey, birthplaces);
    const goatEntry = selectGoatEntry(player, goatIndex);
    const goatScore = Number.isFinite(goatEntry?.goatScore) ? goatEntry.goatScore : null;
    const goatRank = Number.isFinite(goatEntry?.rank) ? goatEntry.rank : null;
    const baseInfo = {
      id: player.id,
      name: `${player.first_name} ${player.last_name}`.trim(),
      goatScore,
      goatRank,
      goatTier: goatEntry?.tier ?? null,
      resume: goatEntry?.resume ?? null,
      franchises: goatEntry?.franchises ?? null,
      birthCity: birthplace?.city ?? null,
      birthState: birthplace?.state ?? null,
      birthCountry: birthplace?.country ?? player.country ?? null,
    };
    if (birthplace?.state) {
      const bucket = domestic.get(birthplace.state) ?? [];
      bucket.push(baseInfo);
      domestic.set(birthplace.state, bucket);
    }
    const rawCountry = (birthplace?.country && birthplace.country !== 'USA') ? birthplace.country : player.country;
    if (rawCountry && rawCountry !== 'USA') {
      const code = countryCodes.get(rawCountry.toLowerCase()) ?? null;
      const bucket = international.get(code ?? rawCountry) ?? [];
      bucket.push({ ...baseInfo, countryName: rawCountry, countryCode: code ?? null });
      international.set(code ?? rawCountry, bucket);
    }
  }

  const domesticEntries = [];
  for (const [code, list] of domestic.entries()) {
    const playersSorted = list
      .slice()
      .sort((a, b) => {
        const aScore = Number.isFinite(a.goatScore) ? a.goatScore : -Infinity;
        const bScore = Number.isFinite(b.goatScore) ? b.goatScore : -Infinity;
        if (bScore !== aScore) return bScore - aScore;
        return a.name.localeCompare(b.name);
      })
      .map((entry, index) => ({ ...entry, groupRank: index + 1 }));
    const top = playersSorted[0];
    domesticEntries.push({
      state: code,
      stateName: stateNames[code] ?? code,
      player: top?.name ?? null,
      goatScore: top?.goatScore ?? null,
      goatRank: top?.goatRank ?? null,
      birthCity: top?.birthCity ?? null,
      headline: top?.resume ?? null,
      notableTeams: Array.isArray(top?.franchises) ? top.franchises : [],
      topPlayers: playersSorted,
    });
  }
  domesticEntries.sort((a, b) => a.state.localeCompare(b.state));

  const internationalEntries = [];
  for (const [code, list] of international.entries()) {
    const playersSorted = list
      .slice()
      .sort((a, b) => {
        const aScore = Number.isFinite(a.goatScore) ? a.goatScore : -Infinity;
        const bScore = Number.isFinite(b.goatScore) ? b.goatScore : -Infinity;
        if (bScore !== aScore) return bScore - aScore;
        return a.name.localeCompare(b.name);
      })
      .map((entry, index) => ({ ...entry, groupRank: index + 1 }));
    const top = playersSorted[0];
    const codeString = typeof code === 'string' ? code : null;
    internationalEntries.push({
      country: codeString ?? null,
      countryName: top?.countryName ?? (typeof code === 'string' ? code : 'Unknown'),
      player: top?.name ?? null,
      goatScore: top?.goatScore ?? null,
      goatRank: top?.goatRank ?? null,
      birthCity: top?.birthCity ?? null,
      headline: top?.resume ?? null,
      notableTeams: Array.isArray(top?.franchises) ? top.franchises : [],
      topPlayers: playersSorted,
    });
  }
  internationalEntries.sort((a, b) => a.countryName.localeCompare(b.countryName));

  return {
    domestic: { generatedAt: new Date().toISOString(), states: domesticEntries },
    international: { generatedAt: new Date().toISOString(), countries: internationalEntries },
  };
}

function mergeAtlasPlayers(latestPlayers, curatedPlayers) {
  if (!Array.isArray(latestPlayers)) return [];
  if (!Array.isArray(curatedPlayers) || !curatedPlayers.length) return latestPlayers;

  const curatedById = new Map();
  const curatedByName = new Map();

  for (const entry of curatedPlayers) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.personId && Number.isFinite(Number(entry.personId))) {
      curatedById.set(Number(entry.personId), entry);
    }
    const nameKey = normalizeName(entry.name);
    if (nameKey) {
      curatedByName.set(nameKey, entry);
    }
  }

  return latestPlayers.map((player) => {
    const candidate =
      (Number.isFinite(player.id) && curatedById.get(player.id)) ||
      curatedByName.get(normalizeName(player.name));
    if (!candidate) return player;
    const curatedRank = Number.isFinite(candidate.goatRank)
      ? candidate.goatRank
      : Number.isFinite(candidate.rank)
        ? Number(candidate.rank)
        : null;
    const curatedScore = Number(candidate.goatScore ?? candidate.score);
    return {
      ...player,
      goatScore: Number.isFinite(player.goatScore)
        ? player.goatScore
        : Number.isFinite(curatedScore)
          ? curatedScore
          : player.goatScore,
      goatRank: Number.isFinite(player.goatRank)
        ? player.goatRank
        : curatedRank,
      resume: candidate.resume ?? player.resume,
      franchises:
        Array.isArray(candidate.franchises) && candidate.franchises.length
          ? candidate.franchises
          : player.franchises,
    };
  });
}

function mergeAtlasEntries(latestEntries, curatedEntries, entryId) {
  if (!Array.isArray(latestEntries)) return [];
  const curatedById = new Map();
  if (Array.isArray(curatedEntries)) {
    for (const entry of curatedEntries) {
      if (!entry || typeof entry !== 'object') continue;
      const key = entry[entryId];
      if (key != null) {
        curatedById.set(key, entry);
      }
    }
  }

  return latestEntries.map((entry) => {
    const curated = curatedById.get(entry[entryId]);
    if (!curated) return entry;
    const mergedTopPlayers = mergeAtlasPlayers(entry.topPlayers, curated.topPlayers);
    const topPlayer = mergedTopPlayers[0] ?? null;
    return {
      ...entry,
      headline: curated.headline ?? entry.headline,
      notableTeams:
        Array.isArray(curated.notableTeams) && curated.notableTeams.length
          ? curated.notableTeams
          : entry.notableTeams,
      goatScore: Number.isFinite(entry.goatScore)
        ? entry.goatScore
        : Number.isFinite(topPlayer?.goatScore)
          ? topPlayer.goatScore
          : entry.goatScore,
      goatRank: Number.isFinite(entry.goatRank)
        ? entry.goatRank
        : Number.isFinite(topPlayer?.goatRank)
          ? topPlayer.goatRank
          : entry.goatRank,
      topPlayers: mergedTopPlayers,
    };
  });
}

async function renderAtlas(mode, atlasData, svgCache) {
  if (!selectors.mapRoot) return;
  const config = mode === 'international'
    ? {
        id: 'international',
        mapAsset: 'vendor/world-countries.svg',
        datasetKey: 'countries',
        entryId: 'country',
        entryName: 'countryName',
        shapeAttribute: 'data-country',
        title: 'Best NBA star born in each country',
        caption: 'Select a country outline to spotlight the standout NBA player born there.',
        spotlightHeading: 'Country spotlight',
      }
    : {
        id: 'domestic',
        mapAsset: 'vendor/us-states.svg',
        datasetKey: 'states',
        entryId: 'state',
        entryName: 'stateName',
        shapeAttribute: 'data-state',
        title: 'Best NBA star born in each state',
        caption: 'Select a tile to spotlight the most decorated NBA player born in that state.',
        spotlightHeading: 'State spotlight',
      };

  const entries = atlasData[config.datasetKey] ?? [];
  const entryById = new Map(entries.map((entry) => [entry[config.entryId], entry]));

  let svg = svgCache.get(config.mapAsset) ?? null;
  if (!svg) {
    const response = await fetch(config.mapAsset);
    if (!response.ok) {
      throw new Error(`Failed to load ${config.mapAsset}`);
    }
    const markup = await response.text();
    const template = document.createElement('template');
    template.innerHTML = markup.trim().replace(/ns0:/g, '');
    const root = template.content.firstElementChild;
    if (root) {
      root.classList.add('state-map__svg');
      svg = root;
      svgCache.set(config.mapAsset, svg);
    }
  }
  if (!svg) return;
  selectors.mapRoot.innerHTML = '';
  const svgClone = svg.cloneNode(true);
  selectors.mapRoot.append(svgClone);
  selectors.mapRoot.dataset.atlasMode = config.id;
  if (config.id === 'domestic') {
    enhanceUsaInsets(svgClone);
  }
  enablePanZoom(selectors.mapRoot, svgClone, {
    maxScale: config.id === 'domestic' ? 6 : 5,
    minScale: 1,
    zoomStep: 0.35,
  });

  const shapes = svgClone.querySelectorAll(`[${config.shapeAttribute}]`);
  let defaultEntry = null;
  for (const shape of shapes) {
    const code = shape.getAttribute(config.shapeAttribute);
    const entry = entryById.get(code) ?? null;
    shape.classList.remove('state-shape--selected', 'state-shape--available', 'state-shape--empty');
    shape.removeAttribute('tabindex');
    shape.removeAttribute('role');
    shape.removeAttribute('aria-pressed');
    if (entry && entry.player) {
      shape.classList.add('state-shape--available');
      shape.setAttribute('role', 'button');
      shape.setAttribute('tabindex', '0');
      shape.setAttribute('aria-pressed', 'false');
      shape.setAttribute('title', entry.player);
      shape.setAttribute('aria-label', `${entry[config.entryName]}: ${entry.player}`);
      shape.addEventListener('click', () => selectAtlasEntry(shape, entry, config));
      shape.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectAtlasEntry(shape, entry, config);
        }
      });
      if (!defaultEntry) {
        defaultEntry = { shape, entry };
      }
    } else {
      shape.classList.add('state-shape--empty');
      shape.setAttribute('title', entry ? entry[config.entryName] ?? code : code ?? 'Unavailable');
      shape.addEventListener('click', () => selectAtlasEntry(shape, entry, config));
    }
  }
  updateAtlasCopy(config);
  if (defaultEntry) {
    selectAtlasEntry(defaultEntry.shape, defaultEntry.entry, config);
  } else {
    renderAtlasSpotlight(null, config);
  }
}

let activeShape = null;
let activeConfig = null;

function selectAtlasEntry(shape, entry, config) {
  if (activeShape && activeShape !== shape) {
    activeShape.classList.remove('state-shape--selected');
    activeShape.setAttribute('aria-pressed', 'false');
  }
  activeShape = shape;
  activeConfig = config;
  if (shape) {
    shape.classList.add('state-shape--selected');
    shape.setAttribute('aria-pressed', 'true');
  }
  renderAtlasSpotlight(entry, config);
}

function updateAtlasCopy(config) {
  if (selectors.atlasTitle) selectors.atlasTitle.textContent = config.title;
  if (selectors.atlasCaption) selectors.atlasCaption.textContent = config.caption;
  if (selectors.spotlightHeading) selectors.spotlightHeading.textContent = config.spotlightHeading;
  if (selectors.atlasToggle) {
    selectors.atlasToggle.textContent =
      config.id === 'domestic' ? 'Explore international mode' : 'Return to United States map';
  }
}

function renderAtlasSpotlight(entry, config) {
  if (!selectors.atlasSpotlight) return;
  selectors.atlasSpotlight.innerHTML = '';
  if (!entry) {
    selectors.atlasSpotlight.append(
      createElement('p', 'state-spotlight__placeholder', 'Select a tile to meet its headline legend.'),
    );
    return;
  }
  const topPlayer = Array.isArray(entry.topPlayers) && entry.topPlayers.length ? entry.topPlayers[0] : null;
  const heading = createElement('span', 'state-spotlight__state', entry[config.entryName] ?? entry[config.entryId] ?? '');
  selectors.atlasSpotlight.append(heading);
  if (entry.player) {
    selectors.atlasSpotlight.append(createElement('p', 'state-spotlight__player', entry.player));
  }
  const fallbackScore = Number(topPlayer?.goatScore);
  const fallbackRank = Number(topPlayer?.goatRank ?? topPlayer?.rank);
  const primaryScore = Number.isFinite(entry.goatScore)
    ? entry.goatScore
    : Number.isFinite(fallbackScore)
      ? fallbackScore
      : null;
  const primaryRank = Number.isFinite(entry.goatRank)
    ? entry.goatRank
    : Number.isFinite(fallbackRank)
      ? fallbackRank
      : null;
  const metricsParts = [];
  if (Number.isFinite(primaryScore)) {
    metricsParts.push(`${decimalFormatter.format(primaryScore)} GOAT`);
  }
  if (Number.isFinite(primaryRank)) {
    metricsParts.push(`Global rank #${numberFormatter.format(primaryRank)}`);
  }
  if (metricsParts.length) {
    selectors.atlasSpotlight.append(
      createElement('p', 'state-spotlight__metrics', metricsParts.join(' • ')),
    );
  }
  if (entry.birthCity) {
    selectors.atlasSpotlight.append(createElement('p', 'state-spotlight__meta', `Born in ${entry.birthCity}`));
  }
  if (entry.headline) {
    selectors.atlasSpotlight.append(createElement('p', 'state-spotlight__headline', entry.headline));
  }
  if (Array.isArray(entry.notableTeams) && entry.notableTeams.length) {
    const list = createElement('ul', 'state-spotlight__teams');
    entry.notableTeams.slice(0, 4).forEach((team) => list.append(createElement('li', 'state-spotlight__team', team)));
    selectors.atlasSpotlight.append(list);
  }
  if (Array.isArray(entry.topPlayers) && entry.topPlayers.length) {
    const ranking = createElement('ol', 'state-spotlight__ranking');
    entry.topPlayers.slice(0, 10).forEach((player) => {
      const item = createElement('li', 'state-spotlight__ranking-item');
      item.append(createElement('span', 'state-spotlight__ranking-ordinal', `#${player.groupRank}`));
      const body = createElement('div', 'state-spotlight__ranking-body');
      body.append(createElement('p', 'state-spotlight__ranking-name', player.name ?? 'Unknown'));
      const detailParts = [];
      const playerScore = Number.isFinite(player.goatScore)
        ? player.goatScore
        : Number(player.goatScore);
      if (Number.isFinite(playerScore)) {
        detailParts.push(`${decimalFormatter.format(playerScore)} GOAT`);
      }
      const playerRank = Number.isFinite(player.goatRank)
        ? player.goatRank
        : Number.isFinite(Number(player.rank))
          ? Number(player.rank)
          : null;
      if (Number.isFinite(playerRank)) {
        detailParts.push(`Global rank #${numberFormatter.format(playerRank)}`);
      }
      if (Array.isArray(player.franchises) && player.franchises.length) {
        detailParts.push(player.franchises.join(', '));
      }
      if (detailParts.length) {
        body.append(createElement('p', 'state-spotlight__ranking-meta', detailParts.join(' • ')));
      }
      item.append(body);
      ranking.append(item);
    });
    selectors.atlasSpotlight.append(ranking);
  }
}

async function bootstrap() {
  try {
    const [
      playersMin,
      playersFullDocument,
      birthplacesDocument,
      goatDocument,
      worldLegends,
      playerCareersDocument,
      stateLegendsDocument,
      goatBirthIndexDocument,
    ] = await Promise.all([
      loadJson(PLAYERS_MIN_URL),
      loadJson(PLAYERS_FULL_URL),
      loadJson(BIRTHPLACES_URL),
      loadLatestGoatDocument(),
      loadJson(WORLD_LEGENDS_URL).catch(() => null),
      loadJson(PLAYER_CAREERS_URL).catch(() => null),
      loadJson(STATE_LEGENDS_URL).catch(() => null),
      loadJson(GOAT_BIRTH_INDEX_URL).catch(() => null),
    ]);

    const playersFull = Array.isArray(playersFullDocument?.players) ? playersFullDocument.players : [];
    const playersMinList = Array.isArray(playersMin) ? playersMin : [];
    const goatBirthPlayers = Array.isArray(goatBirthIndexDocument?.players)
      ? goatBirthIndexDocument.players
      : [];
    const birthplaces = buildBirthplaceLookup(birthplacesDocument?.players ?? {}, goatBirthPlayers);
    const goatPlayers = Array.isArray(goatDocument?.players) ? goatDocument.players : [];
    const goatIndex = new Map();
    for (const entry of goatPlayers) {
      const nameKey = normalizeName(entry.name);
      if (!nameKey) continue;
      const list = goatIndex.get(nameKey) ?? [];
      list.push(entry);
      goatIndex.set(nameKey, list);
    }
    const goatReferences = buildGoatReferences(goatPlayers);
    const countryCodes = buildCountryCodeMap(worldLegends);
    const playersById = new Map(playersFull.map((player) => [player.id, player]));
    const careerCaches = buildCareerCaches(playerCareersDocument);
    cachedCareerStats = careerCaches.byId;
    cachedCareerStatsByName = careerCaches.byName;
    cachedCareerGeneratedAt =
      typeof playerCareersDocument?.generatedAt === 'string' ? playerCareersDocument.generatedAt : null;

    let selectionToken = 0;

    function lookupPlayerIdFromName(rawName) {
      const nameKey = normalizeName(rawName);
      if (!nameKey) {
        return null;
      }
      for (const player of playersFull) {
        const candidateKey = normalizeName(`${player.first_name} ${player.last_name}`);
        if (candidateKey && candidateKey === nameKey) {
          return player.id;
        }
      }
      return null;
    }

    async function showPlayerById(playerId) {
      if (!Number.isFinite(playerId)) {
        return;
      }
      const player = playersById.get(playerId);
      if (!player) {
        return;
      }

      selectionToken += 1;
      const token = selectionToken;
      const nameKey = normalizeName(`${player.first_name} ${player.last_name}`);
      const birthplace = resolveBirthplace(nameKey, birthplaces);
      const totalsContainer = renderPlayerCard(player, birthplace);
      const goatEntry = selectGoatEntry(player, goatIndex);
      renderVisuals(goatEntry, goatReferences);
      if (!totalsContainer) {
        return;
      }

      const cachedCareerById = cachedCareerStats.get(playerId);
      const cachedCareerByName = nameKey ? cachedCareerStatsByName.get(nameKey) : null;
      const cachedCareer = cachedCareerById ?? cachedCareerByName ?? null;
      const renderUnavailable = (message) => {
        if (selectionToken !== token) return;
        totalsContainer.innerHTML = '';
        totalsContainer.append(createElement('p', 'history-player__error', message));
      };

      const renderCached = (contextMessage) => {
        if (selectionToken !== token) return;
        totalsContainer.innerHTML = '';
        if (cachedCareer) {
          renderCachedCareer(totalsContainer, cachedCareer, contextMessage);
        } else if (contextMessage) {
          totalsContainer.append(createElement('p', 'history-player__error', contextMessage));
        }
      };

      totalsContainer.innerHTML = '';

      totalsContainer.append(
        createElement('p', 'history-player__hint', "Fetching the live career log from Ball Don't Lie…"),
      );

      let renderedPrewarmed = false;

      try {
        const career = await fetchCareerStats(player, {
          onCached: (partialCareer, { needsHydration } = {}) => {
            if (selectionToken !== token) return;
            renderedPrewarmed = true;
            totalsContainer.innerHTML = '';
            const hint = needsHydration
              ? 'Loaded prewarmed Ball Don\'t Lie archive — checking the latest season…'
              : 'Loaded prewarmed Ball Don\'t Lie archive.';
            totalsContainer.append(createElement('p', 'history-player__hint', hint));
            totalsContainer.append(renderTotalsTable('Regular season', partialCareer.regular));
            totalsContainer.append(renderTotalsTable('Postseason', partialCareer.postseason));
          },
        });
        if (selectionToken !== token) return;
        totalsContainer.innerHTML = '';
        totalsContainer.append(renderTotalsTable('Regular season', career.regular));
        totalsContainer.append(renderTotalsTable('Postseason', career.postseason));
      } catch (error) {
        console.error(error);
        if (selectionToken !== token) return;
        if (renderedPrewarmed) {
          totalsContainer.append(
            createElement(
              'p',
              'history-player__hint',
              'Live Ball Don\'t Lie refresh is currently unavailable — showing the prewarmed archive above.',
            ),
          );
        } else if (cachedCareer) {
          renderCachedCareer(
            totalsContainer,
            cachedCareer,
            'Live Ball Don\'t Lie stats are unavailable — showing the cached snapshot instead.',
          );
        } else {
          renderUnavailable('We hit a snag pulling the career stats. Try again in a moment.');
        }
      }
    }

    if (selectors.searchInput) {
      selectors.searchInput.addEventListener('input', (event) => {
        const term = event.target.value;
        renderSearchResults(playersMinList, term);
      });
      renderSearchResults(playersMinList, '');
    }

    if (selectors.searchResults) {
      selectors.searchResults.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-player-id]');
        if (!button) return;
        const playerId = Number(button.dataset.playerId);
        if (!Number.isFinite(playerId)) return;
        await showPlayerById(playerId);
      });
    }

    const initialParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (initialParams) {
      const playerIdParam = initialParams.get('playerId');
      const playerNameParam = initialParams.get('player');
      let initialPlayerId = null;
      if (playerIdParam && Number.isFinite(Number(playerIdParam))) {
        initialPlayerId = Number(playerIdParam);
      } else if (playerNameParam) {
        initialPlayerId = lookupPlayerIdFromName(playerNameParam);
      }
      if (initialPlayerId && playersById.has(initialPlayerId)) {
        if (selectors.searchInput) {
          const player = playersById.get(initialPlayerId);
          selectors.searchInput.value = `${player.first_name} ${player.last_name}`.trim();
          renderSearchResults(playersMinList, selectors.searchInput.value);
        }
        await showPlayerById(initialPlayerId);
      }
    }

    const atlas = buildAtlas(playersFull, birthplaces, goatIndex, countryCodes);
    const domesticAtlas = {
      generatedAt: atlas.domestic.generatedAt,
      states: mergeAtlasEntries(
        atlas.domestic.states,
        Array.isArray(stateLegendsDocument?.states) ? stateLegendsDocument.states : [],
        'state',
      ),
    };
    const internationalAtlas = {
      generatedAt: atlas.international.generatedAt,
      countries: mergeAtlasEntries(
        atlas.international.countries,
        Array.isArray(worldLegends?.countries) ? worldLegends.countries : [],
        'country',
      ),
    };
    const svgCache = new Map();
    await renderAtlas('domestic', domesticAtlas, svgCache);
    if (selectors.atlasToggle) {
      selectors.atlasToggle.addEventListener('click', async () => {
        const nextMode = selectors.mapRoot?.dataset.atlasMode === 'domestic' ? 'international' : 'domestic';
        selectors.atlasToggle.disabled = true;
        try {
          await renderAtlas(nextMode, nextMode === 'domestic' ? domesticAtlas : internationalAtlas, svgCache);
        } catch (error) {
          console.error(error);
        } finally {
          selectors.atlasToggle.disabled = false;
        }
      });
    }
  } catch (error) {
    console.error('Failed to initialise history page', error);
  }
}

bootstrap();
const CAREER_TOTAL_KEYS = [
  'games',
  'minutes',
  'points',
  'rebounds',
  'assists',
  'steals',
  'blocks',
  'turnovers',
  'fouls',
  'fgm',
  'fga',
  'fg3m',
  'fg3a',
  'ftm',
  'fta',
  'oreb',
  'dreb',
];

const cachedCareerTimestampFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

let cachedCareerStats = new Map();
let cachedCareerStatsByName = new Map();
let cachedCareerGeneratedAt = null;
