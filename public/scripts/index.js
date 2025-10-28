import { registerCharts, helpers } from './hub-charts.js';
import { createTeamLogo } from './team-logos.js';
import { renderFreeAgents } from './free_agents.js';

const palette = {
  royal: '#1156d6',
  sky: 'rgba(31, 123, 255, 0.85)',
  gold: '#f4b53f',
  red: '#ef3d5b',
  navy: '#0b2545',
};

const preseasonPowerIndex = [
  {
    team: 'Oklahoma City Thunder',
    tier: 'Title inner circle',
    note: 'Returning champs, core intact, minimal regression risk. Their young pieces (Holmgren, Jalen Williams) should still ascend. Biggest threat: health and complacency.',
  },
  {
    team: 'Cleveland Cavaliers',
    tier: 'Title inner circle',
    note: 'Deep, well-coached, with high expectations in the East. If defense tightens and fewer lapses, they’re a real contender.',
  },
  {
    team: 'Houston Rockets',
    tier: 'Title inner circle',
    note: 'The Kevin Durant trade is a statement. If the young core (Amen Thompson, Alperen Şengün, etc.) meshes with KD, this team could leap from sleeper to serious. Risk: chemistry, injuries, usage conflicts.',
  },
  {
    team: 'Denver Nuggets',
    tier: 'Title inner circle',
    note: 'Coaching change is a red flag, but the talent base is solid. They’ll likely still be in the upper tier unless the transition is rocky.',
  },
  {
    team: 'New York Knicks',
    tier: 'Title inner circle',
    note: 'Smart offseason additions, and a new coach in Mike Brown will try to raise consistency. They need to avoid dips vs. more shakeouts in rotation.',
  },
  {
    team: 'Minnesota Timberwolves',
    tier: 'Contender lane',
    note: 'On paper, they have a ceiling that scares teams. If Jarrett Culver / their supporting cast rise and they keep health, they threaten.',
  },
  {
    team: 'Orlando Magic',
    tier: 'Contender lane',
    note: 'Young, improving, and with upside. They might not have the star power to dominate yet, but can surprise mid-tier teams.',
  },
  {
    team: 'Los Angeles Lakers',
    tier: 'Contender lane',
    note: 'LeBron + Dončić is tantalizing, but building depth and managing roles is critical. If those things click, this is a dangerous team.',
  },
  {
    team: 'LA Clippers',
    tier: 'Contender lane',
    note: 'Veteran-laden, win-now mentality. If health holds (especially on wings, bigs), they compete. Risk: lack of spacing, aging roster.',
  },
  {
    team: 'Detroit Pistons',
    tier: 'Contender lane',
    note: 'They surprised last season. I expect them to keep pushing upward, maybe a play-in lock. Key: stability, role clarity, avoiding regression.',
  },
  {
    team: 'Golden State Warriors',
    tier: 'Playoff battleground',
    note: 'Aging core, but with creative lineups they still have dangerous weapons. They’ll need to leverage shooting, basketball IQ, and avoid injury.',
  },
  {
    team: 'Atlanta Hawks',
    tier: 'Playoff battleground',
    note: 'Re-tooling around Trae Young; defensively they must improve. If they shore that up, they move upward; if not, they’ll hover.',
  },
  {
    team: 'San Antonio Spurs',
    tier: 'Playoff battleground',
    note: 'Wembanyama is the long-term beacon; in 2025-26, they have some upside but inconsistencies. They’ll be volatile.',
  },
  {
    team: 'Milwaukee Bucks',
    tier: 'Playoff battleground',
    note: 'Still dangerous. They have to balance veteran retention and transitions. Could overperform if role players deliver.',
  },
  {
    team: 'Memphis Grizzlies',
    tier: 'Playoff battleground',
    note: 'Talent is there, but injuries and consistency always loom. Expect them to be around the fringe of contention.',
  },
  {
    team: 'Miami Heat',
    tier: 'Wild card tier',
    note: 'Strong culture, good coaching. They’re not likely to dominate, but they’ll be scrappy — could be a dark horse for surprises.',
  },
  {
    team: 'Dallas Mavericks',
    tier: 'Wild card tier',
    note: 'They have star power, but questions on spacing, backup plan, and defensive cohesiveness. If key players step up, they swing mid-tier.',
  },
  {
    team: 'Boston Celtics',
    tier: 'Wild card tier',
    note: 'After injuries and roster turnover, they may tread water or dip slightly. They still have enough to be dangerous in spurts.',
  },
  {
    team: 'Indiana Pacers',
    tier: 'Wild card tier',
    note: 'The Haliburton injury looms large. If he recovers well and the supporting cast fills gaps, they can be in a fight. But there’s downside.',
  },
  {
    team: 'Chicago Bulls',
    tier: 'Wild card tier',
    note: 'Too many variables. Talent exists, but consistency and top-tier two-way play must emerge or they’ll stagnate.',
  },
  {
    team: 'Sacramento Kings',
    tier: 'Development stretch',
    note: 'Some intriguing pieces and scoring ability, but defense, depth, and consistency are big questions. They’ll live or die by variance.',
  },
  {
    team: 'Phoenix Suns',
    tier: 'Development stretch',
    note: 'After trading away key names, this is a retooling season. Young players must step up; they may compete for a play-in spot if things go well.',
  },
  {
    team: 'Toronto Raptors',
    tier: 'Development stretch',
    note: 'They’re likely between phases. Solid organization, but lacking a breakout edge. Could surprise occasionally.',
  },
  {
    team: 'Philadelphia 76ers',
    tier: 'Development stretch',
    note: 'Injuries, aging stars, and fit problems make this a risky season. If pockets of uptime are strong, they’ll push, but I lean down.',
  },
  {
    team: 'Portland Trail Blazers',
    tier: 'Development stretch',
    note: 'Emphasis on defense is encouraging, but their roster still has weak spots, especially offensively. Likely in lottery/desperation mode.',
  },
  {
    team: 'New Orleans Pelicans',
    tier: 'Rebuild runway',
    note: 'Health, direction, and roster coherence are big doubts. They might win spurts but expect regression if key parts don’t stay consistent.',
  },
  {
    team: 'Charlotte Hornets',
    tier: 'Rebuild runway',
    note: 'Young team, under construction. Upside through growth, but likely overwhelmed by more experienced squads.',
  },
  {
    team: 'Utah Jazz',
    tier: 'Rebuild runway',
    note: 'They’ve shed veterans; big question: can youth and new acquisitions keep them competitive? I expect losses more than surprises.',
  },
  {
    team: 'Brooklyn Nets',
    tier: 'Rebuild runway',
    note: 'In full rebuild mode with many draft picks. They might show flashes, but overall they’ll struggle consistency & defense.',
  },
  {
    team: 'Washington Wizards',
    tier: 'Rebuild runway',
    note: 'Some young core pieces exist, but the rest of the roster lacks depth and star impact. They’ll likely be at or near bottom unless things break favorably.',
  },
];
let pacePressureDeck = [];
let pacePressureMeta = null;

