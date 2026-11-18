# Open the chat UI in your browser, starting the server first if it is not running.
#   powershell -ExecutionPolicy Bypass -File windows\launch.ps1            open it
#   ... -NoOpen                                                            just make sure the server is up
param([switch]$NoOpen)
$root = Split-Path -Parent $PSScriptRoot
$port = if ($env:PORT) { $env:PORT } else { 3030 }
$url = "http://127.0.0.1:$port"
function Up { try { (Invoke-WebRequest "$url/api/health" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { $false } }

if (-not (Up)) {
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $node) { $c = Join-Path $env:ProgramFiles 'nodejs\node.exe'; if (Test-Path $c) { $node = $c } }
  if (-not $node) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('Node.js was not found. Run windows\install.ps1 first.', 'Claude Chats') | Out-Null
    exit 1
  }
  $logDir = Join-Path $env:USERPROFILE '.claude-local-ui'
  New-Item -ItemType Directory -Force $logDir | Out-Null
  $env:PATH = (Join-Path $env:USERPROFILE '.local\bin') + ';' + $env:PATH   # so the server can find claude.exe
  Start-Process -FilePath $node -ArgumentList 'server.js' -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server-error.log')
  for ($i = 0; $i -lt 20 -and -not (Up); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Up)) { Write-Host "Server did not start. See $logDir"; exit 1 }
}
if (-not $NoOpen) { Start-Process $url }
