# Review round 4: harsh-critic pass on the live site

Captured from **https://rhicksrad.github.io/NCAAM/** after #243 merged and Deploy finished
(snapshot built 20:19 UTC). Each page loaded in a fresh browser context, so no cached CSS. Shots
come from installed Chrome in a visible window with a normal User-Agent, desktop 1360x900 (`d-*`)
and phone 390x844 with mobile emulation (`p-*`).

**Live game:** `401920073` Kansas City vs George Mason, 1st half (11:36 when captured). Files
`*-live-401920073-a-*` are an earlier live capture (13:58 1st, before #243); I kept them because
they show the chart at an earlier clock.

**Correction to round 3:** I wrote "console is clean on every captured page". That was wrong: my
script filtered out logo errors before counting. The index and games pages still log 4 x 404
(logos 353 and 3229, each tried at espncdn and again at `data/logos/`).

## What you asked for

1. **Home** (`d-index-1..4`, `p-index-1..9`): the Main Event centre-court panel shows the live KC-GMU
   game in team paint with clock "11:36 1ST" and scores 9-16, above the tickets. On phone it reads
   well: KC | clock | GMU, with a "MAIN EVENT · Live now" bar. "From the lab" is five chalkboard
   tiles at the foot (5-up on desktop, stacked on phone).
2. **Live:**
   - `d/p-games-live-*`: the live ticket gets an orange clock block with the running score.
   - `d/p-game-live-401920073-*`: the lead chart stops at the current clock. Bars end about 8.5
     minutes into the 1st half and the rest of the axis is empty. Correct.
3. **Lab** (`*-lab-2025`, `*-lab-gonzaga`, `*-lab-tape-mid`, `*-lab-tall-*`):
   - 2025 shows exactly one gold dot, top right: the champion.
   - "Gonzaga" in Follow a team draws the chalk road and the label, and the readout says
     "2024-25 Gonzaga (WCC): 25-8 … Round of 32 as **a 8 seed**". That should be "an 8 seed".
   - Mid-run capture is at 2015, with the button reading STOP and the Gonzaga road following.
   - Tall order is captured.
4. **Players phone:**
   - `p-players-swiped-*`: the leader strip swipes, and the name column stays pinned while the
     stats scroll (TO/FG%/3P%/FT% visible next to the names). Works.
   - In `p-players-swiped-2` the nav also looks scrolled, because my script scrolled every
     overflow container. That's my artefact, not a bug.
   - Teams phone is two-up. Standings desktop columns line up with no holes. Rankings desktop
     shows five banners.
5. **ESPN blocked** (`d/p-blocked-game-401920073`): every `*.espn.com` request was aborted. The page
   shows the saved scoreboard (9-16, 11:57 1ST) under an amber note: "ESPN's feed didn't answer
   just now. This is the scoreboard as saved Nov 12, 3:19 PM; the box score is not on file. Try
   again." No error page. Works.
6. **Lighthouse, mobile preset, live site after #243:**

   | page | perf | a11y | best | SEO | LCP | CLS | TBT |
   |---|---|---|---|---|---|---|---|
   | home | **65** | 100 | 96 | 100 | 3.6 s | **0.746** | 140 ms |
   | lab | 79 | 100 | 100 | 100 | 2.5 s | 0 | **750 ms** |
   | players | 74 | 96 | 100 | 100 | 2.9 s | 0 | **880 ms** |

   An earlier full sweep (before #243) gave: game final perf 62, CLS 0.29, TBT 630; games CLS
   0.717; standings CLS 0.69; team 150 perf 71, CLS 0.29; about, teams, rankings and pre-game all
   96-100.

   CLS cross-check: I measured layout shifts myself in Chrome (4x CPU, slow network, mobile). Home
   came out at only 0.024 (`#home-games.tickets` moving at 2.3 s), and games, standings and team at
   0. The 0.7 numbers are therefore load-timing dependent: probably the main-event panel or the
   ticket list arriving late on Lighthouse's slower simulated load. The game page reproduced
   exactly: **`footer.baseline` jumps 0.29** when the box score lands. Reserve height for the box
   score and play-by-play (or render a skeleton) so the footer doesn't move. On home, reserve the
   main-event panel's height before data arrives.

   Accessibility (axe, live, after #243): every colour-contrast failure is gone. What's left:
   - players: `aria-expanded` on `<tr>` (50 rows, serious; needs `role="treegrid"`, or put the
     toggle on a button inside the row);
   - game pages: the scrollable play-by-play `<ol>` isn't keyboard-focusable (add `tabindex="0"`);
     there's no `<h1>`; and the linescore has an empty `<th>`.

## Looks off, cramped, low-contrast, slow or generic

- **Live box score: "Did not play"** shows for bench players who simply haven't checked in yet,
  mid-first-half. During a live game it should be blank, or "Not in yet".
- **FT% "100 vs 0"** when George Mason is 0-0 from the line. ESPN sends "0" for 0-0; show a dash.
  The same issue will hit FG% and 3P% early in games.
- **Lead chart sizing:** on desktop the box is about 600 px tall even two minutes into a game, so
  most of the first viewport is empty chart. On phone it's the opposite: a shrunk desktop SVG
  whose axis labels ("GMU +9", "1st half") are about 6 px and unreadable.
- **Phone chalkboard** (`p-lab-*`): the same problem. Axis text and the team tag are tiny, and the
  dots blur into one mass. It's the site's showpiece and it's weakest on the phone.
- **Tall order** (`d-lab-tall-1`): the chart occupies a 350 px box and leaves a big empty maple
  field to the right and below. The "median 6'5.5"" label collides with the "6'6"" tick.
- **Home desktop** (`d-index-2/3`): Press Row ends halfway down, leaving the right column as bare
  floor beside six more screens of tickets. The layout feels unbalanced.
- **Phone nav:** it still ends in a "TE…" sliver with no fade or arrow.
- **Copy:** "a 8 seed" should be "an 8 seed".
- **Console noise:** the 404 pairs for logos 353 and 3229 (see the correction above).

## The three weakest things on the site, in my judgement

1. **The phone home page is nine screens of near-identical ticket stubs.** 29 games stacked one
   per row push the poll, the news and the lab below 6-7 screens of scrolling. Show the best 6-8
   games, then a "+21 more on the slate" link to Scores. Let the rafters and press row sit
   higher.
2. **The clever charts don't survive the phone.** The chalkboard, the lead chart and Tall order
   are desktop SVGs scaled down, with unreadable labels. Phone layouts need their own aspect
   ratio and type sizes (labels at least 11 px, fewer gridlines, a bigger tag for the followed
   team).
3. **Speed and stability are still mid-pack for a site whose brief is "runs fast".** Mobile
   Lighthouse perf is 62-79 on home, game, lab, players and team. Main-thread blocking is
   750-880 ms on lab and players: those 4,396 rows and 4,602 dots are built on load. Render
   lazily, or chunk the work into idle callbacks. Fix the game-page footer shift.
