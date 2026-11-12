// One entry per HTML page. `skeleton` is static markup that paints before any
// script runs, so every page has its structure on first byte.
export const SITE = {
  name: "Field House",
  tagline: "Men's college hoops, read off the scorer's table",
  url: "https://rhicksrad.github.io/NCAAM/",
};

export const NAV = [
  { href: "index.html", label: "Tonight" },
  { href: "games.html", label: "Scores" },
  { href: "rankings.html", label: "Rankings" },
  { href: "standings.html", label: "Standings" },
  { href: "teams.html", label: "Teams" },
  { href: "players.html", label: "Players" },
  { href: "lab.html", label: "The Lab" },
];

const loading = (label) => `<p class="loading" role="status">${label}</p>`;

export const PAGES = [
  {
    file: "index.html",
    entry: "home",
    title: "Field House — tonight in men's college hoops",
    description: "Live scores, the AP Top 25 and the night's best games in men's college basketball. No paywall, no API key, no nonsense.",
    hero: true,
    skeleton: `
<section class="hero" aria-labelledby="hero-title">
  <div class="hero__copy wrap">
    <p class="hero__date" id="hero-date"></p>
    <h1 class="floor-title" id="hero-title">Tonight</h1>
    <p class="hero__tally" id="hero-tally">Reading the scorer's table…</p>
  </div>
</section>
<div class="wrap home">
  <section class="home__games" aria-labelledby="games-h">
    <header class="section-head">
      <h2 id="games-h">On the floor</h2>
      <div class="segmented" id="home-sort" role="group" aria-label="Order games by"></div>
    </header>
    <div id="home-games" class="tickets">${loading("Loading tonight's slate…")}</div>
  </section>
  <aside class="home__rail">
    <section aria-labelledby="poll-h">
      <header class="section-head"><h2 id="poll-h">In the rafters</h2><a class="more" href="rankings.html">Full poll</a></header>
      <div id="home-poll">${loading("Hanging the banners…")}</div>
    </section>
    <section aria-labelledby="news-h" id="home-news-wrap" hidden>
      <header class="section-head"><h2 id="news-h">Press row</h2></header>
      <ul id="home-news" class="wire"></ul>
    </section>
  </aside>
</div>
<section class="wrap lab-strip" aria-labelledby="lab-h">
  <header class="section-head"><h2 id="lab-h">From the lab</h2><a class="more" href="lab.html">The whole film room</a></header>
  <ol>
    <li><a href="lab.html#chalkboard"><b>01</b><strong>Thirteen winters</strong><span>Every team since 2013 on one chalkboard. Run the tape.</span></a></li>
    <li><a href="lab.html#thin-air"><b>02</b><strong>Thin air</strong><span>Home-court advantage, measured with an altimeter.</span></a></li>
    <li><a href="lab.html#mascots"><b>03</b><strong>Mascot census</strong><span>372 nicknames, sorted into a taxonomy nobody asked for.</span></a></li>
    <li><a href="lab.html#cats-dogs"><b>04</b><strong>Cats v. dogs</strong><span>Ten rivalries, one ledger, nothing settled.</span></a></li>
    <li><a href="lab.html#tallest"><b>05</b><strong>Tall order</strong><span>Every roster by average height. It is closer than you think.</span></a></li>
  </ol>
</section>`,
  },
  {
    file: "games.html",
    entry: "games",
    title: "Scores — Field House",
    description: "Every Division I men's basketball game for any date: live scores, finals, tip times and TV.",
    skeleton: `
<div class="wrap page">
  <header class="page-head">
    <img class="decal" src="./art/icon-stopwatch.webp" alt="" width="160" height="160">
    <h1 class="floor-title">Scores</h1>
    <p class="page-head__sub" id="games-sub">Pick a day. Every Division I game, straight from the table.</p>
  </header>
  <nav class="datestrip" id="datestrip" aria-label="Choose a date"></nav>
  <div class="toolbar" id="games-tools"></div>
  <div id="games-list" class="tickets tickets--wide">${loading("Loading the slate…")}</div>
</div>`,
  },
  {
    file: "game.html",
    entry: "game",
    title: "Game — Field House",
    description: "Box score, game flow and play-by-play.",
    skeleton: `<div class="wrap page" id="game-root">${loading("Pulling the box score…")}</div>`,
  },
  {
    file: "rankings.html",
    entry: "rankings",
    title: "Rankings — Field House",
    description: "The AP Top 25 and Coaches Poll with movement, first-place votes and who is knocking on the door.",
    skeleton: `
<div class="wrap page">
  <header class="page-head">
    <img class="decal" src="./art/icon-trophy.webp" alt="" width="160" height="160">
    <h1 class="floor-title">Rankings</h1>
    <p class="page-head__sub" id="rankings-sub">Who's hanging in the rafters this week.</p>
  </header>
  <div class="toolbar" id="rankings-tools"></div>
  <div id="rankings-root">${loading("Counting ballots…")}</div>
</div>`,
  },
  {
    file: "standings.html",
    entry: "standings",
    title: "Standings — Field House",
    description: "Conference standings for all of Division I men's basketball.",
    skeleton: `
<div class="wrap page">
  <header class="page-head">
    <img class="decal" src="./art/icon-bracket.webp" alt="" width="160" height="160">
    <h1 class="floor-title">Standings</h1>
    <p class="page-head__sub" id="standings-sub">Every conference race, top to bottom.</p>
  </header>
  <div class="toolbar" id="standings-tools"></div>
  <div id="standings-root">${loading("Stacking the standings…")}</div>
</div>`,
  },
  {
    file: "teams.html",
    entry: "teams",
    title: "Teams — Field House",
    description: "All Division I men's basketball programs, searchable, with schedules, rosters and a decade of efficiency history.",
    skeleton: `
<div class="wrap page">
  <header class="page-head">
    <img class="decal" src="./art/icon-jersey.webp" alt="" width="160" height="160">
    <h1 class="floor-title">Teams</h1>
    <p class="page-head__sub" id="teams-sub">Every Division I program. Type to find yours.</p>
  </header>
  <div class="toolbar" id="teams-tools"></div>
  <div id="teams-root">${loading("Rolling out the ball rack…")}</div>
</div>`,
  },
  {
    file: "team.html",
    entry: "team",
    title: "Team — Field House",
    description: "Schedule, roster and program history.",
    skeleton: `<div id="team-root">${`<div class="wrap page">${loading("Opening the locker room…")}</div>`}</div>`,
  },
  {
    file: "players.html",
    entry: "players",
    title: "Players — Field House",
    description: "Division I stat leaders and a searchable index of 4,000+ player stat lines.",
    skeleton: `
<div class="wrap page">
  <header class="page-head">
    <img class="decal" src="./art/icon-sneaker.webp" alt="" width="160" height="160">
    <h1 class="floor-title">Players</h1>
    <p class="page-head__sub" id="players-sub">Stat leaders and every stat line we have on file.</p>
  </header>
  <div class="toolbar" id="players-tools"></div>
  <div id="players-root">${loading("Tallying the stat sheet…")}</div>
</div>`,
  },
  {
    file: "lab.html",
    entry: "lab",
    title: "The Lab — Field House",
    description: "Side projects from the film room: a decade of efficiency in one chart, thin-air arenas, mascot taxonomy and the cats-versus-dogs ledger.",
    skeleton: `
<div class="wrap page">
  <header class="page-head">
    <img class="decal" src="./art/icon-clipboard.webp" alt="" width="160" height="160">
    <h1 class="floor-title">The Lab</h1>
    <p class="page-head__sub">Side projects from the film room. None of this wins games.</p>
  </header>
  <div id="lab-root">${loading("Wheeling in the chalkboard…")}</div>
</div>`,
  },
  {
    file: "about.html",
    entry: "about",
    title: "About — Field House",
    description: "What this site is, where the numbers come from and who made it.",
    skeleton: null, // filled from src/about.html
  },
  {
    file: "404.html",
    entry: "about",
    title: "Air ball — Field House",
    description: "That page isn't here.",
    skeleton: `
<div class="wrap page airball">
  <img class="airball__net" src="./art/net.webp" alt="" width="360" height="360">
  <h1 class="floor-title">Air ball</h1>
  <p class="page-head__sub">Nothing but floor. That page isn't here.</p>
  <p><a class="btn" href="./index.html">Back to tonight's games</a></p>
</div>`,
  },
];
