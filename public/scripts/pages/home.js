import { buildTeamKeys } from "../lib/data/program-keys.js";
import { getDivisionOneProgramIndex } from "../lib/data/division-one.js";
import { NCAAM } from "../lib/sdk/ncaam.js";
import { getTeamLogoUrl, getTeamMonogram } from "../lib/ui/logos.js";
const app = document.getElementById("app");
const HEIGHT_SNAPSHOT_PATH = "data/team-height-snapshot.json";
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function createPollTeam(entry) {
    const program = entry.program;
    const fullName = program.full_name.trim();
    const fallbackName = program.name ?? entry.team;
    const college = program.college ?? entry.team;
    return {
        id: program.id,
        full_name: fullName,
        name: fallbackName,
        abbreviation: program.abbreviation ?? undefined,
        college,
        conference: program.conference ?? undefined,
    };
}
function renderPollLogo(entry) {
    const team = createPollTeam(entry);
    const alt = escapeHtml(`${team.full_name} logo`);
    const logoUrl = getTeamLogoUrl(team);
    if (logoUrl) {
        return `<img class="poll-card__logo-image" src="${logoUrl}" alt="${alt}" loading="lazy" decoding="async">`;
    }
    const monogram = escapeHtml(getTeamMonogram(team));
    return `<span class="poll-card__logo-fallback" role="img" aria-label="${alt}">${monogram}</span>`;
}
function createSnapshotTeam(entry) {
    const label = entry.team?.trim() ?? "";
    const fullName = label || `Team ${entry.team_id}`;
    return {
        id: entry.team_id,
        full_name: fullName,
        name: fullName,
        abbreviation: entry.abbreviation ?? undefined,
        conference: entry.conference ?? undefined,
        college: fullName,
    };
}
function renderHeightLogo(entry) {
    const team = createSnapshotTeam(entry);
    const alt = escapeHtml(`${team.full_name} logo`);
    const logoUrl = getTeamLogoUrl(team);
    if (logoUrl) {
        return `<img class="height-card__logo-image" src="${logoUrl}" alt="${alt}" loading="lazy" decoding="async">`;
    }
    const monogram = escapeHtml(getTeamMonogram(team));
    return `<span class="height-card__logo-fallback" role="img" aria-label="${alt}">${monogram}</span>`;
}
const poll = [
    {
        rank: 1,
        team: "Purdue",
        program: {
            id: 125,
            full_name: "Purdue Boilermakers",
            name: "Boilermakers",
            abbreviation: "PUR",
            college: "Purdue",
        },
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
        program: {
            id: 73,
            full_name: "Houston Cougars",
            name: "Cougars",
            abbreviation: "HOU",
            college: "Houston",
        },
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
        program: {
            id: 277,
            full_name: "Florida Gators",
            name: "Gators",
            abbreviation: "FLA",
            college: "Florida",
        },
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
        program: {
            id: 91,
            full_name: "UConn Huskies",
            name: "Huskies",
            abbreviation: "CONN",
            college: "UConn",
        },
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
        team: "St. John's",
        program: {
            id: 90,
            full_name: "St. John's Red Storm",
            name: "Red Storm",
            abbreviation: "SJU",
            college: "St. John's",
        },
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
        program: {
            id: 4,
            full_name: "Duke Blue Devils",
            name: "Blue Devils",
            abbreviation: "DUKE",
            college: "Duke",
        },
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
        program: {
            id: 118,
            full_name: "Michigan Wolverines",
            name: "Wolverines",
            abbreviation: "MICH",
            college: "Michigan",
        },
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
        program: {
            id: 69,
            full_name: "BYU Cougars",
            name: "Cougars",
            abbreviation: "BYU",
            college: "BYU",
        },
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
        program: {
            id: 279,
            full_name: "Kentucky Wildcats",
            name: "Wildcats",
            abbreviation: "UK",
            college: "Kentucky",
        },
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
        program: {
            id: 79,
            full_name: "Texas Tech Red Raiders",
            name: "Red Raiders",
            abbreviation: "TTU",
            college: "Texas Tech",
        },
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
        program: {
            id: 7,
            full_name: "Louisville Cardinals",
            name: "Cardinals",
            abbreviation: "LOU",
            college: "Louisville",
        },
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
        program: {
            id: 127,
            full_name: "UCLA Bruins",
            name: "Bruins",
            abbreviation: "UCLA",
            college: "UCLA",
        },
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
        program: {
            id: 68,
            full_name: "Arizona Wildcats",
            name: "Wildcats",
            abbreviation: "ARIZ",
            college: "Arizona",
        },
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
        program: {
            id: 275,
            full_name: "Arkansas Razorbacks",
            name: "Razorbacks",
            abbreviation: "ARK",
            college: "Arkansas",
        },
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
        program: {
            id: 274,
            full_name: "Alabama Crimson Tide",
            name: "Crimson Tide",
            abbreviation: "ALA",
            college: "Alabama",
        },
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
        program: {
            id: 74,
            full_name: "Iowa State Cyclones",
            name: "Cyclones",
            abbreviation: "ISU",
            college: "Iowa State",
        },
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
        program: {
            id: 113,
            full_name: "Illinois Fighting Illini",
            name: "Fighting Illini",
            abbreviation: "ILL",
            college: "Illinois",
        },
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
        program: {
            id: 286,
            full_name: "Tennessee Volunteers",
            name: "Volunteers",
            abbreviation: "TENN",
            college: "Tennessee",
        },
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
        program: {
            id: 75,
            full_name: "Kansas Jayhawks",
            name: "Jayhawks",
            abbreviation: "KU",
            college: "Kansas",
        },
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
        program: {
            id: 276,
            full_name: "Auburn Tigers",
            name: "Tigers",
            abbreviation: "AUB",
            college: "Auburn",
        },
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
        program: {
            id: 354,
            full_name: "Gonzaga Bulldogs",
            name: "Bulldogs",
            abbreviation: "GONZ",
            college: "Gonzaga",
        },
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
        program: {
            id: 117,
            full_name: "Michigan State Spartans",
            name: "Spartans",
            abbreviation: "MSU",
            college: "Michigan State",
        },
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
        program: {
            id: 84,
            full_name: "Creighton Bluejays",
            name: "Bluejays",
            abbreviation: "CREI",
            college: "Creighton",
        },
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
        program: {
            id: 130,
            full_name: "Wisconsin Badgers",
            name: "Badgers",
            abbreviation: "WIS",
            college: "Wisconsin",
        },
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
        program: {
            id: 10,
            full_name: "North Carolina Tar Heels",
            name: "Tar Heels",
            abbreviation: "UNC",
            college: "North Carolina",
        },
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
const pollItems = poll
    .map(entry => {
    const logo = renderPollLogo(entry);
    const notes = entry.notes
        .map(note => {
        const label = escapeHtml(note.label);
        const value = escapeHtml(note.value);
        return `<div class="poll-card__note"><dt>${label}</dt><dd>${value}</dd></div>`;
    })
        .join("");
    const teamName = escapeHtml(entry.team);
    return `<li>
  <article class="card poll-card" data-card>
    <header class="poll-card__header">
      <span class="badge" data-variant="arc" aria-label="Rank ${entry.rank}">#${entry.rank}</span>
      <div class="poll-card__logo">${logo}</div>
      <div class="poll-card__title"><h3>${teamName}</h3></div>
    </header>
    <dl class="poll-card__notes">
      ${notes}
    </dl>
  </article>
</li>`;
})
    .join("");
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
        const logo = renderHeightLogo(entry);
        return `<li class="height-card__item">\n        <span class="height-card__rank">${rank}</span>\n        <div class="height-card__logo">${logo}</div>\n        <div class="height-card__body">\n          <span class="height-card__team">${teamName}${abbreviation}</span>\n          <span class="height-card__meta">${formattedHeight} avg · ${formattedInches} · ${sample}</span>\n        </div>\n      </li>`;
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
    const measured = snapshot.teams
        .filter(hasMeasuredAverage)
        .slice()
        .sort((a, b) => b.average_height_inches - a.average_height_inches);
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
        const [divisionOneIndex, teamsResponse, payload] = await Promise.all([
            getDivisionOneProgramIndex(),
            NCAAM.teams(1, 600),
            fetch(HEIGHT_SNAPSHOT_PATH, { headers: { Accept: "application/json" } }).then(res => {
                if (!res.ok) {
                    throw new Error(`Failed to load roster height snapshot: ${res.status} ${res.statusText}`);
                }
                return res.json();
            }),
        ]);
        if (!payload || !Array.isArray(payload.teams)) {
            throw new Error("Roster height snapshot is missing team data.");
        }
        const divisionOneTeamIds = new Set();
        for (const team of teamsResponse.data) {
            const keys = buildTeamKeys(team);
            if (keys.some(key => divisionOneIndex.keys.has(key))) {
                divisionOneTeamIds.add(team.id);
            }
        }
        const filteredTeams = payload.teams.filter(team => typeof team.team_id === "number" && divisionOneTeamIds.has(team.team_id));
        const filteredSnapshot = {
            ...payload,
            team_count: filteredTeams.length,
            measured_team_count: filteredTeams.filter(hasMeasuredAverage).length,
            teams: filteredTeams,
        };
        renderHeightSnapshot(contentEl, footerEl, filteredSnapshot);
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
