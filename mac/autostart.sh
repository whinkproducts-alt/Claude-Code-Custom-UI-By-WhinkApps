#!/bin/sh
# macOS only. Start the chat UI at login and restart it if it stops.
#   sh mac/autostart.sh install | remove | status
# The agent runs the Node found on PATH right now (a version manager's Node path changes with the version: re-run install after upgrading).
set -e
LABEL=com.claudechats.local-ui
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UID_="$(id -u)"

case "$1" in
  install)
    NODE="$(command -v node)" || { echo "node not found on PATH"; exit 1; }
    mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.claude-local-ui"
    cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$ROOT/server.js</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/.claude-local-ui/server.log</string>
  <key>StandardErrorPath</key><string>$HOME/.claude-local-ui/server.log</string>
  <key>EnvironmentVariables</key><dict>
    <key>HOME</key><string>$HOME</string>
    <key>PATH</key><string>$(dirname "$NODE"):$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict></plist>
EOF
    launchctl bootout "gui/$UID_" "$PLIST" 2>/dev/null || true
    launchctl bootstrap "gui/$UID_" "$PLIST"
    echo "Installed. Open http://127.0.0.1:3030 (log: ~/.claude-local-ui/server.log)"
    ;;
  remove)
    launchctl bootout "gui/$UID_" "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Removed."
    ;;
  status)
    launchctl print "gui/$UID_/$LABEL" 2>/dev/null | grep -E "state =|pid =|last exit" || echo "Not installed."
    ;;
  *) echo "usage: sh mac/autostart.sh install | remove | status"; exit 1 ;;
esac
