# PvP Mobile Multiplayer - Implementation Plan

## Vision

Build real-time player-vs-player multiplayer on iOS and Android to capture high-quality human gameplay data for AI training. This creates a data flywheel where human matches continuously improve bot intelligence.

---

## Goals

### Primary Goals
1. **Enable real-time PvP** on mobile devices (iOS + Android)
2. **Capture all gameplay data** frame-by-frame for AI training
3. **Validate replay integrity** to ensure data quality
4. **Scale efficiently** to support growing player base

### Success Criteria
- Players find matches within 30 seconds
- Gameplay feels responsive (<100ms perceived lag)
- 90%+ of matches recorded successfully
- Replay validation catches 95%+ of tampered data
- App runs at 60fps on iPhone 12 / Galaxy A54
- 1000+ high-quality replays collected within first month

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│  Mobile App (iOS/Android via Capacitor)              │
│  ├─ Touch Controls Layer                             │
│  ├─ Phaser Layer (rendering)                         │
│  ├─ Core Game Engine (deterministic)                 │
│  ├─ Network Client (WebSocket)                       │
│  └─ Replay Recorder (local + upload)                 │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│  Backend Server (Node.js + TypeScript)               │
│  ├─ WebSocket Server (real-time sync)                │
│  ├─ Matchmaking Service                              │
│  ├─ Game State Authority (anti-cheat)                │
│  ├─ Replay Storage & Validation                      │
│  └─ User Authentication                              │
└──────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│  Database & Storage                                  │
│  ├─ User accounts (Firebase Auth / Supabase)         │
│  ├─ Replay data (PostgreSQL / MongoDB)               │
│  └─ Match history & Elo ratings                      │
└──────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Mobile App
- **Framework:** Capacitor 6.x (wraps web app for native deployment)
- **Game Engine:** Phaser 3.88.2 (existing)
- **Core Logic:** TypeScript (existing deterministic engine)
- **Networking:** WebSocket (via `ws` library)
- **Local Storage:** Capacitor Storage plugin

### Backend
- **Runtime:** Node.js 20+ with TypeScript
- **WebSocket:** `ws` library (or Socket.IO for easier reconnection)
- **HTTP Server:** Express.js
- **Database:** PostgreSQL (via Supabase or self-hosted)
- **Queue:** Redis (for matchmaking)
- **Auth:** Supabase Auth or Firebase Auth

### Infrastructure
- **Hosting:** DigitalOcean Droplet ($12-24/month) or AWS EC2
- **Database:** Supabase (free tier → $25/month) or self-hosted PostgreSQL
- **CDN:** Cloudflare (free tier)
- **Monitoring:** Sentry (error tracking), Grafana (metrics)

---

## Phase Breakdown

### Phase A: Mobile Foundation (Week 1-2)

#### A.1: Capacitor Setup
**Goal:** Package web app for iOS/Android app stores

**Implementation Steps:**
1. Install Capacitor:
   ```bash
   npm install @capacitor/cli @capacitor/core
   npx cap init
   ```

2. Add platforms:
   ```bash
   npx cap add ios
   npx cap add android
   ```

3. Configure `capacitor.config.ts`:
   ```typescript
   import { CapacitorConfig } from '@capacitor/cli';
   
   const config: CapacitorConfig = {
     appId: 'com.fiverings.fighting',
     appName: 'Five Rings',
     webDir: 'dist',
     server: {
       androidScheme: 'https'
     },
     plugins: {
       SplashScreen: {
         launchShowDuration: 2000,
         backgroundColor: "#000000"
       }
     }
   };
   
   export default config;
   ```

4. Create app icons and splash screens:
   - Icon: 1024x1024 PNG
   - Splash: 2732x2732 PNG
   - Use `@capacitor/assets` to generate all sizes

5. Test builds:
   ```bash
   npm run build
   npx cap sync
   npx cap open ios    # Opens Xcode
   npx cap open android # Opens Android Studio
   ```

**Deliverables:**
- [ ] iOS project builds and runs in simulator
- [ ] Android project builds and runs in emulator
- [ ] App launches and shows main menu
- [ ] Icons and splash screens display correctly

---

#### A.2: Touch Controls
**Goal:** Replace keyboard with on-screen gamepad

**Design Layout:**
```
┌─────────────────────────────────────────────────────┐
│  [P1 Health]         [Timer]         [P2 Health]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│                  [GAME AREA]                        │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│  D-PAD                              ACTION BUTTONS  │
│    ⬆                                    ⭕ HP       │
│  ⬅ ⬇ ➡                              ⭕ LP          │
│                                      ⭕ HK          │
│  [🛡 BLOCK]                          ⭕ LK          │
└─────────────────────────────────────────────────────┘
```

**Implementation:**

**File:** `src/phaser/ui/TouchControlsOverlay.ts`

