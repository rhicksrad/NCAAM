import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyNcaALogos, LOGOS_DIR, fetchEspnTeamDirectory } from './lib/ncaa-logos.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const stopwords = new Set(['and', 'of', 'the', 'university', 'college', 'for', 'at', 'in']);

const explicitAliases = new Map([
  ['alabama-birmingham-blazers', 'uab-blazers'],
  ['brigham-young-cougars', 'byu-cougars'],
  ['louisiana-state-tigers', 'lsu-tigers'],
  ['southern-methodist-mustangs', 'smu-mustangs'],
  ['texas-christian-horned-frogs', 'tcu-horned-frogs'],
  ['central-florida-knights', 'ucf-knights'],
  ['fau-owls', 'florida-atlantic-owls'],
  ['florida-international-panthers', 'fiu-panthers'],
  ['texas-san-antonio-roadrunners', 'utsa-roadrunners'],
  ['texas-el-paso-miners', 'utep-miners'],
  ['southern-california-trojans', 'usc-trojans'],
  ['california-los-angeles-bruins', 'ucla-bruins'],
  ['nevada-las-vegas-rebels', 'unlv-rebels'],
  ['miami-ohio-redhawks', 'miami-oh-redhawks'],
  ['pitt-panthers', 'pittsburgh-panthers'],
  ['nc-state-wolfpack', 'north-carolina-state-wolfpack'],
  ['vt-hokies', 'virginia-tech-hokies'],
  ['mississippi-rebels', 'ole-miss-rebels'],
  ['ull-ragin-cajuns', 'louisiana-ragin-cajuns'],
  ['louisiana-monroe-warhawks', 'ulm-warhawks'],
  ['texas-am-aggies', 'texas-a-m-aggies'],
  ['texas-a-m-aggies', 'texas-a-m-aggies'],
  ['fbs-independents', 'division-i-fbs-independents'],
  ['mtsu-blue-raiders', 'middle-tennessee-blue-raiders'],
  ['jmu-dukes', 'james-madison-dukes'],
  ['nd-fighting-irish', 'notre-dame-fighting-irish'],
  ['ou-sooners', 'oklahoma-sooners'],
  ['okstate-cowboys', 'oklahoma-state-cowboys'],
  ['ku-jayhawks', 'kansas-jayhawks'],
  ['ksu-wildcats', 'kansas-state-wildcats'],
  ['mizzou-tigers', 'missouri-tigers'],
  ['fsu-seminoles', 'florida-state-seminoles'],
  ['gt-yellow-jackets', 'georgia-tech-yellow-jackets'],
  ['wvu-mountaineers', 'west-virginia-mountaineers'],
  ['wsu-cougars', 'washington-state-cougars'],
  ['uw-huskies', 'washington-huskies'],
  ['asu-sun-devils', 'arizona-state-sun-devils'],
  ['ua-wildcats', 'arizona-wildcats'],
  ['notre-dame', 'notre-dame-fighting-irish'],
  ['uab-blazers', 'uab-blazers'],
  ['utsa-roadrunners', 'utsa-roadrunners'],
  ['utep-miners', 'utep-miners'],
  ['fiu-panthers', 'fiu-panthers'],
  ['ole-miss-rebels', 'ole-miss-rebels'],
  ['byu-cougars', 'byu-cougars'],
  ['lsu-tigers', 'lsu-tigers'],
  ['smu-mustangs', 'smu-mustangs'],
  ['tcu-horned-frogs', 'tcu-horned-frogs'],
  ['ucf-knights', 'ucf-knights'],
  ['usc-trojans', 'usc-trojans'],
  ['ucla-bruins', 'ucla-bruins'],
  ['unlv-rebels', 'unlv-rebels'],
  ['purdue-boilermakers', 'purdue-boilermakers'],
  ['cit', 'collegeinsider-com-tournament'],
  ['nit', 'national-invitation-tournament'],
  ['ncaa', 'ncaa-division-i-mens-basketball-tournament'],
  ['march-madness', 'ncaa-division-i-mens-basketball-tournament'],
  ['ncaa-tournament', 'ncaa-division-i-mens-basketball-tournament'],
  ['cbi', 'college-basketball-invitational'],
  ['meac', 'mid-eastern-athletic-conference'],
  ['wac', 'western-athletic-conference'],
]);

