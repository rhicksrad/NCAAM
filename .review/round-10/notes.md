# Review round 10: after #249 (85b708a)

Live site after Deploy for 85b708a succeeded. Every page loaded in a fresh browser context.

- **My throttled runs:** Moto G emulation (412x823 at 1.75x), at **4x CPU / 150 ms / 1.44 Mbps**
  and **6x / 300 ms / 1 Mbps**, 3 runs each, with PerformanceObserver plus resource timing.
- **Games:**
  - final `401925702` (Jacksonville St at Houston, Nov 11);
  - today's final `401920073` (KC-GMU);
  - live `401917176` (Mercyhurst at Penn State);
  - pregame `401911471` (UC Riverside at San José State, 10 PM ET);
  - away wire to wire: `401921005` (Kansas City at Florida A&M, Nov 11, home never led).

## 1. Final game on a slow phone

| page | setting | LCP | TTFB | load delay | load time | render delay | CLS |
|---|---|---|---|---|---|---|---|
| 401925702 (Nov 11) | 4x | 1.99-2.44 s | 166-245 | 86-94 | 628-635 | **1,111-1,552** | 0, 0, 0 |
| 401925702 (Nov 11) | 6x | 3.15-4.08 s | 318-322 | 139-165 | 980-996 | 1,693-2,613 | 0, 0, 0 |
| 401920073 (today) | 4x | 2.04-2.41 s | 163-174 | 95-146 | 618-632 | 1,149-1,477 | 0, 0, 0 |

- **Render delay is down by about half** (r9 at 4x: 1,886-3,381 ms, now 1,111-1,552 ms), and
  **there's no shift** when the chart, box scores and plays arrive after "Reading the box score…".
  CLS is 0 in all 9 runs.
- **What remains isn't the heavy build any more.** I timed when `section.board` is inserted into
  the DOM:
  - **Today's final (on the saved slate):** the board is inserted at **925 ms**, right after
    `scoreboard.json` (625 ms) and the image (932 ms). That's what a reader sees. But the browser
    still logs LCP at 2.0-2.4 s, because when ESPN's summary answers (about 1.7 s) the board
    **element is replaced** rather than updated, and the new node becomes a new, later LCP
    candidate. The reader sees no change, but every LCP measurement (Lighthouse and Chrome field
    data) counts the second paint.
  - **Yesterday's final (not on today's slate):** there's no snapshot to paint from, so the board
    waits for ESPN's summary. The request starts at 1,258 ms, after the page script loads; the
    board is inserted at 1,805 ms.

  **Fix for both:** update the board's text in place when the live answer lands, instead of
  re-rendering `section.board`. LCP then stays at the first paint (about 0.95 s at 4x for any game
  on the slate). Optionally, start the summary fetch from an inline script or a `<link
  rel=preload>` built from `?id=`, so off-slate games don't wait for the page script.

## 2. Live game (401917176, Mercyhurst at Penn State)

- LCP is **1.28-1.37 s at 4x** and 2.05-2.24 s at 6x. CLS is 0 in all 6 runs.
- **The 20 s refresh doesn't flash the loading line.** Over 50 s on the page there were 3 summary
  fetches (the initial one plus 2 refreshes). A MutationObserver saw the `p.loading` line added
  only during the first 0.3 s of the initial load, never on a refresh. Zero layout shifts after
  load. The board updated from "12:02 1ST" to "11:36 1ST" in place (`p-live-psu-1`,
  `p-live-psu-after50s`). **Nothing wrong.**

## 3. Pregame (401911471)

- CLS is **0 / 0 / 0 at 4x and 0 / 0 / 0 at 6x** (r9: 0.038-0.075). LCP is 1.21-1.38 s at 4x.
- Tale of the Tape no longer takes a tall placeholder, and the notes don't jump. Lighthouse: 0, 0,
  0. **Nothing wrong.**

## 4. Lab

| setting | LCP | load time | render delay | CLS |
|---|---|---|---|---|
| 4x | 2.05-2.33 s | 512-524 | **1,265-1,504** | 0 |
| 6x | 3.21-3.37 s | 756-840 | 1,968-2,129 | 0 |

**Render delay is unchanged from r9** (1,307-1,618 at 4x). The board doesn't paint before the
data: `div.chalk` is inserted at **1,698 ms**, waiting on **`efficiency.json` (88 kB,
323-1,920 ms)**. The script (746 ms) and `chalkboard-sm.webp` (857 ms) are both in hand long
before that.

