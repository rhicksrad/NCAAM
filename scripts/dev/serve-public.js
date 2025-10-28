import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const DEFAULT_PORT = 4173;
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

const portArg = Number.parseInt(process.argv[2] ?? '', 10);
const port = Number.isFinite(portArg) ? portArg : DEFAULT_PORT;

server.listen(port, () => {
  console.log(`Static server listening on http://127.0.0.1:${port}/NBA/index.html`);
});
