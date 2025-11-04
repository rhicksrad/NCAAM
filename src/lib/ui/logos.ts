import type { Team } from "../sdk/ncaam.js";
import { BASE } from "../config.js";
import {
  NCAA_LOGOS,
  NCAA_LOGO_ALIASES,
  NCAA_LOGO_INDEX,
  type LogoEntry,
} from "../data/ncaa-logo-map.js";

const STOPWORDS = new Set([
  "and",
  "of",
  "the",
  "university",
  "college",
  "for",
  "at",
  "in",
]);

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensFrom(value: string): string[] {
  const normalized = normalize(value);
  if (!normalized) {
    return [];
  }
  return normalized.split(" ").filter(token => token && !STOPWORDS.has(token));
}

function slugFromTokens(tokens: readonly string[]): string {
  return tokens.join("-");
}

function resolveAlias(slug: string): LogoEntry | undefined {
  const seen = new Set<string>();
  let current = slug;

  while (!seen.has(current)) {
    seen.add(current);
    const alias = NCAA_LOGO_ALIASES[current];
    if (!alias) {
      break;
    }
    current = alias;
  }

  return NCAA_LOGO_INDEX[current] ?? NCAA_LOGO_INDEX[slug];
}

function findLogoByName(value: string | undefined): LogoEntry | undefined {
  if (!value) {
    return undefined;
  }

  const tokens = tokensFrom(value);
  if (tokens.length === 0) {
    return undefined;
  }

  const slug = slugFromTokens(tokens);
  if (!slug) {
    return undefined;
  }

  return resolveAlias(slug);
}

const teamLogoCache = new Map<number, LogoEntry | null>();
const labelLogoCache = new Map<string, LogoEntry | null>();

function cacheKeyForLabel(label: string): string | null {
  const normalized = normalize(label);
  return normalized || null;
}

export function getLogoEntryForLabel(value: string | undefined): LogoEntry | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const key = cacheKeyForLabel(trimmed);
  if (!key) {
    return undefined;
  }

  if (labelLogoCache.has(key)) {
    return labelLogoCache.get(key) ?? undefined;
  }

  const entry = findLogoByName(trimmed);
  labelLogoCache.set(key, entry ?? null);
  return entry;
}

type LabelVariantOptions = {
  includeConferenceVariants?: boolean;
};

