import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const entry = path.join(here, "../src/pages/players.ts");
const outfile = path.join(here, "../public/scripts/pages/players.js");

await build({
  entryPoints: [entry],
  bundle: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  outfile,
  sourcemap: false,
  minify: true,
});

console.log(`Bundled players page → ${path.relative(path.join(here, ".."), outfile)}`);
