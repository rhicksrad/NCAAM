import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const SOURCE = path.join(process.cwd(), "assets", "js", "main.tmp.js");
const DEST_DIR = path.join(process.cwd(), "public", "assets", "js");
const DEST_FILE = path.join(DEST_DIR, "main.js");

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await fileExists(SOURCE))) {
    console.warn(`No bundle found at ${SOURCE}; skipping finalize step.`);
    return;
  }

  const contents = await fs.readFile(SOURCE);
  const hash = createHash("sha256").update(contents).digest("hex");
  await fs.mkdir(DEST_DIR, { recursive: true });
  await fs.writeFile(DEST_FILE, contents);
  await fs.unlink(SOURCE);
  console.log(`Wrote ${DEST_FILE} (sha256 ${hash.slice(0, 8)}…).`);
}

main().catch((error) => {
  console.error("Failed to finalize bundle:", error);
  process.exit(1);
});