```typescript
export class TouchControlsOverlay extends Phaser.GameObjects.Container {
  private dpad: DPadControl;
  private actionButtons: Map<string, ActionButton>;
  private activeInputs: Set<InputAction> = new Set();
  
  constructor(scene: Phaser.Scene) {
    super(scene);
    
    // Create D-Pad (left side)
    this.dpad = new DPadControl(scene, 120, scene.cameras.main.height - 120);
    this.add(this.dpad);
    
    // Create action buttons (right side)
    const buttonLayout = [
      { action: InputAction.HP, x: -80, y: -80 },
      { action: InputAction.LP, x: -80, y: 0 },
      { action: InputAction.HK, x: 0, y: -40 },
      { action: InputAction.LK, x: 0, y: 40 },
    ];
    
    const baseX = scene.cameras.main.width - 120;
    const baseY = scene.cameras.main.height - 120;
    
    this.actionButtons = new Map();
    for (const btn of buttonLayout) {
      const button = new ActionButton(scene, baseX + btn.x, baseY + btn.y, btn.action);
      this.actionButtons.set(btn.action, button);
      this.add(button);
    }
    
    // Block button (bottom left)
    const blockButton = new ActionButton(
      scene, 
      120, 
      scene.cameras.main.height - 250, 
      InputAction.BLOCK
    );
    this.actionButtons.set(InputAction.BLOCK, blockButton);
    this.add(blockButton);
    
    this.setupInputHandlers();
  }
  
  private setupInputHandlers() {
    // D-Pad
    this.dpad.on('directionChange', (direction: string | null) => {
      // Remove old directional inputs
      this.activeInputs.delete(InputAction.LEFT);
      this.activeInputs.delete(InputAction.RIGHT);
      this.activeInputs.delete(InputAction.UP);
      this.activeInputs.delete(InputAction.DOWN);
      
      // Add new direction
      if (direction === 'left') this.activeInputs.add(InputAction.LEFT);
      if (direction === 'right') this.activeInputs.add(InputAction.RIGHT);
      if (direction === 'up') this.activeInputs.add(InputAction.UP);
      if (direction === 'down') this.activeInputs.add(InputAction.DOWN);
    });
    
    // Action buttons
    for (const [action, button] of this.actionButtons) {
      button.on('pressed', () => {
        this.activeInputs.add(action);
        this.triggerHaptic('light');
      });
      
      button.on('released', () => {
        this.activeInputs.delete(action);
      });
    }
  }
  
  getCurrentInput(): InputAction[] {
    return Array.from(this.activeInputs);
  }
  
  private async triggerHaptic(style: 'light' | 'medium' | 'heavy') {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style });
    }
  }
}
```

**File:** `src/phaser/ui/DPadControl.ts`

```typescript
export class DPadControl extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Graphics;
  private directions: Map<string, Phaser.GameObjects.Graphics>;
  private activeDirection: string | null = null;
  
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    
    // Draw background circle
    this.background = scene.add.graphics();
    this.background.fillStyle(0x333333, 0.5);
    this.background.fillCircle(0, 0, 60);
    this.add(this.background);
    
    // Draw directional segments
    this.directions = new Map();
    const segments = [
      { key: 'up', angle: -90, color: 0x4a90e2 },
      { key: 'down', angle: 90, color: 0x4a90e2 },
      { key: 'left', angle: 180, color: 0x4a90e2 },
      { key: 'right', angle: 0, color: 0x4a90e2 },
    ];
    
    for (const seg of segments) {
      const graphic = scene.add.graphics();
      graphic.fillStyle(seg.color, 0.7);
      graphic.slice(0, 0, 50, Phaser.Math.DegToRad(seg.angle - 30), Phaser.Math.DegToRad(seg.angle + 30));
      graphic.fillPath();
      graphic.setAlpha(0.3);
      this.directions.set(seg.key, graphic);
      this.add(graphic);
    }
    
    this.setSize(120, 120);
    this.setInteractive(new Phaser.Geom.Circle(0, 0, 60), Phaser.Geom.Circle.Contains);
    
    this.setupTouchHandlers();
  }
  
  private setupTouchHandlers() {
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      
      const localX = pointer.x - this.x;
      const localY = pointer.y - this.y;
      const distance = Math.sqrt(localX * localX + localY * localY);
      
      if (distance > 60) return; // Outside d-pad
      
      const angle = Phaser.Math.Angle.Between(0, 0, localX, localY);
      const degrees = Phaser.Math.RadToDeg(angle);
      
      let newDirection: string | null = null;
      if (degrees > -45 && degrees < 45) newDirection = 'right';
      else if (degrees >= 45 && degrees < 135) newDirection = 'down';
      else if (degrees >= 135 || degrees < -135) newDirection = 'left';
      else if (degrees >= -135 && degrees <= -45) newDirection = 'up';
      
      if (newDirection !== this.activeDirection) {
        this.setActiveDirection(newDirection);
      }
    });
    
    this.scene.input.on('pointerup', () => {
      this.setActiveDirection(null);
    });
  }
  
  private setActiveDirection(direction: string | null) {
    // Reset all
    for (const graphic of this.directions.values()) {
      graphic.setAlpha(0.3);
    }
    
    // Highlight active
    if (direction && this.directions.has(direction)) {
      this.directions.get(direction)!.setAlpha(1.0);
    }
    
    this.activeDirection = direction;
    this.emit('directionChange', direction);
  }
}
```

**File:** `src/phaser/ui/ActionButton.ts`

```typescript
export class ActionButton extends Phaser.GameObjects.Container {
  private button: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private isPressed: boolean = false;
  
  constructor(
    scene: Phaser.Scene, 
    x: number, 
    y: number, 
    action: InputAction
  ) {
    super(scene, x, y);
    
    // Draw button
    this.button = scene.add.graphics();
    this.button.fillStyle(0xe74c3c, 0.8);
    this.button.fillCircle(0, 0, 35);
    this.add(this.button);
    
    // Add label
    const labelText = this.getActionLabel(action);
    this.label = scene.add.text(0, 0, labelText, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    this.label.setOrigin(0.5);
    this.add(this.label);
    
    this.setSize(70, 70);
    this.setInteractive(new Phaser.Geom.Circle(0, 0, 35), Phaser.Geom.Circle.Contains);
    
    this.setupTouchHandlers();
  }
  
  private getActionLabel(action: InputAction): string {
    const labels = {
      [InputAction.LP]: 'LP',
      [InputAction.HP]: 'HP',
      [InputAction.LK]: 'LK',
      [InputAction.HK]: 'HK',
      [InputAction.BLOCK]: '🛡',
    };
    return labels[action] || '?';
  }
  
  private setupTouchHandlers() {
    this.on('pointerdown', () => {
      this.isPressed = true;
      this.button.clear();
      this.button.fillStyle(0xff6b6b, 1.0);
      this.button.fillCircle(0, 0, 35);
      this.emit('pressed');
    });
    
    this.on('pointerup', () => {
      this.isPressed = false;
      this.button.clear();
      this.button.fillStyle(0xe74c3c, 0.8);
      this.button.fillCircle(0, 0, 35);
      this.emit('released');
    });
    
    this.on('pointerout', () => {
      if (this.isPressed) {
        this.isPressed = false;
        this.button.clear();
        this.button.fillStyle(0xe74c3c, 0.8);
        this.button.fillCircle(0, 0, 35);
        this.emit('released');
      }
    });
  }
}
```

