# One command for a new Windows PC: installs what is needed and puts the Claude Chats shortcut on your Desktop.
#   powershell -ExecutionPolicy Bypass -File windows\setup.ps1
#   ... -WithOmniRoute               also install and start your own OmniRoute gateway
#   ... -GatewayUrl http://pc:20128  point Claude Code at an OmniRoute that already exists (asks for its key)
#   ... -WithTailscale               also install Tailscale
#   ... -DryRun                      print the steps without running them
# NOT YET TESTED on a real Windows PC.
param([switch]$WithOmniRoute, [switch]$WithTailscale, [switch]$DryRun, [string]$GatewayUrl = '')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$root = Split-Path -Parent $here
function Step($text, [scriptblock]$block) { if ($DryRun) { "would run: $text" } else { "+ $text"; & $block } }
# Programs installed a moment ago are not on this window's PATH yet: reload it.
function RefreshPath { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') + ';' + (Join-Path $env:USERPROFILE '.local\bin') }

Write-Host '== 1/4  Prerequisites'
$installArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $here 'install.ps1'))
if ($WithTailscale) { $installArgs += '-WithTailscale' }
if ($DryRun) { $installArgs += '-DryRun' }
& powershell.exe @installArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
RefreshPath

if ($WithOmniRoute) {
  Write-Host '== 2/4  OmniRoute'
  # OmniRoute needs Node 22.22.2 or newer (below 27).
  $ok = $false
  if (Get-Command node -ErrorAction SilentlyContinue) { $ok = [bool]::Parse((node -p 'const [a,b,c]=process.versions.node.split(".").map(Number); String(a>=24||(a===22&&(b>22||(b===22&&c>=2))))')) }
  if (-not $ok) { Step 'winget install --id OpenJS.NodeJS.LTS -e' { winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements; RefreshPath } }
  if (-not (Get-Command omniroute -ErrorAction SilentlyContinue)) { Step 'npm install -g omniroute' { npm install -g omniroute; RefreshPath } }
  Step 'start omniroute in the background (log: %USERPROFILE%\.claude-local-ui\omniroute.log)' {
    $logDir = Join-Path $env:USERPROFILE '.claude-local-ui'; New-Item -ItemType Directory -Force $logDir | Out-Null
    function Up { try { (Invoke-WebRequest 'http://localhost:20128/' -UseBasicParsing -TimeoutSec 2) | Out-Null; $true } catch { $false } }
    if (-not (Up)) {
      Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'omniroute' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'omniroute.log') -RedirectStandardError (Join-Path $logDir 'omniroute-error.log')
      for ($i = 0; $i -lt 60 -and -not (Up); $i++) { Start-Sleep -Seconds 2 }
      if (-not (Up)) { throw "OmniRoute did not answer in 2 minutes. See $logDir" }
    }
    Write-Host 'OmniRoute is running at http://localhost:20128'
  }
} else { Write-Host '== 2/4  OmniRoute: skipped (add -WithOmniRoute to install your own)' }

Write-Host '== 3/4  Shortcut on your Desktop'
Step 'windows\build-launcher.ps1' { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here 'build-launcher.ps1') }

Write-Host '== 4/4  Gateway'
if ($GatewayUrl) { Step "node omniroute\connect.js --url $GatewayUrl" { node (Join-Path $root 'omniroute\connect.js') --url $GatewayUrl } }
else { Write-Host 'skipped (use -GatewayUrl URL, or follow docs/OMNIROUTE-CLONE.md after -WithOmniRoute)' }

Write-Host ''
Write-Host 'Done. Double-click "Claude Chats" on your Desktop to open it.'
if ($WithOmniRoute) { Write-Host 'Next: open http://localhost:20128, set a dashboard password, connect providers with your own keys, then run: node omniroute\apply-recipe.js  (see docs/OMNIROUTE-CLONE.md)' }
