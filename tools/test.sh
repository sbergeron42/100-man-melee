#!/bin/bash
# Opens two Chrome windows side-by-side for testing multiplayer
# Hard refreshes if already open, opens new if not
# Usage: bash tools/test.sh [port]

PORT=${1:-5001}
URL="http://localhost:$PORT"
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"

HALF_W=960
HEIGHT=1080

# Kill existing test app windows
taskkill //FI "WINDOWTITLE eq localhost*" //F 2>/dev/null
sleep 0.5

# Launch two Chrome app windows side by side
"$CHROME" --new-window --window-size=$HALF_W,$HEIGHT --window-position=0,0 --app="$URL" 2>/dev/null &
sleep 0.3
"$CHROME" --new-window --window-size=$HALF_W,$HEIGHT --window-position=$HALF_W,0 --app="$URL" 2>/dev/null &

echo "Opened two fresh test windows at $URL"
