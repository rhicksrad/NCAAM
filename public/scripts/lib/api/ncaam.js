import { API } from "../config.js";
function normalizePath(path) {
    if (typeof path !== "string" || path.length === 0) {
        return "/";
    }
    return path.startsWith("/") ? path : `/${path}`;
}
function buildRequestInit(init = {}) {
    const headers = new Headers({ Accept: "application/json" });
    if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => headers.set(key, value));
    }
    else if (init.headers && typeof init.headers === "object") {
        for (const [key, value] of Object.entries(init.headers)) {
            if (value != null) {
                headers.set(key, String(value));
            }
        }
    }
    return {
        ...init,
        headers,
        method: init.method ?? "GET",
    };
}
export async function ncaam(path, init = {}) {
    const normalizedPath = normalizePath(path);
    const url = `${API}${normalizedPath}`;
    const response = await fetch(url, buildRequestInit(init));
    if (!response.ok) {
        throw new Error(`NCAAM ${response.status} ${response.statusText} for ${normalizedPath}`);
    }
    return response.json();
}
function toNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}
function toInteger(value) {
    const numeric = toNumber(value);
    if (numeric === null) {
        return null;
    }
    const rounded = Math.trunc(numeric);
    return Number.isFinite(rounded) ? rounded : null;
}
function toStringValue(value) {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    return null;
}
function normalizeTeam(team) {
    if (!team || (team.id == null && team.abbreviation == null && team.name == null && team.full_name == null)) {
        return null;
    }
    const id = toInteger(team.id);
    return {
        id,
        abbreviation: toStringValue(team.abbreviation),
        name: toStringValue(team.name),
        fullName: toStringValue(team.full_name),
    };
}
function toBoolean(value) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            return null;
        }
        return value !== 0;
    }
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true" || normalized === "1" || normalized === "yes") {
            return true;
        }
        if (normalized === "false" || normalized === "0" || normalized === "no") {
            return false;
        }
    }
    return null;
}
function normalizePlay(raw, fallbackSequence) {
    const order = toInteger(raw.order);
    const sequence = order ?? fallbackSequence;
    const description = toStringValue(raw.text);
    if (!description) {
        return null;
    }
    const period = toInteger(raw.period);
    const clock = toStringValue(raw.clock);
    const homeScore = toInteger(raw.home_score);
    const awayScore = toInteger(raw.away_score);
    const team = normalizeTeam(raw.team ?? null);
    const teamId = team?.id ?? null;
    const scoringPlay = toBoolean(raw.scoring_play) ?? false;
    const scoreValue = toNumber(raw.score_value);
    const rawType = toStringValue(raw.type);
    const gameId = toInteger(raw.game_id);
    const identifier = gameId !== null ? `play-${gameId}-${sequence}` : `play-${sequence}`;
    return {
        id: identifier,
        sequence,
        order: sequence,
        period,
        clock,
        description,
        homeScore,
        awayScore,
        teamId,
        team,
        possessionTeamId: teamId,
        isScoringPlay: scoringPlay,
        scoreValue,
        rawType,
    };
}
export function normalizeGamePlayByPlayResponse(raw) {
    if (!raw || !Array.isArray(raw.data)) {
        return [];
    }
    const result = [];
    let fallbackSequence = 0;
    for (const entry of raw.data) {
        fallbackSequence += 1;
        const normalized = normalizePlay(entry, fallbackSequence);
        if (!normalized) {
            continue;
        }
        result.push(normalized);
    }
    result.sort((a, b) => a.sequence - b.sequence);
    return result;
}
const PLAY_PAGE_SIZE = 50;
const MAX_PLAY_PAGES = 40;
async function fetchGamePlays(gameId) {
    const collected = [];
    let cursor = null;
    let iterations = 0;
    do {
        iterations += 1;
        const params = new URLSearchParams();
        params.set('game_id', gameId);
        params.set('per_page', String(PLAY_PAGE_SIZE));
        if (cursor) {
            params.set('cursor', cursor);
        }
        const response = await ncaam(`/plays?${params.toString()}`);
        const page = Array.isArray(response.data) ? response.data : [];
        collected.push(...page);
        const nextCursorRaw = response.meta?.next_cursor;
        const nextCursor = nextCursorRaw == null ? null : toStringValue(nextCursorRaw);
        if (!nextCursor || page.length === 0) {
            break;
        }
        cursor = nextCursor;
    } while (iterations < MAX_PLAY_PAGES);
    return collected;
}
export async function getGamePlayByPlay(gameId) {
    if (gameId === null || gameId === undefined) {
        return [];
    }
    const normalizedId = typeof gameId === "string" ? gameId.trim() : gameId;
    if (normalizedId === "" || normalizedId === null || Number.isNaN(normalizedId)) {
        return [];
    }
    const idString = String(normalizedId);
    const plays = await fetchGamePlays(idString);
    return normalizeGamePlayByPlayResponse({ data: plays });
}
