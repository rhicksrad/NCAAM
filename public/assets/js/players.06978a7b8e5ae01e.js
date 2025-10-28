var W=new URL("./data/rosters.json",document.baseURI).toString();async function X(){let u=await fetch(W,{cache:"no-store"});if(!u.ok)throw new Error(`Request failed with status ${u.status}`);return await u.json()}var y=document.getElementById("players-app");if(!y)throw new Error("Missing #players-app container");var Z=y.querySelector("[data-player-profile]")!==null,q,O;if(Z)y.dataset.legacyRosterSuppressed="true";else{let p=function(e){return e.replace(/[&<>"']/g,t=>{switch(t){case"&":return"&amp;";case"<":return"&lt;";case">":return"&gt;";case'"':return"&quot;";case"'":return"&#39;";default:return t}})},v=function(e){let t=Date.parse(e);if(Number.isNaN(t))return e;let s=Date.now(),a=Math.round((t-s)/1e3),o=[{amount:60,unit:"second"},{amount:60,unit:"minute"},{amount:24,unit:"hour"},{amount:7,unit:"day"},{amount:4.34524,unit:"week"},{amount:12,unit:"month"},{amount:Number.POSITIVE_INFINITY,unit:"year"}],l=new Intl.RelativeTimeFormat("en",{numeric:"auto"}),i=a;for(let m of o){if(Math.abs(i)<m.amount)return l.format(Math.round(i),m.unit);i/=m.amount}return l.format(Math.round(i),"year")},$=function(e,t){if(!t)return!0;let s=t.toLowerCase(),a=e.name.toLowerCase(),o=e.jersey?`#${e.jersey}`.toLowerCase():"";return a.includes(s)||o.includes(s)},b=function(e){let t=new URL(window.location.href);Object.entries(e).forEach(([s,a])=>{a&&a.length?t.searchParams.set(s,a):t.searchParams.delete(s)}),window.history.replaceState({},"",t.toString())},T=function(e){var s;let t=(s=e.source)==null?void 0:s.trim().toLowerCase();return t==="ball_dont_lie"?"Primary league data feed":t==="manual_roster_reference"?"Manual roster reference":e.source&&e.source.trim().length?e.source.trim():"Unknown"},L=function(e){var s;let t=(s=e.season)==null?void 0:s.trim();if(t)return t;if(typeof e.season_start_year=="number"&&Number.isFinite(e.season_start_year)){let a=e.season_start_year,o=String(a+1).slice(-2);return`${a}-${o}`}return"2025-26"},A=function(e){return e.abbr==="FA"?"Free agents":e.name||e.abbr},S=function(e,t){return e==="FA"&&t!=="FA"?1:t==="FA"&&e!=="FA"?-1:e.localeCompare(t)},j=function(e,t){var o,l,i,m,h,g;let s=((o=e.abbreviation)==null?void 0:o.trim().toUpperCase())||"FA",a=((l=e.full_name)==null?void 0:l.trim())||s;return{id:t.id,name:`${t.first_name} ${t.last_name}`.trim(),team_abbr:s,team_name:a,position:(i=t.position)!=null?i:null,jersey:(m=t.jersey_number)!=null?m:null,height:(h=t.height)!=null?h:null,weight:(g=t.weight)!=null?g:null}},F=function(e){var s,a;let t=[];for(let o of Array.isArray(e.teams)?e.teams:[]){let l=((s=o.abbreviation)==null?void 0:s.trim().toUpperCase())||"FA",i=((a=o.full_name)==null?void 0:a.trim())||l,m=(Array.isArray(o.roster)?o.roster:[]).map(h=>j(o,h)).sort((h,g)=>h.name.localeCompare(g.name));t.push({abbr:l,name:i,players:m})}return t.sort((o,l)=>S(o.abbr,l.abbr))},E=function(){u.innerHTML=`
    <div class="roster-status">
      <p>Loading active rosters\u2026</p>
    </div>
  `},M=function(e){u.innerHTML=`
    <div class="roster-status roster-status--error">
      <p>${p(e)}</p>
      <button type="button" class="roster-button" data-roster-retry>Retry</button>
    </div>
  `;let t=u.querySelector("[data-roster-retry]");t&&t.addEventListener("click",()=>_())},I=function(e){let t=F(e),s=r.teamFilter;s&&!t.some(n=>n.abbr===s)&&(r.teamFilter="",b({team:null}));let a=r.teamFilter,o=t.filter(n=>!a||n.abbr===a),l=["",...t.map(n=>n.abbr)],i=t.length>0,m=i?v(e.fetched_at):"not yet available",h=i?new Date(e.fetched_at).toLocaleString():"No roster snapshot cached yet",g=T(e),x=L(e),Y=[`Last updated: ${m}`,`Source: ${p(g)}`,`Season: ${p(x)}`],z=`
    <div class="roster-controls">
      <div class="roster-controls__filters">
        <label class="roster-controls__field">
          <span class="roster-controls__label">Search</span>
          <input
            id="roster-search"
            class="roster-input"
            type="search"
            placeholder="Search by name or jersey"
            value="${p(r.searchTerm)}"
            autocomplete="off"
          />
        </label>
        <label class="roster-controls__field">
          <span class="roster-controls__label">Team</span>
          <select id="roster-team" class="roster-select">
            ${l.map(n=>{let c=n||"All teams",N=n===a?"selected":"";return`<option value="${n}">${c}</option>`}).join("")}
          </select>
        </label>
      </div>
      <div class="roster-controls__meta">
        <small title="${h}">
          ${Y.join(" \u2022 ")}
        </small>
        <button type="button" class="roster-button" data-roster-refresh>Refresh</button>
      </div>
    </div>
  `,G=o.map(n=>{let c=n.players.filter(d=>$(d,r.searchTerm)),N=c.map(d=>{var B,k;let Q=d.jersey?`#${d.jersey}`:"",C=[(B=d.position)!=null?B:"",Q].filter(Boolean).join(" \xB7 "),H=[(k=d.height)!=null?k:"",d.weight?`${d.weight} lbs`:""].filter(Boolean).join(" \u2022 ");return`
            <li class="roster-player">
              <span class="roster-player__name">${p(d.name)}</span>
              ${C?`<span class="roster-player__role">${p(C)}</span>`:""}
              ${H?`<span class="roster-player__meta">${p(H)}</span>`:""}
            </li>
          `}).join(""),J=c.length?"":'<li class="roster-player roster-player--empty">No players match this filter.</li>',K=`${p(A(n))} \xB7 ${c.length} players`;return`
        <section class="roster-team" data-team-anchor="${n.abbr}">
          <header class="roster-team__header">
            <h3 id="team-${n.abbr}">${n.abbr}</h3>
            <p>${K}</p>
          </header>
          <ul class="roster-list">
            ${N||J}
          </ul>
        </section>
      `}).join(""),w="";i?o.length||(w='<div class="roster-status roster-status--empty"><p>No teams match the current filter.</p></div>'):w='<div class="roster-status roster-status--empty"><p>Rosters are not cached yet. Use Refresh to try again.</p></div>',u.innerHTML=`${z}<div class="roster-teams">${G}${w}</div>`;let P=document.getElementById("roster-search"),U=document.getElementById("roster-team"),D=u.querySelector("[data-roster-refresh]");if(P&&P.addEventListener("input",n=>{let c=n.target.value;r.searchTerm=c,b({search:c}),f()}),U&&U.addEventListener("change",n=>{let c=n.target.value.toUpperCase();r.teamFilter=c,r.anchorApplied=!c,b({team:c}),f()}),D&&D.addEventListener("click",()=>_()),!r.anchorApplied&&r.teamFilter){let n=u.querySelector(`[data-team-anchor="${r.teamFilter}"]`);n&&(n.scrollIntoView({behavior:"smooth",block:"start"}),r.anchorApplied=!0)}},f=function(){if(r.loading){E();return}if(r.error){M(r.error);return}r.doc&&I(r.doc)};ee=p,te=v,re=$,se=b,ne=T,ae=L,oe=A,ie=S,le=j,ce=F,ue=E,me=M,pe=I,de=f;let u=y,R=new URLSearchParams(window.location.search),V=((q=R.get("team"))!=null?q:"").toUpperCase(),r={doc:null,loading:!0,error:null,searchTerm:(O=R.get("search"))!=null?O:"",teamFilter:V,anchorApplied:!1};async function _(){r.loading=!0,r.error=null,f();try{let e=await X();if(!e||!Array.isArray(e.teams))throw new Error("Malformed roster payload");r.doc=e,r.loading=!1,f()}catch(e){r.loading=!1,r.error=e instanceof Error?e.message:"Unable to load players.",f()}}_()}var ee,te,re,se,ne,ae,oe,ie,le,ce,ue,me,pe,de;
