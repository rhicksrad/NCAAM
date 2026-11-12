# Review round 3 (unprompted check of the live deploy)

Captured from the **live site** https://rhicksrad.github.io/NCAAM/ right after #239 deployed
(snapshot built 2026-11-12 19:41 UTC). Same shot list and method as round 2: installed Chrome in a
visible window, normal User-Agent, desktop 1360x900 and phone 390x844.

The games are the same as round 2: pre-game `401921741` (Montana St at No. 23 BYU, 9:00 PM ET),
no game live, long name `2400` Mississippi Valley State.

## Checks

- No sideways scroll, no undefined/NaN, no stale note on any captured page.
- **Console is clean on every captured page.** The non-D1 logo 404s from rounds 1 and 2 are gone.
- Best first: the ranked BYU game is still the first card (`d-index-1`).

## Round-2 issues

- **Fixed:** the phone final scoreboard uses abbreviations ("JXST", "HOUSTON"), so the name no
  longer touches the "46" (`p-game-401925702-1`).
- **Fixed:** "Coming in" now lists played games plus a single "up next" row per team.
- **Better, not identical:** the "Coming in" cards still differ by one row in height (Montana St 3
  rows, BYU 4), because Montana St has played one game fewer. Bottom-aligning the cards or giving
  them a min-height would square them up.
- **Still there:** the phone nav ends in a "TE…" sliver with no scroll cue.

Nothing else looks wrong to me in this set.
