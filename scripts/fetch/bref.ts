export const BREF_MAP: Record<string, string> = {
  ATL: "ATL",
  BOS: "BOS",
  BKN: "BRK",
  BRK: "BRK",
  CHA: "CHO",
  CHO: "CHO",
  CHI: "CHI",
  CLE: "CLE",
  DAL: "DAL",
  DEN: "DEN",
  DET: "DET",
  GSW: "GSW",
  HOU: "HOU",
  IND: "IND",
  LAC: "LAC",
  LAL: "LAL",
  MEM: "MEM",
  MIA: "MIA",
  MIL: "MIL",
  MIN: "MIN",
  NOP: "NOP",
  NYK: "NYK",
  OKC: "OKC",
  ORL: "ORL",
  PHI: "PHI",
  PHX: "PHO",
  PHO: "PHO",
  POR: "POR",
  SAC: "SAC",
  SAS: "SAS",
  TOR: "TOR",
  UTA: "UTA",
  WAS: "WAS",
};

export function brefTeam(abbr: string): string {
  const out = BREF_MAP[abbr.toUpperCase()];
  if (!out) throw new Error(`Unknown team abbr for BRef: ${abbr}`);
  return out;
}

export async function fetchBref(url: string, attempt = 1): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "nba-previews/1.0 (+https://github.com/rhicksrad/NBA)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (res.status >= 500 && attempt < 4) {
    await new Promise((r) => setTimeout(r, 300 * attempt));
    return fetchBref(url, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}
