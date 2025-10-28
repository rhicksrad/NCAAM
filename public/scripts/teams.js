import { enablePanZoom, enhanceUsaInsets } from './map-utils.js';

const MAP_WIDTH = 960;
const MAP_HEIGHT = 600;
const SVG_NS = 'http://www.w3.org/2000/svg';
const LAT_RANGE = [24, 50];
const LON_RANGE = [-125, -66];
const CONFERENCE_CLASSES = {
  East: 'east',
  West: 'west',
};

const TEAM_MODE_CONFIG = {
  active: {
    dataset: 'data/team_profiles.json',
    mapCopy:
      "Pins are color coded by conference and expand into a live dashboard with scoring, efficiency, and depth insights pulled from the league archive (1946-2025).",
    footprintTitle: 'Ranking every active team by footprint strength.',
    footprintDescription:
      "We blended results, efficiency, and rotational depth to surface how each club's on-court identity resonates across the league in 2024-25. Explore the full ladder below, then dig into the numbers that power every badge.",
    footprintEmpty: 'We were unable to load active team data for this refresh.',
    methodologyIntro: (seasonText) =>
      `Franchise Footprint scores normalise each legacy signal to a league-wide 0-100 scale${seasonText}, then blend the results using the weighted recipe below. The composite number now spotlights franchises that pair trophy cases, Hall of Fame representation, and sustained winning across eras.`,
    methodologyOutro:
      'This historical view keeps weights fixed so the rankings emphasise enduring impact rather than short-term swings.',
  },
  inactive: {
    dataset: 'data/inactive_team_profiles.json',
    mapCopy:
      'Pins now spotlight inactive franchises from the NBA archives. Click a dormant club to surface its historical performance profile and relive defunct eras.',
    footprintTitle: 'Ranking every inactive franchise by archive footprint.',
    footprintDescription:
      'We remix legacy signals to celebrate the dormant brands that still cast a shadow across the league. Compare inactive clubs on trophies, legends, and peak efficiency to see who is most ready for a revival.',
    footprintEmpty: 'We were unable to load inactive franchise data for this refresh.',
    methodologyIntro: (seasonText) =>
      `Inactive franchise Footprint scores normalise each legacy marker to the vintage peer set${seasonText} before applying the same weighted recipe. The blend lets dormant clubs compete on even footing, from trophy hauls to star power.`,
    methodologyOutro:
      'Because the inactive set is frozen in time, the weights emphasise enduring resonance rather than contemporary results.',
  },
};