**Integration with FightScene:**

```typescript
// In FightScene.ts
create() {
  // ... existing setup ...
  
  // Add touch controls for mobile
  if (this.sys.game.device.os.android || this.sys.game.device.os.iOS) {
    this.touchControls = new TouchControlsOverlay(this);
    this.add.existing(this.touchControls);
  }
}

update() {
  // Get inputs
  let inputs: InputAction[];
  if (this.touchControls) {
    inputs = this.touchControls.getCurrentInput();
  } else {
    inputs = this.inputManager.getCurrentInput(); // Keyboard
  }
  
  // ... rest of update logic ...
}
```

**Deliverables:**
- [ ] D-Pad controls directional movement
- [ ] Action buttons trigger attacks
- [ ] Haptic feedback on button press
- [ ] Visual feedback (button press animation)
- [ ] Simultaneous inputs work (e.g., ⬇➡ + punch)
- [ ] Configurable layout (left-handed mode)

---

#### A.3: Performance Optimization
**Goal:** Maintain 60fps on mid-tier mobile devices

**Optimization Checklist:**

1. **Texture Atlases**
   ```typescript
   // Pack all sprites into atlases
   this.load.atlas('fighters', 'fighters.png', 'fighters.json');
   this.load.atlas('effects', 'effects.png', 'effects.json');
   ```

2. **Resolution Scaling**
   ```typescript
   // In game config
   const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
   const scale = isMobile ? 0.75 : 1.0;
   
   config.scale = {
     width: 1920 * scale,
     height: 1080 * scale,
     mode: Phaser.Scale.FIT,
     autoCenter: Phaser.Scale.CENTER_BOTH
   };
   ```

3. **Object Pooling**
   ```typescript
   class ProjectilePool {
     private pool: Projectile[] = [];
     
     get(): Projectile {
       return this.pool.pop() || new Projectile();
     }
     
     release(projectile: Projectile) {
       projectile.setActive(false);
       this.pool.push(projectile);
     }
   }
   ```

4. **Audio Compression**
   - Use OGG Vorbis format
   - Lazy-load sound effects
   - Limit simultaneous sounds

5. **Canvas Optimization**
   ```typescript
   config.render = {
     powerPreference: 'high-performance',
     roundPixels: true,
     pixelArt: false
   };
   ```

**Performance Targets:**
- 60fps on iPhone 12 / Galaxy A54
- <200ms cold start time
- <50MB installed app size
- <30MB RAM usage during gameplay

**Deliverables:**
- [ ] App runs at 60fps on target devices
- [ ] No dropped frames during combos
- [ ] Quick load times (<3 seconds)
- [ ] Battery drain is acceptable (<10%/hour)

---

### Phase B: Backend Server (Week 2-3)

#### B.1: WebSocket Server
**Goal:** Real-time communication between clients

**File:** `server/src/websocket/NetworkManager.ts`

```typescript
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

export interface ClientConnection {
  id: string;
  ws: WebSocket;
  userId: string | null;
  currentRoomId: string | null;
  lastPing: number;
}

export class NetworkManager {
  private wss: WebSocket.Server;
  private clients: Map<string, ClientConnection> = new Map();
  private rooms: Map<string, GameRoom> = new Map();
  
  constructor(port: number) {
    this.wss = new WebSocket.Server({ port });
    this.setupServer();
  }
  
  private setupServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = uuidv4();
      const client: ClientConnection = {
        id: clientId,
        ws,
        userId: null,
        currentRoomId: null,
        lastPing: Date.now()
      };
      
      this.clients.set(clientId, client);
      
      ws.on('message', (data: string) => {
        this.handleMessage(client, data);
      });
      
      ws.on('close', () => {
        this.handleDisconnect(client);
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
      
      // Send connection confirmation
      this.send(client, {
        type: 'CONNECTED',
        clientId
      });
    });
    
    // Ping clients every 30 seconds
    setInterval(() => this.pingClients(), 30000);
  }
  
  private handleMessage(client: ClientConnection, data: string) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'AUTHENTICATE':
          this.handleAuth(client, message.token);
          break;
          
        case 'JOIN_QUEUE':
          this.handleJoinQueue(client);
          break;
          
        case 'INPUT':
          this.handleInput(client, message);
          break;
          
        case 'PONG':
          client.lastPing = Date.now();
          break;
          
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }
  
  private handleDisconnect(client: ClientConnection) {
    // Remove from room if in one
    if (client.currentRoomId) {
      const room = this.rooms.get(client.currentRoomId);
      if (room) {
        room.handlePlayerDisconnect(client.id);
      }
    }
    
    this.clients.delete(client.id);
  }
  
  private pingClients() {
    for (const client of this.clients.values()) {
      if (Date.now() - client.lastPing > 60000) {
        // Disconnect if no pong in 60 seconds
        client.ws.close();
      } else {
        this.send(client, { type: 'PING' });
      }
    }
  }
  
  private send(client: ClientConnection, message: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
}
```

**File:** `server/src/websocket/GameRoom.ts`

