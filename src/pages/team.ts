import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { getTeams, getGames, getStandings } from '../lib/ncaam/service';
import type { Team, Game } from '../lib/ncaam/types';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import { qp } from '../lib/ui/url';
import { fmtYYYYMMDD } from '../lib/ui/date';
import './home.css';

type TeamVM = Team;
type GameVM = Game;
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

function wlFor(teamId: string, g: GameVM): string {
  const hs = g.homeScore ?? 0;
  const as = g.awayScore ?? 0;
  if (!hs && !as) return g.status ?? '';
  const oursHome = g.homeTeamId === teamId;
  const diff = oursHome ? hs - as : as - hs;
  if (hs === as) return `T ${hs}-${as}`;
  const win = diff > 0;
  const forScore = oursHome ? hs : as;
  const oppScore = oursHome ? as : hs;
  return `${win ? 'W' : 'L'} ${forScore}-${oppScore}`;
}

async function render() {
  const teamId = qp('team_id');
  const root = document.getElementById('app');
  if (!root) return;
  if (!teamId) {
    mount(root, el('div', { class: 'container' },
      el('h1', { class: 'title' }, `${BRAND.siteTitle} — Team`),
      nav(),
      el('p', {}, 'Missing team_id')
    ));
    return;
  }

  mount(root, el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Team`),
    nav(),
    spinner()
  ));

  try {
    const [teams, gamesRes, standings] = await Promise.all([
      getTeams({ per_page: 5000 }),
      getGames({ team_id: teamId, per_page: 100 }),
      getStandings(DEFAULT_SEASON)
    ]);

    const tmap = new Map<string, TeamVM>(teams.map(t => [t.id, t]));
    const team = tmap.get(String(teamId));

    if (!team) {
      mount(root, el('div', { class: 'container' },
        el('h1', { class: 'title' }, `${BRAND.siteTitle} — Team`),
        nav(),
        el('p', {}, `Team not found: ${teamId}`)
      ));
      return;
    }

    const head = el('div', { class: 'section' },
      el('h2', {}, team.name),
      el('div', {}, `Conference: ${team.conference ?? '—'}`),
      el('div', {}, `Team ID: ${team.id}`)
    );

    const games = [...gamesRes.data];
    games.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).reverse();
    const rows = games.slice(0, 20).map(g => {
      const away = tmap.get(g.awayTeamId)?.shortName ?? g.awayTeamId;
      const home = tmap.get(g.homeTeamId)?.shortName ?? g.homeTeamId;
      return [
        fmtYYYYMMDD(g.date),
        linkTeam(g.awayTeamId, away),
        '@',
        linkTeam(g.homeTeamId, home),
        g.awayScore ?? '',
        g.homeScore ?? '',
        wlFor(team.id, g)
      ];
    });
    const gamesEl = section('Recent Games', table(['Date', 'Away', '', 'Home', 'Away', 'Home', 'Result'], rows));

    const row = standings.find(s => s.teamId === team.id);
    const st = section('Standings Snapshot', table(
      ['Team', 'W', 'L', 'Conf W', 'Conf L'],
      [[team.shortName, row?.wins ?? '', row?.losses ?? '', row?.confWins ?? '', row?.confLosses ?? '']]
    ));

    const shell = el('div', { class: 'container' },
      el('h1', { class: 'title' }, `${BRAND.siteTitle} — Team`),
      nav(),
      head,
      gamesEl,
      st
    );
    mount(root, shell);
  } catch (err) {
    mount(root, el('pre', { class: 'error' }, String(err)));
  }
}

void render();
