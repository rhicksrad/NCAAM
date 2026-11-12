# Review round 6: sign-off round, after #245 (7a5a43d)

Live site after the Deploy for 7a5a43d succeeded. Every page loaded in a fresh browser context.
Shots come from installed Chrome in a visible window with a normal User-Agent, phone 390x844 with
mobile emulation and desktop 1360x900. Live game during the round: `401920073` KC vs George Mason,
2nd half. No game was at halftime, so I couldn't check the "Halftime" status this round.

## 1. Lighthouse mobile: median of 3, r5 vs r6

| page | perf r5 → r6 | LCP r5 → r6 | CLS r5 → r6 | TBT r5 → r6 |
|---|---|---|---|---|
| home | 91 → **86** | 3.3 → 3.5 s | 0.000 → **0.110** | 162 → 124 ms |
| lab | 94 → **88** | 2.6 → 2.7 s | 0 → 0 | 187 → 337 ms |
| players | 88 → 88 | 2.4 → 2.4 s | 0 → **0.131** | 390 → 257 ms |
| game 401925702 (final) | 67 → **94** | 3.3 → 3.0 s | 0 → 0 | 1,290 → **71 ms** |
| standings | 94 → **99** | 1.7 → 1.7 s | 0.066 → 0.066 | 246 → 21 ms |
| teams | 95 → 98 | 1.6 → 1.8 s | 0.013 → 0 | 201 → 106 ms |
| team 150 | 98 → **91** | 2.0 → 2.0 s | 0 → 0 | 129 → 370 ms |
| game 401920073 (**live**, new) | – | 3.2 s | 0 | 219 ms → perf **76** |

The per-run CLS values vary a lot:

| page | run 1 | run 2 | run 3 |
|---|---|---|---|
| home | 0.149 | 0.110 | 0.024 |
| players | 0.131 | 0.131 | 0 |
| standings | 0.066 | 0 | 0.066 |

Lighthouse again returned no shift details. Using its exact phone emulation (Moto G, 412x823 at
1.75x, no throttling), I caught the **home** shift once: **`div#home-games.tickets` moves up 46 px
(y 491→445) and grows 46 px** at about 1.4 s. That's the live paint replacing the snapshot paint:
the block above the tickets gets 46 px shorter when live data arrives. Lock that block's height,
or render the snapshot with the same line count as live (e.g. the "N games, 1 live, 1 ranked" line
or the main-event panel). I couldn't reproduce the players (0.131) or standings (0.066) shifts in
9 runs of my own (all 0.000). Both are load-timing dependent, likely the same snapshot→live swap.

The final game page is fixed: 67 → 94, with TBT down from 1.29 s to 71 ms. The lab and team-150
dips (TBT 187 → 337 ms and 129 → 370 ms) are within the run-to-run noise I've seen, but they're
worth a look. **LCP is still above 2.5 s** on home (3.5 s), both game pages (3.0-3.2 s) and lab
(2.7 s).

## 2. axe (WCAG A/AA + best practice)

Home, players, final game 401925702, live game 401920073 and lab, at 1360 and 390 wide:
**zero violations**.

## 3. Console, each page loaded twice: ESPN blocked (snapshot paint only) and normal (snapshot then live)

| page | snapshot only | normal |
|---|---|---|
| index | 0 errors, 0 failed requests | 0 / 0 (first ESPN response at 318 ms) |
| games | 0 / 0 | 0 / 0 |
| game 401925702 | 0 / 0 | 0 / 0 |
| team 104 Boston U (plays J&W, 353) | 0 / 0 | 0 / 0 |
| team 324 Coastal Carolina (plays Virginia Lynchburg, 3229) | 0 / 0 | 0 / 0 |

**Zero logo 404s from either the snapshot paint or the live paint.** The console is silent on all
five pages. The only console errors I found anywhere were on deliberately bad ids (see "Noticed"
below).

## 4. Phone shots

- **Home** (`p-index-1..5`): **4.61 screens** (was 5.3).
  - The order is: main event (live KC 35, GMU 43, 15:31 2ND), five tickets, the
    "**+23 MORE ON THE SLATE →**" strip, Press Row, In the Rafters, then From the Lab.
  - From the Lab is **two-up** (grid 174px 174px). The odd fifth board makes the first one full
    width: 1 + 2x2.
