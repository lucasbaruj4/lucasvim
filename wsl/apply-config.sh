#!/usr/bin/env bash
set -euo pipefail
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
destination="${1:-/mnt/c/Users/Admin/.wslconfig}"
install -m 644 "$source_dir/wslconfig" "$destination"
printf 'WSL configuration mirrored to %s. Takes effect after WSL restarts.\n' "$destination"
