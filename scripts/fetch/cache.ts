import { mkdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const CACHE_DIR = path.join(ROOT, "data/cache/bdl");
export const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

interface CacheEnvelope<T> {
  cachedAt: string;
  value: T;
}

function keyToPath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]+/g, "-");
  return path.join(CACHE_DIR, `${safeKey}.json`);
}

async function isFresh(filePath: string, ttlMs: number): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return Date.now() - stats.mtimeMs <= ttlMs;
  } catch {
    return false;
  }
}

export async function readCache<T>(key: string): Promise<CacheEnvelope<T> | null> {
  const filePath = keyToPath(key);
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  const filePath = keyToPath(key);
  const envelope: CacheEnvelope<T> = {
    cachedAt: new Date().toISOString(),
    value,
  };
  const payload = `${JSON.stringify(envelope, null, 2)}\n`;
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, payload, "utf8");
}

export async function withCache<T>(
  key: string,
  ttlMs: number = DEFAULT_TTL_MS,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (process.env.USE_BDL_CACHE === "1") {
    const cached = await readCache<T>(key);
    if (!cached) {
      throw new Error(`USE_BDL_CACHE=1 but cache missing for ${key} in data/cache/bdl`);
    }
    return cached.value;
  }

  if (process.env.NO_CACHE === "1") {
    const fresh = await fetcher();
    await writeCache(key, fresh);
    return fresh;
  }

  const filePath = keyToPath(key);
  if (await isFresh(filePath, ttlMs)) {
    const cached = await readCache<T>(key);
    if (cached) {
      return cached.value;
    }
  }

  const fresh = await fetcher();
  await writeCache(key, fresh);
  return fresh;
}