```typescript
import { FightingGame } from '../../../src/core/FightingGame';

export class GameRoom {
  id: string;
  player1: ClientConnection;
  player2: ClientConnection;
  gameState: GameState;
  startFrame: number;
  inputBuffer: Map<string, InputFrame[]> = new Map();
  
  constructor(p1: ClientConnection, p2: ClientConnection) {
    this.id = uuidv4();
    this.player1 = p1;
    this.player2 = p2;
    
    // Initialize game
    this.gameState = FightingGame.createInitialState({
      entities: [
        createFighter('musashi', 'player1', 0, { x: 300, y: 0 }),
        createFighter('musashi', 'player2', 1, { x: 1600, y: 0 })
      ]
    });
    
    this.startFrame = 0;
    
    // Notify players
    this.broadcast({
      type: 'MATCH_START',
      roomId: this.id,
      opponentId: p1.id === this.player1.id ? p2.id : p1.id,
      startFrame: this.startFrame,
      initialState: this.gameState
    });
  }
  
  handleInput(clientId: string, frame: number, actions: InputAction[]) {
    const playerId = clientId === this.player1.id ? 'player1' : 'player2';
    
    if (!this.inputBuffer.has(playerId)) {
      this.inputBuffer.set(playerId, []);
    }
    
    this.inputBuffer.get(playerId)!.push({ frame, actions });
    
    // Check if we have inputs from both players for this frame
    this.tryAdvanceFrame(frame);
  }
  
  private tryAdvanceFrame(frame: number) {
    const p1Inputs = this.inputBuffer.get('player1') || [];
    const p2Inputs = this.inputBuffer.get('player2') || [];
    
    const p1Input = p1Inputs.find(i => i.frame === frame);
    const p2Input = p2Inputs.find(i => i.frame === frame);
    
    if (p1Input && p2Input) {
      // Both players ready, advance game state
      const inputs = new Map<string, InputFrame>();
      inputs.set('player1', p1Input);
      inputs.set('player2', p2Input);
      
      this.gameState = FightingGame.tick(this.gameState, inputs);
      
      // Clean up old inputs
      this.inputBuffer.set('player1', p1Inputs.filter(i => i.frame > frame));
      this.inputBuffer.set('player2', p2Inputs.filter(i => i.frame > frame));
      
      // Broadcast state update (only corrections, not every frame)
      if (frame % 60 === 0) { // Every second
        this.broadcast({
          type: 'STATE_CORRECTION',
          frame,
          state: this.gameState
        });
      }
      
      // Check for match end
      if (this.gameState.isMatchOver) {
        this.handleMatchEnd();
      }
    }
  }
  
  private handleMatchEnd() {
    const winner = this.gameState.match.matchWinner;
    
    this.broadcast({
      type: 'MATCH_END',
      winner,
      finalState: this.gameState
    });
    
    // Save replay (handled by ReplayStorage)
    // Clean up room after delay
    setTimeout(() => this.cleanup(), 5000);
  }
  
  handlePlayerDisconnect(clientId: string) {
    const otherPlayer = clientId === this.player1.id ? this.player2 : this.player1;
    
    this.send(otherPlayer, {
      type: 'OPPONENT_DISCONNECTED'
    });
    
    this.cleanup();
  }
  
  private broadcast(message: any) {
    this.send(this.player1, message);
    this.send(this.player2, message);
  }
  
  private send(client: ClientConnection, message: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }
  
  private cleanup() {
    this.player1.currentRoomId = null;
    this.player2.currentRoomId = null;
    // Room will be garbage collected
  }
}
```

**Deliverables:**
- [ ] WebSocket server accepts connections
- [ ] Clients can send/receive messages
- [ ] Game rooms created for matched players
- [ ] Input synchronization works
- [ ] Disconnection handled gracefully

---

#### B.2: Matchmaking System
**Goal:** Pair players by skill and latency

**File:** `server/src/matchmaking/MatchmakingQueue.ts`

```typescript
interface QueueEntry {
  clientId: string;
  userId: string;
  elo: number;
  region: string;
  joinTime: number;
}

export class MatchmakingQueue {
  private queue: QueueEntry[] = [];
  private matchCheckInterval: NodeJS.Timeout;
  
  constructor() {
    // Check for matches every 2 seconds
    this.matchCheckInterval = setInterval(() => this.tryMatchPlayers(), 2000);
  }
  
  addPlayer(client: ClientConnection, elo: number, region: string) {
    const entry: QueueEntry = {
      clientId: client.id,
      userId: client.userId!,
      elo,
      region,
      joinTime: Date.now()
    };
    
    this.queue.push(entry);
    this.tryMatchPlayers();
  }
  
  removePlayer(clientId: string) {
    this.queue = this.queue.filter(e => e.clientId !== clientId);
  }
  
  private tryMatchPlayers() {
    if (this.queue.length < 2) return;
    
    // Sort by join time (FIFO)
    this.queue.sort((a, b) => a.joinTime - b.joinTime);
    
    for (let i = 0; i < this.queue.length; i++) {
      for (let j = i + 1; j < this.queue.length; j++) {
        if (this.isGoodMatch(this.queue[i], this.queue[j])) {
          this.createMatch(this.queue[i], this.queue[j]);
          
          // Remove from queue
          this.queue.splice(j, 1);
          this.queue.splice(i, 1);
          return; // Match one pair at a time
        }
      }
    }
  }
  
  private isGoodMatch(p1: QueueEntry, p2: QueueEntry): boolean {
    // Same region
    if (p1.region !== p2.region) return false;
    
    // Elo difference
    const eloDiff = Math.abs(p1.elo - p2.elo);
    const waitTime = Date.now() - Math.min(p1.joinTime, p2.joinTime);
    
    // Start strict, relax over time
    const maxEloDiff = 200 + (waitTime / 1000) * 10; // +10 Elo per second
    
    return eloDiff < maxEloDiff;
  }
  
  private createMatch(p1: QueueEntry, p2: QueueEntry) {
    const client1 = networkManager.getClient(p1.clientId);
    const client2 = networkManager.getClient(p2.clientId);
    
    if (!client1 || !client2) return;
    
    const room = new GameRoom(client1, client2);
    networkManager.addRoom(room);
    
    console.log(`Match created: ${p1.userId} (${p1.elo}) vs ${p2.userId} (${p2.elo})`);
  }
}
```

