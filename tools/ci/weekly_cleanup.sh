#!/usr/bin/env bash
# Weekly housekeeping for the web runners on this PC.
set -u
BASE="$HOME/actions-runners"
command -v pnpm >/dev/null 2>&1 && pnpm store prune || true
find "$BASE" -path '*/_work/_temp/*' -mtime +14 -delete 2>/dev/null || true
find "$BASE" -path '*/_diag/*.log' -mtime +14 -delete 2>/dev/null || true
# Playwright browser builds nothing has opened in two months.
find "$BASE/ms-playwright" -mindepth 1 -maxdepth 1 -type d -atime +60 -exec rm -rf {} + 2>/dev/null || true
df -h "$HOME" | tail -1
