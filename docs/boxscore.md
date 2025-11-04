# Derived Box Score Aggregation

The game page does not rely on a vendor-provided box score feed. Instead, we
hydrate per-player and team totals directly from the play-by-play stream exposed
by the Cloudflare worker proxy.

## Normalization

The proxy response for `/games/:id/playbyplay` is normalized in
[`src/lib/api/ncaam.ts`](../src/lib/api/ncaam.ts). The helper:

```ts
const events = await getGamePlayByPlay(gameId);
```

returns an ordered list of lightweight play events. Each event includes:

- the raw description, clock, period, and score snapshot
- the team context for the play
- normalized participants (shooter, rebounder, assister, etc.)
- normalized statistics (shot attempt, rebound type, foul type, turnover, and so
  on)
- a boolean `isScoringPlay` flag that is set when the event awarded points

These normalized records are shared across the play feed UI and the box score
aggregator so that both features work from the same data set.

## Aggregation

[`src/lib/boxscore.ts`](../src/lib/boxscore.ts) walks the normalized events to
accumulate field goal, three-point, free throw, rebound, assist, steal, block,
turnover, foul, and point totals for every player encountered. Team totals are
kept in sync as each statistic is processed, including team-only rebounds and
turnovers that are not credited to a specific player.

Starters are identified via lineup markers in the feed, while everyone else is
assigned to the bench group. Minutes played are derived when the play-by-play
stream exposes a `seconds_played` statistic for the participant. When that data
is missing the minutes column shows an em dash instead of trying to guess.

The aggregation also handles edge cases that routinely appear in college
basketball logs:

- overtime periods are treated the same as regulation possessions
- technical fouls add both the penalty to the committing player and the free
  throw to the shooter
- blocks, steals, and assists are properly paired with their parent plays even
  when the statistical record omits a direct `player_id`

## Usage

1. Request the play-by-play payload via the proxy helper.
2. Feed the normalized event list into `buildBoxScoreFromPlayByPlay` alongside
   the game metadata.
3. Render the resulting `GameBoxScore` object — the game page relies on
   `renderGameBoxScore` in [`src/pages/game/GameBoxScore.ts`](../src/pages/game/GameBoxScore.ts).

Because the box score is derived locally it stays consistent with the live play
feed and never exposes upstream worker credentials.

## Limitations

- Minutes are only displayed when the feed supplies explicit seconds played. No
  attempt is made to infer run time from substitutions.
- Play-by-play feeds occasionally omit participants for team-controlled events.
  Those contributions are still reflected in team totals, but the individual row
  will remain blank.
- The aggregator assumes that play events arrive in chronological order. The
  helper sorts by the sequence field to mitigate out-of-order payloads, but
  severely malformed feeds may still surface inconsistencies.

## Testing

Vitest coverage under `tests/boxscore/boxscore.test.ts` exercises the
normalization and aggregation pipeline with a recorded fixture that includes
missed shots, technical fouls, team rebounds, and an overtime period.

