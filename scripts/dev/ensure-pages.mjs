import { mkdirSync, copyFileSync, existsSync, writeFileSync } from "fs";
mkdirSync("public", { recursive: true });

const PAGES = [
  "index.html",
  "teams.html",
  "players.html",
  "games.html",
  "rankings.html",
  "standings.html",
  "diag.html",
  "404.html"
];

const shell = (title, script) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <header id="site-nav"></header>
  <main id="app" class="container"></main>
  <script type="module" src="./scripts/nav.js"></script>
  ${script ? `<script type="module" src="./scripts/${script}"></script>` : ""}
</body>
</html>`;

const defaults = {
  "index.html":  shell("NCAAM Hub", "home.js"),
  "teams.html":  shell("Teams", "teams.js"),
  "players.html":shell("Players", "players.js"),
  "games.html":  shell("Games", "games.js"),
  "rankings.html": shell("Rankings", "rankings.js"),
  "standings.html": shell("Standings", "standings.js"),
  "diag.html":   shell("Diag", "diag.js"),
  "404.html": `<!doctype html><meta charset="utf-8"><title>404</title>
<link rel="stylesheet" href="./styles.css">
<header id="site-nav"></header>
<main class="container"><h1>Page not found</h1><p>Use the nav to continue.</p></main>
<script type="module" src="./scripts/nav.js"></script>`
};

for (const f of PAGES) {
  if (existsSync(f) && !existsSync(`public/${f}`)) copyFileSync(f, `public/${f}`);
  if (!existsSync(`public/${f}`)) writeFileSync(`public/${f}`, defaults[f]);
}

if (!existsSync("public/styles.css")) {
  writeFileSync("public/styles.css", `:root { color-scheme: light dark; }
body { font-family: system-ui, sans-serif; margin: 0; padding: 0; background: #f8f9fb; color: #0f172a; }
a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }
header { background: #0f172a; color: white; padding: 1rem; }
.nav { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; }
.nav a { color: white; padding: 0.25rem 0.5rem; border-radius: 999px; }
.nav a.active, .nav a:hover { background: rgba(255,255,255,0.2); }
.container { max-width: 960px; margin: 2rem auto; padding: 0 1rem; }
ul { list-style: disc; padding-left: 1.5rem; }
pre { background: #0f172a; color: #e2e8f0; padding: 1rem; overflow-x: auto; border-radius: 0.5rem; }
`);
}