- **Nav:**
  - On index (`p-index-nav`) the right edge shows a "›" arrow (`::after` content "›").
  - On lab.html (`p-lab-nav`) the strip starts scrolled (scrollLeft 234) so **THE LAB** is fully
    visible and marked current. Both work.
- **Final game top** (`p-final-top`): the lead-chart labels ("1st half", "2nd half", "HOU +46")
  render at **13.5 px** (12.7 px glyph box). That's readable now.
- **Play-by-play** (`p-final-pbp-button`, `-after-click`, `-other-half`):
  - The 2nd half opens with 41 plays and a "**SHOW THE OTHER 205 PLAYS**" button. Clicking it
    fills the half to 245.
  - Opening 1st half gives 41 plays plus "SHOW THE OTHER 223 PLAYS". Clicking that fills it to 263.
  - 245 + 263 = 508 = every play. Works.
- **Expanded player row** (`p-players-expanded`): the season table now fits on the phone. The team
  name has no conference suffix, and "Did not play - redshirt" fits on one line.
- **Live game top** (`p-live-401920073-top`): KC 35, GMU 43, "14:59 2ND", with the linescore
  showing a 2nd-half column.

## 5. Keyboard, final game page at phone width

Tab reaches the box-score scroller, `aria-label="Jacksonville State box score"`. The focus ring
is a **solid 2.7 px outline in rgb(200,68,15)**, clearly visible (`p-final-box-focus`). Six
presses of ArrowRight scroll it from 0 to 240 px (`p-final-box-arrowed`). Works.

## 6. Would "this is as good a site as Fable can make of this type" be true?

**Not quite yet. It's one short round away.** I'd put my name on the design, the data honesty,
the offline fallback, the accessibility (axe-clean) and the console (silent). What's still in
the way, most important first:

1. **Loading still jumps on the home page**, and it's the first thing anyone sees. Lighthouse CLS
   median is 0.110, and my own run pinned it to `#home-games` jumping 46 px when the live data
   replaces the snapshot. Players (0.131) and standings (0.066) show the same symptom in 2 of 3
   Lighthouse runs. "Runs fast" should also mean "doesn't move". Make the snapshot paint and the
   live paint the same height for every block above the fold.
2. **LCP is above 2.5 s** on home (3.5 s), the game pages (3.0-3.2 s) and lab (2.7 s), and the live
   game page scores 76 against 94 for the final one. For a scores site the live game page is the
   one that matters at 9 PM. Check what the LCP element is: probably the hero art on home and the
   scoreboard on game pages. Preload that image or font, and make the scoreboard paint from the
   snapshot immediately.
3. **Error states blame the wrong thing and leak debug text.** `team.html?id=999999` says "We
   couldn't load that team. ESPN's public feed may be down or blocked on your network", then
   shows "**unknown team**" in plain text. `game.html?id=1` does the same with "**ESPN answered
   404**". A missing id isn't ESPN being down. Say "No team with that id" with a link to Teams
   (or Scores), and keep the raw reason out of the page. (These are the only console errors on
   the site: 400 and 404 from ESPN for the bad ids, which is expected.)
4. **The phone poll is long.** In the Rafters, the 25 rows take about 1.2 phone screens on home.
   Show 10 plus "Full poll →", which also gets home under about 4 screens.
5. **Small polish:**
   - there's no web app manifest (`manifest.webmanifest` 404s), so "Add to Home Screen" gets a
     plain bookmark;
   - the From the Lab grid's odd first card (1 + 2x2) looks accidental rather than designed:
     either make 01 deliberately the feature card, with a different treatment, or add a sixth tile.

## Noticed elsewhere (nobody asked)

- **About page**: it publishes a personal Gmail address for takedown requests. That's fine if
  Ryan wants it, but it will collect spam. A GitHub issue link would do the same job.
- **Halftime label:** not verifiable this round. No game was at half; KC-GMU had already gone to
  the 2nd half.
- **Custom 404 page exists** ("Air ball — Field House"), and the social card (`og:image`,
  `summary_large_image`, `theme-color`) is all present. Good.
- `game.html` with no id shows "WHICH GAME? Pick one from the scoreboard." Good.