**Deliverables:**
- [ ] Players added to queue successfully
- [ ] Matches created based on Elo similarity
- [ ] Wait time increases acceptable Elo range
- [ ] Region locking works
- [ ] Average matchmaking time <30 seconds

---

### Phase C: Gameplay Recording (Week 3-4)

#### C.1: Replay Format
**Goal:** Capture every frame for AI training

**File:** `shared/types/Replay.ts`

```typescript
export interface MultiplayerReplay {
  metadata: ReplayMetadata;
  frames: ReplayFrame[];
  compressed: boolean;
}

export interface ReplayMetadata {
  id: string;
  date: number;
  version: string;
  player1: PlayerInfo;
  player2: PlayerInfo;
  winner: 1 | 2 | null;
  matchDuration: number;
  averagePing: number;
  region: string;
  
  // Training metadata
  training: {
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    tags: string[];
    qualityScore: number;
  };
}

export interface PlayerInfo {
  userId: string;
  characterId: string;
  elo: number;
  wins: number;
  losses: number;
}

export interface ReplayFrame {
  frame: number;
  gameState: GameState;
  player1Input: InputAction[];
  player2Input: InputAction[];
  ping: { p1: number; p2: number };
}

// Delta-compressed frame (stores only changes)
export interface DeltaFrame {
  frame: number;
  changes: Record<string, any>; // Paths to changed values
}
```

**Delta Compression:**

```typescript
export class ReplayCompressor {
  compress(replay: MultiplayerReplay): MultiplayerReplay {
    if (replay.frames.length === 0) return replay;
    
    const compressed: DeltaFrame[] = [];
    
    // First frame is always full
    compressed.push({
      frame: 0,
      changes: { _full: replay.frames[0] }
    });
    
    // Subsequent frames are deltas
    for (let i = 1; i < replay.frames.length; i++) {
      const prev = replay.frames[i - 1];
      const curr = replay.frames[i];
      const delta = this.computeDelta(prev, curr);
      
      compressed.push({
        frame: i,
        changes: delta
      });
    }
    
    return {
      ...replay,
      frames: compressed as any,
      compressed: true
    };
  }
  
  private computeDelta(prev: ReplayFrame, curr: ReplayFrame): Record<string, any> {
    const changes: Record<string, any> = {};
    
    // Compare nested objects
    this.compareObjects('gameState', prev.gameState, curr.gameState, changes);
    
    // Inputs (always include)
    changes['player1Input'] = curr.player1Input;
    changes['player2Input'] = curr.player2Input;
    
    return changes;
  }
  
  private compareObjects(
    path: string, 
    prev: any, 
    curr: any, 
    changes: Record<string, any>
  ) {
    if (typeof curr !== 'object' || curr === null) {
      if (prev !== curr) {
        changes[path] = curr;
      }
      return;
    }
    
    for (const key in curr) {
      const newPath = `${path}.${key}`;
      this.compareObjects(newPath, prev?.[key], curr[key], changes);
    }
  }
  
  decompress(replay: MultiplayerReplay): MultiplayerReplay {
    if (!replay.compressed) return replay;
    
    const frames: ReplayFrame[] = [];
    let current: any = null;
    
    for (const deltaFrame of replay.frames as any as DeltaFrame[]) {
      if (deltaFrame.changes._full) {
        // Full frame
        current = deltaFrame.changes._full;
      } else {
        // Apply delta
        current = { ...current };
        for (const [path, value] of Object.entries(deltaFrame.changes)) {
          this.setNestedValue(current, path, value);
        }
      }
      
      frames.push(current);
    }
    
    return {
      ...replay,
      frames,
      compressed: false
    };
  }
  
  private setNestedValue(obj: any, path: string, value: any) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
  }
}
```

**Deliverables:**
- [ ] Replay format captures all necessary data
- [ ] Delta compression reduces size by 80-90%
- [ ] Decompression produces identical replay
- [ ] Replays can be serialized to JSON

---

#### C.2: Client-Side Recording

**File:** `src/network/ReplayRecorder.ts`

