type Stored<T> = {
  value: T;
  expires: number;
};

function storageKey(key: string): string {
  return `ncaam_cache:${key}`;
}

export function readCache<T>(key: string): T | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (!parsed || typeof parsed !== 'object') return undefined;
    if (typeof parsed.expires !== 'number' || parsed.expires <= Date.now()) {
      window.localStorage.removeItem(storageKey(key));
      return undefined;
    }
    return parsed.value;
  } catch {
    return undefined;
  }
}

export function writeCache<T>(key: string, value: T, ttlMs: number): void {
  if (typeof window === 'undefined') return;
  try {
    const stored: Stored<T> = { value, expires: Date.now() + ttlMs };
    window.localStorage.setItem(storageKey(key), JSON.stringify(stored));
  } catch {
    /* noop */
  }
}

export async function withCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = readCache<T>(key);
  if (cached !== undefined) return cached;
  const value = await loader();
  writeCache(key, value, ttlMs);
  return value;
}

export function clearCache(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    /* noop */
  }
}
