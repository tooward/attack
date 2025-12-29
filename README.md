# Five Rings: Fighting Game

A **Street Fighter-style 1v1 fighting game** built with TypeScript, Phaser 3, and TensorFlow.js. Features a pure TypeScript game engine with AI bot training capabilities.

## 🎮 Quick Start

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Testing
```bash
npm test
```

---

## 🕹️ How to Play

### Basic Controls

**Movement:**
- **Arrow Keys** - Move left/right, jump (up), crouch (down)
- **←/→** - Walk backward/forward
- **↑** - Jump (tap for neutral jump, hold direction for forward/backward jump)
- **↓** - Crouch

**Attacks:**
- **Z** - Light Punch
- **X** - Heavy Punch
- **C** - Light Kick
- **V** - Heavy Kick
- **Space** - Block (hold to block attacks)

**Special Moves:**
Perform motion inputs followed by attack buttons:
- **236P** (Quarter Circle Forward + Punch) - Hadoken (Fireball)
- **623P** (Dragon Punch Motion + Punch) - Shoryuken (Anti-air uppercut)
- **236236P** (Double Quarter Circle + Punch) - Super Combo (requires 3 bars)

**Motion Input Guide:**
```
Numpad notation (character facing right):
7 8 9    ↖ ↑ ↗
4 5 6    ← • →
1 2 3    ↙ ↓ ↘

236 = ↓↘→ (Quarter Circle Forward)
623 = →↓↘ (Dragon Punch)
```

### Game Modes

**Versus Mode:**
- Fight against AI opponents with multiple difficulty levels
- Best of 3 rounds (first to 2 wins)
- 99 second round timer

**Training Mode:**
- Practice combos and techniques against customizable dummy
- Access via F3 key during matches
- See Training Mode section below for full details

---

## 🥋 Training Mode

Press **F3** during gameplay to cycle through training modes. Training mode helps you practice specific scenarios and improve your skills.

### Training Mode Controls

| Key | Function | Description |
|-----|----------|-------------|
| **F1** | Toggle Hitboxes | Show/hide attack hitboxes and hurtboxes (red/blue boxes) |
| **F2** | Cycle AI Type | Switch between AI personalities: Aggressive → Defensive → Neural → Random |
| **F3** | Cycle Training Mode | Change dummy behavior: Idle → Crouch → Jump → Block → CPU → Record → Playback |
| **F4** | Reset Positions | Return both fighters to starting positions |
| **F5** | Infinite Meter | Toggle unlimited super meter and energy |
| **F6** | Reset Health | Restore both fighters to full health |

### Training Dummy Modes

**1. Idle** - Dummy stands still
- Practice basic combos on a stationary target
- Test optimal combo routes
- Learn move timing and spacing

**2. Crouch** - Dummy crouches constantly
- Practice overhead attacks
- Test high/low mixups
- Learn anti-crouch strategies

**3. Jump** - Dummy jumps repeatedly
- Practice anti-air timing (Shoryuken)
- Test air-to-air exchanges
- Learn jump-in punishes

**4. Block** - Dummy blocks all attacks
- Test frame advantage on block
- Practice block strings and frame traps
- Learn chip damage setups

**5. CPU** - Normal AI behavior
- Practice against realistic opponent
- Test strategies in combat scenarios
- Warm up before matches

**6. Record** - Capture AI input sequence
- AI performs actions while being recorded
- Recording continues until you switch modes
- Useful for recreating specific opponent patterns

**7. Playback** - Replay recorded sequence
- Dummy loops the recorded input sequence
- Practice defense against specific patterns
- Test punish opportunities repeatedly

### Recording Workflow Example

1. Press **F3** until you reach **Record** mode
2. Let the AI (in CPU mode) perform the pattern you want to practice against
3. Press **F3** again to switch to **Playback** mode
4. The dummy will now repeat that exact sequence
5. Practice your defense, counter-attacks, or punishes

**Example Use Cases:**
- Record a jump-in combo to practice anti-airs
- Record a pressure string to learn when to counter-poke
- Record a mixup sequence to practice blocking
- Record a fireball pattern to practice approaches

### Input Display

On-screen input notation shows your inputs in real-time:
- **Player 1 (Cyan)** - Bottom left
- **Player 2 (Magenta)** - Bottom right

**Notation Examples:**
- `236P` - Quarter circle forward + punch (Hadoken)
- `623K` - Dragon punch motion + kick (Shoryuken)
- `2P` - Down + punch (crouching light punch)
- `6HP` - Forward + heavy punch

### Training Tips

**For Beginners:**
1. Start in **Idle** mode to learn basic combos
2. Use **F6** to reset health between attempts
3. Turn on hitboxes (**F1**) to understand attack ranges
4. Practice one combo at a time

**For Intermediate:**
1. Use **Block** mode to learn safe pressure strings
2. Practice anti-airs in **Jump** mode
3. Record common opponent patterns and practice counters
4. Use **F4** to reset positions for consistent spacing

