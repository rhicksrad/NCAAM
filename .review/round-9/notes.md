# Review round 9: after #248 (fe1cf16)

Live site after Deploy for fe1cf16 succeeded. Every page loaded in a fresh browser context.

- **My throttled runs:** Moto G emulation (412x823 at 1.75x), at **4x CPU / 150 ms / 1.44 Mbps**,
  **6x / 300 ms / 1 Mbps**, and once **8x / 400 ms / 0.8 Mbps**. PerformanceObserver plus
  resource timing, 3 runs each.
- **Lighthouse 12.2.1 mobile:** still unable to attribute elements on this Chrome. Its scores are
  fine.
- **Games:**
  - pregame: `401917176` Mercyhurst at Penn State (tested before it tipped), then `401911471` UC
    Riverside at San José State (10 PM ET);
  - final: `401925702`;
  - live during shots: `401925631` Bradley vs Coppin State.

## 1. Pregame: CLS and what moves

| run | 4x / 1.44 Mbps | 6x / 1 Mbps | 8x / 0.8 Mbps (401911471) |
|---|---|---|---|
| 1 | 0.075 | 0.075 | 0.038 |
| 2 | 0 | 0.075 | 0.038 |
| 3 | 0 | 0.075 | 0.038 |

**The scoreboard is the same height in both paints:** `section.board` stays at 233 px from the
snapshot paint (about 2.6 s) through the live paint (about 3.6 s). The form guide ("Coming in") is
the last block. Both are fixed.

What still moves, from a 120 ms timeline at 6x / 1 Mbps on 401917176:

1. **Snapshot paint:** `section.board` (233 px), then `p.loading` "FETCHING THE BOX SCORE…"
   (95 px) at y 373.
2. **Live paint, first frame:** `p.loading` is replaced by `div.game-cols`. In that frame the
   **Tale of the Tape `section.sheet` is 544 px tall but still empty** (header 69 px, `div.cmp`
   86 px, no text). The two notes ("NOT TIPPED YET…" and "OFFICIALS: …") sit at **y 962 and
   1078**.
3. **About 130 ms later**, the sheet fills ("40 FG% 48 / 22 3PT% 26") and **shrinks 544 → 154 px**.
   The notes **move up 390 px to y 572 and 688**.

Layout-shift attribution reports this as the two `p.also` nodes appearing (h 0→71 at y 572 and
y 688). At the slower setting on 401911471, only the first `p.also` registers (0.038).

**Fix:** render Tale of the Tape at its final size, with its rows, in the same frame as
`game-cols`. Alternatively, have the snapshot paint already include the "Not tipped yet" and
officials notes, since both are known from the slate, so the live paint replaces like with like.
It's under Lighthouse's 0.1 "good" line, but it's the last visible jump on the site.

## 2. LCP on phone, and which art is fetched

| width | game page fetches | lab fetches |
|---|---|---|
| 390 (phone) | `scoreboard-sm.webp` only | `chalkboard-sm.webp` only |
| 700 | `scoreboard-sm.webp` only | `chalkboard-sm.webp` only |
| 1360 | `scoreboard.webp` only | `chalkboard.webp` only |

`scoreboard-sm.webp` is 17.2 kB (was 82.8 kB), and `chalkboard-sm.webp` is 7.6 kB (was 52.9 kB).

**The art looks fine.** At 390 with 2x pixel density (`final-390.jpg`), and at 700 (`final-700`,
`lab-700`), there's no visible blockiness on the scoreboard rivets and bulbs or on the
chalkboard's court lines and smudges.

LCP phases at 4x / 1.44 Mbps (ms):

| page | LCP | TTFB | load delay | load time | render delay |
|---|---|---|---|---|---|
| game final 401925702 | **3,028-4,516** | 157-231 | 192-370 | 541-678 | **1,886-3,381** |
| game pregame 401917176 | 1,180-1,564 | 167-171 | 79-104 | 626-635 | 283-655 |
| lab | 2,084-2,440 | 170-172 | 84-132 | 520-528 | **1,307-1,618** |
| home | 1,604-1,828 | 171-237 | 85-108 | 793-815 | 517-668 |
| players | 1,396-2,056 | 164-221 | 698-822 | 327-350 | 206-662 |

Load delay and load time are both solved: the image is in hand within about 0.8 s on every page.
**What's left on the final game page is render delay of 1.9-3.4 s.** The scoreboard image has
arrived, but the board isn't painted until the script has also built the box scores, the lead
chart and the play-by-play. The pregame page, which has none of that, paints at 1.2-1.6 s. The
lab has the same pattern at 1.3-1.6 s, from building 4,602 chart dots before the chalkboard paints.

**Fix:** paint the board, then yield (`await new Promise(requestAnimationFrame)`, or
`scheduler.yield()`) before building the heavy sections. Do the same on lab after the chalk div,
before the dots.

