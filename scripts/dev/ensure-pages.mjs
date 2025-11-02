import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "fs";

mkdirSync("public", { recursive: true });

const HERO_STACK = (heading, lede, compact, ctas = []) => {
  const className = compact ? "hero hero--compact" : "hero";
  const stackGap = compact ? "sm" : "lg";
  const buttons = ctas.length
    ? `\n      <div class="stack" data-gap="sm">\n        ${ctas
          .map(({ href, label, variant }) => `<a class="button" data-variant="${variant ?? "ghost"}" href="${href}">${label}</a>`)
          .join("\n        ")}\n      </div>`
    : "";
  return `<section class="${className}">\n  <div class="container hero__inner">\n    <div class="stack" data-gap="${stackGap}">\n      <h1>${heading}</h1>\n      <p class="hero__lede">${lede}</p>${buttons}\n    </div>\n  </div>\n</section>`;
};

const HERO_NOTE = (note) => `<section class="hero hero--compact">\n  <div class="container hero__inner">\n    <div class="stack" data-gap="sm">\n      <h1 class="hero__season-note">${note}</h1>\n    </div>\n  </div>\n</section>`;

const HEADER = `<header class="site-header">\n  <div class="container site-header__inner">\n    <a class="site-brand" href="./index.html">\n      <span class="site-brand__title">NCAAM Hub</span>\n      <span class="site-brand__sub">Men's College Basketball</span>\n    </a>\n    <div class="site-header__tools">\n      <button class="theme-toggle" type="button" data-theme-toggle aria-label="Toggle dark mode" aria-pressed="false">\n        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">\n          <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5A6.5 6.5 0 0 1 12 3.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>\n          <path d="M12 1v3m0 16v3M4.22 4.22l2.12 2.12m11.32 11.32 2.12 2.12M1 12h3m16 0h3M4.22 19.78l2.12-2.12m11.32-11.32 2.12-2.12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.65"></path>\n        </svg>\n        <span>Theme</span>\n      </button>\n    </div>\n  </div>\n  <div class="container site-header__nav">\n    <div id="site-nav"></div>\n  </div>\n</header>`;

const PAGES = [
  {
    file: "index.html",
    script: "home.js",
    title: "NCAAM Hub",
    description: "Live data, rankings, and editorial analysis for men's college basketball.",
    ogTitle: "NCAAM Hub",
    ogDescription: "Live data, rankings, and editorial analysis for men's college basketball.",
    hero: HERO_STACK(
      "The pulse of men's college hoops.",
      "From preseason projections to March chaos, explore a data newsroom built for diehard NCAA fans. Track teams, scout players, and see how the bracket is shaping up.",
      false,
      [
        { href: "./teams.html", label: "Explore teams", variant: "primary" },
        { href: "./standings.html", label: "View standings", variant: "ghost" }
      ]
    )
  },
  {
    file: "teams.html",
    script: "teams.js",
    title: "Teams · NCAAM Hub",
    description: "Browse every Division I program with conference groupings and visual identities.",
    ogTitle: "Teams · NCAAM Hub",
    ogDescription: "Browse every Division I program with conference groupings and visual identities.",
    hero: HERO_STACK(
      "Teams",
      "Browse the D-I landscape by conference, colors, and rosters to find your next bracket pick.",
      true
    )
  },
  {
    file: "players.html",
    script: "players.js",
    title: "Players · NCAAM Hub",
    description: "Track impact players with sortable scouting cards and quick bios.",
    ogTitle: "Players · NCAAM Hub",
    ogDescription: "Track impact players with sortable scouting cards and quick bios.",
    hero: HERO_STACK(
      "Players",
      "Track impact players with sortable scouting cards and quick bios.",
      true
    )
  },
  {
    file: "games.html",
    script: "games.js",
    title: "Games · NCAAM Hub",
    description: "See recent matchups with context, scores, and pace notes from around Division I.",
    ogTitle: "Games · NCAAM Hub",
    ogDescription: "See recent matchups with context, scores, and pace notes from around Division I.",
    hero: HERO_STACK(
      "Games",
      "Scan the latest results, filter by date, and trace momentum across the national slate.",
      true
    )
  },
  {
    file: "rankings.html",
    script: "rankings.js",
    title: "Rankings · NCAAM Hub",
    description: "Follow national polls and metrics with context for movers and shakers each week.",
    ogTitle: "Rankings · NCAAM Hub",
    ogDescription: "Follow national polls and metrics with context for movers and shakers each week.",
    hero: HERO_STACK(
      "Rankings",
      "Compare AP polls, resumes, and heat checks to see who’s rising before Selection Sunday.",
      true
    )
  },
  {
    file: "standings.html",
    script: "standings.js",
    title: "Standings · NCAAM Hub",
    description: "Conference-by-conference standings with splits, streaks, and qualifier tags.",
    ogTitle: "Standings · NCAAM Hub",
    ogDescription: "Conference-by-conference standings with splits, streaks, and qualifier tags.",
    hero: HERO_STACK(
      "Standings",
      "Track conference races, streaks, and seed lines with sortable, zebra-striped tables.",
      true
    )
  }
];

const shell = (page) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<base href="./">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<meta property="og:title" content="${page.ogTitle}" />
<meta property="og:description" content="${page.ogDescription}" />
<meta property="og:image" content="./og-base.svg" />
<meta name="theme-color" content="#0B1024" />
<link rel="icon" type="image/svg+xml" href="./icon.svg">
<link rel="stylesheet" href="./styles/index.css">
<script>window.NCAAM_WORKER_URL="https://ncaam.hicksrch.workers.dev/v1";</script>
</head>
<body>
${HEADER}
${page.hero}
<main id="app" class="container"></main>
<script type="module" src="./scripts/theme-toggle.js"></script>
<script type="module" src="./scripts/nav.js"></script>
<script type="module" src="./scripts/${page.script}"></script>
</body>
</html>\n`;

for (const page of PAGES) {
  writeFileSync(`public/${page.file}`, shell(page));
}

// unify 404
if (!existsSync("public/404.html")) {
  writeFileSync("public/404.html", `<!doctype html><meta charset="utf-8"><base href="./"><title>404</title>\n<link rel="stylesheet" href="./styles/index.css">\n<header class=\"site-header\"></header>\n<main class=\"container\"><h1>Page not found</h1><p>Use the nav above to continue.</p></main>\n<script type=\"module\" src=\"./scripts/nav.js\"></script>`);
}

// remove any root-level duplicates that confuse Pages
try { unlinkSync("teams.html"); } catch {}