async function fetchJsonSafe(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('Unable to fetch preview data', url, error);
    return null;
  }
}

async function fetchTextSafe(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${url}: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.warn('Unable to fetch text asset', url, error);
    return null;
  }
}

function safeText(target, value) {
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  if (node && typeof value !== 'undefined' && value !== null) {
    node.textContent = value;
  }
}

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(100, Math.max(0, numeric));
}

function normalizeInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.round(numeric);
}

function computeNextMilestone(total, step) {
  const base = Math.max(0, normalizeInteger(total));
  const increment = Number(step) || 0;
  if (!increment) {
    return base;
  }
  const remainder = base % increment;
  if (remainder === 0) {
    return base + increment;
  }
  return base + (increment - remainder);
}

function buildTeamLookup(franchiseData) {
  const lookup = new Map();
  const franchises = Array.isArray(franchiseData?.activeFranchises) ? franchiseData.activeFranchises : [];
  franchises.forEach((team) => {
    const abbreviation = team?.abbreviation;
    if (!abbreviation) {
      return;
    }
    const teamId = team?.teamId;
    if (!teamId) {
      return;
    }
    const idString = String(teamId);
    if (idString.length < 6) {
      return;
    }
    const label = [team.city, team.name].filter(Boolean).join(' ').trim();
    if (label && !lookup.has(abbreviation)) {
      lookup.set(abbreviation, label);
    }
  });
  return lookup;
}

function formatDateLabel(dateString, options = { month: 'short', day: 'numeric' }) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

function hydrateHero(teamData) {
  const list = document.querySelector('[data-power-index]');
  if (!list) {
    return;
  }

  list.innerHTML = '';

  const teams = Array.isArray(preseasonPowerIndex) ? preseasonPowerIndex : [];
  if (!teams.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'power-board__placeholder';
    placeholder.textContent = 'Power index will populate once the editorial board finalizes rankings.';
    list.appendChild(placeholder);
    return;
  }

  const statLookup = new Map();
  (Array.isArray(teamData?.winPctLeaders) ? teamData.winPctLeaders : []).forEach((team) => {
    if (team?.team) {
      statLookup.set(team.team, team);
    }
  });

  teams.forEach((entry, index) => {
    const item = document.createElement('li');
    item.className = 'power-board__item';

    const teamLabel = entry.team ?? 'Team';

    const marker = document.createElement('span');
    marker.className = 'power-board__marker';
    marker.appendChild(createTeamLogo(teamLabel, 'team-logo team-logo--small'));

    const body = document.createElement('div');
    body.className = 'power-board__content';

    const identity = document.createElement('div');
    identity.className = 'power-board__identity';

    const rank = document.createElement('span');
    rank.className = 'power-board__rank';
    rank.textContent = `#${index + 1}`;

    const name = document.createElement('p');
    name.className = 'power-board__name';
    name.textContent = teamLabel;

    identity.append(rank, name);

    const note = document.createElement('p');
    note.className = 'power-board__note';
    note.textContent = entry.note;

    body.append(identity, note);

    const meta = document.createElement('div');
    meta.className = 'power-board__meta';

    const tier = document.createElement('span');
    tier.className = 'power-board__tier';
    tier.textContent = entry.tier;
    meta.appendChild(tier);

    const stats = statLookup.get(entry.team);
    if (stats) {
      const margin = (stats.pointsPerGame ?? 0) - (stats.opponentPointsPerGame ?? 0);
      const stat = document.createElement('span');
      stat.className = 'power-board__stat';
      stat.textContent = `${helpers.formatNumber((stats.winPct ?? 0) * 100, 1)}% win pct · ${
        margin >= 0 ? '+' : '–'
      }${helpers.formatNumber(Math.abs(margin), 1)} margin`;
      meta.appendChild(stat);
    }

    body.append(meta);

    item.append(marker, body);
    list.appendChild(item);
  });
}

