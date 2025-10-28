import { bdl } from '../assets/js/bdl.js';
import { registerCharts, helpers } from './hub-charts.js';

const palette = {
  royal: '#1156d6',
  sky: '#1f7bff',
  gold: '#f4b53f',
  coral: '#ef3d5b',
  teal: '#11b5c6',
  violet: '#6c4fe0',
  lime: '#8fd43d',
  navy: '#0b2545',
};

const accents = [palette.royal, palette.gold, palette.coral, palette.violet, palette.teal, '#9050d8', palette.sky, '#f48fb1'];

const atlasMetricBlueprint = {
  'offensive-creation': {
    extract(context) {
      const value = context.components?.impact;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.impact;
      if (Number.isFinite(value)) {
        return `Impact pillar graded at ${helpers.formatNumber(value, 1)} GOAT points.`;
      }
      return 'Impact pillar percentile unavailable.';
    },
  },
  'half-court-shotmaking': {
    extract(context) {
      const value = context.components?.stage;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.stage;
      if (Number.isFinite(value)) {
        return `Stage pillar captures ${helpers.formatNumber(value, 1)} GOAT points of playoff shotmaking.`;
      }
      return 'Stage pillar percentile unavailable.';
    },
  },
  'passing-vision': {
    extract(context) {
      const value = context.components?.versatility;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.versatility;
      if (Number.isFinite(value)) {
        return `Versatility pillar logs ${helpers.formatNumber(value, 1)} GOAT points of creation.`;
      }
      return 'Versatility pillar percentile unavailable.';
    },
  },
  'rim-pressure': {
    extract(context) {
      const impact = context.components?.impact;
      const versatility = context.components?.versatility;
      if (Number.isFinite(impact) && Number.isFinite(versatility)) {
        return impact * 0.7 + versatility * 0.3;
      }
      if (Number.isFinite(impact)) {
        return impact;
      }
      if (Number.isFinite(versatility)) {
        return versatility;
      }
      return null;
    },
    describe(context) {
      const impact = Number.isFinite(context.components?.impact)
        ? helpers.formatNumber(context.components.impact, 1)
        : null;
      const versatility = Number.isFinite(context.components?.versatility)
        ? helpers.formatNumber(context.components.versatility, 1)
        : null;
      if (impact && versatility) {
        return `Blend of impact (${impact}) and versatility (${versatility}) GOAT points fuels rim pressure.`;
      }
      if (impact) {
        return `Impact pillar at ${impact} GOAT points drives rim pressure.`;
      }
      if (versatility) {
        return `Versatility pillar at ${versatility} GOAT points steadies rim pressure.`;
      }
      return 'Rim pressure percentile unavailable.';
    },
  },
  'rebound-dominance': {
    extract(context) {
      const impact = context.components?.impact;
      const longevity = context.components?.longevity;
      if (Number.isFinite(longevity) && Number.isFinite(impact)) {
        return longevity * 0.6 + impact * 0.4;
      }
      if (Number.isFinite(longevity)) {
        return longevity;
      }
      if (Number.isFinite(impact)) {
        return impact;
      }
      return null;
    },
    describe(context) {
      const impact = Number.isFinite(context.components?.impact)
        ? helpers.formatNumber(context.components.impact, 1)
        : null;
      const longevity = Number.isFinite(context.components?.longevity)
        ? helpers.formatNumber(context.components.longevity, 1)
        : null;
      if (longevity && impact) {
        return `Longevity (${longevity}) and impact (${impact}) GOAT scores anchor the glass profile.`;
      }
      if (longevity) {
        return `Longevity pillar at ${longevity} GOAT points highlights sustained board work.`;
      }
      if (impact) {
        return `Impact pillar at ${impact} GOAT points fuels board dominance.`;
      }
      return 'Rebound dominance percentile unavailable.';
    },
  },
  'defensive-playmaking': {
    extract(context) {
      const impact = context.components?.impact;
      const versatility = context.components?.versatility;
      if (Number.isFinite(impact) && Number.isFinite(versatility)) {
        return versatility * 0.6 + impact * 0.4;
      }
      if (Number.isFinite(versatility)) {
        return versatility;
      }
      if (Number.isFinite(impact)) {
        return impact;
      }
      return null;
    },
    describe(context) {
      const impact = Number.isFinite(context.components?.impact)
        ? helpers.formatNumber(context.components.impact, 1)
        : null;
      const versatility = Number.isFinite(context.components?.versatility)
        ? helpers.formatNumber(context.components.versatility, 1)
        : null;
      if (impact && versatility) {
        return `Versatility (${versatility}) and impact (${impact}) GOAT points shape defensive playmaking.`;
      }
      if (versatility) {
        return `Versatility pillar contributes ${versatility} GOAT points of defensive playmaking.`;
      }
      if (impact) {
        return `Impact pillar contributes ${impact} GOAT points of defensive playmaking.`;
      }
      return 'Defensive playmaking percentile unavailable.';
    },
  },
  'post-efficiency': {
    extract(context) {
      const value = context.components?.stage;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.stage;
      if (Number.isFinite(value)) {
        return `Stage pillar at ${helpers.formatNumber(value, 1)} GOAT points reflects postseason post craft.`;
      }
      return 'Post efficiency percentile unavailable.';
    },
  },
  'stretch-gravity': {
    extract(context) {
      const value = context.components?.versatility;
      return Number.isFinite(value) ? value : null;
    },
    describe(context) {
      const value = context.components?.versatility;
      if (Number.isFinite(value)) {
        return `Versatility pillar logged at ${helpers.formatNumber(value, 1)} GOAT points.`;
      }
      return 'Stretch gravity percentile unavailable.';
    },
  },
  'tempo-control': {
    extract(context) {
      const parts = [];
      if (Number.isFinite(context.components?.versatility)) {
        parts.push(context.components.versatility * 0.45);
      }
      if (Number.isFinite(context.components?.longevity)) {
        parts.push(context.components.longevity * 0.3);
      }
      if (Number.isFinite(context.winPct)) {
        parts.push(context.winPct * 40);
      }
      if (!parts.length) {
        return null;
      }
      return parts.reduce((sum, value) => sum + value, 0);
    },
    describe(context) {
      const winPct = Number.isFinite(context.winPct) ? helpers.formatNumber(context.winPct * 100, 1) : null;
      const versatility = Number.isFinite(context.components?.versatility)
        ? helpers.formatNumber(context.components.versatility, 1)
        : null;
      const longevity = Number.isFinite(context.components?.longevity)
        ? helpers.formatNumber(context.components.longevity, 1)
        : null;
      if (winPct && versatility && longevity) {
        return `Versatility (${versatility}) and longevity (${longevity}) GOAT points plus a ${winPct}% win rate steer tempo.`;
      }
      if (versatility && winPct) {
        return `Versatility pillar at ${versatility} GOAT points and a ${winPct}% win rate steer tempo.`;
      }
      if (longevity && winPct) {
        return `Longevity pillar at ${longevity} GOAT points with a ${winPct}% win rate steadies tempo.`;
      }
      if (versatility) {
        return `Versatility pillar at ${versatility} GOAT points anchors pace control.`;
      }
      if (longevity) {
        return `Longevity pillar at ${longevity} GOAT points anchors pace control.`;
      }
      if (winPct) {
        return `Career win rate of ${winPct}% keeps possessions in command.`;
      }
      return 'Tempo control percentile unavailable.';
    },
  },
  'clutch-index': {
    extract(context) {
      const stage = Number.isFinite(context.components?.stage) ? context.components.stage : null;
      const playoff = Number.isFinite(context.playoffWinPct) ? context.playoffWinPct * 40 : null;
      if (stage !== null && playoff !== null) {
        return stage * 0.55 + playoff;
      }
      if (stage !== null) {
        return stage;
      }
      if (playoff !== null) {
        return playoff;
      }
      return null;
    },
    describe(context) {
      const stage = Number.isFinite(context.components?.stage)
        ? helpers.formatNumber(context.components.stage, 1)
        : null;
      const playoff = Number.isFinite(context.playoffWinPct)
        ? helpers.formatNumber(context.playoffWinPct * 100, 1)
        : null;
      if (stage && playoff) {
        return `Stage pillar (${stage}) and ${playoff}% playoff win clip highlight clutch DNA.`;
      }
      if (stage) {
        return `Stage pillar at ${stage} GOAT points drives late-game shotmaking.`;
      }
      if (playoff) {
        return `Playoff win rate of ${playoff}% underscores clutch pedigree.`;
      }
      return 'Clutch index percentile unavailable.';
    },
  },
  'durability-index': {
    extract(context) {
      const longevity = Number.isFinite(context.components?.longevity) ? context.components.longevity : null;
      const seasons = Number.isFinite(context.careerSeasons) ? context.careerSeasons : null;
      if (longevity !== null && seasons !== null) {
        return longevity * 0.6 + seasons * 0.4;
      }
      if (longevity !== null) {
        return longevity;
      }
      if (seasons !== null) {
        return seasons;
      }
      return null;
    },
    describe(context) {
      const longevity = Number.isFinite(context.components?.longevity)
        ? helpers.formatNumber(context.components.longevity, 1)
        : null;
      const seasons = Number.isFinite(context.careerSeasons)
        ? helpers.formatNumber(context.careerSeasons, 0)
        : null;
      if (longevity && seasons) {
        return `Longevity (${longevity}) GOAT points across ${seasons} seasons underline availability.`;
      }
      if (longevity) {
        return `Longevity pillar at ${longevity} GOAT points tracks the mileage.`;
      }
      if (seasons) {
        return `${seasons} seasons logged keep durability near the top of the class.`;
      }
      return 'Durability percentile unavailable.';
    },
  },
  'processing-speed': {
    extract(context) {
      const versatility = Number.isFinite(context.components?.versatility) ? context.components.versatility : null;
      const impact = Number.isFinite(context.components?.impact) ? context.components.impact : null;
      const delta = Number.isFinite(context.delta) ? context.delta : null;
      if (versatility === null && impact === null && delta === null) {
        return null;
      }
      const base = (versatility ?? 0) * 0.5 + (impact ?? 0) * 0.35;
      const momentum = delta !== null ? (delta + 5) * 2 : 0;
      const total = base + momentum;
      return total || base || momentum || null;
    },
    describe(context) {
      const versatility = Number.isFinite(context.components?.versatility)
        ? helpers.formatNumber(context.components.versatility, 1)
        : null;
      const delta = Number.isFinite(context.delta) ? helpers.formatNumber(context.delta, 1) : null;
      if (versatility && delta) {
        return `Versatility (${versatility}) GOAT points and a ${delta} season delta speed up reads.`;
      }
      if (versatility) {
        return `Versatility pillar at ${versatility} GOAT points captures processing feel.`;
      }
      if (delta) {
        return `Season-over-season delta of ${delta} fuels processing momentum.`;
      }
      return 'Processing speed percentile unavailable.';
    },
  },
};

function createVerticalGradient(context, stops) {
  const { chart } = context;
  const { ctx, chartArea } = chart || {};
  if (!ctx || !chartArea) {
    return stops?.[0] ?? palette.sky;
  }
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  const colorStops = Array.isArray(stops) && stops.length ? stops : [palette.sky, 'rgba(31, 123, 255, 0.05)'];
  const step = 1 / Math.max(colorStops.length - 1, 1);
  colorStops.forEach((color, index) => {
    gradient.addColorStop(Math.min(index * step, 1), color);
  });
  return gradient;
}

