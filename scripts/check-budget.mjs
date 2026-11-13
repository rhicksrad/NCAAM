// Performance budget. The site's job is to be fast; this fails the build when
// a page's JavaScript, the stylesheet, fonts or art outgrow their allowance.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const gz = (file) => gzipSync(readFileSync(file)).length;
const files = (dir, test) => (function walk(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : test(e.name) ? [path.join(d, e.name)] : []));
})(path.join(dist, dir));

const failures = [];
const lines = [];
function check(label, actual, limit) {
  lines.push(`${actual > limit ? "FAIL" : " ok "}  ${label.padEnd(34)} ${kb(actual).padStart(10)}  (limit ${kb(limit)})`);
  if (actual > limit) failures.push(label);
}

// Every page: its HTML plus everything it loads up front, gzipped.
const css = files("assets", (n) => n.endsWith(".css"));
const cssSize = css.reduce((n, f) => n + gz(f), 0);
check("stylesheet (gzip)", cssSize, 10 * 1024);
for (const page of readdirSync(dist).filter((n) => n.endsWith(".html"))) {
  const markup = readFileSync(path.join(dist, page), "utf8");
  const scripts = [...markup.matchAll(/(?:src|href)="\.\/(assets\/[^"]+\.js)"/g)].map((m) => path.join(dist, m[1]));
  const js = scripts.reduce((n, f) => n + gz(f), 0);
  check(`${page} script (gzip)`, js, 14 * 1024);
  check(`${page} html`, Buffer.byteLength(markup), 9 * 1024);
}
check("fonts", files("assets/fonts", () => true).reduce((n, f) => n + statSync(f).size, 0), 80 * 1024);
const art = files("art", () => true);
check("all art", art.reduce((n, f) => n + statSync(f).size, 0), 1100 * 1024);
for (const f of art) check(`art/${path.basename(f)}`, statSync(f).size, 260 * 1024);
check("players table (gzip)", gz(path.join(dist, "data/players.json")), 180 * 1024);
// This season's sheet: the seed in CI, the full crawl on a deploy.
check("this season's players (gzip)", gz(path.join(dist, "data/live/averages.json")), 180 * 1024);

// The manifest must not point at files that are not there.
for (const icon of JSON.parse(readFileSync(path.join(dist, "manifest.webmanifest"), "utf8")).icons) {
  let size = Infinity;
  try {
    size = statSync(path.join(dist, icon.src)).size;
  } catch {
    /* missing: stays over the limit */
  }
  check(`manifest ${icon.src}`, size, 260 * 1024);
}

console.log(lines.join("\n"));
if (failures.length) {
  console.error(`\nOver budget: ${failures.join(", ")}`);
  process.exit(1);
}
