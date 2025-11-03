import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { verifyNcaALogos, LOGOS_DIR } from './lib/ncaa-logos.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const stopwords = new Set(['and', 'of', 'the', 'university', 'college', 'for', 'at', 'in']);

const renameMap = new Map([
  ['Alabama Birmingham Blazers', 'UAB Blazers'],
  ['Alabama Birmingham Blazers logo', 'UAB Blazers'],
  ['FIU Panthers Logo', 'FIU Panthers'],
  ['Jacksonville State Gamecocks logo', 'Jacksonville State Gamecocks'],
  ['Kennesaw State Owls logo', 'Kennesaw State Owls'],
  ['Louisiana Lafayette Ragin Cajuns', 'Louisiana Ragin Cajuns'],
  ['Louisiana Monroe Warhawks', 'ULM Warhawks'],
  ['Middle Tennessee Blue Raiders logo', 'Middle Tennessee Blue Raiders'],
  ['Sam Houston State Bearkats logo', 'Sam Houston Bearkats'],
  ['Sam Houston State Bearkats', 'Sam Houston Bearkats'],
  ['SMU Mustang', 'SMU Mustangs'],
  ['Sun Belt Conference 2020', 'Sun Belt Conference'],
  ['Texas SA Roadrunners', 'UTSA Roadrunners'],
  ['Texas SA Roadrunners logo', 'UTSA Roadrunners'],
  ['Texas AM University', 'Texas A&M Aggies'],
  ['UTEP Miners logo', 'UTEP Miners'],
  ['Pac 12', 'Pac-12 Conference'],
  ['Atlantic Coast Conference ACC', 'ACC'],
  ['Big 12 Conference', 'Big 12 Conference'],
  ['Big Ten Conference', 'Big Ten Conference'],
  ['Conference USA', 'Conference USA'],
  ['Division I FBS Independents logo', 'FBS Independents'],
  ['Mid American Conference', 'Mid-American Conference'],
  ['Mountain West Conference', 'Mountain West Conference'],
  ['Southeastern Conference', 'SEC'],
  ['American Athletic Conference', 'American Athletic Conference'],
  ['Texas AM University logo', 'Texas A&M Aggies'],
  ['Pitt Panthers', 'Pittsburgh Panthers'],
  ['Miami OH Redhawks', 'Miami (OH) RedHawks'],
]);

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
]);

const stopwordMatcher = /\s+/g;

function toDisplayName(file) {
  const base = file
    .replace(/_logo-300x300\.png$/i, '')
    .replace(/-logo-300x300\.png$/i, '')
    .replace(/-300x300\.png$/i, '')
    .replace(/\.png$/i, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(stopwordMatcher, ' ')
    .trim();
  return renameMap.get(base) ?? base;
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

const header = `// This file is auto-generated by scripts/build-ncaa-logo-map.mjs\n`;

async function build() {
  await verifyNcaALogos();
  const files = (await fs.readdir(LOGOS_DIR)).filter(file => file.toLowerCase().endsWith('.png'));
  files.sort((a, b) => a.localeCompare(b));
  const entries = [];
  for (const file of files) {
    const name = toDisplayName(file);
    const tokens = tokenize(name);
    const slug = slugFromTokens(tokens);
    entries.push({
      name,
      slug,
      tokens,
      path: `assets/logos/ncaa/${file}`,
    });
  }
  const tsEntries = JSON.stringify(entries, null, 2).replace(/"([^("]+)":/g, '"$1":');
  const tsContent = `${header}export interface LogoEntry {\n  readonly name: string;\n  readonly slug: string;\n  readonly tokens: readonly string[];\n  readonly path: string;\n}\n\nexport const NCAA_LOGOS: readonly LogoEntry[] = ${tsEntries} as const;\n\nexport const NCAA_LOGO_INDEX: Readonly<Record<string, LogoEntry>> = Object.fromEntries(NCAA_LOGOS.map(entry => [entry.slug, entry]));\n\nexport const NCAA_LOGO_ALIASES: Readonly<Record<string, string>> = ${JSON.stringify(Object.fromEntries(explicitAliases), null, 2)};\n`;
  await fs.writeFile(path.join(ROOT, 'src/lib/data/ncaa-logo-map.ts'), tsContent, 'utf8');

  const jsContent = `${header}export const NCAA_LOGOS = ${JSON.stringify(entries, null, 2)};\n\nexport const NCAA_LOGO_ALIASES = ${JSON.stringify(Object.fromEntries(explicitAliases), null, 2)};\n`;
  await fs.writeFile(path.join(ROOT, 'public/scripts/ncaa-logo-map.js'), jsContent, 'utf8');
}

await build();
