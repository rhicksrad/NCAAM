# Review round 2

Built from 655ac0c with a live snapshot (all feeds live), served on :4183. Captured with installed
Chrome in a visible window, normal User-Agent, desktop 1360x900 (`d-*`) and phone 390x844 with
mobile emulation (`p-*`), JPEG quality 75. No sideways scroll, no undefined/NaN, and no stale note
on any captured page.

- **Pre-game:** `401921741`, Montana State at No. 23 BYU, 9:00 PM ET. It's the only game today with
  a ranked team.
- **Live:** none. No game was in progress at capture time (about 19:35Z).
- **Small school, long name:** `2400` Mississippi Valley State Delta Devils.

## Your questions

**Does "Coming in" show real last-five results for both teams?** Yes, they're real, but it isn't
five yet: it shows every game played so far. Montana State "1-1 in the last 2" (W 83-70 Long Beach
St, L 74-84 at Colorado St); BYU "3-0 in the last 3" (Queens W 98-82, Omaha W 108-67, Ohio St
W 94-83). Scores match ESPN.
Two nits:
- Each list also includes the next two scheduled games ("up next"), which doesn't fit a heading
  that means form coming in.
- The two cards come out at different heights (4 rows vs 5), so the boxes don't line up
  (`d-pre-401921741-1/2`).

**Does "best first" put the ranked game first?** Yes. The first card on the home page is 9:00 PM
Montana St at 23 BYU, ahead of the 3:00 and 6:00 games (`d-index-1`, `p-index-1`).

**Does the lead chart on 401925702 fill its box?** Yes. The red area now runs edge to edge and
uses the full height up to HOU +46 (`d-game-401925702-1`, `p-game-401925702-1/2`). On desktop
the box is tall enough that its bottom edge (the JXST axis label) lands just below the first
viewport, which is fine.

## Fixed since round 1

- Phone team schedule fits now: short dates, and the result/time column is fully visible
  (`p-team-150-1/2/3`).
- Phone home hero: the date sits on a navy band, clear of the court line.
- Lab Thin Air: the map and the "Highest home floors" table sit side by side and both fit in one
  desktop view (`d-lab-thin-air`).
- Long names: "MISSISSIPPI VALLEY STATE" wraps cleanly on desktop (2 lines) and phone (3 lines),
  and the Delta Devils logo and green paint look right.

## Still looks wrong or unfinished

1. **Phone final scoreboard** (`p-game-401925702-1`): "JACKSONVILLE" is the widest word and runs
   right up against the away score "46", with no gap between them. Shrink the team name a step on
   narrow screens, or stack the score under the names.
2. **Phone nav:** it still ends in a "T…" sliver at the right edge with no scroll cue (every `p-*`
   top shot).
3. **Pre-game "Coming in"**: see the nits above. Split "up next" into its own small list, or drop
   it, and equalise the card heights.
4. **Console:** index still logs 404 pairs for logos 353 and 3229 (espncdn plus the local
   fallback). These are non-D1 opponents with no logo anywhere, so it's only noise, but it's the
   only console output on any captured page.
