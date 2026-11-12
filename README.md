# Field House

Men's college basketball, read off the scorer's table: live scores, polls, standings, every
Division I team, and a lab of charts. Static site, no backend, no API keys.

**Live:** https://rhicksrad.github.io/NCAAM/

## How it stays free

The first version needed a paid Ball Don't Lie key behind a Cloudflare Worker. This one doesn't:

- Live data comes from ESPN's public JSON feeds, fetched by the visitor's browser.
- Each deploy bakes a snapshot of those feeds, so pages paint instantly and keep working if ESPN
  is unreachable. The deploy runs every 30 minutes.
- Player stat lines, a decade of efficiency ratings, arenas and mascots are archives in
  `data/raw/`, reshaped at build time.

## Develop

```bash
corepack enable
pnpm install
pnpm dev      # http://localhost:4173, rebuilds on change
pnpm check    # typecheck, unit tests, build, size budget, browser smoke test
```

`SNAPSHOT=seed pnpm build` builds without touching the network.

See `AGENTS.md` for the architecture and design rules, and `docs/CI.md` for the checks and the
self-hosted runner setup.

## Credits

Built by Ryan Hicks. Scores and standings: ESPN. Player archives: Sports Reference. Efficiency
ratings: Bart Torvik. Unofficial and non-commercial; team names and logos belong to their schools.
