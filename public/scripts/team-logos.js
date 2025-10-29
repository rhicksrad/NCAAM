import { NCAA_LOGOS, NCAA_LOGO_ALIASES } from './ncaa-logo-map.js';

const fallbackLogo = 'assets/logos/ncaam-mark.svg';
const stopwords = new Set(['and', 'of', 'the', 'university', 'college', 'for', 'at', 'in']);
const logoIndex = new Map(NCAA_LOGOS.map(entry => [entry.slug, entry]));

function normalize(value) {
  return typeof value === 'string'
    ? value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9\s]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function tokenize(value) {
  const norm = normalize(value);
  if (!norm) return [];
  return norm.split(' ').filter(token => token && !stopwords.has(token));
}

function slugFromTokens(tokens) {
  return tokens.join('-');
}

function getEntry(slug) {
  const alias = NCAA_LOGO_ALIASES[slug];
  if (alias && logoIndex.has(alias)) return logoIndex.get(alias);
  return logoIndex.get(slug);
}

function bestMatch(tokens) {
  if (!tokens.length) return undefined;
  const tokenSet = new Set(tokens);
  let best = null;
  let bestScore = 0;
  for (const entry of NCAA_LOGOS) {
    let matches = 0;
    for (const token of entry.tokens) {
      if (tokenSet.has(token)) matches += 1;
    }
    if (!matches) continue;
    const coverage = matches / entry.tokens.length;
    if (coverage < 0.6) {
      if (!(coverage > 0.4 && matches >= 2)) continue;
    }
    if (coverage > bestScore) {
      bestScore = coverage;
      best = entry;
      continue;
    }
    if (coverage === bestScore && best) {
      if (entry.tokens.length < best.tokens.length) {
        best = entry;
      } else if (entry.tokens.length === best.tokens.length && entry.name < best.name) {
        best = entry;
      }
    }
  }
  return best || undefined;
}

function resolveLogo(value) {
  const tokens = tokenize(value);
  if (!tokens.length) return undefined;
  const slug = slugFromTokens(tokens);
  const direct = getEntry(slug);
  if (direct) return direct.path;
  const entry = bestMatch(tokens);
  return entry ? entry.path : undefined;
}

export function getTeamLogo(identifier) {
  if (!identifier) return fallbackLogo;
  const candidates = [];
  if (Array.isArray(identifier)) {
    candidates.push(...identifier);
  } else {
    candidates.push(identifier);
  }
  for (const value of candidates) {
    const logo = resolveLogo(value);
    if (logo) return logo;
  }
  return fallbackLogo;
}

export function createTeamLogo(identifier, className = 'team-logo') {
  const logo = document.createElement('img');
  logo.src = getTeamLogo(identifier);
  logo.alt = identifier ? `${identifier} logo` : 'NCAA logo';
  logo.loading = 'lazy';
  logo.decoding = 'async';
  if (className) {
    logo.className = className;
  }
  return logo;
}
