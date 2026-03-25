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
tasklist //FI "IMAGENAME eq chrome.exe" //FI "MODULES eq chromium*" 2>/dev/null | grep -qi chromium && taskkill //F //IM chrome.exe 2>/dev/null
# More reliable: kill by exe path
wmic process where "ExecutablePath like '%Chromium%'" call terminate 2>/dev/null

sleep 0.5

# Launch two Chromium app windows side by side
"$CHROMIUM" --user-data-dir="$TEMP/chromium-test-1" --window-size=$HALF_W,$HEIGHT --window-position=0,0 --app="$URL" 2>/dev/null &
sleep 0.5
"$CHROMIUM" --user-data-dir="$TEMP/chromium-test-2" --window-size=$HALF_W,$HEIGHT --window-position=$HALF_W,0 --app="$URL" 2>/dev/null &

echo "Opened two Chromium test windows at $URL"
