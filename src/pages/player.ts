import { BRAND } from '../lib/config/ncaam';
import { getPlayer, getGames, getTeams } from '../lib/ncaam/service';
import { el, mount, section, spinner, table } from '../lib/ui/dom';
import { nav, footer } from '../lib/ui/nav';
import { basePath } from '../lib/ui/base';
import { qp } from '../lib/ui/url';
import { fmtYYYYMMDD } from '../lib/ui/date';
import '../../public/styles/site.css';
type GameVM = { id:string; date:string; homeTeamId:string; awayTeamId:string; homeScore?:number; awayScore?:number; status?:string };
function linkTeam(id: string, label: string) {
  const base = basePath();
  return el('a', { href: `${base}team.html?team_id=${encodeURIComponent(id)}` }, label);
}
async function render(){
  const playerId = qp('player_id'); const root = document.getElementById('app')!;
  if(!playerId){ return mount(root, el('div',{class:'container'}, el('h1',{class:'title'},`${BRAND.siteTitle} — Player`), nav(), el('p',{},'Missing player_id'), footer())); }
  mount(root, el('div',{class:'container'}, el('h1',{class:'title'},`${BRAND.siteTitle} — Player`), nav(), spinner()));
  try{
    const player = await getPlayer(playerId);
    const name = `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim();
    let games: GameVM[] = []; let teamName = '';
    let tmap: Map<string, { shortName?: string }> | null = null;
    if (player.teamId) {
      const [gamesRes, teams] = await Promise.all([ getGames({ team_id: player.teamId, per_page: 50 }), getTeams({ per_page: 5000 }) ]);
      games = gamesRes.data as GameVM[];
      tmap = new Map(teams.map(t => [t.id, { shortName: t.shortName }]));
      teamName = tmap.get(player.teamId)?.shortName ?? player.teamId;
    }
    const head = el('div',{class:'section'}, el('h2',{}, name || `Player ${player.id}`),
      el('div',{}, `Player ID: ${player.id}`), el('div',{}, `Position: ${player.position ?? ''}`),
      player.teamId ? el('div',{}, 'Team: ', linkTeam(player.teamId, teamName)) : el('div',{}, 'Team:'),
      el('div',{}, `Class: ${player.classYear ?? ''}`), el('div',{}, `Eligibility: ${player.eligibility ?? ''}`));
    const rows = games.sort((a,b)=> (a.date??'').localeCompare(b.date??'')).reverse().slice(0,15).map(g=> {
      const awayLabel = tmap?.get(g.awayTeamId)?.shortName ?? g.awayTeamId;
      const homeLabel = tmap?.get(g.homeTeamId)?.shortName ?? g.homeTeamId;
      return [fmtYYYYMMDD(g.date), linkTeam(g.awayTeamId, awayLabel), '@', linkTeam(g.homeTeamId, homeLabel), g.awayScore ?? '', g.homeScore ?? '', g.status ?? ''] as (string|number|Node)[];
    });
    const gamesEl = section('Recent Team Games', table(['Date','Away','','Home','Away','Home','Status'], rows));
    const shell = el('div',{class:'container'}, el('h1',{class:'title'},`${BRAND.siteTitle} — Player`), nav(), head, gamesEl, footer());
    mount(root, shell);
  }catch(err){ mount(root, el('pre',{class:'error'}, String(err))); }
}
render();
