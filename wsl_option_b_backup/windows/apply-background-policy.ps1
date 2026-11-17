param([Parameter(Mandatory=$true)][string]$BackupDirectory)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Run this script as Administrator.' }
New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
$targets = @('CoworkVMService', 'SmartConnect', 'Hamachi2Svc')
$before = @(Get-CimInstance Win32_Service | Where-Object { $_.Name -in $targets } | Select-Object Name, StartMode, State)
$before | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 (Join-Path $BackupDirectory 'services.before.json')
$policyPath = 'HKLM:\SOFTWARE\Policies\Claude'
$policy = Get-ItemProperty -Path $policyPath -Name secureVmFeaturesEnabled -ErrorAction SilentlyContinue
@{ Existed = ($null -ne $policy); Value = $policy.secureVmFeaturesEnabled } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $BackupDirectory 'cowork-policy.before.json')
$results = @()
foreach ($name in $targets) {
    try {
        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($service) {
            Set-Service -Name $name -StartupType Disabled
            if ($service.Status -ne 'Stopped') { Stop-Service -Name $name }
            $state = Get-CimInstance Win32_Service -Filter "Name='$name'"
            $results += [pscustomobject]@{ Name = $name; State = $state.State; StartMode = $state.StartMode; Error = $null }
        }
    } catch { $results += [pscustomobject]@{ Name = $name; Error = $_.Exception.Message } }
}
try {
    New-Item -Path $policyPath -Force | Out-Null
    New-ItemProperty -Path $policyPath -Name secureVmFeaturesEnabled -PropertyType DWord -Value 0 -Force | Out-Null
    $results += [pscustomobject]@{ Name = 'Claude.secureVmFeaturesEnabled'; Value = 0; Error = $null }
} catch { $results += [pscustomobject]@{ Name = 'Claude.secureVmFeaturesEnabled'; Error = $_.Exception.Message } }
$results | ConvertTo-Json -Depth 3 | Set-Content -Encoding UTF8 (Join-Path $BackupDirectory 'admin-results.json')
$results | Format-Table -AutoSize
