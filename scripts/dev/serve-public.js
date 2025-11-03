import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

import { ensureNcaALogos } from '../lib/ncaa-logos.mjs';
import { ensureConferencePlayers } from './ensure-cbb-player-stats.js';
import { ensureTeamHeightSnapshot } from './ensure-team-heights.js';

const SCRAPE_ON_START = (() => {
  const raw = process.env.CBB_SCRAPE_ON_START;
  if (!raw) return false;
  return /^(1|true|yes)$/iu.test(raw);
})();

const DEFAULT_PORT = 8787;
const PUBLIC_ROOT = resolve(new URL('../../public', import.meta.url).pathname);

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.woff', 'font/woff'],
  ['.ttf', 'font/ttf'],
]);

function resolvePathname(rawPathname) {
  if (!rawPathname || rawPathname === '/') {
    return '/index.html';
  }

  if (rawPathname === '/NBA' || rawPathname === '/NBA/') {
    return '/index.html';
  }

  if (rawPathname.startsWith('/NBA/')) {
    const stripped = rawPathname.slice(4);
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }

  return rawPathname;
}

function normalizePath(rawPathname) {
  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    pathname = rawPathname;
  }

  pathname = resolvePathname(pathname);

  if (pathname.endsWith('/')) {
    pathname = `${pathname}index.html`;
  }

  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }

  return pathname;
}

function resolveFilePath(pathname) {
  const normalized = normalizePath(pathname);
  const candidate = resolve(PUBLIC_ROOT, `.${normalized}`);
  if (!candidate.startsWith(PUBLIC_ROOT)) {
    throw new Error('Attempted path traversal');
  }
  return candidate;
}

async function readStaticFile(filePath) {
  const fileStat = await stat(filePath);
  if (fileStat.isDirectory()) {
    const indexPath = resolve(filePath, 'index.html');
    return readStaticFile(indexPath);
  }
  const body = await readFile(filePath);
  const type = MIME_TYPES.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream';
  return { body, type };
}

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2);
  send(res, statusCode, body, { 'Content-Type': 'application/json; charset=utf-8' });
}

await ensureNcaALogos();

try {
  const snapshot = await ensureTeamHeightSnapshot();
  if (snapshot) {
    console.log(
      `Prepared roster height snapshot for ${snapshot.measured_team_count}/${snapshot.team_count} teams.`,
    );
  }
} catch (error) {
  console.error('Unable to prepare roster height snapshot before startup.', error);
}

if (SCRAPE_ON_START) {
  try {
    const meta = await ensureConferencePlayers();
    if (meta) {
      const { player_count: playerCount, conferences } = meta;
      console.log(
        `Prepared College Basketball Reference stats for ${playerCount} players across ${conferences.length} conferences.`,
      );
    }
  } catch (error) {
    console.error('Unable to prepare College Basketball Reference player stats before startup.', error);
  }
} else {
  console.log(
    'Skipping College Basketball player stat refresh on startup. Using the committed data. Set CBB_SCRAPE_ON_START=1 to refresh.',
  );
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: 'Bad request' });
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  try {
    const filePath = resolveFilePath(pathname);
    const { body, type } = await readStaticFile(filePath);
    send(res, 200, body, { 'Content-Type': type });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = /** @type {{ code?: string }} */ (error).code;
      if (code === 'ENOENT') {
        sendJson(res, 404, { error: 'Not found', path: pathname });
        return;
      }
    }

    console.error('Static server error', error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

const envPort = Number.parseInt(process.env.PORT ?? process.env.DEV_PORT ?? '', 10);
const portArg = Number.parseInt(process.argv[2] ?? '', 10);
const port = Number.isFinite(portArg)
  ? portArg
  : Number.isFinite(envPort)
    ? envPort
    : DEFAULT_PORT;

server.listen(port, () => {
  console.log(`Static server listening on http://127.0.0.1:${port}/index.html`);
});
