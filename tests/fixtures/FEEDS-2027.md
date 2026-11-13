# 2026-27 feeds (probed 2026-11-12, season week 2)

All probes used plain curl/Node `fetch` with default headers, no keys.

## ESPN player season stats (byathlete) — WORKS, use this

```
https://site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&sort=offensive.avgPoints:desc&season=2027&seasontype=2&limit=1000&page={N}
```

- HTTP 200, JSON, `requestedSeason.year` = `currentSeason.year` = 2027 ("2026-27").
- **Max page size is 1000.** Any `limit` above 1000 (1001, 1500, 2000, 5000) silently falls back to 25.
- Paging: `pagination.{count,limit,page,pages,next}`. On 2026-11-12: `count` 7114, `pages` 8 at limit 1000 (15 at limit 500). Pages are about 10 MB each at limit 1000.
- **The results include non-D1 players** (exhibition opponents such as Penn State Shenango, `teamId` 128344). Of the 7114 rows, 4815 belong to the 365 D1 teams in `tests/fixtures/espn/teams.json`. Filter with `athlete.teamId ∈ D1 team ids`. `groups=50` / `group=50` do **not** filter (same 7114).
- Every row returned had GP ≥ 1, so a player shows up only after they appear in a game.
- Player fields: `athletes[].athlete.{id, displayName, firstName, lastName, shortName, teamId, teamName, teamShortName, position.abbreviation}`.
- Stats: `athletes[].categories[i].values[k]` (numbers) / `.totals[k]` (display strings). Category order and stat names are in the top-level `categories[i].{name, names[], labels[]}`; index `k` lines up. Look them up by name, not position:
  - `general`: `gamesPlayed` (GP), `avgMinutes` (MIN), `avgRebounds` (REB, per game; `rebounds` is the total)
  - `offensive`: `avgPoints`, `avgAssists`, `avgTurnovers`, `fieldGoalPct`, `threePointFieldGoalPct`, `freeThrowPct` (0–100, not 0–1), plus made/attempted averages and totals
  - `defensive`: `avgSteals`, `avgBlocks` (+ totals `steals`, `blocks`)
  - Note: `general` repeats the labels `MIN`/`REB`/`PF` for the totals. Use `names`, which are unique.
- Fixture: `espn/player-stats-2027.json` holds the full response page with only the first 20 athletes kept. `athlete.links` was removed from each athlete to save space; all other fields are untouched.

## ESPN team statistics (teams/{id}/statistics) — works, but team totals only

```
https://site.web.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/150/statistics[?season=2027]
```

- 200 with or without `season` (identical, season 2027 regular season). `results.stats.categories[].stats[]` holds **team** aggregates (e.g. RPG), not per-player rows. Not useful for player stats.

## ESPN core athletes statistics — FAILED

```
https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/2027/types/2/teams/150/athletes/statistics
```

- 404. Not pursued further, since byathlete covers it.

## Bart Torvik team results — WORKS

```
https://barttorvik.com/2027_team_results.csv
```

- 200, `text/csv`, 366 lines (header + 365 teams), sorted by rank. Fixture: `torvik/2027_team_results.csv` (first 20 lines).
- Header: `rank,team,conf,record,adjoe,oe Rank,adjde,de Rank,barthag,rank,proj. W,Proj. L,Pro Con W,Pro Con L,Con Rec.,sos,ncsos,consos,Proj. SOS,Proj. Noncon SOS,Proj. Con SOS,elite SOS,elite noncon SOS,Opp OE,Opp DE,Opp Proj. OE,Opp Proj DE,Con Adj OE,Con Adj DE,Qual O,Qual D,Qual Barthag,Qual Games,FUN,ConPF,ConPA,ConPoss,ConOE,ConDE,ConSOSRemain,Conf Win%,WAB,WAB Rk,Fun Rk,adjt`
- The header has two columns named `rank` (overall rank and barthag rank), so parse by index. Team names are Torvik spellings (e.g. `Missouri St.`), so they need a name-to-ESPN-id map.

## Bart Torvik four factors — WORKS (early-season gaps)

```
https://barttorvik.com/2027_fffinal.csv
```

- 200, `text/csv`, 366 lines. Fixture: `torvik/2027_fffinal.csv` (first 20 lines).
- Header: `TeamName,eFG%,Rk,eFG% Def,Rk,FTR,Rk,FTR Def,Rk,OR%,Rk,DR%,Rk,TO%,Rk,TO% Def.,Rk,3P%,rk,3pD%,rk,2p%,rk,2p%D,rk,ft%,rk,ft%D,rk,3P rate,rk,3P rate D,rk,arate,rk,arateD,rk`
- The header repeats `Rk`/`rk`, so parse by index. It is not sorted by rank.
- Early season: 2 teams (e.g. Southern Utah, Missouri St.) are all zeros, and some rows have a trailing empty field. Treat all-zero rows as "no data yet".
