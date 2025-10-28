// scripts/build-players.js
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { build } from "esbuild";

const SRC = path.join("assets", "js", "players.ts");
const RUMBLE_SRC = path.join("src", "players", "rumble", "index.ts");
const OUTDIR = path.join("public", "assets", "js");
const HTML = path.join("public", "players.html");
const RUMBLE_META_RE = /<meta\s+name=["']rumble-module["'][^>]*>/i;

async function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
}

async function ensureDir(d) {
  await fs.mkdir(d, { recursive: true });
}

async function bundle(entry, name) {
  await ensureDir(OUTDIR);
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    target: "es2019",
    minify: true,
    write: false,
  });
  const code = result.outputFiles[0].contents;
  const hash = await sha256(code);
  const file = `${name}.${hash}.js`;
  await fs.writeFile(path.join(OUTDIR, file), code);
  return file;
}

async function patchHtml(mainFile, rumbleFile) {
  let html = await fs.readFile(HTML, "utf8");
  const tagRe = /<script\s+[^>]*id=["']players-bundle["'][^>]*><\/script>/i;
  const newTag = `<script id="players-bundle" type="module" src="assets/js/${mainFile}"></script>`;
  const rumbleTag = `<meta name="rumble-module" content="assets/js/${rumbleFile}" />`;

  if (tagRe.test(html)) {
    html = html.replace(tagRe, newTag);
  } else {
    // fallback: inject before </body>
    const bodyClose = /<\/body>\s*<\/html>\s*$/i;
    if (!bodyClose.test(html)) {
      throw new Error("Unable to find </body> in public/players.html for injection");
    }
    // remove any old BUILD:PLAYERS block if it exists
    html = html.replace(/<!--\s*BUILD:PLAYERS\s*-->[\s\S]*?<!--\s*\/BUILD:PLAYERS\s*-->/i, "");
    html = html.replace(
      bodyClose,
      `\n<!-- BUILD:PLAYERS -->\n${newTag}\n<!-- /BUILD:PLAYERS -->\n</body>\n</html>`
    );
  }

  if (RUMBLE_META_RE.test(html)) {
    html = html.replace(RUMBLE_META_RE, rumbleTag);
  } else {
    const headClose = /<\/head>/i;
    if (!headClose.test(html)) {
      throw new Error("Unable to locate </head> in public/players.html");
    }
    html = html.replace(headClose, `  ${rumbleTag}\n</head>`);
  }
  await fs.writeFile(HTML, html);
}

async function main() {
  const mainBundle = await bundle(SRC, "players");
  const rumbleBundle = await bundle(RUMBLE_SRC, "players-rumble");
  await patchHtml(mainBundle, rumbleBundle);
  console.log(
    `Built roster client → ${mainBundle} and rumble module → ${rumbleBundle} wired into players.html`
  );
}

main().catch((e) => {
  console.error(`Failed to build roster client: ${e.message}`);
  process.exit(1);
});
