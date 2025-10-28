import { readFileSync } from "fs";
import { existsSync } from "fs";
import path from "path";

const CACHE = new Map<string, string | null>();

const DEFAULT_SECRET_DIRS = [
  () => process.env.SECRETS_DIR,
  () => process.env.SECRET_DIR,
  () => path.join(process.cwd(), "secrets"),
];

const DEFAULT_EXTENSIONS = ["", ".txt", ".key"];

interface SecretOptions {
  aliases?: string[];
  directories?: string[];
}

function resolveSecretPaths(name: string, options?: SecretOptions): string[] {
  const dirs = [
    ...(options?.directories ?? []),
    ...DEFAULT_SECRET_DIRS.map((factory) => factory()).filter((value): value is string => Boolean(value)),
  ];
  const baseNames = [name, ...(options?.aliases ?? [])];
  const paths: string[] = [];

  for (const dir of dirs) {
    for (const base of baseNames) {
      for (const ext of DEFAULT_EXTENSIONS) {
        const filePath = path.join(dir, `${base}${ext}`);
        paths.push(filePath);
      }
    }
  }

  return paths;
}

export function loadSecret(name: string, options?: SecretOptions): string | undefined {
  if (CACHE.has(name)) {
    const cached = CACHE.get(name);
    return cached ?? undefined;
  }

  const paths = resolveSecretPaths(name, options);
  for (const candidate of paths) {
    try {
      if (!existsSync(candidate)) {
        continue;
      }
      const contents = readFileSync(candidate, "utf8").trim();
      if (contents.length) {
        CACHE.set(name, contents);
        return contents;
      }
    } catch (error) {
      console.warn(`Failed to read secret ${name} from ${candidate}: ${String(error)}`);
    }
  }

  CACHE.set(name, null);
  return undefined;
}
