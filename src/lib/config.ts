export const BASE = "/NCAAM/";

const DEFAULT_WORKER_BASE = "https://ncaam.hicksrch.workers.dev/v1";

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
