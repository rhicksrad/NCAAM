export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Partial<Record<string, string>> = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node: Element) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(rootSel: string | Element, child: Element) {
  const root = typeof rootSel === 'string' ? document.querySelector(rootSel)! : rootSel;
  clear(root);
  root.appendChild(child);
  return root;
}

export function section(title: string, content: Element) {
  return el('section', { class: 'section' },
    el('h2', { class: 'section-title' }, title),
    content
  );
}

export function spinner(text = 'Loading...') {
  return el('div', { class: 'spinner' }, text);
}

export function list(items: string[]) {
  const ul = el('ul');
  for (const it of items) ul.appendChild(el('li', {}, it));
  return ul;
}

export function table(headers: string[], rows: (string | number | null | undefined)[][]) {
  const tbl = el('table', { class: 'data' });
  const thead = el('thead');
  const trh = el('tr');
  headers.forEach(h => trh.appendChild(el('th', {}, String(h))));
  thead.appendChild(trh);
  const tbody = el('tbody');
  rows.forEach(r => {
    const tr = el('tr');
    r.forEach(c => tr.appendChild(el('td', {}, c == null ? '' : String(c))));
    tbody.appendChild(tr);
  });
  tbl.appendChild(thead);
  tbl.appendChild(tbody);
  return tbl;
}
