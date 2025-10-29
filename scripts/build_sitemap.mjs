import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OWNER = process.env.GITHUB_REPOSITORY?.split('/')?.[0] || '';
const REPO = process.env.GITHUB_REPOSITORY?.split('/')?.[1] || '';
const isUserSite = REPO && REPO.toLowerCase() === `${OWNER.toLowerCase()}.github.io`;
const BASE = process.env.SITE_BASE || (isUserSite ? `https://${OWNER}.github.io` : `https://${OWNER}.github.io/${REPO}`);

const PAGES = [
  '/index.html',
  '/teams.html',
  '/players.html',
  '/games.html',
  '/rankings.html',
  '/standings.html'
];

function url(loc){
  const lastmod = new Date().toISOString();
  return `<url><loc>${BASE}${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.6</priority></url>`;
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(url).join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${BASE}/sitemap.xml
`;

const dir = existsSync('public') ? 'public' : '.';
await mkdir(dir, { recursive: true });
await writeFile(`${dir}/sitemap.xml`, sitemap, 'utf8');
await writeFile(`${dir}/robots.txt`, robots, 'utf8');
console.log(`Wrote ${dir}/sitemap.xml and ${dir}/robots.txt with BASE=${BASE}`);
