const app = document.getElementById("app")!;

type PollNote = {
  label: string;
  value: string;
};

type PollEntry = {
  rank: number;
  team: string;
  logo?: string;
  notes: PollNote[];
};

const poll: PollEntry[] = [
  {
    rank: 1,
    team: "Purdue",
    logo: "assets/logos/ncaa/Purdue_Boilermakers_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "continuity, elite half-court execution, high assist rate, deliberate pace.",
      },
      {
        label: "Path to 1-seed",
        value: "own the glass, limit live-ball turnovers, schedule has few landmines before league play.",
      },
      {
        label: "Watch metric",
        value: "top-5 offensive efficiency with FT rate edge.",
      },
    ],
  },
  {
    rank: 2,
    team: "Houston",
    logo: "assets/logos/ncaa/Houston_Cougars_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "top-3 defense again, turnover creation, guards who pressure and finish.",
      },
      {
        label: "Path to 1-seed",
        value: "transition points off steals, late-clock offense improvement.",
      },
      {
        label: "Watch metric",
        value: "opponent eFG% and TO% both top-10.",
      },
    ],
  },
  {
    rank: 3,
    team: "Florida",
    logo: "assets/logos/ncaa/Florida_Gators_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "champion’s shot profile carries over: rim + corner 3s, deep rotation.",
      },
      {
        label: "Path to repeat",
        value: "defensive rebounding vs power bigs, foul avoidance.",
      },
      {
        label: "Watch metric",
        value: "ORtg stays top-10 without slippage in D-glass.",
      },
    ],
  },
  {
    rank: 4,
    team: "UConn",
    logo: "assets/logos/ncaa/Connecticut_Huskies_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "disciplined defense, set-piece mastery, NBA-size wings.",
      },
      {
        label: "Path to April",
        value: "early chemistry, bench scoring.",
      },
      {
        label: "Watch metric",
        value: "half-court PPP vs ranked teams.",
      },
    ],
  },
  {
    rank: 5,
    team: "St. John’s",
    notes: [
      {
        label: "Identity",
        value: "physicality, switchable 2-4, garden-variety chaos into easy buckets.",
      },
      {
        label: "Path to top line",
        value: "shot selection vs zones, late-game composure.",
      },
      {
        label: "Watch metric",
        value: "FT attempt rate vs Big East heavies.",
      },
    ],
  },
  {
    rank: 6,
    team: "Duke",
    logo: "assets/logos/ncaa/Duke_Blue_Devils_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "shot-creation at 1/3, rim protection enough to stay aggressive on the perimeter.",
      },
      {
        label: "Path to 1-seed",
        value: "defensive rebounding, reduce midrange drift.",
      },
      {
        label: "Watch metric",
        value: "3PA rate without losing paint touches.",
      },
    ],
  },
  {
    rank: 7,
    team: "Michigan",
    logo: "assets/logos/ncaa/Michigan_Wolverines_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "balanced, inside-out offense, sturdy defensive shell.",
      },
      {
        label: "Path to second weekend floor",
        value: "turnover margin vs pressure teams.",
      },
      {
        label: "Watch metric",
        value: "post-touch efficiency and kick-out 3s.",
      },
    ],
  },
  {
    rank: 8,
    team: "BYU",
    logo: "assets/logos/ncaa/BYU_Cougars_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "spacing, shooting depth, motion into flare actions.",
      },
      {
        label: "Path to top-10",
        value: "defensive rebounding travel-proof.",
      },
      {
        label: "Watch metric",
        value: "3P rate versus top-25 defenses.",
      },
    ],
  },
  {
    rank: 9,
    team: "Kentucky",
    logo: "assets/logos/ncaa/Kentucky_Wildcats_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "pace, athletes everywhere, rim pressure.",
      },
      {
        label: "Path to March",
        value: "experience curve on defense; keep TOs sub-17%.",
      },
      {
        label: "Watch metric",
        value: "early pick-and-roll coverage consistency.",
      },
    ],
  },
  {
    rank: 10,
    team: "Texas Tech",
    logo: "assets/logos/ncaa/Texas_Tech_Red_Raiders_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "connected defense, low-mistake offense.",
      },
      {
        label: "Path to top-8 seed",
        value: "free throws created by wings.",
      },
      {
        label: "Watch metric",
        value: "opponent 3P volume suppression.",
      },
    ],
  },
  {
    rank: 11,
    team: "Louisville",
    logo: "assets/logos/ncaa/Louisville_Cardinals_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "size, mid-post scoring options, slotted roles.",
      },
      {
        label: "Path to rise",
        value: "perimeter defense vs spread attacks.",
      },
      {
        label: "Watch metric",
        value: "foul rate of primary bigs.",
      },
    ],
  },
  {
    rank: 12,
    team: "UCLA",
    logo: "assets/logos/ncaa/UCLA_Bruins_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "compact defense, controlled pace, surgical sets.",
      },
      {
        label: "Path to top-16",
        value: "find reliable secondary creator.",
      },
      {
        label: "Watch metric",
        value: "assist rate in late-clock possessions.",
      },
    ],
  },
  {
    rank: 13,
    team: "Arizona",
    logo: "assets/logos/ncaa/Arizona_Wildcats_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "tempo and early offense, stretch-bigs trailing for threes.",
      },
      {
        label: "Path to top-10",
        value: "half-court stops; avoid whistle-heavy games.",
      },
      {
        label: "Watch metric",
        value: "transition PPP vs top-50.",
      },
    ],
  },
  {
    rank: 14,
    team: "Arkansas",
    logo: "assets/logos/ncaa/Arkansas_Razorbacks_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "downhill guards, offensive boards, free throws.",
      },
      {
        label: "Path to second weekend",
        value: "spacing around slashing.",
      },
      {
        label: "Watch metric",
        value: "lineup 3-point gravity.",
      },
    ],
  },
  {
    rank: 15,
    team: "Alabama",
    logo: "assets/logos/ncaa/Alabama_Crimson_Tide_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "math problem team: rim/3s, massive pace.",
      },
      {
        label: "Path to elite",
        value: "defensive volatility control.",
      },
      {
        label: "Watch metric",
        value: "opponent rim attempts allowed.",
      },
    ],
  },
  {
    rank: 16,
    team: "Iowa State",
    logo: "assets/logos/ncaa/Iowa_State_Cyclones_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "turnover factory, disciplined close-outs.",
      },
      {
        label: "Path to top-12",
        value: "half-court creation in tight games.",
      },
      {
        label: "Watch metric",
        value: "live-ball TO rate vs ranked guards.",
      },
    ],
  },
  {
    rank: 17,
    team: "Illinois",
    logo: "assets/logos/ncaa/Illinois_Fighting_Illini_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "veteran shot makers, strong defensive rebounding.",
      },
      {
        label: "Path to protected seed",
        value: "guard the arc better.",
      },
      {
        label: "Watch metric",
        value: "opp 3P% regression and contest rate.",
      },
    ],
  },
  {
    rank: 18,
    team: "Tennessee",
    logo: "assets/logos/ncaa/Tennessee_Volunteers_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "defense travels; switch, contest, rebound.",
      },
      {
        label: "Path to jump",
        value: "free-throw economy for the offense.",
      },
      {
        label: "Watch metric",
        value: "FT rate generated by guards.",
      },
    ],
  },
  {
    rank: 19,
    team: "Kansas",
    logo: "assets/logos/ncaa/Kansas_Jayhawks_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "structure, two-way wings, high-IQ sets.",
      },
      {
        label: "Path to rebound year",
        value: "reliable spacing from 2-3 bench pieces.",
      },
      {
        label: "Watch metric",
        value: "corner-3 frequency.",
      },
    ],
  },
  {
    rank: 20,
    team: "Auburn",
    logo: "assets/logos/ncaa/Auburn_Tigers_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "rim protection and vertical spacing.",
      },
      {
        label: "Path to top-10",
        value: "turnover avoidance at pace.",
      },
      {
        label: "Watch metric",
        value: "block rate without foul spikes.",
      },
    ],
  },
  {
    rank: 21,
    team: "Gonzaga",
    notes: [
      {
        label: "Identity",
        value: "continuity offense, inside-out reads.",
      },
      {
        label: "Path to climb",
        value: "athleticism at the point of attack on D.",
      },
      {
        label: "Watch metric",
        value: "opponent rim FG%.",
      },
    ],
  },
  {
    rank: 22,
    team: "Michigan State",
    logo: "assets/logos/ncaa/Michigan_State_Spartans_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "defensive spine, rebounding culture, veteran backcourt.",
      },
      {
        label: "Path to second weekend",
        value: "dependable late-clock creator.",
      },
      {
        label: "Watch metric",
        value: "mid-range efficiency in clutch time.",
      },
    ],
  },
  {
    rank: 23,
    team: "Creighton",
    notes: [
      {
        label: "Identity",
        value: "spacing, ball security, five-man skill.",
      },
      {
        label: "Path to rise",
        value: "bench minutes that hold serve.",
      },
      {
        label: "Watch metric",
        value: "non-starter net rating.",
      },
    ],
  },
  {
    rank: 24,
    team: "Wisconsin",
    logo: "assets/logos/ncaa/Wisconsin_Badgers_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "slowdown, shot quality, defensive positioning.",
      },
      {
        label: "Path to upset line",
        value: "maintain low foul rate vs drivers.",
      },
      {
        label: "Watch metric",
        value: "opponent FT rate in Big Ten play.",
      },
    ],
  },
  {
    rank: 25,
    team: "North Carolina",
    logo: "assets/logos/ncaa/North_Carolina_Tar_Heels_logo-300x300.png",
    notes: [
      {
        label: "Identity",
        value: "tempo toggling, secondary break, defensive glass.",
      },
      {
        label: "Path to top-15",
        value: "three-point volume without shot selection tax.",
      },
      {
        label: "Watch metric",
        value: "3PA share and turnover rate trend.",
      },
    ],
  },
];

