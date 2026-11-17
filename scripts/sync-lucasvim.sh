#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "$(readlink -f -- "$0")")/.." && pwd)"
exec 9>"${XDG_RUNTIME_DIR:-/tmp}/lucasvim-sync-${UID}.lock"
flock -n 9 || exit 0
cd "$repo_dir"
export GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=10 -o ServerAliveCountMax=2"

branch="$(git symbolic-ref --quiet --short HEAD)" || { echo 'Cannot back up a detached HEAD.' >&2; exit 1; }
remote="$(git config --get "branch.$branch.remote")"
destination="$(git config --get "branch.$branch.merge")"
if [[ "$remote" != origin || "$destination" != refs/heads/* ]]; then
  echo 'Configure an origin upstream for the current branch before backing it up.' >&2
  exit 1
fi
for state in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply BISECT_START; do
  if [[ -e "$(git rev-parse --git-path "$state")" ]]; then
    echo "Backup deferred: Git operation in progress ($state)." >&2
    exit 1
  fi
done
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git diff --cached --quiet || git commit -q -m 'sync: lucasvim configuration'
fi
timeout 60s git push --quiet "$remote" "HEAD:$destination"
echo "Backed up lucasvim: $branch -> $remote/${destination#refs/heads/} ($(git rev-parse --short HEAD))."
