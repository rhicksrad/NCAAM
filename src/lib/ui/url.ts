export function qp(name: string): string | null {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}
