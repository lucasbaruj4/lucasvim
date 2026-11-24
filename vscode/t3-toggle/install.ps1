param([Parameter(Mandatory=$true)][string]$Vsix, [string]$Distro = 'Ubuntu')
$ErrorActionPreference = 'Stop'
$uiVsix = Get-Item -LiteralPath $Vsix
$fileLinksVsix = Get-Item -LiteralPath (Join-Path $uiVsix.DirectoryName 'codex-file-links.vsix')
$code = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code\bin\code.cmd'
$version = & $code --version
if ($LASTEXITCODE -ne 0 -or $version.Count -lt 2) { throw 'Could not read the VS Code version.' }
$commit = $version[1].Trim()
$wslHome = & wsl.exe --distribution $Distro --exec printenv HOME
if ($LASTEXITCODE -ne 0) { throw "Could not find the home directory for WSL $Distro." }
$wslVsix = & wsl.exe --distribution $Distro --exec wslpath -u $fileLinksVsix.FullName
if ($LASTEXITCODE -ne 0) { throw 'Could not find the file links VSIX in WSL.' }
$serverCli = "$($wslHome.Trim())/.vscode-server/bin/$commit/bin/code-server"
& wsl.exe --distribution $Distro --exec test -x $serverCli
if ($LASTEXITCODE -ne 0) { throw "Open a VS Code window in WSL $Distro to install its server, then run this installer again." }
& wsl.exe --distribution $Distro --exec $serverCli --install-extension $wslVsix.Trim() --force
if ($LASTEXITCODE -ne 0) { throw 'The WSL file links extension could not be installed.' }

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
& $code --install-extension $uiVsix.FullName --force
if ($LASTEXITCODE -ne 0) { throw 'The T3 extension could not be installed.' }
Write-Output 'T3 Toggle and WSL file links installed. Reload the VS Code window to use both extensions.'
