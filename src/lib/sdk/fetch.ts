const DEFAULT_BASE = (() => {
  if (typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).NCAAM_API_BASE === 'string') {
    return String((window as unknown as Record<string, unknown>).NCAAM_API_BASE);
  }
  return 'https://ncaam.hicksrch.workers.dev/v1';
})();

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface FetchOptions {
  params?: Record<string, string | number | boolean | Array<string | number | boolean> | undefined>;
  signal?: AbortSignal;
}

function buildUrl(path: string, params?: FetchOptions['params']): string {
  const base = DEFAULT_BASE.endsWith('/') ? DEFAULT_BASE.slice(0, -1) : DEFAULT_BASE;
  const url = new URL(path.startsWith('/') ? path : `/${path}`, base);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

export async function fetchJSON<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = buildUrl(path, options.params);
  const headers: Record<string, string> = { Accept: 'application/json' };
  let attempt = 0;
  const maxAttempts = 3;
  while (true) {
    attempt += 1;
    try {
      const res = await fetch(url, { method: 'GET', headers, signal: options.signal });
      if (!res.ok) {
        if (attempt < maxAttempts && RETRY_STATUSES.has(res.status)) {
          const delay = Math.pow(2, attempt - 1) * 300 + Math.random() * 150;
          await sleep(delay);
          continue;
        }
        const body = await res.text().catch(() => '');
        throw new Error(`NCAAM ${res.status} ${res.statusText} for ${path}${body ? ` :: ${body.slice(0, 120)}` : ''}`);
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return res.json() as Promise<T>;
      }
      const text = await res.text();
      throw new Error(`NCAAM unexpected content-type for ${path}: ${ct || 'unknown'} :: ${text.slice(0, 120)}`);
    } catch (err) {
      if (attempt >= maxAttempts) throw err;
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      const delay = Math.pow(2, attempt - 1) * 300 + Math.random() * 150;
      await sleep(delay);
    }
  }
}

export { DEFAULT_BASE as API_BASE };
