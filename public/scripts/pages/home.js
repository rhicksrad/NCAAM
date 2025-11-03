import { BASE } from "../lib/config.js";
import { NCAA_LOGO_ALIASES, NCAA_LOGO_INDEX } from "../lib/data/ncaa-logo-map.js";

const app = document.getElementById("app");
const HEIGHT_SNAPSHOT_PATH = "data/team-height-snapshot.json";
const poll = [
    {
        rank: 1,
        team: "Purdue",
        slug: "purdue-boilermakers",
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
        slug: "houston-cougars",
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
        slug: "florida-gators",
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
        slug: "uconn-huskies",
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
        slug: "st-john-s-red-storm",
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
        slug: "duke-blue-devils",
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
        slug: "michigan-wolverines",
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
        slug: "byu-cougars",
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
        slug: "kentucky-wildcats",
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
        slug: "texas-tech-red-raiders",
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
        slug: "louisville-cardinals",
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
        slug: "ucla-bruins",
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
        slug: "arizona-wildcats",
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
        slug: "arkansas-razorbacks",
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
        slug: "alabama-crimson-tide",
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
        slug: "iowa-state-cyclones",
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
        slug: "illinois-fighting-illini",
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
        slug: "tennessee-volunteers",
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
        slug: "kansas-jayhawks",
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
        slug: "auburn-tigers",
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
        slug: "gonzaga-bulldogs",
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
        slug: "michigan-state-spartans",
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
        slug: "creighton-bluejays",
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
        slug: "wisconsin-badgers",
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
        slug: "north-carolina-tar-heels",
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
const LOGO_BASE = BASE && BASE.length > 1 ? BASE.replace(/\/?$/, "/") : "/";
function resolveLogoEntry(slug) {
    if (!slug)
        return undefined;
    const normalized = String(slug).toLowerCase();
    const direct = NCAA_LOGO_INDEX[normalized];
    if (direct) {
        return direct;
    }
    const alias = NCAA_LOGO_ALIASES?.[normalized];
    if (alias) {
        return NCAA_LOGO_INDEX[alias];
    }
    return undefined;
}
function getPollLogoUrl(entry) {
    const slug = entry.slug ?? entry.logoSlug;
    if (!slug) {
        return undefined;
    }
    const logo = resolveLogoEntry(slug);
    if (!logo) {
        return undefined;
    }
    const trimmedPath = logo.path.replace(/^\/+/, "");
    return `${LOGO_BASE}${trimmedPath}`;
}
function getInitials(team) {
    const matches = team.match(/[A-Za-z]+/g) ?? [];
    const filtered = matches.filter(part => part.length > 1);
    const source = filtered.length > 0 ? filtered : matches;
    if (source.length === 0) {
        return team.slice(0, 3).toUpperCase();
    }
    if (source.length === 1) {
        return source[0].slice(0, 3).toUpperCase();
    }
    return source.map(part => part[0]).join("").slice(0, 3).toUpperCase();
}
const pollItems = poll
    .map(entry => {
    const logoUrl = getPollLogoUrl(entry);
    const logo = logoUrl
        ? `<img class="poll-card__logo-image" src="${logoUrl}" alt="${entry.team} logo" loading="lazy" decoding="async">`
        : `<span class="poll-card__logo-fallback" role="img" aria-label="${entry.team} logo">${getInitials(entry.team)}</span>`;
    const notes = entry.notes
        .map(note => `<div class="poll-card__note"><dt>${note.label}</dt><dd>${note.value}</dd></div>`)
        .join("");
    return `<li>
  <article class="card poll-card" data-card>
    <header class="poll-card__header">
      <span class="badge" data-variant="arc" aria-label="Rank ${entry.rank}">#${entry.rank}</span>
      <div class="poll-card__logo">${logo}</div>
      <div class="poll-card__title"><h3>${entry.team}</h3></div>
    </header>
    <dl class="poll-card__notes">
      ${notes}
    </dl>
  </article>
</li>`;
})
    .join("");
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function hasMeasuredAverage(entry) {
    return typeof entry.average_height_inches === "number" && Number.isFinite(entry.average_height_inches);
}
function formatAverageHeight(inches) {
    if (!Number.isFinite(inches) || inches <= 0) {
        return "—";
    }
    const feet = Math.floor(inches / 12);
    const remainderRaw = Math.round((inches - feet * 12) * 10) / 10;
    const remainder = Number.isFinite(remainderRaw) ? remainderRaw : 0;
    const remainderLabel = Number.isInteger(remainder)
        ? `${Math.trunc(remainder)}`
        : remainder.toFixed(1).replace(/0+$/u, "").replace(/\.$/u, "");
    return `${feet}′ ${remainderLabel}″`;
}
function formatAverageInches(inches) {
    if (!Number.isFinite(inches) || inches <= 0) {
        return "—";
    }
    return `${inches.toFixed(1)} in`;
}
function pluralize(value, singular, plural) {
    return value === 1 ? singular : plural;
}
function renderHeightColumn(title, entries) {
    const items = entries
        .map((entry, index) => {
        if (!hasMeasuredAverage(entry)) {
            return "";
        }
        const rank = index + 1;
        const teamName = escapeHtml(entry.team);
        const abbreviation = entry.abbreviation ? ` <span class="height-card__abbr">${escapeHtml(entry.abbreviation)}</span>` : "";
        const formattedHeight = formatAverageHeight(entry.average_height_inches);
        const formattedInches = formatAverageInches(entry.average_height_inches);
        const sample = `${entry.measured_count} ${pluralize(entry.measured_count, "player", "players")} measured`;
        return `<li class="height-card__item">\n        <span class="height-card__rank">${rank}</span>\n        <div class="height-card__body">\n          <span class="height-card__team">${teamName}${abbreviation}</span>\n          <span class="height-card__meta">${formattedHeight} avg · ${formattedInches} · ${sample}</span>\n        </div>\n      </li>`;
    })
        .filter(Boolean)
        .join("");
    if (!items) {
        return "";
    }
    return `<div class="height-card__column">\n    <h3>${title}</h3>\n    <ol class="height-card__list" role="list">\n      ${items}\n    </ol>\n  </div>`;
}
function formatUpdatedAt(raw) {
    if (!raw)
        return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    }).format(date);
}
function resolveSourceUrl(raw) {
    if (!raw) {
        return "https://ncaam.hicksrch.workers.dev/v1/players/active";
    }
    try {
        const url = new URL(raw, window.location.origin);
        return url.toString();
    }
    catch {
        return "https://ncaam.hicksrch.workers.dev/v1/players/active";
    }
}
function renderHeightSnapshot(contentEl, footerEl, snapshot) {
    const measured = snapshot.teams.filter(hasMeasuredAverage);
    if (measured.length === 0) {
        contentEl.innerHTML = '<p class="height-card__empty">No roster height data is available yet. Check back soon.</p>';
        footerEl.textContent = "";
        return;
    }
    const limit = Math.min(10, measured.length);
    const tallest = measured.slice(0, limit);
    const shortest = measured.slice(-limit).reverse();
    const columns = [
        renderHeightColumn("Tallest rosters", tallest),
        renderHeightColumn("Shortest rosters", shortest),
    ].filter(Boolean);
    contentEl.innerHTML = columns.join("");
    footerEl.textContent = "";
    const meta = document.createElement("small");
    meta.className = "height-card__timestamp";
    const updatedAt = formatUpdatedAt(snapshot.generated_at);
    if (updatedAt) {
        meta.append(`Updated ${updatedAt}`);
    }
    else {
        meta.append("Updated recently");
    }
    const sourceLink = document.createElement("a");
    sourceLink.href = resolveSourceUrl(snapshot.source);
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = "NCAAM worker";
    meta.append(" · Source: ", sourceLink);
    footerEl.append(meta);
}
async function loadHeightSnapshot(contentEl, footerEl) {
    try {
        const response = await fetch(HEIGHT_SNAPSHOT_PATH, {
            headers: { Accept: "application/json" },
        });
        if (!response.ok) {
            throw new Error(`Failed to load roster height snapshot: ${response.status} ${response.statusText}`);
        }
        const payload = (await response.json());
        if (!payload || !Array.isArray(payload.teams)) {
            throw new Error("Roster height snapshot is missing team data.");
        }
        renderHeightSnapshot(contentEl, footerEl, payload);
    }
    catch (error) {
        console.error(error);
        contentEl.innerHTML = '<p class="height-card__error">Unable to load roster height leaders right now.</p>';
        footerEl.textContent = "";
    }
}
app.innerHTML = `
<div class="home-layout">
  <div class="home-layout__main stack" data-gap="lg">
    <section class="card" data-card>
      <h2>Power Poll</h2>
      <p class="page-intro">Weekly snapshot of the top national contenders, how they win, and what we're monitoring next.</p>
    </section>
    <ol class="stack" data-gap="md" style="list-style:none; margin:0; padding:0;" role="list">
      ${pollItems}
    </ol>
  </div>
  <aside class="home-layout__aside">
    <section class="card height-card" data-card>
      <h2>Roster Height Watch</h2>
      <p class="height-card__intro">Average heights for active Division I rosters via the secure NCAAM worker.</p>
      <div class="height-card__lists" id="height-card-content">
        <p class="height-card__loading">Loading roster height leaders…</p>
      </div>
      <footer class="height-card__footer" id="height-card-footer"></footer>
    </section>
  </aside>
</div>`;
const heightCardContent = document.getElementById("height-card-content");
const heightCardFooter = document.getElementById("height-card-footer");
if (heightCardContent instanceof HTMLElement && heightCardFooter instanceof HTMLElement) {
    void loadHeightSnapshot(heightCardContent, heightCardFooter);
}
