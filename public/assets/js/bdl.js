export const BDL_BASE = 'https://bdlproxy.hicksrch.workers.dev';

function buildProxyPath(path) {
  const normalized = normalizePath(path);
  if (normalized.startsWith('/bdl/')) {
    return normalized;
  }
  if (normalized === '/bdl') {
    return normalized;
  }
  return `/bdl${normalized}`;
}

function buildProxyUrl(path) {
  return `${BDL_BASE}${buildProxyPath(path)}`;
}

function makeLimiter({ maxConcurrent = 1, minIntervalMs = 300 } = {}) {
  let active = 0;
  const queue = [];
  let lastStart = 0;

  const scheduleNext = () => {
    if (!queue.length || active >= maxConcurrent) return;
    const task = queue.shift();
    if (!task) return;
    run(task.fn, task.resolve, task.reject);
  };

  const run = (fn, resolve, reject) => {
    const now = Date.now();
    const wait = Math.max(0, minIntervalMs - (now - lastStart));
    lastStart = now + wait;
    setTimeout(async () => {
      active += 1;
      try {
        const value = await fn();
        resolve(value);
      } catch (error) {
        reject(error);
      } finally {
        active -= 1;
        scheduleNext();
      }
    }, wait);
  };

  return (fn) =>
    new Promise((resolve, reject) => {
      if (active < maxConcurrent) {
        run(fn, resolve, reject);
      } else {
        queue.push({ fn, resolve, reject });
      }
    });
}

const limit = makeLimiter({ maxConcurrent: 1, minIntervalMs: 500 });
const memo = new Map();

function shouldMemoize(init = {}) {
  const method = typeof init.method === 'string' ? init.method.toUpperCase() : 'GET';
  if (method !== 'GET') return false;
  if (init.cache && init.cache.toLowerCase() === 'no-store') return false;
  return true;
}

function parseRetryAfter(value) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return Math.max(0, numeric * 1000);
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return Math.max(0, parsed - Date.now());
  }
  return null;
}

function normalizePath(path) {
  if (typeof path !== 'string' || !path) {
    return '/';
  }
  return path.startsWith('/') ? path : `/${path}`;
}

function buildRequestInit(init = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (init.headers instanceof Headers) {
    init.headers.forEach((value, key) => headers.set(key, value));
  } else if (init.headers && typeof init.headers === 'object') {
    for (const [key, value] of Object.entries(init.headers)) {
      if (value != null) headers.set(key, value);
    }
  }

  return {
    ...init,
    headers,
    method: init.method ?? 'GET',
  };
}

export async function fetchBDL(path, init = {}, { retries = 3 } = {}) {
  const url = buildProxyUrl(path);
  const requestInit = buildRequestInit(init);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetch(url, requestInit);
    if (response.status !== 429) {
      return response;
    }
    if (attempt === retries) {
      break;
    }
    const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
    const delay = retryAfter != null ? retryAfter : 500 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`BDL 429 after ${retries + 1} attempts for ${path}`);
}

async function fetchJsonWithRetry(path, init = {}, options = {}) {
  const response = await fetchBDL(path, init, options);

  if (response.status === 401) {
    console.error('Ball Don\'t Lie proxy authorization failed. Verify server-side key configuration.');
    const text = await response.text().catch(() => '');
    const proxiedPath = (() => {
      try {
        return new URL(response.url).pathname;
      } catch {
        return buildProxyPath(path);
      }
    })();
    throw new Error(`BDL 401 for ${proxiedPath}${text ? `: ${text.slice(0, 120)}` : ''}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const proxiedPath = (() => {
      try {
        return new URL(response.url).pathname;
      } catch {
        return buildProxyPath(path);
      }
    })();
    throw new Error(`BDL ${response.status} for ${proxiedPath}${text ? `: ${text.slice(0, 120)}` : ''}`);
  }

  return response.json();
}

export async function bdl(path, init = {}) {
  const normalizedPath = normalizePath(path);
  const proxyUrl = buildProxyUrl(normalizedPath);
  const memoKey = shouldMemoize(init) ? proxyUrl : null;
  if (memoKey && memo.has(memoKey)) {
    return memo.get(memoKey);
  }

  const task = limit(() => fetchJsonWithRetry(normalizedPath, init));
  if (!memoKey) {
    return task;
  }

  memo.set(memoKey, task);
  try {
    const result = await task;
    memo.set(memoKey, result);
    return result;
  } catch (error) {
    memo.delete(memoKey);
    throw error;
  }
}

export async function fetchSeasonAggregate({ season, playerId, postseason = false, signal } = {}) {
  const params = new URLSearchParams({
    season: String(season),
    player_id: String(playerId)
  });
  if (postseason) params.set('postseason', 'true');
  return bdl(`/v1/season_averages?${params.toString()}`, { signal });
}