**For Advanced:**
1. Record complex mixup sequences for defense practice
2. Use **CPU** mode with different AI types (**F2**) for varied practice
3. Practice optimal punishes with **F4** position resets
4. Test frame traps and block strings in **Block** mode

---

## 🤖 AI System

The game features multiple AI types with different playstyles:

### AI Types (Cycle with F2)

**1. Personality Bot (Aggressive)**
- Default AI opponent
- 75% aggression rating
- Favors offensive pressure
- Good for learning defense

**2. Defensive Bot (Zoner)**
- Defensive playstyle
- Emphasis on spacing and counter-attacks
- Uses projectiles effectively
- Good for learning approach options

**3. Scripted Bot (Tight)**
- Deterministic pressure bot used as a baseline
- Aggressively closes distance and applies simple strings
- Useful for testing fundamentals against consistent pressure

**4. Neural Bot**
- Trained via TensorFlow.js
- Learns from replay data
- Adaptive strategy
- Most realistic opponent (when trained)

**5. Random Bot**
- Unpredictable actions
- Tests reaction time
- Good for warm-up
- Helps learn to adapt on the fly

### Training Your Own AI

The game includes imitation learning capabilities. You can train AI bots to mimic playstyles:

```bash
# Record gameplay (future feature)
# Train neural network from replays
# See FIGHTING-GAME-MVP-PLAN.md for full training details
```

---

## 📊 Game Mechanics

### Health & Damage
- **100 HP** per fighter
- Damage scaling in combos (each hit does less damage)
- Chip damage on blocked attacks
- Health regenerates between rounds

### Meter System
- **Super Meter** - Builds on hit/block, used for super combos
- **Energy** - Used for special moves (regenerates over time)
- Gain more meter when taking damage

### Combo System
- Cancel normal attacks into special moves
- Cancel special moves into super combos
- Combo counter displays hit count
- Damage scaling reduces damage in longer combos

### Frame Data
Fighting games run at 60 frames per second. Understanding frame data helps you know which moves are safe:
- **Startup** - Frames before hitbox becomes active
- **Active** - Frames where hitbox can hit
- **Recovery** - Frames after attack before you can act
- **Frame Advantage** - How much advantage/disadvantage on hit or block

**Example:**
- Light Punch: 4 startup, 3 active, 6 recovery (13 total frames)
- Heavy Punch: 8 startup, 4 active, 14 recovery (26 total frames)

---

## 🎯 Strategy Guide

### Basic Strategies

**Offense:**
- Use light attacks to confirm into combos
- Mix up high and low attacks
- Use throws to beat blocking
- Cancel normal attacks into special moves for combos

**Defense:**
- Block standing to defend against high attacks
- Block crouching to defend against low attacks
- Use Shoryuken (623P) as invincible anti-air
- Backdash to create space

**Neutral Game:**
- Control space with pokes (light kick, heavy kick)
- Use fireballs to force opponent to approach
- Anti-air jump-ins with Shoryuken
- Walk forward to apply pressure

### Character Guide: Musashi

**Strengths:**
- Well-rounded character
- Strong anti-air options
- Good fireball for zoning
- Solid combo potential

**Key Moves:**
- **Light Punch** - Fast 4-frame startup, good for combos
- **Heavy Kick** - Long range poke, good in neutral
- **Hadoken (236P)** - Fireball, controls space
- **Shoryuken (623P)** - Invincible anti-air, high damage
- **Super Combo (236236P)** - High damage super, requires 3 bars

**Basic Combos:**
- Light Punch → Light Punch → Hadoken
- Jump Heavy Kick → Crouching Light Punch → Shoryuken
- Heavy Punch (counterhit) → Super Combo

---

## 🛠️ Development

### Project Structure
```
src/
├── core/              # Pure TypeScript game engine
├── phaser/            # Phaser rendering layer  
├── entities/          # Game entities (Player, Bot, etc.)
├── scenes/            # Phaser scenes
├── training/          # AI training infrastructure
└── utils/             # Utility functions
```

### Architecture
- **Pure TypeScript Core** - Deterministic game logic, no Phaser dependencies
- **Phaser Rendering Layer** - Visual representation only
- **AI Training** - TensorFlow.js for neural network training
- **Frame-Perfect Simulation** - 60 FPS, deterministic for replays

### Testing
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

### AI Training (Headless)
```bash
npm run train          # Run PPO training (headless)
npm run progress       # Live-tail eval progress JSONL
```

Curriculum (recommended for bootstrapping learning):
```bash
TRAIN_CURRICULUM=1 \
TRAIN_CURRICULUM_DAMAGE_THRESHOLD=20 \
TRAIN_CURRICULUM_REQUIRED_EVALS=2 \
npm run train
```

