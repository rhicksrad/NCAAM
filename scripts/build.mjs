// Build the whole site into dist/. No framework: esbuild for TS/CSS, a string
// template for HTML, and two data steps (derive static datasets, snapshot ESPN).
import { build as esbuild } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile, readdir, stat } from "node:fs/promises";
import { existsSync, watch } from "node:fs";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NAV, PAGES, SITE } from "./pages.mjs";
import { deriveData } from "./derive-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const args = new Set(process.argv.slice(2));
const serve = args.has("--serve");

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function shell(page, assets, aboutHtml, buildStamp) {
  const nav = NAV.map((item) => {
    const current = item.href === page.file ? ' aria-current="page"' : "";
    return `<a href="./${item.href}"${current}>${item.label}</a>`;
  }).join("");
  const preloads = (assets.preload[page.entry] ?? [])
    .map((href) => `<link rel="modulepreload" href="./${href}">`)
    .join("\n");
  // Start the page's first data (and the hero photo) downloading with the
  // HTML, instead of after the script has loaded and asked for it.
  const FIRST_DATA = {
    home: ["live/scoreboard", "live/rankings"],
    game: ["live/scoreboard"],
    games: ["live/scoreboard"],
    rankings: ["live/rankings"],
    standings: ["live/standings"],
    teams: ["live/teams"],
    players: ["players"],
    lab: ["efficiency"],
  };
  // Backgrounds on elements the script builds: the parser cannot see them coming.
  const ART = { game: ["scoreboard.webp"], lab: ["chalkboard.webp"] };
  const early = [
    ...(page.file === "404.html" ? [] : FIRST_DATA[page.entry] ?? []).map((name) => `<link rel="preload" href="./data/${name}.json" as="fetch" crossorigin>`),
    ...(ART[page.entry] ?? []).map((name) => `<link rel="preload" href="./art/${name}" as="image" fetchpriority="high">`),
    ...(page.hero ? [
          '<link rel="preload" href="./art/hero-court-sm.webp" as="image" fetchpriority="high" media="(max-width: 700px)">',
          '<link rel="preload" href="./art/hero-court.webp" as="image" fetchpriority="high" media="(min-width: 701px)">',
        ] : []),
  ].join("\n");
  const skeleton = page.skeleton ?? aboutHtml;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escAttr(page.title)}</title>
<meta name="description" content="${escAttr(page.description)}">
<meta property="og:title" content="${escAttr(page.title)}">
<meta property="og:description" content="${escAttr(page.description)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${SITE.url}art/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#14213a">
<link rel="icon" href="./art/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="./art/apple-touch-icon.png">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="preload" href="./assets/fonts/big-shoulders.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="./assets/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="./${assets.css}">
${preloads}
${early}
<script type="module" src="./${assets.js[page.entry]}"></script>
</head>
<body data-page="${page.entry}"${page.hero ? ' class="has-hero"' : ""}>
<a class="skip" href="#main">Skip to content</a>
<header class="masthead">
  <div class="wrap masthead__in">
    <a class="brand" href="./index.html" aria-label="${SITE.name} home">
      <span class="brand__ball" aria-hidden="true"></span>
      <span class="brand__name">Field House</span>
    </a>
    <nav class="nav" aria-label="Site">${nav}</nav>
    <button class="finder" id="finder-open" type="button" aria-haspopup="dialog">
      <span>Find a team</span><kbd>/</kbd>
    </button>
  </div>
</header>
<main id="main">${skeleton}
</main>
<footer class="baseline">
  <div class="wrap baseline__in">
    <p class="baseline__mark">Field House</p>
    <p>An unofficial fan project by Ryan Hicks. Live scores, polls and standings come from ESPN's public feeds; season archives from Sports Reference and Bart Torvik. Team names and logos belong to their schools. <a href="./about.html">About this site</a>.</p>
    <p class="baseline__stamp">Snapshot built <time datetime="${buildStamp}" id="build-stamp">${buildStamp.slice(0, 16).replace("T", " ")} UTC</time></p>
  </div>
