#!/usr/bin/env bash
# Register one GitHub Actions runner for this repo on this PC, following
# rhicksrad/Pharaoh docs/CI_RUNNERS.md part 2 (option A: one runner per repo
# per PC). Re-runnable. A person runs it; agents do not install services.
#
# Once per PC, as a sudo-capable user:
#   sudo adduser --disabled-password --gecos '' ghrunner
#   sudo loginctl enable-linger ghrunner
#   sudo npx playwright install-deps chromium
#
# Then, as ghrunner (sudo -iu ghrunner), with a registration token from an
# admin of the repo (valid one hour):
#   gh api -X POST repos/rhicksrad/NCAAM/actions/runners/registration-token -q .token
#   RUNNER_TOKEN=<token> bash setup_web_runner.sh
set -euo pipefail

REPO="${REPO:-rhicksrad/NCAAM}"
RUNNER_VERSION="${RUNNER_VERSION:-2.338.2}"
HOST=$(hostname | tr 'A-Z' 'a-z')
case "$HOST" in presidentscroob) HOST=scroob ;; esac
NAME="${RUNNER_NAME:-$HOST-${REPO#*/}}"
NAME=$(echo "$NAME" | tr 'A-Z' 'a-z')
BASE="$HOME/actions-runners"
DIR="$BASE/${REPO#*/}"
SERVICE="runner-${REPO#*/}"

if [ "$(id -un)" = "ryan" ] || [ -d "$HOME/.ssh" ] || [ -d "$HOME/.config/gh" ]; then
  echo "This user has SSH keys or a gh login. Public-repo runners must run as the" >&2
  echo "unprivileged 'ghrunner' user (see the header of this script). Set" >&2
  echo "ALLOW_PRIVILEGED_USER=1 to override." >&2
  [ "${ALLOW_PRIVILEGED_USER:-0}" = "1" ] || exit 1
fi
case "$HOST" in darkhelmet*) echo "DarkHelmet is the perf-timing box; web runners do not go here." >&2; exit 1 ;; esac

mkdir -p "$DIR" "$BASE/_toolcache" "$BASE/ms-playwright" "$HOME/.config/systemd/user"

# The fork-PR and low-disk refusal hook, shared by every web runner on this PC.
install -m 0755 "$(dirname "$0")/refuse_untrusted.sh" "$BASE/refuse_untrusted.sh"

if [ ! -x "$DIR/config.sh" ]; then
  curl -fsSL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" | tar xz -C "$DIR"
fi
if [ ! -f "$DIR/.runner" ]; then
  : "${RUNNER_TOKEN:?Set RUNNER_TOKEN to a registration token for $REPO}"
  (cd "$DIR" && ./config.sh --unattended --url "https://github.com/$REPO" --token "$RUNNER_TOKEN" \
    --name "$NAME" --labels "web,web-trusted,playwright,python,$HOST" --work _work)
fi

cat > "$DIR/.env" <<ENV
PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin
RUNNER_TOOL_CACHE=$BASE/_toolcache
PLAYWRIGHT_BROWSERS_PATH=$BASE/ms-playwright
ACTIONS_RUNNER_HOOK_JOB_STARTED=$BASE/refuse_untrusted.sh
ENV

# One ceiling for every web runner on this PC, so several repos firing at once
# cannot starve it.
cat > "$HOME/.config/systemd/user/web-runners.slice" <<UNIT
[Slice]
CPUQuota=400%
MemoryMax=8G
UNIT

cat > "$HOME/.config/systemd/user/$SERVICE.service" <<UNIT
[Unit]
Description=GitHub Actions runner $NAME ($REPO)
After=network-online.target
[Service]
WorkingDirectory=$DIR
ExecStart=$DIR/run.sh
Restart=always
RestartSec=10
Nice=15
Slice=web-runners.slice
[Install]
WantedBy=default.target
UNIT

# Weekly cleanup: prune the pnpm store, old temp files and runner logs.
install -m 0755 "$(dirname "$0")/weekly_cleanup.sh" "$BASE/weekly_cleanup.sh"
cat > "$HOME/.config/systemd/user/web-runner-cleanup.service" <<UNIT
[Unit]
Description=Weekly cleanup for web runners
[Service]
Type=oneshot
ExecStart=$BASE/weekly_cleanup.sh
UNIT
cat > "$HOME/.config/systemd/user/web-runner-cleanup.timer" <<UNIT
[Unit]
Description=Weekly cleanup for web runners
[Timer]
OnCalendar=Sun 04:30
Persistent=true
[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE" web-runner-cleanup.timer
echo "Runner $NAME is registered for $REPO and running as $SERVICE."
echo "Next: set the repository variable CI_RUNNER=local (see docs/CI.md)."