function normalizeName(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseGeneratedAtTimestamp(source) {
  if (!source) {
    return null;
  }
  const raw = typeof source === 'object' ? source.generatedAt : source;
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function mergeGoatHistoricalSources(systemData, indexData) {
  const systemPlayers = Array.isArray(systemData?.players) ? systemData.players : [];
  const indexPlayers = Array.isArray(indexData?.players) ? indexData.players : [];

  if (!systemPlayers.length && !indexPlayers.length) {
    return { players: [] };
  }

  if (!indexPlayers.length) {
    return systemData ?? { players: systemPlayers };
  }

  const systemByName = new Map();
  systemPlayers.forEach((player) => {
    if (!player || typeof player !== 'object') {
      return;
    }
    const nameKey = normalizeName(player.name);
    if (nameKey) {
      systemByName.set(nameKey, player);
    }
  });

  const seenNames = new Set();
  const mergedPlayers = indexPlayers
    .filter((player) => player && typeof player === 'object')
    .map((player) => {
      const nameKey = normalizeName(player.name);
      if (nameKey) {
        seenNames.add(nameKey);
      }
      const fallback = nameKey ? systemByName.get(nameKey) : null;
      const merged = { ...player };
      if ((merged.personId === null || merged.personId === undefined) && fallback?.personId) {
        merged.personId = fallback.personId;
      }
      if (!merged.resume && fallback?.resume) {
        merged.resume = fallback.resume;
      }
      if (!merged.tier && fallback?.tier) {
        merged.tier = fallback.tier;
      }
      if (!Array.isArray(merged.franchises) && Array.isArray(fallback?.franchises)) {
        merged.franchises = fallback.franchises;
      }
      if (merged.delta === undefined && fallback?.delta !== undefined) {
        merged.delta = fallback.delta;
      }
      return merged;
    });

  systemPlayers.forEach((player) => {
    if (!player || typeof player !== 'object') {
      return;
    }
    const nameKey = normalizeName(player.name);
    if (!nameKey || seenNames.has(nameKey)) {
      return;
    }
    mergedPlayers.push(player);
    seenNames.add(nameKey);
  });

  const timestamps = [parseGeneratedAtTimestamp(indexData), parseGeneratedAtTimestamp(systemData)].filter((value) =>
    Number.isFinite(value),
  );
  let generatedAt = indexData?.generatedAt ?? systemData?.generatedAt;
  if (timestamps.length) {
    generatedAt = new Date(Math.max(...timestamps)).toISOString();
  }

  return {
    ...(systemData || {}),
    ...(indexData || {}),
    generatedAt,
    players: mergedPlayers,
  };
}

function renderRecentLeaderboard(records, listElement, placeholderElement) {
  if (!listElement) {
    return;
  }

  listElement.innerHTML = '';

  if (!Array.isArray(records) || !records.length) {
    listElement.hidden = true;
    if (placeholderElement) {
      placeholderElement.hidden = false;
    }
    return;
  }

  listElement.hidden = false;
  if (placeholderElement) {
    placeholderElement.hidden = true;
  }

  records.slice(0, 25).forEach((player) => {
    const item = document.createElement('li');
    item.className = 'players-rankings__item';

    const rank = document.createElement('span');
    rank.className = 'players-rankings__rank';
    rank.textContent = Number.isFinite(player?.rank) ? player.rank : '—';

    const body = document.createElement('div');
    body.className = 'players-rankings__body';

    const title = document.createElement('strong');
    const displayName = player?.displayName || player?.name || '—';
    const team = player?.team;
    title.textContent = team ? `${displayName} — ${team}` : displayName;

    const note = document.createElement('span');
    note.textContent = player?.blurb || '';

    const totalsSpecs = [
      ['points', 'pts'],
      ['assists', 'ast'],
      ['rebounds', 'reb'],
      ['blocks', 'blk'],
    ];
    const totalsParts = totalsSpecs
      .map(([key, label]) => {
        const value = Number.isFinite(player?.[key]) ? player[key] : null;
        if (value === null) {
          return null;
        }
        return `${helpers.formatNumber(value, 0)} ${label}`;
      })
      .filter(Boolean);

    body.append(title, note);
    if (totalsParts.length) {
      const totals = document.createElement('span');
      totals.className = 'players-rankings__totals';
      totals.textContent = totalsParts.join(' · ');
      body.appendChild(totals);
    }
    item.append(rank, body);
    listElement.appendChild(item);
  });
}

registerCharts([
  {
    element: document.querySelector('[data-chart="league-heights"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const buckets = Array.isArray(data?.heightBuckets) ? data.heightBuckets : [];
      if (!buckets.length) return null;
      const labels = buckets.map((bucket) => bucket.label);
      const totals = buckets.map((bucket) => bucket.players);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Players',
              data: totals,
              fill: true,
              borderColor: palette.royal,
              backgroundColor: (context) =>
                createVerticalGradient(context, ['rgba(17, 86, 214, 0.45)', 'rgba(17, 86, 214, 0.05)']),
              tension: 0.32,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderWidth: 2.5,
            },
          ],
        },
        options: {
          layout: { padding: { left: 4, right: 4, top: 8, bottom: 12 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.y, 0)} players`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { maxRotation: 0, autoSkipPadding: 10 },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 0)}`,
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="tallest-bubbles"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const players = Array.isArray(data?.tallestPlayers) ? data.tallestPlayers : [];
      if (!players.length) return null;
      const weighted = players.filter((player) => Number.isFinite(player?.weightPounds));
      const fallbackWeight = weighted.length
        ? weighted.reduce((sum, player) => sum + player.weightPounds, 0) / weighted.length
        : 280;

      const formatHeightLabel = (value) => {
        if (!Number.isFinite(value)) {
          return '';
        }
        const feet = Math.floor(value / 12);
        const remainder = value - feet * 12;
        const rounded = Math.round(remainder * 10) / 10;
        const wholeInches = Math.round(rounded);
        const displayInches = Math.abs(rounded - wholeInches) < 0.05
          ? helpers.formatNumber(wholeInches, 0)
          : helpers.formatNumber(rounded, 1);
        return `${helpers.formatNumber(feet, 0)}' ${displayInches}"`;
      };

      const dataset = players.map((player, index) => {
        const height = Number.isFinite(player?.heightInches) ? player.heightInches : null;
        if (!height) {
          return null;
        }
        const listedWeight = Number.isFinite(player?.weightPounds) ? player.weightPounds : null;
        const weight = listedWeight ?? fallbackWeight;
        return {
          x: height,
          y: weight,
          r: Math.max(7, Math.sqrt(Math.max(weight - 200, 30)) * 1.4),
          player,
          listedWeight,
          formattedHeight: formatHeightLabel(height),
          backgroundColor: accents[index % accents.length],
        };
      });

      const points = dataset.filter(Boolean);
      if (!points.length) return null;

      const heights = points.map((point) => point.x);
      const weights = points.map((point) => point.y);
      const minHeight = Math.min(...heights);
      const maxHeight = Math.max(...heights);
      const minWeight = Math.min(...weights);
      const maxWeight = Math.max(...weights);
      const xMin = Math.max(80, Math.floor(minHeight - 1));
      const xMax = Math.min(100, Math.ceil(maxHeight + 1));
      const yMin = Math.max(160, Math.floor(minWeight - 15));
      const yMax = Math.min(440, Math.ceil(maxWeight + 15));

      return {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Height vs weight',
              data: points,
              parsing: false,
              backgroundColor: points.map((point) => point.backgroundColor),
              borderColor: 'rgba(11, 37, 69, 0.2)',
              borderWidth: 1,
              hoverBorderWidth: 2,
            },
          ],
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const { player, listedWeight, formattedHeight } = context.raw || {};
                  if (!player) return null;
                  const height = formattedHeight || `${helpers.formatNumber(player.heightInches, 0)}"`;
                  const weightText = listedWeight
                    ? `${helpers.formatNumber(listedWeight, 0)} lbs`
                    : 'weight not listed';
                  return `${player.name} · ${height} · ${weightText}`;
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Height (inches)' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              min: xMin,
              max: xMax,
            },
            y: {
              title: { display: true, text: 'Weight (pounds)' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              suggestedMin: yMin,
              suggestedMax: yMax,
              ticks: {
                callback: (value) => `${helpers.formatNumber(value, 0)}`,
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="team-height-averages"]'),
    source: 'data/rosters.json',
    async createConfig(data) {
      const teams = Array.isArray(data?.teams) ? data.teams : [];
      if (!teams.length) return null;

      const parseHeightInches = (value) => {
        if (typeof value !== 'string') {
          return null;
        }
        const trimmed = value.trim();
        const match = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
        if (!match) {
          return null;
        }
        const feet = Number.parseInt(match[1], 10);
        const inches = Number.parseInt(match[2], 10);
        if (!Number.isFinite(feet) || !Number.isFinite(inches)) {
          return null;
        }
        const total = feet * 12 + inches;
        return total >= 50 ? total : null;
      };

      const formatHeight = (inches) => {
        if (!Number.isFinite(inches)) {
          return '';
        }
        const feet = Math.floor(inches / 12);
        const remainder = inches - feet * 12;
        const rounded = Math.round(remainder * 10) / 10;
        const wholeInches = Math.round(rounded);
        const displayInches = Math.abs(rounded - wholeInches) < 0.05
          ? helpers.formatNumber(wholeInches, 0)
          : helpers.formatNumber(rounded, 1);
        return `${helpers.formatNumber(feet, 0)}' ${displayInches}"`;
      };

      const prepared = teams
        .map((team) => {
          const roster = Array.isArray(team?.roster) ? team.roster : [];
          const measurements = roster
            .map((member) => parseHeightInches(member?.height))
            .filter((value) => Number.isFinite(value));
          const sampleSize = measurements.length;
          if (!sampleSize) {
            return null;
          }
          const total = measurements.reduce((sum, value) => sum + value, 0);
          const average = total / sampleSize;
          return {
            label: team?.abbreviation || team?.full_name || 'Team',
            teamName: team?.full_name || team?.abbreviation || 'Team',
            average,
            sampleSize,
            totalRoster: roster.length,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.average - b.average);

      if (!prepared.length) {
        return null;
      }

      const labels = prepared.map((entry) => entry.label);
      const rawAverages = prepared.map((entry) => entry.average);
      const averages = rawAverages.map((value) => Number.parseFloat(value.toFixed(2)));
      const minAverage = Math.min(...averages);
      const maxAverage = Math.max(...averages);
      let domainMin = minAverage;
      let domainMax = maxAverage;
      if (domainMin === domainMax) {
        domainMin = Math.max(0, Number.parseFloat((domainMin - 1).toFixed(2)));
        domainMax = Number.parseFloat((domainMax + 1).toFixed(2));
      }

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Average roster height (inches)',
              data: averages,
              backgroundColor: (context) =>
                createVerticalGradient(context, ['rgba(108, 79, 224, 0.55)', 'rgba(108, 79, 224, 0.08)']),
              borderColor: 'rgba(108, 79, 224, 0.6)',
              borderWidth: 1.5,
              hoverBackgroundColor: 'rgba(108, 79, 224, 0.72)',
              maxBarThickness: 22,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 12, bottom: 12, left: 12, right: 16 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title(contexts) {
                  if (!Array.isArray(contexts) || !contexts.length) {
                    return '';
                  }
                  const { dataIndex } = contexts[0];
                  const entry = prepared[dataIndex];
                  return entry?.teamName ?? contexts[0].label ?? '';
                },
                label(context) {
                  const entry = prepared[context.dataIndex];
                  if (!entry) {
                    return null;
                  }
                  const averageText = formatHeight(entry.average);
                  const sampleText =
                    entry.sampleSize === entry.totalRoster || !entry.totalRoster
                      ? `${helpers.formatNumber(entry.sampleSize, 0)} players`
                      : `${helpers.formatNumber(entry.sampleSize, 0)} of ${helpers.formatNumber(entry.totalRoster, 0)} players`;
                  return `Avg height: ${averageText} · ${sampleText}`;
                },
              },
              displayColors: false,
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              title: { display: true, text: 'Average listed height' },
              min: domainMin,
              max: domainMax,
              ticks: {
                includeBounds: true,
                callback: (value) => {
                  const numeric = typeof value === 'number' ? value : Number.parseFloat(value);
                  return formatHeight(numeric);
                },
              },
            },
            y: {
              grid: { display: false },
              ticks: { autoSkip: false },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="country-spectrum"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const allCountries = Array.isArray(data?.countries) ? data.countries : [];
      const international = allCountries.filter((entry) => (entry?.country || '').toLowerCase() !== 'usa');
      const countries = helpers.rankAndSlice(international, 7, (item) => item.players);
      if (!countries.length) return null;

      return {
        type: 'polarArea',
        data: {
          labels: countries.map((country) => country.country),
          datasets: [
            {
              data: countries.map((country) => country.players),
              backgroundColor: countries.map((_, index) => accents[index % accents.length]),
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.6)',
            },
          ],
        },
        options: {
          scales: {
            r: {
              ticks: { display: false },
              grid: { color: 'rgba(11, 37, 69, 0.12)' },
            },
          },
          plugins: {
            legend: { position: 'right' },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed, 0)} players`;
                },
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="college-pipeline"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const colleges = helpers.rankAndSlice(Array.isArray(data?.colleges) ? data.colleges : [], 8, (item) => item.players);
      if (!colleges.length) return null;
      const labels = colleges.map((college) => college.program);
      const totals = colleges.map((college) => college.players);

      return {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Players',
              data: totals,
              borderRadius: 12,
              borderSkipped: false,
              backgroundColor: (context) =>
                createVerticalGradient(context, ['rgba(244, 181, 63, 0.75)', 'rgba(239, 61, 91, 0.35)']),
            },
          ],
        },
        options: {
          indexAxis: 'y',
          layout: { padding: { top: 6, bottom: 6, left: 4, right: 4 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.x, 0)} players`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
              },
            },
            y: {
              grid: { display: false },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="draft-timeline"]'),
    source: 'data/players_overview.json',
    async createConfig(data) {
      const decadeCounts = Array.isArray(data?.draftSummary?.decadeCounts)
        ? data.draftSummary.decadeCounts.filter((entry) => /\d{4}s/.test(entry.decade))
        : [];
      if (!decadeCounts.length) return null;
      const trimmed = helpers.evenSample(decadeCounts, 16);
      const labels = trimmed.map((entry) => entry.decade);
      const drafted = trimmed.map((entry) => entry.players);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Drafted players',
              data: drafted,
              fill: true,
              borderColor: palette.teal,
              backgroundColor: (context) =>
                createVerticalGradient(context, ['rgba(17, 181, 198, 0.45)', 'rgba(17, 181, 198, 0.05)']),
              tension: 0.28,
              pointRadius: 3,
              pointHoverRadius: 6,
            },
          ],
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.label}: ${helpers.formatNumber(context.parsed.y, 0)} draft picks`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.1)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="season-trends"]'),
    source: 'data/player_season_insights.json',
    async createConfig(data) {
      const seasons = Array.isArray(data?.seasonTrends) ? data.seasonTrends : [];
      if (!seasons.length) return null;
      const labels = seasons.map((entry) => entry.season);
      const points = seasons.map((entry) => entry.avgPoints ?? 0);
      const assists = seasons.map((entry) => entry.avgAssists ?? 0);
      const rebounds = seasons.map((entry) => entry.avgRebounds ?? 0);

      return {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Points per game',
              data: points,
              borderColor: palette.coral,
              backgroundColor: 'rgba(239, 61, 91, 0.08)',
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 3,
            },
            {
              label: 'Assists per game',
              data: assists,
              borderColor: palette.sky,
              backgroundColor: 'rgba(31, 123, 255, 0.08)',
              tension: 0.3,
              borderDash: [6, 4],
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 3,
            },
            {
              label: 'Rebounds per game',
              data: rebounds,
              borderColor: palette.gold,
              backgroundColor: 'rgba(244, 181, 63, 0.12)',
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 3,
            },
          ],
        },
        options: {
          interaction: { mode: 'index', intersect: false },
          plugins: {
            tooltip: {
              callbacks: {
                title(contexts) {
                  if (!contexts?.length) return '';
                  return `Season ${contexts[0].label}`;
                },
                label(context) {
                  return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.y, 2)}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(11, 37, 69, 0.05)' },
              ticks: {
                maxRotation: 0,
                callback(value, index, values) {
                  const label = labels[index];
                  return index % 5 === 0 ? label : '';
                },
              },
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="triple-double-cloud"]'),
    source: 'data/player_season_insights.json',
    async createConfig(data) {
      const leaderSeries = Array.isArray(data?.tripleDoubleLeaders) ? data.tripleDoubleLeaders : [];
      const leaders = [...leaderSeries].sort((a, b) => (b?.tripleDoubles ?? 0) - (a?.tripleDoubles ?? 0));
      if (!leaders.length) return null;

      const points = leaders.map((leader, index) => {
        const start = Number.isFinite(leader?.careerSpan?.start) ? leader.careerSpan.start : leader?.bestSeason?.season;
        const end = Number.isFinite(leader?.careerSpan?.end) ? leader.careerSpan.end : leader?.bestSeason?.season;
        const midpoint = Number.isFinite(start) && Number.isFinite(end) ? (start + end) / 2 : start ?? end;
        return {
          x: midpoint,
          y: leader.tripleDoubles ?? 0,
          r: Math.max(9, Math.sqrt(leader.seasonsWithTripleDouble ?? 1) * 4.2),
          leader,
          backgroundColor: accents[index % accents.length],
        };
      });

      return {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Career triple-doubles',
              data: points,
              parsing: false,
              backgroundColor: points.map((point) => point.backgroundColor),
              borderColor: 'rgba(11, 37, 69, 0.2)',
              borderWidth: 1,
            },
          ],
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const { leader } = context.raw || {};
                  if (!leader) return null;
                  const seasons = leader.seasonsWithTripleDouble ?? 0;
                  const spanStart = leader?.careerSpan?.start;
                  const spanEnd = leader?.careerSpan?.end;
                  const spanText = spanStart && spanEnd ? `${spanStart}–${spanEnd}` : leader?.bestSeason?.season;
                  return `${leader.name}: ${helpers.formatNumber(leader.tripleDoubles ?? 0, 0)} triple-doubles · ${helpers.formatNumber(seasons, 0)} seasons · ${spanText}`;
                },
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              title: { display: true, text: 'Career span midpoint' },
              grid: { color: 'rgba(11, 37, 69, 0.06)' },
              suggestedMin: 1955,
              suggestedMax: 2030,
            },
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Total triple-doubles' },
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
              ticks: {
                callback: (value) => helpers.formatNumber(value, 0),
              },
            },
          },
        },
      };
    },
  },
  {
    element: document.querySelector('[data-chart="scoring-eruptions"]'),
    source: 'data/player_leaders.json',
    async createConfig(data) {
      const topGames = Array.isArray(data?.singleGameHighs?.points) ? data.singleGameHighs.points : [];
      const buildGameKey = (entry) => {
        if (!entry || typeof entry !== 'object') return '';
        const person = entry.personId ?? entry.name ?? '';
        const gameId = entry.gameId ?? '';
        const date = entry.gameDate ?? '';
        return `${person}::${gameId || date}`;
      };
      const highlightColors = new Map(
        topGames.map((game, index) => [buildGameKey(game), accents[index % accents.length]])
      );
      const gamesSource = Array.isArray(data?.singleGameHighs?.points50Plus)
        ? data.singleGameHighs.points50Plus
        : topGames;
      const games = [...gamesSource].sort((a, b) => (b?.points ?? 0) - (a?.points ?? 0));
      if (!games.length) return null;
      const baseColor = 'rgba(31, 123, 255, 0.32)';
      const defaultBorder = 'rgba(11, 37, 69, 0.12)';
      const highlightBorder = 'rgba(11, 37, 69, 0.3)';
      const points = games.map((game) => {
        const rebounds = Number.isFinite(game?.rebounds) ? game.rebounds : 0;
        const assists = Number.isFinite(game?.assists) ? game.assists : 0;
        const key = buildGameKey(game);
        const accentColor = highlightColors.get(key);
        const highlight = Boolean(accentColor);
        const baseRadius = Math.sqrt(rebounds + assists + 1);
        return {
          x: Number(game?.minutes) || 0,
          y: Number(game?.points) || 0,
          radius: Math.max(highlight ? 6 : 4, baseRadius * (highlight ? 2.4 : 1.6)),
          highlight,
          game,
          backgroundColor: accentColor ?? baseColor,
          borderColor: highlight ? highlightBorder : defaultBorder,
        };
      });

      return {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: '50+ point games',
              data: points,
              parsing: false,
              pointBackgroundColor: (context) => context.raw?.backgroundColor ?? baseColor,
              pointBorderColor: (context) => context.raw?.borderColor ?? defaultBorder,
              pointBorderWidth: (context) => (context.raw?.highlight ? 1.6 : 0.8),
              pointHoverBorderWidth: 2,
              pointRadius: (context) => context.raw?.radius ?? 4,
              pointHoverRadius: (context) => {
                const base = context.raw?.radius ?? 4;
                return Math.max(base + 2, base * 1.15);
              },
            },
          ],
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  const { game } = context.raw || {};
                  if (!game) return null;
                  const rebounds = helpers.formatNumber(game.rebounds ?? 0, 0);
                  const assists = helpers.formatNumber(game.assists ?? 0, 0);
                  const minutes = helpers.formatNumber(game.minutes ?? 0, 0);
                  const date = game.gameDate ? new Date(game.gameDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date';
                  return `${game.name} · ${helpers.formatNumber(game.points ?? 0, 0)} pts · ${rebounds} reb · ${assists} ast · ${minutes} min (${date})`;
                },
              },
            },
          },
          scales: {
            x: {
              title: { display: true, text: 'Minutes played' },
              grid: { color: 'rgba(11, 37, 69, 0.05)' },
            },
            y: {
              title: { display: true, text: 'Points scored' },
              beginAtZero: false,
              suggestedMin: 40,
              suggestedMax: 110,
              grid: { color: 'rgba(11, 37, 69, 0.08)' },
            },
          },
        },
      };
    },
  },
]);

function formatPercentile(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const rounded = Math.max(0, Math.min(100, Math.round(value)));
  const teens = rounded % 100;
  if (teens >= 11 && teens <= 13) {
    return `${rounded}th`;
  }
  const last = rounded % 10;
  if (last === 1) return `${rounded}st`;
  if (last === 2) return `${rounded}nd`;
  if (last === 3) return `${rounded}rd`;
  return `${rounded}th`;
}

function simplifyText(value) {
  if (!value) return '';
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildPlayerTokens(player) {
  const tokens = new Set();
  const push = (text) => {
    const simplified = simplifyText(text);
    if (!simplified) return;
    tokens.add(simplified);
    simplified
      .split(/\s+/)
      .filter(Boolean)
      .forEach((part) => tokens.add(part));
  };
  push(player?.name);
  push(player?.team);
  push(player?.teamAbbr);
  push(player?.position);
  push(player?.era);
  push(player?.origin);
  push(player?.archetype);
  push(player?.nickname);
  const addJerseyTokens = (value) => {
    if (value === null || value === undefined) {
      return;
    }
    const raw = String(value).trim();
    if (!raw) {
      return;
    }
    push(raw);
    if (raw.startsWith('#')) {
      push(raw.replace(/^#/, ''));
    } else {
      push(`#${raw}`);
    }
  };
  if (player?.bdl) {
    push(player.bdl.teamName);
    push(player.bdl.teamAbbr);
    push(player.bdl.position);
    addJerseyTokens(player.bdl.jersey);
  }
  addJerseyTokens(player?.jerseyNumber);
  if (Array.isArray(player?.keywords)) {
    player.keywords.forEach(push);
  }
  return Array.from(tokens);
}

