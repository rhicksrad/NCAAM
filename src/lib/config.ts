export const BASE = "/NCAAM/";
export const WORKER = (globalThis as any).NCAAM_WORKER_URL ?? "";
export const API = WORKER || "https://api.balldontlie.io/ncaab";