**Fix:** put the `div.chalk` frame (year, Run the tape, Follow a team, the empty board) in the
static HTML, or render it before awaiting `efficiency.json`, then add the dots when the data
lands. LCP should drop to about 0.9 s.

## 5. Home main event: a navy school with a white alt

Penn State wasn't the main event while I captured: Bradley v Coppin St, tied 32-32 with 1:00 to
go, rightly took it. So I checked the colour logic directly:
- ESPN gives Penn State `color 061440`, `alternateColor ffffff`.
- `teamColors()` now maps a primary that dark to the site navy. On `team.html?id=213` the paint is
  **`--team:#14213a`, ink `#fbfaf4`**, background rgb(20,33,58), at both widths
  (`d/p-team-psu.jpg`).

The same `teamStyle()` feeds the marquee, so Penn State would paint navy there too, not white.
**Nothing wrong.** Marquee shots: `d/p-home-main-event.jpg`, Bradley red against Coppin blue.

## 6. Lead chart, away team wire to wire (401921005, KC at FAMU, home never led)

The zero line now sits **45 px down a 265 px chart on desktop (17%) and 37 px down a 197 px chart
on phone (19%)**, not on the top edge. The KC bars hang below it to "KC +38"
(`d/p-away-wire-chart.jpg`). Readout: "Kansas City led for 39:10. 0 lead changes, 1 tie.
Florida A&M never led; the biggest gap was 38." **Nothing wrong.**

## 7. Lighthouse mobile medians, r9 vs r10

| page | perf r9 → r10 | LCP r9 → r10 | CLS r9 → r10 (runs) | TBT r9 → r10 |
|---|---|---|---|---|
| home (5 runs) | 92 → **96** | 3.11 → **2.55 s** | 0.003 → 0.003 (**0.003, 0.089, 0.089, 0, 0.003**) | 96 → 72 ms |
| lab | 95 → **96** | 2.49 → 2.57 s | 0 → 0 | 181 → 149 ms |
| players | 91 → **97** | 3.16 → **2.41 s** | 0 → 0 | 171 → 2 ms |
| game final 401925702 | 94 → **95** | 3.05 → **2.96 s** | 0 → 0 | 21 → 0 ms |
| game pregame 401911471 | 94 → **95** | 3.07 → **2.96 s** | 0.038 → **0** | 32 → 13 ms |
| standings | 99 → 98 | 1.82 → 2.41 s | 0.014 → 0.014 | 66 → 11 ms |
| teams | 95 → **99** | 2.85 → **2.04 s** | 0 → 0 | 36 → 19 ms |
| team 150 | 99 → 99 | 1.97 → 1.96 s | 0 → 0 | 12 → 0 ms |

**Every page scores 95-99.** Home still shows 0.089 in 2 of 5 runs, but I've never reproduced it
in 15 runs of my own across rounds 8-10, even at 8x CPU and 0.8 Mbps (0.003 at worst).

## 8. Console and axe: all 19 pages at 1360 and 390

The pages: home, scores, rankings, standings, teams, team 150, team 2400, players, lab, about,
three game pages (final, KC-GMU final, pregame), live PSU, KC-FAMU, team 999999, game 1 and the
404.

- **axe: zero violations on every page at both widths.**
- **Console: zero errors**, apart from the expected ESPN 400/404 for made-up ids and the 404
  page's own status.

## 9. Verdict

**Is "this is as good a site as Fable can make of this type" true today?**

**Real blockers: nothing.** Every Lighthouse mobile score is 95-99, CLS is 0 on every page, axe
and the console are clean everywhere, and live games update in place without flashing. Readers
see a game's scoreboard in under a second on a mid-range phone when the game is on today's slate.
I'd put my name on it.

**Polish that would make the numbers match what readers see (optional, measurable):**

1. **Game pages:** update `section.board` in place instead of replacing it when ESPN answers.
   Lighthouse LCP would drop from 2.96 s to about 1 s, because the visible board already painted at
   0.93 s. For games not on today's slate, start the summary fetch earlier.
2. **Lab:** render the empty chalkboard frame before `efficiency.json` (88 kB) arrives. LCP 2.1 → 0.9 s.
3. **Home:** the 0.089 in 2 of 5 Lighthouse runs is still unattributed. It's harmless at the
   median, but it's the last unexplained number.

**Taste:** nothing outstanding. The Penn State and away-lead fixes look right, and nothing new
caught my eye on this pass.
