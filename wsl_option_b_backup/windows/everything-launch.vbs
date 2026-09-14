' Start Everything at login so its file index is ready for fast searches.
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """C:\Users\Admin\AppData\Local\Microsoft\WinGet\Packages\voidtools.Everything_Microsoft.Winget.Source_8wekyb3d8bbwe\EverythingARM64.exe"" -startup", 0, False
