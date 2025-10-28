export function basePath(): string {
  const segs = location.pathname.split('/').filter(Boolean);
  if (segs.length && segs[segs.length - 1].endsWith('.html')) segs.pop();
  // If hosted as user/organization site (root), segs[0] would be the page name or empty → return '/'
  // If hosted as project pages (/repo/...), return '/repo/'
  return segs.length ? `/${segs[0]}/` : '/';
}
