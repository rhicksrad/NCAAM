// Resolve the many spellings of a program's name (sports-reference, Barttorvik,
// venue spreadsheets, ESPN) to one ESPN team id.
import { readFileSync } from "node:fs";

const MANUAL = {
  "albany ny": "Albany", "ualbany": "Albany", "army west point": "Army", "a&m-commerce": "East Texas A&M",
  "texas a&m commerce": "East Texas A&M", "a&m-corpus christi": "Texas A&M-Corpus Christi",
  "texas a&m corpus chris": "Texas A&M-Corpus Christi", "uconn": "UConn", "connecticut": "UConn",
  "ole miss": "Ole Miss", "mississippi": "Ole Miss", "miami fl": "Miami", "miami (fl)": "Miami",
  "miami oh": "Miami (OH)", "nc state": "NC State", "north carolina state": "NC State", "n.c. state": "NC State",
  "pitt": "Pittsburgh", "umass": "Massachusetts", "massachusetts": "UMass", "saint mary's ca": "Saint Mary's",
  "st. mary's (ca)": "Saint Mary's", "saint mary's (ca)": "Saint Mary's", "loyola il": "Loyola Chicago", "loyola (il)": "Loyola Chicago",
  "loyola md": "Loyola Maryland", "loyola (md)": "Loyola Maryland", "st. john's (ny)": "St. John's",
  "usc": "USC", "southern california": "USC", "lsu": "LSU", "louisiana state": "LSU", "vcu": "VCU",
  "virginia commonwealth": "VCU", "smu": "SMU", "southern methodist": "SMU", "tcu": "TCU", "texas christian": "TCU",
  "ucf": "UCF", "central florida": "UCF", "unlv": "UNLV", "nevada-las vegas": "UNLV", "byu": "BYU", "brigham young": "BYU",
  "utep": "UTEP", "texas-el paso": "UTEP", "utsa": "UTSA", "texas-san antonio": "UTSA", "uab": "UAB", "alabama-birmingham": "UAB",
  "penn": "Pennsylvania", "pennsylvania": "Penn", "fiu": "Florida International", "florida international": "FIU",
  "liu": "Long Island University", "long island university": "LIU", "liu brooklyn": "Long Island University",
  "siu edwardsville": "SIU Edwardsville", "southern illinois-edwardsville": "SIU Edwardsville", "siue": "SIU Edwardsville",
  "ut arlington": "UT Arlington", "texas-arlington": "UT Arlington", "ut martin": "UT Martin", "tennessee-martin": "UT Martin",
  "ut rio grande valley": "UT Rio Grande Valley", "texas-rio grande valley": "UT Rio Grande Valley", "utrgv": "UT Rio Grande Valley",
  "unc": "North Carolina", "louisiana-monroe": "UL Monroe", "louisiana monroe": "UL Monroe", "ulm": "UL Monroe",
  "louisiana lafayette": "Louisiana", "louisiana-lafayette": "Louisiana", "illinois-chicago": "UIC", "illinois chicago": "UIC",
  "maryland-baltimore county": "UMBC", "maryland-eastern shore": "Maryland Eastern Shore", "massachusetts-lowell": "UMass Lowell",
  "missouri-kansas city": "Kansas City", "umkc": "Kansas City", "nebraska omaha": "Omaha", "nebraska-omaha": "Omaha",
  "purdue fort wayne": "Purdue Fort Wayne", "fort wayne": "Purdue Fort Wayne", "ipfw": "Purdue Fort Wayne",
  "iupui": "IU Indianapolis", "iu indy": "IU Indianapolis", "st. francis pa": "Saint Francis", "saint francis (pa)": "Saint Francis",
  "st. francis ny": "St. Francis Brooklyn", "st. francis (ny)": "St. Francis Brooklyn", "cal baptist": "California Baptist",
  "cal st. bakersfield": "Cal State Bakersfield", "cal st. fullerton": "Cal State Fullerton", "cal st. northridge": "Cal State Northridge",
  "college of charleston": "Charleston", "detroit": "Detroit Mercy", "arkansas pine bluff": "Arkansas-Pine Bluff",
  "bethune cookman": "Bethune-Cookman", "central connecticut": "Central Connecticut", "central connecticut state": "Central Connecticut",
  "grambling st.": "Grambling", "grambling state": "Grambling", "houston christian": "Houston Christian", "houston baptist": "Houston Christian",
  "little rock": "Little Rock", "arkansas-little rock": "Little Rock", "arkansas little rock": "Little Rock",
  "mississippi valley st.": "Mississippi Valley State", "mount st. mary's": "Mount St. Mary's", "nicholls st.": "Nicholls", "nicholls state": "Nicholls",
  "north carolina a&t": "North Carolina A&T", "north carolina central": "North Carolina Central", "prairie view": "Prairie View A&M",
  "queens": "Queens University", "queens (nc)": "Queens University", "sam houston st.": "Sam Houston", "sam houston state": "Sam Houston",
  "seattle": "Seattle U", "southeast missouri st.": "Southeast Missouri State", "southern miss": "Southern Miss", "southern mississippi": "Southern Miss",
  "st. thomas": "St. Thomas-Minnesota", "st. thomas (mn)": "St. Thomas-Minnesota", "tarleton st.": "Tarleton State", "texas a&m corpus christi": "Texas A&M-Corpus Christi",
  "the citadel": "The Citadel", "citadel": "The Citadel", "unc asheville": "UNC Asheville", "north carolina-asheville": "UNC Asheville",
  "unc greensboro": "UNC Greensboro", "north carolina-greensboro": "UNC Greensboro", "unc wilmington": "UNC Wilmington", "north carolina-wilmington": "UNC Wilmington",
  "usc upstate": "South Carolina Upstate", "south carolina upstate": "USC Upstate", "western kentucky": "Western Kentucky",
  "california-davis": "UC Davis", "california-irvine": "UC Irvine", "california-riverside": "UC Riverside", "california-san diego": "UC San Diego",
  "california-santa barbara": "UC Santa Barbara", "uc santa barbara": "UC Santa Barbara", "hawaii": "Hawai'i", "san jose st.": "San José State", "san jose state": "San José State",
  "american": "American University", "american university": "American", "boston university": "Boston University", "appalachian st.": "App State", "appalachian state": "App State",
  "southern": "Southern", "texas a&m-commerce": "East Texas A&M", "st. bonaventure": "St. Bonaventure", "florida gulf coast": "Florida Gulf Coast", "fgcu": "Florida Gulf Coast",
  "middle tennessee": "Middle Tennessee", "sacramento st.": "Sacramento State", "mcneese st.": "McNeese", "mcneese state": "McNeese",
  "southeastern louisiana": "SE Louisiana", "se louisiana": "SE Louisiana", "stephen f. austin": "Stephen F. Austin", "sfa": "Stephen F. Austin",
  "kent st.": "Kent State", "dixie st.": "Utah Tech", "dixie state": "Utah Tech", "tennessee-martin": "UT Martin", "ut martin": "UT Martin",
  "east tennessee st.": "East Tennessee State", "etsu": "East Tennessee State", "njit": "NJIT", "fairleigh dickinson": "Fairleigh Dickinson",
  "st. peter's": "Saint Peter's", "saint peter's": "Saint Peter's", "st. joseph's": "Saint Joseph's", "saint joseph's": "Saint Joseph's",
  "st. louis": "Saint Louis", "saint louis": "Saint Louis", "monmouth": "Monmouth", "lindenwood": "Lindenwood", "le moyne": "Le Moyne", "west georgia": "West Georgia",
  "mercyhurst": "Mercyhurst", "stonehill": "Stonehill", "southern indiana": "Southern Indiana", "texas a&m–commerce": "East Texas A&M", "east texas a&m": "East Texas A&M",
  "new haven": "New Haven", "kansas city": "Kansas City", "nebraska": "Nebraska", "cal state bakersfield": "Cal State Bakersfield", "csu bakersfield": "Cal State Bakersfield",
  "cal state fullerton": "Cal State Fullerton", "cal state northridge": "Cal State Northridge", "csun": "Cal State Northridge", "long beach st.": "Long Beach State",
};

