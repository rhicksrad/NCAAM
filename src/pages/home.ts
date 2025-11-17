import { buildTeamKeys } from "../lib/data/program-keys.js";
import { getDivisionOneProgramIndex } from "../lib/data/division-one.js";
import { NCAAM, type Team } from "../lib/sdk/ncaam.js";
import { getTeamLogoUrl, getTeamMonogram } from "../lib/ui/logos.js";
import { requireOk } from "../lib/health.js";

const HEIGHT_SNAPSHOT_PATH = "data/team-height-snapshot.json";

const app = document.getElementById("app")!;

const heightSnapshotPromise = requireOk(HEIGHT_SNAPSHOT_PATH, "Home").then(
  res => res.json() as Promise<HeightSnapshot>,
);

type PollNote = {
  label: string;
  value: string;
};

type PollProgram = {
  id: number;
  full_name: string;
  name?: string;
  abbreviation?: string;
  college?: string;
  conference?: string;
};

type PollEntry = {
  rank: number;
  team: string;
  program: PollProgram;
  notes: PollNote[];
};

type HeightSnapshotTeam = {
  team_id: number;
  team: string;
  abbreviation: string | null;
  conference: string | null;
  roster_count: number;
  measured_count: number;
  average_height_inches: number | null;
};

type HeightSnapshot = {
  generated_at?: string;
  source?: string;
  team_count?: number;
  measured_team_count?: number;
  teams: HeightSnapshotTeam[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createPollTeam(entry: PollEntry): Team {
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

function renderPollLogo(entry: PollEntry): string {
  const team = createPollTeam(entry);
  const alt = escapeHtml(`${team.full_name} logo`);
  const logoUrl = getTeamLogoUrl(team);
  if (logoUrl) {
    return `<img class="poll-card__logo-image" src="${logoUrl}" alt="${alt}" loading="lazy" decoding="async">`;
  }

  const monogram = escapeHtml(getTeamMonogram(team));
  return `<span class="poll-card__logo-fallback" role="img" aria-label="${alt}">${monogram}</span>`;
}

function createSnapshotTeam(entry: HeightSnapshotTeam): Team {
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

function renderHeightLogo(entry: HeightSnapshotTeam): string {
  const team = createSnapshotTeam(entry);
  const alt = escapeHtml(`${team.full_name} logo`);
  const logoUrl = getTeamLogoUrl(team);
  if (logoUrl) {
    return `<img class="height-card__logo-image" src="${logoUrl}" alt="${alt}" loading="lazy" decoding="async">`;
  }

  const monogram = escapeHtml(getTeamMonogram(team));
  return `<span class="height-card__logo-fallback" role="img" aria-label="${alt}">${monogram}</span>`;
}

const poll: PollEntry[] = [
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
        label: "This week",
        value: "road win at Alabama, handled Akron; reclaimed AP No. 1.",
      },
      {
        label: "Read",
        value: "guards dictated pace, glass held up; half-court remains surgical.",
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
        label: "This week",
        value: "neutral-site win over Auburn after cruising vs Oakland; AP No. 2.",
      },
      {
        label: "Read",
        value: "top-end defense + freshman usage looked road-ready in a one-possession game.",
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
        label: "This week",
        value: "86–84 over BYU in Boston; three players with 21.",
      },
      {
        label: "Read",
        value: "set-piece execution survived a furious late run; wings shot creation looks real.",
      },
    ],
  },
  {
    rank: 4,
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
        label: "This week",
        value: "69–65 over UCLA; added to the Florida scalp from Week 1.",
      },
      {
        label: "Read",
        value: "physicality at the rim and late-game poise; turnover control is the next lever.",
      },
    ],
  },
  {
    rank: 5,
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
        label: "This week",
        value: "handled business; shot diet cleaner, rim pressure steady.",
      },
      {
        label: "Read",
        value: "spacing tweaks keeping Mitchell/Boozer comfortable; defense toggling coverages.",
      },
    ],
  },
  {
    rank: 6,
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
        label: "This week",
        value: "statement 96–88 over Kentucky, then routed Ohio.",
      },
      {
        label: "Read",
        value: "guard pop plus size; arc defense versus elite pace teams is the next test.",
      },
    ],
  },
  {
    rank: 7,
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
        label: "This week",
        value: "81–77 over Texas Tech; late stops and Stojaković shot-making.",
      },
      {
        label: "Read",
        value: "perimeter contests + defensive glass = protected seed trajectory.",
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
        label: "This week",
        value: "two-point loss to UConn with Dybantsa surging late.",
      },
      {
        label: "Read",
        value: "spacing and movement travel; turnover avoidance vs length is the watch item.",
      },
    ],
  },
  {
    rank: 9,
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
        label: "This week",
        value: "clean week; interior touches into kick-out 3s stayed on script.",
      },
      {
        label: "Read",
        value: "frontcourt reads + guard patience; depth scoring starting to show.",
      },
    ],
  },
  {
    rank: 10,
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
        label: "This week",
        value: "fought Purdue; process was fine against elite size.",
      },
      {
        label: "Read",
        value: "rim pressure + tempo still problematic; need to quiet the foul volume.",
      },
    ],
  },
  {
    rank: 11,
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
        label: "This week",
        value: "form holds after the Kansas win in Week 1; secondary-break efficiency rising.",
      },
      {
        label: "Read",
        value: "transition math + rebounding gap; wing defense keeps scaling.",
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
        label: "This week",
        value: "narrow loss to Arizona; shot-making there, paint points weren’t.",
      },
      {
        label: "Read",
        value: "execution in the half-court; need whistle discipline to unleash tempo.",
      },
    ],
  },
  {
    rank: 13,
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
        label: "This week",
        value: "loss to Alabama balanced by a comfortable win; foul economy remains the hinge.",
      },
      {
        label: "Read",
        value: "pressure defense and offensive boards; late-game composure is swing factor.",
      },
    ],
  },
  {
    rank: 14,
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
        label: "This week",
        value: "fell at Illinois, then steadied vs Milwaukee.",
      },
      {
        label: "Read",
        value: "guards have to finish better inside arc; defense still connected.",
      },
    ],
  },
  {
    rank: 15,
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
        label: "This week",
        value: "defense traveled; guard FT rate is trending up.",
      },
      {
        label: "Read",
        value: "switchability + rim protection; offense still waiting on consistent shooting.",
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
        label: "This week",
        value: "turnover factory doing turnover-factory things; schedule ramps next.",
      },
      {
        label: "Read",
        value: "depth of disruptors; need to prove half-court shot creation on neutral floors.",
      },
    ],
  },
  {
    rank: 17,
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
        label: "This week",
        value: "recalibrating after UNC; defensive glass versus athletes is the tell.",
      },
      {
        label: "Read",
        value: "two-big looks vs wings; perimeter creation must settle.",
      },
    ],
  },
  {
    rank: 18,
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
        label: "This week",
        value: "handled TSU and Oklahoma; rim D quietly solidifying.",
      },
      {
        label: "Read",
        value: "post touches forcing rotations; guards getting more efficient pull-ups.",
      },
    ],
  },
  {
    rank: 19,
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
        label: "This week",
        value: "one-point loss to Houston; real positives in creation and length.",
      },
      {
        label: "Read",
        value: "athleticism on the wings; finishing and rim defense trending up.",
      },
    ],
  },
  {
    rank: 20,
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
        label: "This week",
        value: "low-mistake possessions; whistle discipline holding.",
      },
      {
        label: "Read",
        value: "pace control and intelligent switches; bench scoring is key.",
      },
    ],
  },
  {
    rank: 21,
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
        label: "This week",
        value: "tight loss at Michigan State; spacing reads are the swing stat.",
      },
      {
        label: "Read",
        value: "guard downhill pressure, wings still syncing; turnover avoidance critical.",
      },
    ],
  },
  {
    rank: 22,
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
        label: "This week",
        value: "lost at Louisville; defense at the point of attack got stressed.",
      },
      {
        label: "Read",
        value: "shot-making pop remains; rim rotations must be crisper.",
      },
    ],
  },
  {
    rank: 23,
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
        label: "This week",
        value: "beat Arkansas; late-clock creator committee holding enough.",
      },
      {
        label: "Read",
        value: "physical defense, disciplined rebounding; guards must keep turnovers low.",
      },
    ],
  },
  {
    rank: 24,
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
        label: "This week",
        value: "solid win, but bench minutes still a volatility source.",
      },
      {
        label: "Read",
        value: "spacing and quick triggers; need to find secondary creation late.",
      },
    ],
  },
  {
    rank: 25,
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
        label: "This week",
        value: "still absorbing the Arizona loss; D-glass against size is the watch.",
      },
      {
        label: "Read",
        value: "guard depth is real; frontcourt rim protection has to steady.",
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

function hasMeasuredAverage(entry: HeightSnapshotTeam): entry is HeightSnapshotTeam & {
  average_height_inches: number;
} {
  return typeof entry.average_height_inches === "number" && Number.isFinite(entry.average_height_inches);
}

function formatAverageHeight(inches: number): string {
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

function formatAverageInches(inches: number): string {
  if (!Number.isFinite(inches) || inches <= 0) {
    return "—";
  }
  return `${inches.toFixed(1)} in`;
}

function pluralize(value: number, singular: string, plural: string): string {
  return value === 1 ? singular : plural;
}

function renderHeightColumn(title: string, entries: HeightSnapshotTeam[]): string {
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

function formatUpdatedAt(raw?: string): string {
  if (!raw) return "";
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

function resolveSourceUrl(raw?: string): string {
  if (!raw) {
    return "https://ncaam.hicksrch.workers.dev/v1/players/active";
  }
  try {
    const url = new URL(raw, window.location.origin);
    return url.toString();
  } catch {
    return "https://ncaam.hicksrch.workers.dev/v1/players/active";
  }
}

function renderHeightSnapshot(contentEl: HTMLElement, footerEl: HTMLElement, snapshot: HeightSnapshot): void {
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
  } else {
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

async function loadHeightSnapshot(
  contentEl: HTMLElement,
  footerEl: HTMLElement,
  snapshotPromise: Promise<HeightSnapshot>,
): Promise<void> {
  try {
    const [divisionOneIndex, teamsResponse, payload] = await Promise.all([
      getDivisionOneProgramIndex(),
      NCAAM.teams(1, 600),
      snapshotPromise,
    ]);

    if (!payload || !Array.isArray(payload.teams)) {
      throw new Error("Roster height snapshot is missing team data.");
    }

    const divisionOneTeamIds = new Set<number>();
    for (const team of teamsResponse.data) {
      const keys = buildTeamKeys(team);
      if (keys.some(key => divisionOneIndex.keys.has(key))) {
        divisionOneTeamIds.add(team.id);
      }
    }

    const filteredTeams = payload.teams.filter(team =>
      typeof team.team_id === "number" && divisionOneTeamIds.has(team.team_id),
    );

    const filteredSnapshot: HeightSnapshot = {
      ...payload,
      team_count: filteredTeams.length,
      measured_team_count: filteredTeams.filter(hasMeasuredAverage).length,
      teams: filteredTeams,
    };

    renderHeightSnapshot(contentEl, footerEl, filteredSnapshot);
  } catch (error) {
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