```typescript
export class ReplayRecorder {
  private frames: ReplayFrame[] = [];
  private metadata: Partial<ReplayMetadata> | null = null;
  private isRecording: boolean = false;
  
  startRecording(matchId: string, players: [PlayerInfo, PlayerInfo]) {
    this.isRecording = true;
    this.frames = [];
    this.metadata = {
      id: matchId,
      date: Date.now(),
      version: '1.0.0',
      player1: players[0],
      player2: players[1],
      matchDuration: 0,
      averagePing: 0,
      region: 'us-east',
      training: {
        skillLevel: this.determineSkillLevel(players),
        tags: [],
        qualityScore: 0
      }
    };
  }
  
  recordFrame(
    gameState: GameState,
    inputs: Map<string, InputAction[]>,
    ping: { p1: number; p2: number }
  ) {
    if (!this.isRecording) return;
    
    this.frames.push({
      frame: gameState.frame,
      gameState: JSON.parse(JSON.stringify(gameState)), // Deep copy
      player1Input: inputs.get('player1') || [],
      player2Input: inputs.get('player2') || [],
      ping
    });
  }
  
  async finishRecording(winner: 1 | 2 | null): Promise<string> {
    if (!this.isRecording || !this.metadata) {
      throw new Error('No recording in progress');
    }
    
    this.isRecording = false;
    
    // Finalize metadata
    const replay: MultiplayerReplay = {
      metadata: {
        ...this.metadata,
        winner,
        matchDuration: this.frames.length,
        averagePing: this.calculateAveragePing()
      } as ReplayMetadata,
      frames: this.frames,
      compressed: false
    };
    
    // Calculate quality score
    replay.metadata.training.qualityScore = this.calculateQuality(replay);
    
    // Compress
    const compressor = new ReplayCompressor();
    const compressed = compressor.compress(replay);
    
    // Upload to server
    const replayId = await this.uploadReplay(compressed);
    
    // Save local copy (optional)
    await this.saveLocal(compressed);
    
    return replayId;
  }
  
  private calculateAveragePing(): number {
    if (this.frames.length === 0) return 0;
    
    const sum = this.frames.reduce((acc, f) => 
      acc + f.ping.p1 + f.ping.p2, 0
    );
    
    return sum / (this.frames.length * 2);
  }
  
  private calculateQuality(replay: MultiplayerReplay): number {
    let score = 1.0;
    
    // Penalize short matches (ragequits)
    if (replay.metadata.matchDuration < 1800) {
      score *= 0.5;
    }
    
    // Penalize high latency
    if (replay.metadata.averagePing > 150) {
      score *= 0.7;
    }
    
    // Penalize one-sided matches
    const finalState = replay.frames[replay.frames.length - 1].gameState;
    const healthDiff = Math.abs(
      finalState.entities[0].health - finalState.entities[1].health
    );
    
    if (healthDiff > 80) {
      score *= 0.6;
    }
    
    // Reward close matches
    if (healthDiff < 20) {
      score *= 1.2;
    }
    
    return Math.min(score, 1.0);
  }
  
  private async uploadReplay(replay: MultiplayerReplay): Promise<string> {
    const response = await fetch('/api/replays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replay)
    });
    
    const { replayId } = await response.json();
    return replayId;
  }
  
  private async saveLocal(replay: MultiplayerReplay) {
    // Use Capacitor Storage
    await Storage.set({
      key: `replay_${replay.metadata.id}`,
      value: JSON.stringify(replay)
    });
  }
  
  private determineSkillLevel(players: [PlayerInfo, PlayerInfo]): string {
    const avgElo = (players[0].elo + players[1].elo) / 2;
    
    if (avgElo < 1000) return 'beginner';
    if (avgElo < 1500) return 'intermediate';
    if (avgElo < 2000) return 'advanced';
    return 'expert';
  }
}
```

**Deliverables:**
- [ ] Replays recorded automatically during matches
- [ ] Quality score calculated correctly
- [ ] Replays uploaded to server after match
- [ ] Local copy saved for offline review

---

#### C.3: Server-Side Validation

**File:** `server/src/replay/ReplayValidator.ts`

```typescript
export class ReplayValidator {
  async validateReplay(replay: MultiplayerReplay): Promise<ValidationResult> {
    const errors: string[] = [];
    
    // 1. Check determinism: Re-simulate match from inputs
    const determinismCheck = await this.checkDeterminism(replay);
    if (!determinismCheck.valid) {
      errors.push(`Determinism check failed: ${determinismCheck.error}`);
    }
    
    // 2. Check for impossible inputs
    const inputCheck = this.checkInputValidity(replay);
    if (!inputCheck.valid) {
      errors.push(`Input validation failed: ${inputCheck.error}`);
    }
    
    // 3. Check metadata consistency
    const metadataCheck = this.checkMetadata(replay);
    if (!metadataCheck.valid) {
      errors.push(`Metadata validation failed: ${metadataCheck.error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private async checkDeterminism(replay: MultiplayerReplay): Promise<CheckResult> {
    try {
      // Decompress if needed
      const compressor = new ReplayCompressor();
      const decompressed = replay.compressed 
        ? compressor.decompress(replay) 
        : replay;
      
      // Initialize game state
      const initialState = decompressed.frames[0].gameState;
      let currentState = initialState;
      
      // Re-simulate each frame
      for (let i = 1; i < decompressed.frames.length; i++) {
        const frame = decompressed.frames[i];
        const inputs = new Map<string, InputFrame>();
        
        inputs.set('player1', {
          frame: frame.frame,
          actions: frame.player1Input
        });
        
        inputs.set('player2', {
          frame: frame.frame,
          actions: frame.player2Input
        });
        
        currentState = FightingGame.tick(currentState, inputs);
        
        // Compare with recorded state (sample every 60 frames)
        if (i % 60 === 0) {
          if (!this.statesMatch(currentState, frame.gameState)) {
            return {
              valid: false,
              error: `State mismatch at frame ${i}`
            };
          }
        }
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: `Simulation error: ${error.message}`
      };
    }
  }
  
  private statesMatch(a: GameState, b: GameState): boolean {
    // Compare critical fields
    if (a.frame !== b.frame) return false;
    
    for (let i = 0; i < a.entities.length; i++) {
      const ea = a.entities[i];
      const eb = b.entities[i];
      
      if (Math.abs(ea.position.x - eb.position.x) > 1) return false;
      if (Math.abs(ea.position.y - eb.position.y) > 1) return false;
      if (ea.health !== eb.health) return false;
      if (ea.status !== eb.status) return false;
    }
    
    return true;
  }
  
  private checkInputValidity(replay: MultiplayerReplay): CheckResult {
    // Check for frame-perfect inputs at inhuman rate
    let perfectFrames = 0;
    
    for (const frame of replay.frames) {
      // Check if inputs are frame-perfect (e.g., combo execution)
      if (this.isFramePerfect(frame)) {
        perfectFrames++;
      }
    }
    
    const perfectRate = perfectFrames / replay.frames.length;
    
    // Flag if >95% frame-perfect (likely TAS/bot)
    if (perfectRate > 0.95) {
      return {
        valid: false,
        error: `Suspiciously high perfect input rate: ${(perfectRate * 100).toFixed(1)}%`
      };
    }
    
    return { valid: true };
  }
  
  private isFramePerfect(frame: ReplayFrame): boolean {
    // Example: Check if complex motion input executed perfectly
    // This is game-specific logic
    return false;
  }
  
  private checkMetadata(replay: MultiplayerReplay): CheckResult {
    const meta = replay.metadata;
    
    if (meta.matchDuration !== replay.frames.length) {
      return {
        valid: false,
        error: 'Match duration mismatch'
      };
    }
    
    if (meta.player1.userId === meta.player2.userId) {
      return {
        valid: false,
        error: 'Same user played both sides'
      };
    }
    
    return { valid: true };
  }
}

