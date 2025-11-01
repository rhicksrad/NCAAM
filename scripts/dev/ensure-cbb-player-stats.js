import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = resolve(new URL('../../', import.meta.url).pathname);
const DATA_DIR = resolve(ROOT, 'public', 'data');
const PLAYERS_DIR = resolve(DATA_DIR, 'players');
const INDEX_FILE = resolve(DATA_DIR, 'players_index.json');
const META_FILE = resolve(DATA_DIR, 'cbb_conference_meta.json');

const TARGET_CONFERENCES = [
  'ACC',
  'B10',
  'B12',
  'SEC',
  'BE',
  'P12',
  'AEC',
  'AAC',
  'ASUN',
  'A10',
  'BSKY',
  'BSOU',
  'BWC',
  'CAA',
  'CUSA',
  'HORIZ',
  'IVY',
];
const TARGET_SEASON_YEARS = ['2025'];

async function fileExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function runCommand(command, args, env = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('error', rejectPromise);
    child.on('exit', code => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function ensureIndexUpToDate() {
  const args = ['exec', 'tsx', 'scripts/scrape/cbb_index.ts'];
  const env = {
    CBB_SEASONS: TARGET_SEASON_YEARS.join(','),
    CBB_CONFERENCES: TARGET_CONFERENCES.join(','),
  };
  await runCommand('pnpm', args, env);
}

async function ensurePlayerStats() {
  const args = ['exec', 'tsx', 'scripts/scrape/cbb_player_stats.ts'];
  await runCommand('pnpm', args);
}

async function removeStalePlayerFiles(validSlugs) {
  await mkdir(PLAYERS_DIR, { recursive: true });
  const files = await readdir(PLAYERS_DIR, { withFileTypes: true });
  const stale = files
    .filter(entry => entry.isFile() && entry.name.endsWith('.json') && !validSlugs.has(entry.name.replace(/\.json$/u, '')))
    .map(entry => entry.name);
  for (const name of stale) {
    await rm(join(PLAYERS_DIR, name));
  }
  return { removed: stale.length };
}

async function writeMeta(meta) {
  await mkdir(dirname(META_FILE), { recursive: true });
  await writeFile(META_FILE, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

function needsRefresh(currentMeta) {
  if (!currentMeta) return true;
  const hasConferences = Array.isArray(currentMeta.conferences)
    && TARGET_CONFERENCES.every(conf => currentMeta.conferences.includes(conf));
  if (!hasConferences) return true;
  const seasonList = Array.isArray(currentMeta.season_filter) && currentMeta.season_filter.length > 0
    ? currentMeta.season_filter
    : currentMeta.seasons;
  if (!Array.isArray(seasonList) || seasonList.length === 0) return true;
  const hasSeason = TARGET_SEASON_YEARS.every(season => seasonList.includes(season));
  if (!hasSeason) return true;
  if (typeof currentMeta.player_count !== 'number' || currentMeta.player_count <= 0) return true;
  return false;
}

async function loadMeta() {
  if (!(await fileExists(META_FILE))) {
    return null;
  }
  try {
    const meta = await readJson(META_FILE);
    return meta;
  } catch (error) {
    console.warn('Unable to parse existing meta file, rebuilding player stats.', error);
    return null;
  }
}

async function ensureConferencePlayerStats() {
  const existingMeta = await loadMeta();
  if (!needsRefresh(existingMeta) && (await fileExists(INDEX_FILE))) {
    return existingMeta;
  }

  await ensureIndexUpToDate();
  await ensurePlayerStats();

  const index = await readJson(INDEX_FILE);
  const players = Array.isArray(index?.players) ? index.players : [];
  const seasons = Array.isArray(index?.seasons) ? index.seasons : [];
  const slugs = new Set();
  for (const player of players) {
    if (player && typeof player.slug === 'string') {
      slugs.add(player.slug);
    }
  }

  await removeStalePlayerFiles(slugs);

  const meta = {
    generated_at: new Date().toISOString(),
    conferences: [...TARGET_CONFERENCES],
    seasons: [...new Set(seasons)].sort(),
    player_count: players.length,
    season_filter: [...TARGET_SEASON_YEARS],
  };
  await writeMeta(meta);
  return meta;
}

let ensurePromise = null;

export async function ensureConferencePlayers() {
  if (!ensurePromise) {
    ensurePromise = ensureConferencePlayerStats().catch(error => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

