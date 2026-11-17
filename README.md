# lucasvim

Neovim and shell configuration for Lucas's development setup.

## Automatic backup

Run `bash scripts/install-sync.sh` to enable the WSL user timer. Every two
minutes, it commits non-ignored repository changes and pushes the current
branch to its configured `origin` upstream. Failed uploads retry on the next
run. Remote conflicts require manual resolution; local files are not changed
to resolve them. Changes made outside this repository must be captured here
before they can be backed up. Credentials, sessions, and caches stay local.

Check the timer with `systemctl --user status sync-lucasvim.timer` and the
last result with `journalctl --user -u sync-lucasvim.service -n 20`.
Run `python3 scripts/test_sync.py` to check the backup behavior.
