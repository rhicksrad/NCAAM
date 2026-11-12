# Review round 1

Built from branch `claude/project-thread-wryd1s` at 90e10d6 (main after #238) with
`PORT=4183 node scripts/build.mjs --serve`. The snapshot was live for every feed
(standings, teams, rankings, scoreboard, news). Port 4173 was taken by another project's dev
server on this PC (`scripts/dev/serve-public.js`), so this build serves on **4183**.

## How these were captured

- I used the installed Google Chrome with a **visible window** (Playwright `headless: false`) and a
  normal User-Agent: Windows Chrome for desktop, Android Chrome with `isMobile` and touch for phone.
  I didn't use the side browser pane for the files because it can show me screenshots but cannot
  save them to disk. I checked the pages there by eye earlier.
- Viewports: desktop 1360x900 (`d-*`), phone 390x844 (`p-*`). Each shot is one viewport, scrolled
  0, 1 and 2 viewports down (0 to 4 for lab and game pages on desktop). Each shot waits for network
  idle plus 2.5 s and for the logos in view to finish loading. JPEG quality 75.
- Live/upcoming game: `401920073`, Kansas City vs George Mason, 3:00 PM ET today (pre-game). No
  game was in progress when I captured.
- Short pages (pre-game page, about on desktop) hit the bottom early, so their later shots repeat
  the last screen.

## Checks run on every page and width

- No sideways scroll anywhere.
- No `undefined`, `NaN`, `[object Object]` or `Invalid Date` text.
- No amber stale note on any page: live data rendered everywhere.
- No broken images. The two logo misses below fall back to blank slots.
- Console: clean except on `index` and `games`, which log 404s for logos 353 and 3229 (plus 124946
  and 134743 on games). Both the espncdn URL and the local `data/logos/` fallback 404. These are
  non-D1 opponents, so the fallback chain tries two URLs that will never exist. Skip the second
  request, or record known-missing ids in the snapshot, to stop the console noise.

## Fixed since the headless run (#238 worked)

- Box score: real stat lines now. Only actual DNPs (Walker, Harden, Hernandez) say "Did not play".
- `team.html?id=150`: no CORS error any more. The header shows "No. 2 · Blue Devils · Atlantic
  Coast", "2-1 this season", "13th in ACC", and the height reads "6 ft 7.4 in".
- Phone rankings: the POINTS column now fits. Phone standings: STRK is visible.
- Phone final game: "JACKSONVILLE STATE" wraps on a word boundary.

## Still looks off

1. **Phone team schedule** (`p-team-150-1/2.jpg`): the RESULT/time column is still cut at the right
   edge ("W 84-5…", "7:00 P…", "11:00 PM" touching the edge). Either drop the TV column on phones
   or let the opponent cell wrap.
2. **Phone nav** (all `p-*-1.jpg`): the tab row ends in a sliver of "TE…" at the right edge, with
   no fade or arrow to say it scrolls.
3. **Phone "Find" button** is tiny next to the wordmark. It's fine as a target (about 40 px) but
   reads like a stray label.
4. **Pre-game page** (`d-game-401920073-*`, `p-game-401920073-*`): it's short and mostly empty
   below "Not tipped yet". There's room for a preview: last 5 results per side, the line and
   total, the ranks.
5. **Home hero on phone** (`p-index-1.jpg`): the centre-circle line runs through "THURSDAY,
   NOVEMBER 12". A small scrim or nudging the art right would clear it.
