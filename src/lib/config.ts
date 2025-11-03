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

function ensureLeadingSlash(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}

function ensureTrailingSlash(value: string): string {
  const withLeading = ensureLeadingSlash(value);
  return withLeading.endsWith("/") ? withLeading : `${withLeading}/`;
}

function normalizeBase(value: unknown): string | undefined {
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

function readBaseOverride(): string | undefined {
  try {
    const candidate = (globalThis as { NCAAM_BASE?: unknown }).NCAAM_BASE;
    return normalizeBase(candidate);
  } catch {
    return undefined;
  }
}

function detectBaseFromModule(): string | undefined {
  try {
    const moduleUrl = typeof import.meta !== "undefined" ? import.meta.url : undefined;
    if (!moduleUrl) {
      return undefined;
    }

    const resolved = new URL("../../..", moduleUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return undefined;
    }

    return detectBaseFromPath(resolved.pathname);
  } catch {
    return undefined;
  }
}

function detectBaseFromDocument(): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  try {
    const baseElement = document.querySelector("base[href]") as HTMLBaseElement | null;
    const rawBase = baseElement?.href ?? document.baseURI;
    if (!rawBase) {
      return undefined;
    }

    const resolved = new URL(
      rawBase,
      typeof location !== "undefined" && location?.href ? location.href : rawBase,
    );
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return undefined;
    }

    return detectBaseFromPath(resolved.pathname);
  } catch {
    return undefined;
  }
}

function detectBaseFromPath(pathname: string): string {
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

function detectBaseFromLocation(): string {
  if (typeof location === "undefined" || typeof location.pathname !== "string") {
    return DEFAULT_BASE;
  }

  return detectBaseFromPath(location.pathname);
}

export const BASE =
  readBaseOverride() ??
  detectBaseFromModule() ??
  detectBaseFromDocument() ??
  detectBaseFromLocation();

function readGlobalWorkerUrl(): unknown {
  if (typeof globalThis === "undefined" || !globalThis) {
    return undefined;
  }
  try {
    return (globalThis as { NCAAM_WORKER_URL?: unknown }).NCAAM_WORKER_URL;
  } catch {
    return undefined;
  }
}

function normalizeWorkerBase(value: unknown): string {
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
