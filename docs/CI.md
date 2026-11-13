# CI

Built to the plan in `rhicksrad/Pharaoh` `docs/CI_RUNNERS.md` (part 2, NCAAM).

## What runs

| Workflow | Job | When | Where |
| --- | --- | --- | --- |
| `ci.yml` Checks | **gate**: install, typecheck, unit tests, build, size budget | every pull request push (not drafts), manual | local, hosted fallback |
| `ci.yml` Checks | **smoke**: every page in Chromium against recorded ESPN answers, then again with ESPN "down" | same | local `playwright` runners, hosted fallback |
| `feeds.yml` Feed watch | **live ESPN and Torvik contract check**: build with live feeds required (including a full player-averages crawl and Torvik's CSVs, never a reused copy), probe box score, roster and schedule feeds | nightly 09:23 UTC, manual. Never on PRs | local, hosted fallback |
| `pages.yml` Deploy | **build** | push to main, every 30 minutes, manual | local, hosted fallback |
| `pages.yml` Deploy | **deploy** | after build | always hosted, so the Pages token stays off the PCs |

Both `Checks` jobs must pass before a pull request merges.

## Routing

The repository variable `CI_RUNNER` is the switch.

- `CI_RUNNER=local`: trusted events (same-repo PRs, pushes, schedules, manual runs) go to
  self-hosted runners labelled `web-trusted` (plus `playwright` for the smoke job).
- unset: everything runs on `ubuntu-latest`. Use this whenever the PCs are off, because a job whose
  labels match no online runner queues silently instead of failing.
- Pull requests from forks always run hosted, whatever the variable says.

## Keeping strangers off the PCs

This repo is public, so three layers, as in the plan:

1. **Repo setting** (Settings > Actions > General): *Require approval for all outside
   collaborators* under fork pull request workflows.
2. **Runner hook**: `tools/ci/refuse_untrusted.sh` runs before every job on a web runner and fails
   fork PRs and `pull_request_target`, even if a fork rewrites `runs-on`. It also refuses jobs
   when the disk has under 10 GB free.
3. **Unprivileged user**: web runners run as `ghrunner`, which has no gh login, no SSH keys and no
   sudo. `setup_web_runner.sh` refuses to install under an account that has them.

In the workflows: `permissions: contents: read` by default, write scopes only on the deploy job,
no `pull_request_target`, no secrets anywhere (the site needs none), first-party actions plus
`pnpm/action-setup` only.

## Registering a runner (a person does this, once per PC)

No runner is registered for this repo until these steps are run. On PresidentScroob and
MajorAsshole (not DarkHelmet, the perf box):

```bash
# once per PC
sudo adduser --disabled-password --gecos '' ghrunner
sudo loginctl enable-linger ghrunner
sudo npx playwright install-deps chromium

# as you: a one-hour registration token
gh api -X POST repos/rhicksrad/NCAAM/actions/runners/registration-token -q .token

# as ghrunner
sudo -iu ghrunner
git clone --depth 1 https://github.com/rhicksrad/NCAAM.git /tmp/ncaam-setup
RUNNER_TOKEN=<token> bash /tmp/ncaam-setup/tools/ci/setup_web_runner.sh
rm -rf /tmp/ncaam-setup
```

The script registers `<host>-ncaam` with labels `web, web-trusted, playwright, python, <host>`,
points it at the shared tool cache and Playwright folder, installs the refusal hook, puts the
service in the capped `web-runners.slice`, and adds a weekly cleanup timer.

Then in the repo: turn on the fork approval setting, and set `CI_RUNNER=local`:

```bash
gh api -X POST repos/rhicksrad/NCAAM/actions/variables -f name=CI_RUNNER -f value=local
```

Check it: `gh api repos/rhicksrad/NCAAM/actions/runners --jq '.runners[] | "\(.name) \(.status)"'`,
then push to a same-repo PR and confirm the job names the runner.

## Caching and cleanup

- Self-hosted: no `actions/cache`. One shared pnpm store, one Node tool cache
  (`RUNNER_TOOL_CACHE`) and one Playwright folder (`PLAYWRIGHT_BROWSERS_PATH`) per PC.
  Chromium installs without `--with-deps`.
- Hosted: `setup-node`'s pnpm cache, and `playwright install --with-deps`.
- Every self-hosted job ends by deleting `dist`, `.cache` and `node_modules`; `actions/checkout`
  cleans the rest at the start of the next run. `tools/ci/weekly_cleanup.sh` prunes the pnpm
  store, old temp files, runner logs and unused browser builds.
- Concurrency: a new push cancels the previous Checks run on that branch. Deploys queue rather
  than cancel, so a half-finished deployment is never cut off.
