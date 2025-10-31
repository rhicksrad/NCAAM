import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

const CACHE_DIR = path.resolve(process.cwd(), ".cache", "cbb");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RETRIES = 4;
const MIN_REQUEST_INTERVAL_MS = 1250;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const COOKIE_JAR = path.join(CACHE_DIR, "cookies.txt");
const CURL_HEADERS = [
  "-H",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "-H",
  "Accept-Language: en-US,en;q=0.9",
  "-H",
  "Cache-Control: no-cache",
  "-H",
  "Pragma: no-cache",
  "-H",
  "Sec-Fetch-Dest: document",
  "-H",
  "Sec-Fetch-Mode: navigate",
  "-H",
  "Sec-Fetch-Site: same-origin",
  "-H",
  "Upgrade-Insecure-Requests: 1",
];

const pending = new Map<string, Promise<string>>();
let cacheReady: Promise<void> | null = null;
let lastRequestAt = 0;
const execFileAsync = promisify(execFile);
const STATUS_MARKER = "__curl_http_status__";

async function ensureCacheDir(): Promise<void> {
  if (!cacheReady) {
    cacheReady = fs
      .mkdir(CACHE_DIR, { recursive: true })
      .then(async () => {
        await fs.open(COOKIE_JAR, "a").then(file => file.close());
      })
      .then(() => undefined);
  }
  await cacheReady;
}

function cachePathFor(url: string): string {
  const hash = createHash("sha1").update(url).digest("hex");
  return path.join(CACHE_DIR, `${hash}.html`);
}

async function readCache(url: string): Promise<string | null> {
  if (process.env.FORCE === "1") {
    return null;
  }
  const filePath = cachePathFor(url);
  try {
    const stat = await fs.stat(filePath);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
      return null;
    }
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeCache(url: string, html: string): Promise<void> {
  const filePath = cachePathFor(url);
  await fs.writeFile(filePath, html, "utf8");
}

function jitter(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs);
}

async function requestWithCurl(url: string): Promise<{ status: number; body: string }> {
  const sinceLast = Date.now() - lastRequestAt;
  if (sinceLast < MIN_REQUEST_INTERVAL_MS) {
    await sleep(MIN_REQUEST_INTERVAL_MS - sinceLast + jitter(100, 200));
  }
  const args = [
    "-sS",
    "-L",
    "--compressed",
    "--connect-timeout",
    "10",
    "--max-time",
    "45",
    "-A",
    USER_AGENT,
    "--cookie",
    COOKIE_JAR,
    "--cookie-jar",
    COOKIE_JAR,
    ...CURL_HEADERS,
    "-w",
    `\n${STATUS_MARKER}%{http_code}\n`,
    url,
  ];
  const { stdout } = await execFileAsync("curl", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const markerIndex = stdout.lastIndexOf(STATUS_MARKER);
  if (markerIndex === -1) {
    throw new Error(`Unable to parse curl response for ${url}`);
  }
  const statusLine = stdout.slice(markerIndex + STATUS_MARKER.length).trim();
  const body = stdout.slice(0, markerIndex).trimEnd();
  const status = Number.parseInt(statusLine, 10);
  if (!Number.isFinite(status)) {
    throw new Error(`Invalid HTTP status from curl for ${url}: ${statusLine}`);
  }
  lastRequestAt = Date.now();
  return { status, body };
}

async function performFetch(url: string): Promise<string> {
  await ensureCacheDir();
  const cached = await readCache(url);
  if (cached !== null) {
    return cached;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      const backoff = 1000 * Math.pow(2, attempt - 1);
      await sleep(backoff + jitter(250, 750));
    } else {
      await sleep(jitter(1500, 2500));
    }

    try {
      const { status, body } = await requestWithCurl(url);
      if (status === 429 || status >= 500) {
        const baseDelay = status === 429 ? 5000 : 2500;
        const waitMs = baseDelay + attempt * 2000 + jitter(750, 1750);
        await sleep(waitMs);
        continue;
      }
      if (status >= 400) {
        throw new Error(`Failed to fetch ${url} (HTTP ${status})`);
      }
      await writeCache(url, body);
      return body;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      console.warn(`Retrying ${url} after error:`, error);
    }
  }

  throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES + 1} attempts`);
}

export async function fetchHtml(url: string): Promise<string> {
  const existing = pending.get(url);
  if (existing) {
    return existing;
  }
  const task = performFetch(url).finally(() => {
    pending.delete(url);
  });
  pending.set(url, task);
  return task;
}