const METRIC_CONFIG = [
  {
    key: 'winPct',
    label: 'Win percentage',
    description: 'Share of games won across the tracked 2024-25 sample.',
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: 'avgPointsFor',
    label: 'Points for',
    description: 'Average points scored per game.',
    format: (value) => value.toFixed(1),
  },
  {
    key: 'avgPointsAgainst',
    label: 'Points allowed',
    description: 'Average points conceded per game.',
    format: (value) => value.toFixed(1),
    inverse: true,
  },
  {
    key: 'netMargin',
    label: 'Net margin',
    description: 'Average scoring differential versus opponents.',
    format: (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`,
  },
  {
    key: 'fieldGoalPct',
    label: 'Field goal accuracy',
    description: 'Overall shooting efficiency from the floor.',
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: 'threePointPct',
    label: 'Three-point accuracy',
    description: 'Conversion rate on perimeter attempts.',
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  {
    key: 'rebounds',
    label: 'Rebounds',
    description: 'Average total rebounds secured per night.',
    format: (value) => value.toFixed(1),
  },
  {
    key: 'assists',
    label: 'Assists',
    description: 'Average assists generated each game.',
    format: (value) => value.toFixed(1),
  },
  {
    key: 'turnovers',
    label: 'Turnovers',
    description: 'Average turnovers committed per outing (lower is stronger).',
    format: (value) => value.toFixed(1),
    inverse: true,
  },
  {
    key: 'pointsInPaint',
    label: 'Points in the paint',
    description: 'Interior scoring output per contest.',
    format: (value) => value.toFixed(1),
  },
  {
    key: 'fastBreakPoints',
    label: 'Fast-break points',
    description: 'Transition scoring per game.',
    format: (value) => value.toFixed(1),
  },
  {
    key: 'benchPoints',
    label: 'Bench points',
    description: 'Second-unit scoring production.',
    format: (value) => value.toFixed(1),
  },
];

const LEGACY_METRICS = [
  {
    key: 'titles',
    weight: 0.45,
    label: 'Championship banners',
    description: 'NBA titles secured across the franchise timeline.',
    valueAccessor: (team) => team?.legacy?.titles,
  },
  {
    key: 'hallOfFamers',
    weight: 0.35,
    label: 'Hall of Fame alumni',
    description: 'Hall of Fame players who suited up for the franchise.',
    valueAccessor: (team) => team?.legacy?.hallOfFamers,
  },
  {
    key: 'winPct',
    weight: 0.2,
    label: 'All-time win rate',
    description: 'Regular-season winning percentage across the full archive.',
    valueAccessor: (team) => team?.metrics?.winPct,
  },
];

const mapCanvas = document.querySelector('[data-map-canvas]');
let mapViewport = null;
const detailPanel = document.querySelector('[data-team-panel]');
const detailPlaceholder = document.querySelector('[data-team-placeholder]');
const detailBody = document.querySelector('[data-team-body]');
const detailConference = document.querySelector('[data-team-conference]');
const detailName = document.querySelector('[data-team-name]');
const detailMeta = document.querySelector('[data-team-meta]');
const detailGames = document.querySelector('[data-team-games]');
const detailRecord = document.querySelector('[data-team-record]');
const detailNet = document.querySelector('[data-team-net]');
const detailVisuals = document.querySelector('[data-team-visuals]');
const modeCopyElement = document.querySelector('[data-team-mode-copy]');
const modeToggle = document.querySelector('[data-team-mode]');
const modeToggleButtons = modeToggle ? Array.from(modeToggle.querySelectorAll('[data-mode]')) : [];
const footprintList = document.querySelector('[data-footprint-list]');
const footprintMethodology = document.querySelector('[data-footprint-methodology]');
const footprintTitle = document.querySelector('[data-footprint-title]');
const footprintDescription = document.querySelector('[data-footprint-description]');
const footprintSection = document.querySelector('[data-footprint]');

let markerButtons = [];
let activeTeamId = null;
let metricExtents = {};
let legacyExtents = {};
let teamLookup = new Map();
const datasetStore = new Map();
let currentMode = 'active';

function projectCoordinates(latitude, longitude) {
  const x = ((longitude - LON_RANGE[0]) / (LON_RANGE[1] - LON_RANGE[0])) * MAP_WIDTH;
  const y = ((LAT_RANGE[1] - latitude) / (LAT_RANGE[1] - LAT_RANGE[0])) * MAP_HEIGHT;
  return { x, y };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function computeConvexHull(points) {
  if (!Array.isArray(points) || points.length <= 2) {
    return Array.isArray(points) ? [...points] : [];
  }

  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (origin, a, b) => (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);

  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function computePolygonCentroid(points) {
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  let area = 0;
  let centroidX = 0;
  let centroidY = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    area += cross;
    centroidX += (current.x + next.x) * cross;
    centroidY += (current.y + next.y) * cross;
  }

  area *= 0.5;
  if (Math.abs(area) < 1e-5) {
    const fallback = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 },
    );
    return {
      x: fallback.x / points.length,
      y: fallback.y / points.length,
    };
  }

  return {
    x: centroidX / (6 * area),
    y: centroidY / (6 * area),
  };
}

function getMapViewport() {
  if (!mapViewport || !mapViewport.isConnected) {
    mapViewport = mapCanvas ? mapCanvas.querySelector('.team-map__viewport') : null;
  }
  return mapViewport;
}

function renderDivisionOverlays(teams) {
  if (!mapCanvas || !Array.isArray(teams)) return;

  const viewport = getMapViewport();
  if (!viewport) {
    return;
  }

  const existingOverlay = viewport.querySelector('.team-map__overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  const divisionGroups = teams.reduce((acc, team) => {
    const division = team?.division;
    if (!division) {
      return acc;
    }
    const { latitude, longitude } = team;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return acc;
    }
    const { x, y } = projectCoordinates(latitude, longitude);
    if (!acc.has(division)) {
      acc.set(division, {
        conference: team.conference,
        points: [],
      });
    }
    const group = acc.get(division);
    group.points.push({ x, y });
    if (!group.conference && team.conference) {
      group.conference = team.conference;
    }
    return acc;
  }, new Map());

  if (!divisionGroups.size) {
    return;
  }

  const overlay = document.createElementNS(SVG_NS, 'svg');
  overlay.classList.add('team-map__overlay');
  overlay.setAttribute('viewBox', `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`);
  overlay.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('focusable', 'false');

  divisionGroups.forEach((group, division) => {
    if (!group?.points?.length) {
      return;
    }
    const hull = computeConvexHull(group.points);
    if (hull.length < 3) {
      return;
    }
    const polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', hull.map((point) => `${point.x},${point.y}`).join(' '));
    const conferenceClass = CONFERENCE_CLASSES[group.conference] ?? 'east';
    const divisionSlug = slugify(division);
    polygon.setAttribute('class', `team-division team-division--${conferenceClass} team-division--${divisionSlug}`);
    overlay.append(polygon);

    const centroid = computePolygonCentroid(hull);
    const label = document.createElementNS(SVG_NS, 'text');
    label.textContent = `${division} Division`;
    label.setAttribute('class', 'team-division__label');
    label.setAttribute('x', centroid.x.toFixed(1));
    label.setAttribute('y', centroid.y.toFixed(1));
    overlay.append(label);
  });

  if (overlay.childNodes.length) {
    viewport.append(overlay);
  }
}

function normaliseValue(value, { min, max }, inverse = false) {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return 0.5;
  }
  const clamped = (value - min) / (max - min);
  const ratio = Math.min(1, Math.max(0, clamped));
  return inverse ? 1 - ratio : ratio;
}

function formatFootprintScore(score) {
  if (!Number.isFinite(score)) {
    return '—';
  }
  return (score * 100).toFixed(1);
}

function describeFootprintSignal(key, rawValue) {
  if (!Number.isFinite(rawValue)) {
    return null;
  }
  switch (key) {
    case 'winPct':
      return `${(rawValue * 100).toFixed(1)}% win rate`;
    case 'titles':
      return `${rawValue} title${rawValue === 1 ? '' : 's'}`;
    case 'hallOfFamers':
      return `${rawValue} Hall of Famer${rawValue === 1 ? '' : 's'}`;
    case 'netMargin':
      return `${rawValue >= 0 ? '+' : ''}${rawValue.toFixed(1)} net margin`;
    case 'fieldGoalPct':
      return `${(rawValue * 100).toFixed(1)}% FG`; 
    case 'threePointPct':
      return `${(rawValue * 100).toFixed(1)}% 3P`;
    case 'rebounds':
      return `${rawValue.toFixed(1)} REB`;
    case 'assists':
      return `${rawValue.toFixed(1)} AST`;
    case 'benchPoints':
      return `${rawValue.toFixed(1)} bench pts`;
    case 'turnovers':
      return `${rawValue.toFixed(1)} TOV`;
    default:
      return null;
  }
}

function computeFootprintScores(teams) {
  return teams
    .map((team) => {
      const metrics = team?.metrics ?? {};
      let score = 0;
      const contributions = LEGACY_METRICS.map((config) => {
        const rawValue = config.valueAccessor ? config.valueAccessor(team) : null;
        const value = Number.isFinite(rawValue) ? rawValue : null;
        const extent = legacyExtents?.[config.key];
        const normalised = Number.isFinite(value)
          ? normaliseValue(value, extent ?? { min: 0, max: 1 }, Boolean(config.inverse))
          : 0;
        const weighted = normalised * config.weight;
        score += weighted;
        return { ...config, value, weighted };
      }).sort((a, b) => b.weighted - a.weighted);
      return { ...team, footprintScore: score, footprintContributions: contributions };
    })
    .sort((a, b) => {
      const bScore = Number.isFinite(b.footprintScore) ? b.footprintScore : -1;
      const aScore = Number.isFinite(a.footprintScore) ? a.footprintScore : -1;
      return bScore - aScore;
    });
}

function renderFootprintRankings(teams, mode = 'active') {
  if (!footprintList) {
    return;
  }

  const modeConfig = TEAM_MODE_CONFIG[mode] ?? TEAM_MODE_CONFIG.active;
  const ranked = computeFootprintScores(teams);
  footprintList.innerHTML = '';

  if (!ranked.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'franchise-footprint__item';
    placeholder.innerHTML = `
      <span class="franchise-footprint__rank">—</span>
      <div class="franchise-footprint__body">
        <div class="franchise-footprint__heading">
          <strong>Franchise rankings will update soon</strong>
        </div>
        <span class="franchise-footprint__meta">${modeConfig.footprintEmpty}</span>
      </div>
    `;
    footprintList.append(placeholder);
    return;
  }

  ranked.forEach((team, index) => {
    const metrics = team?.metrics ?? {};
    const legacy = team?.legacy ?? {};
    const metaParts = [];
    if (team?.conference) {
      metaParts.push(`${team.conference} Conference`);
    }
    if (Number.isFinite(metrics.winPct)) {
      metaParts.push(`${(metrics.winPct * 100).toFixed(1)}% win rate`);
    }
    if (Number.isFinite(legacy.titles)) {
      metaParts.push(`${legacy.titles} title${legacy.titles === 1 ? '' : 's'}`);
    }
    if (Number.isFinite(legacy.hallOfFamers) && legacy.hallOfFamers > 0) {
      metaParts.push(`${legacy.hallOfFamers} Hall of Famer${legacy.hallOfFamers === 1 ? '' : 's'}`);
    }
    if (Number.isFinite(team?.gamesSampled)) {
      metaParts.push(`${team.gamesSampled.toLocaleString()} games sampled`);
    }
    if (team?.era) {
      metaParts.push(`Active ${team.era}`);
    }
    const topSignals = (team.footprintContributions ?? [])
      .map((entry) => describeFootprintSignal(entry.key, entry.value))
      .filter(Boolean)
      .slice(0, 3);
    const signalsText = topSignals.join(' • ');

    const item = document.createElement('li');
    item.className = 'franchise-footprint__item';
    item.innerHTML = `
      <span class="franchise-footprint__rank">${index + 1}</span>
      <div class="franchise-footprint__body">
        <div class="franchise-footprint__heading">
          <strong>${team?.name ?? team?.abbreviation ?? 'Team'}</strong>
          <span class="franchise-footprint__score" aria-label="Franchise Footprint composite score">${formatFootprintScore(
            team.footprintScore,
          )}</span>
        </div>
        ${metaParts.length ? `<span class="franchise-footprint__meta">${metaParts.join(' • ')}</span>` : ''}
        ${signalsText ? `<span class="franchise-footprint__signals">Key drivers: ${signalsText}</span>` : ''}
      </div>
    `;
    footprintList.append(item);
  });
}

function renderFootprintMethodology(seasonLabel, mode = 'active') {
  if (!footprintMethodology) {
    return;
  }
  const modeConfig = TEAM_MODE_CONFIG[mode] ?? TEAM_MODE_CONFIG.active;
  const bullets = LEGACY_METRICS.map(
    (metric) => `<li><strong>${Math.round(metric.weight * 100)}%</strong> ${metric.label}</li>`,
  )
    .join('');
  const seasonText = seasonLabel ? ` through the ${seasonLabel} record books` : '';
  const intro =
    typeof modeConfig.methodologyIntro === 'function'
      ? modeConfig.methodologyIntro(seasonText)
      : modeConfig.methodologyIntro;
  const outro = modeConfig.methodologyOutro ?? '';
  footprintMethodology.innerHTML = `
    <p>${intro}</p>
    <ul>${bullets}</ul>
    ${outro ? `<p>${outro}</p>` : ''}
  `;
}

function upperBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function lowerBound(values, target) {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (values[mid] < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function computePercentile(value, extent, inverse = false) {
  const values = extent?.values;
  if (!Number.isFinite(value) || !Array.isArray(values) || !values.length) {
    return null;
  }
  const size = values.length;
  if (inverse) {
    const index = lowerBound(values, value);
    const count = size - index;
    const percentile = count / size;
    return Math.min(1, Math.max(0, percentile));
  }
  const rank = upperBound(values, value);
  const percentile = rank / size;
  return Math.min(1, Math.max(0, percentile));
}

function formatOrdinal(value) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${value}th`;
  }
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function formatPercentileRank(percentile) {
  if (percentile === null) {
    return '';
  }
  const percentage = Math.min(100, Math.max(0, Math.round(percentile * 100)));
  return `${formatOrdinal(percentage)} percentile`;
}

function updateModeCopy(mode) {
  const modeConfig = TEAM_MODE_CONFIG[mode] ?? TEAM_MODE_CONFIG.active;
  if (modeCopyElement && modeConfig?.mapCopy) {
    modeCopyElement.textContent = modeConfig.mapCopy;
  }
  if (footprintTitle && modeConfig?.footprintTitle) {
    footprintTitle.textContent = modeConfig.footprintTitle;
  }
  if (footprintDescription && modeConfig?.footprintDescription) {
    footprintDescription.textContent = modeConfig.footprintDescription;
  }
  if (footprintSection) {
    footprintSection.dataset.mode = mode;
  }
}

function updateModeToggleState(mode) {
  if (!modeToggleButtons.length) {
    return;
  }
  modeToggleButtons.forEach((button) => {
    const buttonMode = button.dataset.mode;
    const isSelected = buttonMode === mode;
    button.setAttribute('aria-pressed', String(isSelected));
  });
}

function configureModeToggle() {
  if (!modeToggleButtons.length) {
    return;
  }
  modeToggleButtons.forEach((button) => {
    const buttonMode = button.dataset.mode;
    if (!buttonMode) {
      return;
    }
    const isAvailable = datasetStore.has(buttonMode);
    button.disabled = !isAvailable;
    if (isAvailable && !button.dataset.modeBound) {
      button.addEventListener('click', () => {
        if (currentMode !== buttonMode) {
          applyMode(buttonMode);
        }
      });
      button.dataset.modeBound = 'true';
    }
  });
}

function applyMode(mode) {
  const dataset = datasetStore.get(mode);
  if (!dataset) {
    return;
  }

  currentMode = mode;
  configureModeToggle();
  updateModeToggleState(mode);
  updateModeCopy(mode);

  const teams = dataset.teams ?? [];
  teamLookup = new Map();
  teams.forEach((team) => {
    if (team?.abbreviation) {
      teamLookup.set(team.abbreviation, team);
    }
  });

  computeExtents(teams);
  computeLegacyExtents(teams);
  renderDivisionOverlays(teams);
  buildMarkers(teams);
  clearActiveMarker();
  activeTeamId = null;
  renderDetail(null);
  renderFootprintRankings(teams, mode);
  renderFootprintMethodology(dataset.season, mode);
}

function clearActiveMarker() {
  markerButtons.forEach((button) => button.classList.remove('team-marker--active'));
}

function activateMarker(abbreviation) {
  clearActiveMarker();
  const activeButton = markerButtons.find((button) => button.dataset.team === abbreviation);
  if (activeButton) {
    activeButton.classList.add('team-marker--active');
    activeButton.focus({ preventScroll: true });
  }
}

function renderDetail(team) {
  if (!team) {
    detailBody?.setAttribute('hidden', '');
    detailPlaceholder?.removeAttribute('hidden');
    detailPanel?.setAttribute('aria-busy', 'false');
    return;
  }

  if (detailPlaceholder) {
    detailPlaceholder.setAttribute('hidden', '');
  }
  if (detailBody) {
    detailBody.removeAttribute('hidden');
  }

  if (detailPanel) {
    detailPanel.setAttribute('aria-busy', 'false');
  }

  const { conference, city, division, name, abbreviation, metrics, gamesSampled, wins, losses, era } = team;
  const isInactiveMode = currentMode === 'inactive';
  if (detailConference) {
    const conferenceLabel = conference
      ? `${conference} Conference`
      : isInactiveMode
        ? 'Inactive franchise'
        : 'Conference unavailable';
    const conferenceClass = conference
      ? CONFERENCE_CLASSES[conference] ?? 'east'
      : isInactiveMode
        ? 'inactive'
        : 'east';
    detailConference.textContent = conferenceLabel;
    detailConference.className = `team-detail__conference team-detail__conference--${conferenceClass}`;
  }
  if (detailName) {
    detailName.textContent = `${name} (${abbreviation})`;
  }
  if (detailMeta) {
    const metaParts = [];
    if (city) {
      metaParts.push(city);
    }
    if (division) {
      metaParts.push(`${division} Division`);
    }
    if (era) {
      metaParts.push(`Active ${era}`);
    }
    detailMeta.textContent = metaParts.join(' • ');
  }
  if (detailGames) {
    detailGames.textContent = Number.isFinite(gamesSampled) ? gamesSampled.toLocaleString() : '—';
  }
  if (detailRecord) {
    const recordWins = Number.isFinite(wins) ? wins : null;
    const recordLosses = Number.isFinite(losses) ? losses : null;
    detailRecord.textContent = recordWins !== null && recordLosses !== null ? `${recordWins}-${recordLosses}` : '—';
  }
  if (detailNet) {
    const net = metrics?.netMargin;
    detailNet.textContent = Number.isFinite(net) ? `${net >= 0 ? '+' : ''}${net.toFixed(1)} per game` : '—';
  }

  if (detailVisuals) {
    detailVisuals.innerHTML = '';
    METRIC_CONFIG.forEach((metric) => {
      const value = metrics?.[metric.key];
      if (!Number.isFinite(value)) {
        return;
      }
      const extent = metricExtents[metric.key];
      const progress = normaliseValue(value, extent ?? { min: 0, max: 1 }, Boolean(metric.inverse));
      const percentile = computePercentile(value, extent, Boolean(metric.inverse));
      const percentileLabel = formatPercentileRank(percentile);
      const card = document.createElement('article');
      card.className = 'team-visual';
      card.innerHTML = `
        <header class="team-visual__header">
          <div class="team-visual__heading">
            <span class="team-visual__label">${metric.label}</span>
            ${percentileLabel ? `<span class="team-visual__percentile" title="Percentile rank across the league">${percentileLabel}</span>` : ''}
          </div>
          <strong class="team-visual__value">${metric.format(value)}</strong>
        </header>
        <p class="team-visual__description">${metric.description}</p>
        <div class="team-visual__meter" role="presentation">
          <div class="team-visual__meter-track"></div>
          <div class="team-visual__meter-fill" style="--fill:${(progress * 100).toFixed(1)}%"></div>
        </div>
        <dl class="team-visual__range">
          <div>
            <dt>League low</dt>
            <dd>${metric.format(extent?.min ?? value)}</dd>
          </div>
          <div>
            <dt>League high</dt>
            <dd>${metric.format(extent?.max ?? value)}</dd>
          </div>
        </dl>
      `;
      detailVisuals.append(card);
    });
  }
}

function handleMarkerClick(event) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) {
    return;
  }
  const abbreviation = button.dataset.team;
  if (!abbreviation || activeTeamId === abbreviation) {
    return;
  }
  const team = teamLookup.get(abbreviation);
  if (!team) {
    return;
  }
  activeTeamId = abbreviation;
  activateMarker(abbreviation);
  renderDetail(team);
}