interface CheckResult {
  valid: boolean;
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

**Deliverables:**
- [ ] Validation catches tampered replays
- [ ] Determinism check works correctly
- [ ] Invalid inputs detected
- [ ] Validation runs in <1 second per replay

---

### Phase D: Privacy & Deployment (Week 4)

#### D.1: User Consent
**Goal:** Comply with GDPR/CCPA

**Implementation:**

**File:** `src/scenes/ConsentScene.ts`

```typescript
export class ConsentScene extends Phaser.Scene {
  create() {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    // Title
    this.add.text(centerX, 100, 'Data Collection Notice', {
      fontSize: '32px',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Explanation
    const explanation = [
      'Five Rings records your matches to improve AI opponents.',
      '',
      'Your gameplay data is:',
      '• Anonymized (no personal information)',
      '• Used only for AI training',
      '• Stored securely',
      '',
      'You can opt-out anytime in Settings.'
    ].join('\n');
    
    this.add.text(centerX, centerY - 50, explanation, {
      fontSize: '18px',
      align: 'center',
      wordWrap: { width: 600 }
    }).setOrigin(0.5);
    
    // Toggles
    const recordingToggle = this.add.text(
      centerX - 200, centerY + 150,
      '☑ Allow gameplay recording',
      { fontSize: '20px' }
    ).setInteractive();
    
    const publicToggle = this.add.text(
      centerX - 200, centerY + 200,
      '☐ Make my replays public',
      { fontSize: '20px' }
    ).setInteractive();
    
    // Continue button
    const continueButton = this.add.text(
      centerX, centerY + 280,
      'Continue',
      { fontSize: '24px', backgroundColor: '#4a90e2', padding: { x: 20, y: 10 } }
    ).setOrigin(0.5).setInteractive();
    
    continueButton.on('pointerdown', () => {
      // Save preferences
      this.saveConsent({
        allowRecording: recordingToggle.text.includes('☑'),
        makePublic: publicToggle.text.includes('☑')
      });
      
      this.scene.start('MenuScene');
    });
    
    // Toggle handlers
    recordingToggle.on('pointerdown', () => {
      const checked = recordingToggle.text.includes('☑');
      recordingToggle.setText(
        checked ? '☐ Allow gameplay recording' : '☑ Allow gameplay recording'
      );
    });
    
    publicToggle.on('pointerdown', () => {
      const checked = publicToggle.text.includes('☑');
      publicToggle.setText(
        checked ? '☐ Make my replays public' : '☑ Make my replays public'
      );
    });
  }
  
  async saveConsent(consent: { allowRecording: boolean; makePublic: boolean }) {
    await Storage.set({
      key: 'dataConsent',
      value: JSON.stringify(consent)
    });
  }
}
```

**Privacy Policy:**
Create `privacy-policy.md` and host at `/privacy`:

```markdown
# Privacy Policy

## Data Collection
We collect gameplay data (inputs, game states) to train AI opponents.

## What We Collect
- Game inputs and outcomes
- Anonymous user ID (no personal information)
- Device performance metrics

## What We Don't Collect
- Names, emails, or contact information
- Location data
- Payment information

## Your Rights
- View your data
- Delete your data
- Opt-out of collection

## Contact
privacy@fiverings.game
```

**Deliverables:**
- [ ] Consent screen shown on first launch
- [ ] User preferences saved
- [ ] Privacy policy accessible in-app
- [ ] Opt-out respected (no recording)

---

#### D.2: Database Schema

**File:** `server/db/schema.sql`

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id VARCHAR(64) UNIQUE NOT NULL,
  elo_rating INT DEFAULT 1000,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW()
);

-- Replays table
CREATE TABLE replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID REFERENCES users(id) ON DELETE CASCADE,
  player2_id UUID REFERENCES users(id) ON DELETE CASCADE,
  winner INT CHECK (winner IN (1, 2, NULL)),
  
  -- Metadata
  game_version VARCHAR(20) NOT NULL,
  duration_frames INT NOT NULL,
  average_ping INT NOT NULL,
  region VARCHAR(10) NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW(),
  
  -- Training metadata
  skill_level VARCHAR(20) NOT NULL,
  quality_score FLOAT CHECK (quality_score >= 0 AND quality_score <= 1),
  tags TEXT[],
  
  -- Replay data (compressed JSON)
  replay_data JSONB NOT NULL,
  
  -- Privacy
  is_public BOOLEAN DEFAULT false,
  is_validated BOOLEAN DEFAULT false,
  validation_errors TEXT[]
);

-- Indexes
CREATE INDEX idx_replays_quality ON replays(quality_score DESC);
CREATE INDEX idx_replays_skill ON replays(skill_level);
CREATE INDEX idx_replays_validated ON replays(is_validated) WHERE is_validated = true;
CREATE INDEX idx_replays_public ON replays(is_public) WHERE is_public = true;
CREATE INDEX idx_replays_recorded_at ON replays(recorded_at DESC);

-- Match history
CREATE TABLE match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES users(id) ON DELETE CASCADE,
  replay_id UUID REFERENCES replays(id) ON DELETE SET NULL,
  won BOOLEAN NOT NULL,
  elo_before INT NOT NULL,
  elo_after INT NOT NULL,
  played_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_match_history_user ON match_history(user_id, played_at DESC);
