export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const corsOrigin = env.CORS_ALLOW_ORIGIN || 'https://rhicksrad.github.io';

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization,Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (!url.pathname.startsWith('/bdl/')) {
      return new Response('Not found', { status: 404 });
    }

    const upstream = new URL('https://api.balldontlie.io' + url.pathname.replace(/^\/bdl/, ''));
    upstream.search = url.search;

    const headers = new Headers(req.headers);
    const apiKey = env.BDL_API_KEY || env.BALLDONTLIE_API_KEY || '';
    if (apiKey) {
      headers.set('Authorization', apiKey);
    } else {
      headers.delete('Authorization');
    }
    headers.delete('Host');
    headers.delete('Origin');
    headers.delete('Referer');

    const cacheable =
      req.method === 'GET' &&
      (upstream.pathname.startsWith('/v1/players/active') ||
        upstream.pathname.startsWith('/v1/players') ||
        upstream.pathname.startsWith('/v1/games') ||
        upstream.pathname.startsWith('/v1/stats'));

    const cache = caches.default;
    const cacheKey = new Request(req.url, { method: 'GET' });

    if (cacheable) {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const headersWithCors = new Headers(hit.headers);
        headersWithCors.set('Access-Control-Allow-Origin', corsOrigin);
        return new Response(hit.body, { status: hit.status, headers: headersWithCors });
      }
    }

    const init = {
      method: req.method,
      headers,
      body:
        req.method === 'GET' || req.method === 'HEAD'
          ? null
          : await req.arrayBuffer(),
    };

    const res = await fetch(upstream, init);

    const outHeaders = new Headers(res.headers);
    outHeaders.set('Access-Control-Allow-Origin', corsOrigin);
    if (cacheable && res.ok) {
      outHeaders.set('Cache-Control', 'public, max-age=60');
    }

    const out = new Response(res.body, { status: res.status, headers: outHeaders });

    if (cacheable && res.ok) {
      waitUntil(ctx, cache.put(cacheKey, out.clone()));
    }

    return out;
  },
};

function waitUntil(ctx, promise) {
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(promise);
    return;
  }
  if (typeof globalThis !== 'undefined' && typeof globalThis.waitUntil === 'function') {
    globalThis.waitUntil(promise);
  }
}
