import { BRAND } from '../lib/config/ncaam';
import { teams as fetchTeams, teamRoster } from '../lib/sdk/ncaam';
import type { Player, Team } from '../lib/sdk/types';
import { el, mount } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { teamLink } from '../lib/ui/components';
import '../../public/styles/site.css';

interface PlayerIndexEntry {
  id: string;
  name: string;
  position?: string;
  teamId?: string;
  teamName?: string;
}

const INDEX_KEY = 'ncaam-player-index';
const INDEX_TTL = 6 * 60 * 60 * 1000; // 6 hours
const CONCURRENCY = 6;

function readIndex(): PlayerIndexEntry[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expires: number; data: PlayerIndexEntry[] };
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.expires <= Date.now()) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeIndex(data: PlayerIndexEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify({ expires: Date.now() + INDEX_TTL, data }));
  } catch {
    /* ignore */
  }
}

function skeleton(): HTMLElement {
  return el('div', { class: 'rows' },
    el('div', { class: 'skeleton-row' },
      el('span', { class: 'skeleton' }),
      el('span', { class: 'skeleton' }),
      el('span', { class: 'skeleton' }),
      el('span', { class: 'skeleton' })
    )
  );
}

function resultRow(entry: PlayerIndexEntry): HTMLElement {
  const row = el('div', { class: 'row row-standings' });
  row.appendChild(el('span', { class: 'standings-team' }, entry.name));
  row.appendChild(el('span', {}, entry.position ?? '')); 
  if (entry.teamId && entry.teamName) {
    row.appendChild(teamLink(entry.teamId, entry.teamName));
  }
  return row;
}

function renderResults(container: HTMLElement, results: PlayerIndexEntry[]) {
  if (!results.length) {
    container.replaceChildren(el('p', { class: 'empty-state' }, 'No players match the current search.'));
    return;
  }
  const rows = el('div', { class: 'rows' });
  results.slice(0, 50).forEach(entry => rows.appendChild(resultRow(entry)));
  container.replaceChildren(rows);
}

function buildEntry(player: Player, team?: Team): PlayerIndexEntry {
  return {
    id: player.id,
    name: `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim(),
    position: player.position,
    teamId: player.teamId ?? team?.id,
    teamName: player.teamName ?? team?.displayName,
  };
}

async function buildIndex(teams: Team[], progress: (completed: number, total: number) => void): Promise<PlayerIndexEntry[]> {
  const entries: PlayerIndexEntry[] = [];
  let index = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (true) {
      const current = index;
      if (current >= teams.length) break;
      index += 1;
      const team = teams[current];
      try {
        const roster = await teamRoster(team.id);
        roster.forEach(player => entries.push(buildEntry(player, team)));
      } catch {
        // ignore failures for individual teams
      }
      completed += 1;
      progress(completed, teams.length);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  return entries.filter(entry => entry.name);
}

async function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const search = el('input', { type: 'text', placeholder: 'Search players…' }) as HTMLInputElement;
  const status = el('p', { class: 'empty-state' }, 'First search may take a few seconds while rosters load.');
  const resultsContainer = el('div', {}, skeleton());

  const shell = el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Players`),
    nav(),
    el('div', { class: 'controls' }, search),
    status,
    resultsContainer,
    footer()
  );
  mount(root, shell);

  const cached = readIndex();
  let indexData: PlayerIndexEntry[] | null = cached;
  if (cached) {
    status.textContent = `Index loaded from cache (${cached.length} players).`;
    renderResults(resultsContainer, cached.slice(0, 50));
  }

  let building = false;

  async function ensureIndex() {
    if (indexData) return indexData;
    if (building) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return ensureIndex();
    }
    building = true;
    status.textContent = 'Building player index…';
    try {
      const teams = (await fetchTeams()).filter(team => team.conferenceId != null);
      const entries = await buildIndex(teams, (completed, total) => {
        status.textContent = `Building player index… ${completed}/${total}`;
      });
      entries.sort((a, b) => a.name.localeCompare(b.name));
      writeIndex(entries);
      indexData = entries;
      status.textContent = `Index ready (${entries.length} players).`;
      return entries;
    } catch (err) {
      status.replaceChildren(el('span', { class: 'error-card' }, `Index build failed: ${err instanceof Error ? err.message : String(err)}`));
      indexData = [];
      return indexData;
    } finally {
      building = false;
    }
  }

  async function handleSearch() {
    const term = search.value.trim().toLowerCase();
    const data = await ensureIndex();
    if (!term) {
      renderResults(resultsContainer, data.slice(0, 50));
      return;
    }
    const filtered = data.filter(entry => entry.name.toLowerCase().includes(term) || (entry.teamName ?? '').toLowerCase().includes(term));
    renderResults(resultsContainer, filtered);
  }

  search.addEventListener('focus', () => { void ensureIndex(); });
  search.addEventListener('input', () => { void handleSearch(); });

  if (!cached) {
    renderResults(resultsContainer, []);
  }
}

void render();
