import { bdl } from '../assets/js/bdl.js';

const ROSTER_SNAPSHOT_URL = 'data/rosters.json';
let rosterSnapshotPromise = null;

const params = new URLSearchParams(window.location.search);
const rawGameId = params.get('gameId') || params.get('id');

const matchupTitle = document.querySelector('[data-matchup]');
const seasonLabel = document.querySelector('[data-season-label]');
const statusLabel = document.querySelector('[data-status-label]');
const tipoffLabel = document.querySelector('[data-tipoff]');
const countdownLabel = document.querySelector('[data-tipoff-countdown]');
const locationLabel = document.querySelector('[data-location-note]');
const narrativeContainer = document.querySelector('[data-narrative]');
const previewMessage = document.querySelector('[data-preview-message]');
const updatedLabel = document.querySelector('[data-updated]');

const teamTargets = {
  visitor: {
    name: document.querySelector('[data-team-name="visitor"]'),
    record: document.querySelector('[data-team-record="visitor"]'),
    note: document.querySelector('[data-team-note="visitor"]'),
    last5: document.querySelector('[data-team-last5="visitor"]'),
    next5: document.querySelector('[data-team-next5="visitor"]'),
    roster: document.querySelector('[data-team-roster="visitor"]'),
  },
  home: {
    name: document.querySelector('[data-team-name="home"]'),
    record: document.querySelector('[data-team-record="home"]'),
    note: document.querySelector('[data-team-note="home"]'),
    last5: document.querySelector('[data-team-last5="home"]'),
    next5: document.querySelector('[data-team-next5="home"]'),
    roster: document.querySelector('[data-team-roster="home"]'),
  },
};

function setPreviewMessage(message, tone = 'default') {
  if (!previewMessage) {
    return;
  }
  previewMessage.textContent = message;
  previewMessage.dataset.tone = tone;
}

