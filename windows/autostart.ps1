# Start the chat UI at every login (a Windows scheduled task).
#   powershell -ExecutionPolicy Bypass -File windows\autostart.ps1 install | remove | status
# Unlike the Mac version it starts the server at login but does not restart it if it later stops.
param([Parameter(Position = 0)][ValidateSet('install', 'remove', 'status')][string]$Action = 'status')
$name = 'ClaudeChats'
$launch = Join-Path $PSScriptRoot 'launch.ps1'
switch ($Action) {
  'install' {
    $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launch`" -NoOpen"
    $trg = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    Register-ScheduledTask -TaskName $name -Action $act -Trigger $trg -Description 'Starts Claude Chats at login' -Force | Out-Null
    Start-ScheduledTask -TaskName $name
    'Installed. Claude Chats now starts at every login.'
  }
  'remove' { Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue; 'Removed.' }
  'status' { $t = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue; if ($t) { "$($t.TaskName): $($t.State)" } else { 'Not installed.' } }
}
