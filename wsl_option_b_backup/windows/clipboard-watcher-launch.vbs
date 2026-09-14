' Launch the WSL clipboard watcher at the normal Windows login.
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File ""C:\Users\Admin\AppData\Local\clipboard-watcher.ps1""", 0, False