## 3. Players on a slow phone

CLS **0 / 0 / 0** at 4x and **0 / 0 / 0** at 6x. Lighthouse: 0, 0, 0. **No jump when the
conference list fills. Nothing wrong.**

## 4. Team 150

axe: **zero violations** at 1360 and 390. The Roster and 2024-25 scorers scrollers have
`tabindex="0"` and labels ("Roster", "2024-25 scorers"). **Tab reaches both** at both widths
(`p-team150-focus-1/2`). **Nothing wrong.**

## 5. Home

- Lighthouse CLS over **5 runs: 0.003, 0, 0.089, 0.089, 0** (median 0.003).
- My runs:
  - 4x: 0, 0, 0
  - 6x: 0, 0, 0.003
  - 8x / 0.8 Mbps: 0.003, 0.003, 0.003

I still can't reproduce Lighthouse's 0.089. My harshest settings only show a 0.003 nudge.
- **Hero at 390** (`p-index-hero`): "29 games on the slate, 3 live right now, 1 with a ranked
  team." wraps naturally onto two lines. The box is 2 lines of text with even padding, and **the
  reserved room doesn't read as a gap**. Desktop (`d-index-hero`) fits on one line. **Nothing
  wrong.**

## 6. Lighthouse mobile: medians, r8 vs r9

| page | perf r8 → r9 | LCP r8 → r9 | CLS r8 → r9 (r9 runs) | TBT r8 → r9 |
|---|---|---|---|---|
| home (5 runs) | 95 → 92 | 2.56 → 3.11 s | 0.096 → **0.003** (0.003, 0, 0.089, 0.089, 0) | 0 → 96 ms |
| lab | 96 → 95 | 2.72 → **2.49 s** | 0 → 0 | 43 → 181 ms |
| players | 87 → **91** | 2.56 → 3.16 s | 0 → 0 (0, 0, 0) | 274 → 171 ms |
| game final | 90 → **94** | 3.39 → **3.05 s** | 0 → 0 | 156 → 21 ms |
| game pregame | 86 → **94** | 3.58 → **3.07 s** | 0.128 → **0.038** (0.038 x3) | 63 → 32 ms |
| standings | 100 → 99 | 1.67 → 1.82 s | 0.014 → 0.014 | 19 → 66 ms |
| teams | 100 → 95 | 1.68 → 2.85 s | 0.014 → 0 | 2 → 36 ms |
| team 150 | 99 → 99 | 1.99 → 1.97 s | 0 → 0 | 39 → 12 ms |

The ±0.5 s LCP swings on home, players and teams are run-to-run noise. Nothing on those pages
changed in #248, and my own runs put home at 1.6-1.8 s and players at 1.4-2.1 s. **Every CLS
median is now under 0.04.**

## 7. Console and axe: all 16 pages at 1360 and 390

The pages: home, scores, rankings, standings, teams, team 150, team 2400, players, lab, about,
final game, KC-GMU final, pregame 401911471, team 999999, game 1 and the 404.

- **axe: zero violations on every page at both widths.**
- **Console: zero errors**, apart from the expected ones: ESPN's 400/404 for the made-up ids, and
  the 404 page's own status.

## 8. Verdict

**Is "this is as good a site as Fable can make of this type" true today? Very nearly. One real
blocker is left.**

**Real blockers:**

1. **The final game page paints its scoreboard 1.9-3.4 s after the image arrives** (render delay),
   because the box scores, the chart and the play-by-play are built first. Its LCP is 3.0-4.5 s on
   a mid-range phone; the pregame page, which skips that work, paints in 1.2-1.6 s. Paint the
   board, yield, then build the rest. This is the page people sit on during a game.

**Polish, under any threshold but visible:**

- The pregame Tale of the Tape renders one empty 544 px frame before it fills. The notes below jump
  390 px (CLS 0.038-0.075).
- The lab chalkboard waits 1.3-1.6 s for the dots before it paints. Yield after the chalk div.
- Home: an unattributed 0.089 in 2 of 5 Lighthouse runs, never in mine (0.003 at worst).

**Optional taste:**

- In the home main event, Penn State's panel is painted chalk-white (their secondary colour), so
  next to Mercyhurst's green it reads as a blank box (`d-index-1`). Using navy for teams whose
  primary colour is white, or edging the panel, would make it read as paint.
- The live lead chart for an away team leading (Bradley) hangs from the top edge with the zero
  line at the very top (`d-live-bradley-1`). That's correct: home up, away down. But a chart that
  hasn't seen the home team lead could centre its zero line instead of pinning it to the top.

**Nothing wrong:**

- art variants (right files per width, no visible quality loss);
- players jump (gone);
- team-page keyboard and axe;
- home hero tally box;
- manifest, error pages and sticky toolbars (round 8);
- console and axe across all 16 pages.
