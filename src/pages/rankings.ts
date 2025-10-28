import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { rankings } from '../lib/sdk/ncaam';
import type { Poll } from '../lib/sdk/types';
import { el, mount } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { pollBlock } from '../lib/ui/components';
import '../../public/styles/site.css';

function skeleton(count: number): HTMLElement {
  const wrap = el('div', { class: 'rows' });
  for (let i = 0; i < count; i += 1) {
    wrap.appendChild(el('div', { class: 'skeleton-row' },
      el('span', { class: 'skeleton' }),
      el('span', { class: 'skeleton' }),
      el('span', { class: 'skeleton' }),
      el('span', { class: 'skeleton' })
    ));
  }
  return wrap;
}

function errorCard(message: string): HTMLElement {
  return el('div', { class: 'error-card' }, message);
}

function renderPolls(container: HTMLElement, polls: Poll[]) {
  if (!polls.length) {
    container.replaceChildren(el('p', { class: 'empty-state' }, 'No rankings available for this season yet.'));
    return;
  }
  container.replaceChildren(...polls.map(poll => pollBlock(poll)));
}

async function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const content = el('div', { class: 'rows' }, skeleton(3));
  const shell = el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Rankings`),
    nav(),
    content,
    footer()
  );
  mount(root, shell);

  try {
    const polls = await rankings(DEFAULT_SEASON);
    renderPolls(content, polls);
  } catch (err) {
    content.replaceChildren(errorCard(`Unable to load rankings: ${err instanceof Error ? err.message : String(err)}`));
  }
}

void render();
