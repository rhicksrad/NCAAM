import { basePath } from './base';

export function nav() {
  const base = basePath();
  const navEl = el('nav', { class: 'nav' });
  const routes = [
    { href: `${base}`, label: 'Home' },
    { href: `${base}teams.html`, label: 'Teams' },
    { href: `${base}players.html`, label: 'Players' },
    { href: `${base}games.html`, label: 'Games' },
    { href: `${base}rankings.html`, label: 'Rankings' },
    { href: `${base}standings.html`, label: 'Standings' },
    { href: `${base}diag.html`, label: 'Diagnostics' }
  ];

  const current = normalizePath(location.pathname);

  routes.forEach(({ href, label }) => {
    const link = el('a', { href, class: 'nav-link' }, label);
    const resolved = new URL(href, location.origin).pathname;
    if (normalizePath(resolved) === current) link.classList.add('is-active');
    navEl.appendChild(link);
  });

  return navEl;

  function normalizePath(path: string) {
    let normalized = path;
    if (normalized.endsWith('index.html')) normalized = normalized.slice(0, -'index.html'.length);
    if (normalized !== '/' && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    if (!normalized) normalized = '/';
    return normalized;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
  for (const c of children) if (c != null) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

export function footer() {
  const year = new Date().getFullYear();
  return el('footer', { class: 'footer' }, `© ${year} NCAA Men’s Basketball Hub`);
}