function renderSeasonLead(scheduleData) {
  const lead = document.querySelector('[data-season-lead]');
  if (!lead || !scheduleData) {
    return;
  }
  const totals = scheduleData?.totals ?? {};
  const restSummary = scheduleData?.restSummary ?? {};
  const cupGamesEntry = Array.isArray(scheduleData?.labelBreakdown)
    ? scheduleData.labelBreakdown.find((entry) => entry?.label === 'Emirates NBA Cup')
    : null;
  const cupGamesCount = cupGamesEntry?.games ?? 0;
  const text = `${helpers.formatNumber(totals.regularSeason ?? totals.games ?? 0, 0)} regular-season games, ${helpers.formatNumber(
    restSummary.backToBackIntervals ?? 0,
    0
  )} zero-day rest intervals, and ${helpers.formatNumber(cupGamesCount, 0)} Cup showdowns—every storyline has a lane.`;
  lead.textContent = text;
}

function renderContenderGrid(teamData) {
  const container = document.querySelector('[data-contender-grid]');
  if (!container) {
    return;
  }
  container.innerHTML = '';
  const teams = helpers
    .rankAndSlice(Array.isArray(teamData?.winPctLeaders) ? teamData.winPctLeaders : [], 6, (team) => team.winPct)
    .sort((a, b) => b.winPct - a.winPct);
  if (!teams.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'contender-grid__placeholder';
    placeholder.textContent = 'Contender data is warming up—check back soon.';
    container.appendChild(placeholder);
    return;
  }

  teams.forEach((team, index) => {
    const card = document.createElement('article');
    card.className = 'contender-card';

    const header = document.createElement('header');
    header.className = 'contender-card__header';
    const rank = document.createElement('span');
    rank.className = 'contender-card__rank';
    rank.textContent = String(index + 1);
    const identity = document.createElement('div');
    identity.className = 'contender-card__identity';
    const teamLabel = team.team ?? team.abbreviation ?? 'Team';
    identity.appendChild(createTeamLogo(teamLabel, 'team-logo team-logo--medium'));
    const name = document.createElement('h4');
    name.className = 'contender-card__team';
    name.textContent = teamLabel;
    identity.appendChild(name);
    header.append(rank, identity);

    const metrics = document.createElement('dl');
    metrics.className = 'contender-card__metrics';
    const addMetric = (label, value) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      row.append(term, detail);
      metrics.appendChild(row);
    };
    addMetric('Win rate', `${helpers.formatNumber((team.winPct ?? 0) * 100, 1)}%`);
    const margin = (team.pointsPerGame ?? 0) - (team.opponentPointsPerGame ?? 0);
    const marginLabel = `${margin >= 0 ? '+' : '–'}${helpers.formatNumber(Math.abs(margin), 1)}`;
    addMetric('Scoring margin', marginLabel);
    addMetric('Assist engine', `${helpers.formatNumber(team.assistsPerGame ?? 0, 1)} apg`);

    const note = document.createElement('p');
    note.className = 'contender-card__note';
    note.textContent = `${helpers.formatNumber(team.pointsPerGame ?? 0, 1)} points per night, ${helpers.formatNumber(
      team.opponentPointsPerGame ?? 0,
      1
    )} allowed.`;

    card.append(header, metrics, note);
    container.appendChild(card);
  });
}

function renderBackToBack(scheduleData) {
  const list = document.querySelector('[data-back-to-back-list]');
  if (!list) {
    return;
  }
  list.innerHTML = '';
  const leaders = Array.isArray(scheduleData?.backToBackLeaders) ? scheduleData.backToBackLeaders.slice(0, 5) : [];
  if (!leaders.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'rest-list__placeholder';
    placeholder.textContent = 'Back-to-back intensity data is still syncing.';
    list.appendChild(placeholder);
  } else {
    leaders.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'rest-list__item';
      const rank = document.createElement('span');
      rank.className = 'rest-list__rank';
      rank.textContent = String(index + 1);
      const body = document.createElement('div');
      body.className = 'rest-list__content';
      const identity = document.createElement('div');
      identity.className = 'rest-list__identity';
      const teamLabel = entry.name ?? entry.abbreviation ?? 'NBA';
      identity.appendChild(createTeamLogo(teamLabel, 'team-logo team-logo--small'));
      const team = document.createElement('p');
      team.className = 'rest-list__team';
      team.textContent = teamLabel;
      identity.appendChild(team);
      const meta = document.createElement('p');
      meta.className = 'rest-list__meta';
      meta.textContent = `${helpers.formatNumber(entry.backToBacks ?? 0, 0)} back-to-backs · ${helpers.formatNumber(
        entry.averageRestDays ?? 0,
        2
      )} avg rest days`;
      const notes = document.createElement('p');
      notes.className = 'rest-list__notes';
      notes.textContent = `Home stand max: ${helpers.formatNumber(entry.longestHomeStand ?? 0, 0)} · Road trip max: ${helpers.formatNumber(
        entry.longestRoadTrip ?? 0,
        0
      )}`;
      body.append(identity, meta, notes);
      item.append(rank, body);
      list.appendChild(item);
    });
  }

  const restAverage = document.querySelector('[data-rest-average]');
  if (restAverage) {
    restAverage.textContent = `${helpers.formatNumber(scheduleData?.restSummary?.averageRestDays ?? 0, 2)} days`;
  }
  safeText('[data-rest-intervals]', helpers.formatNumber(scheduleData?.restSummary?.totalIntervals ?? 0, 0));
}

