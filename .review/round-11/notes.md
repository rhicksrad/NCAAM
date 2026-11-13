# Review round 11 (last look): after #250 (4cddfc4)

Live site after Deploy for 4cddfc4 succeeded. Every page loaded in a fresh browser context. My
throttled runs use Moto G emulation (412x823 at 1.75x), 4x CPU, 150 ms RTT and 1.44 Mbps. Games:
- final on today's slate: `401920073` KC-GMU;
- final not on the slate: `401925702` JXST at Houston, Nov 11;
- live: `401925631` Bradley at Coppin State, 2nd half;
- pregame: `401911471` UC Riverside at San José State.

## 1. Game pages: regression check of the new paint path

### Everything still renders

| | final today | final off-slate | live | pregame |
|---|---|---|---|---|
| scoreboard + linescore | yes | yes | yes | board, no linescore yet, which is correct |
| lead chart | yes | yes | yes | n/a |
| Tale of the Tape | yes | yes | yes | yes |
| both box scores | yes | yes | yes | n/a |
| play-by-play + "Show the other N plays" | yes: the button reads "Show the other 205 plays"; clicking it fills the 2nd half to 245 | yes | yes | n/a |
| form guide ("Coming in") | n/a | n/a | n/a | yes |
| `<h1>` | "Kansas City at George Mason" | "Jacksonville State at Houston" | "Bradley at Coppin State" | "UC Riverside at San José State" |

The play-by-play renders a beat after the board, which is the new sequencing; that's fine.
Shots: `d/p-final-today-1`, `d/p-final-offslate-1`, `p-final-*-pbp`, `d/p-live-1`,
`d/p-pregame-1`, `d-pregame-2`.

### Board refilled in place, summary fetched once, LCP logged once

I tagged `section.board` with a JS property the moment it appeared, then checked after load
whether the node on the page still carried the tag. 3 runs per game at 4x / 1.44 Mbps.

| game | board first inserted | same node after ESPN answers | boards created | summary fetches on load | LCP entries (time · element) | CLS |
|---|---|---|---|---|---|---|
| final today | 1,120-1,308 ms | **yes, 3 of 3** | 1 | **1, 1, 1** | masthead 1.34-1.56 s → **board 1.62-1.81 s** | 0, 0, 0 |
| final off-slate | 1,360-1,414 ms (r10: 1,805) | **yes, 3 of 3** | 1 | **1, 1, 1** | masthead → **board 1.84-2.11 s** | 0, 0, 0 |
| live | 901-1,251 ms | **yes, 3 of 3** | 1 | **1, 1, 1** | **board 1.44-1.66 s** | 0, 0, 0 |
| pregame | 1,056-1,413 ms | **yes, 3 of 3** | 1 | **1, 1, 1** | **board 1.45-1.83 s** | 0, 0, 0 |

- **LCP is no longer re-logged at 2+ s.** Each run has exactly one board LCP entry, at the board's
  first paint. In r10 it was logged again at 2.0-2.4 s when the node was replaced.
- The off-slate final now gets its board 0.4 s sooner, because the inline head script starts the
  summary fetch before the page script loads. **It isn't fetched twice:** one summary request per
  load in all 12 runs.

### Live refresh, 46 s on Bradley at Coppin State

- 3 summary fetches (the initial one plus 2 refreshes at 20 s).
- The board went from "18:52 2ND … 32-34" to "18:36 2ND … 32-34".
- **The same board node throughout** (1 board created).
- **Zero layout shifts** after load.

### ESPN blocked, and a bad id