function parseGameId(value) {
  if (!value) {
    return null;
  }
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
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

async function loadRosterSnapshot() {
  if (!rosterSnapshotPromise) {
    rosterSnapshotPromise = fetch(ROSTER_SNAPSHOT_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Roster snapshot request failed with status ${response.status}`);
        }
        return response.json();
      })
      .catch((error) => {
        console.warn('Unable to load roster snapshot', error);
        return null;
      });
  }
  return rosterSnapshotPromise;
}

function buildRosterFromSnapshot(snapshot, teamId) {
  if (!snapshot || !Number.isFinite(teamId)) {
    return null;
  }
  const teams = Array.isArray(snapshot.teams) ? snapshot.teams : [];
  if (!teams.length) {
    return null;
  }
  const targetTeam = teams.find((team) => Number.isFinite(team.id) && team.id === teamId);
  if (!targetTeam) {
    return null;
  }
  const roster = Array.isArray(targetTeam.roster) ? targetTeam.roster : [];
  if (!roster.length) {
    return null;
  }
  const unique = new Map();
  roster.forEach((player) => {
    if (!player) {
      return;
    }
    const id = Number.isFinite(player.id) ? player.id : null;
    if (!id || unique.has(id)) {
      return;
    }
    const first = typeof player.first_name === 'string' ? player.first_name.trim() : '';
    const last = typeof player.last_name === 'string' ? player.last_name.trim() : '';
    const name = `${first} ${last}`.trim() || 'Player';
    const position =
      typeof player.position === 'string' && player.position.trim() ? player.position.trim() : '—';
    const jersey =
      typeof player.jersey_number === 'string' && player.jersey_number.trim()
        ? player.jersey_number.trim()
        : null;
    unique.set(id, { id, name, position, jersey });
  });
  const entries = Array.from(unique.values());
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}

function formatSeasonLabel(season) {
  if (!Number.isFinite(season)) {
    return 'Season TBD';
  }
  const next = season + 1;
  const suffix = String(next).slice(-2);
  return `${season}-${suffix} season`;
}

function formatDateTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(date);
  } catch (error) {
    console.warn('Unable to format date', error);
    return date.toISOString();
  }
}

function formatShortDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch (error) {
    return date.toISOString().slice(0, 10);
  }
}

function formatTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch (error) {
    return '';
  }
}

function diffInHours(target) {
  if (!(target instanceof Date) || Number.isNaN(target.getTime())) {
    return null;
  }
  const now = new Date();
  const deltaMs = target.getTime() - now.getTime();
  return deltaMs / (1000 * 60 * 60);
}

function formatCountdown(target) {
  const diffHours = diffInHours(target);
  if (diffHours === null) {
    return '';
  }
  if (diffHours > 48) {
    const days = Math.round(diffHours / 24);
    return `Tipoff in ${days} day${days === 1 ? '' : 's'}`;
  }
  if (diffHours > 1) {
    const hours = Math.round(diffHours);
    return `Tipoff in ${hours} hours`;
  }
  if (diffHours > 0) {
    const minutes = Math.max(1, Math.round(diffHours * 60));
    return `Tipoff in ${minutes} minutes`;
  }
  if (diffHours > -3) {
    return 'Matchup underway';
  }
  return 'Matchup completed';
}

function normalizeTeam(team) {
  if (!team) {
    return {
      id: null,
      name: 'Team',
      abbreviation: '',
      city: '',
    };
  }
  return {
    id: Number.isFinite(team.id) ? team.id : null,
    name: team.full_name || team.name || 'Team',
    abbreviation: team.abbreviation || '',
    city: team.city || '',
  };
}

function computeStage(status, period) {
  const normalized = (status ?? '').toString().toLowerCase();
  if (normalized.includes('final')) {
    return 'final';
  }
  if (Number(period) > 0) {
    return 'live';
  }
  return 'upcoming';
}

function normalizeGame(raw) {
  if (!raw) {
    return null;
  }
  const tipoff = parseDateTime(raw.datetime) || parseDateOnly(raw.date);
  return {
    id: Number.isFinite(raw.id) ? raw.id : null,
    season: Number.isFinite(raw.season) ? raw.season : null,
    status: typeof raw.status === 'string' ? raw.status : '',
    period: Number.isFinite(raw.period) ? raw.period : 0,
    time: typeof raw.time === 'string' ? raw.time.trim() : '',
    date: typeof raw.date === 'string' ? raw.date : null,
    tipoff,
    stage: computeStage(raw.status, raw.period),
    postseason: Boolean(raw.postseason),
    seasonType: typeof raw.season_type === 'string' ? raw.season_type : '',
    home: normalizeTeam(raw.home_team),
    visitor: normalizeTeam(raw.visitor_team),
  };
}

async function loadGame(gameId) {
  const payload = await bdl(`/v1/games/${gameId}`);
  const raw = payload?.data ?? null;
  return normalizeGame(raw);
}

async function fetchPaginated(path) {
  const results = [];
  let cursor;
  do {
    const url = cursor ? `${path}&cursor=${encodeURIComponent(cursor)}` : path;
    // eslint-disable-next-line no-await-in-loop
    const payload = await bdl(url);
    const data = Array.isArray(payload?.data) ? payload.data : [];
    results.push(...data);
    cursor = payload?.meta?.next_cursor ?? null;
  } while (cursor);
  return results;
}

async function fetchRoster(teamId, season) {
  if (!Number.isFinite(teamId)) {
    return [];
  }
  const snapshot = await loadRosterSnapshot();
  const snapshotRoster = buildRosterFromSnapshot(snapshot, teamId);
  if (snapshotRoster && snapshotRoster.length) {
    return snapshotRoster;
  }
  const seasonParam = Number.isFinite(season) ? `&seasons[]=${season}` : '';
  const path = `/v1/players?per_page=100&team_ids[]=${teamId}${seasonParam}`;
  const players = await fetchPaginated(path);
  const unique = new Map();
  players.forEach((player) => {
    if (!player) {
      return;
    }
    const id = Number.isFinite(player.id) ? player.id : null;
    if (!id) {
      return;
    }
    if (!unique.has(id)) {
      unique.set(id, player);
    }
  });
  const entries = Array.from(unique.values());
  entries.sort((a, b) => {
    const nameA = `${(a?.last_name || '').toLowerCase()} ${(a?.first_name || '').toLowerCase()}`.trim();
    const nameB = `${(b?.last_name || '').toLowerCase()} ${(b?.first_name || '').toLowerCase()}`.trim();
    return nameA.localeCompare(nameB);
  });
  return entries.map((player) => {
    const first = typeof player.first_name === 'string' ? player.first_name.trim() : '';
    const last = typeof player.last_name === 'string' ? player.last_name.trim() : '';
    const name = `${first} ${last}`.trim() || 'Player';
    const position = typeof player.position === 'string' && player.position.trim() ? player.position.trim() : '—';
    const jersey = typeof player.jersey_number === 'string' && player.jersey_number.trim() ? player.jersey_number.trim() : null;
    return { id: player.id, name, position, jersey };
  });
}

function normalizeTeamGame(raw, teamId) {
  if (!raw) {
    return null;
  }
  const tipoff = parseDateTime(raw.datetime) || parseDateOnly(raw.date);
  const isHome = Number.isFinite(raw.home_team?.id) && raw.home_team.id === teamId;
  const isVisitor = Number.isFinite(raw.visitor_team?.id) && raw.visitor_team.id === teamId;
  if (!isHome && !isVisitor) {
    return null;
  }
  const opponentRaw = isHome ? raw.visitor_team : raw.home_team;
  const opponent = normalizeTeam(opponentRaw);
  const pointsFor = isHome ? raw.home_team_score : raw.visitor_team_score;
  const pointsAgainst = isHome ? raw.visitor_team_score : raw.home_team_score;
  const status = typeof raw.status === 'string' ? raw.status.toLowerCase() : '';
  const isFinal = status.includes('final');
  const result = isFinal ? (pointsFor > pointsAgainst ? 'W' : pointsFor < pointsAgainst ? 'L' : 'T') : null;
  return {
    id: Number.isFinite(raw.id) ? raw.id : null,
    tipoff,
    date: typeof raw.date === 'string' ? raw.date : null,
    season: Number.isFinite(raw.season) ? raw.season : null,
    postseason: Boolean(raw.postseason),
    status: typeof raw.status === 'string' ? raw.status : '',
    opponent,
    isHome,
    pointsFor: Number.isFinite(pointsFor) ? pointsFor : 0,
    pointsAgainst: Number.isFinite(pointsAgainst) ? pointsAgainst : 0,
    result,
    final: isFinal,
  };
}

async function fetchTeamGames(teamId, season) {
  if (!Number.isFinite(teamId)) {
    return [];
  }
  const seasonParam = Number.isFinite(season) ? `&seasons[]=${season}` : '';
  const path = `/v1/games?per_page=100&team_ids[]=${teamId}${seasonParam}`;
  const games = await fetchPaginated(path);
  return games
    .map((game) => normalizeTeamGame(game, teamId))
    .filter((entry) => entry !== null)
    .sort((a, b) => {
      const timeA = a.tipoff instanceof Date ? a.tipoff.getTime() : 0;
      const timeB = b.tipoff instanceof Date ? b.tipoff.getTime() : 0;
      return timeA - timeB;
    });
}

function computeRecord(games, cutoff) {
  if (!Array.isArray(games) || !games.length) {
    return { wins: 0, losses: 0, total: 0, averageFor: null, averageAgainst: null, sample: [] };
  }
  const sample = games.filter((game) => game.final && (!cutoff || (game.tipoff instanceof Date && game.tipoff < cutoff)));
  if (!sample.length) {
    return { wins: 0, losses: 0, total: 0, averageFor: null, averageAgainst: null, sample: [] };
  }
  let wins = 0;
  let losses = 0;
  let totalFor = 0;
  let totalAgainst = 0;
  sample.forEach((game) => {
    if (game.result === 'W') {
      wins += 1;
    } else if (game.result === 'L') {
      losses += 1;
    }
    totalFor += game.pointsFor;
    totalAgainst += game.pointsAgainst;
  });
  const averageFor = totalFor / sample.length;
  const averageAgainst = totalAgainst / sample.length;
  return { wins, losses, total: sample.length, averageFor, averageAgainst, sample };
}

function partitionUpcoming(games, cutoff) {
  if (!Array.isArray(games) || !games.length) {
    return [];
  }
  const upcoming = games.filter((game) => game.tipoff instanceof Date && (!cutoff || game.tipoff >= cutoff));
  return upcoming;
}

function formatRecord(record) {
  if (!record) {
    return 'Record unavailable';
  }
  if (!record.total) {
    return 'No games logged yet';
  }
  const winPct = record.total ? (record.wins / record.total) * 100 : 0;
  return `${record.wins}-${record.losses} · ${winPct.toFixed(1)}%`; // Keep percent formatting consistent with other previews
}

function renderList(target, items, emptyMessage) {
  if (!target) {
    return;
  }
  target.innerHTML = '';
  if (!items || !items.length) {
    const li = document.createElement('li');
    li.textContent = emptyMessage;
    target.appendChild(li);
    return;
  }
  items.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = entry;
    target.appendChild(li);
  });
}

function renderRoster(target, roster) {
  if (!target) {
    return;
  }
  target.innerHTML = '';
  if (!roster || !roster.length) {
    const li = document.createElement('li');
    li.textContent = 'Roster will populate once Ball Don\'t Lie logs active players for this season.';
    target.appendChild(li);
    return;
  }
  roster.forEach((player) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = player.name;
    li.appendChild(nameSpan);
    const detailSpan = document.createElement('span');
    const parts = [];
    if (player.jersey) {
      parts.push(`#${player.jersey}`);
    }
    if (player.position && player.position !== '—') {
      parts.push(player.position);
    }
    detailSpan.textContent = parts.join(' · ');
    li.appendChild(detailSpan);
    target.appendChild(li);
  });
}