function renderMilestoneChase(leadersData, rosterIndex, franchiseData) {
  const container = document.querySelector('[data-milestone-chase]');
  if (!container) {
    return;
  }

  container.innerHTML = '';

  const resolveSeries = (categoryKey) => {
    const activeSeries = leadersData?.milestoneChase?.leaders?.[categoryKey];
    if (Array.isArray(activeSeries) && activeSeries.length) {
      return activeSeries;
    }

    const fallbackSeries = leadersData?.careerLeaders?.[categoryKey];
    if (Array.isArray(fallbackSeries)) {
      return fallbackSeries;
    }

    return [];
  };

  const activePlayers = new Map();
  const rosterEntries = Array.isArray(rosterIndex?.players) ? rosterIndex.players : [];
  rosterEntries.forEach((player) => {
    if (!player || typeof player.id === 'undefined') {
      return;
    }
    activePlayers.set(String(player.id), player);
  });

  const categories = [
    { key: 'points', tag: 'Scoring climb', metric: 'points', perGame: 'pointsPerGame', step: 1000, unit: 'points', shortUnit: 'pts' },
    { key: 'assists', tag: 'Assist tracker', metric: 'assists', perGame: 'assistsPerGame', step: 500, unit: 'assists', shortUnit: 'ast' },
    { key: 'rebounds', tag: 'Glass patrol', metric: 'rebounds', perGame: 'reboundsPerGame', step: 500, unit: 'rebounds', shortUnit: 'reb' },
  ];

  const teamLookup = buildTeamLookup(franchiseData);
  const deck = [];

  categories.forEach((category) => {
    const series = resolveSeries(category.key);
    if (!series.length) {
      return;
    }
    const candidate = series.find((entry) => activePlayers.has(String(entry.personId)));
    if (!candidate) {
      return;
    }

    const total = normalizeInteger(candidate[category.metric]);
    if (total <= 0) {
      return;
    }

    const milestone = computeNextMilestone(total, category.step);
    const remaining = milestone - total;
    if (remaining <= 0) {
      return;
    }

    const perGame = Number(candidate[category.perGame] ?? 0) || 0;
    const gamesAway = perGame > 0 ? Math.max(1, Math.ceil(remaining / perGame)) : null;

    const rosterInfo = activePlayers.get(String(candidate.personId));
    const teamAbbr = rosterInfo?.team_abbr ?? rosterInfo?.teamAbbr ?? null;
    const teamLabel = teamAbbr ? teamLookup.get(teamAbbr) ?? teamAbbr : null;

    const gamesPlayed = normalizeInteger(candidate.games);
    const firstSeason = Number(candidate.firstSeason);
    const lastSeason = Number(candidate.lastSeason);
    const hasSeasons = Number.isFinite(firstSeason) && Number.isFinite(lastSeason);
    const span = hasSeasons ? Math.max(1, lastSeason - firstSeason + 1) : null;

    const bullets = [];
    bullets.push(`Career total: ${helpers.formatNumber(total, 0)} ${category.unit} across ${helpers.formatNumber(gamesPlayed, 0)} games.`);
    if (gamesAway) {
      bullets.push(`Per-game pace: ${helpers.formatNumber(perGame, 1)} ${category.shortUnit}/game → approx ${helpers.formatNumber(gamesAway, 0)} games to milestone.`);
    }
    const contextParts = [];
    if (teamLabel) {
      contextParts.push(`Current roster: ${teamLabel}`);
    }
    if (span && hasSeasons) {
      contextParts.push(`Seasons: ${firstSeason}–${lastSeason} (${helpers.formatNumber(span, 0)})`);
    }
    if (contextParts.length) {
      bullets.push(contextParts.join(' · '));
    }

    deck.push({
      tag: category.tag,
      title: candidate.name ?? 'Player',
      summary: `${helpers.formatNumber(remaining, 0)} ${category.unit} until ${helpers.formatNumber(milestone, 0)} career ${category.unit}.`,
      bullets,
      remaining,
    });
  });

  deck.sort((a, b) => a.remaining - b.remaining);

  const visibleDeck = deck.slice(0, 3);

  if (!visibleDeck.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'milestone-chase__placeholder';
    placeholder.textContent = 'Milestone tracking unlocks once active BallDontLie data populates.';
    container.appendChild(placeholder);
    return;
  }

  visibleDeck.forEach((entry) => {
    const card = document.createElement('article');
    card.className = 'milestone-card';

    const header = document.createElement('header');
    const tag = document.createElement('span');
    tag.className = 'milestone-card__tag';
    tag.textContent = entry.tag;
    const title = document.createElement('h3');
    title.textContent = entry.title;
    header.append(tag, title);
    card.appendChild(header);

    const summary = document.createElement('p');
    summary.textContent = entry.summary;
    card.appendChild(summary);

    if (Array.isArray(entry.bullets) && entry.bullets.length) {
      const list = document.createElement('ul');
      entry.bullets.forEach((bullet) => {
        if (!bullet) return;
        const item = document.createElement('li');
        item.textContent = bullet;
        list.appendChild(item);
      });
      if (list.childElementCount) {
        card.appendChild(list);
      }
    }

    container.appendChild(card);
  });
}

