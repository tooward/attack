#!/bin/bash

echo "Starting matchmaking test..."
echo ""

# Start two clients in background
node /Users/mikeiog/Development/attack/server/test-matchmaking.js Alice 1200 &
PID1=$!

sleep 1

node /Users/mikeiog/Development/attack/server/test-matchmaking.js Bob 1250 &
PID2=$!

# Wait for both to complete
wait $PID1 $PID2

echo ""
echo "Test complete"
