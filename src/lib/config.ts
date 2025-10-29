export const BASE = "/NCAAM/";
export const WORKER = (globalThis as any).NCAAM_WORKER_URL ?? "";
export const API = WORKER || "https://api.balldontlie.io/ncaab";
export const CACHE_TTL_MS = 5 * 60 * 1000;
