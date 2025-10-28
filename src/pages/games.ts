import { BRAND } from '../lib/config/ncaam';
import { getGames, getTeams } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { basePath } from '../lib/ui/base';
import '../../public/styles/site.css';
type TeamVM = { id:string; shortName:string };
function todayISO(): string { const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function linkTeam(id: string, label: string) {
  const base = basePath();
  return el('a', { href: `${base}team.html?team_id=${encodeURIComponent(id)}` }, label);
}
async function render(){
  const root=document.getElementById('app')!;
  mount(root, el('div',{class:'container'}, el('h1',{class:'title'},`${BRAND.siteTitle} — Games`), nav(), spinner()));
  try{
    const teams = await getTeams({ per_page: 5000 });
    const tmap = new Map<string,TeamVM>(teams.map(t=>[t.id,{id:t.id, shortName:t.shortName}]));
    const startInput = el('input',{id:'start',type:'date',value:todayISO()}) as HTMLInputElement;
    const endInput = el('input',{id:'end',type:'date',value:todayISO()}) as HTMLInputElement;
    const teamSel = el('select',{id:'team'}) as HTMLSelectElement; teamSel.appendChild(el('option',{value:''},'All Teams'));
    teams.slice().sort((a,b)=> a.shortName.localeCompare(b.shortName)).forEach(t=> teamSel.appendChild(el('option',{value:t.id},t.shortName)));
    const perSel = el('select',{id:'per'}, el('option',{value:'25'},'25'), el('option',{value:'50',selected:'true'},'50'), el('option',{value:'100'},'100')) as HTMLSelectElement;
    type PagePointer = { cursor?: string; page?: number };
    let history: PagePointer[] = [{}];
    let pointerIndex = 0;
    let pendingNext: PagePointer | undefined;
    const prevBtn = el('button',{id:'prev',disabled:'true'},'Prev') as HTMLButtonElement;
    const nextBtn = el('button',{id:'next'},'Next') as HTMLButtonElement; const pageLbl = el('span',{id:'page'},'Page 1') as HTMLSpanElement;
    const todayBtn = el('button',{id:'today'},'Today') as HTMLButtonElement; const next7Btn = el('button',{id:'next7'},'Next 7 Days') as HTMLButtonElement;
    const controls = el('div',{class:'section controls'}, el('label',{},'Start:'),startInput, el('label',{},'End:'),endInput, el('label',{},'Team:'),teamSel, el('label',{},'Per:'),perSel, prevBtn, nextBtn, pageLbl, todayBtn, next7Btn);
    const tblWrap = el('div',{});
    function renderTable(rows:any[]){
      const data = rows.map(g=>{ const away=tmap.get(g.awayTeamId)?.shortName ?? g.awayTeamId; const home=tmap.get(g.homeTeamId)?.shortName ?? g.homeTeamId;
        return [(g.date??'').slice(0,10), linkTeam(g.awayTeamId, away), '@', linkTeam(g.homeTeamId, home), g.awayScore ?? '', g.homeScore ?? '', g.status ?? ''] as (string|number|Node)[]; });
      mount(tblWrap, table(['Date','Away','','Home','Away','Home','Status'], data));
    }
    const shell = el('div',{class:'container'}, el('h1',{class:'title'},`${BRAND.siteTitle} — Games`), nav(), controls, section('Schedule', tblWrap), footer());
    mount(root, shell);
    function resetPaging(){
      history = [{}];
      pointerIndex = 0;
      pendingNext = undefined;
      pageLbl.textContent = 'Page 1';
    }
    async function load(){
      const start_date=startInput.value || todayISO();
      const end_date=endInput.value || start_date;
      const team_id = teamSel.value || undefined;
      const per_page = Number(perSel.value);
      const pointer = history[pointerIndex] ?? {};
      const params: Record<string, string | number> = { start_date, end_date, per_page };
      if (team_id) params.team_id = team_id as any;
      if (pointer.cursor) params.cursor = pointer.cursor;
      else if (pointer.page && pointer.page > 1) params.page = pointer.page;
      pageLbl.textContent = `Page ${pointerIndex + 1}`;
      prevBtn.disabled = pointerIndex === 0;
      const res = await getGames(params);
      renderTable(res.data);
      const hasNextCursor = res.nextCursor !== undefined && res.nextCursor !== '';
      const hasNextPage = typeof res.nextPage === 'number' && Number.isFinite(res.nextPage);
      pendingNext = hasNextCursor ? { cursor: res.nextCursor } : (hasNextPage ? { page: res.nextPage } : undefined);
      nextBtn.disabled = !pendingNext;
    }
    startInput.addEventListener('change',()=>{ resetPaging(); void load(); });
    endInput.addEventListener('change',()=>{ resetPaging(); void load(); });
    teamSel.addEventListener('change',()=>{ resetPaging(); void load(); });
    perSel.addEventListener('change',()=>{ resetPaging(); void load(); });
    prevBtn.addEventListener('click',()=>{
      if(pointerIndex>0){
        pointerIndex -= 1;
        pendingNext = undefined;
        void load();
      }
    });
    nextBtn.addEventListener('click',()=>{
      if(!pendingNext) return;
      history = history.slice(0, pointerIndex + 1);
      history.push(pendingNext);
      pointerIndex += 1;
      pendingNext = undefined;
      void load();
    });
    todayBtn.addEventListener('click',()=>{ const t=todayISO(); startInput.value=t; endInput.value=t; resetPaging(); void load(); });
    next7Btn.addEventListener('click',()=>{ const t=new Date(); const start=todayISO(); const t2=new Date(t.getFullYear(),t.getMonth(),t.getDate()+7);
      const end = `${t2.getFullYear()}-${String(t2.getMonth()+1).padStart(2,'0')}-${String(t2.getDate()).padStart(2,'0')}`; startInput.value=start; endInput.value=end; resetPaging(); void load(); });
    await load();
  }catch(err){ mount(root, el('pre',{class:'error'}, String(err))); }
}
render();
