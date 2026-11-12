# Review round 7: after #246 (c17f20f)

Live site after Deploy for c17f20f succeeded. Every page loaded in a fresh browser context.
Shots come from installed Chrome in a visible window with a normal User-Agent, desktop 1360x900
and phone 390x844 with mobile emulation. The session restarted mid-round; everything below was
re-checked after the restart.

## 1. Lighthouse mobile: median of 3, r6 vs r7

| page | perf r6 → r7 | LCP r6 → r7 | CLS r6 → r7 (r7 runs) | TBT r6 → r7 |
|---|---|---|---|---|
| home | 86 → **94** | 3.5 → 3.00 s | 0.110 → **0.000** (0, 0, 0.011) | 124 → 107 ms |
| lab | 88 → **96** | 2.7 → 2.71 s | 0 → 0 (0, 0, 0) | 337 → 54 ms |
| players | 88 → **92** | 2.4 → 2.56 s | 0.131 → **0.131** (0, 0.131, 0.131) | 257 → 92 ms |
| game 401925702 final | 94 → 92 | 3.0 → 3.31 s | 0 → 0 (0, 0, 0) | 71 → 33 ms |
| game 401925631 pregame (Bradley v Coppin St) | – → **91** | 3.16 s | **0.089** (0.089, 0.089, 0.04) | 65 ms |
| standings | 99 → 98 | 1.7 → 2.34 s | 0.066 → 0.066 (0.066, 0.066, 0) | 21 → 78 ms |
| teams | 98 → **99** | 1.8 → 1.67 s | 0 → 0.034 (0.07, 0.034, 0) | 106 → 1 ms |
| team 150 | 91 → **99** | 2.0 → 1.83 s | 0 → 0 (0, 0, 0) | 370 → 32 ms |

No game was live during the Lighthouse runs: KC-GMU had gone final, and the next tip was 6:00 PM
ET. So the in-progress slot is a pre-game page.

**A Lighthouse tooling note.** On this Chrome, Lighthouse 12.2.1's TraceElements gatherer crashes
("Cannot read properties of undefined (reading 'frame_sequence')"). That's why the
`largest-contentful-paint-element` and `layout-shifts` audits have been empty in every round.
The scores and metrics are fine; only the element attribution is missing. So I measured LCP and
CLS attribution myself: same Moto G emulation (412x823 at 1.75x), 4x CPU throttle, 150 ms RTT and
1.44 Mbps, PerformanceObserver plus resource timing, 3 runs per page.

### LCP over 2.5 s: element and phases (my runs, ms)

| page | LCP element | runs | TTFB | load delay | load time | render delay |
|---|---|---|---|---|---|---|
| game (final, pregame) | `section.board` background **`scoreboard.webp`** | 2.6-5.0 s | 166-746 | **1,400-3,186** | 739-1,004 | 38-1,067 |
| lab | `div.chalk` background **`chalkboard.webp`** | 3.2-4.9 s | 164-426 | **1,960-3,512** | 915-1,009 | 46-68 |
| home | `section.hero` background `hero-court-sm.webp` | 1.8-2.5 s | 176-297 | 71-413 | 812-819 | 557-1,022 |
| players, standings, teams | `header.masthead` background `floor-dark.webp` | 1.3-2.8 s | ~180 | 650-1,040 | 240-340 | 84-1,288 |

The game-page and lab LCP problem is **load delay**. Their LCP images are CSS backgrounds on
elements that only exist after the page script runs, so the browser finds them 1.4-3.5 s late.
Fixes:
- `<link rel="preload" as="image" href="art/scoreboard.webp">` in `game.html`'s head, and the same
  for `chalkboard.webp` in `lab.html`; or
- put the board/chalk shell in the static HTML so the background is discoverable from the parser.

Either should take about 1.5-3 s off those pages' LCP. Home's remaining cost is render delay
after the image arrives (0.5-1 s). It's fine at 1.8-2.5 s in my runs.

### CLS attribution (my runs)

- **players: 0.131 in all 3 runs.** `div#players-root` moves down **174 px** (y 227→401, height
  95→422) at about 2.8 s. Something about 174 px tall is inserted above it after load: the
  leaders strip or the filter bar. Reserve its height in the static skeleton.
- **pregame game page: 0.089 in all 3 runs.** A `p.also` element appears (h 0→71 at y 555) and then
  disappears again 0.6-1.3 s later (h 71→0): a flash of a paragraph that's rendered and then
  removed. It's probably an "also tonight" or source line drawn from the snapshot, then dropped
  by the live render. Decide once, or reserve the space.
- **standings 0.066, teams 0.034:** zero in all 6 of my runs, so I can't attribute them. Both are
  intermittent in Lighthouse only.
- **home: zero** in all my runs and 2 of 3 Lighthouse runs (0.011 in the third). Fixed.

## 2. Home at 390x844 (`p-index-1..5`)

- **Source line:** present from first paint as "Saved copy from Nov 12, 4:38 PM. Asking ESPN…",
  then "Live from ESPN, Nov 12, 4:40 PM." The layout-shift observer recorded **zero shifts** on home
  at 390 and at 1360 through that swap, so the line doesn't change height in any way that moves
  the page.
- **Hero art:**
  - Phone fetched **only `art/hero-court-sm.webp`**.
  - Desktop fetched **only `art/hero-court.webp`**.
  - The 130 kB desktop file isn't fetched on phone, and the small one isn't fetched on desktop.
- **Poll:** 10 rows, then "**NOS. 11 TO 25 AND THE COACHES POLL →**" (`p-index-4`).
- **From the Lab:**
  - On phone, the first board is wide (358x105) with a big "01", then 2x2 (174x135 each).
  - On desktop it's five equal tiles (230x164).
