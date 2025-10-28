export function nav() {
  return el('nav', { class: 'nav' },
    a('/', 'Home'), sep(),
    a('/teams.html', 'Teams'), sep(),
    a('/players.html', 'Players'), sep(),
    a('/games.html', 'Games'), sep(),
    a('/rankings.html', 'Rankings'), sep(),
    a('/standings.html', 'Standings')
  );

  function a(href: string, label: string) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    return link;
  }
  function sep() { return document.createTextNode(' · '); }
}

// Minimal DOM helper so this file is standalone if imported early
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
  return el('footer', { class: 'footer' },
    `© ${year} NCAA Men’s Basketball Hub`
  );
}
