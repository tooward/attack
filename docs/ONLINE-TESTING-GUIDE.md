# Full Online Multiplayer Testing Guide

## Overview
This guide walks through testing the complete online multiplayer flow from server start to match completion.

## Prerequisites

1. **Node.js 20+** installed
2. **Two browser tabs** (or two devices)
3. **Terminal access**

## Setup Steps

### 1. Start the WebSocket Server

```bash
cd /Users/mikeiog/Development/attack/server
npm run build
node dist/index.js
```

**Expected Output:**
```
Matchmaking queue initialized
WebSocket server listening on port 8081
==================================================
Five Rings Fighting Game - Multiplayer Server
==================================================
WebSocket Server: ws://localhost:8081
Ready for connections...
==================================================
Replay storage initialized at: .../server/replays
```

### 2. Start the Game Client

In a new terminal:

```bash
cd /Users/mikeiog/Development/attack
npm run dev
```

**Expected Output:**
```
VITE v5.4.19  ready in 81 ms
➜  Local:   http://localhost:5173/
```

### 3. Open Two Browser Tabs

- Tab 1: http://localhost:5173
- Tab 2: http://localhost:5173

## Testing Flow

### Player 1 (Tab 1):

**Step 1: Navigate to Multiplayer**
1. Wait for main menu to load
2. Click "Online Multiplayer" button
3. ✅ MultiplayerMenuScene loads
4. ✅ Shows "Not Connected" status

**Step 2: Connect**
1. Click "Connect to Server"
2. ✅ Status changes to "Connecting..."
3. ✅ Status changes to "Connected" (green)
4. ✅ "Find Match" button appears

**Step 3: Join Queue**
1. Click "Find Match"
2. ✅ Shows "Searching for opponent... 0s"
3. ✅ Timer increments (1s, 2s, 3s...)
4. ✅ "Cancel" button appears

### Player 2 (Tab 2):

**Repeat Steps 1-3** in the second tab

**Expected:** When both players in queue:
- ✅ Match found within 2 seconds
- ✅ Both tabs show "Match found!"
- ✅ Both tabs transition to game scene

### Both Players (In Match):

**Step 4: Verify Game State**
1. ✅ Game scene loaded
2. ✅ Two fighters visible
3. ✅ Opponent info displayed (bottom-left)
4. ✅ Ping/delay info displayed
5. ✅ Round timer counting down
6. ✅ Health bars visible

**Step 5: Test Input Synchronization**

**Player 1 Controls:**
- Arrow Keys: Move
- Z: Light Punch
- X: Heavy Punch
- C: Light Kick
- V: Heavy Kick
- Down + Z: Special

**Player 2 Controls:**
- Arrow Keys: Move  
- Z/X/C/V: Attacks

**Test Cases:**
1. ✅ Player 1 moves left → Player 2 sees it
2. ✅ Player 2 moves right → Player 1 sees it
3. ✅ Player 1 punches → Player 2 gets hit
4. ✅ Player 2 blocks → Damage reduced
5. ✅ Both players' actions synchronized
6. ✅ No visible lag or stuttering

**Step 6: Monitor Network Stats**

Watch bottom-left display:
- ✅ Ping stays stable (< 50ms for localhost)
- ✅ Frame delay shows "2f" (minimum)
- ✅ No "Waiting..." messages appear

**Step 7: Test Disconnect**

Close Tab 1 (Player 1)

**Expected in Tab 2:**
- ✅ "Connection Lost" overlay appears
- ✅ "Returning to menu..." message
- ✅ Auto-returns to main menu after 3s

## Server Log Verification

Check server terminal output:

```
Client connected: <client-id-1>
Client connected: <client-id-2>
Player added to queue: user_123... (Elo: 1000)
Player added to queue: user_456... (Elo: 1000)
Match found: user_123 (1000) vs user_456 (1000)
  Elo diff: 0, Wait time: 0.2s
Started recording replay: room_<id>
GameRoom created: room_<id>
Match created: user_123 vs user_456 in room room_<id>
[... input messages ...]
Client disconnected: <client-id-1>
Stopped recording replay: room_<id>
  Duration: 5.3s, Frames: 320
  Winner: Player 2
Replay saved: /path/to/replays/2026-01/room_<id>.json
```

