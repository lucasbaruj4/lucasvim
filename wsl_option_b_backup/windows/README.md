# Windows-side helpers

Backup copies of the Windows files used by the WSL-centric setup. Windows now
uses the normal `explorer.exe` shell and Windows Terminal opens WSL by default.
Alacritty is retained as a rollback option. Live location for the Windows-side programs and scripts is
`C:\Users\Admin\AppData\Local\` (except `alacritty.toml`, which lives in
`C:\Users\Admin\AppData\Roaming\alacritty\`, and the `*-launch.vbs` files,
which live in the user's Startup folder).

These are copies, not symlinks — after editing a live file, copy it back here
by hand.

| File | What it does |
| --- | --- |
| `alacritty-shell.vbs` | Legacy no-Explorer login shell; retained as a rollback reference and not started automatically. |
| `alacritty.toml` | Alacritty config; spawns `wsl.exe -d Ubuntu`. |
| `GlobalHotkeys.cs` | Useful system-wide hotkeys: Shift+S opens the normal Windows Snipping Tool, Ctrl+Alt+Up/Down changes volume, Ctrl+Shift+M toggles mute, Win+E opens Files, and bare Win is ignored. Windows handles Alt+Tab and Alt+Space normally. |
| `global-hotkeys-launch.vbs` | Starts `GlobalHotkeys.exe` from the normal Windows Startup folder. |
| `powertoys-keyboard-manager-default.json` | PowerToys Keyboard Manager mappings; disable bare Win and Win+Space while preserving Win-key combinations such as Win+E. Live copy: `%LOCALAPPDATA%\Microsoft\PowerToys\Keyboard Manager\default.json`. |
| `files-default-manager/` | Official Files registry assets that make Files the default file manager, including native Win+E. Live launcher: `%LOCALAPPDATA%\Files\Files.App.Launcher.exe`. |
| `AudioCtl.cs` | COM audio-endpoint helper the volume hotkeys call. |
| `wallpaper-window.ps1` | Legacy wallpaper workaround for the no-Explorer setup; not started automatically. |
| `clock-overlay.ps1` | Legacy always-on-top corner clock; not started automatically. |
| `clipboard-watcher.ps1` | Legacy manual clipboard-to-WSL converter; not started automatically, so Windows clipboard images remain available to Pi. |
| `windows-terminal-settings.json` | Windows Terminal settings: Ubuntu default, PowerShell profile retained, Ctrl+V is normal clipboard paste, Ctrl+Shift+V remains an alias, Alt+V reaches Pi's image-paste binding, and native selections copy automatically. |

## Building the .cs files

They're plain .NET Framework, no project file:

```
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe ^
  /out:C:\Users\Admin\AppData\Local\GlobalHotkeys.exe ^
  C:\Users\Admin\AppData\Local\GlobalHotkeys.cs
```

`/target:winexe` matters — it's what keeps the process from opening a console
window. Same command for `AudioCtl.cs`.

To restart a helper after rebuilding, launch it detached, or it dies with the
shell that started it:

```
powershell.exe -NoProfile -Command "Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine='C:\Users\Admin\AppData\Local\GlobalHotkeys.exe'}"
```
