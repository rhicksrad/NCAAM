import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repoRoot = join(__dirname, '..');
const scheduleCandidates = [
  { seasonKey: '25_26', label: '2025-26', csv: 'LeagueSchedule25_26.csv', json: 'season_25_26_schedule.json' },
  { seasonKey: '24_25', label: '2024-25', csv: 'LeagueSchedule24_25.csv', json: 'season_24_25_schedule.json' },
];
const teamHistoryCsvPath = join(repoRoot, 'TeamHistories.csv');
const outputDir = join(repoRoot, 'public', 'data');

const activeSeason = scheduleCandidates.find((candidate) => existsSync(join(repoRoot, candidate.csv)));

if (!activeSeason) {
  throw new Error('No LeagueScheduleXX_YY.csv file found. Run fetch_schedule_from_bref.py first.');
}

const scheduleCsvPath = join(repoRoot, activeSeason.csv);
const outputPath = join(outputDir, activeSeason.json);

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = splitCsvLine(lines.shift()).map((value) => value.trim());
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const parts = splitCsvLine(line).map((value) => value.trim());
      if (parts.length !== headers.length) {
        throw new Error(`Unexpected column count on line ${index + 2}: ${line}`);
      }
      const record = {};
      headers.forEach((header, idx) => {
        record[header] = parts[idx] ?? '';
      });
      return record;
    });
}

