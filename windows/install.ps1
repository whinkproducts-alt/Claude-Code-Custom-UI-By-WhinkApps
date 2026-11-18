# Installs what Claude Chats needs on Windows 10/11: Git, Node.js 20+, Claude Code and the GitHub CLI.
#   powershell -ExecutionPolicy Bypass -File windows\install.ps1
#   ... -WithTailscale    also install Tailscale
#   ... -DryRun           show the commands without running them
# Skips anything already installed. Uses winget (built into current Windows).
param([switch]$WithTailscale, [switch]$DryRun)
$ErrorActionPreference = 'Stop'
function Have($name) { [bool](Get-Command $name -ErrorAction SilentlyContinue) }
function Run($cmd) { if ($DryRun) { "would run: $cmd" } else { "+ $cmd"; Invoke-Expression $cmd } }

if (-not (Have winget)) {
  Write-Host "winget was not found. Install 'App Installer' from the Microsoft Store, then run this again."
  exit 1
}
$flags = '--exact --accept-package-agreements --accept-source-agreements'

if (Have git) { 'git: already installed' } else { Run "winget install --id Git.Git $flags" }

$nodeMajor = 0
if (Have node) { $nodeMajor = [int](node -p "process.versions.node.split('.')[0]") }
if ($nodeMajor -ge 20) { "node: already installed (v$nodeMajor)" } else { Run "winget install --id OpenJS.NodeJS.LTS $flags" }

# Claude Code (official installer from Anthropic)
$needLogin = $false
if ((Have claude) -or (Test-Path (Join-Path $env:USERPROFILE '.local\bin\claude.exe'))) { 'claude: already installed' }
else { Run 'irm https://claude.ai/install.ps1 | iex'; $needLogin = $true }

# GitHub CLI (needed to download or push a private repository)
if (Have gh) { 'gh: already installed' } else { Run "winget install --id GitHub.cli $flags" }

if ($WithTailscale) {
  if (Have tailscale) { 'tailscale: already installed' } else { Run "winget install --id Tailscale.Tailscale $flags" }
}

Write-Host ''
Write-Host 'Done. Close this window and open a NEW PowerShell window so the new programs are found. Then:'
if ($needLogin) { Write-Host '  1. Run: claude        (sign in once)' }
Write-Host '  - Download a private repo:   gh auth login'
Write-Host '  - Make the desktop shortcut: powershell -ExecutionPolicy Bypass -File windows\build-launcher.ps1'
Write-Host '  - Or run it directly:        node server.js   then open http://127.0.0.1:3030'
