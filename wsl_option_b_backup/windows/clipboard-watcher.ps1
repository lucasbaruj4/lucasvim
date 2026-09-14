# clipboard-watcher.ps1
# Legacy optional clipboard converter. It is not started automatically:
# Windows clipboard images must remain intact so Pi can read them directly
# when Ctrl+V is pressed. Run this only when a saved WSL path is specifically
# needed instead of normal image paste.

Add-Type -AssemblyName System.Windows.Forms

$wasImage = $false

while ($true) {
    try {
        if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
            if (-not $wasImage) {
                $wasImage = $true
                Start-Process -FilePath "wsl.exe" `
                    -ArgumentList "-d", "Ubuntu", "--", "/home/lucas/.local/bin/paste-screenshot" `
                    -WindowStyle Hidden -Wait
            }
        } else {
            $wasImage = $false
        }
    } catch {
        # Clipboard can be transiently locked by another app; just retry next tick.
    }
    Start-Sleep -Milliseconds 800
}
