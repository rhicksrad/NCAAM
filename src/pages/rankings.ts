import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { getRankings, getTeams } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import './home.css';

type TeamVM = { id: string; shortName: string };
type RankVM = { rank: number; teamId: string; poll: string; week?: number };

function nav() {
  return el('nav', { class: 'section' },
    el('a', { href: '/' }, 'Home'), document.createTextNode(' · '),
    el('a', { href: '/teams.html' }, 'Teams'), document.createTextNode(' · '),
    el('a', { href: '/players.html' }, 'Players'), document.createTextNode(' · '),
    el('a', { href: '/games.html' }, 'Games'), document.createTextNode(' · '),
    el('a', { href: '/rankings.html' }, 'Rankings'), document.createTextNode(' · '),
    el('a', { href: '/standings.html' }, 'Standings')
  );
}

function linkTeam(id: string, label: string) {
  return el('a', { href: `/team.html?team_id=${encodeURIComponent(id)}` }, label);
}

function pollsOf(rows: RankVM[]): string[] {
  const s = new Set(rows.map(r => r.poll || 'AP'));
  return ['All', ...Array.from(s).sort((a, b) => a.localeCompare(b))];
}

async function render() {
  const root = document.getElementById('app')!;
  mount(root, el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Rankings`),
    nav(),
    spinner()
  ));

  try {
    const [teams, rows] = await Promise.all([
      getTeams({ per_page: 5000 }),
      getRankings(DEFAULT_SEASON, 1)
    ]);
    const tmap = new Map<string, TeamVM>(teams.map(t => [t.id, { id: t.id, shortName: t.shortName }]));

    let currentRows = rows as RankVM[];
    const seasonInput = el('input', { id: 'season', type: 'number', value: String(DEFAULT_SEASON), min: '2015', max: '2100' }) as HTMLInputElement;
    const weekInput = el('input', { id: 'week', type: 'number', value: '1', min: '1', max: '30' }) as HTMLInputElement;
    const weekPrev = el('button', { id: 'wprev' }, 'Prev');
    const weekNext = el('button', { id: 'wnext' }, 'Next');
    const pollSel = el('select', { id: 'poll' }, ...pollsOf(currentRows).map(p => el('option', { value: p }, p))) as HTMLSelectElement;

    const controls = el('div', { class: 'section' },
      el('label', {}, 'Season: '), seasonInput, document.createTextNode('  '),
      el('label', {}, 'Week: '), weekPrev, weekInput, weekNext, document.createTextNode('  '),
      el('label', {}, 'Poll: '), pollSel
    );

    const tblWrap = el('div', {});
    function renderTable(rowsIn: RankVM[]) {
      const poll = pollSel.value;
      const filtered = rowsIn
        .filter(r => (poll === 'All' ? true : r.poll === poll))
        .filter(r => r.rank > 0 && r.rank <= 25)
        .sort((a, b) => a.rank - b.rank);
      const data = filtered.map(r => {
        const team = tmap.get(r.teamId);
        const label = team?.shortName ?? r.teamId;
        return [r.rank, linkTeam(r.teamId, label), r.poll, r.week ?? ''] as (string | number | Node)[];
      });
      const tbl = table(['Rank', 'Team', 'Poll', 'Week'], data);
      mount(tblWrap, tbl);
    }

    const shell = el('div', { class: 'container' },
      el('h1', { class: 'title' }, `${BRAND.siteTitle} — Rankings`),
      nav(),
      controls,
      section('Top 25', tblWrap)
    );
    mount(root, shell);
    renderTable(currentRows);

    async function reload() {
      const season = Number(seasonInput.value) || DEFAULT_SEASON;
      const week = Number(weekInput.value) || 1;
      currentRows = await getRankings(season, week) as RankVM[];
      // refresh poll list on new data
      const options = pollsOf(currentRows);
      while (pollSel.firstChild) pollSel.removeChild(pollSel.firstChild);
      options.forEach(p => pollSel.appendChild(el('option', { value: p }, p)));
      renderTable(currentRows);
    }

    weekPrev.addEventListener('click', () => { weekInput.value = String(Math.max(1, Number(weekInput.value) - 1)); void reload(); });
    weekNext.addEventListener('click', () => { weekInput.value = String(Number(weekInput.value) + 1); void reload(); });
    seasonInput.addEventListener('change', () => void reload());
    weekInput.addEventListener('change', () => void reload());
    pollSel.addEventListener('change', () => renderTable(currentRows));
  } catch (err) {
    mount(root, el('pre', { class: 'error' }, String(err)));
  }
}

render();

