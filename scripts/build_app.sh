#!/usr/bin/env bash
# Build a "thin" PianoCoach.app — a real macOS bundle with a custom icon that
# launches the native window WITHOUT a Terminal, reusing the existing uv env.
# It does NOT bundle Python/librosa/ffmpeg (that's the standalone path we skip).
#
# Reproducible: re-run any time. The .app is gitignored; this script is committed.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
APP="$ROOT/PianoCoach.app"
UV="/opt/homebrew/bin/uv"
APP_VERSION="0.1.0"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }

# ---- 1. Icon: PNG → .iconset → .icns ----
bold "1/4 · Génération de l'icône"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SRC="$TMP/icon_1024.png"
python3 "$ROOT/scripts/make_icon.py" "$SRC"

ICONSET="$TMP/PianoCoach.iconset"
mkdir -p "$ICONSET"
gen() { sips -z "$2" "$2" "$SRC" --out "$ICONSET/$1" >/dev/null; }
gen icon_16x16.png 16
gen icon_16x16@2x.png 32
gen icon_32x32.png 32
gen icon_32x32@2x.png 64
gen icon_128x128.png 128
gen icon_128x128@2x.png 256
gen icon_256x256.png 256
gen icon_256x256@2x.png 512
gen icon_512x512.png 512
cp "$SRC" "$ICONSET/icon_512x512@2x.png"  # 1024
iconutil -c icns "$ICONSET" -o "$TMP/PianoCoach.icns"

# ---- 2. Bundle skeleton ----
bold "2/4 · Assemblage du bundle"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$TMP/PianoCoach.icns" "$APP/Contents/Resources/PianoCoach.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>PianoCoach</string>
  <key>CFBundleDisplayName</key><string>PianoCoach</string>
  <key>CFBundleIdentifier</key><string>com.baptiste.pianocoach</string>
  <key>CFBundleExecutable</key><string>PianoCoach</string>
  <key>CFBundleIconFile</key><string>PianoCoach</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${APP_VERSION}</string>
  <key>CFBundleVersion</key><string>${APP_VERSION}</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
</dict>
</plist>
PLIST

# ---- 3. Launcher (no Terminal): exec the existing desktop launcher ----
# Quoted heredoc → $0 / dirname resolved at RUNTIME, so it works from /Applications.
cat > "$APP/Contents/MacOS/PianoCoach" <<'LAUNCH'
#!/bin/bash
# Tell the launcher where the bundle icon is (for the running Dock icon).
export PIANOCOACH_ICON="$(cd "$(dirname "$0")/../Resources" && pwd)/PianoCoach.icns"
cd /Users/baptiste/pianocoach || exit 1
exec /opt/homebrew/bin/uv run python -m desktop.main
LAUNCH
chmod +x "$APP/Contents/MacOS/PianoCoach"

# ---- 4. Install to /Applications + refresh icon caches ----
bold "3/4 · Installation dans /Applications"
rm -rf "/Applications/PianoCoach.app"
cp -R "$APP" "/Applications/PianoCoach.app"
touch "/Applications/PianoCoach.app"

bold "4/4 · Rafraîchissement de l'icône (Dock)"
killall Dock 2>/dev/null || true  # Dock relance tout seul, récupère la nouvelle icône

bold "Terminé ✅"
echo "Lance PianoCoach depuis le Launchpad / Spotlight, ou : open -a PianoCoach"
echo "Icône perso ? Remplace un PNG 1024×1024 et relance ce script (voir scripts/make_icon.py)."
