import { NCAA_LOGOS, NCAA_LOGO_ALIASES, NCAA_LOGO_INDEX } from './data/ncaa-logo-map';
import type { LogoEntry } from './data/ncaa-logo-map';

const stopwords = new Set(['and', 'of', 'the', 'university', 'college', 'for', 'at', 'in']);

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  const norm = normalize(value);
  if (!norm) return [];
  return norm.split(' ').filter(token => token && !stopwords.has(token));
}

function slugFromTokens(tokens: string[]): string {
  return tokens.join('-');
}

function getEntryFromSlug(slug: string): LogoEntry | undefined {
  const alias = NCAA_LOGO_ALIASES[slug];
  if (alias) {
    const entry = NCAA_LOGO_INDEX[alias];
    if (entry) return entry;
  }
  return NCAA_LOGO_INDEX[slug];
}

function bestMatch(tokens: string[]): LogoEntry | undefined {
  if (!tokens.length) return undefined;
  const tokenSet = new Set(tokens);
  let best: LogoEntry | undefined;
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
  return best;
}

export interface TeamIdentityLike {
  displayName?: string;
  name?: string;
  shortName?: string;
  abbreviation?: string;
}

export function lookupTeamLogo(value: string): string | undefined {
  const tokens = tokenize(value);
  if (!tokens.length) return undefined;
  const slug = slugFromTokens(tokens);
  const direct = getEntryFromSlug(slug);
  if (direct) return direct.path;
  const entry = bestMatch(tokens);
  return entry?.path;
}

export function resolveTeamLogo(team: TeamIdentityLike): string | undefined {
  const seen = new Set<string>();
  const candidates = [team.displayName, team.name, team.shortName];
  if (team.abbreviation) {
    candidates.push(team.abbreviation);
    if (team.displayName) candidates.push(`${team.abbreviation} ${team.displayName}`);
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    const tokens = tokenize(candidate);
    if (!tokens.length) continue;
    const slug = slugFromTokens(tokens);
    if (seen.has(slug)) continue;
    seen.add(slug);
    const direct = getEntryFromSlug(slug);
    if (direct) return direct.path;
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    const tokens = tokenize(candidate);
    if (!tokens.length) continue;
    const key = slugFromTokens(tokens);
    if (seen.has(key)) continue;
    seen.add(key);
    const entry = bestMatch(tokens);
    if (entry) return entry.path;
  }

  return undefined;
}
