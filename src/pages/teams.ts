import { BRAND } from '../lib/config/ncaam';
import { teams as fetchTeams } from '../lib/sdk/ncaam';
import type { Team } from '../lib/sdk/types';
import { el, mount, section } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { teamLink } from '../lib/ui/components';
import '../../public/styles/site.css';

function skeletonList(): HTMLElement {
  const wrap = el('ul', { class: 'team-list' });
  for (let i = 0; i < 12; i += 1) {
    const li = el('li', { class: 'team-card' });
    li.appendChild(el('span', { class: 'skeleton', style: 'height:1.2rem;display:block;' }));
    wrap.appendChild(li);
  }
  return wrap;
}

function errorCard(message: string): HTMLElement {
  return el('div', { class: 'error-card' }, message);
}

function renderTeams(container: HTMLElement, list: Team[]): void {
  if (!list.length) {
    container.replaceChildren(el('p', { class: 'empty-state' }, 'No teams match your search.'));
    return;
  }
  const ul = el('ul', { class: 'team-list' });
  list.forEach(team => {
    const li = el('li', { class: 'team-card', id: team.id });
    if (team.logo) {
      const img = document.createElement('img');
      img.src = team.logo;
      img.alt = `${team.displayName} logo`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 32;
      img.height = 32;
      img.className = 'team-logo';
      li.appendChild(img);
    }
    li.appendChild(teamLink(team.id, team.displayName));
    if (team.conference) {
      li.appendChild(el('span', { class: 'team-conf' }, team.conference));
    }
    ul.appendChild(li);
  });
  container.replaceChildren(ul);
}

async function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const search = el('input', { type: 'text', placeholder: 'Search Division I teams…' });
  const listContainer = el('div', {}, skeletonList());
  const sectionEl = section('Teams', listContainer as HTMLElement);

  const shell = el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Teams`),
    nav(),
    el('div', { class: 'controls' }, search),
    sectionEl,
    footer()
  );
  mount(root, shell);

  try {
    const allTeams = await fetchTeams();
    const divisionOne = allTeams.filter(team => team.conferenceId != null);
    divisionOne.sort((a, b) => a.displayName.localeCompare(b.displayName));

    function applyFilter() {
      const term = (search as HTMLInputElement).value.trim().toLowerCase();
      if (!term) {
        renderTeams(listContainer as HTMLElement, divisionOne);
        return;
      }
      const filtered = divisionOne.filter(team => {
        const values = [team.displayName, team.shortName, team.abbreviation].filter(Boolean) as string[];
        return values.some(value => value.toLowerCase().includes(term));
      });
      renderTeams(listContainer as HTMLElement, filtered);
    }

    search.addEventListener('input', applyFilter);
    renderTeams(listContainer as HTMLElement, divisionOne);
  } catch (err) {
    listContainer.replaceChildren(errorCard(`Unable to load teams: ${err instanceof Error ? err.message : String(err)}`));
  }
}

void render();
