import { BRAND, DEFAULT_SEASON } from '../lib/config/ncaam';
import { getStandings, getTeams } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import '../../public/styles/site.css';
type TeamVM = { id:string; shortName:string; conference?:string };
type RowVM = { teamId:string; wins:number; losses:number; confWins?:number; confLosses?:number };
function linkTeam(id:string,label:string){ return el('a',{ href:`/team.html?team_id=${encodeURIComponent(id)}` },label); }
function uniqueConferences(teams: TeamVM[]): string[]{ const s=new Set<string>(); for(const t of teams) if(t.conference) s.add(t.conference); return Array.from(s).sort((a,b)=>a.localeCompare(b)); }
async function render(){
  const root = document.getElementById('app')!;
  mount(root, el('div',{class:'container'}, el('h1',{class:'title'},`${BRAND.siteTitle} — Standings`), nav(), spinner()));
  try{
    const [teams, rows] = await Promise.all([ getTeams({ per_page: 5000 }), getStandings(DEFAULT_SEASON) ]);
    const tmap = new Map<string,TeamVM>(teams.map(t=>[t.id,{id:t.id, shortName:t.shortName, conference:t.conference}]));
    const conferences = ['All', ...uniqueConferences(teams as TeamVM[])];
    const seasonInput = el('input', { id: 'season', type: 'number', value: String(DEFAULT_SEASON), min: '2015', max: '2100' }) as HTMLInputElement;
    const confSel = el('select', { id: 'conf' }, ...conferences.map(c => el('option', { value: c }, c))) as HTMLSelectElement;
    const controls = el('div', { class: 'section controls' }, el('label', {}, 'Season:'), seasonInput, el('label', {}, 'Conference:'), confSel);
    const tblWrap = el('div', {});
    function renderTable(allRows: RowVM[]){
      const conf = confSel.value;
      const filtered = allRows.filter(r => conf === 'All' ? true : tmap.get(r.teamId)?.conference === conf);
      filtered.sort((a,b)=> (b.wins - a.wins) || (a.losses - b.losses));
      const data = filtered.map(r => { const t=tmap.get(r.teamId); const label=t?.shortName ?? r.teamId;
        return [linkTeam(r.teamId, label), r.wins, r.losses, r.confWins ?? '', r.confLosses ?? ''] as (string|number|Node)[]; });
      mount(tblWrap, table(['Team','W','L','Conf W','Conf L'], data));
    }
    const shell = el('div',{class:'container'}, el('h1',{class:'title'},`${BRAND.siteTitle} — Standings`), nav(), controls, section('Standings', tblWrap), footer());
    mount(root, shell);
    renderTable(rows as RowVM[]);
    seasonInput.addEventListener('change', async ()=>{ const season=Number(seasonInput.value)||DEFAULT_SEASON; const newRows=await getStandings(season); renderTable(newRows as RowVM[]); });
    confSel.addEventListener('change', ()=> renderTable(rows as RowVM[]));
  }catch(err){ mount(root, el('pre',{class:'error'}, String(err))); }
}
render();
