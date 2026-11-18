#!/bin/sh
# Open the chat UI in your browser, starting the server first if it is not running.
#   ./launch.sh            open it
#   ./launch.sh --no-open  just make sure the server is up
DIR="$(cd "$(dirname "$0")" && pwd)"
URL="http://127.0.0.1:${PORT:-3030}"

if ! curl -s -m 2 -o /dev/null "$URL/api/health"; then
  # A launched app has a bare PATH, so look for Node in the usual places.
  NODE=""
  for c in "$(command -v node)" /opt/homebrew/bin/node /usr/local/bin/node "$(ls -d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -1)"; do
    [ -n "$c" ] && [ -x "$c" ] && NODE="$c" && break
  done
  [ -n "$NODE" ] || { osascript -e 'display alert "Claude Chats" message "Node.js was not found. Run ./install.sh first."' 2>/dev/null || echo "Node.js not found. Run ./install.sh first."; exit 1; }
  export PATH="$(dirname "$NODE"):$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH" # so the server can find `claude`
  mkdir -p "$HOME/.claude-local-ui"
  (cd "$DIR" && nohup "$NODE" server.js >> "$HOME/.claude-local-ui/server.log" 2>&1 &)
  i=0; until curl -s -m 1 -o /dev/null "$URL/api/health"; do i=$((i+1)); [ $i -gt 20 ] && { echo "Server did not start. See ~/.claude-local-ui/server.log"; exit 1; }; sleep 0.5; done
fi

[ "$1" = "--no-open" ] || open "$URL"
