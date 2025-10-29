import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "fs";

mkdirSync("public", { recursive: true });

const PAGES = [
  ["index.html","home.js","NCAAM Hub"],
  ["teams.html","teams.js","Teams"],
  ["players.html","players.js","Players"],
  ["games.html","games.js","Games"],
  ["rankings.html","rankings.js","Rankings"],
  ["standings.html","standings.js","Standings"],
  ["diag.html","diag.js","Diag"]
];

const shell = (title, script) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="stylesheet" href="./styles.css">
<script>window.NCAAM_WORKER_URL = "https://ncaam.hicksrch.workers.dev/v1";</script>
</head><body>
<header id="site-nav"></header>
<main id="app" class="container"></main>
<script type="module" src="./scripts/nav.js"></script>
<script type="module" src="./scripts/${script}"></script>
</body></html>`;

for (const [file, js, title] of PAGES) {
  writeFileSync(`public/${file}`, shell(title, js));
}

// unify 404
if (!existsSync("public/404.html")) {
  writeFileSync("public/404.html", `<!doctype html><meta charset="utf-8"><title>404</title>
<link rel="stylesheet" href="./styles.css">
<header id="site-nav"></header>
<main class="container"><h1>Page not found</h1><p>Use the nav above to continue.</p></main>
<script type="module" src="./scripts/nav.js"></script>`);
}

// base styles
if (!existsSync("public/styles.css")) {
  writeFileSync("public/styles.css", `body{font:16px/1.5 ui-sans-serif,system-ui;margin:0;background:#0b1220;color:#e6edf3}
#site-nav{padding:12px 16px;background:#0b1220;position:sticky;top:0}
.container{max-width:1100px;margin:32px auto;padding:16px;background:#101826;min-height:60vh;border-radius:12px}
.nav a{color:#e6edf3;text-decoration:none;padding:.5rem .75rem;border-radius:8px}
.nav a.active{background:#2a3548}
.grid{display:grid;gap:12px}
.grid.cols-3{grid-template-columns:repeat(3,1fr)}
.card{background:#141d2b;border:1px solid #223048;border-radius:10px;padding:12px}
.badge{display:inline-block;background:#223048;padding:.1rem .5rem;border-radius:999px}
ul.clean{list-style:none;padding-left:0}
table{width:100%;border-collapse:collapse}th,td{padding:.5rem;border-bottom:1px solid #223048}th{text-align:left}
input.search{width:100%;padding:.5rem .75rem;border-radius:8px;border:1px solid #223048;background:#0f1724;color:#e6edf3}`);
}

// remove any root-level duplicates that confuse Pages
try { unlinkSync("teams.html"); } catch {}
