import { ProxyAgent, setGlobalDispatcher } from "undici";

import { loadSecret } from "../lib/secrets.js";

const DEFAULT_UPSTREAM = "https://api.balldontlie.io";
const RAW_PROXY_BASE = (process.env.BDL_PROXY_BASE || "").trim();
const PROXY_BASE = RAW_PROXY_BASE.replace(/\/$/, "");
const USE_PROXY = PROXY_BASE.length > 0;
export const BDL_BASE = USE_PROXY ? PROXY_BASE : DEFAULT_UPSTREAM;

const proxyUrl =
  process.env.HTTPS_PROXY ??
  process.env.https_proxy ??
  process.env.HTTP_PROXY ??
  process.env.http_proxy ??
  null;

if (proxyUrl) {
  try {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  } catch (error) {
    console.warn(`Failed to configure proxy agent for ${proxyUrl}: ${String(error)}`);
  }
}

const MAX_RETRIES = 3;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  if (typeof (input as Request).url === "string") {
    return (input as Request).url;
  }
  throw new Error("Unsupported request input type for Ball Don't Lie request");
}

function resolveBdlKey(): string | undefined {
  const candidates = [
    process.env.BDL_API_KEY,
    process.env.BALLDONTLIE_API_KEY,
    process.env.BALL_DONT_LIE_API_KEY,
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const fileKey = loadSecret("bdl_api_key", {
    aliases: ["ball_dont_lie_api_key", "balldontlie_api_key", "ball-dont-lie"],
  });

  return fileKey?.trim() || undefined;
}

export function requireBallDontLieKey(): string {
  const key = resolveBdlKey();
  if (!key) {
    throw new Error(
      "Missing BALLDONTLIE_API_KEY — set it or use BDL_PROXY_BASE to route via proxy.",
    );
  }
  return key;
}

export function formatBdlAuthHeader(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return trimmed;
  if (/^Bearer\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Bearer ${trimmed}`;
}

export function buildUrl(path: string, search = ""): URL {
  const base = USE_PROXY ? PROXY_BASE : DEFAULT_UPSTREAM;
  const normalizedPath = normalizePath(path);
  return new URL(`${base}${normalizedPath}${search}`);
}

export async function execute<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  if (process.env.CI === "true" && !headers.has("Bdl-Ci")) {
    headers.set("Bdl-Ci", "1");
  }

  if (!USE_PROXY && !headers.has("Authorization")) {
    headers.set("Authorization", formatBdlAuthHeader(requireBallDontLieKey()));
  }

  const targetUrl = resolveRequestUrl(input);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetch(input, { ...init, headers });
    const bodyText = await response.text().catch(() => "");

    if (response.ok) {
      if (!bodyText) {
        return {} as T;
      }
      try {
        return JSON.parse(bodyText) as T;
      } catch (error) {
        const snippet = bodyText.slice(0, 300).replace(/\s+/g, " ");
        throw new Error(
          `Failed to parse JSON from ${targetUrl} — ${(error as Error).message} — ${snippet}`,
        );
      }
    }

    const snippet = bodyText.slice(0, 300).replace(/\s+/g, " ");
    if (response.status >= 500 && attempt < MAX_RETRIES - 1) {
      await wait(400 * (attempt + 1));
      continue;
    }

    if (response.status === 429 && attempt < MAX_RETRIES - 1) {
      await wait(400 * (attempt + 1));
      continue;
    }

    throw new Error(`Network error for ${targetUrl} — ${response.status} ${response.statusText} — ${snippet}`);
  }

  throw new Error(`Retries exhausted for ${targetUrl}`);
}

export async function request<T>(url: string | URL, init?: RequestInit): Promise<T> {
  const target = typeof url === "string" ? url : url.toString();
  return execute<T>(target, init);
}
