import { buildTeamKeys } from "../lib/data/program-keys.js";
import { getDivisionOneProgramIndex } from "../lib/data/division-one.js";
import { NCAAM } from "../lib/sdk/ncaam.js";
import { getTeamLogoUrl, getTeamMonogram } from "../lib/ui/logos.js";
import { requireOk } from "../lib/health.js";
const HEIGHT_SNAPSHOT_PATH = "data/team-height-snapshot.json";
const app = document.getElementById("app");
const heightSnapshotPromise = requireOk(HEIGHT_SNAPSHOT_PATH, "Home").then(res => res.json());
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
                value: "elite TO creation, glass control, guard pressure.",
            },
            {
                label: "This week",
                value: "businesslike 2–0 and vaulted to AP No.1.",
            },
            {
                label: "Watch",
                value: "opponent eFG% + TO% both top-10.",
            },
        ],
    },
    {
        rank: 2,
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
                value: "surgical half-court, assist rate, pace control.",
            },
            {
                label: "This week",
                value: "survived a real test vs Oakland 87–77. Braden Smith was the closer.",
            },
            {
                label: "Watch",
                value: "live-ball TOs vs pressure guards.",
            },
        ],
    },
    {
        rank: 3,
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
                label: "This week",
                value: "110–47 over UMass Lowell with seven in double figures.",
            },
            {
                label: "Watch",
                value: "half-court PPP vs ranked opponents.",
            },
        ],
    },
    {
        rank: 4,
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
                value: "shot creation at 1/3, enough rim protection to extend.",
            },
            {
                label: "This week",
                value: "95–54 over Western Carolina, Boozer efficient.",
            },
            {
                label: "Watch",
                value: "3PA rate without losing paint touches.",
            },
        ],
    },
    {
        rank: 5,
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
                value: "tempo + early offense, stretch bigs trailing.",
            },
            {
                label: "This week",
                value: "beat defending champ Florida 93–87 in Vegas. Koa Peat 30 in debut.",
            },
            {
                label: "Watch",
                value: "D-glass vs power frontcourts.",
            },
        ],
    },
    {
        rank: 6,
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
                value: "balanced inside-out, sturdy rebounding shell.",
            },
            {
                label: "This week",
                value: "121–78 on Oakland with record first-half output.",
            },
            {
                label: "Watch",
                value: "turnover margin vs elite pressure.",
            },
        ],
    },
    {
        rank: 7,
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
                value: "spacing, motion, flare actions, low mistakes.",
            },
            {
                label: "This week",
                value: "71–66 vs Villanova, then 98–53 over Holy Cross. Dybantsa immediate impact.",
            },
            {
                label: "Watch",
                value: "3P volume vs top-25 defenses.",
            },
        ],
    },
    {
        rank: 8,
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
                value: "math-problem pace, rim + 3s.",
            },
            {
                label: "This week",
                value: "103–96 over No.5 St. John’s at MSG. Guards carried.",
            },
            {
                label: "Watch",
                value: "defensive volatility in late clock.",
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
                value: "tempo, secondary break, vertical pressure.",
            },
            {
                label: "This week",
                value: "107–59 over Valpo; depth flashed.",
            },
            {
                label: "Watch",
                value: "foul rate while pressing.",
            },
        ],
    },
    {
        rank: 10,
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
                value: "champion’s shot profile, deep rotation.",
            },
            {
                label: "This week",
                value: "took the L vs Arizona; free-throw diff stung.",
            },
            {
                label: "Watch",
                value: "D-reb% against top-20 O-glass teams.",
            },
        ],
    },
    {
        rank: 11,
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
                label: "This week",
                value: "JT Toppin’s 31/14 vs Sam Houston on return.",
            },
            {
                label: "Watch",
                value: "opponent 3P volume suppression.",
            },
        ],
    },
    {
        rank: 12,
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
                value: "size, mid-post options, slotted roles.",
            },
            {
                label: "This week",
                value: "104–45 opener, then cruised again; bench minutes held serve.",
            },
            {
                label: "Watch",
                value: "arc defense vs spread attacks.",
            },
        ],
    },
    {
        rank: 13,
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
                value: "tempo toggling, glass, secondary break.",
            },
            {
                label: "This week",
                value: "87–74 over No.19 Kansas; Caleb Wilson named ACC Co-POW.",
            },
            {
                label: "Watch",
                value: "turnover rate amid usage spike.",
            },
        ],
    },
    {
        rank: 14,
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
                value: "physical 2–4, chaos→easy buckets.",
            },
            {
                label: "This week",
                value: "108–74 over Quinnipiac, then fell to Alabama at MSG.",
            },
            {
                label: "Watch",
                value: "FT% and point-of-attack containment.",
            },
        ],
    },
    {
        rank: 15,
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
                label: "This week",
                value: "rugged but better vs Pepperdine after a shaky opener.",
            },
            {
                label: "Watch",
                value: "defensive rebounding consistency.",
            },
        ],
    },
    {
        rank: 16,
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
                value: "veteran shot-making, strong D-glass.",
            },
            {
                label: "This week",
                value: "two blowouts, 113–70 over FGCU with Boswell’s 31.",
            },
            {
                label: "Watch",
                value: "opponent 3P% regression and contest rate.",
            },
        ],
    },
    {
        rank: 17,
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
                value: "switch, contest, rebound.",
            },
            {
                label: "This week",
                value: "handled Mercer and NKU, Ament popped.",
            },
            {
                label: "Watch",
                value: "FT rate generated by guards.",
            },
        ],
    },
    {
        rank: 18,
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
                label: "This week",
                value: "2–0 with blowouts of FDU and Grambling; Jefferson/Momcilovic rolling.",
            },
            {
                label: "Watch",
                value: "live-ball TO% vs ranked guards.",
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
                label: "This week",
                value: "second-half fade at UNC, 87–74.",
            },
            {
                label: "Watch",
                value: "defensive glass vs top-50 athletes.",
            },
        ],
    },
    {
        rank: 20,
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
                label: "This week",
                value: "98–43 TSU, then 83–68 over Oklahoma.",
            },
            {
                label: "Watch",
                value: "rim FG% allowed.",
            },
        ],
    },
    {
        rank: 21,
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
                label: "This week",
                value: "needed OT to escape Bethune-Cookman. Process needs polish.",
            },
            {
                label: "Watch",
                value: "whistle control while protecting the rim.",
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
                label: "This week",
                value: "69–66 over No.14 Arkansas. Boards and paint touches won it.",
            },
            {
                label: "Watch",
                value: "late-clock creator clarity.",
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
                label: "This week",
                value: "92–76 over South Dakota; McDermott’s 500th D-I win.",
            },
            {
                label: "Watch",
                value: "non-starter net rating when tempo slows.",
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
                value: "slowdown, shot quality, positioning.",
            },
            {
                label: "This week",
                value: "handled business; real tests ahead.",
            },
            {
                label: "Watch",
                value: "opponent FT rate once step-up games land.",
            },
        ],
    },
    {
        rank: 25,
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
                value: "downhill guards, O-boards, free throws.",
            },
            {
                label: "This week",
                value: "69–66 loss at Michigan State; spacing and shot selection wobble.",
            },
            {
                label: "Watch",
                value: "lineup 3-point gravity.",
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
async function loadHeightSnapshot(contentEl, footerEl, snapshotPromise) {
    try {
        const [divisionOneIndex, teamsResponse, payload] = await Promise.all([
            getDivisionOneProgramIndex(),
            NCAAM.teams(1, 600),
            snapshotPromise,
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
        return;
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
    void loadHeightSnapshot(heightCardContent, heightCardFooter, heightSnapshotPromise);
}
