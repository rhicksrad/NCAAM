import { BRAND } from '../lib/config/ncaam';
import { player as fetchPlayer, scoreboard } from '../lib/sdk/ncaam';
import type { Game } from '../lib/sdk/types';
import { el, mount, section } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { gamesList, teamLink } from '../lib/ui/components';
import { emptyState, errorCard, skeletonRows } from '../lib/ui/feedback';
import '../../public/styles/site.css';

function getPlayerId(): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get('player_id');
}

async function recentTeamGames(teamId: string): Promise<Game[]> {
  const today = new Date();
  const games: Game[] = [];
  for (let offset = 0; offset < 10; offset += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    const iso = d.toISOString().slice(0, 10);
    try {
      const slate = await scoreboard(iso);
      slate
        .filter(game => game.home.team.id === teamId || game.away.team.id === teamId)
        .forEach(game => games.push(game));
    } catch {
      /* ignore */
    }
    if (games.length >= 5) break;
  }
  games.sort((a, b) => b.dateUTC.localeCompare(a.dateUTC));
  return games.slice(0, 5);
}

async function render() {
  const root = document.getElementById('app');
  if (!root) return;

  const playerId = getPlayerId();
  if (!playerId) {
    mount(root, el('div', { class: 'container' },
      el('h1', { class: 'title' }, `${BRAND.siteTitle} — Player`),
      nav(),
      errorCard('Missing player_id query parameter.'),
      footer()
    ));
    return;
  }

  const bioSection = section('Profile', skeletonRows(1));
  const gamesSection = section('Recent Team Games', skeletonRows(1));

  const shell = el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Player`),
    nav(),
    bioSection,
    gamesSection,
    footer()
  );
  mount(root, shell);

  try {
    const data = await fetchPlayer(playerId);
    const name = `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() || `Player ${data.id}`;
    const items = el('div', { class: 'rows' },
      el('div', { class: 'row row-standings' }, el('span', { class: 'standings-team' }, 'Name'), el('span', {}, name)),
      el('div', { class: 'row row-standings' }, el('span', { class: 'standings-team' }, 'Position'), el('span', {}, data.position ?? '—')),
      el('div', { class: 'row row-standings' }, el('span', { class: 'standings-team' }, 'Height'), el('span', {}, data.height ?? '—')),
      el('div', { class: 'row row-standings' }, el('span', { class: 'standings-team' }, 'Weight'), el('span', {}, data.weight ?? '—')),
      el('div', { class: 'row row-standings' }, el('span', { class: 'standings-team' }, 'Class'), el('span', {}, data.classYear ?? '—')),
      data.teamId ? el('div', { class: 'row row-standings' }, el('span', { class: 'standings-team' }, 'Team'), teamLink(data.teamId, data.teamName ?? 'View team')) : null
    );
    bioSection.replaceChildren(el('h2', { class: 'section-title' }, 'Profile'), items);

    if (data.teamId) {
      const games = await recentTeamGames(data.teamId);
      if (games.length) {
        gamesSection.replaceChildren(el('h2', { class: 'section-title' }, 'Recent Team Games'), gamesList(games));
      } else {
        gamesSection.replaceChildren(el('h2', { class: 'section-title' }, 'Recent Team Games'), emptyState('No recent games found.'));
      }
    } else {
      gamesSection.replaceChildren(el('h2', { class: 'section-title' }, 'Recent Team Games'), emptyState('No team information available.'));
    }
  } catch (err) {
    bioSection.replaceChildren(el('h2', { class: 'section-title' }, 'Profile'), errorCard(`Unable to load player: ${err instanceof Error ? err.message : String(err)}`));
    gamesSection.replaceChildren(el('h2', { class: 'section-title' }, 'Recent Team Games'), errorCard('Unable to load schedule.'));
  }
}

void render();
