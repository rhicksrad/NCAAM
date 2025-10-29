import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { standings } from '../lib/sdk/ncaam';
import { el, mount } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { standingsGroups } from '../lib/ui/components';
import { emptyState, errorCard, skeletonRows } from '../lib/ui/feedback';
import '../../public/styles/site.css';

function seasonsList(current: number, count = 5): number[] {
  const seasons: number[] = [];
  for (let i = 0; i < count; i += 1) seasons.push(current - i);
  return seasons;
}

async function render() {
  const root = document.getElementById('app');
  if (!root) return;

  let season = DEFAULT_SEASON;
  const select = el('select');
  seasonsList(DEFAULT_SEASON).forEach(value => {
    const option = el('option', { value: String(value) }, String(value));
    if (value === season) option.selected = true;
    select.appendChild(option);
  });

  const content = skeletonRows(1);

  const shell = el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Standings`),
    nav(),
    el('div', { class: 'controls' }, el('label', {}, 'Season:'), select),
    content,
    footer()
  );
  mount(root, shell);

  async function load() {
    content.replaceChildren(skeletonRows(1));
    try {
      const data = await standings(season);
      const filtered = data.filter(group => group.rows.length);
      if (!filtered.length) {
        content.replaceChildren(emptyState('No standings available for this season.'));
        return;
      }
      content.replaceChildren(standingsGroups(filtered));
    } catch (err) {
      content.replaceChildren(errorCard(`Unable to load standings: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  select.addEventListener('change', () => {
    season = Number((select as HTMLSelectElement).value);
    void load();
  });

  await load();
}

void render();
