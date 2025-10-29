import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { rankings } from '../lib/sdk/ncaam';
import type { Poll } from '../lib/sdk/types';
import { el, mount } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { pollBlock } from '../lib/ui/components';
import { emptyState, errorCard, skeletonRows } from '../lib/ui/feedback';
import '../../public/styles/site.css';

function renderPolls(container: HTMLElement, polls: Poll[]) {
  if (!polls.length) {
    container.replaceChildren(emptyState('No rankings available for this season yet.'));
    return;
  }
  container.replaceChildren(...polls.map(poll => pollBlock(poll)));
}

async function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const content = skeletonRows(3);
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
