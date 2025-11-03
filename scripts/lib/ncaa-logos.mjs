import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const LOGOS_DIR = path.join(ROOT, 'public/data/logos');
const METADATA_FILENAME = 'metadata.json';

function formatMissingMetadataMessage(metadataPath) {
  return [
    `NCAA logo metadata missing or unreadable at ${metadataPath}.`,
    'Populate public/data/logos with the curated assets and metadata JSON before running this command.'
  ].join(' ');
}

function normalizeAliasList(rawAliases, metadataPath, id) {
  if (rawAliases === undefined) {
    return [];
  }

  if (!Array.isArray(rawAliases)) {
    throw new Error(
      `${formatMissingMetadataMessage(metadataPath)} (expected "logos.${id}.aliases" to be an array).`
    );
  }

  const aliases = [];
  const seen = new Set();
  for (const alias of rawAliases) {
    if (typeof alias !== 'string') {
      throw new Error(
        `${formatMissingMetadataMessage(metadataPath)} (found non-string alias for "${id}").`
      );
    }
    const trimmed = alias.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    aliases.push(trimmed);
  }
  return aliases;
}

export async function verifyNcaALogos() {
  let stats;
  try {
    stats = await fs.stat(LOGOS_DIR);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(
        `NCAA logo directory missing at ${LOGOS_DIR}. Populate public/data/logos before continuing.`
      );
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    throw new Error(`Expected NCAA logo directory at ${LOGOS_DIR}, but found a non-directory file.`);
  }

  const entries = await fs.readdir(LOGOS_DIR);
  const pngs = entries.filter(entry => entry.toLowerCase().endsWith('.png'));
  if (pngs.length === 0) {
    throw new Error(
      `No logo PNG files were found in ${LOGOS_DIR}. Ensure public/data/logos has been synced before running this task.`
    );
  }

  const metadataPath = path.join(LOGOS_DIR, METADATA_FILENAME);
  let metadataRaw;
  try {
    metadataRaw = await fs.readFile(metadataPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(formatMissingMetadataMessage(metadataPath));
    }
    throw new Error(`${formatMissingMetadataMessage(metadataPath)} (${error.message ?? error})`);
  }

  let metadata;
  try {
    metadata = JSON.parse(metadataRaw);
  } catch (error) {
    throw new Error(`${formatMissingMetadataMessage(metadataPath)} (invalid JSON: ${error.message})`);
  }

  if (!metadata || typeof metadata !== 'object') {
    throw new Error(`${formatMissingMetadataMessage(metadataPath)} (expected a JSON object).`);
  }

  for (const field of ['source', 'updated']) {
    if (typeof metadata[field] !== 'string' || metadata[field].trim() === '') {
      throw new Error(
        `${formatMissingMetadataMessage(metadataPath)} (missing required "${field}" string field).`
      );
    }
  }

  if (!metadata.logos || typeof metadata.logos !== 'object') {
    throw new Error(
      `${formatMissingMetadataMessage(metadataPath)} (missing required "logos" mapping).`
    );
  }

  const normalizedLogos = new Map();
  for (const [id, rawValue] of Object.entries(metadata.logos)) {
    if (typeof id !== 'string' || !/^\d+$/.test(id)) {
      throw new Error(
        `${formatMissingMetadataMessage(metadataPath)} (invalid logo identifier "${id}").`
      );
    }

    if (!rawValue || typeof rawValue !== 'object') {
      throw new Error(
        `${formatMissingMetadataMessage(metadataPath)} (expected "logos.${id}" to be an object).`
      );
    }

    const name = typeof rawValue.name === 'string' ? rawValue.name.trim() : '';
    if (!name) {
      throw new Error(
        `${formatMissingMetadataMessage(metadataPath)} (missing name for "${id}").`
      );
    }

    const aliases = normalizeAliasList(rawValue.aliases, metadataPath, id);
    normalizedLogos.set(id, { name, aliases });
  }

  if (normalizedLogos.size === 0) {
    throw new Error(
      `${formatMissingMetadataMessage(metadataPath)} (found zero logo entries after validation).`
    );
  }

  return {
    metadata,
    logos: normalizedLogos,
  };
}
