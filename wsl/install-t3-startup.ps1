param(
    [string]$Distro = 'Ubuntu',
    [string]$LinuxUser = 'lucas'
)

$ErrorActionPreference = 'Stop'
if ($Distro -notmatch '^[A-Za-z0-9_.-]+$' -or $LinuxUser -notmatch '^[a-z_][a-z0-9_-]*$') {
    throw 'Use a plain WSL distribution name and Linux user name.'
}

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$taskName = "T3 Code WSL - $Distro"
$wsl = Join-Path $env:WINDIR 'System32\wsl.exe'
$powershell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
# Keeping a foreground Linux process alive also keeps WSL's systemd services alive.
$command = "& '$wsl' --distribution '$Distro' --user '$LinuxUser' --exec /bin/sleep infinity; exit `$LASTEXITCODE"
$encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
$action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand $encoded"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Keep WSL running after Windows sign-in so the enabled T3 Code systemd service remains available.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State
