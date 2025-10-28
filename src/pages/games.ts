import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { scoreboard, rankings } from '../lib/sdk/ncaam';
import type { Game } from '../lib/sdk/types';
import { el, mount, section } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { gamesList } from '../lib/ui/components';
import '../../public/styles/site.css';

interface PageState {
  date: string;
  filter: string;
  top25Only: boolean;
}

const STORAGE_KEY = 'ncaam-games-last-filter';

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(date);
}

function parseState(): PageState {
  const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const params = new URLSearchParams(hash);
  const stored = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  })();
  const date = params.get('date') || stored.date || todayISO();
  const filter = params.get('q') ?? stored.filter ?? '';
  const top25Only = params.get('top25') === '1' || stored.top25Only === true;
  return { date, filter, top25Only };
}

function persistState(state: PageState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

function pushState(state: PageState) {
  const params = new URLSearchParams();
  params.set('date', state.date);
  if (state.filter) params.set('q', state.filter);
  if (state.top25Only) params.set('top25', '1');
  const hash = `#${params.toString()}`;
  history.replaceState(null, '', `${location.pathname}${hash}`);
  persistState(state);
}

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

function filterGames(games: Game[], state: PageState, top25Ids: Set<string>): Game[] {
  let filtered = games;
  if (state.filter) {
    const term = state.filter.trim().toLowerCase();
    filtered = filtered.filter(game => {
      const values = [
        game.home.team.displayName,
        game.home.team.shortName,
        game.home.team.abbreviation,
        game.away.team.displayName,
        game.away.team.shortName,
        game.away.team.abbreviation,
      ].filter(Boolean) as string[];
      return values.some(value => value.toLowerCase().includes(term));
    });
  }
  if (state.top25Only) {
    filtered = filtered.filter(game => top25Ids.has(game.home.team.id) || top25Ids.has(game.away.team.id));
  }
  return filtered;
}

async function buildTop25Ids(): Promise<Set<string>> {
  try {
    const polls = await rankings(DEFAULT_SEASON);
    const poll = polls.find(p => p.poll === 'ap') ?? polls[0];
    const ids = new Set<string>();
    if (!poll) return ids;
    poll.entries
      .filter(entry => entry.rank <= 25)
      .forEach(entry => ids.add(entry.team.id));
    return ids;
  } catch {
    return new Set();
  }
}

let refreshHandle: number | null = null;

async function render() {
  const root = document.getElementById('app');
  if (!root) return;

  let state = parseState();
  const title = el('h1', { class: 'title' }, `${BRAND.siteTitle} — Games`);

  const dateLabel = el('div', { class: 'controls-date' }, formatDateLabel(state.date));
  const prevBtn = el('button', { type: 'button' }, 'Prev Day');
  const todayBtn = el('button', { type: 'button' }, 'Today');
  const nextBtn = el('button', { type: 'button' }, 'Next Day');
  const filterInput = el('input', { type: 'text', placeholder: 'Filter by team…', value: state.filter });
  const top25Toggle = el('label', {},
    el('input', { type: 'checkbox', ...(state.top25Only ? { checked: 'true' } : {}) }),
    ' Top 25 only'
  );

  const controls = el('div', { class: 'controls' },
    prevBtn,
    todayBtn,
    nextBtn,
    dateLabel,
    filterInput,
    top25Toggle
  );

  const listContainer = el('div', { class: 'rows' }, skeleton(6));
  const scheduleSection = section('Scoreboard', listContainer);

  const shell = el('div', { class: 'container' }, title, nav(), controls, scheduleSection, footer());
  mount(root, shell);

  const checkbox = top25Toggle.querySelector('input') as HTMLInputElement;
  const top25Ids = await buildTop25Ids();

  async function loadGames() {
    scheduleSection.replaceChildren(el('h2', { class: 'section-title' }, 'Scoreboard'), skeleton(6));
    try {
      const games = await scoreboard(state.date);
      const filtered = filterGames(games, state, top25Ids);
      if (filtered.length === 0) {
        scheduleSection.replaceChildren(
          el('h2', { class: 'section-title' }, 'Scoreboard'),
          el('p', { class: 'empty-state' }, 'No games match the current filters.')
        );
      } else {
        scheduleSection.replaceChildren(el('h2', { class: 'section-title' }, 'Scoreboard'), gamesList(filtered));
      }
      if (refreshHandle !== null) window.clearTimeout(refreshHandle);
      refreshHandle = null;
      if (games.some(game => game.stage === 'live')) {
        refreshHandle = window.setTimeout(() => {
          refreshHandle = null;
          void loadGames();
        }, 45000);
      }
    } catch (err) {
      scheduleSection.replaceChildren(
        el('h2', { class: 'section-title' }, 'Scoreboard'),
        errorCard(`Unable to load games: ${err instanceof Error ? err.message : String(err)}`)
      );
    }
  }

  function applyState(next: PageState, reload = true) {
    state = next;
    dateLabel.textContent = formatDateLabel(state.date);
    (filterInput as HTMLInputElement).value = state.filter;
    checkbox.checked = state.top25Only;
    pushState(state);
    if (reload) void loadGames();
  }

  prevBtn.addEventListener('click', () => {
    const d = new Date(`${state.date}T00:00:00`);
    d.setDate(d.getDate() - 1);
    applyState({ ...state, date: d.toISOString().slice(0, 10) });
  });
  nextBtn.addEventListener('click', () => {
    const d = new Date(`${state.date}T00:00:00`);
    d.setDate(d.getDate() + 1);
    applyState({ ...state, date: d.toISOString().slice(0, 10) });
  });
  todayBtn.addEventListener('click', () => {
    applyState({ ...state, date: todayISO() });
  });
  filterInput.addEventListener('input', () => {
    const next = { ...state, filter: (filterInput as HTMLInputElement).value };
    applyState(next, false);
  });
  filterInput.addEventListener('change', () => {
    const next = { ...state, filter: (filterInput as HTMLInputElement).value };
    applyState(next);
  });
  checkbox.addEventListener('change', () => {
    applyState({ ...state, top25Only: checkbox.checked });
  });

  window.addEventListener('hashchange', () => {
    const next = parseState();
    applyState(next, true);
  });

  applyState(state);
}

void render();
