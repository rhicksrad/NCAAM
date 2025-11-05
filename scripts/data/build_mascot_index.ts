import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const OUTPUT_PATH = path.join(ROOT, "public/data/fun-lab/mascot-index.json");
const OUTPUT_DIR = path.dirname(OUTPUT_PATH);

const WORKER_BASE = "https://ncaam.hicksrch.workers.dev/v1";

interface ApiTeam {
  id: number;
  conference_id: number | null;
  name: string;
  full_name: string;
  college: string;
  abbreviation?: string | null;
}

interface ApiConference {
  id: number;
  name: string;
  short_name?: string | null;
}

type MascotFamily = keyof typeof FAMILY_DEFINITIONS;
type MascotCategorySlug = keyof typeof CATEGORY_DEFINITIONS;

type MascotRecord = {
  id: number;
  full_name: string;
  college: string;
  mascot: string;
  abbreviation: string | null;
  conference: {
    id: number;
    name: string;
    short_name: string | null;
  } | null;
  category: MascotCategorySlug;
  category_label: string;
  family: MascotFamily;
  family_label: string;
};

type MascotCategorySummary = {
  slug: MascotCategorySlug;
  label: string;
  family: MascotFamily;
  family_label: string;
  count: number;
};

type MascotFamilySummary = {
  slug: MascotFamily;
  label: string;
  count: number;
};

const FAMILY_DEFINITIONS = {
  animals: { label: "Animals" },
  humans: { label: "Humans & Occupations" },
  mythical: { label: "Mythical & Supernatural" },
  forces: { label: "Forces & Weather" },
  objects: { label: "Objects & Concepts" },
  vehicles: { label: "Vehicles & Flight" },
} as const;

const CATEGORY_DEFINITIONS = {
  animals_birds: { label: "Birds", family: "animals" },
  animals_cats: { label: "Cats", family: "animals" },
  animals_canids: { label: "Dogs & Wolves", family: "animals" },
  animals_bears: { label: "Bears", family: "animals" },
  animals_hoofed: { label: "Hoofed Mammals", family: "animals" },
  animals_reptiles: { label: "Reptiles & Amphibians", family: "animals" },
  animals_insects: { label: "Insects & Arachnids", family: "animals" },
  animals_marine: { label: "Sea Life", family: "animals" },
  animals_other: { label: "Other Wildlife", family: "animals" },
  humans_general: { label: "Humans & Occupations", family: "humans" },
  mythical_spirits: { label: "Mythical & Legends", family: "mythical" },
  forces_elements: { label: "Forces & Weather", family: "forces" },
  objects_concepts: { label: "Objects & Concepts", family: "objects" },
  vehicles_machines: { label: "Vehicles & Flight", family: "vehicles" },
} as const satisfies Record<string, { label: string; family: MascotFamily }>;

const CATEGORY_ORDER: MascotCategorySlug[] = [
  "animals_birds",
  "animals_cats",
  "animals_canids",
  "animals_bears",
  "animals_hoofed",
  "animals_other",
  "animals_reptiles",
  "animals_marine",
  "animals_insects",
  "humans_general",
  "mythical_spirits",
  "forces_elements",
  "objects_concepts",
  "vehicles_machines",
];

const FAMILY_ORDER: MascotFamily[] = ["animals", "humans", "mythical", "forces", "objects", "vehicles"];

