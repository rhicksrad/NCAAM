import { el } from './dom';

export function skeletonRows(count: number, options: { columns?: number } = {}): HTMLElement {
  const { columns = 4 } = options;
  const wrapper = el('div', { class: 'rows' });
  for (let i = 0; i < count; i += 1) {
    const row = el('div', { class: 'skeleton-row' });
    for (let col = 0; col < columns; col += 1) {
      row.appendChild(el('span', { class: 'skeleton' }));
    }
    wrapper.appendChild(row);
  }
  return wrapper;
}

export function errorCard(message: string): HTMLElement {
  return el('div', { class: 'error-card' }, message);
}

export function emptyState(message: string): HTMLElement {
  return el('p', { class: 'empty-state' }, message);
}