function getInitials(team: string) {
  const matches = team.match(/[A-Za-z]+/g) ?? [];
  const filtered = matches.filter(part => part.length > 1);
  const source = filtered.length > 0 ? filtered : matches;
  if (source.length === 0) {
    return team.slice(0, 3).toUpperCase();
  }
  if (source.length === 1) {
    return source[0]!.slice(0, 3).toUpperCase();
  }
  return source.map(part => part[0]!).join("").slice(0, 3).toUpperCase();
}

const pollItems = poll
  .map(entry => {
    const logo = entry.logo
      ? `<img src="${entry.logo}" alt="${entry.team} logo" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:contain;">`
      : `<span role="img" aria-label="${entry.team} logo" style="font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">${getInitials(entry.team)}</span>`;

    const notes = entry.notes
      .map(note => `<div class="team-card__meta"><strong>${note.label}:</strong> ${note.value}</div>`)
      .join("");

    return `<li>
  <article class="card poll-card" data-card>
    <div class="stack" data-gap="sm">
      <div class="roster-team__identity">
        <span class="badge" data-variant="arc" aria-label="Rank ${entry.rank}">#${entry.rank}</span>
        <div class="team-card__logo">${logo}</div>
        <div class="roster-team__text">
          <h3>${entry.team}</h3>
          <div class="stack" data-gap="sm">
            ${notes}
          </div>
        </div>
      </div>
    </div>
  </article>
</li>`;
  })
  .join("");

app.innerHTML = `
<section class="card" data-card>
  <h2>Power Poll</h2>
  <p class="page-intro">Weekly snapshot of the top national contenders, how they win, and what we're monitoring next.</p>
</section>
<ol class="stack" data-gap="lg" style="list-style:none; margin:0; padding:0;" role="list">
  ${pollItems}
</ol>`;