function normalizeMascotName(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const NAME_CATEGORY_PAIRS: Array<[string, MascotCategorySlug]> = [
  ["49ers", "humans_general"],
  ["aggies", "humans_general"],
  ["anteaters", "animals_other"],
  ["aztecs", "humans_general"],
  ["badgers", "animals_other"],
  ["beach", "objects_concepts"],
  ["beacons", "objects_concepts"],
  ["bearcats", "animals_cats"],
  ["bearkats", "animals_cats"],
  ["bears", "animals_bears"],
  ["beavers", "animals_other"],
  ["bengals", "animals_cats"],
  ["big green", "objects_concepts"],
  ["big red", "objects_concepts"],
  ["billikens", "mythical_spirits"],
  ["bison", "animals_hoofed"],
  ["bisons", "animals_hoofed"],
  ["black bears", "animals_bears"],
  ["black knights", "humans_general"],
  ["blazers", "humans_general"],
  ["blue demons", "mythical_spirits"],
  ["blue devils", "mythical_spirits"],
  ["blue hens", "animals_birds"],
  ["blue hose", "objects_concepts"],
  ["blue raiders", "humans_general"],
  ["bluejays", "animals_birds"],
  ["bobcats", "animals_cats"],
  ["boilermakers", "humans_general"],
  ["bonnies", "humans_general"],
  ["braves", "humans_general"],
  ["broncos", "animals_hoofed"],
  ["broncs", "animals_hoofed"],
  ["bruins", "animals_bears"],
  ["buccaneers", "humans_general"],
  ["buckeyes", "objects_concepts"],
  ["buffaloes", "animals_hoofed"],
  ["bulldogs", "animals_canids"],
  ["bulls", "animals_hoofed"],
  ["cardinal", "objects_concepts"],
  ["cardinals", "animals_birds"],
  ["catamounts", "animals_cats"],
  ["cavaliers", "humans_general"],
  ["chanticleers", "animals_birds"],
  ["chargers", "animals_hoofed"],
  ["chippewas", "humans_general"],
  ["colonels", "humans_general"],
  ["colonials", "humans_general"],
  ["commodores", "humans_general"],
  ["cornhuskers", "humans_general"],
  ["cougars", "animals_cats"],
  ["cowboys", "humans_general"],
  ["coyotes", "animals_canids"],
  ["crimson", "objects_concepts"],
  ["crimson tide", "forces_elements"],
  ["crusaders", "humans_general"],
  ["cyclones", "forces_elements"],
  ["delta devils", "mythical_spirits"],
  ["demon deacons", "mythical_spirits"],
  ["demons", "mythical_spirits"],
  ["dolphins", "animals_marine"],
  ["dons", "humans_general"],
  ["dragons", "mythical_spirits"],
  ["ducks", "animals_birds"],
  ["dukes", "humans_general"],
  ["eagles", "animals_birds"],
  ["explorers", "humans_general"],
  ["falcons", "animals_birds"],
  ["fighting camels", "animals_hoofed"],
  ["fighting hawks", "animals_birds"],
  ["fighting illini", "humans_general"],
  ["fighting irish", "humans_general"],
  ["flames", "forces_elements"],
  ["flyers", "vehicles_machines"],
  ["friars", "humans_general"],
  ["gaels", "humans_general"],
  ["gamecocks", "animals_birds"],
  ["gators", "animals_reptiles"],
  ["gauchos", "humans_general"],
  ["gentlemen", "humans_general"],
  ["golden bears", "animals_bears"],
  ["golden eagles", "animals_birds"],
  ["golden flashes", "forces_elements"],
  ["golden gophers", "animals_other"],
  ["golden griffins", "mythical_spirits"],
  ["golden grizzlies", "animals_bears"],
  ["golden hurricane", "forces_elements"],
  ["golden lions", "animals_cats"],
  ["governors", "humans_general"],
  ["great danes", "animals_canids"],
  ["green wave", "forces_elements"],
  ["greyhounds", "animals_canids"],
  ["grizzlies", "animals_bears"],
  ["hatters", "humans_general"],
  ["hawkeyes", "animals_birds"],
  ["hawks", "animals_birds"],
  ["highlanders", "humans_general"],
  ["hilltoppers", "humans_general"],
  ["hokies", "animals_birds"],
  ["hoosiers", "humans_general"],
  ["horned frogs", "animals_reptiles"],
  ["hornets", "animals_insects"],
  ["hoyas", "objects_concepts"],
  ["hurricanes", "forces_elements"],
  ["huskies", "animals_canids"],
  ["islanders", "humans_general"],
  ["jackrabbits", "animals_other"],
  ["jaguars", "animals_cats"],
  ["jaspers", "humans_general"],
  ["jayhawks", "animals_birds"],
  ["keydets", "humans_general"],
  ["knights", "humans_general"],
  ["lakers", "humans_general"],
  ["lancers", "humans_general"],
  ["leathernecks", "humans_general"],
  ["leopards", "animals_cats"],
  ["lions", "animals_cats"],
  ["lobos", "animals_canids"],
  ["longhorns", "animals_hoofed"],
  ["lopes", "animals_hoofed"],
  ["lumberjacks", "humans_general"],
  ["mastodons", "animals_other"],
  ["matadors", "humans_general"],
  ["mavericks", "animals_hoofed"],
  ["mean green", "objects_concepts"],
  ["midshipmen", "humans_general"],
  ["miners", "humans_general"],
  ["minutemen", "humans_general"],
  ["mocs", "animals_birds"],
  ["monarchs", "humans_general"],
  ["mountain hawks", "animals_birds"],
  ["mountaineers", "humans_general"],
  ["musketeers", "humans_general"],
  ["mustangs", "animals_hoofed"],
  ["nittany lions", "animals_cats"],
  ["norse", "humans_general"],
  ["orange", "objects_concepts"],
  ["ospreys", "animals_birds"],
  ["owls", "animals_birds"],
  ["paladins", "humans_general"],
  ["panthers", "animals_cats"],
  ["patriots", "humans_general"],
  ["peacocks", "animals_birds"],
  ["penguins", "animals_birds"],
  ["phoenix", "mythical_spirits"],
  ["pilots", "vehicles_machines"],
  ["pioneers", "humans_general"],
  ["pirates", "humans_general"],
  ["pride", "animals_cats"],
  ["privateers", "humans_general"],
  ["purple aces", "vehicles_machines"],
  ["purple eagles", "animals_birds"],
  ["quakers", "humans_general"],
  ["racers", "animals_hoofed"],
  ["ragin cajuns", "humans_general"],
  ["raiders", "humans_general"],
  ["rainbow warriors", "humans_general"],
  ["ramblers", "humans_general"],
  ["rams", "animals_hoofed"],
  ["rattlers", "animals_reptiles"],
  ["razorbacks", "animals_hoofed"],
  ["rebels", "humans_general"],
  ["red flash", "forces_elements"],
  ["red foxes", "animals_canids"],
  ["red raiders", "humans_general"],
  ["red storm", "forces_elements"],
  ["red wolves", "animals_canids"],
  ["redbirds", "animals_birds"],
  ["redhawks", "animals_birds"],
  ["retrievers", "animals_canids"],
  ["revolutionaries", "humans_general"],
  ["river hawks", "animals_birds"],
  ["roadrunners", "animals_birds"],
  ["rockets", "vehicles_machines"],
  ["roos", "animals_other"],
  ["royals", "humans_general"],
  ["runnin bulldogs", "animals_canids"],
  ["saints", "humans_general"],
  ["salukis", "animals_canids"],
  ["scarlet knights", "humans_general"],
  ["screaming eagles", "animals_birds"],
  ["seahawks", "animals_birds"],
  ["seawolves", "animals_canids"],
  ["seminoles", "humans_general"],
  ["sharks", "animals_marine"],
  ["shockers", "humans_general"],
  ["skyhawks", "animals_birds"],
  ["sooners", "humans_general"],
  ["spartans", "humans_general"],
  ["spiders", "animals_insects"],
  ["stags", "animals_hoofed"],
  ["sun devils", "mythical_spirits"],
  ["sycamores", "objects_concepts"],
  ["tar heels", "humans_general"],
  ["terrapins", "animals_reptiles"],
  ["terriers", "animals_canids"],
  ["texans", "humans_general"],
  ["thunderbirds", "animals_birds"],
  ["thundering herd", "animals_hoofed"],
  ["tigers", "animals_cats"],
  ["titans", "mythical_spirits"],
  ["tommies", "humans_general"],
  ["toreros", "humans_general"],
  ["trailblazers", "humans_general"],
  ["tribe", "humans_general"],
  ["tritons", "mythical_spirits"],
  ["trojans", "humans_general"],
  ["utes", "humans_general"],
  ["vandals", "humans_general"],
  ["vaqueros", "humans_general"],
  ["vikings", "humans_general"],
  ["volunteers", "humans_general"],
  ["warhawks", "animals_birds"],
  ["warriors", "humans_general"],
  ["waves", "forces_elements"],
  ["wildcats", "animals_cats"],
  ["wolf pack", "animals_canids"],
  ["wolfpack", "animals_canids"],
  ["wolverines", "animals_other"],
  ["wolves", "animals_canids"],
  ["yellow jackets", "animals_insects"],
  ["zips", "animals_other"],
];

const NAME_TO_CATEGORY = new Map<string, MascotCategorySlug>(
  NAME_CATEGORY_PAIRS.map(([name, category]) => [normalizeMascotName(name) ?? name, category]),
);

function classifyMascot(team: ApiTeam): MascotCategorySlug {
  const normalized = normalizeMascotName(team.name) ?? normalizeMascotName(team.full_name);
  if (normalized && NAME_TO_CATEGORY.has(normalized)) {
    return NAME_TO_CATEGORY.get(normalized)!;
  }
  const fallback = normalizeMascotName(team.college);
  if (fallback && NAME_TO_CATEGORY.has(fallback)) {
    return NAME_TO_CATEGORY.get(fallback)!;
  }
  throw new Error(`Unknown mascot classification for ${team.full_name} (${team.name})`);
}

async function fetchJson<T>(url: string): Promise<T> {
  const { stdout } = await execFileAsync("curl", ["-sSf", url]);
  return JSON.parse(stdout) as T;
}

async function fetchTeams(): Promise<ApiTeam[]> {
  const payload = await fetchJson<{ data: ApiTeam[]; meta?: { next_page?: number | null } }>(
    `${WORKER_BASE}/teams?per_page=500`,
  );
  const records = [...payload.data];
  let next = payload.meta?.next_page;
  while (typeof next === "number" && Number.isFinite(next)) {
    const pagePayload = await fetchJson<{ data: ApiTeam[]; meta?: { next_page?: number | null } }>(
      `${WORKER_BASE}/teams?per_page=500&page=${next}`,
    );
    records.push(...pagePayload.data);
    if (pagePayload.meta?.next_page && pagePayload.meta.next_page !== next) {
      next = pagePayload.meta.next_page;
    } else {
      break;
    }
  }
  return records;
}

async function fetchConferences(): Promise<ApiConference[]> {
  const payload = await fetchJson<{ data: ApiConference[] }>(`${WORKER_BASE}/conferences?per_page=200`);
  return payload.data;
}

function summarizeRecords(records: MascotRecord[]): {
  categories: MascotCategorySummary[];
  families: MascotFamilySummary[];
} {
  const categoryCounts = new Map<MascotCategorySlug, number>();
  const familyCounts = new Map<MascotFamily, number>();

  for (const record of records) {
    categoryCounts.set(record.category, (categoryCounts.get(record.category) ?? 0) + 1);
    familyCounts.set(record.family, (familyCounts.get(record.family) ?? 0) + 1);
  }

  const categories = CATEGORY_ORDER.map<MascotCategorySummary>(slug => ({
    slug,
    label: CATEGORY_DEFINITIONS[slug].label,
    family: CATEGORY_DEFINITIONS[slug].family,
    family_label: FAMILY_DEFINITIONS[CATEGORY_DEFINITIONS[slug].family].label,
    count: categoryCounts.get(slug) ?? 0,
  })).filter(entry => entry.count > 0);

  const families = FAMILY_ORDER.map<MascotFamilySummary>(slug => ({
    slug,
    label: FAMILY_DEFINITIONS[slug].label,
    count: familyCounts.get(slug) ?? 0,
  })).filter(entry => entry.count > 0);

  return { categories, families };
}

async function buildIndex(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const [teams, conferences] = await Promise.all([fetchTeams(), fetchConferences()]);
  const conferenceMap = new Map<number, ApiConference>();
  for (const conference of conferences) {
    conferenceMap.set(conference.id, conference);
  }

  const divisionOneTeams = teams.filter(team => team.conference_id !== null);
  const conferenceIds = new Set<number>();
  for (const team of divisionOneTeams) {
    if (team.conference_id !== null) {
      conferenceIds.add(team.conference_id);
    }
  }

  const records: MascotRecord[] = divisionOneTeams.map(team => {
    const category = classifyMascot(team);
    const categoryDefinition = CATEGORY_DEFINITIONS[category];
    const familyDefinition = FAMILY_DEFINITIONS[categoryDefinition.family];
    const conference = team.conference_id ? conferenceMap.get(team.conference_id) ?? null : null;
    return {
      id: team.id,
      full_name: team.full_name,
      college: team.college,
      mascot: team.name,
      abbreviation: team.abbreviation ?? null,
      conference: conference
        ? {
            id: conference.id,
            name: conference.name,
            short_name: conference.short_name ?? null,
          }
        : null,
      category,
      category_label: categoryDefinition.label,
      family: categoryDefinition.family,
      family_label: familyDefinition.label,
    };
  });

  records.sort((a, b) => {
    const categoryA = CATEGORY_ORDER.indexOf(a.category);
    const categoryB = CATEGORY_ORDER.indexOf(b.category);
    if (categoryA !== categoryB) {
      return categoryA - categoryB;
    }
    return a.full_name.localeCompare(b.full_name, "en-US");
  });

  const { categories, families } = summarizeRecords(records);

  const output = {
    generated_at: new Date().toISOString(),
    source: {
      teams: `${WORKER_BASE}/teams`,
      conferences: `${WORKER_BASE}/conferences`,
    },
    total_programs: records.length,
    total_conferences: conferenceIds.size,
    families,
    categories,
    records,
  };

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote mascot index with ${records.length} programs to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

void buildIndex().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
