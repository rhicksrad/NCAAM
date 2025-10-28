import { BRAND } from '../lib/config/ncaam';
import { getPlayers } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import './home.css'; // reuse CHUNK 2 styles

type PlayerVM = {
  id: string;
  firstName: string;
  lastName: string;
  position?: string;
  teamId?: string;
  classYear?: string;
  eligibility?: string;
};

function nav() {
  return el('nav', { class: 'section' },
    el('a', { href: '/' }, 'Home'), document.createTextNode(' · '),
    el('a', { href: '/teams.html' }, 'Teams'), document.createTextNode(' · '),
    el('a', { href: '/players.html' }, 'Players')
  );
}

function fullName(p: PlayerVM) {
  return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
}

function filterPage(items: PlayerVM[], q: string) {
  const qn = q.trim().toLowerCase();
  if (!qn) return items;
  return items.filter(p => {
    const name = fullName(p).toLowerCase();
    return name.includes(qn) || (p.teamId ?? '').toLowerCase().includes(qn);
  });
}

function linkPlayer(id: string, label: string) {
  return el('a', { href: `/player.html?player_id=${encodeURIComponent(id)}` }, label);
}

function linkTeam(id: string | undefined) {
  if (!id) return '';
  return el('a', { href: `/team.html?team_id=${encodeURIComponent(id)}` }, id);
}

async function render() {
  const root = document.getElementById('app');
  if (!root) return;
  mount(root, el('div', { class: 'container' },
    el('h1', { class: 'title' }, `${BRAND.siteTitle} — Players`),
    nav(),
    spinner()
  ));

  try {
    let page = 1;
    let perPage = 50;

    const search = el('input', { id: 'q', placeholder: 'Filter current page by name or team ID...' });
    const perSel = el('select', { id: 'per' },
      el('option', { value: '25' }, '25'),
      el('option', { value: '50', selected: 'true' }, '50'),
      el('option', { value: '100' }, '100')
    );
    const prevBtn = el('button', { id: 'prev', disabled: 'true' }, 'Prev');
    const nextBtn = el('button', { id: 'next' }, 'Next');
    const pageLbl = el('span', { id: 'page' }, `Page ${page}`);

    const controls = el('div', { class: 'section' },
      el('label', {}, 'Per page: '), perSel, document.createTextNode('  '),
      prevBtn, document.createTextNode(' '), nextBtn, document.createTextNode('  '), pageLbl, document.createTextNode('  '),
      el('label', {}, 'Filter: '), search
    );

    const tblWrap = el('div', {});
    const renderTable = (rows: PlayerVM[]) => {
      const data = rows.map(p => [
        linkPlayer(p.id, fullName(p) || p.id),
        p.position ?? '',
        p.teamId ? linkTeam(p.teamId) : '',
        p.classYear ?? '',
        p.eligibility ?? '',
        p.id
      ]);
      const tbl = table(['Name', 'Pos', 'Team ID', 'Class', 'Elig', 'Player ID'], data);
      mount(tblWrap, tbl);
    };

    const shell = el('div', { class: 'container' },
      el('h1', { class: 'title' }, `${BRAND.siteTitle} — Players`),
      nav(),
      controls,
      section('Players', tblWrap)
    );
    mount(root, shell);

    async function load() {
      (prevBtn as HTMLButtonElement).disabled = page <= 1;
      (pageLbl as HTMLSpanElement).textContent = `Page ${page}`;
      const res = await getPlayers({ per_page: perPage, page });
      const filtered = filterPage(res, (search as HTMLInputElement).value);
      renderTable(filtered);
    }

    perSel.addEventListener('change', () => { perPage = Number((perSel as HTMLSelectElement).value); page = 1; void load(); });
    prevBtn.addEventListener('click', () => { if (page > 1) { page--; void load(); } });
    nextBtn.addEventListener('click', () => { page++; void load(); });
    search.addEventListener('input', () => { void load(); });

    await load();
  } catch (err) {
    mount(document.getElementById('app') ?? root, el('pre', { class: 'error' }, String(err)));
  }
}

void render();