function createPlayerSearchEngine() {
  let records = [];
  const tokenIndex = new Map();
  const prefixIndex = new Map();

  const registerToken = (token, record) => {
    if (!token) {
      return;
    }
    if (!tokenIndex.has(token)) {
      tokenIndex.set(token, new Set());
    }
    tokenIndex.get(token).add(record);
    const limit = Math.min(3, token.length);
    for (let length = 1; length <= limit; length += 1) {
      const prefix = token.slice(0, length);
      if (!prefixIndex.has(prefix)) {
        prefixIndex.set(prefix, new Set());
      }
      prefixIndex.get(prefix).add(record);
    }
  };

  const clear = () => {
    records = [];
    tokenIndex.clear();
    prefixIndex.clear();
  };

  const gatherMatchesForTerm = (term) => {
    const candidates = new Set();
    const exactMatches = tokenIndex.get(term);
    if (exactMatches) {
      exactMatches.forEach((record) => candidates.add(record));
    }
    const prefixKey = term.slice(0, Math.min(3, term.length));
    if (prefixKey) {
      const prefixMatches = prefixIndex.get(prefixKey);
      if (prefixMatches) {
        prefixMatches.forEach((record) => {
          if (
            (record.nameToken && record.nameToken.startsWith(term)) ||
            record.tokens.some((token) => token.startsWith(term))
          ) {
            candidates.add(record);
          }
        });
      }
    }
    return candidates;
  };

  return {
    clear,
    setPlayers: (players) => {
      clear();
      if (!Array.isArray(players) || !players.length) {
        return;
      }
      players.forEach((player) => {
        const id = player?.id !== undefined && player?.id !== null ? String(player.id) : null;
        if (!id) {
          return;
        }
        const nameToken = simplifyText(player?.name);
        const normalizedTokens = Array.isArray(player?.searchTokens)
          ? Array.from(
              new Set(
                player.searchTokens
                  .map((token) => simplifyText(token))
                  .filter((token) => Boolean(token) && token !== nameToken),
              ),
            )
          : [];
        const record = {
          id,
          player,
          nameToken,
          tokens: normalizedTokens,
        };
        records.push(record);
        if (nameToken) {
          registerToken(nameToken, record);
        }
        normalizedTokens.forEach((token) => registerToken(token, record));
      });
    },
    search: (query, limit = 8) => {
      if (!records.length) {
        return [];
      }
      const normalized = simplifyText(query);
      if (!normalized) {
        return [];
      }
      const terms = normalized.split(/\s+/).filter(Boolean);
      if (!terms.length) {
        return [];
      }

      let candidateSet = null;
      for (const term of terms) {
        const matches = gatherMatchesForTerm(term);
        if (!matches.size) {
          candidateSet = new Set();
          break;
        }
        if (candidateSet === null) {
          candidateSet = matches;
        } else {
          const intersection = new Set();
          matches.forEach((record) => {
            if (candidateSet.has(record)) {
              intersection.add(record);
            }
          });
          candidateSet = intersection;
          if (!candidateSet.size) {
            break;
          }
        }
      }

      if (!candidateSet) {
        candidateSet = new Set(records);
      }
      if (!candidateSet.size) {
        return [];
      }

      return Array.from(candidateSet)
        .map((record) => {
          let score = 0;
          if (record.nameToken && record.nameToken.startsWith(normalized)) {
            score += 6;
          }
          if (record.nameToken && record.nameToken === normalized) {
            score += 12;
          }
          terms.forEach((term) => {
            if (record.nameToken && record.nameToken === term) {
              score += 6;
            } else if (record.nameToken && record.nameToken.startsWith(term)) {
              score += 4;
            }
            record.tokens.forEach((token) => {
              if (token === term) {
                score += 5;
              } else if (token.startsWith(term)) {
                score += 3;
              } else if (token.includes(term)) {
                score += 1;
              }
            });
          });
          return { player: record.player, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return a.player.name.localeCompare(b.player.name);
        })
        .slice(0, limit)
        .map((entry) => entry.player);
    },
  };
}

function extractPersonIdFromProfile(player) {
  if (!player) return null;
  const rawId = typeof player.id === 'string' ? player.id : null;
  if (rawId) {
    const match = rawId.match(/(\d{4,})$/);
    if (match) {
      return match[1];
    }
  }
  if (Array.isArray(player.keywords)) {
    const keywordId = player.keywords.find((keyword) => /^(\d{4,})$/.test(keyword));
    if (keywordId) {
      return keywordId;
    }
  }
  return null;
}

function ensureSequentialRanks(records, rankKey = 'rank') {
  if (!Array.isArray(records) || !records.length) {
    return;
  }

  const rankedEntries = records
    .map((record, index) => {
      if (!record || typeof record !== 'object') {
        return null;
      }
      const numericRank = Number(record[rankKey]);
      if (!Number.isFinite(numericRank)) {
        return null;
      }
      return { record, numericRank, index };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.numericRank !== b.numericRank) {
        return a.numericRank - b.numericRank;
      }
      return a.index - b.index;
    });

  rankedEntries.forEach((entry, offset) => {
    entry.record[rankKey] = offset + 1;
  });
}