</footer>
</body>
</html>
`;
}

async function copyFonts() {
  const out = path.join(dist, "assets/fonts");
  await mkdir(out, { recursive: true });
  const nm = path.join(root, "node_modules/@fontsource-variable");
  await cp(path.join(nm, "big-shoulders/files/big-shoulders-latin-wght-normal.woff2"), path.join(out, "big-shoulders.woff2"));
  await cp(path.join(nm, "archivo/files/archivo-latin-wght-normal.woff2"), path.join(out, "archivo.woff2"));
}

function runSnapshot() {
  const offline = args.has("--offline") || process.env.SNAPSHOT === "seed";
  const result = spawnSync(
    process.execPath,
    [path.join(root, "node_modules/tsx/dist/cli.mjs"), path.join(root, "scripts/snapshot.ts"), ...(offline ? ["--seed"] : [])],
    { stdio: "inherit", cwd: root },
  );
  if (result.status !== 0) throw new Error("snapshot step failed");
}

async function bundle() {
  const entries = [...new Set(PAGES.map((p) => p.entry))];
  const result = await esbuild({
    absWorkingDir: root,
    entryPoints: [...entries.map((e) => ({ in: `src/pages/${e}.ts`, out: e })), { in: "src/styles/site.css", out: "site" }],
    outdir: "dist/assets",
    bundle: true,
    splitting: true,
    format: "esm",
    target: ["es2022"],
    minify: !serve,
    sourcemap: serve ? "inline" : false,
    entryNames: "[name]-[hash]",
    chunkNames: "c-[hash]",
    assetNames: "[name]-[hash]",
    external: ["../art/*", "./fonts/*"],
    metafile: true,
    logLevel: "warning",
  });
  const assets = { js: {}, css: "", preload: {} };
  for (const [file, meta] of Object.entries(result.metafile.outputs)) {
    const rel = path.relative("dist", file);
    if (!meta.entryPoint) continue;
    if (meta.entryPoint.endsWith(".css")) assets.css = rel;
    else {
      const name = path.basename(meta.entryPoint, ".ts");
      assets.js[name] = rel;
      assets.preload[name] = meta.imports.filter((i) => i.kind === "import-statement").map((i) => path.relative("dist", i.path));
    }
  }
  return assets;
}

async function buildAll() {
  const started = Date.now();
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(path.join(root, "public"), dist, { recursive: true });
  await copyFonts();
  await deriveData(root, dist);
  runSnapshot();
  const assets = await bundle();
  const aboutHtml = await readFile(path.join(root, "src/about.html"), "utf8");
  const stamp = new Date().toISOString();
  for (const page of PAGES) await writeFile(path.join(dist, page.file), shell(page, assets, aboutHtml, stamp));
  const urls = PAGES.filter((p) => !["404.html", "game.html", "team.html"].includes(p.file))
    .map((p) => `  <url><loc>${SITE.url}${p.file === "index.html" ? "" : p.file}</loc></url>`)
    .join("\n");
  await writeFile(path.join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  await writeFile(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE.url}sitemap.xml\n`);
  await writeFile(path.join(dist, ".nojekyll"), "");
  console.log(`built dist/ in ${Date.now() - started}ms`);
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain" };

export function startServer(port = 4173) {
  const server = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(dist, p);
    if (!file.startsWith(dist) || !existsSync(file) || !(await stat(file)).isFile()) {
      res.writeHead(404, { "content-type": MIME[".html"] });
      res.end(await readFile(path.join(dist, "404.html")));
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(await readFile(file));
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildAll();
  if (serve) {
    await startServer(Number(process.env.PORT ?? 4173));
    console.log("serving http://localhost:" + (process.env.PORT ?? 4173));
    let timer;
    for (const dir of ["src", "public", "scripts"]) {
      watch(path.join(root, dir), { recursive: true }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => buildAll().catch((e) => console.error(e.message)), 150);
      });
    }
  }
}
