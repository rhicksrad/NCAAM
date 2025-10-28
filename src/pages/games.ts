import { BRAND } from '../lib/config/ncaam';
import { getGames, getTeams } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import './home.css';

type TeamVM = { id: string; shortName: string };

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

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function linkTeam(id: string, label: string) {
  return el('a', { href: `/team.html?team_id=${encodeURIComponent(id)}` }, label);
}

async function render() {
  const root = document.getElementById('app')!;
  mount(root, el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Games`),
    nav(),
    spinner()
  ));

  try {
    const teams = await getTeams({ per_page: 5000 });
    const tmap = new Map<string, TeamVM>(teams.map(t => [t.id, { id: t.id, shortName: t.shortName }]));

    const startInput = el('input', { id: 'start', type: 'date', value: todayISO() }) as HTMLInputElement;
    const endInput = el('input', { id: 'end', type: 'date', value: todayISO() }) as HTMLInputElement;

    const teamSel = el('select', { id: 'team' }) as HTMLSelectElement;
    teamSel.appendChild(el('option', { value: '' }, 'All Teams'));
    teams
      .slice()
      .sort((a, b) => a.shortName.localeCompare(b.shortName))
      .forEach(t => teamSel.appendChild(el('option', { value: t.id }, t.shortName)));

    const perSel = el('select', { id: 'per' },
      el('option', { value: '25' }, '25'),
      el('option', { value: '50', selected: 'true' }, '50'),
      el('option', { value: '100' }, '100')
    ) as HTMLSelectElement;

    let page = 1;
    const prevBtn = el('button', { id: 'prev', disabled: 'true' }, 'Prev') as HTMLButtonElement;
    const nextBtn = el('button', { id: 'next' }, 'Next') as HTMLButtonElement;
    const pageLbl = el('span', { id: 'page' }, `Page ${page}`) as HTMLSpanElement;

    const todayBtn = el('button', { id: 'today' }, 'Today') as HTMLButtonElement;
    const next7Btn = el('button', { id: 'next7' }, 'Next 7 Days') as HTMLButtonElement;

    const controls = el('div', { class: 'section' },
      el('label', {}, 'Start: '), startInput, document.createTextNode('  '),
      el('label', {}, 'End: '), endInput, document.createTextNode('  '),
      el('label', {}, 'Team: '), teamSel, document.createTextNode('  '),
      el('label', {}, 'Per: '), perSel, document.createTextNode('  '),
      prevBtn, document.createTextNode(' '), nextBtn, document.createTextNode('  '), pageLbl, document.createTextNode('  '),
      todayBtn, document.createTextNode(' '), next7Btn
    );

    const tblWrap = el('div', {});
    function renderTable(rows: any[]) {
      const data = rows.map(g => {
        const away = tmap.get(g.awayTeamId)?.shortName ?? g.awayTeamId;
        const home = tmap.get(g.homeTeamId)?.shortName ?? g.homeTeamId;
        return [
          (g.date ?? '').slice(0, 10),
          linkTeam(g.awayTeamId, away),
          '@',
          linkTeam(g.homeTeamId, home),
          g.awayScore ?? '',
          g.homeScore ?? '',
          g.status ?? ''
        ] as (string | number | Node)[];
      });
      const tbl = table(['Date', 'Away', '', 'Home', 'Away', 'Home', 'Status'], data);
      mount(tblWrap, tbl);
    }

    const shell = el('div', { class: 'container' },
      el('h1', { class: 'title' }, `${BRAND.siteTitle} — Games`),
      nav(),
      controls,
      section('Schedule', tblWrap)
    );
    mount(root, shell);

    async function load() {
      const start_date = startInput.value || todayISO();
      const end_date = endInput.value || start_date;
      const team_id = teamSel.value || undefined;
      const per_page = Number((perSel as HTMLSelectElement).value);
      prevBtn.disabled = page <= 1;
      pageLbl.textContent = `Page ${page}`;
      const res = await getGames({ start_date, end_date, team_id: team_id as any, per_page, page });
      renderTable(res.data);
      // If fewer than per_page returned, disable "Next"
      nextBtn.disabled = !res.nextPage && res.data.length < per_page;
    }

    startInput.addEventListener('change', () => { page = 1; void load(); });
    endInput.addEventListener('change', () => { page = 1; void load(); });
    teamSel.addEventListener('change', () => { page = 1; void load(); });
    perSel.addEventListener('change', () => { page = 1; void load(); });
    prevBtn.addEventListener('click', () => { if (page > 1) { page--; void load(); } });
    nextBtn.addEventListener('click', () => { page++; void load(); });
    todayBtn.addEventListener('click', () => { const t = todayISO(); startInput.value = t; endInput.value = t; page = 1; void load(); });
    next7Btn.addEventListener('click', () => {
      const t = new Date();
      const start = todayISO();
      const t2 = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 7);
      const end = `${t2.getFullYear()}-${String(t2.getMonth() + 1).padStart(2, '0')}-${String(t2.getDate()).padStart(2, '0')}`;
      startInput.value = start; endInput.value = end; page = 1; void load();
    });

    await load();
  } catch (err) {
    mount(root, el('pre', { class: 'error' }, String(err)));
  }
}

render();

