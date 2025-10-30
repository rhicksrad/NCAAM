const app = document.getElementById("app")!;
app.innerHTML = `
<section class="card" data-card>
  <h2>Inside the hub</h2>
  <p class="page-intro">Quick links to the sections our editors keep updating throughout the season.</p>
</section>
<section class="grid cols-3">
  <article class="card" data-card><h3>Teams</h3><p>Visual identities, monograms, and conference context.</p><a class="badge" data-variant="arc" href="./teams.html">Open</a></article>
  <article class="card" data-card><h3>Players</h3><p>Scan every rotation with sortable cards and season vitals.</p><a class="badge" data-variant="arc" href="./players.html">Open</a></article>
  <article class="card" data-card><h3>Games</h3><p>Daily ledger of results, tempos, and strength of schedule notes.</p><a class="badge" data-variant="arc" href="./games.html">Open</a></article>
  <article class="card" data-card><h3>Rankings</h3><p>Polls and power metrics side by side for national movers.</p><a class="badge" data-variant="arc" href="./rankings.html">Open</a></article>
  <article class="card" data-card><h3>Standings</h3><p>Conference tables with streaks and record splits.</p><a class="badge" data-variant="arc" href="./standings.html">Open</a></article>
</section>`;
