"use strict";
const app = document.getElementById("app");
app.innerHTML = `
<section class="card"><h1>NCAAM Hub</h1><p>Select a section from the nav.</p></section>
<section class="grid cols-3">
  <div class="card"><h3>Teams</h3><p>All programs.</p><a class="badge" href="./teams.html">Open</a></div>
  <div class="card"><h3>Players</h3><p>Roster search.</p><a class="badge" href="./players.html">Open</a></div>
  <div class="card"><h3>Games</h3><p>Recent & upcoming.</p><a class="badge" href="./games.html">Open</a></div>
  <div class="card"><h3>Rankings</h3><p>Simple Elo Top-25.</p><a class="badge" href="./rankings.html">Open</a></div>
  <div class="card"><h3>Standings</h3><p>By conference.</p><a class="badge" href="./standings.html">Open</a></div>
  <div class="card"><h3>Diag</h3><p>Connectivity.</p><a class="badge" href="./diag.html">Open</a></div>
</section>`;
