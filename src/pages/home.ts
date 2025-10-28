import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { getRankings, getGames } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import './home.css';

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

async function render() {
  const root = document.getElementById('app')!;
  mount(root, el('div', { class: 'container' },
    el('h1', { class: 'title' }, BRAND.siteTitle),
    spinner()
  ));

  try {
    const [ranks, gamesToday] = await Promise.all([
      getRankings(DEFAULT_SEASON, 1),
      getGames({ start_date: todayISO(), end_date: todayISO(), per_page: 200 })
    ]);

    const top25 = ranks
      .filter(r => r.rank > 0 && r.rank <= 25)
      .sort((a, b) => a.rank - b.rank)
      .map(r => [r.rank, r.teamId, r.poll, r.week ?? ''] as (string | number)[]);

    const rankingsEl = section(
      'Top 25 Rankings',
      table(['Rank', 'Team ID', 'Poll', 'Week'], top25)
    );

    let games = gamesToday.data;
    if (!games || games.length === 0) {
      for (let i = 1; i <= 7 && (!games || games.length === 0); i++) {
        const start = addDaysISO(todayISO(), i);
        const end = start;
        const res = await getGames({ start_date: start, end_date: end, per_page: 200 });
        games = res.data;
      }
    }

    const gameRows = (games || []).slice(0, 25).map(g => [
      g.date?.slice(0, 10) ?? '',
      g.awayTeamId,
      '@',
      g.homeTeamId,
      g.awayScore ?? '',
      g.homeScore ?? '',
      g.status ?? ''
    ]);

    const gamesEl = section(
      'Games',
      table(['Date', 'Away', '', 'Home', 'Away Score', 'Home Score', 'Status'], gameRows)
    );

    const shell = el('div', { class: 'container' },
      el('h1', { class: 'title' }, BRAND.siteTitle),
      rankingsEl,
      gamesEl
    );

    mount(root, shell);
  } catch (err) {
    mount(document.getElementById('app')!, el('pre', { class: 'error' }, String(err)));
  }
}

render();
