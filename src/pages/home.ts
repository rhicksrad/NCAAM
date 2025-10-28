import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { scoreboard, rankings } from '../lib/sdk/ncaam';
import type { Game } from '../lib/sdk/types';
import { el, mount, section, spinner } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { gamesList, pollBlock } from '../lib/ui/components';
import '../../public/styles/site.css';

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function skeletonRows(count: number): HTMLElement {
  const wrapper = el('div', { class: 'rows' });
  for (let i = 0; i < count; i += 1) {
    wrapper.appendChild(el('div', { class: 'skeleton-row' },
      el('span', { class: 'skeleton' }),
      el('span', { class: 'skeleton' }),
      el('span', { class: 'skeleton' }),
      el('span', { class: 'skeleton' })
    ));
  }
  return wrapper;
}

function errorCard(message: string): HTMLElement {
  return el('div', { class: 'error-card' }, message);
}

async function loadRankings(container: HTMLElement) {
  try {
    const polls = await rankings(DEFAULT_SEASON);
    if (!polls.length) {
      container.replaceChildren(
        el('h2', { class: 'section-title' }, 'Top 25'),
        el('p', { class: 'empty-state' }, 'No rankings available yet.')
      );
      return;
    }
    const poll = polls[0];
    const top25 = poll.entries.filter(entry => entry.rank <= 25);
    const block = pollBlock({ ...poll, entries: top25 });
    container.replaceChildren(...Array.from(block.childNodes));
  } catch (err) {
    container.replaceChildren(
      el('h2', { class: 'section-title' }, 'Top 25'),
      errorCard(`Rankings failed: ${err instanceof Error ? err.message : String(err)}`)
    );
  }
}

function summarizeGames(games: Game[]): HTMLElement {
  if (!games.length) return el('p', { class: 'empty-state' }, 'No games scheduled today.');
  return gamesList(games);
}

async function loadScoreboard(container: HTMLElement) {
  try {
    const games = await scoreboard(todayISO());
    container.replaceChildren(
      el('h2', { class: 'section-title' }, 'Today’s Games'),
      summarizeGames(games)
    );
  } catch (err) {
    container.replaceChildren(
      el('h2', { class: 'section-title' }, 'Today’s Games'),
      errorCard(`Scoreboard failed: ${err instanceof Error ? err.message : String(err)}`)
    );
  }
}

async function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const rankingsSection = section('Top 25', spinner());
  const gamesSection = section('Today’s Games', spinner());

  const shell = el('div', { class: 'container' },
    el('h1', { class: 'title' }, BRAND.siteTitle),
    nav(),
    rankingsSection,
    gamesSection,
    footer()
  );

  mount(root, shell);

  rankingsSection.replaceChildren(el('h2', { class: 'section-title' }, 'Top 25'), skeletonRows(4));
  gamesSection.replaceChildren(el('h2', { class: 'section-title' }, 'Today’s Games'), skeletonRows(5));

  await Promise.all([
    loadRankings(rankingsSection),
    loadScoreboard(gamesSection)
  ]);
}

void render();
