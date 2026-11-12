# Review round 8: after #247 (04bcf33)

Live site after Deploy for 04bcf33 succeeded. Every page loaded in a fresh browser context. LCP and
CLS attribution come from my own runs (Moto G 412x823 at 1.75x, 4x CPU, 150 ms RTT, 1.44 Mbps,
3 runs each), plus a harsher set (6x CPU, 300 ms, 1 Mbps) where Lighthouse disagreed with me.
Lighthouse still can't attribute elements on this Chrome. No game was live this round. The
pre-game page is `401925631` Bradley vs Coppin State (6:00 PM ET).

## 1. Players: does `#players-root` still move?

**Yes, by less, and for a new reason.**

- My runs: **CLS 0.12 in 3 of 3.** `div#p-reg.segmented` moves y306→350 and `#players-root` moves
  y359→401 at about 2.6-3.1 s.
- Lighthouse: 0.12 in 1 of 3 runs (median 0).

Cause: the toolbar is now static, which is good. But the static Conference `<select>` holds only
"All", so it's narrow and the Regulars/Everyone toggle fits on the same row. When the script fills
in the 32 conferences, the select widens to its longest option. That pushes the toggle onto a new
row (+44 px) and moves the table with it. At full speed it's done before first paint, so you only
see it on slow phones.

**Fix:** give the select a fixed width (e.g. `width: 100%` or a set `ch`), or put the options in
the static HTML.

## 2. LCP with the preloads (my runs)

| page | LCP r7 → r8 | TTFB | load delay r7 → r8 | load time | render delay |
|---|---|---|---|---|---|
| game final 401925702 | 3.7-5.0 s → **2.3-2.8 s** | 171-184 | 2,000-3,186 → **80-118** | 1,452-1,738 | 293-1,067 |
| game pregame 401925631 | 2.6-4.0 s → **1.9-2.0 s** | 182-215 | 1,400-2,679 → **78-98** | 1,615-1,636 | 31-45 |
| lab | 3.2-4.9 s → **2.5-2.6 s** | 176-182 | 1,960-3,512 → **78-102** | 1,563-1,572 | 644-767 |

**Load delay is gone** (about 0.1 s). What's left is **load time**: the preloaded image itself
takes 1.5-1.7 s on a phone connection (2.4 s at 1 Mbps). `scoreboard.webp` is **82.8 kB** and
`chalkboard.webp` **52.9 kB**, both desktop-sized (1,400 px) and both served to phones.
Lighthouse's simulated LCP for the game pages is still 3.4-3.6 s (below).

**Fix:** the same trick as the hero. Add a `scoreboard-sm.webp` and `chalkboard-sm.webp` at
phone width (the hero went from 132.8 kB to 27.9 kB), selected by media query and preloaded with
`media=`. That should take about a second off phone LCP on game and lab.

## 3. Pre-game: any shift left?

**Yes, and it's worse on slow loads.** "Not tipped yet" now sits above the form guide (good:
`d/p-game-401925631-*`). But:

- At 4x CPU and 1.44 Mbps: one `p.also` appears (h 0→71, y 530). CLS 0.04 in 3 of 3.
- At 6x CPU and 1 Mbps: **two `p.also` paragraphs appear** (y 530 and y 671). About 1.1 s later one
  is removed (h 71→0). **CLS 0.129 in 3 of 3, exactly the 0.128 Lighthouse reports.**

The snapshot render and the live render each add the note, and then one is de-duplicated. Render
it once: ideally in the static skeleton, or by replacing the existing node instead of appending
another.

## 4. Manifest

`art/app-192.png` returns 200 and `art/app-512.png` returns 200, for both the "any" and
"maskable" entries. Chrome's manifest parser reports **no errors**. The only installability note
is `in-incognito`, which comes from my test context. **Nothing wrong.**

## 5. Error pages (`d/p-err-*`)

`team.html?id=999999`, `game.html?id=1` and `nope.html` now share the 404 look: the big **h1
"AIR BALL"**, "Nothing but floor. There is no team/game with that id.", the net art and a back
button. axe: **no findings** on them. **Nothing wrong.** As before, the bad-id pages log ESPN's
own 400/404 for the bad id, which is expected.

## 6. Phone standings and teams, sticky toolbar (390 and 360)

- `#standings-tools` and `#teams-tools` stick at **top 88 px**, flush under the 89 px masthead,
  56-61 px tall, with an opaque maple background. They don't cover rows: content scrolls cleanly
  underneath with no bleed-through (`p390/p360-standings-scroll-*`, `-teams-scroll-*`).
