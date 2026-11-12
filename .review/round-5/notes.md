# Review round 5: after #244

Live site after #244 merged and Deploy finished (20:46Z, snapshot 20:46 UTC). Each page loaded in a
fresh browser context, so no cached CSS. Shots come from installed Chrome in a visible window with
a normal User-Agent. Live game: `401920073` KC vs George Mason, captured at half (33-37).

## 1. Lighthouse, mobile preset: median of 3 runs vs round 4

| page | perf r4 → **r5** | LCP r4 → r5 | CLS r4 → r5 | TBT r4 → r5 |
|---|---|---|---|---|
| home | 65 → **91** | 3.6 → 3.3 s | 0.746 → **0.000** | 140 → 162 ms |
| lab | 79 → **94** | 2.5 → 2.6 s | 0 → 0 | 750 → **187 ms** |
| players | 74 → **88** | 2.9 → 2.4 s | 0 → 0 | 880 → **390 ms** |
| game 401925702 (final) | 62* → **67** | 3.2 → 3.3 s | 0.29 → **0.000** | 630 → **1,290 ms** |
| standings | 76* → **94** | 1.6 → 1.7 s | 0.69 → **0.066** | 60 → 246 ms |
| teams | 99* → 95 | 1.5 → 1.6 s | 0.013 → 0.013 | 140 → 201 ms |
| team 150 | 71* → **98** | 2.0 → 2.0 s | 0.29 → **0.000** | 550 → 129 ms |

\* single run from the round-4 full sweep. All r5 values are medians of 3. Accessibility 96-100,
best practices 96-100, and SEO 100 throughout.

**CLS above 0.05:** only standings (0.066 in 2 of 3 runs, 0 in the third). Lighthouse returned no
shift detail, and I couldn't reproduce it myself: 0.000 in three throttled runs. With fonts and
ESPN deliberately delayed 1.5-3 s, I got 0.008, moving `select#conf-pick` and the nav links,
which is the web-font swap. So the 0.066 is load-timing dependent and I can't name the element
with confidence. The best candidates are the font swap on the conference picker, or the
conference sheets re-rendering when live standings replace the snapshot.

**The game page is now the slow page.** Its TBT of 1.29 s is mostly **Style & Layout: 1,561 ms**
(Script Evaluation is only 487 ms), with a 532 ms long task in the page script. The DOM is
heavy: 508 play-by-play rows plus two full box scores laid out at once. Render only the open
period's plays (or build them on toggle), and/or set `content-visibility: auto` on the box-score
and play-by-play sheets.

## 2. axe (WCAG A/AA plus best practice) on home, players, both game pages and lab

Only one finding is left:

- **serious `scrollable-region-focusable`**: on phones, the box-score `.sheet__scroll` containers on
  game pages (2 per page) can't be reached by keyboard. Add `tabindex="0"` and an `aria-label`.

The earlier findings are all fixed: players `aria-expanded` on `<tr>`, the game page `<h1>`,
the empty linescore `<th>`, and the play-by-play `<ol>` focus.

## 3. Shots

- **Home:**
  - `d-index-1..3`: Main Event (KC | HALF · LIVE | GMU, 33-37), eight tickets, then a
    "**+20 MORE ON THE SLATE →**" strip, Press Row in two columns, the rafters, and From the Lab.
  - Desktop is 2.8 screens. Phone (`p-index-1..6`) is **5.3 screens**, against your target of
    about 4. The five From-the-Lab boards stacked full width cost about 1.5 phone screens on their
    own. Two-up, or a horizontal swipe row, would get you to about 4.
- **Live game:**
  - `*-game-401920073-top/box/box2`: bench players who haven't entered read **"Not in yet"** (14
    of them, and no "Did not play" anywhere).
  - The phone lead chart is redrawn and fills the width, but its axis labels ("GMU +9", "1st
    half") are still very small, about 7-8 px on the phone.
  - **0-0 shooting dash: I couldn't verify it.** By halftime both teams had free-throw attempts, so
    no team-level 0-0 percentage was on screen. Player lines show "0-0" made-attempted, which is
    correct. Worth a unit test against a fixture.
  - Inconsistency: the home Main Event says **HALF**, but the game page header says **"0:00 1ST"**
    for the same game. The game page should say HALF too.
- **Lab, phone** (`p-lab-gonzaga-1/2`): the chalkboard is now a taller portrait board. The axis labels
  render at **9.6 px** (measured), which is readable. The Gonzaga tag and road are clear, and the
  readout now says "as **an** 8 seed".
- **Players, keyboard** (`*-players-kbd-expanded*`): Tab lands on the name button "Eric Dixon", and
  Enter expands "ERIC DIXON, SEASON BY SEASON". Works at both widths. On phone the season table
  is cramped: "Villanova Big East" and "Did not play - redshirt" wrap to 3 lines in a narrow
  column. Drop the conference or abbreviate there.

## 4. Logos in ESPN data (today's real feeds)

- **Scoreboard** `competitions[0].competitors[].team`:
  - 353 (Johnson & Wales) and 3229 (Virginia Lynchburg) have **no `logo` field**. The same goes
    for today's other two non-D1 opponents, 124946 (Lincoln CA) and 134743 (Grace CA).
  - All four also have `isActive: false`.
  - **Every Division I team** on today's slate (52 of 52) has a non-empty `team.logo`.
- **Summary** `header.competitions[0].competitors[].team`: there's no `logo` key for anyone. D1
  teams carry a **`logos` array** (14 variants), and 353 and 3229 have **no `logos` key at all**.
- **Team schedule** `events[].competitions[0].competitors[].team`: the same pattern. D1 opponents
  have `logos[]` (e.g. `.../teamlogos/ncaa/500/111.png`), while non-D1 opponents (353 at Boston
  U, 3229 at Coastal Carolina) have no `logos` key.
- Direct check: `a.espncdn.com/i/teamlogos/ncaa/500/353.png` returns **404**; `150.png` returns 200.

**Rule that works across all three feeds:** request a logo only when the feed gives one (`logo`
on the scoreboard, `logos[0].href` on summary and schedule). Otherwise draw the monogram fallback
straight away. That removes all the 404 pairs (still 4 per load on home and games right now).

## 5. The three weakest things now

1. **The game page is the slowest page on the site**, and during games it's the most-used one.
   Mobile perf is 67 with 1.3 s of blocking, almost all layout of the full play-by-play and box
   scores.
2. **The phone still has unfinished edges:**
   - the lead-chart labels are tiny;
   - the cramped season table in an expanded player row;
   - From the Lab costs 1.5 screens, so home is 5.3 screens, not about 4;
   - the nav still ends in a "TE…" sliver with no scroll cue.
3. **Small inconsistencies that a picky visitor will notice:**
   - HALF vs "0:00 1ST" for the same game;
   - logo 404s still in the console on the two busiest pages;
   - the one remaining axe failure (unfocusable box-score scrollers).

## Would I hand this over as the best site of its type I could make?

**Not yet, but it's close.** The design, the data honesty, the offline fallback and the lab
pieces are already better than most hobby sports sites, and most commercial ones. What stops me
signing off:

- the live game page has to be as fast as the rest (it's the heart of a scores site at 9 PM);
- the phone needs the four edges above finished;
- the console should be silent.

Fix those three items and I'd hand it over without hedging.
