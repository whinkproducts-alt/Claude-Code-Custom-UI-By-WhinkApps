# Makes a "Claude Chats" shortcut on your Desktop (Whink logo). Double-click it to open the page; it starts the server if needed.
#   powershell -ExecutionPolicy Bypass -File windows\build-launcher.ps1
# Right-click the shortcut and choose "Pin to taskbar" to keep it there.
# On Windows the icon is the Whink logo alone (the Claude badge on the Mac version comes from the Mac Claude app).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Claude Chats.lnk'
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk)
$s.TargetPath = (Get-Command powershell.exe).Source
$s.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\windows\launch.ps1`""
$s.WorkingDirectory = $root
$s.IconLocation = "$root\assets\whink-logo.ico"
$s.Description = 'Claude Chats'
$s.Save()
Write-Host "Created: $lnk"
