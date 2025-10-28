import { BRAND } from '../lib/config/ncaam';
import { getPlayers } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import '../../public/styles/site.css';

type PlayerVM = { id:string; firstName:string; lastName:string; position?:string; teamId?:string; classYear?:string; eligibility?:string };
function fullName(p: PlayerVM){ return `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(); }
function filterPage(items: PlayerVM[], q: string) {
  const qn = q.trim().toLowerCase(); if (!qn) return items;
  return items.filter(p => fullName(p).toLowerCase().includes(qn) || (p.teamId ?? '').toLowerCase().includes(qn));
}
function linkPlayer(id: string, label: string) { return el('a', { href: `/player.html?player_id=${encodeURIComponent(id)}` }, label); }

async function render() {
  const root = document.getElementById('app')!;
  mount(root, el('div', { class: 'container' }, el('h1', { class: 'title' }, `${BRAND.siteTitle} — Players`), nav(), spinner()));
  try {
    let page = 1; let perPage = 50;
    const search = el('input', { id: 'q', placeholder: 'Filter current page by name or team ID...' });
    const perSel = el('select', { id: 'per' }, el('option', { value: '25' }, '25'), el('option', { value: '50', selected: 'true' }, '50'), el('option', { value: '100' }, '100')) as HTMLSelectElement;
    const prevBtn = el('button', { id: 'prev', disabled: 'true' }, 'Prev') as HTMLButtonElement;
    const nextBtn = el('button', { id: 'next' }, 'Next') as HTMLButtonElement;
    const pageLbl = el('span', { id: 'page' }, `Page ${page}`) as HTMLSpanElement;
    const controls = el('div', { class: 'section controls' }, el('label', {}, 'Per page:'), perSel, prevBtn, nextBtn, pageLbl, el('label', {}, 'Filter:'), search);
    const tblWrap = el('div', {});
    const renderTable = (rows: PlayerVM[]) => mount(tblWrap, table(['Name','Pos','Team ID','Class','Elig','Player ID'],
      rows.map(p => [linkPlayer(p.id, fullName(p)), p.position ?? '', p.teamId ?? '', p.classYear ?? '', p.eligibility ?? '', p.id])));
    const shell = el('div', { class: 'container' }, el('h1', { class: 'title' }, `${BRAND.siteTitle} — Players`), nav(), controls, section('Players', tblWrap), footer());
    mount(root, shell);
    async function load(){ prevBtn.disabled = page <= 1; pageLbl.textContent = `Page ${page}`; const res = await getPlayers({ per_page: perPage, page }); renderTable(filterPage(res, (search as HTMLInputElement).value)); }
    perSel.addEventListener('change', () => { perPage = Number(perSel.value); page = 1; void load(); });
    prevBtn.addEventListener('click', () => { if (page > 1) { page--; void load(); } });
    nextBtn.addEventListener('click', () => { page++; void load(); });
    search.addEventListener('input', () => void load());
    await load();
  } catch (err) { mount(document.getElementById('app')!, el('pre', { class: 'error' }, String(err))); }
}
render();
