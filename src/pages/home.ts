import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { getRankings, getGames, getTeams } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { basePath } from '../lib/ui/base';
import '../../public/styles/site.css';

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDaysISO(startISO: string, days: number): string {
  const d = new Date(startISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function linkTeam(id: string, label: string) {
  const base = basePath();
  return el('a', { href: `${base}team.html?team_id=${encodeURIComponent(id)}` }, label);
}

async function render() {
  const root = document.getElementById('app')!;
  mount(root, el('div', { class: 'container' },
    el('h1', { class: 'title' }, BRAND.siteTitle),
    nav(),
    spinner()
  ));

  try {
    const [teams, ranks, gamesToday] = await Promise.all([
      getTeams({ per_page: 5000 }),
      getRankings(DEFAULT_SEASON, 1),
      getGames({ start_date: todayISO(), end_date: todayISO(), per_page: 200 })
    ]);
    const tmap = new Map(teams.map(t => [t.id, t.shortName ?? t.name]));

    const top25 = ranks
      .filter(r => r.rank > 0 && r.rank <= 25)
      .sort((a, b) => a.rank - b.rank)
      .map(r => [r.rank, linkTeam(r.teamId, tmap.get(r.teamId) ?? r.teamId), r.poll, r.week ?? ''] as (string | number | Node)[]);
    const rankingsContent = top25.length > 0
      ? table(['Rank', 'Team', 'Poll', 'Week'], top25)
      : el('p', { class: 'empty-state' }, 'Rankings are not yet available for this season.');
    const rankingsEl = section('Top 25 Rankings', rankingsContent);

    let games = gamesToday.data;
    if (!games || games.length === 0) {
      for (let i = 1; i <= 7 && (!games || games.length === 0); i++) {
        const start = addDaysISO(todayISO(), i);
        const res = await getGames({ start_date: start, end_date: start, per_page: 200 });
        games = res.data;
      }
    }
    const gameRows = (games || []).slice(0, 25).map(g => [
      g.date?.slice(0, 10) ?? '',
      linkTeam(g.awayTeamId, tmap.get(g.awayTeamId) ?? g.awayTeamId),
      '@',
      linkTeam(g.homeTeamId, tmap.get(g.homeTeamId) ?? g.homeTeamId),
      g.awayScore ?? '',
      g.homeScore ?? '',
      g.status ?? ''
    ] as (string | number | Node)[]);
    const gamesEl = section('Games', table(['Date','Away','','Home','Away','Home','Status'], gameRows));

    const shell = el('div', { class: 'container' },
      el('h1', { class: 'title' }, BRAND.siteTitle),
      nav(),
      rankingsEl,
      gamesEl,
      footer()
    );
    mount(root, shell);
  } catch (err) {
    mount(root, el('pre', { class: 'error' }, String(err)));
  }
}
render();