## Replay Verification

After a match, check replay file:

```bash
cd server/replays
ls -la 2026-01/

# Should show:
# room_<id>.json  (~45KB)
```

View replay:
```bash
cat 2026-01/room_*.json | head -50
```

**Expected Structure:**
```json
{
  "metadata": {
    "id": "room_...",
    "player1": { "userId": "user_123...", "elo": 1000 },
    "player2": { "userId": "user_456...", "elo": 1000 },
    "winner": 2,
    "matchDuration": 320,
    "training": {
      "skillLevel": "beginner",
      "qualityScore": 1
    }
  },
  "frames": [...],
  "compressed": true
}
```

## Common Issues & Solutions

### Issue: Server won't start
**Solution:**
```bash
lsof -ti:8081 | xargs kill -9  # Kill existing process
cd server && npm run build     # Rebuild
node dist/index.js             # Start
```

### Issue: Client can't connect
**Check:**
1. Server is running on port 8081
2. Browser console for WebSocket errors
3. Firewall not blocking connections

### Issue: Match not found
**Check:**
1. Both clients connected
2. Both clients authenticated  
3. Both clients in queue
4. Server logs show matchmaking

### Issue: Inputs not synchronized
**Check:**
1. Network stats (ping < 200ms)
2. Frame delay (2-8 frames)
3. "Waiting..." message frequency
4. Server logs show input messages

### Issue: Game stutters
**Possible Causes:**
1. High ping (> 200ms)
2. Packet loss
3. Server overloaded
4. Browser tab throttled

## Performance Baselines

### Localhost (Same Machine):
- **Ping:** < 10ms
- **Frame Delay:** 2 frames
- **Sync Issues:** None
- **FPS:** Stable 60

### LAN (Local Network):
- **Ping:** 10-50ms
- **Frame Delay:** 2-4 frames
- **Sync Issues:** Rare
- **FPS:** Stable 60

### Internet (Good Connection):
- **Ping:** 50-100ms
- **Frame Delay:** 4-6 frames
- **Sync Issues:** Occasional
- **FPS:** Stable 60

### Internet (Poor Connection):
- **Ping:** 100-200ms
- **Frame Delay:** 6-8 frames
- **Sync Issues:** Frequent "Waiting..."
- **FPS:** May drop

## Success Criteria

✅ **Connection:**
- Both clients connect within 1 second
- Authentication succeeds
- Client IDs assigned

✅ **Matchmaking:**
- Queue join works
- Match found within 30 seconds
- Both clients notified

✅ **Gameplay:**
- Both players see same game state
- Inputs synchronized (< 200ms perceived lag)
- No visual glitches
- 60fps maintained

✅ **Disconnect:**
- Graceful error handling
- Return to menu works
- No crashes

✅ **Replay:**
- Match recorded successfully
- File saved to disk
- Data integrity verified

## Next Steps

After successful testing:

1. **Mobile Testing** - Deploy to TestFlight
2. **Production Server** - Set up VPS/cloud hosting
3. **Beta Launch** - Invite players
4. **Monitor** - Track replays and player data
5. **Iterate** - Balance netcode based on feedback

## Quick Test Commands

```bash
# Terminal 1: Server
cd server && npm run build && node dist/index.js

# Terminal 2: Client
cd .. && npm run dev

# Terminal 3: Check replays
ls -lh server/replays/2026-01/

# Terminal 4: Monitor logs
tail -f /tmp/server.log  # if running backgrounded
```

## Automation (Optional)

Create `test-online.sh`:
```bash
#!/bin/bash

# Start server
cd server
npm run build
node dist/index.js > /tmp/server.log 2>&1 &
SERVER_PID=$!

# Wait for server
sleep 2

# Open clients
cd ..
npm run dev &
DEV_PID=$!

# Open browsers
sleep 2
open http://localhost:5173
sleep 1
open http://localhost:5173

echo "Server PID: $SERVER_PID"
echo "Dev PID: $DEV_PID"
echo "Press Ctrl+C to stop"

# Wait
wait
```

## Conclusion

Follow this guide to verify the complete online multiplayer system works end-to-end. All phases (A-E) must be complete for this to work successfully!