function renderStoryCards(storyData) {
  const grid = document.querySelector('[data-story-grid]');
  if (!grid) {
    return;
  }
  grid.innerHTML = '';
  const stories = Array.isArray(storyData?.stories) ? storyData.stories.slice(0, 3) : [];
  if (!stories.length) {
    const placeholder = document.createElement('article');
    placeholder.className = 'story-verse__placeholder';
    placeholder.textContent = 'Narrative walkthroughs unlock as soon as the data feed syncs.';
    grid.appendChild(placeholder);
    return;
  }

  stories.forEach((story) => {
    const card = document.createElement('article');
    card.className = 'story-card';
    const header = document.createElement('header');
    header.className = 'story-card__header';
    const eyebrow = document.createElement('span');
    eyebrow.className = 'story-card__eyebrow';
    eyebrow.textContent = story.metric?.label ?? 'Featured metric';
    const title = document.createElement('h3');
    title.textContent = story.title;
    header.append(eyebrow, title);

    const lede = document.createElement('p');
    lede.className = 'story-card__lede';
    lede.textContent = story.lede;

    const metric = document.createElement('div');
    metric.className = 'story-card__metric';
    const metricValue = document.createElement('span');
    metricValue.className = 'story-card__metric-value';
    metricValue.textContent = story.metric?.value ?? '';
    const metricContext = document.createElement('span');
    metricContext.className = 'story-card__metric-context';
    metricContext.textContent = story.metric?.context ?? '';
    metric.append(metricValue, metricContext);

    const points = document.createElement('ul');
    points.className = 'story-card__points';
    (Array.isArray(story.editorial) ? story.editorial.slice(0, 3) : []).forEach((point) => {
      const li = document.createElement('li');
      li.textContent = point;
      points.appendChild(li);
    });

    const spotlights = document.createElement('div');
    spotlights.className = 'story-card__spotlights';
    (Array.isArray(story.spotlights) ? story.spotlights.slice(0, 3) : []).forEach((spotlight) => {
      const highlight = document.createElement('span');
      highlight.className = 'story-card__spotlight';
      const value = document.createElement('strong');
      value.textContent = spotlight.value;
      const label = document.createElement('small');
      label.textContent = spotlight.label;
      const context = document.createElement('em');
      context.textContent = spotlight.context;
      highlight.append(value, label, context);
      spotlights.appendChild(highlight);
    });

    card.append(header, lede, metric, points, spotlights);
    grid.appendChild(card);
  });
}

