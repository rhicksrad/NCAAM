import { BRAND } from '../lib/config/ncaam';
import { getPlayer, getGames, getTeams } from '../lib/ncaam/service';
import type { Game, Team } from '../lib/ncaam/types';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import { qp } from '../lib/ui/url';
import { fmtYYYYMMDD } from '../lib/ui/date';
import './home.css';

type GameVM = Game;
type TeamVM = Team;

function nav() {
  return el('nav', { class: 'section' },
    el('a', { href: '/' }, 'Home'), document.createTextNode(' · '),
    el('a', { href: '/teams.html' }, 'Teams'), document.createTextNode(' · '),
    el('a', { href: '/players.html' }, 'Players')
  );
}

function linkTeam(id: string, label: string) {
  return el('a', { href: `/team.html?team_id=${encodeURIComponent(id)}` }, label);
}

async function render() {
  const playerId = qp('player_id');
  const root = document.getElementById('app');
  if (!root) return;
  if (!playerId) {
    mount(root, el('div', { class: 'container' },
      el('h1', { class: 'title' }, `${BRAND.siteTitle} — Player`),
      nav(),
      el('p', {}, 'Missing player_id')
    ));
    return;
  }

  mount(root, el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Player`),
    nav(),
    spinner()
  ));

  try {
    const player = await getPlayer(playerId);
    const name = `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();

    let games: GameVM[] = [];
    let teamLabel = '';
    let teamMap: Map<string, TeamVM> | undefined;
    if (player.teamId) {
      const [gamesRes, teams] = await Promise.all([
        getGames({ team_id: player.teamId, per_page: 50 }),
        getTeams({ per_page: 5000 })
      ]);
      games = [...gamesRes.data];
      teamMap = new Map<string, TeamVM>(teams.map(t => [t.id, t]));
      teamLabel = teamMap.get(player.teamId)?.shortName ?? player.teamId;
    }

    const head = el('div', { class: 'section' },
      el('h2', {}, name || `Player ${player.id}`),
      el('div', {}, `Player ID: ${player.id}`),
      el('div', {}, `Position: ${player.position ?? ''}`),
      el('div', {}, player.teamId ? ['Team: ', linkTeam(player.teamId, teamLabel || player.teamId)] : 'Team:'),
      el('div', {}, `Class: ${player.classYear ?? ''}`),
      el('div', {}, `Eligibility: ${player.eligibility ?? ''}`)
    );

    games.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).reverse();
    const rows = games.slice(0, 15).map(g => {
      const awayName = teamMap?.get(g.awayTeamId)?.shortName ?? g.awayTeamId;
      const homeName = teamMap?.get(g.homeTeamId)?.shortName ?? g.homeTeamId;
      return [
        fmtYYYYMMDD(g.date),
        linkTeam(g.awayTeamId, awayName),
        '@',
        linkTeam(g.homeTeamId, homeName),
        g.awayScore ?? '',
        g.homeScore ?? '',
        g.status ?? ''
      ];
    });
    const gamesEl = section('Recent Team Games', table(['Date', 'Away', '', 'Home', 'Away', 'Home', 'Status'], rows));

    const shell = el('div', { class: 'container' },
      el('h1', { class: 'title' }, `${BRAND.siteTitle} — Player`),
      nav(),
      head,
      gamesEl
    );
    mount(root, shell);
  } catch (err) {
    mount(root, el('pre', { class: 'error' }, String(err)));
  }
}

void render();
