import { BRAND } from '../lib/config/ncaam';
import { getTeams } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { basePath } from '../lib/ui/base';
import '../../public/styles/site.css';

type TeamVM = { id:string; name:string; shortName:string; conference?:string; logo?:string };

function uniqueConferences(teams: TeamVM[]): string[] {
  const set = new Set<string>(); for (const t of teams) if (t.conference) set.add(t.conference);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
function applyFilters(teams: TeamVM[], conf: string, q: string): TeamVM[] {
  const qn = q.trim().toLowerCase();
  return teams.filter(t => (conf === 'All' || t.conference === conf) && (!qn || t.name.toLowerCase().includes(qn) || t.shortName.toLowerCase().includes(qn)));
}
function linkTeam(id: string, label: string) {
  const base = basePath();
  return el('a', { href: `${base}team.html?team_id=${encodeURIComponent(id)}` }, label);
}

async function render() {
  const root = document.getElementById('app')!;
  mount(root, el('div', { class: 'container' }, el('h1', { class: 'title' }, `${BRAND.siteTitle} — Teams`), nav(), spinner()));
  try {
    const raw = await getTeams({ per_page: 500 });
    const teams = raw.map(t => ({ ...t })) as TeamVM[];
    const conferences = ['All', ...uniqueConferences(teams)];
    const confSel = el('select', { id: 'conf' }, ...conferences.map(c => el('option', { value: c }, c)));
    const search = el('input', { id: 'q', placeholder: 'Filter by team name...' });
    const controls = el('div', { class: 'section controls' }, el('label', {}, 'Conference:'), confSel, el('label', {}, 'Filter:'), search);
    const tblWrap = el('div', {});
    const renderTable = (rows: TeamVM[]) => mount(tblWrap, table(['Team','Short','Conference','Team ID'], rows.map(t => [linkTeam(t.id, t.name), t.shortName, t.conference ?? '', t.id])));
    const shell = el('div', { class: 'container' }, el('h1', { class: 'title' }, `${BRAND.siteTitle} — Teams`), nav(), controls, section('All Teams', tblWrap), footer());
    mount(root, shell);
    const sync = () => renderTable(applyFilters(teams, (confSel as HTMLSelectElement).value, (search as HTMLInputElement).value));
    confSel.addEventListener('change', sync); search.addEventListener('input', sync); sync();
  } catch (err) { mount(document.getElementById('app')!, el('pre', { class: 'error' }, String(err))); }
}
render();