function buildGoatScoreLookup(indexSource, recentSource) {
  if (Array.isArray(indexSource?.players)) {
    ensureSequentialRanks(indexSource.players, 'rank');
  }

  const byId = new Map();
  const byName = new Map();
  const entries = new Map();

  if (Array.isArray(indexSource?.players)) {
    indexSource.players.forEach((player) => {
      if (!player?.name) {
        return;
      }
      const nameKey = normalizeName(player.name);
      if (!nameKey) {
        return;
      }
      const entry = entries.get(nameKey) ?? { name: player.name, nameKey };
      if (player?.personId) {
        entry.personId = String(player.personId);
      }
      entry.historical = Number.isFinite(player.goatScore) ? player.goatScore : null;
      entry.historicalRank = Number.isFinite(player.rank) ? player.rank : null;
      entry.resume = player.resume ?? entry.resume;
      entry.tier = player.tier ?? entry.tier;
      entry.delta = Number.isFinite(player.delta) ? player.delta : entry.delta;
      entry.franchises = Array.isArray(player.franchises) ? player.franchises : entry.franchises;
      entries.set(nameKey, entry);
    });
  }

  let leaderboard = [];
  if (Array.isArray(recentSource?.players)) {
    leaderboard = recentSource.players
      .map((player) => {
        if (!player) {
          return null;
        }
        const nameKey = normalizeName(player.name);
        if (!nameKey) {
          return null;
        }
        const entry = entries.get(nameKey) ?? { name: player.name, nameKey };
        entry.personId = player.personId ?? entry.personId;
        entry.recent = Number.isFinite(player.score) ? player.score : null;
        entry.recentRank = Number.isFinite(player.rank) ? player.rank : null;
        entries.set(nameKey, entry);

        return {
          rank: Number.isFinite(player.rank) ? player.rank : null,
          name: player.name,
          displayName: player.displayName ?? player.name,
          team: player.team ?? null,
          franchise: player.franchise ?? null,
          blurb: player.blurb ?? '',
          score: Number.isFinite(player.score) ? player.score : null,
          personId: player.personId ?? null,
        };
      })
      .filter((player) => player && Number.isFinite(player.rank))
      .sort((a, b) => a.rank - b.rank);

    ensureSequentialRanks(leaderboard, 'rank');
  }

  entries.forEach((entry) => {
    if (entry.personId) {
      byId.set(entry.personId, entry);
    }
    if (entry.nameKey) {
      byName.set(entry.nameKey, entry);
    }
  });

  return { byId, byName, recent: leaderboard };
}

function parseSeasonRange(range) {
  if (typeof range !== 'string') {
    return null;
  }
  const match = range.match(/(\d{4})\s*-\s*(\d{4})/);
  if (!match) {
    return null;
  }
  const start = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[2], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null;
  }
  return end - start + 1;
}

function buildAtlasMetrics(catalog, goatSource) {
  const byId = new Map();
  const byName = new Map();

  if (!Array.isArray(catalog) || !catalog.length || !Array.isArray(goatSource?.players)) {
    return { byId, byName };
  }

  const metrics = catalog
    .map((metric) => {
      const config = atlasMetricBlueprint[metric.id];
      if (!config) {
        return null;
      }
      return { id: metric.id, config };
    })
    .filter(Boolean);

  if (!metrics.length) {
    return { byId, byName };
  }

  const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const rawBuckets = new Map();
  metrics.forEach((metric) => rawBuckets.set(metric.id, []));

  const playerRecords = [];

  goatSource.players.forEach((player) => {
    if (!player) return;
    const personId = player.personId ? String(player.personId) : null;
    const nameKey = normalizeName(player.name);
    const componentSource = player.goatComponents || {};
    const components = {};
    ['impact', 'stage', 'longevity', 'versatility'].forEach((key) => {
      const value = toNumber(componentSource[key]);
      if (value !== null) {
        components[key] = value;
      }
    });
    const context = {
      entry: player,
      components,
      winPct: toNumber(player.winPct),
      playoffWinPct: toNumber(player.playoffWinPct),
      delta: toNumber(player.delta),
      goatScore: toNumber(player.goatScore),
      careerSeasons: parseSeasonRange(player.careerSpan),
      primeSeasons: parseSeasonRange(player.primeWindow),
    };

    const rawMetrics = {};
    let hasMetric = false;
    metrics.forEach((metric) => {
      const raw = metric.config.extract(context);
      if (!Number.isFinite(raw)) {
        return;
      }
      hasMetric = true;
      rawMetrics[metric.id] = raw;
      rawBuckets.get(metric.id).push(raw);
    });

    if (!hasMetric) {
      return;
    }

    playerRecords.push({ personId, nameKey, context, rawMetrics });
  });

  const percentileTables = new Map();
  rawBuckets.forEach((values, metricId) => {
    if (!values.length) {
      percentileTables.set(metricId, new Map());
      return;
    }
    const sorted = values.slice().sort((a, b) => a - b);
    const groups = new Map();
    sorted.forEach((value, index) => {
      if (!groups.has(value)) {
        groups.set(value, []);
      }
      groups.get(value).push(index);
    });
    const mapping = new Map();
    groups.forEach((indexes, value) => {
      const average = indexes.reduce((sum, item) => sum + item, 0) / indexes.length;
      const percentile = sorted.length > 1 ? (average / (sorted.length - 1)) * 100 : 100;
      mapping.set(value, percentile);
    });
    percentileTables.set(metricId, mapping);
  });

  playerRecords.forEach(({ personId, nameKey, context, rawMetrics }) => {
    const metricsPayload = {};
    let hasMetric = false;
    metrics.forEach((metric) => {
      const raw = rawMetrics[metric.id];
      if (!Number.isFinite(raw)) {
        return;
      }
      const percentile = percentileTables.get(metric.id)?.get(raw);
      if (!Number.isFinite(percentile)) {
        return;
      }
      hasMetric = true;
      const note = typeof metric.config.describe === 'function' ? metric.config.describe(context, percentile, raw) : null;
      metricsPayload[metric.id] = { value: percentile, note: note || undefined };
    });
    if (!hasMetric) {
      return;
    }
    if (personId) {
      byId.set(personId, metricsPayload);
    }
    if (nameKey) {
      byName.set(nameKey, metricsPayload);
    }
  });

  return { byId, byName };
}

function formatRelativeTime(iso) {
  if (!iso) {
    return null;
  }
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  const now = Date.now();
  const diffSeconds = Math.round((timestamp - now) / 1000);
  const divisions = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
  ];
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let duration = diffSeconds;
  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatter.format(Math.round(duration), 'year');
}

function formatBdlWeight(weight) {
  if (weight === null || weight === undefined) {
    return null;
  }
  const trimmed = String(weight).trim();
  if (!trimmed) {
    return null;
  }
  if (!/\d/.test(trimmed)) {
    return null;
  }
  const numeric = Number.parseFloat(trimmed.replace(/lbs?$/i, ''));
  if (Number.isFinite(numeric)) {
    if (numeric < 100 || numeric > 420) {
      return null;
    }
    return `${Math.round(numeric)} lbs`;
  }
  return trimmed;
}