function toNumber(value) {
  if (!value || value.length === 0) return null;
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

function buildTeamDirectory() {
  const csv = readFileSync(teamHistoryCsvPath, 'utf8');
  const rows = parseCsv(csv);
  const currentYear = new Date().getFullYear();
  const active = rows.filter((row) => {
    const activeTill = toNumber(row.seasonActiveTill);
    return activeTill !== null && activeTill >= currentYear;
  });

  const byTeam = new Map();
  for (const entry of active) {
    const seasonFounded = toNumber(entry.seasonFounded) ?? currentYear;
    const existing = byTeam.get(entry.teamId);
    if (!existing || seasonFounded > (toNumber(existing.seasonFounded) ?? currentYear)) {
      byTeam.set(entry.teamId, entry);
    }
  }

  return byTeam;
}

function parseDate(value) {
  if (!value) return null;
  const normalized = value.replace(' ', 'T');
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

function buildScheduleSnapshot() {
  const scheduleCsv = readFileSync(scheduleCsvPath, 'utf8');
  const scheduleRows = parseCsv(scheduleCsv);
  const teamDirectory = buildTeamDirectory();

  const totals = {
    games: scheduleRows.length,
    preseason: 0,
    regularSeason: 0,
    other: 0,
  };
  const teams = new Map();
  const monthlyCounts = new Map();
  const specialGames = [];
  const labelCounts = new Map();

  let earliestDate = null;
  let latestDate = null;

  for (const row of scheduleRows) {
    const date = parseDate(row.gameDateTimeEst);
    const rawLabel = row.gameLabel?.trim() ?? '';
    const label = rawLabel.length > 0 ? rawLabel : 'Regular Season';
    const labelKey = label;
    const normalizedLabel = label.toLowerCase();
    const isPreseason = normalizedLabel === 'preseason';
    const isRegularSeason = normalizedLabel === 'regular season';
    const labelCount = labelCounts.get(labelKey) ?? 0;
    labelCounts.set(labelKey, labelCount + 1);
    if (date) {
      if (!earliestDate || date < earliestDate) earliestDate = date;
      if (!latestDate || date > latestDate) latestDate = date;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthRecord = monthlyCounts.get(monthKey) ?? {
        key: monthKey,
        label: new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(date),
        games: 0,
        preseason: 0,
        regularSeason: 0,
      };
      monthRecord.games += 1;
      if (isPreseason) {
        monthRecord.preseason += 1;
      } else if (isRegularSeason) {
        monthRecord.regularSeason += 1;
      }
      monthlyCounts.set(monthKey, monthRecord);
    }

    if (isPreseason) {
      totals.preseason += 1;
    } else if (isRegularSeason) {
      totals.regularSeason += 1;
    } else {
      totals.other += 1;
    }

    const teamsInGame = [
      { teamId: row.hometeamId, role: 'home' },
      { teamId: row.awayteamId, role: 'away' },
    ];
    for (const { teamId, role } of teamsInGame) {
      if (!teamId) continue;
      const teamRecord = teams.get(teamId) ?? {
        teamId,
        preseasonGames: 0,
        regularSeasonGames: 0,
        otherGames: 0,
        homeGames: 0,
        awayGames: 0,
        firstGame: null,
        lastGame: null,
        games: [],
        backToBacks: 0,
        averageRestDays: null,
        longestHomeStand: 0,
        longestRoadTrip: 0,
      };
      if (isPreseason) {
        teamRecord.preseasonGames += 1;
      } else if (isRegularSeason) {
        teamRecord.regularSeasonGames += 1;
      } else {
        teamRecord.otherGames += 1;
      }
      if (role === 'home') {
        teamRecord.homeGames += 1;
      } else {
        teamRecord.awayGames += 1;
      }
      if (date) {
        if (!teamRecord.firstGame || date < teamRecord.firstGame) {
          teamRecord.firstGame = date;
        }
        if (!teamRecord.lastGame || date > teamRecord.lastGame) {
          teamRecord.lastGame = date;
        }
        teamRecord.games.push({ date, isHome: role === 'home' });
      } else {
        teamRecord.games.push({ date: null, isHome: role === 'home' });
      }
      teams.set(teamId, teamRecord);
    }

    const subtype = row.gameSubtype?.trim();
    const subLabel = row.gameSubLabel?.trim();
    const seriesText = row.seriesText?.trim();
    if ((subtype && subtype.length > 0) || (subLabel && subLabel.length > 0) || (seriesText && seriesText.length > 0)) {
      specialGames.push({
        gameId: row.gameId,
        date: date ? date.toISOString() : null,
        arena: row.arenaName,
        city: row.arenaCity,
        state: row.arenaState,
        label: row.gameLabel,
        subLabel: subLabel || null,
        subtype: subtype || null,
        seriesText: seriesText || null,
        hometeamId: row.hometeamId,
        awayteamId: row.awayteamId,
      });
    }
  }

  const restBucketDefinitions = [
    { label: '0 days', test: (days) => days < 1.25 },
    { label: '1 day', test: (days) => days < 2.25 },
    { label: '2 days', test: (days) => days < 3.25 },
    { label: '3+ days', test: () => true },
  ];

  const restBucketCounts = new Map(restBucketDefinitions.map((bucket) => [bucket.label, 0]));
  let totalRestIntervals = 0;
  let totalRestDays = 0;
  let totalBackToBacks = 0;

  for (const team of teams.values()) {
    const chronologicalGames = team.games
      .filter((game) => game.date instanceof Date)
      .sort((a, b) => a.date - b.date);

    let previousGame = null;
    let homeStreak = 0;
    let roadStreak = 0;
    let longestHome = 0;
    let longestRoad = 0;
    let restIntervals = 0;
    let restTotal = 0;
    let backToBacks = 0;

    for (const game of chronologicalGames) {
      if (game.isHome) {
        homeStreak += 1;
        roadStreak = 0;
      } else {
        roadStreak += 1;
        homeStreak = 0;
      }

      if (homeStreak > longestHome) longestHome = homeStreak;
      if (roadStreak > longestRoad) longestRoad = roadStreak;

      if (previousGame) {
        const diffMs = game.date.getTime() - previousGame.date.getTime();
        if (Number.isFinite(diffMs) && diffMs > 0) {
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          restIntervals += 1;
          restTotal += diffDays;

          let bucketLabel = '3+ days';
          for (const bucket of restBucketDefinitions) {
            if (bucket.test(diffDays)) {
              bucketLabel = bucket.label;
              break;
            }
          }
          restBucketCounts.set(bucketLabel, (restBucketCounts.get(bucketLabel) ?? 0) + 1);

          if (diffDays < 1.25) {
            backToBacks += 1;
          }
        }
      }

      previousGame = game;
    }

    team.backToBacks = backToBacks;
    team.averageRestDays = restIntervals > 0 ? restTotal / restIntervals : null;
    team.longestHomeStand = longestHome;
    team.longestRoadTrip = longestRoad;

    totalRestIntervals += restIntervals;
    totalRestDays += restTotal;
    totalBackToBacks += backToBacks;
  }

  const restSummary = {
    totalIntervals: totalRestIntervals,
    averageRestDays: totalRestIntervals > 0 ? totalRestDays / totalRestIntervals : null,
    backToBackIntervals: totalBackToBacks,
  };

  const restBuckets = restBucketDefinitions.map((bucket) => ({
    label: bucket.label,
    intervals: restBucketCounts.get(bucket.label) ?? 0,
  }));

  const formattedTeams = Array.from(teams.values()).map((team) => {
    const directoryEntry = teamDirectory.get(team.teamId);
    const name = directoryEntry ? `${directoryEntry.teamCity} ${directoryEntry.teamName}` : team.teamId;
    const abbreviation = directoryEntry?.teamAbbrev ?? '';
    return {
      teamId: team.teamId,
      name,
      abbreviation,
      preseasonGames: team.preseasonGames,
      regularSeasonGames: team.regularSeasonGames,
      otherGames: team.otherGames,
      totalGames: team.preseasonGames + team.regularSeasonGames + team.otherGames,
      homeGames: team.homeGames,
      awayGames: team.awayGames,
      firstGame: team.firstGame ? team.firstGame.toISOString() : null,
      lastGame: team.lastGame ? team.lastGame.toISOString() : null,
      backToBacks: team.backToBacks,
      averageRestDays: team.averageRestDays !== null ? Number(team.averageRestDays.toFixed(2)) : null,
      longestHomeStand: team.longestHomeStand,
      longestRoadTrip: team.longestRoadTrip,
    };
  });

  formattedTeams.sort((a, b) => {
    if (b.preseasonGames === a.preseasonGames) {
      if (b.totalGames === a.totalGames) {
        return a.name.localeCompare(b.name);
      }
      return b.totalGames - a.totalGames;
    }
    return b.preseasonGames - a.preseasonGames;
  });

  specialGames.sort((a, b) => {
    if (a.date && b.date) return new Date(a.date) - new Date(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.gameId.localeCompare(b.gameId);
  });

  const scheduleSnapshot = {
    generatedAt: new Date().toISOString(),
    season: {
      key: activeSeason.seasonKey,
      label: activeSeason.label,
      sourceCsv: activeSeason.csv,
      outputJson: activeSeason.json,
    },
    totals: {
      games: totals.games,
      preseason: totals.preseason,
      regularSeason: totals.regularSeason,
      other: totals.other,
      teams: formattedTeams.length,
    },
    labelBreakdown: Array.from(labelCounts.entries())
      .map(([labelName, count]) => ({ label: labelName, games: count }))
      .sort((a, b) => b.games - a.games),
    dateRange: {
      start: earliestDate ? earliestDate.toISOString() : null,
      end: latestDate ? latestDate.toISOString() : null,
    },
    monthlyCounts: Array.from(monthlyCounts.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(({ key, ...rest }) => ({ month: key, ...rest })),
    teams: formattedTeams,
    specialGames,
    restSummary,
    restBuckets,
    backToBackLeaders: formattedTeams
      .map((team) => ({
        teamId: team.teamId,
        name: team.name,
        abbreviation: team.abbreviation,
        backToBacks: team.backToBacks,
        averageRestDays: team.averageRestDays,
        longestHomeStand: team.longestHomeStand,
        longestRoadTrip: team.longestRoadTrip,
      }))
      .sort((a, b) => {
        if (b.backToBacks === a.backToBacks) {
          return a.name.localeCompare(b.name);
        }
        return b.backToBacks - a.backToBacks;
      })
      .slice(0, 10),
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(scheduleSnapshot, null, 2));

  const manifestPath = join(outputDir, 'schedule_manifest.json');
  const manifestPayload = {
    seasons: [
      {
        path: `data/${activeSeason.json}`,
        label: activeSeason.label,
      },
    ],
  };
  writeFileSync(manifestPath, JSON.stringify(manifestPayload, null, 2));

  return scheduleSnapshot;
}

try {
  const snapshot = buildScheduleSnapshot();
  console.log(`Generated snapshot for ${snapshot.totals.games} scheduled games.`);
  console.log(`Output written to ${outputPath}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
