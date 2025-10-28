import { basePath } from './base';

export function nav() {
  const base = basePath();
  return el('nav', { class: 'nav' },
    a(`${base}`, 'Home'), sep(),
    a(`${base}teams.html`, 'Teams'), sep(),
    a(`${base}players.html`, 'Players'), sep(),
    a(`${base}games.html`, 'Games'), sep(),
    a(`${base}rankings.html`, 'Rankings'), sep(),
    a(`${base}standings.html`, 'Standings'), sep(),
    a(`${base}diag.html`, 'Diagnostics')
  );

  function a(href: string, label: string) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    return link;
  }
  function sep() { return document.createTextNode(' · '); }
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