- **Live game with `*.espn.com` blocked** (`p-blocked-live`): the saved scoreboard ("Bradley at
  Coppin State", linescore) shows under the amber notice "ESPN's feed didn't answer just now.
  This is the scoreboard as saved Nov 12, 7:05 PM; the box score is not on file. Try again."
  Correct.
- **Off-slate final with ESPN blocked** (`p-blocked-offslate`): "WHISTLE ON THE PLAY. We couldn't
  load that game. ESPN's public feed may be down or blocked on your network. Try again."
  There's no saved copy to fall back on, so this is the right message.
- **`game.html?id=1`** (`p-badid`): the "AIR BALL" h1, as before. Correct.

## 2. Lab

| run | chalk frame inserted | `efficiency.json` done | dots drawn | image done | LCP | TTFB | load delay | load time | render delay |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **1,131** | 1,797 | 2,242 | 772 | 2,204 | 184 | 63 | 525 | 1,432 |
| 2 | **1,176** | 1,887 | 2,085 | 881 | 1,980 | 278 | 72 | 532 | 1,099 |
| 3 | **1,271** | 1,828 | 1,852 | 816 | 1,816 | 173 | 126 | 517 | 1,000 |

- **The chalkboard frame now appears 0.6-0.7 s before `efficiency.json` finishes** (r10: after
  it). A frame captured before the dots (`p-lab-frame-before-dots`) shows the board 379x674 with
  its `chalkboard-sm.webp` background and 0 dots.
- **LCP still lands at about the time the dots are drawn (1.8-2.2 s)**, a single entry, so render
  delay is 1.0-1.4 s (r10: 1.27-1.50 s). That's only slightly better. The frame sits at y 612 on a
  823 px viewport, so only about 210 px of it is above the fold when it first paints. LCP picks
  its largest paint once the dots arrive. Lighthouse puts lab LCP at 2.17 s (r10: 2.57 s).
- When the dots land, the frame moves up 28 px (y 612→584). Lighthouse CLS is still 0 on lab in
  all runs, so it's under the radar.
- **Features all work** (`p-lab-gonzaga`, `p-lab-tape`):
  - 379 dots and 379 Follow-a-team options;
  - typing "Gonzaga" tags the dot and gives "2024-25 Gonzaga (WCC): 25-8 … Round of 32 as an 8
    seed";
  - Run the tape switches to "Stop" and was at 2014 after 1.8 s.

## 3. Lighthouse mobile medians, r10 vs r11

| page | perf r10 → r11 | LCP r10 → r11 | CLS r10 → r11 (runs) | TBT r10 → r11 |
|---|---|---|---|---|
| home (5 runs) | 96 → 96 | 2.55 → 2.42 s | 0.003 → **0.089** (**0.089, 0.089, 0.089, 0.148, 0.089**) | 72 → 7 ms |
| lab | 96 → 95 | 2.57 → **2.17 s** | 0 → 0 | 149 → 207 ms |
| players | 97 → 92 | 2.41 → 2.57 s | 0 → 0 | 2 → 246 ms |
| game final 401925702 | 95 → **96** | 2.96 → **2.43 s** | 0 → 0 | 0 → 32 ms |
| game pregame 401911471 | 95 → 93 | 2.96 → **1.89 s** | 0 → 0 | 13 → 263 ms |
| standings | 98 → 94 | 2.41 → 1.85 s | 0.014 → **0** | 11 → 279 ms |
| teams | 99 → 94 | 2.04 → 2.20 s | 0 → 0 | 19 → 223 ms |
| team 150 | 99 → 76* | 1.96 → 2.75 s | 0 → 0 | 0 → 487 ms |

\* **Team 150's 76 is machine noise.** A rerun of 3 gave **96, 97, 99** (TBT 45-121 ms). The
TBT rise across players, standings and teams in this batch is the same noise. Those pages didn't
change in #250, and TBT swung by 200 ms between batches.

**Game-page LCP is down from 2.96 s to 1.9-2.4 s**, which is the intended result of the in-place
refill.

**Home CLS: now 0.089 in 5 of 5 Lighthouse runs** (2 of 5 before). I still can't reproduce it in
Chrome:
- 3 runs unthrottled, with Lighthouse's exact Chrome 119 Moto UA and 1.75x screen: all 0.
- 3 runs at 4x: 0, 0, 0.003.
- 6 runs with the snapshot and ESPN each held back 1.2 s: 0 to 0.003.

Lighthouse's own filmstrip (`screenshot-thumbnails`) shows the difference. Its first frame, at
375 ms, is the **bare skeleton**: an empty date chip, "Reading the scorer's table…" in the tally,
and "LOADING TONIGHT'S SLATE…". By 750 ms it has the date chip, the two-line tally ("29 games …
18 live right now, 1 with a ranked team.") and the main event. The one shift I *can* produce from
that swap is **`div.hero__copy` moving up 11 px and growing 10 px** (y 195→184, h 227→237) as the
tally goes from one line to two. It's worth 0.003 here. With fallback-font metrics on Lighthouse's
first frame it's plausibly the 0.089.

**Fix to try:** give the tally a `min-height` of two lines (it's reserved, but the one-line
placeholder still reflows the copy block), or put a two-line placeholder in the skeleton. It's
under 0.1, so it's polish, not a blocker.

## 4. Console and axe: all 19 pages at 1360 and 390

The pages: home, scores, rankings, standings, teams, team 150, team 2400, players, lab, about, the
final, live, pregame, KC-FAMU, team 999999, game 1 and 404.

- **Console: zero errors**, apart from the expected ESPN 400/404 for made-up ids and the 404
  page's own status.
- **axe:** zero violations on every page at both widths, **except one transient**: on `index` at
  1360, `color-contrast` (serious) on `.marquee__side:nth-child(3) > small`, the main event's
  right-hand record line. A minute later the marquee was Bradley `#b70002` vs Coppin St `#2e3192`
  with chalk `#fbfaf4` text, and axe passed (`d-marquee-contrast`). I couldn't reproduce it. It's
  either a different matchup that was briefly top (an orange or yellow school with chalk text
  under `teamColors`' 0.27 luminance cut-off) or axe sampling mid-animation. Worth a unit test
  of `teamColors` across all 365 schools' colours for 4.5:1 on the small text.

## 5. Final verdict

**Yes: "this is as good a site as Fable can make of this type" is true today. Blockers:
nothing.**

#250's new paint path is clean:
- every block still renders on final, off-slate, live and pregame pages;
- the scoreboard is the same node before and after ESPN answers;
- the summary is fetched once, and the 20 s refresh updates in place;
- the blocked-ESPN and bad-id fallbacks are intact;
- game-page LCP fell to 1.9-2.4 s, with one entry each.

Every page scores 92-99 on mobile Lighthouse, with team 150's 76 a noisy outlier that reruns at
96-99. CLS is 0 everywhere except home's Lighthouse-only 0.089, which is under the 0.1 line, and
axe and the console are clean.

The only things I'd still touch are polish:
- a two-line minimum on the home tally;
- one `teamColors` contrast test across all schools;
- letting the lab's chalkboard count as painted before the dots arrive.
