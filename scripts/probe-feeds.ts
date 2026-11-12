// Nightly contract check for the feeds that are fetched on demand in the
// browser and so are not covered by the build-time snapshot.
import { espn } from "../src/lib/espn.js";

const problems: string[] = [];
const need = (ok: unknown, what: string) => {
  if (!ok) problems.push(what);
};

const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(yesterday).replace(/-/g, "");
const teams = await espn.teams();
need(teams.length > 300, `teams: ${teams.length}`);
const team = teams.find((t) => t.name === "Duke") ?? teams[0]!;
const [detail, roster, schedule, games] = await Promise.all([espn.team(team.id), espn.roster(team.id), espn.schedule(team.id), espn.scoreboard(ymd)]);
need(detail.team.name, "team detail has no name");
need(roster.length >= 8, `roster: ${roster.length} players`);
need(schedule.length >= 10, `schedule: ${schedule.length} games`);
console.log(`${team.name}: ${roster.length} players, ${schedule.length} games; ${games.length} games on ${ymd}`);

const played = schedule.filter((g) => g.state === "post").pop() ?? games.find((g) => g.state === "post");
if (played) {
  const summary = await espn.summary(played.id);
  need(summary, "summary: empty");
  need(summary && summary.box.some((b) => b.players.length >= 5), "summary: no box score");
  need(summary && summary.plays.length > 50, `summary: ${summary?.plays.length ?? 0} plays`);
  console.log(`game ${played.id}: ${summary?.plays.length ?? 0} plays, ${summary?.box.length ?? 0} box tables`);
} else {
  console.log("no completed game to probe (offseason)");
}

if (problems.length) {
  console.error(`Feed problems:\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
