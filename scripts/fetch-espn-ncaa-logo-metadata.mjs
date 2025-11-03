import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEspnFetchClient } from './lib/ncaa-logos.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LOGOS_DIR = path.join(ROOT, 'public/data/logos');
const METADATA_PATH = path.join(LOGOS_DIR, 'metadata.json');
const TEAM_BASE_URL = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/teams';
const USER_AGENT = 'NCAAM Logo Metadata Generator/1.0 (+https://github.com/hicksrch/NCAAM)';

const MANUAL_LOGO_METADATA = new Map([
  [
    '110243',
    {
      name: 'CollegeInsider.com Tournament',
      aliases: ['CIT', 'College Insider Tournament'],
    },
  ],
  [
    '110254',
    {
      name: 'National Invitation Tournament',
      aliases: ['NIT'],
    },
  ],
  [
    '112358',
    {
      name: "NCAA Division I Men's Basketball Tournament",
      aliases: ['NCAA Tournament', 'March Madness'],
    },
  ],
  [
    '124180',
    {
      name: 'College Basketball Invitational',
      aliases: ['CBI'],
    },
  ],
  [
    '2323',
    {
      name: 'Summit League',
      aliases: ['The Summit League'],
    },
  ],
  [
    '490',
    {
      name: 'Mid-Eastern Athletic Conference',
      aliases: ['MEAC'],
    },
  ],
  [
    '611',
    {
      name: 'Western Athletic Conference',
      aliases: ['WAC', 'Western Athletic'],
    },
  ],
]);

const espnClient = createEspnFetchClient({ userAgent: USER_AGENT });

async function fetchJson(url) {
  return espnClient.json(url);
}

function createAliasList(team) {
  const aliases = new Set();

  const push = value => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    aliases.add(trimmed);
  };

  push(team.displayName);
  push(team.shortDisplayName);
  push(team.nickname);
  push(team.location);
  push(team.abbreviation);
  if (team.location && team.name) {
    push(`${team.location} ${team.name}`);
  }

  const result = Array.from(aliases);
  result.sort((a, b) => a.localeCompare(b));
  return result;
}

async function fetchLogoIds() {
  const entries = await fs.readdir(LOGOS_DIR);
  return entries
    .filter(entry => entry.toLowerCase().endsWith('.png'))
    .map(entry => entry.replace(/\.png$/i, ''))
    .filter(id => /^\d+$/.test(id))
    .sort((a, b) => Number(a) - Number(b));
}

async function loadTeamMetadata(id) {
  if (MANUAL_LOGO_METADATA.has(id)) {
    return MANUAL_LOGO_METADATA.get(id);
  }

  try {
    const json = await fetchJson(`${TEAM_BASE_URL}/${id}`);
    const displayName = json?.displayName?.trim();
    if (!displayName) {
      return undefined;
    }

    const aliasList = createAliasList(json).filter(alias => alias !== displayName);
    return { name: displayName, aliases: aliasList };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Unable to load metadata for NCAA logo ${id}: ${reason}`);
    return undefined;
  }
}

async function buildEntries() {
  const ids = await fetchLogoIds();
  const entries = new Map(MANUAL_LOGO_METADATA);

  for (const id of ids) {
    if (entries.has(id)) continue;
    const metadata = await loadTeamMetadata(id);
    if (!metadata) continue;
    entries.set(id, metadata);
  }

  return entries;
}

async function writeMetadata(entries) {
  const sortedIds = Array.from(entries.keys()).sort((a, b) => Number(a) - Number(b));
  const metadata = {
    source: TEAM_BASE_URL,
    updated: new Date().toISOString(),
    logos: Object.fromEntries(
      sortedIds.map(id => [
        id,
        {
          name: entries.get(id).name,
          aliases: entries.get(id).aliases,
        },
      ]),
    ),
  };

  await fs.mkdir(LOGOS_DIR, { recursive: true });
  await fs.writeFile(METADATA_PATH, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

async function main() {
  const entries = await buildEntries();
  if (entries.size === 0) {
    throw new Error('No NCAA logo metadata could be discovered.');
  }
  await writeMetadata(entries);
  console.log(`Wrote NCAA logo metadata for ${entries.size} logos to ${METADATA_PATH}`);
}

try {
  await main();
} finally {
  espnClient.close();
}