function buildFullName(firstName, lastName) {
  return [firstName, lastName]
    .filter((part) => part && String(part).trim().length)
    .map((part) => String(part).trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function initPlayerAtlas() {
  const atlas = document.querySelector('[data-player-profiles]');
  if (!atlas) {
    return;
  }

  const searchEngine = createPlayerSearchEngine();

  const searchInput = atlas.querySelector('[data-player-search]');
  const clearButton = atlas.querySelector('[data-player-clear]');
  const resultsList = atlas.querySelector('[data-player-results]');
  const hint = atlas.querySelector('[data-player-hint]');
  const empty = atlas.querySelector('[data-player-empty]');
  const error = atlas.querySelector('[data-player-error]');
  const profile = atlas.querySelector('[data-player-profile]');
  const nameEl = atlas.querySelector('[data-player-name]');
  const metaEl = atlas.querySelector('[data-player-meta]');
  const goatRecentScoreEl = atlas.querySelector('[data-player-goat-recent-score]');
  const goatRecentRankEl = atlas.querySelector('[data-player-goat-recent-rank]');
  const goatHistoricScoreEl = atlas.querySelector('[data-player-goat-historic-score]');
  const goatHistoricRankEl = atlas.querySelector('[data-player-goat-historic-rank]');
  const bioEl = atlas.querySelector('[data-player-bio]');
  const archetypeEl = atlas.querySelector('[data-player-archetype]');
  const vitalsEl = atlas.querySelector('[data-player-vitals]');
  const originEl = atlas.querySelector('[data-player-origin]');
  const draftEl = atlas.querySelector('[data-player-draft]');
  const metricsContainer = atlas.querySelector('[data-player-metrics]');
  const metricsEmpty = atlas.querySelector('[data-player-metrics-empty]');
  const teamEl = atlas.querySelector('[data-player-team]');
  const positionEl = atlas.querySelector('[data-player-position]');
  const jerseyEl = atlas.querySelector('[data-player-jersey]');
  const heightEl = atlas.querySelector('[data-player-height]');
  const weightEl = atlas.querySelector('[data-player-weight]');
  const updatedEl = atlas.querySelector('[data-player-updated]');
  const statsContainer = atlas.querySelector('[data-player-stats]');
  const statsMeta = atlas.querySelector('[data-player-stats-meta]');
  const statsSeasonEl = atlas.querySelector('[data-player-stats-season]');
  const statsEmpty = atlas.querySelector('[data-player-stats-empty]');
  const statsError = atlas.querySelector('[data-player-stats-error]');
  const statGamesEl = atlas.querySelector('[data-player-stat-games]');
  const statPointsEl = atlas.querySelector('[data-player-stat-points]');
  const statReboundsEl = atlas.querySelector('[data-player-stat-rebounds]');
  const statAssistsEl = atlas.querySelector('[data-player-stat-assists]');
  const statStealsEl = atlas.querySelector('[data-player-stat-steals]');
  const statBlocksEl = atlas.querySelector('[data-player-stat-blocks]');
  const teamBrowser = atlas.querySelector('[data-player-teams]');
  const teamTree = atlas.querySelector('[data-player-team-tree]');
  const teamGoatPanel =
    atlas.querySelector('[data-player-teams-goat]') || document.querySelector('[data-player-teams-goat]');
  const teamGoatList =
    atlas.querySelector('[data-player-teams-goat-list]') || document.querySelector('[data-player-teams-goat-list]');
  const teamGoatEmpty =
    atlas.querySelector('[data-player-teams-goat-empty]') || document.querySelector('[data-player-teams-goat-empty]');
  const recentLeaderboard = document.querySelector('[data-recent-leaderboard]');
  const recentPlaceholder = document.querySelector('[data-recent-placeholder]');

  if (!profile || !nameEl || !metaEl || !updatedEl) {
    return;
  }

  const formatSeasonLabel = (startYear) => `${startYear}-${String(startYear + 1).slice(-2)}`;
  const LATEST_COMPLETED_SEASON = 2024;
  const seasonLabel = formatSeasonLabel(LATEST_COMPLETED_SEASON);
  if (statsSeasonEl) {
    statsSeasonEl.textContent = seasonLabel;
  }
  const defaultStatsMeta = `Season averages for the ${seasonLabel} season.`;
  if (statsMeta) {
    statsMeta.textContent = defaultStatsMeta;
  }
  const defaultStatsError =
    statsError?.textContent?.trim() ? statsError.textContent : "We couldn't load season averages right now.";
  const unavailableStatsMeta = 'Season averages are temporarily unavailable.';
  const unavailableStatsError = 'Season averages are temporarily unavailable — try again soon.';

  const seasonAveragesCache = new Map();
  let statsRequestToken = 0;

  let players = [];
  let allPlayers = [];
  const playersById = new Map();
  const playersByBdlId = new Map();
  let catalog = [];
  let matches = [];
  let activePlayerId = null;
  let teamButtons = [];
  let activeIndex = -1;
  let isLoaded = false;
  let hasError = false;
  let goatLookup = { byId: new Map(), byName: new Map(), recent: [] };
  let atlasMetrics = { byId: new Map(), byName: new Map() };
  let metricDefinitions = new Map();
  let metricOrder = new Map();
  let currentRostersDoc = null;
  let isUsingFallbackRoster = false;
  const defaultEmptyText = empty?.textContent?.trim() ?? '';
  const defaultTeamGoatEmptyText = teamGoatEmpty?.textContent?.trim() ?? 'Team GOAT averages are warming up.';

  const resolveAssetUrls = (path) => {
    if (typeof path !== 'string') {
      return [];
    }
    const trimmed = path.trim();
    if (!trimmed) {
      return [];
    }
    const normalized = trimmed.replace(/^\.?\//, '');
    const candidates = [];
    try {
      const primary = new URL(`./${normalized}`, document.baseURI).toString();
      candidates.push(primary);
    } catch (primaryError) {
      console.warn('Unable to resolve asset relative to base', path, primaryError);
    }
    try {
      const originBase = `${window.location.origin}/`;
      const fallback = new URL(normalized, originBase).toString();
      if (!candidates.includes(fallback)) {
        candidates.push(fallback);
      }
    } catch (fallbackError) {
      console.warn('Unable to resolve asset relative to origin', path, fallbackError);
    }
    return candidates;
  };

  const fetchAssetWithFallback = async (path, init = {}) => {
    const urls = resolveAssetUrls(path);
    if (!urls.length) {
      throw new Error(`Unable to resolve asset path: ${path}`);
    }
    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, init);
        if (response.ok) {
          return response;
        }
        lastError = new Error(`Request for ${url} failed with status ${response.status}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error(`Unable to fetch asset: ${path}`);
  };
  const normalizePlayerId = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    return String(value);
  };
  const populatePlayersByBdlId = (sourcePlayers) => {
    playersByBdlId.clear();
    if (!Array.isArray(sourcePlayers)) {
      return;
    }
    sourcePlayers.forEach((player) => {
      if (!player) {
        return;
      }
      const candidate =
        player?.bdl?.id !== undefined && player?.bdl?.id !== null
          ? player.bdl.id
          : player?.personId !== undefined && player?.personId !== null
            ? player.personId
            : null;
      if (candidate === null || candidate === undefined) {
        return;
      }
      const key = String(candidate).trim();
      if (!key) {
        return;
      }
      playersByBdlId.set(key, player);
    });
  };
  const ensurePlayerSearchTokens = (player) => {
    player.searchTokens = buildPlayerTokens(player);
    player.nameToken = simplifyText(player?.name);
  };
  const sortPlayersByName = (list) =>
    (Array.isArray(list) ? list : [])
      .slice()
      .sort((a, b) => {
        const left = a?.name || '';
        const right = b?.name || '';
        return left.localeCompare(right);
      });
  const rebuildPlayerIndexes = () => {
    playersById.clear();
    players.forEach((player) => {
      const key = normalizePlayerId(player?.id);
      if (key) {
        playersById.set(key, player);
      }
    });
  };
  const updateStatsView = (status, payload = null) => {
    if (
      !statsContainer ||
      !statGamesEl ||
      !statPointsEl ||
      !statReboundsEl ||
      !statAssistsEl ||
      !statStealsEl ||
      !statBlocksEl
    ) {
      return;
    }

    statsContainer.setAttribute('data-state', status);
    statsContainer.setAttribute('aria-busy', status === 'loading' ? 'true' : 'false');
    if (statsEmpty) {
      statsEmpty.hidden = status !== 'empty';
    }
    if (statsError) {
      if (status === 'error') {
        statsError.hidden = false;
        statsError.textContent = defaultStatsError;
      } else if (status === 'unavailable') {
        statsError.hidden = false;
        statsError.textContent = unavailableStatsError;
      } else {
        statsError.hidden = true;
        statsError.textContent = defaultStatsError;
      }
    }

    const formatValue = (value, digits = 1) =>
      Number.isFinite(value) ? helpers.formatNumber(value, digits) : '—';

    const values = {
      games: '—',
      points: '—',
      rebounds: '—',
      assists: '—',
      steals: '—',
      blocks: '—',
    };

    if (status === 'ready' && payload) {
      values.games = formatValue(payload.games, 0);
      values.points = formatValue(payload.points, 1);
      values.rebounds = formatValue(payload.rebounds, 1);
      values.assists = formatValue(payload.assists, 1);
      values.steals = formatValue(payload.steals, 1);
      values.blocks = formatValue(payload.blocks, 1);
    }

    statGamesEl.textContent = values.games;
    statPointsEl.textContent = values.points;
    statReboundsEl.textContent = values.rebounds;
    statAssistsEl.textContent = values.assists;
    statStealsEl.textContent = values.steals;
    statBlocksEl.textContent = values.blocks;

    if (statsMeta) {
      if (status === 'loading') {
        statsMeta.textContent = `Loading season averages for the ${seasonLabel} season…`;
      } else if (status === 'ready') {
        statsMeta.textContent = defaultStatsMeta;
      } else if (status === 'empty') {
        statsMeta.textContent = `No season averages recorded for the ${seasonLabel} season.`;
      } else if (status === 'error') {
        statsMeta.textContent = `We couldn't load season averages right now.`;
      } else if (status === 'unavailable') {
        statsMeta.textContent = unavailableStatsMeta;
      } else {
        statsMeta.textContent = defaultStatsMeta;
      }
    }
  };

  const parseNumeric = (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const loadSeasonAverages = async (player) => {
    if (
      !statsContainer ||
      !statGamesEl ||
      !statPointsEl ||
      !statReboundsEl ||
      !statAssistsEl ||
      !statStealsEl ||
      !statBlocksEl
    ) {
      return;
    }

    const bdlId = player?.bdl?.id;
    statsRequestToken += 1;
    const requestId = statsRequestToken;

    if (!bdlId) {
      updateStatsView('empty');
      return;
    }

    const cacheKey = String(bdlId);
    if (seasonAveragesCache.has(cacheKey)) {
      const cached = seasonAveragesCache.get(cacheKey);
      updateStatsView(cached.status, cached.data ?? null);
      return;
    }

    updateStatsView('loading');

    try {
      const params = new URLSearchParams();
      params.set('season', String(LATEST_COMPLETED_SEASON));
      params.set('player_id', cacheKey);
      const payload = await bdl(`/v1/season_averages?${params.toString()}`, { cache: 'no-store' });
      const record = Array.isArray(payload?.data) ? payload.data[0] : null;
      if (!record) {
        const entry = { status: 'empty', data: null };
        seasonAveragesCache.set(cacheKey, entry);
        if (requestId === statsRequestToken) {
          updateStatsView('empty');
        }
        return;
      }

      const stats = {
        games: parseNumeric(record.games_played),
        points: parseNumeric(record.pts),
        rebounds: parseNumeric(record.reb),
        assists: parseNumeric(record.ast),
        steals: parseNumeric(record.stl),
        blocks: parseNumeric(record.blk),
      };
      const entry = { status: 'ready', data: stats };
      seasonAveragesCache.set(cacheKey, entry);
      if (requestId === statsRequestToken) {
        updateStatsView('ready', stats);
      }
    } catch (seasonError) {
      console.warn('Unable to load season averages', seasonError);
      seasonAveragesCache.set(cacheKey, { status: 'error', data: null });
      if (requestId === statsRequestToken) {
        updateStatsView('error');
      }
    }
  };

  const updateRosterTimestamp = () => {
    if (isUsingFallbackRoster) {
      updatedEl.textContent = 'Live roster snapshot unavailable — showing scouting atlas roster data.';
      return;
    }
    if (!currentRostersDoc) {
      updatedEl.textContent = 'Active roster snapshot not yet available.';
      return;
    }

    const parts = [];
    if (currentRostersDoc.fetched_at) {
      const relative = formatRelativeTime(currentRostersDoc.fetched_at);
      if (relative) {
        parts.push(`Refreshed ${relative}`);
      } else {
        const timestamp = new Date(currentRostersDoc.fetched_at).toLocaleString();
        parts.push(`Refreshed ${timestamp}`);
      }
    } else {
      parts.push('Refresh time unavailable');
    }

    const sourceName = currentRostersDoc.source === 'ball_dont_lie' || !currentRostersDoc.source
      ? 'Primary league data feed'
      : String(currentRostersDoc.source);
    parts.push(`Source: ${sourceName}`);

    if (Number.isFinite(currentRostersDoc.ttl_hours)) {
      parts.push(`TTL ${currentRostersDoc.ttl_hours}h`);
    }

    updatedEl.textContent = parts.join(' • ');
  };

  updateRosterTimestamp();

  const setClearVisibility = (value) => {
    if (!clearButton) return;
    clearButton.hidden = !value;
  };

  const setResultsVisibility = (isVisible) => {
    if (!resultsList) {
      return;
    }
    resultsList.hidden = !isVisible;
    if (searchInput) {
      searchInput.setAttribute('aria-expanded', isVisible ? 'true' : 'false');
      if (!isVisible) {
        searchInput.removeAttribute('aria-activedescendant');
      }
    }
  };

  const resetStatusMessages = () => {
    if (hint) hint.hidden = false;
    if (empty) empty.hidden = true;
    if (error) error.hidden = true;
  };
  const setActivePlayers = (nextPlayers) => {
    const sorted = sortPlayersByName(nextPlayers);
    sorted.forEach((player) => ensurePlayerSearchTokens(player));
    players = sorted;
    rebuildPlayerIndexes();
    searchEngine.setPlayers(players);
    renderTeamBrowser(players);
    if (activePlayerId) {
      const normalizedActiveId = normalizePlayerId(activePlayerId);
      if (!normalizedActiveId || !playersById.has(normalizedActiveId)) {
        activePlayerId = null;
        if (profile) {
          profile.hidden = true;
          delete profile.dataset.playerId;
          renderPlayerMetricsView(null);
        }
      } else {
        activePlayerId = normalizedActiveId;
      }
    }
    highlightTeamPlayer(activePlayerId);
    if (searchInput && resultsList) {
      const pendingQuery = searchInput.value.trim();
      if (pendingQuery) {
        renderResults(pendingQuery);
      } else {
        matches = [];
        activeIndex = -1;
        resultsList.innerHTML = '';
        setResultsVisibility(false);
        setClearVisibility(false);
        resetStatusMessages();
      }
    } else {
      matches = [];
      activeIndex = -1;
    }
  };

  const applyFallbackRoster = () => {
    isUsingFallbackRoster = true;
    currentRostersDoc = null;
    setActivePlayers(allPlayers);
    populatePlayersByBdlId(players);
    updateRosterTimestamp();
  };

  const renderMeta = (player) => {
    const parts = [];
    const teamName = player?.bdl?.teamName || player?.team;
    const teamAbbr = player?.bdl?.teamAbbr || player?.teamAbbr;
    const position = player?.bdl?.position;
    const jersey = player?.bdl?.jersey;
    if (teamName && teamAbbr) {
      parts.push(`${teamName} (${teamAbbr})`);
    } else if (teamName) {
      parts.push(teamName);
    }
    if (position) {
      parts.push(`Position ${position}`);
    }
    if (jersey) {
      parts.push(`#${jersey}`);
    }
    return parts.join(' • ');
  };

  const resolvePlayerGoatScore = (player) => {
    if (!player) {
      return null;
    }
    const goatScores = player?.goatScores || {};
    const candidates = [
      goatScores?.historical,
      player?.goatScore,
      goatScores?.recent,
      player?.goatRecentScore,
    ];
    for (const value of candidates) {
      if (Number.isFinite(value)) {
        return Number(value);
      }
    }
    return null;
  };

  function renderPlayerMetricsView(player) {
    if (!metricsContainer) {
      return;
    }

    metricsContainer.innerHTML = '';
    metricsContainer.setAttribute('data-state', player ? 'loading' : 'idle');
    if (metricsEmpty) {
      metricsEmpty.hidden = true;
    }

    if (!player) {
      return;
    }

    const record =
      player?.metrics && typeof player.metrics === 'object' && player.metrics !== null
        ? player.metrics
        : {};
    const entries = Object.entries(record).filter((entry) => {
      const value = entry?.[1]?.value;
      return Number.isFinite(value);
    });

    if (!entries.length) {
      metricsContainer.setAttribute('data-state', 'empty');
      if (metricsEmpty) {
        metricsEmpty.hidden = false;
      }
      return;
    }

    const sorted = entries.slice().sort((a, b) => {
      const orderA = metricOrder.has(a[0]) ? metricOrder.get(a[0]) : Number.POSITIVE_INFINITY;
      const orderB = metricOrder.has(b[0]) ? metricOrder.get(b[0]) : Number.POSITIVE_INFINITY;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a[0].localeCompare(b[0]);
    });

    metricsContainer.setAttribute('data-state', 'ready');
    if (metricsEmpty) {
      metricsEmpty.hidden = true;
    }

    sorted.forEach(([metricId, payload]) => {
      const definition = metricDefinitions.get(metricId) || {};
      const card = document.createElement('article');
      card.className = 'player-metric';

      const header = document.createElement('div');
      header.className = 'player-metric__header';

      const label = document.createElement('span');
      label.className = 'player-metric__label';
      label.textContent = definition.label || metricId.replace(/[-_]+/g, ' ');

      const value = document.createElement('span');
      value.className = 'player-metric__value';

      const numericValue = Number.isFinite(payload?.value)
        ? Math.max(0, Math.min(100, Number(payload.value)))
        : null;

      if (numericValue === null) {
        value.classList.add('player-metric__value--empty');
        value.textContent = '—';
      } else {
        const valueNumber = document.createElement('span');
        valueNumber.className = 'player-metric__value-number';
        valueNumber.textContent = formatPercentile(numericValue);

        const suffix = document.createElement('span');
        suffix.className = 'player-metric__value-suffix';
        suffix.textContent = 'Percentile';

        value.append(valueNumber, suffix);
      }

      header.append(label, value);

      const meter = document.createElement('div');
      meter.className = 'player-metric__meter';
      if (numericValue === null) {
        meter.classList.add('player-metric__meter--empty');
      } else {
        const fill = document.createElement('span');
        fill.style.setProperty('--fill', `${numericValue}%`);
        meter.append(fill);
      }

      const description = document.createElement('p');
      description.className = 'player-metric__description';
      description.textContent =
        (typeof payload?.note === 'string' && payload.note.trim()) ||
        (typeof definition.description === 'string' && definition.description.trim()) ||
        'Percentile visual is warming up.';

      card.append(header, meter, description);
      metricsContainer.append(card);
    });
  }

  const highlightTeamPlayer = (playerId) => {
    if (!teamTree) return;
    if (!teamButtons.length) {
      teamButtons = Array.from(teamTree.querySelectorAll('[data-player-id]'));
    }
    const normalizedId = normalizePlayerId(playerId);
    let activeButton = null;
    teamButtons.forEach((button) => {
      const isActive = Boolean(normalizedId) && button.dataset.playerId === normalizedId;
      button.classList.toggle('is-active', isActive);
      if (isActive) {
        activeButton = button;
      }
    });
    if (activeButton) {
      const parentSection = activeButton.closest('details');
      if (parentSection && !parentSection.open) {
        parentSection.open = true;
      }
      const isTreeScrollable = teamTree.scrollHeight > teamTree.clientHeight;
      if (isTreeScrollable) {
        activeButton.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const FALLBACK_TEAM_NAME = 'Unaffiliated pool';

  const deriveTeamAbbreviation = (teamName, members = []) => {
    const abbrCandidate = members
      .map((player) => {
        if (player?.bdl?.teamAbbr) return player.bdl.teamAbbr;
        if (player?.bdl?.team?.abbreviation) return player.bdl.team.abbreviation;
        if (player?.teamAbbr) return player.teamAbbr;
        return null;
      })
      .find((value) => typeof value === 'string' && value.trim().length);

    if (abbrCandidate) {
      return abbrCandidate.trim().slice(0, 4).toUpperCase();
    }

    if (teamName === FALLBACK_TEAM_NAME) {
      return 'FA';
    }

    const sanitized = typeof teamName === 'string' ? teamName.replace(/[^A-Za-z0-9\s]/g, ' ').trim() : '';
    if (!sanitized) {
      return 'UNK';
    }

    const words = sanitized.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      return words[0].slice(0, 3).toUpperCase();
    }

    const acronym = words
      .map((word) => {
        const letter = word.match(/[A-Za-z]/);
        return letter ? letter[0].toUpperCase() : '';
      })
      .join('')
      .slice(0, 4);

    return acronym || sanitized.slice(0, 3).toUpperCase();
  };

  const renderTeamGoatLeaderboard = (teamEntries) => {
    if (!teamGoatPanel || !teamGoatList) {
      return;
    }

    teamGoatList.innerHTML = '';

    if (!Array.isArray(teamEntries) || !teamEntries.length) {
      teamGoatPanel.hidden = true;
      if (teamGoatEmpty) {
        teamGoatEmpty.hidden = false;
        teamGoatEmpty.textContent = defaultTeamGoatEmptyText;
      }
      return;
    }

    const leaderboard = teamEntries
      .map(([teamName, roster]) => {
        const members = Array.isArray(roster) ? roster : [];
        const rosterSize = members.length;
        if (!rosterSize) {
          return null;
        }
        let goatTotal = 0;
        let graded = 0;
        members.forEach((player) => {
          const value = resolvePlayerGoatScore(player);
          if (Number.isFinite(value)) {
            goatTotal += value;
            graded += 1;
          }
        });
        const average = rosterSize ? goatTotal / rosterSize : 0;
        return {
          teamName,
          teamAbbr: deriveTeamAbbreviation(teamName, members),
          rosterSize,
          goatTotal,
          graded,
          average,
        };
      })
      .filter(Boolean);

    if (!leaderboard.length) {
      teamGoatPanel.hidden = true;
      if (teamGoatEmpty) {
        teamGoatEmpty.hidden = false;
        teamGoatEmpty.textContent = defaultTeamGoatEmptyText;
      }
      return;
    }

    leaderboard.sort((a, b) => {
      if (b.average !== a.average) {
        return b.average - a.average;
      }
      if (b.goatTotal !== a.goatTotal) {
        return b.goatTotal - a.goatTotal;
      }
      return a.teamName.localeCompare(b.teamName);
    });

    leaderboard.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'player-atlas__teams-goat-entry';

      const rank = document.createElement('span');
      rank.className = 'player-atlas__teams-goat-rank';
      rank.textContent = helpers.formatNumber(index + 1, 0);

      const line = document.createElement('div');
      line.className = 'player-atlas__teams-goat-line';

      const name = document.createElement('span');
      name.className = 'player-atlas__teams-goat-name';
      const teamLabel = entry.teamAbbr || entry.teamName;
      name.textContent = `\u00a0${teamLabel}`;
      name.title = entry.teamName;

      const rosterLabel = document.createElement('span');
      rosterLabel.className = 'player-atlas__teams-goat-roster';
      rosterLabel.textContent = `\u00a0${helpers.formatNumber(entry.rosterSize, 0)}p`;
      rosterLabel.title = `${helpers.formatNumber(entry.rosterSize, 0)} players`;

      const average = document.createElement('span');
      average.className = 'player-atlas__teams-goat-average';
      average.textContent = `\u00a0${helpers.formatNumber(entry.average, 1)}G/s`;
      average.title = 'Average GOAT score per roster spot';

      const total = document.createElement('span');
      total.className = 'player-atlas__teams-goat-total';
      total.textContent = `\u00a0${helpers.formatNumber(entry.goatTotal, 1)} Tot`;
      total.title = 'Total GOAT score for active roster';

      line.append(name, rosterLabel, average, total);

      if (entry.graded !== entry.rosterSize) {
        const coverage = document.createElement('span');
        coverage.className = 'player-atlas__teams-goat-coverage';
        coverage.textContent = `\u00a0${helpers.formatNumber(entry.graded, 0)}g`;
        coverage.title = `${helpers.formatNumber(entry.graded, 0)} players with GOAT grades`;
        line.append(coverage);
      }

      line.setAttribute(
        'aria-label',
        [
          teamLabel,
          `${helpers.formatNumber(entry.rosterSize, 0)} players`,
          `${helpers.formatNumber(entry.average, 1)} GOAT per spot`,
          `${helpers.formatNumber(entry.goatTotal, 1)} total GOAT`,
          entry.graded !== entry.rosterSize
            ? `${helpers.formatNumber(entry.graded, 0)} players graded`
            : null,
        ]
          .filter(Boolean)
          .join(' '),
      );

      item.append(rank, line);
      teamGoatList.append(item);
    });

    teamGoatPanel.hidden = false;
    if (teamGoatEmpty) {
      teamGoatEmpty.hidden = true;
      teamGoatEmpty.textContent = defaultTeamGoatEmptyText;
    }
  };

  const renderTeamBrowser = (roster) => {
    if (!teamTree) return;
    teamTree.innerHTML = '';
    teamButtons = [];

    if (!Array.isArray(roster) || roster.length === 0) {
      if (teamBrowser) {
        teamBrowser.hidden = true;
      }
      renderTeamGoatLeaderboard([]);
      return;
    }

    const groups = new Map();

    roster.forEach((player) => {
      const teamName = player?.bdl?.teamName?.trim() || player?.team?.trim() || FALLBACK_TEAM_NAME;
      if (!groups.has(teamName)) {
        groups.set(teamName, []);
      }
      groups.get(teamName).push(player);
    });

    const sortedTeams = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const fragment = document.createDocumentFragment();

    sortedTeams.forEach(([teamName, members]) => {
      const panel = document.createElement('details');
      panel.className = 'player-atlas__team';
      panel.dataset.team = teamName;
      const teamAbbr = deriveTeamAbbreviation(teamName, members);
      panel.dataset.teamAbbr = teamAbbr;

      const summary = document.createElement('summary');
      summary.className = 'player-atlas__team-summary';
      summary.title = teamName;

      const identity = document.createElement('span');
      identity.className = 'player-atlas__team-identity';

      const srLabel = document.createElement('span');
      srLabel.className = 'visually-hidden';
      srLabel.textContent = `${teamName} roster`;

      const abbr = document.createElement('span');
      abbr.className = 'player-atlas__team-name';
      abbr.textContent = teamAbbr;
      abbr.setAttribute('aria-hidden', 'true');

      identity.append(srLabel, abbr);

      const count = document.createElement('span');
      count.className = 'player-atlas__team-count';
      count.textContent = `${members.length}`;
      count.setAttribute('aria-label', `${members.length} ${members.length === 1 ? 'player' : 'players'}`);

      summary.append(identity, count);
      panel.append(summary);

      const list = document.createElement('ul');
      list.className = 'player-atlas__team-roster';

      members
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((player) => {
          const item = document.createElement('li');
          item.className = 'player-atlas__team-entry';

          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'player-atlas__team-player';
          button.dataset.playerId = normalizePlayerId(player.id);

          const name = document.createElement('span');
          name.className = 'player-atlas__team-player-name';
          name.textContent = player.name;

          button.append(name);

          const positionLabel = player?.bdl?.position || null;
          const jerseyLabel = player?.bdl?.jersey || null;
          const metaBits = [positionLabel, jerseyLabel ? `#${jerseyLabel}` : null].filter(Boolean);
          if (metaBits.length) {
            const meta = document.createElement('span');
            meta.className = 'player-atlas__team-player-meta';
            meta.textContent = metaBits.join(' • ');
            button.append(meta);
          }

          item.append(button);
          list.append(item);
        });

      panel.append(list);
      fragment.append(panel);
    });

    teamTree.append(fragment);
    teamButtons = Array.from(teamTree.querySelectorAll('[data-player-id]'));
    if (teamBrowser) {
      teamBrowser.hidden = false;
    }
    renderTeamGoatLeaderboard(Array.from(groups.entries()));
    if (activePlayerId) {
      highlightTeamPlayer(activePlayerId);
    }
  };

  const applyPrimaryFeedDoc = (doc) => {
    if (!doc || !Array.isArray(doc.teams) || doc.teams.length === 0) {
      applyFallbackRoster();
      return;
    }

    isUsingFallbackRoster = false;
    currentRostersDoc = doc ?? null;
    updateRosterTimestamp();

    const nameBuckets = new Map();
    allPlayers.forEach((player) => {
      const key = normalizeName(player?.name);
      if (!key) {
        return;
      }
      if (!nameBuckets.has(key)) {
        nameBuckets.set(key, []);
      }
      nameBuckets.get(key).push(player);
    });

    const takeFromBucket = (key) => {
      if (!key) {
        return null;
      }
      const bucket = nameBuckets.get(key);
      if (!bucket || !bucket.length) {
        return null;
      }
      return bucket.shift();
    };

    const extras = [];

    const atlasPlayers = [];

    doc.teams.forEach((team) => {
      const roster = Array.isArray(team?.roster) ? team.roster : [];
      roster.forEach((member) => {
        const fullName = buildFullName(member?.first_name, member?.last_name);
        const nameKey = normalizeName(fullName || '');
        const sourceRecord = nameKey ? takeFromBucket(nameKey) : null;
        let playerRecord = sourceRecord ? { ...sourceRecord } : null;
        let isNewRecord = false;

        if (!playerRecord) {
          const rosterId = member?.id ?? `${team?.abbreviation ?? 'FA'}-${atlasPlayers.length + 1}`;
          playerRecord = {
            id: `bdl-${rosterId}`,
            name: fullName || `Player ${rosterId}`,
            team: team?.full_name || team?.abbreviation || '',
            teamAbbr: team?.abbreviation ?? null,
            position: member?.position ?? null,
            jerseyNumber: member?.jersey_number ?? null,
            height: member?.height ?? null,
            weight: formatBdlWeight(member?.weight) ?? null,
            era: null,
            goatScores: null,
            goatScore: null,
            goatRank: null,
            goatTier: null,
            goatResume: null,
            metrics: {},
          };
          isNewRecord = true;
        }

        const teamName = team?.full_name || team?.abbreviation || playerRecord.team || '';
        const formattedWeight = formatBdlWeight(member?.weight);
        const jerseyNumber = member?.jersey_number ?? null;
        const heightValue = member?.height ?? null;
        const positionValue = member?.position ?? null;

        playerRecord.team = teamName || playerRecord.team || '';
        if (team?.abbreviation) {
          playerRecord.teamAbbr = team.abbreviation;
        }
        if (positionValue) {
          playerRecord.position = positionValue;
        }
        if (jerseyNumber) {
          playerRecord.jerseyNumber = jerseyNumber;
        }
        if (heightValue) {
          playerRecord.height = heightValue;
        }
        if (formattedWeight) {
          playerRecord.weight = formattedWeight;
        }

        const previousBdl = playerRecord?.bdl ?? {};
        playerRecord.bdl = {
          ...previousBdl,
          id: member?.id ?? previousBdl.id ?? null,
          teamName,
          teamAbbr: team?.abbreviation ?? previousBdl.teamAbbr ?? null,
          position: positionValue ?? previousBdl.position ?? null,
          jersey: jerseyNumber ?? previousBdl.jersey ?? null,
          height: heightValue ?? previousBdl.height ?? null,
          weight: formattedWeight ?? previousBdl.weight ?? null,
        };

        ensurePlayerSearchTokens(playerRecord);
        if (isNewRecord) {
          extras.push(playerRecord);
        }

        atlasPlayers.push(playerRecord);
      });
    });

    if (extras.length) {
      const existingIds = new Set(
        allPlayers
          .map((player) => normalizePlayerId(player?.id))
          .filter((value) => value !== null),
      );
      extras.forEach((player) => {
        const candidateId = normalizePlayerId(player?.id);
        if (candidateId && !existingIds.has(candidateId)) {
          allPlayers.push(player);
          existingIds.add(candidateId);
        }
      });
    }

    setActivePlayers(atlasPlayers);
    populatePlayersByBdlId(players);
  };

  const updateActiveOption = () => {
    if (!resultsList) {
      return;
    }
    const buttons = resultsList.querySelectorAll('[data-player-id]');
    buttons.forEach((button, index) => {
      const isActive = index === activeIndex;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        if (searchInput) {
          searchInput.setAttribute('aria-activedescendant', button.id);
        }
        button.scrollIntoView({ block: 'nearest' });
      }
    });
    if (!buttons.length || activeIndex < 0) {
      if (searchInput) {
        searchInput.removeAttribute('aria-activedescendant');
      }
    }
  };

  const renderResults = (query) => {
    if (!resultsList || !searchInput) {
      return;
    }
    const trimmed = query.trim();
    setClearVisibility(trimmed.length > 0);
    if (!trimmed) {
      matches = [];
      activeIndex = -1;
      resultsList.innerHTML = '';
      setResultsVisibility(false);
      resetStatusMessages();
      searchInput.removeAttribute('aria-activedescendant');
      return;
    }

    if (!isLoaded && !hasError) {
      matches = [];
      activeIndex = -1;
      setResultsVisibility(false);
      if (hint) hint.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = 'Loading player atlas…';
      }
      return;
    }

    const found = searchEngine.search(trimmed, 8);

    matches = found;
    resultsList.innerHTML = '';

    if (!matches.length) {
      activeIndex = -1;
      setResultsVisibility(false);
      if (hint) hint.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = defaultEmptyText;
      }
      searchInput.removeAttribute('aria-activedescendant');
      return;
    }

    if (hint) hint.hidden = true;
    if (empty) empty.hidden = true;
    activeIndex = 0;

    matches.forEach((player) => {
      const item = document.createElement('li');
      const normalizedId = normalizePlayerId(player.id);
      if (!normalizedId) {
        return;
      }
      const optionId = `player-atlas-option-${normalizedId}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.id = optionId;
      button.className = 'player-atlas__result';
      button.dataset.playerId = normalizedId;
      button.setAttribute('role', 'option');

      const name = document.createElement('span');
      name.className = 'player-atlas__result-name';
      name.textContent = player.name;

      const meta = document.createElement('span');
      meta.className = 'player-atlas__result-meta';
      const metaText = [
        player?.bdl?.teamName || player?.team || null,
        player?.bdl?.position ? `Pos ${player.bdl.position}` : null,
        player?.bdl?.jersey ? `#${player.bdl.jersey}` : null,
      ]
        .filter(Boolean)
        .join(' • ');
      if (metaText) {
        meta.textContent = metaText;
      }

      button.append(name);
      if (metaText) {
        button.append(meta);
      }
      item.append(button);
      resultsList.append(item);
    });

    setResultsVisibility(true);
    updateActiveOption();
  };

  const selectPlayer = (player) => {
    if (!player) return;
    if (searchInput) {
      searchInput.value = player.name;
    }
    setClearVisibility(true);
    matches = [];
    activeIndex = -1;
    if (resultsList) {
      resultsList.innerHTML = '';
    }
    setResultsVisibility(false);
    if (hint) hint.hidden = true;
    if (empty) empty.hidden = true;

    profile.hidden = false;
    const normalizedId = normalizePlayerId(player?.id);
    profile.dataset.playerId = normalizedId ?? '';
    activePlayerId = normalizedId;
    highlightTeamPlayer(activePlayerId);
    nameEl.textContent = player.name;
    metaEl.textContent = renderMeta(player) || 'Active roster profile';

    const goatScores = player?.goatScores || {};
    const recentScore = Number.isFinite(goatScores?.recent)
      ? goatScores.recent
      : Number.isFinite(player?.goatRecentScore)
        ? player.goatRecentScore
        : null;
    const recentRank = Number.isFinite(goatScores?.recentRank)
      ? goatScores.recentRank
      : Number.isFinite(player?.goatRecentRank)
        ? player.goatRecentRank
        : null;
    const historicScore = Number.isFinite(goatScores?.historical)
      ? goatScores.historical
      : Number.isFinite(player?.goatScore)
        ? player.goatScore
        : null;
    const historicRank = Number.isFinite(goatScores?.historicalRank)
      ? goatScores.historicalRank
      : Number.isFinite(player?.goatRank)
        ? player.goatRank
        : null;

    if (goatRecentScoreEl) {
      goatRecentScoreEl.textContent = Number.isFinite(recentScore)
        ? helpers.formatNumber(recentScore, 1)
        : '—';
    }
    if (goatRecentRankEl) {
      goatRecentRankEl.textContent = Number.isFinite(recentRank)
        ? `No. ${helpers.formatNumber(recentRank, 0)}`
        : 'No. —';
    }
    if (goatHistoricScoreEl) {
      goatHistoricScoreEl.textContent = Number.isFinite(historicScore)
        ? helpers.formatNumber(historicScore, 1)
        : '—';
    }
    if (goatHistoricRankEl) {
      goatHistoricRankEl.textContent = Number.isFinite(historicRank)
        ? `No. ${helpers.formatNumber(historicRank, 0)}`
        : 'No. —';
    }

    if (bioEl) {
      const biography = typeof player?.bio === 'string' ? player.bio.trim() : '';
      const resume = typeof player?.goatResume === 'string' ? player.goatResume.trim() : '';
      let copy = biography || `Scouting capsule for ${player.name}.`;
      if (resume && !copy.toLowerCase().includes(resume.toLowerCase())) {
        const punctuated = /[.!?]$/.test(copy) ? copy : `${copy}.`;
        copy = `${punctuated} GOAT resume: ${resume}${/[.!?]$/.test(resume) ? '' : '.'}`;
      }
      bioEl.textContent = copy;
    }

    if (archetypeEl) {
      const archetype = player?.archetype || player?.goatTier || '—';
      archetypeEl.textContent = archetype;
    }

    const teamName = player?.bdl?.teamName || player?.team || null;
    const position = player?.bdl?.position || player?.position || null;
    const jerseySource = player?.bdl?.jersey ?? player?.jerseyNumber ?? null;
    const jerseyRaw = jerseySource !== null && jerseySource !== undefined ? String(jerseySource).trim() : '';
    const jersey = jerseyRaw ? (jerseyRaw.startsWith('#') ? jerseyRaw : `#${jerseyRaw}`) : null;
    const height = player?.bdl?.height || player?.height || null;
    const weight = player?.bdl?.weight || player?.weight || null;

    if (vitalsEl) {
      const vitalsParts = [];
      if (height) vitalsParts.push(height);
      if (weight) vitalsParts.push(weight);
      if (position) vitalsParts.push(`Pos ${position}`);
      if (jersey) vitalsParts.push(jersey);
      if (teamName) vitalsParts.push(teamName);
      vitalsEl.textContent = vitalsParts.length ? vitalsParts.join(' • ') : '—';
    }

    if (originEl) {
      const origin = player?.origin || player?.born || '—';
      originEl.textContent = origin;
    }

    if (draftEl) {
      const draft = player?.draft || player?.draftStatus || '—';
      draftEl.textContent = draft;
    }

    if (teamEl) {
      teamEl.textContent = teamName || '—';
    }
    if (positionEl) {
      positionEl.textContent = position || '—';
    }
    if (jerseyEl) {
      jerseyEl.textContent = jersey || '—';
    }
    if (heightEl) {
      heightEl.textContent = height || '—';
    }
    if (weightEl) {
      weightEl.textContent = weight || '—';
    }

    renderPlayerMetricsView(player);

    updateRosterTimestamp();
    loadSeasonAverages(player);

    profile.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectPlayerByBdlId = (bdlId) => {
    if (bdlId === null || bdlId === undefined) {
      return false;
    }
    const key = String(bdlId);
    const player = playersByBdlId.get(key);
    if (player) {
      selectPlayer(player);
      return true;
    }
    return false;
  };

  const handleInput = (event) => {
    renderResults(event.target.value || '');
  };

  const handleKeydown = (event) => {
    if (!searchInput || !resultsList) {
      return;
    }
    if (!matches.length) {
      if (event.key === 'Escape' && searchInput.value) {
        searchInput.value = '';
        renderResults('');
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % matches.length;
      updateActiveOption();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + matches.length) % matches.length;
      updateActiveOption();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && matches[activeIndex]) {
        selectPlayer(matches[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setResultsVisibility(false);
      matches = [];
      activeIndex = -1;
      resultsList.innerHTML = '';
      searchInput.removeAttribute('aria-activedescendant');
    }
  };

  const handleResultsClick = (event) => {
    const button = event.target.closest('[data-player-id]');
    if (!button) return;
    const playerId = button.dataset.playerId;
    const player = playersById.get(normalizePlayerId(playerId));
    selectPlayer(player);
  };

  const handleTeamClick = (event) => {
    const button = event.target.closest('[data-player-id]');
    if (!button || !teamTree?.contains(button)) {
      return;
    }
    const playerId = button.dataset.playerId;
    if (!playerId) return;
    const player = playersById.get(normalizePlayerId(playerId));
    if (player) {
      selectPlayer(player);
    }
  };

  const handleClear = () => {
    if (!searchInput) {
      return;
    }
    searchInput.value = '';
    searchInput.focus();
    setClearVisibility(false);
    renderResults('');
  };

  const hydrate = async () => {
    try {
      const [
        profilesResponse,
        goatSystemResponse,
        goatIndexResponse,
        goatRecentResponse,
        rostersResponse,
      ] = await Promise.all([
        fetchAssetWithFallback('data/player_profiles.json'),
        fetchAssetWithFallback('data/goat_system.json').catch(() => null),
        fetchAssetWithFallback('data/goat_index.json').catch(() => null),
        fetchAssetWithFallback('data/goat_recent.json').catch(() => null),
        fetchAssetWithFallback('data/rosters.json', { cache: 'no-store' }).catch(() => null),
      ]);
      if (!profilesResponse?.ok) {
        throw new Error(`Failed to load player profiles: ${profilesResponse?.status}`);
      }
      const data = await profilesResponse.json();

      catalog = Array.isArray(data?.metrics) ? data.metrics : [];
      metricDefinitions = new Map();
      metricOrder = new Map();
      catalog.forEach((metric, index) => {
        if (!metric || typeof metric.id !== 'string') {
          return;
        }
        metricDefinitions.set(metric.id, metric);
        metricOrder.set(metric.id, index);
      });
      const roster = Array.isArray(data?.players) ? data.players : [];

      let goatSystemData = null;
      if (goatSystemResponse && goatSystemResponse.ok) {
        try {
          goatSystemData = await goatSystemResponse.json();
        } catch (goatSystemError) {
          console.warn('Unable to parse GOAT system data', goatSystemError);
        }
      }

      let goatIndexData = null;
      if (goatIndexResponse && goatIndexResponse.ok) {
        try {
          goatIndexData = await goatIndexResponse.json();
        } catch (goatIndexError) {
          console.warn('Unable to parse GOAT index data', goatIndexError);
        }
      }

      let goatRecentData = null;
      if (goatRecentResponse && goatRecentResponse.ok) {
        try {
          goatRecentData = await goatRecentResponse.json();
        } catch (goatRecentError) {
          console.warn('Unable to parse rolling GOAT data', goatRecentError);
        }
      }

      const goatHistoricalSource = mergeGoatHistoricalSources(goatSystemData, goatIndexData);
      goatLookup = buildGoatScoreLookup(goatHistoricalSource, goatRecentData);
      atlasMetrics = buildAtlasMetrics(catalog, goatHistoricalSource);
      renderRecentLeaderboard(goatLookup.recent, recentLeaderboard, recentPlaceholder);

      const resolveGoatScores = (personId, name) => {
        if (personId && goatLookup.byId.has(personId)) {
          return goatLookup.byId.get(personId);
        }
        const nameKey = normalizeName(name);
        if (nameKey && goatLookup.byName.has(nameKey)) {
          return goatLookup.byName.get(nameKey);
        }
        return null;
      };

      players = roster.map((player) => {
        const personId = extractPersonIdFromProfile(player);
        const nameKey = normalizeName(player?.name);
        const goatScores = resolveGoatScores(personId, player?.name);
        const mergedGoatScores = goatScores ? { ...goatScores } : {};
        if (!Number.isFinite(mergedGoatScores.recent) && Number.isFinite(player?.goatRecentScore)) {
          mergedGoatScores.recent = player.goatRecentScore;
        }
        if (!Number.isFinite(mergedGoatScores.recentRank) && Number.isFinite(player?.goatRecentRank)) {
          mergedGoatScores.recentRank = player.goatRecentRank;
        }
        if (!Number.isFinite(mergedGoatScores.historical) && Number.isFinite(player?.goatScore)) {
          mergedGoatScores.historical = player.goatScore;
        }
        const historicalGoat = Number.isFinite(mergedGoatScores?.historical)
          ? mergedGoatScores.historical
          : player?.goatScore;
        const metricsRecord =
          (personId && atlasMetrics.byId.get(personId)) ||
          (nameKey && atlasMetrics.byName.get(nameKey)) ||
          null;
        const enriched = {
          ...player,
          searchTokens: buildPlayerTokens(player),
          nameToken: simplifyText(player?.name),
          personId,
          goatScores: Object.keys(mergedGoatScores).length ? mergedGoatScores : null,
          goatScore: Number.isFinite(historicalGoat) ? historicalGoat : player?.goatScore,
          metrics: metricsRecord ?? player?.metrics ?? {},
        };
        if (metricsRecord) {
          enriched.metrics = metricsRecord;
        }
        const resumeText = goatScores?.resume || player?.goatResume;
        if (resumeText) {
          enriched.goatResume = resumeText;
        }
        const tierText = goatScores?.tier || player?.goatTier;
        if (tierText) {
          enriched.goatTier = tierText;
        }
        const resolvedRank = Number.isFinite(player?.goatRank)
          ? player.goatRank
          : Number.isFinite(goatScores?.historicalRank)
            ? goatScores.historicalRank
            : null;
        if (Number.isFinite(resolvedRank)) {
          enriched.goatRank = resolvedRank;
        }
        return enriched;
      });

      allPlayers = players.map((player) => ({ ...player }));

      let rostersDoc = null;
      if (rostersResponse && rostersResponse.ok) {
        try {
          rostersDoc = await rostersResponse.json();
        } catch (rostersError) {
          console.warn('Unable to parse roster snapshot', rostersError);
        }
      }

      if (rostersDoc) {
        applyPrimaryFeedDoc(rostersDoc);
      } else {
        applyFallbackRoster();
      }

      isLoaded = true;
      hasError = false;
      if (empty) {
        empty.textContent = defaultEmptyText;
      }

      if (!players.length) {
        if (hint) hint.hidden = true;
        if (empty) {
          empty.hidden = false;
          empty.textContent = 'Active roster profiles are temporarily unavailable.';
        }
        if (searchInput) {
          searchInput.disabled = true;
        }
        setClearVisibility(false);
      } else {
        if (searchInput) {
          searchInput.disabled = false;
          const pendingQuery = searchInput.value.trim();
          if (pendingQuery) {
            renderResults(pendingQuery);
          } else {
            resetStatusMessages();
            if (document.activeElement !== searchInput) {
              try {
                searchInput.focus({ preventScroll: true });
              } catch (focusError) {
                searchInput.focus();
              }
            }
          }
        } else {
          resetStatusMessages();
        }
      }
    } catch (err) {
      console.error(err);
      hasError = true;
      renderRecentLeaderboard([], recentLeaderboard, recentPlaceholder);
      if (error) {
        error.hidden = false;
        error.textContent = 'Unable to load the scouting atlas right now. Please refresh the page to try again.';
      }
      if (hint) hint.hidden = true;
      if (searchInput) {
        searchInput.disabled = true;
      }
      setClearVisibility(false);
    }
  };

  hydrate();

  if (searchInput) {
    searchInput.addEventListener('input', handleInput);
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim()) {
        renderResults(searchInput.value);
      }
    });
    searchInput.addEventListener('keydown', handleKeydown);
  }

  if (resultsList) {
    resultsList.addEventListener('mousedown', (event) => {
      // Prevent the input from losing focus before click handlers run.
      event.preventDefault();
    });
    resultsList.addEventListener('click', handleResultsClick);
  }

  if (teamTree) {
    teamTree.addEventListener('click', handleTeamClick);
  }

  if (clearButton) {
    clearButton.addEventListener('click', handleClear);
  }

  document.addEventListener('click', (event) => {
    if (!atlas.contains(event.target)) {
      setResultsVisibility(false);
    }
  });
}

