param([Parameter(Mandatory=$true)][string]$Vsix)
$ErrorActionPreference = 'Stop'
$desired = Get-Content (Join-Path $PSScriptRoot '..\argv.json') -Raw | ConvertFrom-Json
$argvPath = Join-Path $env:USERPROFILE '.vscode\argv.json'
if (Test-Path $argvPath) {
    $text = Get-Content $argvPath -Raw
    $current = ($text -replace '(?m)^\s*//.*$', '') | ConvertFrom-Json
} else {
    $current = [pscustomobject]@{}
}
$enabled = @($current.'enable-proposed-api') + @($desired.'enable-proposed-api')
$enabled = @($enabled | Where-Object { $_ } | Select-Object -Unique)
$current | Add-Member -NotePropertyName 'enable-proposed-api' -NotePropertyValue $enabled -Force
$json = $current | ConvertTo-Json -Depth 20
[IO.File]::WriteAllText($argvPath, $json, (New-Object Text.UTF8Encoding($false)))
$code = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'
& $code --install-extension $Vsix --force
if ($LASTEXITCODE -ne 0) { throw 'The T3 extension could not be installed.' }
Write-Output 'T3 external links installed. Restart VS Code to enable the browser API.'