function buildMarkers(teams) {
  if (!mapCanvas) return;

  const viewport = getMapViewport();
  if (!viewport) {
    return;
  }

  const existingLayers = viewport.querySelectorAll('.team-map__markers');
  existingLayers.forEach((layer) => layer.remove());

  const markerLayer = document.createElement('div');
  markerLayer.className = 'team-map__markers';
  viewport.append(markerLayer);

  markerButtons = teams.map((team) => {
    const { latitude, longitude, abbreviation, conference, name } = team;
    const { x, y } = projectCoordinates(latitude, longitude);
    const button = document.createElement('button');
    button.type = 'button';
    const markerTheme = CONFERENCE_CLASSES[conference] ?? (currentMode === 'inactive' ? 'inactive' : 'east');
    button.className = `team-marker team-marker--${markerTheme}`;
    button.style.setProperty('--marker-x', `${(x / MAP_WIDTH) * 100}%`);
    button.style.setProperty('--marker-y', `${(y / MAP_HEIGHT) * 100}%`);
    button.dataset.team = abbreviation;
    const ariaLabelParts = [name];
    if (conference) {
      ariaLabelParts.push(`${conference} Conference`);
    }
    if (currentMode === 'inactive') {
      ariaLabelParts.push('inactive franchise');
    }
    button.setAttribute('aria-label', ariaLabelParts.join(', '));
    button.innerHTML = `
      <span class="team-marker__dot" aria-hidden="true"></span>
      <span class="team-marker__label">${abbreviation}</span>
    `;
    button.addEventListener('click', handleMarkerClick);
    markerLayer.append(button);
    return button;
  });
}

