#!/bin/sh
# One command for a new Mac: installs what is needed and puts the Claude Chats launcher on your Desktop.
#   sh mac/setup.sh                               prerequisites + Desktop launcher
#   sh mac/setup.sh --with-omniroute              also install and start your own OmniRoute gateway
#   sh mac/setup.sh --gateway http://pc:20128     point Claude Code at an OmniRoute that already exists (asks for its key)
#   sh mac/setup.sh --with-tailscale              also install Tailscale
#   DRY_RUN=1 sh mac/setup.sh ...                 print the steps without running them
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
run() { if [ -n "$DRY_RUN" ]; then echo "would run: $*"; else echo "+ $*"; "$@"; fi; }

OMNI=""; GATEWAY=""; TS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --with-omniroute) OMNI=1 ;;
    --with-tailscale) TS="--with-tailscale" ;;
    --gateway) GATEWAY="$2"; shift ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
  shift
done

echo "== 1/4  Prerequisites"
run sh "$HERE/install.sh" $TS

if [ -n "$OMNI" ]; then
  echo "== 2/4  OmniRoute"
  # OmniRoute needs Node 22.22.2 or newer (below 27).
  OK="$(node -p 'const [a,b,c]=process.versions.node.split(".").map(Number); String(a>=24||(a===22&&(b>22||(b===22&&c>=2))))' 2>/dev/null || echo false)"
  [ "$OK" = true ] || { run brew install node; run brew upgrade node || true; }
  command -v omniroute >/dev/null 2>&1 || run npm install -g omniroute
  mkdir -p "$HOME/.claude-local-ui"
  if [ -n "$DRY_RUN" ]; then echo "would run: omniroute (started in the background, log: ~/.claude-local-ui/omniroute.log)"; else
    if ! curl -s -m 2 -o /dev/null http://localhost:20128/; then
      nohup omniroute >> "$HOME/.claude-local-ui/omniroute.log" 2>&1 &
      i=0; until curl -s -m 2 -o /dev/null http://localhost:20128/; do i=$((i+1)); [ $i -gt 60 ] && { echo "OmniRoute did not answer in 2 minutes. See ~/.claude-local-ui/omniroute.log"; exit 1; }; sleep 2; done
    fi
    echo "OmniRoute is running at http://localhost:20128"
  fi
else
  echo "== 2/4  OmniRoute: skipped (add --with-omniroute to install your own)"
fi

echo "== 3/4  Launcher on your Desktop"
run sh "$HERE/build-launcher.sh" "$HOME/Desktop"

echo "== 4/4  Gateway"
if [ -n "$GATEWAY" ]; then run node "$ROOT/omniroute/connect.js" --url "$GATEWAY"; else echo "skipped (use --gateway URL, or follow docs/OMNIROUTE-CLONE.md after --with-omniroute)"; fi

echo
echo "Done. Double-click \"Claude Chats\" on your Desktop to open it."
[ -n "$OMNI" ] && echo "Next: open http://localhost:20128, set a dashboard password, connect providers with your own keys, then run: node omniroute/apply-recipe.js  (see docs/OMNIROUTE-CLONE.md)"
exit 0