- **Slate:** six tickets, then "+23 MORE ON THE SLATE"; the main event shows the live KC-GMU game.
- **Screens: 4.1** at 390x844 (2.8 at desktop).

## 3. Game page, snapshot first (Slow 4G: 562 ms RTT, 1.44 Mbps; phone)

Game `401920073` KC vs GMU was live at the time (6:44 2nd).
- The scoreboard appeared at **2.1 s, before ESPN's summary answered at 2.5 s**. Score text from
  the saved slate was on screen from 1.2 s.
- `p-throttled-…-before-espn`: the board shows the saved "51-64, 7:23 2ND" and "Fetching the box
  score…". The team logos are blank white discs until they load.
- `p-throttled-…-after-espn`: the live "53-64, 6:44 2ND", lead chart and tale of the tape.
- One tiny shift, **0.007**: `div.board__score` height 103→107 px at 1.9 s, before ESPN answered,
  probably the score font swapping in. Everything else is stable.

## 4. Error pages (`d-/p-error-*`)

- `team.html?id=999999`: "AIR BALL · There is no team with that id. Try the team directory."
- `game.html?id=1` and `game.html?id=999999999`: "AIR BALL · There is no game with that id. Try the
  scoreboard."

No raw error text, and no blaming ESPN. Each still logs the expected ESPN 400/404 for the bad id
in the console. Nits: these pages **have no `<h1>`** (axe, below). They're also a small card on
bare floor, unlike the real 404 page's big "AIR BALL" heading with the net art. Use the same
treatment for both.

## 5. Manifest

- `manifest.webmanifest` returns 200. Chrome's parser (`Page.getAppManifest`) reports **no manifest
  errors**: name and short_name "Field House", start_url `./index.html`, scope `./`, display
  standalone, theme and background #14213a.
- **`art/app-192.png`: 200 OK.**
- **`art/app-512.png`: 404**, and the manifest lists it twice (any and maskable). The file
  **isn't in the repo** (`public/art/` has `app-192.png` and `apple-touch-icon.png` only). Add a
  512x512 PNG, preferably with a maskable safe zone.
- Installability errors: only `in-incognito`, which is an artefact of my fresh test context.

## 6. About page (`d-about-fineprint`)

The takedown line now ends "…open an issue on the project's GitHub page and it will come down",
linking to `https://github.com/rhicksrad/NCAAM/issues/new`. **No mail address anywhere:** I
checked the rendered HTML of all 14 pages at both widths for `x@y.z` and `mailto:`, plus a repo
source grep. Zero hits.

## 7. axe and console

- **axe** on home, final game, pregame game, team 999999 and game 1, at 1360 and 390: one
  finding, **moderate `page-has-heading-one` on the two error pages** (team 999999, game id 1).
  Everything else is clean.
- **Console**, every page at both widths: home, scores, rankings, standings, teams, team 150,
  team 2400, players, lab, about, final game, KC-GMU, pregame and the 404 page. **Zero errors and
  zero failed requests**, apart from the 404 page's own 404 status, which is expected.

## 8. Would "this is as good a site as Fable can make of this type" be true today?

**Not yet. It's closer than ever, and every remaining item is small and mechanical.** In order:

1. **Players page jumps 174 px on every load** (CLS 0.131, `#players-root`). It's 100% reproducible;
   reserve the leaders strip or filter bar height.
2. **Game page and lab LCP of 3-5 s** on mid-range phones. The LCP images (`scoreboard.webp`,
   `chalkboard.webp`) are only discovered after the script runs, which costs 1.4-3.5 s. Preload
   them or put the shells in static HTML. The game page is the one people sit on during a game.
3. **The pregame page flashes a `p.also` paragraph in and out** (CLS 0.089, every run).
4. **The manifest points at a 512 px icon that doesn't exist.** Installs will use a blurry 192.
5. **Error pages have no `<h1>`** and look different from the 404 page.

## Picky walk, every page at 1360 and 390 (`walk-d-*`, `walk-p-*`)

Clean throughout: no sideways scroll, no undefined/NaN/null, no stale "Asking ESPN" left
behind, one h1 per page (except the error pages above), and a silent console. Small things I
saw:

- **Record mismatch:**
  - The Scores card for the finished KC-GMU game still shows **Kansas City 2-2** and GMU 3-0
    (`walk-d-games-2`). The game page header says **KC 2-3**, GMU 3-0.
  - The scoreboard feed's records lag the summary's after a game ends. Prefer the summary's
    record on the card once the game is final, or re-read the slate.
- **Phone standings is 23 screens** (all 32 conferences stacked), and **phone teams is 17.7
  screens**. The conference picker is at the top, but after scrolling there's no way back to it
  short of the top. A sticky picker or a jump list of conference names would fix both.
- **Phone players: the leaders strip cuts the third card mid-word** ("ASSIS…"). That's fine as a
  swipe cue, but the cut lands on text, not on a card edge.
- **Pregame "Coming in":** Bradley "1-2 in the last 3" and Coppin State "1-2 in the last 3" both
  show the next game ("Nov 14 … up next"). Good. The cards are equal height now.
- **The home desktop main event** shows the BYU pregame (Montana St vs 23 BYU, 9:00 PM) when
  nothing is live. That's a sensible choice.
- The Duke and Mississippi Valley State schedules render fully, with the TV network column. Some
  shots show a highlighted row: that's my mouse hovering, not a bug.
- The "AIR BALL" 404 page is good, but the right half of the page is empty floor at desktop.