function computeExtents(teams) {
  metricExtents = METRIC_CONFIG.reduce((acc, metric) => {
    const values = teams
      .map((team) => team.metrics?.[metric.key])
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      acc[metric.key] = { min: 0, max: 1, values: [] };
      return acc;
    }
    const sorted = [...values].sort((a, b) => a - b);
    acc[metric.key] = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      values: sorted,
    };
    return acc;
  }, {});
}

function computeLegacyExtents(teams) {
  legacyExtents = LEGACY_METRICS.reduce((acc, metric) => {
    const values = teams
      .map((team) => (metric.valueAccessor ? metric.valueAccessor(team) : null))
      .filter((value) => Number.isFinite(value));
    if (!values.length) {
      acc[metric.key] = { min: 0, max: 1, values: [] };
      return acc;
    }
    const sorted = [...values].sort((a, b) => a - b);
    acc[metric.key] = {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      values: sorted,
    };
    return acc;
  }, {});
}

function injectMap(svgMarkup) {
  if (!mapCanvas) return;
  const sanitized = svgMarkup.replace(/ns0:/g, '');
  mapCanvas.innerHTML = `<div class="team-map__viewport"><div class="team-map__stage">${sanitized}</div></div>`;
  mapViewport = mapCanvas.querySelector('.team-map__viewport');
  const svg = mapCanvas.querySelector('svg');
  if (svg) {
    svg.classList.add('team-map__svg');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('aria-hidden', 'true');
    enhanceUsaInsets(svg);
  }
  if (mapViewport) {
    enablePanZoom(mapCanvas, mapViewport, { maxScale: 6, zoomStep: 0.4 });
  }
}