async function renderInjuryPulse() {
  const container = document.querySelector('[data-injury-report]');
  const footnote = document.querySelector('[data-injury-footnote]');
  if (!container) {
    return;
  }

  container.innerHTML = '';
  if (footnote) {
    footnote.textContent = '';
  }

  const loading = document.createElement('p');
  loading.className = 'injury-grid__placeholder';
  loading.textContent = 'Syncing the live injury feed...';
  container.appendChild(loading);

  const payload = await fetchJsonSafe('data/player_injuries.json');
  container.innerHTML = '';

  if (!payload || !Array.isArray(payload.items)) {
    const errorMessage = document.createElement('p');
    errorMessage.className = 'injury-grid__placeholder';
    errorMessage.textContent = 'Unable to load the live injury feed right now.';
    container.appendChild(errorMessage);
    if (footnote) {
      footnote.textContent = 'Injury feed temporarily unavailable.';
    }
    return;
  }

  const entries = payload.items.slice(0, 10);
  if (!entries.length) {
    const placeholder = document.createElement('p');
    placeholder.className = 'injury-grid__placeholder';
    placeholder.textContent = 'No current injury reports available.';
    container.appendChild(placeholder);
  } else {
    const allowedStatuses = new Set(['season', 'caution', 'monitor', 'ready']);

    entries.forEach((entry) => {
      const card = document.createElement('article');
      card.className = 'injury-card';

      const header = document.createElement('header');
      header.className = 'injury-card__header';

      const identity = document.createElement('div');
      identity.className = 'injury-card__identity';
      const teamIdentifier = entry.team_tricode || entry.team_name || '';
      identity.appendChild(createTeamLogo(teamIdentifier || 'NBA', 'team-logo team-logo--small'));

      const label = document.createElement('div');
      label.className = 'injury-card__label';
      const name = document.createElement('strong');
      name.textContent = entry.player || 'Unnamed player';
      label.appendChild(name);
      const teamText = entry.team_name || entry.team_tricode;
      if (teamText) {
        const team = document.createElement('span');
        team.textContent = teamText;
        label.appendChild(team);
      }
      identity.appendChild(label);
      header.appendChild(identity);

      const status = document.createElement('span');
      const level = typeof entry.status_level === 'string' ? entry.status_level.toLowerCase() : 'monitor';
      const safeLevel = allowedStatuses.has(level) ? level : 'monitor';
      status.className = `injury-card__status injury-card__status--${safeLevel}`;
      status.textContent = entry.status || 'Status unavailable';
      header.appendChild(status);

      card.appendChild(header);

      const metrics = document.createElement('dl');
      metrics.className = 'injury-card__metrics';

      const addMetric = (labelText, valueText) => {
        if (!labelText || !valueText) {
          return;
        }
        const row = document.createElement('div');
        row.className = 'injury-card__metric';
        const term = document.createElement('dt');
        term.textContent = labelText;
        const detail = document.createElement('dd');
        detail.textContent = valueText;
        row.append(term, detail);
        metrics.appendChild(row);
      };

      const reportLabel = (() => {
        if (typeof entry.report_label === 'string' && entry.report_label.trim()) {
          return entry.report_label.trim();
        }
        if (typeof entry.last_updated === 'string') {
          const formatted = formatDateLabel(entry.last_updated, { month: 'short', day: 'numeric' });
          if (formatted) {
            return formatted;
          }
        }
        return '';
      })();

      if (reportLabel) {
        addMetric('Report', reportLabel);
      }

      if (typeof entry.return_date === 'string' && entry.return_date.trim()) {
        addMetric('Return', entry.return_date.trim());
      }

      if (metrics.childElementCount) {
        card.appendChild(metrics);
      }

      if (typeof entry.description === 'string' && entry.description.trim()) {
        const note = document.createElement('p');
        note.className = 'injury-card__note';
        note.textContent = entry.description.trim();
        card.appendChild(note);
      }

      container.appendChild(card);
    });
  }

  const source = typeof payload.source === 'string' && payload.source.trim() ? payload.source.trim() : 'Live league data feed';
  const fetchedAt = typeof payload.fetched_at === 'string' ? payload.fetched_at : '';
  const sanitizedNote = (() => {
    if (typeof payload.note === 'string' && payload.note.trim()) {
      return payload.note.replace(/Ball Don't Lie/gi, 'live league injury feed').trim();
    }
    return '';
  })();
  let footnoteText = sanitizedNote || `Source: ${source} injury feed.`;
  if (fetchedAt) {
    const fetchedDate = new Date(fetchedAt);
    if (!Number.isNaN(fetchedDate.getTime())) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      });
      footnoteText = `${footnoteText} Updated ${formatter.format(fetchedDate)} UTC.`;
    }
  }
  if (footnote) {
    footnote.textContent = footnoteText;
  }
}

async function loadPacePressure() {
  try {
    const response = await fetch('data/pace_pressure.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load pace pressure deck: ${response.status}`);
    }
    const payload = await response.json();
    const parseFinite = (value) => {
      if (value === null || value === undefined) {
        return null;
      }
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    };

    const teams = Array.isArray(payload?.teams) ? payload.teams : [];
    pacePressureDeck = teams
      .map((team) => {
        const paceProjection = parseFinite(team?.paceProjection);
        const tempoScore = parseFinite(team?.tempoScore);
        if (paceProjection === null || tempoScore === null) {
          return null;
        }
        const tempoDelta = parseFinite(team?.tempoDelta) ?? 0;
        const backToBacks = parseFinite(team?.backToBacks);
        const averageRestDays = parseFinite(team?.averageRestDays);
        const roadGames = parseFinite(team?.roadGames);
        const teamName =
          typeof team?.team === 'string' && team.team.trim()
            ? team.team.trim()
            : null;
        const tricodeCandidate =
          typeof team?.tricode === 'string' && team.tricode.trim()
            ? team.tricode.trim()
            : typeof team?.abbreviation === 'string' && team.abbreviation.trim()
            ? team.abbreviation.trim()
            : null;
        return {
          team: teamName ?? tricodeCandidate ?? 'Team',
          tricode: tricodeCandidate,
          paceProjection,
          tempoScore,
          tempoDelta,
          backToBacks,
          averageRestDays,
          roadGames,
          note: typeof team?.note === 'string' && team.note.trim() ? team.note.trim() : null,
        };
      })
      .filter((entry) => entry !== null);

    pacePressureMeta = {
      generatedAt: typeof payload?.generatedAt === 'string' ? payload.generatedAt : null,
      source:
        typeof payload?.source === 'string' && payload.source.trim()
          ? payload.source.trim()
          : "Ball Don't Lie",
      season:
        typeof payload?.season === 'string' && payload.season.trim()
          ? payload.season.trim()
          : '2024-25',
      sampleStartDate:
        typeof payload?.sampleStartDate === 'string' && payload.sampleStartDate.trim()
          ? payload.sampleStartDate.trim()
          : null,
      leagueAveragePace: parseFinite(payload?.leagueAveragePace),
    };
  } catch (error) {
    console.error('Failed to load pace pressure data', error);
    pacePressureDeck = [];
    pacePressureMeta = null;
  }
  renderPaceRadar();
}

