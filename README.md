# lucasvim

This is the source of truth for Lucas's Neovim and shell setup.

## Owns

- Neovim configuration: `init.lua`, `lua/`, and `lazy-lock.json`.
- Shell configuration: `shell/bashrc`, `shell/inputrc`, `shell/tmux.conf`, and `starship.toml`.
- Shell-adjacent configuration and helpers: Yazi, WSL/Windows, voice, Claude pet, and CLIProxyAPI backups.

The live files link here:

- `~/.bashrc` → `shell/bashrc`
- `~/.inputrc` → `shell/inputrc`
- `~/.tmux.conf` → `shell/tmux.conf`
- `~/.config/nvim` is this repository.

`~/.bash_aliases` contains personal URLs and IDs, so it remains local and untracked. `shell/bash_aliases.example` is its sanitized, tracked backup. Update the example whenever non-secret alias behavior changes; never add real IDs, URLs containing IDs, tokens, or credentials to this public repository.

## Does not own

Pi configuration and standing agent context belong in [`GLOBAL.md`](https://github.com/lucasbaruj4/GLOBAL.md). Do not add Pi settings, agent instructions, skills, or context Markdown here.

## Agent rule

Before changing a configuration file, choose its owner by what it configures: terminal/editor/WSL behavior goes here; Pi behavior or standing agent context goes to `GLOBAL.md`. Keep one tracked source of truth—move a file instead of copying it between repositories.
