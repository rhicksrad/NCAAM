import fs from "node:fs/promises";

type PlayersIndex = {
  players: Array<{ id: number; team_abbr: string }>;
};

type Atlas = { teams?: unknown; rosters?: unknown; players?: unknown };

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

async function main() {
  const index: PlayersIndex = JSON.parse(
    await fs.readFile("public/data/players_index.json", "utf8"),
  );

  let atlas: Atlas = {};
  try {
    atlas = JSON.parse(
      await fs.readFile("public/data/player_atlas.json", "utf8"),
    );
  } catch {}

  const legacyArrays = ["teams", "rosters"].filter((key) =>
    Array.isArray((atlas as Record<string, unknown>)[key]),
  );
  if (legacyArrays.length) {
    throw new Error(
      `Legacy roster fields present in player_atlas.json: ${legacyArrays.join(", ")}`,
    );
  }

  const ids = index.players.map((player) => player.id);
  if (ids.length !== uniq(ids).length) {
    throw new Error("Duplicate player IDs in players_index.json");
  }

  const totalPlayers = index.players.length;
  if (totalPlayers < 360 || totalPlayers > 600) {
    throw new Error(`Suspicious league size ${totalPlayers}`);
  }

  const missing = index.players.filter(
    (player) => !player.team_abbr || typeof player.team_abbr !== "string",
  );
  if (missing.length) {
    const sample = missing.slice(0, 5).map((player) => player.id).join(", ");
    throw new Error(`Players missing team_abbr: ${sample} …`);
  }

  const perTeam = new Map<string, number>();
  for (const player of index.players) {
    const current = perTeam.get(player.team_abbr) ?? 0;
    perTeam.set(player.team_abbr, current + 1);
  }

  const warnings = [...perTeam.entries()].filter(
    ([abbr, count]) => abbr !== "FA" && (count < 10 || count > 22),
  );
  if (warnings.length) {
    console.warn("Suspicious team sizes:", warnings);
  }

  console.log("Roster validation OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