function renderPaceRadar() {
  const list = document.querySelector('[data-pace-radar]');
  const footnote = document.querySelector('[data-pace-footnote]');
  if (!list) {
    return;
  }

  list.innerHTML = '';

  const deck = Array.isArray(pacePressureDeck) ? pacePressureDeck : [];

  if (!deck.length) {
    const placeholder = document.createElement('li');
    placeholder.className = 'tempo-gauge__placeholder';
    placeholder.textContent = 'Tempo telemetry syncing…';
    list.appendChild(placeholder);
  } else {
    deck.forEach((entry, index) => {
      const item = document.createElement('li');
      item.className = 'tempo-gauge__item';

      const header = document.createElement('header');
      header.className = 'tempo-gauge__header';

      const rank = document.createElement('span');
      rank.className = 'tempo-gauge__rank';
      rank.textContent = String(index + 1);
      header.appendChild(rank);

      const identity = document.createElement('div');
      identity.className = 'tempo-gauge__identity';
      identity.appendChild(createTeamLogo(entry.tricode ?? entry.team, 'team-logo team-logo--small'));
      const team = document.createElement('p');
      team.className = 'tempo-gauge__team';
      team.textContent = entry.team;
      identity.appendChild(team);
      header.appendChild(identity);

      const delta = Number(entry.tempoDelta) || 0;
      const tag = document.createElement('span');
      tag.className = `tempo-gauge__tag ${delta >= 2 ? 'tempo-gauge__tag--surge' : 'tempo-gauge__tag--steady'}`;
      tag.textContent = `${delta >= 0 ? '+' : '−'}${helpers.formatNumber(Math.abs(delta), 1)} possessions`;
      header.appendChild(tag);

      item.appendChild(header);

      const meter = document.createElement('div');
      meter.className = 'tempo-gauge__meter';
      meter.style.setProperty('--fill', `${clampPercent(entry.tempoScore)}%`);
      const meterLabel = document.createElement('span');
      meterLabel.textContent = `${helpers.formatNumber(entry.paceProjection, 1)} pace projection`;
      meter.appendChild(meterLabel);
      item.appendChild(meter);

      const meta = document.createElement('p');
      meta.className = 'tempo-gauge__meta';
      const metaParts = [];
      if (Number.isFinite(entry.roadGames)) {
        metaParts.push(`Road games: ${helpers.formatNumber(entry.roadGames, 0)}`);
      }
      if (Number.isFinite(entry.backToBacks)) {
        metaParts.push(`Back-to-backs: ${helpers.formatNumber(entry.backToBacks, 0)}`);
      }
      if (Number.isFinite(entry.averageRestDays)) {
        metaParts.push(`Avg rest: ${helpers.formatNumber(entry.averageRestDays, 2)} days`);
      }
      meta.textContent = metaParts.join(' · ') || 'Schedule inputs syncing…';
      item.appendChild(meta);

      if (entry.note) {
        const note = document.createElement('p');
        note.className = 'tempo-gauge__note';
        note.textContent = entry.note;
        item.appendChild(note);
      }

      list.appendChild(item);
    });
  }

  if (footnote) {
    if (pacePressureMeta) {
      const { source, season, sampleStartDate, leagueAveragePace, generatedAt } = pacePressureMeta;
      const descriptorParts = [];
      if (sampleStartDate) {
        descriptorParts.push(`sample from ${sampleStartDate}`);
      }
      if (Number.isFinite(leagueAveragePace)) {
        descriptorParts.push(`league pace ${helpers.formatNumber(leagueAveragePace, 1)}`);
      }
      const baseLabel = `Source: ${source} ${season} tempo sample`;
      let footnoteText = descriptorParts.length
        ? `${baseLabel} — ${descriptorParts.join(' · ')}.`
        : `${baseLabel}.`;
      if (generatedAt) {
        const generatedDate = new Date(generatedAt);
        if (!Number.isNaN(generatedDate.getTime())) {
          const formatter = new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC',
          });
          footnoteText = `${footnoteText} Updated ${formatter.format(generatedDate)} UTC.`;
        }
      }
      footnote.textContent = footnoteText;
    } else {
      footnote.textContent = 'Tempo pressure score normalizes 95-105 possessions per 48; the meter peaks when projections hit 105.';
    }
  }
}