function renderTeamGames(target, games, options) {
  if (!target) {
    return;
  }
  const { upcoming } = options ?? {};
  if (!games || !games.length) {
    const li = document.createElement('li');
    li.textContent = upcoming
      ? 'No upcoming contests logged in the Ball Don\'t Lie window.'
      : 'No completed contests logged yet.';
    target.innerHTML = '';
    target.appendChild(li);
    return;
  }
  target.innerHTML = '';
  games.forEach((game) => {
    const li = document.createElement('li');
    const dateLabel = formatShortDate(game.tipoff) || game.date || 'Date TBA';
    const opponentLabel = game.opponent.abbreviation || game.opponent.name;
    const locationPrefix = game.isHome ? 'vs' : '@';
    if (upcoming) {
      const timeLabel = formatTime(game.tipoff);
      li.textContent = `${dateLabel} · ${locationPrefix} ${opponentLabel} · ${timeLabel || 'Time TBA'}`;
    } else {
      const scoreLine = `${game.pointsFor}-${game.pointsAgainst}`;
      li.textContent = `${dateLabel} · ${locationPrefix} ${opponentLabel} · ${game.result || ''} ${scoreLine}`.trim();
    }
    target.appendChild(li);
  });
}

function renderTeamSection(role, team, context, opponentName) {
  const targets = teamTargets[role];
  if (!targets) {
    return;
  }
  if (targets.name) {
    targets.name.textContent = team.name;
  }
  if (targets.record) {
    targets.record.textContent = formatRecord(context.record);
  }
  if (targets.note) {
    if (context.record.total) {
      const avgFor = context.record.averageFor?.toFixed(1) ?? null;
      const avgAgainst = context.record.averageAgainst?.toFixed(1) ?? null;
      const differential =
        context.record.averageFor !== null && context.record.averageAgainst !== null
          ? (context.record.averageFor - context.record.averageAgainst).toFixed(1)
          : null;
      const offenseLine = avgFor ? `${avgFor} points for` : null;
      const defenseLine = avgAgainst ? `${avgAgainst} points allowed` : null;
      const pieces = [];
      if (offenseLine) pieces.push(offenseLine);
      if (defenseLine) pieces.push(defenseLine);
      if (differential) pieces.push(`net ${differential}`);
      targets.note.textContent = pieces.length
        ? `${team.name} are averaging ${pieces.join(', ')} across ${context.record.total} contests.`
        : `${team.name} have logged ${context.record.total} contests so far.`;
    } else {
      targets.note.textContent = `${team.name} are awaiting their first result of the ${opponentName} matchup build-up.`;
    }
  }
  renderTeamGames(targets.last5, context.lastFive, { upcoming: false });
  renderTeamGames(targets.next5, context.nextFive, { upcoming: true });
  renderRoster(targets.roster, context.roster);
}

