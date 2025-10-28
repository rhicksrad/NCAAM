import { BRAND } from '../lib/config/ncaam';
import { getPlayer, getGames, getTeams } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { qp } from '../lib/ui/url';
import { fmtYYYYMMDD } from '../lib/ui/date';
import '../../public/styles/site.css';
type PlayerVM = { id:string; firstName:string; lastName:string; position?:string; teamId?:string; classYear?:string; eligibility?:string };
type GameVM = { id:string; date:string; homeTeamId:string; awayTeamId:string; homeScore?:number; awayScore?:number; status?:string };
function linkTeam(id:string,label:string){ return el('a',{ href:`/team.html?team_id=${encodeURIComponent(id)}` },label); }
async function render(){
  const playerId = qp('player_id'); const root = document.getElementById('app')!;
  if(!playerId){ return mount(root, el('div',{class:'container'}, el('h1',{class:'title'},`${BRAND.siteTitle} — Player`), nav(), el('p',{},'Missing player_id'), footer())); }
  mount(root, el('div',{class:'container'}, el('h1',{class:'title'},`${BRAND.siteTitle} — Player`), nav(), spinner()));
  try{
    const player = await getPlayer(playerId);
    const name = `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
    let games: GameVM[] = []; let teamName = '';
    if (player.teamId) {
      const [gamesRes, teams] = await Promise.all([ getGames({ team_id: player.teamId, per_page: 50 }), getTeams({ per_page: 5000 }) ]);
      games = gamesRes.data as GameVM[]; const tmap = new Map(teams.map(t=>[t.id,t])); teamName = tmap.get(player.teamId)?.shortName ?? player.teamId;
    }
    const head = el('div',{class:'section'}, el('h2',{}, name || `Player ${player.id}`),
      el('div',{}, `Player ID: ${player.id}`), el('div',{}, `Position: ${player.position ?? ''}`),
      el('div',{}, player.teamId ? ['Team: ', linkTeam(player.teamId, teamName)] : 'Team:'), el('div',{}, `Class: ${player.classYear ?? ''}`), el('div',{}, `Eligibility: ${player.eligibility ?? ''}`));
    const rows = games.sort((a,b)=> (a.date??'').localeCompare(b.date??'')).reverse().slice(0,15).map(g=> [fmtYYYYMMDD(g.date), linkTeam(g.awayTeamId,g.awayTeamId), '@', linkTeam(g.homeTeamId,g.homeTeamId), g.awayScore ?? '', g.homeScore ?? '', g.status ?? ''] as (string|number|Node)[]);
    const gamesEl = section('Recent Team Games', table(['Date','Away','','Home','Away','Home','Status'], rows));
    const shell = el('div',{class:'container'}, el('h1',{class:'title'},`${BRAND.siteTitle} — Player`), nav(), head, gamesEl, footer());
    mount(root, shell);
  }catch(err){ mount(root, el('pre',{class:'error'}, String(err))); }
}
render();
