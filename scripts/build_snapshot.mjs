import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repoRoot = join(__dirname, '..');
const csvPath = join(repoRoot, 'TeamHistories.csv');
const outputDir = join(repoRoot, 'public', 'data');
const outputPath = join(outputDir, 'active_franchises.json');

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',').map((h) => h.trim());
  return lines
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      const parts = line.split(',');
      if (parts.length !== headers.length) {
        throw new Error(`Unexpected column count on line ${index + 2}: ${line}`);
      }
      const record = {};
      headers.forEach((header, idx) => {
        record[header] = parts[idx].trim();
      });
      return record;
    });
}

function toNumber(value) {
  const num = Number.parseInt(value, 10);
  return Number.isNaN(num) ? null : num;
}

function buildSnapshot() {
  const csv = readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csv);
  const currentYear = new Date().getFullYear();
  const activeEntries = rows.filter((row) => {
    const activeTill = toNumber(row.seasonActiveTill);
    return activeTill !== null && activeTill >= currentYear;
  });

  const byTeamId = new Map();

  for (const entry of activeEntries) {
    const teamId = entry.teamId;
    const seasonFounded = toNumber(entry.seasonFounded) ?? currentYear;

    if (!byTeamId.has(teamId)) {
      byTeamId.set(teamId, entry);
      continue;
    }

    const existing = byTeamId.get(teamId);
    const existingSeason = toNumber(existing.seasonFounded) ?? currentYear;
    if (seasonFounded > existingSeason) {
      byTeamId.set(teamId, entry);
    }
  }

  const franchises = Array.from(byTeamId.values()).map((row) => {
    const seasonFounded = toNumber(row.seasonFounded);
    const seasonActiveTill = toNumber(row.seasonActiveTill);

    return {
      teamId: row.teamId,
      city: row.teamCity,
      name: row.teamName,
      abbreviation: row.teamAbbrev?.trim() ?? '',
      league: row.league,
      seasonFounded,
      seasonActiveTill,
      isActive: seasonActiveTill !== null && seasonActiveTill >= currentYear,
    };
  });

  franchises.sort((a, b) => {
    if (a.seasonFounded === b.seasonFounded) {
      return a.name.localeCompare(b.name);
    }
    if (a.seasonFounded === null) return 1;
    if (b.seasonFounded === null) return -1;
    return a.seasonFounded - b.seasonFounded;
  });

  const leagueSet = new Set();
  const decadeCounts = new Map();
  let earliestSeason = Number.POSITIVE_INFINITY;
  let latestSeason = Number.NEGATIVE_INFINITY;

  for (const franchise of franchises) {
    if (franchise.league) {
      leagueSet.add(franchise.league);
    }
    if (typeof franchise.seasonFounded === 'number') {
      const decade = Math.floor(franchise.seasonFounded / 10) * 10;
      decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);
      earliestSeason = Math.min(earliestSeason, franchise.seasonFounded);
      latestSeason = Math.max(latestSeason, franchise.seasonFounded);
    }
  }

  const decades = Array.from(decadeCounts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([decade, total]) => ({ decade, total }));

  const nbaActiveCount = franchises.filter((team) => team.league === 'NBA').length;

  const snapshot = {
    generatedAt: new Date().toISOString(),
    currentYear,
    totals: {
      all: franchises.length,
      nba: nbaActiveCount,
    },
    leagues: Array.from(leagueSet).sort(),
    earliestSeason: Number.isFinite(earliestSeason) ? earliestSeason : null,
    latestSeason: Number.isFinite(latestSeason) ? latestSeason : null,
    activeFranchises: franchises,
    decades,
  };

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(snapshot, null, 2));

  return snapshot;
}

try {
  const snapshot = buildSnapshot();
  console.log(`Generated ${snapshot.activeFranchises.length} active franchises.`);
  console.log(`Output written to ${outputPath}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