function buildNarrativeLines(game, visitorContext, homeContext) {
  const lines = [];
  const visitorRecord = visitorContext.record;
  const homeRecord = homeContext.record;
  if (visitorRecord.total || homeRecord.total) {
    lines.push(
      `${game.visitor.name} enter at ${formatRecord(visitorRecord)} while ${game.home.name} sit at ${formatRecord(homeRecord)}.`,
    );
  } else {
    lines.push('Both teams are building toward their first logged contests in the Ball Don\'t Lie data feed.');
  }
  if (visitorRecord.averageFor !== null && homeRecord.averageFor !== null) {
    lines.push(
      `${game.visitor.name} are averaging ${visitorRecord.averageFor.toFixed(1)} points while ${game.home.name} are posting ${homeRecord.averageFor.toFixed(1)} per outing.`,
    );
  }
  const visitorUpcoming = Array.isArray(visitorContext.nextFive) ? visitorContext.nextFive[0] : null;
  const homeUpcoming = Array.isArray(homeContext.nextFive) ? homeContext.nextFive[0] : null;
  if (visitorUpcoming) {
    const locationDescriptor = visitorUpcoming.isHome ? 'home tilt' : 'road trip';
    lines.push(
      `${game.visitor.name} continue a ${locationDescriptor} on ${formatShortDate(visitorUpcoming.tipoff)} as part of their run-up.`,
    );
  }
  if (homeUpcoming) {
    const locationDescriptor = homeUpcoming.isHome ? 'home stand' : 'road swing';
    lines.push(
      `${game.home.name} transition into a ${locationDescriptor} on ${formatShortDate(homeUpcoming.tipoff)} immediately after this game.`,
    );
  }
  return lines;
}