initPlayerAtlas();

const rumbleTrigger = document.querySelector('[data-rumble-launch]');
const rumbleRoot = document.querySelector('[data-rumble-root]');
const rumbleMeta = document.querySelector('meta[name="rumble-module"]');

if (rumbleRoot && rumbleMeta) {
  const rumbleModuleUrl = new URL(rumbleMeta.getAttribute('content'), document.baseURI).toString();
  let rumbleMountPromise = null;

  const ensureRumbleMounted = async () => {
    if (!rumbleMountPromise) {
      rumbleMountPromise = import(rumbleModuleUrl).then((module) => {
        if (typeof module.mountRosterRumble !== 'function') {
          throw new Error('Roster Rumble module missing mountRosterRumble export');
        }
        return module.mountRosterRumble({
          trigger: rumbleTrigger instanceof HTMLElement ? rumbleTrigger : undefined,
          root: rumbleRoot,
          mode: 'inline',
        });
      });
    }
    return rumbleMountPromise;
  };

  const scrollToRumble = () => {
    try {
      rumbleRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (scrollError) {
      rumbleRoot.scrollIntoView();
    }
  };

  const openInlineRumble = async () => {
    const experience = await ensureRumbleMounted();
    if (!experience.isOpen()) {
      experience.open();
    }
  };

  if (rumbleTrigger) {
    rumbleTrigger.addEventListener('click', (event) => {
      event.preventDefault();
      openInlineRumble();
      scrollToRumble();
    });
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          ensureRumbleMounted();
          observer.disconnect();
        }
      });
    }, { rootMargin: '200px 0px' });
    observer.observe(rumbleRoot);
  } else {
    ensureRumbleMounted();
  }

  if (window.location.hash.startsWith('#rumble=')) {
    ensureRumbleMounted().then((experience) => {
      experience.open();
      scrollToRumble();
    });
  }
}