async function resolveScheduleSource() {
  const fallback = 'data/season_25_26_schedule.json';
  try {
    const response = await fetch('data/schedule_manifest.json');
    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.status}`);
    }
    const manifest = await response.json();
    const seasons = Array.isArray(manifest?.seasons) ? manifest.seasons : [];
    const primary = seasons.find((season) => season?.current) ?? seasons[0];
    if (primary?.path && typeof primary.path === 'string') {
      return primary.path;
    }
  } catch (error) {
    console.warn('Falling back to default schedule source', error);
  }
  return fallback;
}

async function bootstrap() {
  renderFreeAgents().catch((error) =>
    console.error('Unable to render free agent board during bootstrap', error)
  );
  renderPaceRadar();
  const [scheduleSource] = await Promise.all([resolveScheduleSource(), loadPacePressure()]);

  registerCharts([
    {
      element: document.querySelector('[data-chart="season-volume"]'),
      source: scheduleSource,
      async createConfig(data) {
        const months = Array.isArray(data?.monthlyCounts) ? data.monthlyCounts : [];
        if (!months.length) return null;
        const labels = months.map((entry) => entry.label);
        const preseason = months.map((entry) => entry.preseason || 0);
        const regularSeason = months.map((entry) => entry.regularSeason || 0);
        const otherPlay = months.map(
          (entry) => Math.max(0, (entry.games || 0) - (entry.preseason || 0) - (entry.regularSeason || 0))
        );

        return {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Regular season',
                data: regularSeason,
                backgroundColor: palette.royal,
              },
              {
                label: 'Preseason',
                data: preseason,
                backgroundColor: palette.gold,
              },
              {
                label: 'Cup & postseason',
                data: otherPlay,
                backgroundColor: palette.red,
              },
            ],
          },
          options: {
            layout: { padding: { top: 8, right: 12, bottom: 0, left: 0 } },
            scales: {
              x: {
                stacked: true,
                grid: { display: false },
              },
              y: {
                stacked: true,
                beginAtZero: true,
                ticks: {
                  callback: (value) => `${helpers.formatNumber(value, 0)}`,
                },
              },
            },
            plugins: {
              legend: {
                position: 'bottom',
              },
              tooltip: {
                callbacks: {
                  label(context) {
                    return `${context.dataset.label}: ${helpers.formatNumber(context.parsed.y, 0)} games`;
                  },
                },
              },
            },
          },
        };
      },
    },
    {
      element: document.querySelector('[data-chart="team-efficiency"]'),
      source: 'data/team_performance.json',
      async createConfig(data) {
        const teams = helpers
          .rankAndSlice(Array.isArray(data?.winPctLeaders) ? data.winPctLeaders : [], 12, (team) => team.winPct)
          .map((team) => ({
            x: Number(team.pointsPerGame.toFixed(2)),
            y: Number(team.opponentPointsPerGame.toFixed(2)),
            winPct: team.winPct,
            team: team.team,
          }))
          .sort((a, b) => b.winPct - a.winPct);
        if (!teams.length) return null;

        return {
          type: 'scatter',
          data: {
            datasets: [
              {
                label: 'Top franchises',
                data: teams,
                pointBackgroundColor: palette.royal,
                pointBorderColor: palette.sky,
                pointBorderWidth: 1.5,
                pointRadius: (ctx) => 5 + ctx.raw.winPct * 6,
                pointHoverRadius: (ctx) => 7 + ctx.raw.winPct * 6,
              },
            ],
          },
          options: {
            layout: { padding: 8 },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label(context) {
                    const { raw } = context;
                    return `${raw.team}: ${helpers.formatNumber(raw.winPct * 100, 1)}% win — ${helpers.formatNumber(raw.x, 2)} pts for, ${helpers.formatNumber(raw.y, 2)} pts allowed`;
                  },
                },
              },
            },
            scales: {
              x: {
                title: { display: true, text: 'Points scored per game' },
                grid: { color: 'rgba(11, 37, 69, 0.08)' },
              },
              y: {
                title: { display: true, text: 'Points allowed per game' },
                grid: { color: 'rgba(11, 37, 69, 0.08)' },
              },
            },
          },
        };
      },
    },
    {
      element: document.querySelector('[data-chart="global-pipeline"]'),
      source: 'data/players_overview.json',
      async createConfig(data) {
        const countries = helpers.rankAndSlice(Array.isArray(data?.countries) ? data.countries : [], 12, (c) => c.players);
        if (!countries.length) return null;
        countries.sort((a, b) => b.players - a.players);
        const labels = countries.map((entry) => entry.country);
        const players = countries.map((entry) => entry.players);

        return {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Players produced',
                data: players,
                backgroundColor: palette.royal,
              },
            ],
          },
          options: {
            indexAxis: 'y',
            layout: { padding: { right: 8, left: 8, top: 4, bottom: 4 } },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: 'rgba(11, 37, 69, 0.08)' },
                ticks: {
                  callback: (value) => `${helpers.formatNumber(value, 0)}`,
                },
              },
              y: {
                grid: { display: false },
              },
            },
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
          },
        };
      },
    },
  ]);


  const [scheduleData, teamData, storyData, playerLeaders, rosterIndex, franchiseData] = await Promise.all([
    fetchJsonSafe(scheduleSource),
    fetchJsonSafe('data/team_performance.json'),
    fetchJsonSafe('data/storytelling_walkthroughs.json'),
    fetchJsonSafe('data/player_leaders.json'),
    fetchJsonSafe('data/players_index.json'),
    fetchJsonSafe('data/active_franchises.json'),
  ]);

  await renderInjuryPulse();
  renderPaceRadar();
  hydrateHero(teamData);
  renderSeasonLead(scheduleData);
  renderContenderGrid(teamData);
  renderBackToBack(scheduleData);
  renderMilestoneChase(playerLeaders, rosterIndex, franchiseData);
  renderStoryCards(storyData);
}

bootstrap();