```

**Deliverables:**
- [ ] Database schema created
- [ ] Indexes optimize queries
- [ ] Foreign keys enforce integrity
- [ ] Privacy constraints enforced

---

#### D.3: App Store Deployment

**iOS (Apple App Store):**

1. **Requirements:**
   - Apple Developer Account ($99/year)
   - Xcode 15+ on macOS
   - App icons (all required sizes)
   - Screenshots (6.5" and 5.5" devices)
   - Privacy policy URL

2. **Steps:**
   ```bash
   # Build iOS app
   npm run build
   npx cap sync ios
   npx cap open ios
   
   # In Xcode:
   # - Set signing team
   # - Set version/build number
   # - Archive for distribution
   # - Upload to App Store Connect
   ```

3. **App Store Connect:**
   - Fill app information
   - Add screenshots
   - Set age rating (Teen - cartoon violence)
   - Add privacy policy link
   - Submit for review

**Android (Google Play):**

1. **Requirements:**
   - Google Play Developer Account ($25 one-time)
   - Android Studio
   - App bundle (AAB)
   - Screenshots
   - Content rating

2. **Steps:**
   ```bash
   # Build Android app
   npm run build
   npx cap sync android
   npx cap open android
   
   # In Android Studio:
   # - Generate signed bundle
   # - Build → Generate Signed Bundle / APK
   # - Choose release variant
   ```

3. **Google Play Console:**
   - Create app
   - Upload AAB
   - Add store listing
   - Complete content rating questionnaire
   - Set up pricing & distribution
   - Submit for review

**Deliverables:**
- [ ] iOS app submitted to App Store
- [ ] Android app submitted to Play Store
- [ ] Beta testing via TestFlight / Internal Testing
- [ ] App store metadata complete (description, screenshots)

---

## Testing Strategy

### Unit Tests
```typescript
// Test replay recording
describe('ReplayRecorder', () => {
  test('records frames correctly');
  test('computes quality score');
  test('compresses replay data');
});

// Test matchmaking
describe('MatchmakingQueue', () => {
  test('matches players by Elo');
  test('expands range over time');
  test('respects region locking');
});
```

### Integration Tests
```typescript
// Test full match flow
describe('Multiplayer Match', () => {
  test('players connect and find match');
  test('inputs synchronize correctly');
  test('match ends and replay saves');
  test('Elo updates correctly');
});
```

### Manual Testing Checklist
- [ ] Touch controls responsive
- [ ] Matchmaking finds opponents
- [ ] Gameplay feels smooth
- [ ] Disconnection handled gracefully
- [ ] Replays save and upload
- [ ] Privacy consent works
- [ ] App runs on target devices

---

## Performance & Scalability

### Server Capacity
**Single $12/month DigitalOcean Droplet:**
- 1 vCPU, 1GB RAM
- Supports ~50-100 concurrent matches
- ~1000 active users

**Scaling Strategy:**
1. **Horizontal scaling:** Add more droplets behind load balancer
2. **Database read replicas:** For replay queries
3. **CDN:** Serve static assets (textures, sounds)
4. **Redis caching:** Reduce database load

### Cost Estimates
| Users | Monthly Cost |
|-------|--------------|
| 100 | $25 (1 server + DB) |
| 1,000 | $50 (2 servers + DB) |
| 10,000 | $200 (5 servers + DB + Redis) |
| 100,000 | $2,000+ (managed services) |

---

## Success Metrics

### Launch Targets (First Month)
- [ ] 100+ installs
- [ ] 1000+ matches played
- [ ] 500+ replays recorded (quality > 0.7)
- [ ] <5% crash rate
- [ ] 4.0+ star rating in app stores
- [ ] <30s average matchmaking time
- [ ] <100ms average gameplay latency

### Long-Term Goals (6 Months)
- [ ] 10,000+ active users
- [ ] 50,000+ replays for training
- [ ] 40% Day 7 retention
- [ ] Self-sustaining multiplayer community

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **App store rejection** | Follow guidelines strictly, get ESRB rating, avoid chat |
| **High server costs** | Start with serverless, implement rate limiting, optimize database queries |
| **Network lag** | Region locking, show ping indicator, implement reconnection |
| **Cheating** | Server-side validation, replay integrity checks, ban system |
| **Privacy violations** | Clear consent, GDPR compliance, anonymize data |
| **Low player base** | Keep offline AI mode, generous matchmaking, bots fill gaps |

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1-2 | Mobile Foundation | Capacitor, touch controls, optimization |
| 2-3 | Backend Server | WebSocket, matchmaking, game rooms |
| 3-4 | Gameplay Recording | Replay format, compression, validation |
| 4 | Privacy & Deploy | Consent, database, app store submission |

**Total:** 4 weeks (~100 hours development)

---

## Next Steps

1. **Complete Phase 5 & 6** of main game (special moves, polish)
2. **Set up development infrastructure:**
   - Provision server (DigitalOcean or AWS)
   - Set up PostgreSQL database (Supabase)
   - Create Git repository for server code
3. **Begin Phase A:** Capacitor setup and touch controls
4. **Parallel track:** ML training system (see ML-TRAINING-SYSTEM-PLAN.md)

---

## Integration with ML Training

Once PvP is operational, human replays feed into the ML training pipeline:

```
PvP Matches
  ↓
Replay Storage (PostgreSQL)
  ↓
Quality Filtering (score > 0.7)
  ↓
Skill Segmentation
  ↓
Export to Training Pipeline
  ↓
ImitationTrainer (supervised learning)
  ↓
PPO Refinement (RL self-play)
  ↓
Deploy Improved Bots
```

**See:** [ML-TRAINING-SYSTEM-PLAN.md](ML-TRAINING-SYSTEM-PLAN.md) for training pipeline details.

---

## Conclusion

This plan delivers a production-ready mobile PvP fighting game that captures high-quality human gameplay data for AI training. The modular architecture allows incremental development and easy scaling as the player base grows.

**Key Insight:** Start simple with lockstep netcode, optimize later if needed. Getting replays flowing is more valuable than perfect latency in the MVP.

Ready to begin implementation on your approval.
