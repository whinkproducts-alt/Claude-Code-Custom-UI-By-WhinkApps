#!/bin/sh
# Installs what Claude Chats needs on a Mac: git, Node.js 20+, Claude Code and the GitHub CLI.
#   sh mac/install.sh                    install whatever is missing
#   sh mac/install.sh --with-tailscale   also install Tailscale (reach a gateway on another computer, from anywhere)
#   DRY_RUN=1 sh mac/install.sh          show the commands without running them
# Skips anything already installed. macOS only (uses Homebrew).
set -e
run() { if [ -n "$DRY_RUN" ]; then echo "would run: $*"; else echo "+ $*"; "$@"; fi; }
have() { command -v "$1" >/dev/null 2>&1; }

[ "$(uname)" = Darwin ] || { echo "install.sh supports macOS only. See the README for the commands to run by hand."; exit 1; }
if ! have brew; then
  echo "Homebrew is needed first. Install it with this command, then run: sh mac/install.sh:"
  echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  exit 1
fi

# git
if git --version >/dev/null 2>&1; then echo "git: already installed"; else run brew install git; fi

# Node.js 20 or newer
NODE_MAJOR="$(have node && node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -ge 20 ]; then echo "node: already installed (v$NODE_MAJOR)"; else run brew install node; fi

# Claude Code (official installer from Anthropic)
if have claude || [ -x "$HOME/.local/bin/claude" ]; then echo "claude: already installed"; else
  run sh -c 'curl -fsSL https://claude.ai/install.sh | bash'
  NEED_LOGIN=1
fi

# GitHub CLI (needed to download or push a private repository)
if have gh; then echo "gh: already installed"; else run brew install gh; fi

# Tailscale (optional)
if [ "$1" = "--with-tailscale" ]; then
  if [ -d /Applications/Tailscale.app ] || have tailscale; then echo "tailscale: already installed"; else run brew install --cask tailscale; fi
fi

echo
echo "Done. Next:"
[ -n "$NEED_LOGIN" ] && echo "  1. Run: claude        (sign in once)"
echo "  - Download a private repo:   gh auth login"
echo "  - Build the launcher:        sh mac/build-launcher.sh"
echo "  - Or run it directly:        node server.js   then open http://127.0.0.1:3030"