function resolveAliasSlug(slug) {
  const seen = new Set();
  let current = slug;

  while (explicitAliases.has(current) && !seen.has(current)) {
    seen.add(current);
    current = explicitAliases.get(current);
  }

  return current;
}

function buildAliasGroups() {
  const groups = new Map();

  const register = slug => {
    if (!slug) {
      return;
    }

    const resolved = resolveAliasSlug(slug);
    let group = groups.get(resolved);
    if (!group) {
      group = new Set();
      groups.set(resolved, group);
    }
    group.add(resolved);
    group.add(slug);
  };

  for (const [source, target] of explicitAliases) {
    register(source);
    register(target);
  }

  return groups;
}

const aliasGroups = buildAliasGroups();

function collectAliasSlugs(slug) {
  const resolved = resolveAliasSlug(slug);
  const result = new Set(aliasGroups.get(resolved) ?? []);
  result.add(resolved);
  result.add(slug);
  return result;
}

function candidateSlugs(slug) {
  const candidates = collectAliasSlugs(slug);
  candidates.add(slug);
  candidates.add(resolveAliasSlug(slug));
  return candidates;
}

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(str) {
  const norm = normalize(str);
  if (!norm) return [];
  return norm.split(' ').filter(token => token && !stopwords.has(token));
}

function slugFromTokens(tokens) {
  return tokens.join('-');
}

function buildTokens(name, aliases) {
  const canonicalTokens = tokenize(name);
  const seen = new Set(canonicalTokens);
  const tokens = [...canonicalTokens];

  for (const alias of aliases) {
    for (const token of tokenize(alias)) {
      if (seen.has(token)) continue;
      seen.add(token);
      tokens.push(token);
    }
  }

  return tokens;
}

const header = `// This file is auto-generated by scripts/build-ncaa-logo-map.mjs\n`;

async function loadDivisionITeams() {
  const snapshotPath = path.join(ROOT, 'public/data/team-height-snapshot.json');
  let raw;
  try {
    raw = await fs.readFile(snapshotPath, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read NCAA team height snapshot at ${snapshotPath}: ${reason}`);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in NCAA team height snapshot at ${snapshotPath}: ${reason}`);
  }

  if (!json || !Array.isArray(json.teams)) {
    throw new Error(`Team height snapshot at ${snapshotPath} is missing a "teams" array.`);
  }

  const teams = new Map();
  for (const entry of json.teams) {
    if (!entry || typeof entry.team !== 'string') {
      continue;
    }
    const slug = slugFromTokens(tokenize(entry.team));
    if (!slug) {
      continue;
    }
    if (!teams.has(slug)) {
      teams.set(slug, {
        name: entry.team,
      });
    }
  }

  return teams;
}

function buildEspnSlugMap(espnTeams) {
  const map = new Map();

  for (const team of espnTeams) {
    const baseSlug = slugFromTokens(tokenize(team.displayName));
    if (!baseSlug) {
      continue;
    }

    const aliases = collectAliasSlugs(baseSlug);
    aliases.add(baseSlug);
    const record = {
      id: team.id,
      name: team.displayName,
    };

    for (const alias of aliases) {
      if (!map.has(alias)) {
        map.set(alias, record);
      }
    }
  }

  return map;
}

function ensureEspnDirectoryAlignment(divisionITeams, espnSlugMap) {
  const unmatched = [];

  for (const [slug, info] of divisionITeams) {
    const candidates = candidateSlugs(slug);
    let matched = false;
    for (const candidate of candidates) {
      if (espnSlugMap.has(candidate)) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmatched.push(`${info.name} (slug: ${slug})`);
    }
  }

  if (unmatched.length > 0) {
    const details = unmatched.map(entry => `- ${entry}`).join('\n');
    throw new Error(
      `Unable to match ESPN directory entries for:\n${details}\nUpdate explicitAliases or verify naming before re-running this build.`
    );
  }
}

