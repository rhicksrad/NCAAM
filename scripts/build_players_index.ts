import fs from "node:fs/promises";
import path from "node:path";

type RosterDoc = {
  fetched_at: string;
  ttl_hours: number;
  source?: string;
  season?: string;
  season_start_year?: number;
  teams: {
    id: number;
    abbreviation: string;
    full_name: string;
    roster: Array<{
      id: number;
      first_name: string;
      last_name: string;
      position: string | null;
      jersey_number: string | null;
      height: string | null;
      weight: string | null;
    }>;
  }[];
};

type Bio = {
  id: number;
  birthdate?: string;
  origin?: string;
  draft?: string;
  era?: string;
};

type IndexRow = {
  id: number;
  name: string;
  team_abbr: string;
  position: string | null;
  jersey: string | null;
  height: string | null;
  weight: string | null;
  birthdate?: string;
  origin?: string;
  draft?: string;
  era?: string;
};

async function main() {
  const rosters: RosterDoc = JSON.parse(
    await fs.readFile("public/data/rosters.json", "utf8"),
  );

  let bios: Record<string, Bio> = {};
  try {
    bios = JSON.parse(
      await fs.readFile("public/data/player_bios.json", "utf8"),
    );
  } catch {}

  const rows: IndexRow[] = [];

  for (const team of rosters.teams) {
    for (const player of team.roster) {
      const bio = bios[player.id] || {};
      rows.push({
        id: player.id,
        name: `${player.first_name} ${player.last_name}`.trim(),
        team_abbr: team.abbreviation,
        position: player.position ?? null,
        jersey: player.jersey_number ?? null,
        height: player.height ?? null,
        weight: player.weight ?? null,
        birthdate: bio.birthdate,
        origin: bio.origin,
        draft: bio.draft,
        era: bio.era,
      });
    }
  }

  const faTeam = rosters.teams.find((team) => team.abbreviation === "FA");
  if (faTeam) {
    for (const player of faTeam.roster) {
      const bio = bios[player.id] || {};
      rows.push({
        id: player.id,
        name: `${player.first_name} ${player.last_name}`.trim(),
        team_abbr: "FA",
        position: player.position ?? null,
        jersey: player.jersey_number ?? null,
        height: player.height ?? null,
        weight: player.weight ?? null,
        birthdate: bio.birthdate,
        origin: bio.origin,
        draft: bio.draft,
        era: bio.era,
      });
    }
  }

  const out = {
    fetched_at: rosters.fetched_at ?? new Date().toISOString(),
    source: (() => {
      const source = typeof rosters.source === "string" ? rosters.source.trim() : "";
      if (source === "ball_dont_lie") {
        return "Ball Don't Lie";
      }
      if (source === "manual_roster_reference") {
        return "Manual roster reference";
      }
      return source || "Unknown";
    })(),
    count: rows.length,
    players: rows,
  };

  await fs.mkdir(path.join("public", "data"), { recursive: true });
  await fs.writeFile(
    "public/data/players_index.json",
    JSON.stringify(out, null, 2),
  );
  console.log(`Wrote players_index.json with ${rows.length} players`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
