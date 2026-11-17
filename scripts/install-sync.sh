#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd -- "$(dirname -- "$(readlink -f -- "$0")")/.." && pwd)"
mkdir -p "$HOME/.local/bin" "$HOME/.config/systemd/user"
ln -sfn "$repo_dir/scripts/sync-lucasvim.sh" "$HOME/.local/bin/sync-lucasvim.sh"
for unit in sync-lucasvim.service sync-lucasvim.timer; do
  ln -sfn "$repo_dir/systemd/user/$unit" "$HOME/.config/systemd/user/$unit"
done
systemctl --user daemon-reload
systemctl --user enable --now sync-lucasvim.timer
echo 'lucasvim backup enabled: every two minutes while WSL is running.'