- Picking a conference mid-scroll works and scrolls to it (`p*-standings-picked`).
- Searching "state" on teams filters to 63 cards (`p*-teams-search`).
- **Nothing wrong** at either width.

## 7. Players leader strip

At 390 the third card starts at x 366, so **24 px of it shows**. At 360 it's the same (x 336,
24 px). The cut now lands just inside the card's edge, so only a sliver of the navy card and the
first digit of its value shows (`p390/p360-players-strip`). It reads as a swipe cue, not a bug.
Taste only: showing 30-40 px or snapping exactly to the edge would be cleaner.

## 8. Lighthouse mobile: median of 3, r7 vs r8

| page | perf r7 → r8 | LCP r7 → r8 | CLS r7 → r8 (r8 runs) | TBT r7 → r8 |
|---|---|---|---|---|
| home | 94 → **95** | 3.00 → **2.56 s** | 0.000 → **0.096** (0, 0.096, 0.096) | 107 → 0 ms |
| lab | 96 → 96 | 2.71 → 2.72 s | 0 → 0 | 54 → 43 ms |
| players | 92 → 87 | 2.56 → 2.56 s | 0.131 → **0.000** (0.12, 0, 0) | 92 → 274 ms |
| game final | 92 → 90 | 3.31 → 3.39 s | 0 → 0 | 33 → 156 ms |
| game pregame | 91 → 86 | 3.16 → 3.58 s | 0.089 → **0.128** (0.128, 0.128, 0.049) | 65 → 63 ms |
| standings | 98 → **100** | 2.34 → 1.67 s | 0.066 → 0.014 | 78 → 19 ms |
| teams | 99 → **100** | 1.67 → 1.68 s | 0.034 → 0.014 | 1 → 2 ms |
| team 150 | 99 → 99 | 1.83 → 1.99 s | 0 → 0 | 32 → 39 ms |

**Home's 0.096 (2 of 3 Lighthouse runs) didn't reproduce** in 6 of my runs, at both throttle
levels: all 0.000. I can't attribute it. The candidates are the same snapshot-to-live swap that
was fixed in #246, at a timing my runs don't hit.

## 9. Console and axe sweep: all 16 pages at 1360 and 390

The pages: home, scores, rankings, standings, teams, team 150, team 2400, players, lab, about,
final game, KC-GMU final, pregame, team 999999, game 1 and the 404.

- **Console:** zero errors, except the expected ones: ESPN 400/404 for the made-up ids, and the
  404 page's own 404 status.
- **axe:** one finding left, **serious `scrollable-region-focusable`** on **team pages**, where a
  wide table's `.sheet__scroll` overflows and isn't keyboard-reachable (team 2400 at 1360, team
  150 at 390). Game pages got `tabindex="0"` and a label in round 6. The team page's roster and
  scorers scrollers need the same.

## 10. Verdict

**Is "this is as good a site as Fable can make of this type" true today? Not yet. There are
four mechanical blockers, each a small change.** They're the only things I'd still hold back on.

**Real blockers, most important first:**

1. **The pregame page double-renders "Not tipped yet"** and removes one copy a second later.
   CLS 0.13 on slow phones, reproduced in every run and matching Lighthouse.
2. **Game-page LCP is 3.4-3.6 s in Lighthouse** (2.3-2.8 s in my runs). Now it's purely
   `scoreboard.webp` being 83 kB on phones. Ship a phone-size variant, as the hero did. Same for
   `chalkboard.webp` on lab.
3. **The players toolbar wraps late** when the Conference select fills, so the table jumps 44 px on
   slow phones. Fix the select's width.
4. **Team-page table scrollers aren't keyboard-focusable** (axe serious). Copy the game page fix.

**Unattributed:** home CLS 0.096 in 2 of 3 Lighthouse runs, never in mine. Worth one look after
1-3 land, since it may share their cause.

**Optional taste, not blockers:**

- The leader-strip sliver is 24 px. 30-40 px, or snapping to a card edge, would read more
  deliberately.
- The error and 404 pages leave a lot of empty floor below the fold at desktop. That's fine, but a
  second line (e.g. "Tonight: 29 games") would make them feel less bare.

**Nothing wrong:** manifest, error pages, sticky toolbars at 390 and 360, console, and every axe
check apart from item 4.
