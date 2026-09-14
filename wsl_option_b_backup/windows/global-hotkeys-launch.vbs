' Start the useful WSL/Windows hotkeys at the normal Windows login.
' Explorer is the Windows shell again, so this helper belongs in Startup.
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """C:\Users\Admin\AppData\Local\GlobalHotkeys.exe""", 0, False