function ensureDivisionITeamsCovered(entries, divisionITeams, espnSlugMap) {
  const localSlugs = new Set(entries.map(entry => entry.slug));
  const missing = [];

  for (const [slug] of divisionITeams) {
    const candidates = candidateSlugs(slug);

    let covered = false;
    for (const candidate of candidates) {
      if (localSlugs.has(candidate)) {
        covered = true;
        break;
      }
    }

    if (covered) {
      continue;
    }

    for (const candidate of candidates) {
      if (espnSlugMap.has(candidate)) {
        const espnTeam = espnSlugMap.get(candidate);
        missing.push(`${espnTeam.name} (${espnTeam.id})`);
        break;
      }
    }
  }

  if (missing.length > 0) {
    const details = missing.map(entry => `- ${entry}`).join('\n');
    throw new Error(
      `Missing NCAA logo assets for:\n${details}\nAdd the corresponding public/data/logos/{id}.png files and metadata entries before re-running this build.`
    );
  }
}

export async function buildLogoMap() {
  const { logos } = await verifyNcaALogos();
  const [rawFiles, divisionITeams, espnTeams] = await Promise.all([
    fs.readdir(LOGOS_DIR),
    loadDivisionITeams(),
    fetchEspnTeamDirectory(),
  ]);

  if (!Array.isArray(espnTeams) || espnTeams.length === 0) {
    throw new Error('Unable to load ESPN team directory: received no entries.');
  }

  const files = rawFiles.filter(file => file.toLowerCase().endsWith('.png'));
  files.sort((a, b) => a.localeCompare(b, 'en'));
  const entries = [];
  for (const file of files) {
    const id = file.replace(/\.png$/i, '');
    const metadata = logos.get(id);
    if (!metadata) {
      throw new Error(`No NCAA logo metadata found for asset ${file}`);
    }
    const { name, aliases } = metadata;
    const tokens = buildTokens(name, aliases);
    const slug = slugFromTokens(tokenize(name));
    entries.push({
      name,
      slug,
      tokens,
      path: `data/logos/${id}.png`,
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const espnSlugMap = buildEspnSlugMap(espnTeams);
  ensureEspnDirectoryAlignment(divisionITeams, espnSlugMap);
  ensureDivisionITeamsCovered(entries, divisionITeams, espnSlugMap);
  const tsEntries = JSON.stringify(entries, null, 2).replace(/"([^("]+)":/g, '"$1":');
  const tsContent = `${header}export interface LogoEntry {\n  readonly name: string;\n  readonly slug: string;\n  readonly tokens: readonly string[];\n  readonly path: string;\n}\n\nexport const NCAA_LOGOS: readonly LogoEntry[] = ${tsEntries} as const;\n\nexport const NCAA_LOGO_INDEX: Readonly<Record<string, LogoEntry>> = Object.fromEntries(NCAA_LOGOS.map(entry => [entry.slug, entry]));\n\nexport const NCAA_LOGO_ALIASES: Readonly<Record<string, string>> = ${JSON.stringify(Object.fromEntries(explicitAliases), null, 2)};\n`;
  await fs.writeFile(path.join(ROOT, 'src/lib/data/ncaa-logo-map.ts'), tsContent, 'utf8');

  const aliasObject = Object.fromEntries(explicitAliases);
  const jsContent = `${header}export const NCAA_LOGOS = ${JSON.stringify(entries, null, 2)};\n\nexport const NCAA_LOGO_INDEX = Object.fromEntries(NCAA_LOGOS.map(entry => [entry.slug, entry]));\n\nexport const NCAA_LOGO_ALIASES = ${JSON.stringify(aliasObject, null, 2)};\n`;
  await fs.writeFile(path.join(ROOT, 'public/scripts/lib/data/ncaa-logo-map.js'), jsContent, 'utf8');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildLogoMap();
}