Notes:
- Training writes eval checkpoints to `./models/training-progress.jsonl` (override with `TRAIN_PROGRESS_PATH`).
- Curriculum starts against an easy scripted opponent and switches to a tighter scripted opponent once eval `avgDamageDealt` crosses the threshold for N consecutive evals.

All game logic is fully unit tested (185+ tests).

---

## 📚 Additional Resources

- **FIGHTING-GAME-MVP-PLAN.md** - Complete development roadmap
- **Phase Documentation** - See design/ folder for detailed phase plans
- **Character Data** - src/core/data/musashi.ts for move definitions

---

## 🎮 Tips for New Players

1. **Start with Training Mode** - Learn basic combos in Idle mode
2. **Master Anti-Airs** - Practice Shoryuken timing in Jump mode
3. **Learn One Combo** - Focus on: Light Punch → Light Punch → Hadoken
4. **Block More** - New players often press too many buttons
5. **Use the Input Display** - Watch your inputs to verify motion inputs
6. **Practice Movement** - Walk forward/backward, jump spacing
7. **Don't Mash** - Deliberate button presses are more effective
8. **Watch Replays** - Learn from your losses (future feature)

---

## 🏆 Game Feel Features

The game includes professional fighting game polish:
- **Hit Freeze** - Frame pause on impact (2-10 frames based on damage)
- **Screen Shake** - Camera shake on heavy hits
- **Hit Sparks** - Particle effects on successful hits
- **Character Flash** - Visual feedback when taking damage
- **Sound Design** - Hit sounds, whoosh effects, announcer calls
- **Input Buffer** - 15-frame buffer for special move inputs

---

## 📝 License

This project is part of the Five Rings game development initiative.

---

## 🤝 Contributing

This is a personal project demonstrating fighting game engine architecture and AI training integration.

For questions or suggestions, please refer to the development documentation in the design/ folder.

# Procedural Generation Logic

## Phaser Definitions

Tiles: In Phaser, a tile represents a single graphic element that makes up your game world. This could be a piece of ground, a wall, a rock, or any other visual element. Think of tiles as individual LEGO bricks that you can use to build larger structures.
In Tiled, these are equivalent to the individual images in your tileset. You select an image from your tileset and place it on the map grid.

Tilesets: A tileset is a collection of related tiles that share common characteristics. For example, you might have a tileset for ground textures, another for wall textures, and so on. In Phaser, a tileset is represented by a Phaser.Tilemaps.Tileset object.
In Tiled, this is equivalent to creating a new tileset in the editor, where you add multiple images that can be used together to create your map.

Tilemap: A tilemap represents the arrangement of tiles within your game world. It's essentially a 2D grid of tiles, where each cell contains a specific tile from your tileset. In Phaser, a tilemap is represented by a Phaser.Tilemaps.Tilemap object.
In Tiled, this is equivalent to creating a new map in the editor, where you arrange tiles from your tilesets onto a grid to create your game world.

Layers: Layers are used to organize and separate different types of tiles within your tilemap. For example, you might have one layer for ground tiles, another for wall tiles, and so on. In Phaser, layers are represented by Phaser.Tilemaps.Layer objects.
In Tiled, this is equivalent to creating multiple layers in your map, where each layer can contain different types of tiles. You can then control the visibility, opacity, and other properties of each layer independently.

Map: The overall environment that your character moves through is indeed referred to as a "map" in Phaser. A map typically consists of one or more tilemaps, which are arranged together to create the game world.

## Implementing the logic

To build up from individual tiles to maps, you would follow these steps:
 Create a tileset by loading your tile images into Phaser.
 Create a tilemap by defining the arrangement of tiles within your game world.
 Add layers to your tilemap to organize and separate different types of tiles.
 Arrange tiles within each layer to create the desired layout for your map.
 Combine multiple tilemaps (if needed) to create the overall environment that your character moves through.

 Here's a high-level overview of how I would architect the procedural generation of ground in the map:
 BiomeDefinition: This class represents a biome definition, which includes properties such as:

 Name
 Description
 Tileset metadata (e.g., tile size, spacing)
 Tile distribution rules (e.g., frequency, probability)
 TilesetManager: This class is responsible for loading and managing the tileset image and its corresponding metadata JSON file. It provides methods to:
 Load the tileset image
 Parse the tileset metadata from the JSON file
 Get a specific tile by its ID or name
 GroundGenerator: This class generates the ground tiles based on the biome definition and tileset data. It uses algorithms such as:
 Perlin noise
 Voronoi diagrams
 Random number generation to create a natural-looking terrain. The class has methods to:
 Initialize the generator with a biome definition and tileset manager
 Generate a 2D array of tile IDs or names representing the ground tiles
 MapGenerator: This class generates the entire map, including the ground, by combining multiple biomes and using the GroundGenerator to create the terrain for each biome.
 BiomeManager: This class manages a collection of biome definitions and provides methods to:
 Get a biome definition by its name or ID
 Create a new biome definition