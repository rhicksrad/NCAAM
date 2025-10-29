import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { scoreboard, rankings } from '../lib/sdk/ncaam';
import type { Game, Team } from '../lib/sdk/types';
import { resolveTeamLogo } from '../lib/logos';
import { el, mount, section, spinner } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { gamesList, pollBlock, teamLogo } from '../lib/ui/components';
import { POWER_POLL_ENTRIES, POWER_POLL_CONTEXT, type PowerPollEntry } from './home-power-poll';
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

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'team';
}

function computeAbbreviation(label: string): string {
  const compact = label.replace(/[^A-Za-z0-9]/g, '');
  if (compact.length >= 2 && compact.length <= 4) return compact.toUpperCase();
  const tokens = label.match(/[A-Za-z0-9]+/g) ?? [];
  const initials = tokens.map(token => token[0] ?? '').join('');
  const base = initials.length >= 2 ? initials.slice(0, 4) : compact.slice(0, 4);
  return (base || label.slice(0, 4)).toUpperCase();
}

function powerPollTeam(entry: PowerPollEntry): Team {
  const displayName = entry.team;
  const slug = entry.slug ?? slugify(entry.logoHint ?? displayName);
  const abbreviation = entry.abbreviation ?? computeAbbreviation(displayName);
  const logoSource = entry.logoHint ?? displayName;
  const logo = resolveTeamLogo({ displayName: logoSource, shortName: displayName, abbreviation }) ?? undefined;
  return {
    id: slug,
    name: logoSource,
    displayName,
    shortName: displayName,
    abbreviation,
    logo,
  };
}

function detailItem(label: string, value: string): HTMLElement {
  return el('li', { class: 'power-poll__detail' },
    el('span', { class: 'power-poll__detail-label' }, label),
    el('span', { class: 'power-poll__detail-text' }, value)
  );
}

function powerPollSection(): HTMLElement {
  const list = el('ol', { class: 'power-poll__list' });
  POWER_POLL_ENTRIES.forEach(entry => {
    const team = powerPollTeam(entry);
    const li = el('li', { class: 'power-poll__item' });
    li.appendChild(el('span', { class: 'power-poll__rank' }, String(entry.rank)));
    const body = el('div', { class: 'power-poll__body' });
    const identity = el('div', { class: 'power-poll__identity' });
    const logo = teamLogo(team, 'small');
    if (logo) identity.appendChild(logo);
    identity.appendChild(el('span', { class: 'power-poll__name' }, entry.team));
    body.appendChild(identity);
    body.appendChild(el('ul', { class: 'power-poll__details' },
      detailItem('Identity', entry.identity),
      detailItem('Path to 1-seed', entry.path),
      detailItem('Watch metric', entry.watch)
    ));
    li.appendChild(body);
    list.appendChild(li);
  });

  const contextList = el('ul', { class: 'power-poll__context-list' });
  POWER_POLL_CONTEXT.forEach(note => {
    contextList.appendChild(el('li', { class: 'power-poll__context-note' }, note));
  });
  const context = el('aside', { class: 'power-poll__context' },
    el('h3', { class: 'power-poll__context-title' }, 'Context & Consensus'),
    contextList
  );

  const layout = el('div', { class: 'power-poll__layout' }, list, context);
  const container = section('Top 25 Power Poll', layout);
  container.classList.add('section--power-poll');
  return container;
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

  const powerSection = powerPollSection();
  const rankingsSection = section('Top 25', spinner());
  const gamesSection = section('Today’s Games', spinner());

  const shell = el('div', { class: 'container' },
    el('h1', { class: 'title' }, BRAND.siteTitle),
    nav(),
    powerSection,
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
