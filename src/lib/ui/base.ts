type ImportMetaWithEnv = ImportMeta & { env?: { BASE_URL?: string } };

export function basePath(): string {
  const baseFromEnv = typeof import.meta !== 'undefined'
    ? (import.meta as ImportMetaWithEnv).env?.BASE_URL
    : undefined;

  if (baseFromEnv && baseFromEnv !== './') {
    return ensureTrailingSlash(baseFromEnv);
  }

  const segs = location.pathname.split('/').filter(Boolean);
  if (segs.length && segs[segs.length - 1].endsWith('.html')) segs.pop();
  // If hosted as user/organization site (root), segs[0] would be the page name or empty → return '/'
  // If hosted as project pages (/repo/...), return '/repo/'
  return segs.length ? `/${segs[0]}/` : '/';

  function ensureTrailingSlash(path: string): string {
    return path.endsWith('/') ? path : `${path}/`;
  }
}
