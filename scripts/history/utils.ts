import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const HISTORY_ROOT = path.join("public", "data", "history");

export function getHistoryRoot(): string {
  return HISTORY_ROOT;
}

export async function ensureHistoryDir(subpath = "."): Promise<string> {
  const target = path.join(HISTORY_ROOT, subpath);
  await fs.mkdir(target, { recursive: true });
  return target;
}

export function normalizeNameKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\p{M}]+/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function withTrailingNewline(payload: string): string {
  return payload.endsWith("\n") ? payload : `${payload}\n`;
}

async function writeSha256(filePath: string, contents: string | Buffer): Promise<void> {
  const hash = crypto.createHash("sha256").update(contents).digest("hex");
  const shaPath = `${filePath}.sha256`;
  await fs.writeFile(shaPath, withTrailingNewline(hash), "utf8");
}

export async function writeJsonFile(
  filePath: string,
  data: unknown,
  { pretty = false }: { pretty?: boolean } = {},
): Promise<void> {
  const json = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  const normalized = withTrailingNewline(json);
  await fs.writeFile(filePath, normalized, "utf8");
  await writeSha256(filePath, normalized);
}

export async function writeMinifiedJsonFile(filePath: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data);
  const normalized = withTrailingNewline(json);
  await fs.writeFile(filePath, normalized, "utf8");
  await writeSha256(filePath, normalized);
}

