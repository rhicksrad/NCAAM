import { NCAA_LOGOS, NCAA_LOGO_ALIASES, NCAA_LOGO_INDEX, } from "../data/ncaa-logo-map.js";
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
function normalize(value) {
    return value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function tokensFrom(value) {
    const normalized = normalize(value);
    if (!normalized) {
        return [];
    }
    return normalized.split(" ").filter(token => token && !STOPWORDS.has(token));
}
function slugFromTokens(tokens) {
    return tokens.join("-");
}
function resolveAlias(slug) {
    const seen = new Set();
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
function findLogoByName(value) {
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
const teamLogoCache = new Map();
export function getTeamLogo(team) {
    if (teamLogoCache.has(team.id)) {
        return teamLogoCache.get(team.id) ?? undefined;
    }
    const names = [];
    const push = (value) => {
        if (!value)
            return;
        const trimmed = value.trim();
        if (!trimmed)
            return;
        if (!names.includes(trimmed)) {
            names.push(trimmed);
        }
    };
    push(team.full_name);
    push(team.name);
    push(team.college);
    for (const candidate of names) {
        const direct = findLogoByName(candidate);
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
        let best;
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
export function getTeamLogoUrl(team) {
    const logo = getTeamLogo(team);
    return logo ? `/${logo.path}` : undefined;
}
export function getTeamMonogram(team) {
    if (team.abbreviation) {
        const trimmed = team.abbreviation.replace(/[^0-9A-Za-z]/g, "");
        if (trimmed) {
            return trimmed.slice(0, 3).toUpperCase();
        }
    }
    const source = team.full_name ?? team.college ?? team.name;
    if (!source)
        return "NCAAM";
    const words = source
        .replace(/[^0-9A-Za-z\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0) {
        const fallback = source.replace(/[^0-9A-Za-z]/g, "");
        return fallback.slice(0, 3).toUpperCase() || "NCAAM";
    }
    const initials = [];
    for (const word of words) {
        initials.push(word[0]);
        if (initials.length === 3)
            break;
    }
    return initials.join("").toUpperCase();
}
function computeHue(team) {
    const basis = `${team.id}:${team.full_name ?? team.name ?? ""}`;
    let hash = 0;
    for (let i = 0; i < basis.length; i += 1) {
        hash = (hash * 31 + basis.charCodeAt(i)) % 360;
    }
    return hash;
}
export function getTeamAccentColors(team) {
    const hue = computeHue(team);
    const primary = `hsl(${hue}, 70%, 48%)`;
    const secondary = `hsl(${(hue + 35) % 360}, 72%, 40%)`;
    return [primary, secondary];
}