async function initialise() {
  if (!mapCanvas) return;
  try {
    if (detailPanel) {
      detailPanel.setAttribute('aria-busy', 'true');
    }
    const modeEntries = Object.entries(TEAM_MODE_CONFIG);
    const responses = await Promise.all([
      fetch('vendor/us-states.svg'),
      ...modeEntries.map(([, config]) => fetch(config.dataset)),
    ]);
    const [svgResponse, ...datasetResponses] = responses;
    if (!svgResponse.ok) {
      throw new Error('Unable to load base map');
    }
    const svgMarkup = await svgResponse.text();
    injectMap(svgMarkup);

    datasetStore.clear();
    const parseTasks = datasetResponses.map(async (response, index) => {
      const [mode, config] = modeEntries[index];
      if (!response.ok) {
        console.warn(`Failed to load dataset for ${mode} mode (${config.dataset})`);
        return;
      }
      try {
        const payload = await response.json();
        const teams = Array.isArray(payload?.teams) ? payload.teams : [];
        if (teams.length) {
          datasetStore.set(mode, {
            teams,
            season: payload?.season ?? '',
            generatedAt: payload?.generatedAt ?? '',
          });
        }
      } catch (parseError) {
        console.error(`Failed to parse dataset for ${mode} mode`, parseError);
      }
    });
    await Promise.all(parseTasks);

    if (!datasetStore.size) {
      throw new Error('No team data found');
    }

    if (!datasetStore.has(currentMode)) {
      const firstAvailable = datasetStore.keys().next().value;
      currentMode = firstAvailable;
    }

    applyMode(currentMode);

    if (detailPanel) {
      detailPanel.setAttribute('aria-busy', 'false');
    }
  } catch (error) {
    if (mapCanvas) {
      mapCanvas.innerHTML = '<p class="team-map__error">Unable to load the map experience right now. Please refresh to try again.</p>';
    }
    if (detailPanel) {
      detailPanel.setAttribute('aria-busy', 'false');
    }
    updateModeCopy(currentMode);
    renderFootprintRankings([], currentMode);
    renderFootprintMethodology(null, currentMode);
    console.error('Failed to initialise team explorer', error);
  }
}

initialise();
