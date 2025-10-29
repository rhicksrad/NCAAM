import { NCAA_LOGO_INDEX, NCAA_LOGO_ALIASES, NCAA_LOGOS } from "../data/ncaa-logo-map.js";
const FALLBACK_LOGO = "assets/logos/ncaam-mark.svg";
const STOPWORDS = new Set(["and", "of", "the", "university", "college", "for", "at", "in"]);
function normalize(value) {
    return value
        .toLowerCase()
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9\s]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function tokenize(value) {
    const normalized = normalize(value);
    if (!normalized)
        return [];
    return normalized
        .split(" ")
        .filter(token => token.length > 0 && !STOPWORDS.has(token));
}
function slugify(tokens) {
    return tokens.join("-");
}
function resolveSlug(slug) {
    if (!slug)
        return undefined;
    if (Object.prototype.hasOwnProperty.call(NCAA_LOGO_INDEX, slug)) {
        return slug;
    }
    const alias = NCAA_LOGO_ALIASES[slug];
    if (alias && Object.prototype.hasOwnProperty.call(NCAA_LOGO_INDEX, alias)) {
        return alias;
    }
    return undefined;
}
function findByTokens(tokens) {
    if (tokens.length === 0)
        return undefined;
    const tokenSet = new Set(tokens);
    let bestSlug;
    let bestScore = 0;
    for (const entry of NCAA_LOGOS) {
        const { tokens: entryTokens } = entry;
        if (entryTokens.every(token => tokenSet.has(token))) {
            const score = entryTokens.length;
            if (score > bestScore) {
                bestScore = score;
                bestSlug = entry.slug;
            }
        }
    }
    return bestSlug;
}
function resolveFromTokens(tokens) {
    const slug = slugify(tokens);
    const direct = resolveSlug(slug);
    if (direct)
        return direct;
    const fallback = findByTokens(tokens);
    if (!fallback)
        return undefined;
    return resolveSlug(fallback) ?? fallback;
}
export function getTeamLogoPath(team) {
    const seen = new Set();
    const candidates = [team.full_name, team.name, team.abbreviation, team.conference]
        .filter((value) => Boolean(value && value.trim()));
    for (const candidate of candidates) {
        if (seen.has(candidate))
            continue;
        seen.add(candidate);
        const tokens = tokenize(candidate);
        const slug = resolveFromTokens(tokens);
        if (!slug)
            continue;
        const entry = NCAA_LOGO_INDEX[slug];
        if (entry) {
            return entry.path;
        }
    }
    return undefined;
}
export function getTeamLogo(team) {
    return getTeamLogoPath(team) ?? FALLBACK_LOGO;
}
