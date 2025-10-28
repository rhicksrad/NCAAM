/**
 * Build a simple sitemap from known pages. Run:
 *   node scripts/build_sitemap.mjs
 * Emits: sitemap.xml at repo root (or public/) depending on layout.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const BASE = process.env.SITE_BASE || 'https://rhicksrad.github.io';
const PAGES = [
  '/', '/index.html',
  '/teams.html', '/players.html',
  '/team.html', '/player.html',
  '/games.html', '/standings.html', '/rankings.html',
  '/404.html'
];

function url(loc){
  const lastmod = new Date().toISOString();
  return `<url><loc>${BASE}${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(url).join('\n')}
</urlset>
`;

const targetDir = existsSync('public') ? 'public' : '.';
if (targetDir === 'public') {
  await mkdir('public', { recursive: true });
  await writeFile('public/sitemap.xml', xml, 'utf8');
  console.log('Wrote public/sitemap.xml');
} else {
  await writeFile('sitemap.xml', xml, 'utf8');
  console.log('Wrote sitemap.xml');
}
