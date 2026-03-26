#!/bin/bash
# Opens two Chromium windows side-by-side for testing multiplayer
# Kills existing Chromium instances, opens fresh windows to meleelight.html
# Usage: bash tools/test.sh [port]

PORT=${1:-5001}
URL="http://localhost:$PORT/meleelight.html"
CHROMIUM="/c/Program Files/Chromium/Application/chrome.exe"

HALF_W=960
HEIGHT=1080

# Kill all existing Chromium processes
wmic process where "ExecutablePath like '%Chromium%'" call terminate 2>/dev/null

sleep 0.5

# Clear Chromium cache for test profiles
rm -rf "$TEMP/chromium-test-1/Default/Cache" "$TEMP/chromium-test-2/Default/Cache" 2>/dev/null

# Launch two Chromium app windows side by side (--disk-cache-size=0 disables cache)
"$CHROMIUM" --user-data-dir="$TEMP/chromium-test-1" --disk-cache-size=0 --window-size=$HALF_W,$HEIGHT --window-position=0,0 --app="$URL" 2>/dev/null &
sleep 0.5
"$CHROMIUM" --user-data-dir="$TEMP/chromium-test-2" --disk-cache-size=0 --window-size=$HALF_W,$HEIGHT --window-position=$HALF_W,0 --app="$URL" 2>/dev/null &

echo "Opened two Chromium test windows at $URL (cache disabled)"