function collectLabelVariants(
  labels: readonly (string | null | undefined)[],
  { includeConferenceVariants = false }: LabelVariantOptions = {},
): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();

  const push = (label: string | undefined) => {
    const base = label?.trim();
    if (!base) {
      return;
    }

    const normalized = base.toLowerCase();
    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    variants.push(base);

    if (!includeConferenceVariants) {
      return;
    }

    const withoutConference = base.replace(/\bconference\b/gi, "").trim();
    if (withoutConference && withoutConference !== base) {
      push(withoutConference);
    } else if (!/\bconference\b/i.test(base)) {
      push(`${base} Conference`);
    }

    const withoutLeague = base.replace(/\bleague\b/gi, "").trim();
    if (withoutLeague && withoutLeague !== base) {
      push(withoutLeague);
    }

    const withoutMens = base.replace(/\bmen['’]?s\b/gi, "").trim();
    if (withoutMens && withoutMens !== base) {
      push(withoutMens);
    }
  };

  for (const label of labels) {
    push(label ?? undefined);
  }

  return variants;
}

type ConferenceLogoOverride = {
  readonly name: string;
  readonly path: string;
  readonly aliases?: readonly string[];
};

const CONFERENCE_LOGO_OVERRIDES: readonly ConferenceLogoOverride[] = [
  {
    name: "Atlantic 10 Conference",
    path: "data/logos/a10.gif",
    aliases: ["Atlantic 10", "A10", "A-10"],
  },
  {
    name: "American Athletic Conference",
    path: "data/logos/aac.gif",
    aliases: ["American Athletic", "AAC", "American"],
  },
  {
    name: "Atlantic Coast Conference",
    path: "data/logos/acc.gif",
    aliases: ["ACC", "Atlantic Coast"],
  },
  {
    name: "America East Conference",
    path: "data/logos/aec.gif",
    aliases: ["America East", "AEC"],
  },
  {
    name: "ASUN Conference",
    path: "data/logos/asun.gif",
    aliases: ["ASUN", "Atlantic Sun", "Atlantic Sun Conference", "A-Sun"],
  },
  {
    name: "Big 12 Conference",
    path: "data/logos/big12.gif",
    aliases: ["Big 12", "Big XII"],
  },
  {
    name: "Big Eight Conference",
    path: "data/logos/big8.gif",
    aliases: ["Big 8", "Big Eight"],
  },
  {
    name: "Big East Conference",
    path: "data/logos/bige.gif",
    aliases: ["Big East"],
  },
  {
    name: "Big Sky Conference",
    path: "data/logos/bigsky.gif",
    aliases: ["Big Sky"],
  },
  {
    name: "Big South Conference",
    path: "data/logos/bigso.gif",
    aliases: ["Big South"],
  },
  {
    name: "Big Ten Conference",
    path: "data/logos/bigten.gif",
    aliases: ["Big Ten", "B1G"],
  },
  {
    name: "Big West Conference",
    path: "data/logos/bw.gif",
    aliases: ["Big West"],
  },
  {
    name: "Coastal Athletic Association",
    path: "data/logos/caa.gif",
    aliases: ["CAA", "Colonial Athletic Association", "Colonial Athletic"],
  },
  {
    name: "Conference USA",
    path: "data/logos/cusa.gif",
    aliases: ["Conference-USA", "C-USA", "CUSA"],
  },
  {
    name: "Great West Conference",
    path: "data/logos/gw.gif",
    aliases: ["Great West"],
  },
  {
    name: "Horizon League",
    path: "data/logos/horiz.gif",
    aliases: ["Horizon"],
  },
  {
    name: "Independent",
    path: "data/logos/ind.gif",
    aliases: ["Independents", "Independent Schools"],
  },
  {
    name: "Ivy League",
    path: "data/logos/ivy.gif",
    aliases: ["Ivy"],
  },
  {
    name: "Metro Atlantic Athletic Conference",
    path: "data/logos/maac.gif",
    aliases: ["MAAC", "Metro Atlantic"],
  },
  {
    name: "Mid-American Conference",
    path: "data/logos/mac.gif",
    aliases: ["MAC", "Mid American", "Mid-American"],
  },
  {
    name: "Mid-Eastern Athletic Conference",
    path: "data/logos/meac.gif",
    aliases: ["MEAC", "Mid-Eastern Athletic"],
  },
  {
    name: "Mid-Continent Conference",
    path: "data/logos/midc.gif",
    aliases: ["Mid-Continent", "Mid Continent", "Mid-Con"],
  },
  {
    name: "Missouri Valley Conference",
    path: "data/logos/mvall.gif",
    aliases: ["Missouri Valley", "MVC"],
  },
  {
    name: "Mountain West Conference",
    path: "data/logos/mwc.gif",
    aliases: ["Mountain West", "MWC"],
  },
  {
    name: "Northeast Conference",
    path: "data/logos/nec.gif",
    aliases: ["NEC", "North East Conference"],
  },
  {
    name: "Ohio Valley Conference",
    path: "data/logos/ovc.gif",
    aliases: ["Ohio Valley", "OVC"],
  },
  {
    name: "Pac-10 Conference",
    path: "data/logos/pac10.gif",
    aliases: ["Pac-10", "Pac 10", "Pacific-10"],
  },
  {
    name: "Pac-12 Conference",
    path: "data/logos/pac12.gif",
    aliases: ["Pac-12", "Pac 12", "Pacific-12"],
  },
  {
    name: "Patriot League",
    path: "data/logos/patlg.gif",
    aliases: ["Patriot"],
  },
  {
    name: "Pioneer League",
    path: "data/logos/pion.gif",
    aliases: ["Pioneer"],
  },
  {
    name: "Sun Belt Conference",
    path: "data/logos/sbc.gif",
    aliases: ["Sun Belt", "SBC", "Sunbelt"],
  },
  {
    name: "Southeastern Conference",
    path: "data/logos/sec.gif",
    aliases: ["SEC", "South Eastern Conference", "Southeastern"],
  },
  {
    name: "Southland Conference",
    path: "data/logos/slc.gif",
    aliases: ["Southland", "SLC"],
  },
  {
    name: "Southern Conference",
    path: "data/logos/socon.gif",
    aliases: ["Southern", "SoCon"],
  },
  {
    name: "Summit League",
    path: "data/logos/summ.gif",
    aliases: ["Summit", "The Summit League"],
  },
  {
    name: "Southwestern Athletic Conference",
    path: "data/logos/swac.gif",
    aliases: ["Southwestern Athletic", "SWAC"],
  },
  {
    name: "Western Athletic Conference",
    path: "data/logos/wac.gif",
    aliases: ["Western Athletic", "WAC"],
  },
  {
    name: "West Coast Conference",
    path: "data/logos/wcc.gif",
    aliases: ["West Coast", "WCC"],
  },
];

const CONFERENCE_LOGO_OVERRIDE_INDEX = new Map<string, LogoEntry>();

for (const override of CONFERENCE_LOGO_OVERRIDES) {
  const baseTokens = tokensFrom(override.name);
  const tokenSet = new Set(baseTokens);
  for (const alias of override.aliases ?? []) {
    for (const token of tokensFrom(alias)) {
      tokenSet.add(token);
    }
  }

  const tokens = Array.from(tokenSet);
  const slugSource = baseTokens.length > 0 ? baseTokens : tokens;
  const entry: LogoEntry = {
    name: override.name,
    slug: slugFromTokens(slugSource),
    tokens,
    path: override.path,
  };

  const labels = collectLabelVariants([override.name, ...(override.aliases ?? [])], {
    includeConferenceVariants: true,
  });

  for (const label of labels) {
    const key = cacheKeyForLabel(label);
    if (!key || CONFERENCE_LOGO_OVERRIDE_INDEX.has(key)) {
      continue;
    }
    CONFERENCE_LOGO_OVERRIDE_INDEX.set(key, entry);
  }
}

function findConferenceLogoOverride(variants: readonly string[]): LogoEntry | undefined {
  for (const variant of variants) {
    const key = cacheKeyForLabel(variant);
    if (!key) {
      continue;
    }
    const entry = CONFERENCE_LOGO_OVERRIDE_INDEX.get(key);
    if (entry) {
      return entry;
    }
  }
  return undefined;
}

export function getLogoEntryForLabels(labels: readonly (string | null | undefined)[]): LogoEntry | undefined {
  for (const variant of collectLabelVariants(labels)) {
    const entry = getLogoEntryForLabel(variant);
    if (entry) {
      return entry;
    }
  }
  return undefined;
}

export function getConferenceLogo(
  name: string | undefined,
  { shortName, aliases = [] }: { shortName?: string | null; aliases?: readonly (string | null | undefined)[] } = {},
): LogoEntry | undefined {
  const variants = collectLabelVariants([name, shortName, ...aliases], { includeConferenceVariants: true });
  const override = findConferenceLogoOverride(variants);
  if (override) {
    return override;
  }
  for (const variant of variants) {
    const entry = getLogoEntryForLabel(variant);
    if (entry) {
      return entry;
    }
  }
  return undefined;
}

function resolveLogoUrl(entry: LogoEntry | undefined): string | undefined {
  if (!entry) {
    return undefined;
  }

  const rawPath = entry.path.trim();
  if (!rawPath) {
    return undefined;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(rawPath) || rawPath.startsWith("//")) {
    return rawPath;
  }

  const trimmedPath = rawPath.replace(/^\/+/, "");
  const base = BASE && BASE.length > 1 ? BASE.replace(/\/?$/, "/") : "/";
  return `${base}${trimmedPath}`;
}

export function getTeamLogo(team: Team): LogoEntry | undefined {
  if (teamLogoCache.has(team.id)) {
    return teamLogoCache.get(team.id) ?? undefined;
  }

  const names: string[] = [];
  const push = (value: string | undefined) => {
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!names.includes(trimmed)) {
      names.push(trimmed);
    }
  };

  push(team.full_name);
  push(team.name);
  push(team.college);

  for (const candidate of names) {
    const direct = getLogoEntryForLabel(candidate);
    if (direct) {
      teamLogoCache.set(team.id, direct);
      return direct;
    }
  }

  // attempt with combined descriptors for schools with alternate forms
  if (team.full_name && team.name && team.full_name !== team.name) {
    const combined = findLogoByName(`${team.full_name} ${team.name}`);
    if (combined) {
      teamLogoCache.set(team.id, combined);
      return combined;
    }
  }

  const baseTokens = tokensFrom(team.full_name ?? team.name ?? "");
  if (baseTokens.length > 0) {
    const tokenSet = new Set(baseTokens);
    let best: LogoEntry | undefined;
    let bestScore = 0;

    for (const entry of NCAA_LOGOS) {
      let overlap = 0;
      for (const token of entry.tokens) {
        if (tokenSet.has(token)) {
          overlap += 1;
        }
      }
      if (overlap === 0) {
        continue;
      }
      const score = overlap / entry.tokens.length;
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }

    if (best && bestScore >= 0.5) {
      teamLogoCache.set(team.id, best);
      return best;
    }
  }

  teamLogoCache.set(team.id, null);
  return undefined;
}