function renderNarrative(game, visitorContext, homeContext) {
  if (!narrativeContainer) {
    return;
  }
  const lines = buildNarrativeLines(game, visitorContext, homeContext);
  narrativeContainer.innerHTML = '';
  if (!lines.length) {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Awaiting more Ball Don\'t Lie data to build this storyline.';
    narrativeContainer.appendChild(paragraph);
    return;
  }
  const list = document.createElement('ul');
  lines.forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    list.appendChild(li);
  });
  narrativeContainer.appendChild(list);
}

function formatCountdownNote(tipoff) {
  if (!(tipoff instanceof Date) || Number.isNaN(tipoff.getTime())) {
    return '';
  }
  return formatCountdown(tipoff);
}

async function buildTeamContext(team, game) {
  const [games, roster] = await Promise.all([fetchTeamGames(team.id, game.season), fetchRoster(team.id, game.season)]);
  const record = computeRecord(games, game.tipoff);
  const lastFive = record.sample.slice(-5);
  const nextFive = partitionUpcoming(games, game.tipoff).slice(0, 5);
  return {
    roster,
    record,
    lastFive,
    nextFive,
  };
}

function updateDocumentTitle(game) {
  const matchup = `${game.visitor.abbreviation || game.visitor.name} at ${game.home.abbreviation || game.home.name}`;
  document.title = `${matchup} preview | NBA Intelligence Hub`;
}

async function initialize() {
  const gameId = parseGameId(rawGameId);
  if (!gameId) {
    setPreviewMessage('Add a valid gameId query parameter to generate a preview.', 'error');
    return;
  }
  setPreviewMessage('Loading matchup preview…');
  try {
    const game = await loadGame(gameId);
    if (!game) {
      setPreviewMessage('Unable to locate that matchup in the Ball Don\'t Lie dataset.', 'error');
      return;
    }
    if (game.stage === 'live' || game.stage === 'final') {
      setPreviewMessage('This matchup is now live. Redirecting to the game tracker…');
      const base = document.baseURI || window.location.href;
      const targetUrl = new URL('game-tracker.html', base);
      const redirectId = Number.isFinite(game.id) && game.id ? game.id : gameId;
      targetUrl.searchParams.set('gameId', String(redirectId));
      window.location.replace(targetUrl.toString());
      return;
    }
    const tipoff = game.tipoff;
    if (matchupTitle) {
      const title = `${game.visitor.name} at ${game.home.name}`;
      matchupTitle.textContent = title;
    }
    updateDocumentTitle(game);
    if (seasonLabel) {
      seasonLabel.textContent = formatSeasonLabel(game.season);
    }
    if (statusLabel) {
      statusLabel.textContent = game.status || 'Scheduled';
    }
    if (tipoffLabel) {
      tipoffLabel.textContent = tipoff ? `Local tip ${formatDateTime(tipoff)}` : '';
    }
    if (countdownLabel) {
      countdownLabel.textContent = formatCountdownNote(tipoff);
    }
    if (locationLabel) {
      locationLabel.textContent = game.postseason
        ? 'Postseason contest (venue per league assignment).'
        : '';
    }

    const [visitorContext, homeContext] = await Promise.all([
      buildTeamContext(game.visitor, game),
      buildTeamContext(game.home, game),
    ]);

    renderTeamSection('visitor', game.visitor, visitorContext, game.home.name);
    renderTeamSection('home', game.home, homeContext, game.visitor.name);
    renderNarrative(game, visitorContext, homeContext);

    setPreviewMessage('Preview generated from live Ball Don\'t Lie data.');
    if (updatedLabel) {
      updatedLabel.textContent = formatDateTime(new Date());
    }
  } catch (error) {
    console.error('Failed to build game preview', error);
    setPreviewMessage('Unable to build the preview right now. Please retry in a moment.', 'error');
  }
}

initialize();
