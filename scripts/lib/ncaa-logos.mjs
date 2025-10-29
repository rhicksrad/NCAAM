import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Open } from 'unzipper';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ARCHIVE_PATH = path.join(ROOT, 'public/FBS-Logo-Library-main.zip');
export const LOGOS_DIR = path.join(ROOT, 'public/assets/logos/ncaa');
const MARKER_PATH = path.join(LOGOS_DIR, '.source.json');
const ZIP_PREFIX = 'FBS-Logo-Library-main/CFB Logos/';

async function hasExistingLogos() {
  try {
    const entries = await fs.readdir(LOGOS_DIR);
    return entries.some(entry => entry.toLowerCase().endsWith('.png'));
  } catch {
    return false;
  }
}

async function clearExistingLogos() {
  try {
    const entries = await fs.readdir(LOGOS_DIR, { withFileTypes: true });
    await Promise.all(
      entries.map(async entry => {
        const target = path.join(LOGOS_DIR, entry.name);
        if (entry.isFile()) {
          if (entry.name.toLowerCase().endsWith('.png') || entry.name === '.source.json') {
            await fs.rm(target, { force: true });
          }
          return;
        }
        if (entry.isDirectory()) {
          await fs.rm(target, { recursive: true, force: true });
        }
      })
    );
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

export async function ensureNcaALogos() {
  const stat = await fs.stat(ARCHIVE_PATH).catch(error => {
    if (error && error.code === 'ENOENT') {
      throw new Error(`NCAA logo archive missing at ${ARCHIVE_PATH}`);
    }
    throw error;
  });

  await fs.mkdir(LOGOS_DIR, { recursive: true });

  const signature = JSON.stringify({ size: stat.size, mtimeMs: stat.mtimeMs });
  const existingSignature = await fs.readFile(MARKER_PATH, 'utf8').catch(() => null);
  if (existingSignature && existingSignature.trim() === signature) {
    if (await hasExistingLogos()) {
      return;
    }
  }

  await clearExistingLogos();

  const directory = await Open.file(ARCHIVE_PATH);
  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;
    if (!entry.path.startsWith(ZIP_PREFIX)) continue;
    if (!entry.path.toLowerCase().endsWith('.png')) continue;

    const filename = entry.path.slice(ZIP_PREFIX.length);
    const destination = path.join(LOGOS_DIR, filename);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await pipeline(entry.stream(), createWriteStream(destination));
  }

  await fs.writeFile(MARKER_PATH, `${signature}\n`, 'utf8');
}
