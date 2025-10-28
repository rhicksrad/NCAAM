import fs from 'node:fs/promises';

const API = process.env.BDL_PROXY ?? 'https://bdlproxy.hicksrch.workers.dev/bdl';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function makeLimiter({ maxConcurrent = 1, minIntervalMs = 300 } = {}) {
  let active = 0;
  const queue: Array<{ fn: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>
    = [];
  let lastStart = 0;

  const scheduleNext = () => {
    if (!queue.length || active >= maxConcurrent) return;
    const task = queue.shift();
    if (!task) return;
    run(task.fn, task.resolve, task.reject);
  };

  const run = (
    fn: () => Promise<unknown>,
    resolve: (value: unknown) => void,
    reject: (reason?: unknown) => void,
  ) => {
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

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      if (active < maxConcurrent) {
        run(fn, resolve, reject);
      } else {
        queue.push({ fn, resolve, reject });
      }
    });
}

const limit = makeLimiter({ maxConcurrent: 1, minIntervalMs: 300 });

function parseRetryAfter(value: string | null): number | null {
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

async function fetchWithRetry(url: string): Promise<unknown> {
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 429) {
      const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
      const backoff = retryAfter != null ? retryAfter : Math.min(3000 * attempt, 15000);
      const jitter = Math.floor(Math.random() * 400);
      await sleep(backoff + jitter);
      continue;
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}${text ? `\n${text}` : ''}`);
    }
    return response.json();
  }
  throw new Error(`Exceeded retry budget for ${url}`);
}

function fetchJson(url: string) {
  return limit(() => fetchWithRetry(url));
}

async function fetchSeasonAverage(season: number, playerId: number, postseason: boolean) {
  const params = new URLSearchParams({
    season: String(season),
    player_id: String(playerId),
  });
  if (postseason) params.set('postseason', 'true');
  const url = `${API}/v1/season_averages?${params.toString()}`;
  return fetchJson(url);
}

async function main() {
  const [, , playerIdArg, startArg, endArg] = process.argv;
  const playerId = Number(playerIdArg);
  if (!Number.isFinite(playerId) || playerId <= 0) {
    console.error('Usage: tsx scripts/prewarm_bdl.ts <playerId> [startSeason] [endSeason]');
    process.exit(1);
    return;
  }

  const now = new Date().getFullYear();
  const start = Number.isFinite(Number(startArg)) ? Number(startArg) : 1979;
  const end = Number.isFinite(Number(endArg)) ? Number(endArg) : now - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    console.error('Invalid season range supplied.');
    process.exit(1);
    return;
  }

  const results: Array<{ season: number; reg: unknown; post: unknown }> = [];
  for (let season = start; season <= end; season += 1) {
    const [reg, post] = await Promise.all([
      fetchSeasonAverage(season, playerId, false),
      fetchSeasonAverage(season, playerId, true),
    ]);
    results.push({ season, reg, post });
  }

  const outputDir = 'public/data/bdl/season_averages';
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = `${outputDir}/${playerId}.json`;
  await fs.writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${results.length} seasons to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