export function getTeamLogoUrl(team: Team): string | undefined {
  return resolveLogoUrl(getTeamLogo(team));
}

export function getTeamMonogram(team: Team): string {
  if (team.abbreviation) {
    const trimmed = team.abbreviation.replace(/[^0-9A-Za-z]/g, "");
    if (trimmed) {
      return trimmed.slice(0, 3).toUpperCase();
    }
  }

  const source = team.full_name ?? team.college ?? team.name;
  if (!source) return "NCAAM";

  const words = source
    .replace(/[^0-9A-Za-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    const fallback = source.replace(/[^0-9A-Za-z]/g, "");
    return fallback.slice(0, 3).toUpperCase() || "NCAAM";
  }

  const initials: string[] = [];
  for (const word of words) {
    initials.push(word[0]!);
    if (initials.length === 3) break;
  }

  return initials.join("").toUpperCase();
}

function computeHue(team: Team): number {
  const basis = `${team.id}:${team.full_name ?? team.name ?? ""}`;
  let hash = 0;
  for (let i = 0; i < basis.length; i += 1) {
    hash = (hash * 31 + basis.charCodeAt(i)) % 360;
  }
  return hash;
}

export function getTeamAccentColors(team: Team): [string, string] {
  const hue = computeHue(team);
  const primary = `hsl(${hue}, 70%, 48%)`;
  const secondary = `hsl(${(hue + 35) % 360}, 72%, 40%)`;
  return [primary, secondary];
}

export function getConferenceLogoUrl(
  name: string | undefined,
  options: { shortName?: string | null; aliases?: readonly (string | null | undefined)[] } = {},
): string | undefined {
  return resolveLogoUrl(getConferenceLogo(name, options));
}

export function getConferenceMonogram(name: string | undefined): string {
  const source = name ?? "Conference";
  const cleaned = source
    .replace(/[^0-9A-Za-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "CONF";
  }

  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length === 0) {
    return cleaned.slice(0, 3).toUpperCase() || "CONF";
  }

  let monogram = "";
  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      monogram += token;
    } else {
      monogram += token[0]!;
    }
    if (monogram.length >= 3) {
      break;
    }
  }

  if (monogram.length < 2) {
    monogram = cleaned.replace(/\s+/g, "").slice(0, 3);
  }

  return monogram.slice(0, 3).toUpperCase() || "CONF";
}

export function getLogoUrl(entry: LogoEntry | undefined): string | undefined {
  return resolveLogoUrl(entry);
}
