const DEFAULT_BASE = "/";
const DEFAULT_WORKER_BASE = "https://ncaam.hicksrch.workers.dev/v1";
const KNOWN_PAGE_SUFFIXES = [
    "index.html",
    "teams.html",
    "players.html",
    "games.html",
    "rankings.html",
    "standings.html",
    "about.html",
];
const DETAIL_PATH_MARKERS = ["team/", "player/"];
function ensureLeadingSlash(value) {
    return value.startsWith("/") ? value : `/${value}`;
}
function ensureTrailingSlash(value) {
    const withLeading = ensureLeadingSlash(value);
    return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}
function normalizeBase(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    if (trimmed === "/") {
        return DEFAULT_BASE;
    }
    return ensureTrailingSlash(trimmed);
}
function readBaseOverride() {
    try {
        const candidate = globalThis.NCAAM_BASE;
        return normalizeBase(candidate);
    }
    catch {
        return undefined;
    }
}
function detectBaseFromModule() {
    try {
        const moduleUrl = typeof import.meta !== "undefined" ? import.meta.url : undefined;
        if (!moduleUrl) {
            return undefined;
        }
        const resolved = new URL(moduleUrl);
        if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
            return undefined;
        }
        const marker = "/scripts/";
        const markerIndex = resolved.pathname.indexOf(marker);
        if (markerIndex !== -1) {
            const basePath = resolved.pathname.slice(0, markerIndex + 1);
            return basePath ? ensureTrailingSlash(basePath) : DEFAULT_BASE;
        }
        return detectBaseFromPath(resolved.pathname);
    }
    catch {
        return undefined;
    }
}
function detectBaseFromDocument() {
    if (typeof document === "undefined") {
        return undefined;
    }
    try {
        const baseElement = document.querySelector("base[href]");
        const rawBase = (baseElement === null || baseElement === void 0 ? void 0 : baseElement.href) ?? document.baseURI;
        if (!rawBase) {
            return undefined;
    }
    const resolved = new URL(rawBase, typeof location !== "undefined" && (location === null || location === void 0 ? void 0 : location.href) ? location.href : rawBase);
        if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
            return undefined;
        }
        return detectBaseFromPath(resolved.pathname);
    }
    catch {
        return undefined;
    }
}
function detectBaseFromPath(pathname) {
    if (!pathname) {
        return DEFAULT_BASE;
    }
    const normalizedPath = ensureLeadingSlash(pathname);
    for (const marker of DETAIL_PATH_MARKERS) {
        const token = `/${marker}`;
        const index = normalizedPath.indexOf(token);
        if (index === -1) {
            continue;
        }
        if (index === 0) {
            return DEFAULT_BASE;
        }
        const base = normalizedPath.slice(0, index + 1);
        return ensureTrailingSlash(base);
    }
    for (const suffix of KNOWN_PAGE_SUFFIXES) {
        const normalizedSuffix = ensureLeadingSlash(suffix);
        if (normalizedPath === normalizedSuffix) {
            return DEFAULT_BASE;
        }
        if (normalizedPath.endsWith(normalizedSuffix)) {
            const base = normalizedPath.slice(0, -normalizedSuffix.length);
            return base ? ensureTrailingSlash(base) : DEFAULT_BASE;
        }
    }
    if (normalizedPath.endsWith("/")) {
        return ensureTrailingSlash(normalizedPath);
    }
    const lastSlash = normalizedPath.lastIndexOf("/");
    if (lastSlash <= 0) {
        return normalizedPath.length > 1 ? ensureTrailingSlash(normalizedPath) : DEFAULT_BASE;
    }
    const base = normalizedPath.slice(0, lastSlash + 1);
    return ensureTrailingSlash(base);
}
function detectBaseFromLocation() {
    if (typeof location === "undefined" || typeof location.pathname !== "string") {
        return DEFAULT_BASE;
    }
    return detectBaseFromPath(location.pathname);
}
export const BASE = readBaseOverride() ?? detectBaseFromModule() ?? detectBaseFromDocument() ?? detectBaseFromLocation();
function readGlobalWorkerUrl() {
    if (typeof globalThis === "undefined" || !globalThis) {
        return undefined;
    }
    try {
        return globalThis.NCAAM_WORKER_URL;
    }
    catch {
        return undefined;
    }
}
function normalizeWorkerBase(value) {
    if (typeof value !== "string") {
        return DEFAULT_WORKER_BASE;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return DEFAULT_WORKER_BASE;
    }
    const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
    if (/\/v1$/i.test(withoutTrailingSlash)) {
        return withoutTrailingSlash;
    }
    if (/\/diag$/i.test(withoutTrailingSlash)) {
        return `${withoutTrailingSlash.slice(0, -5)}/v1`;
    }
    return `${withoutTrailingSlash}/v1`;
}
export const WORKER = normalizeWorkerBase(readGlobalWorkerUrl());
export const API = WORKER;
export const CACHE_TTL_MS = 5 * 60 * 1000;
