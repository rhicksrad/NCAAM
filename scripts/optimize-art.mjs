// Turn the full-size Codex PNGs into the small WebP files the site ships.
//   node scripts/optimize-art.mjs <folder of original PNGs>
// The originals are 0.4-4.7 MB each and are not kept in the repo.
import sharp from "sharp";
import { mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.resolve(process.argv[2] ?? ".cache/art-src");
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/art");
mkdirSync(out, { recursive: true });
const from = (name) => sharp(path.join(src, `${name}.png`));

const jobs = [
  // Tiling floors. Mirrored into a 2x2 block so the edges always meet.
  ["floor-maple.webp", async () => mirrorTile("floor-maple", 360, 62)],
  ["floor-dark.webp", async () => mirrorTile("floor-dark", 360, 50)],
  ["hero-court.webp", () => from("hero-court").resize(1600).webp({ quality: 66 }).toBuffer()],
  ["scoreboard.webp", () => from("scoreboard").resize(1400).webp({ quality: 60 }).toBuffer()],
  ["chalkboard.webp", () => from("chalkboard").resize(1400).webp({ quality: 55 }).toBuffer()],
  ["net.webp", () => from("net").resize(720).webp({ quality: 68 }).toBuffer()],
  ["ball-mark.webp", () => from("ball-mark").trim().resize(160).webp({ quality: 80, alphaQuality: 90 }).toBuffer()],
  ["favicon.png", () => from("ball-mark").trim().resize(96).png({ compressionLevel: 9, palette: true }).toBuffer()],
  ["apple-touch-icon.png", async () =>
    sharp({ create: { width: 180, height: 180, channels: 4, background: "#14213a" } })
      .composite([{ input: await from("ball-mark").trim().resize(132).toBuffer(), gravity: "centre" }])
      .png({ compressionLevel: 9 })
      .toBuffer()],
  // Social card: the court with the navy scrim the hero uses.
  ["og.jpg", async () =>
    from("hero-court").resize(1200, 630, { fit: "cover", position: "right" }).jpeg({ quality: 78, mozjpeg: true }).toBuffer()],
  ...readdirSync(src)
    .filter((f) => f.startsWith("icon-"))
    .map((f) => [f.replace(".png", ".webp"), () => sharp(path.join(src, f)).trim().resize(320, 320, { fit: "inside" }).webp({ quality: 60, alphaQuality: 70 }).toBuffer()]),
];

async function mirrorTile(name, size, quality) {
  const tile = await from(name).resize(size, size).toBuffer();
  const flopped = await sharp(tile).flop().toBuffer();
  const top = await sharp({ create: { width: size * 2, height: size, channels: 3, background: "#000" } })
    .composite([{ input: tile, left: 0, top: 0 }, { input: flopped, left: size, top: 0 }])
    .png()
    .toBuffer();
  const bottom = await sharp(top).flip().toBuffer();
  return sharp({ create: { width: size * 2, height: size * 2, channels: 3, background: "#000" } })
    .composite([{ input: top, left: 0, top: 0 }, { input: bottom, left: 0, top: size }])
    .webp({ quality })
    .toBuffer();
}

let total = 0;
for (const [name, make] of jobs) {
  const file = path.join(out, name);
  await sharp(await make()).toFile(file);
  const bytes = statSync(file).size;
  total += bytes;
  console.log(`${name.padEnd(24)} ${(bytes / 1024).toFixed(1).padStart(7)} kB`);
}
console.log(`${"total".padEnd(24)} ${(total / 1024).toFixed(1).padStart(7)} kB`);