export function norm(value) {
  return String(value ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(([^)]*)\)/g, " $1 ")
    .replace(/\bst\.(?=\s|$)/g, "state")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function loadResolver(metadataPath, espnTeams = []) {
  const meta = JSON.parse(readFileSync(metadataPath, "utf8"));
  const byKey = new Map();
  const names = new Map();
  // ESPN's own Division I list wins; the logo metadata fills in spellings.
  for (const t of espnTeams) {
    names.set(t.id, `${t.name} ${t.mascot}`.trim());
    for (const alias of [t.name, t.short, `${t.name} ${t.mascot}`]) {
      const key = norm(alias);
      if (key && !byKey.has(key)) byKey.set(key, t.id);
    }
  }
  const d1 = espnTeams.length ? new Set(espnTeams.map((t) => t.id)) : null;
  for (const [id, entry] of Object.entries(meta.logos)) {
    if (d1 && !d1.has(id)) continue;
    names.set(id, entry.name);
    for (const alias of [entry.name, ...(entry.aliases ?? [])]) {
      if (!alias || alias.length < 4 && alias === alias.toUpperCase() && !/^(BYU|LSU|TCU|SMU|VCU|UCF|UAB|USC|FIU|LIU|UIC)$/.test(alias)) continue;
      const key = norm(alias);
      if (key && !byKey.has(key)) byKey.set(key, id);
    }
  }
  const manual = new Map(Object.entries(MANUAL).map(([k, v]) => [norm(k), norm(v)]));
  function resolve(name) {
    const key = norm(name);
    if (!key) return null;
    const viaManual = manual.get(key);
    if (viaManual && byKey.has(viaManual)) return byKey.get(viaManual);
    if (byKey.has(key)) return byKey.get(key);
    // "Missouri Tigers" style: strip trailing mascot words one at a time.
    const parts = key.split(" ");
    for (let n = parts.length - 1; n >= 1; n--) {
      const head = parts.slice(0, n).join(" ");
      const m = manual.get(head);
      if (m && byKey.has(m)) return byKey.get(m);
      if (byKey.has(head)) return byKey.get(head);
    }
    return null;
  }
  return { resolve, names };
}
