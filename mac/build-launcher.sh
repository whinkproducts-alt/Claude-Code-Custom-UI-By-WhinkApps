#!/bin/sh
# macOS: build "Claude Chats.app" (Whink logo with a Claude badge) that opens the UI, starting the server if needed.
#   sh mac/build-launcher.sh [folder]     default folder: ~/Applications
# Drag the app to your Dock if you want it there. The Claude badge is taken from your installed Claude app at build time,
# so the Claude artwork is not stored in this repository. Without the Claude app you get the Whink logo alone.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
APP="${1:-$HOME/Applications}/Claude Chats.app"
WORK="$(mktemp -d)"
CLAUDE_ICNS="/Applications/Claude.app/Contents/Resources/electron.icns"

BADGE=-
if [ -f "$CLAUDE_ICNS" ]; then sips -s format png "$CLAUDE_ICNS" --out "$WORK/claude.png" >/dev/null && BADGE="$WORK/claude.png"; fi
osascript -l JavaScript "$DIR/make-icon.js" "$ROOT/assets/whink-logo.png" "$BADGE" "$WORK/icon.png" >/dev/null
mkdir "$WORK/i.iconset"
for s in 16 32 128 256 512; do
  sips -z $s $s "$WORK/icon.png" --out "$WORK/i.iconset/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) "$WORK/icon.png" --out "$WORK/i.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$WORK/i.iconset" -o "$WORK/icon.icns"

mkdir -p "$(dirname "$APP")"; rm -rf "$APP"
osacompile -o "$APP" -e "do shell script \"/bin/sh '$DIR/launch.sh' >/dev/null 2>&1 &\""
cp "$WORK/icon.icns" "$APP/Contents/Resources/applet.icns"
# osacompile also adds an icon catalog that wins over applet.icns on recent macOS: remove it, then re-sign (ad hoc, local only).
rm -f "$APP/Contents/Resources/Assets.car"
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$APP/Contents/Info.plist" 2>/dev/null || true
codesign --force --sign - "$APP" >/dev/null 2>&1
touch "$APP"; rm -rf "$WORK"
echo "Created: $APP"
[ "$BADGE" = - ] && echo "(Claude app not found, so the icon is the Whink logo only.)"
exit 0
