# Practice Mode Enhancement - Design Document

## Overview
Combine the best features of **Practice Mode** (BotSelectionScene) and **Character Test Lab** (CharacterTestScene) into a unified training experience. Practice Mode will serve as the master implementation with enhanced training tools.

## Current State Analysis

### Practice Mode (Current Features)
- Bot selection UI with 5 scripted bots
- Difficulty slider (1-10)
- Character selection for both players
- Post-match options (Replay, Change Opponent, Main Menu)
- ✅ **Move list display** (F2 key - toggleable overlay showing special moves)

### Character Test Lab (Features to Integrate)
- Quick character switching (1/2 keys cycle characters)
- Frame data display (F key toggle)
- Always-visible move list panel
- Debug info display
- Touch controls toggle

## Design Goals

### Simplification Principles
1. **Remove complex technical data** - No frame-by-frame analysis, frame advantage, or detailed debug info
2. **Keep essential training tools** - Move lists, character switching, basic controls
3. **Consistent UI across all modes** - Single player, practice mode, and multiplayer use the same menu system
4. **Centralized information display** - One area that swaps content based on user selection

## Enhanced Practice Mode Features

### 1. In-Match Pause Menu (ESC Key)
Replace current F-key scattered functions with a unified pause menu. Position: **Center screen, overlay darkens background**

**Menu Options:**
```
PRACTICE MENU

[ Resume ]              ESC or click to continue
[ Show Moves List ]     View special moves and inputs
[ Change Characters ]   Switch P1 or P2 character
[ Reset Match ]         Reset positions and health
[ Change Opponent ]     Return to bot selection
[ Main Menu ]           Exit to main menu
```

**Benefits:**
- Familiar pause menu pattern from single player mode
- All training functions in one place
- No need to memorize F-keys
- Keyboard navigation with arrow keys + enter

### 2. Moves List Display

**Access:** Pause menu → "Show Moves List" OR F2 key (quick toggle during match)

**Location:** Bottom third of screen (below ground line, Y: 505)

**Content:**
- Character name header
- Special move names with input notation
- Motion arrows (↓↘→, →↓↘, etc.)
- Brief special properties (e.g., "Anti-air", "Unblockable")
- **No frame data or technical details**

**Example:**
```
=== MUSASHI SPECIAL MOVES ===

FIREBALL              COUNTER
↓↘→ + C              ↓↙← + C
Projectile            Defensive

UPPERCUT (DP)         COMMAND GRAB
→↓↘ + C              →→ + C
Anti-air invincible   Unblockable throw
```

### 3. Character Switching (From Pause Menu)

**Flow:**
1. Pause match (ESC)
2. Select "Change Characters"
3. Show character select overlay (inline, no scene change)
4. Select P1 character (arrows + enter)
5. Select P2 character (arrows + enter) 
6. Match resets with new characters

**Visual:** Compact version of CharacterSelectScene within pause overlay

### 4. Information Display Area

**Location:** Bottom of screen (Y: 505-590) - consistent across all modes

**What Shows Here:**
- Default: Control hints ("F2: Moves | ESC: Menu")
- When moves toggled: Move list overlay
- When paused: Pause menu
- During match end: Match results and options

**Styling:**
- Background: Semi-transparent black (#000000aa)
- Text: Gray (#888888)
- Font size: 10-11px
- Consistent padding/spacing

### 5. Training Tools (Accessible via Pause Menu)

**Reset Match:**
- Resets positions to starting points
- Resets health to 100%
- Clears combo counters
- No scene restart, instant reset

**Change Opponent:**
- Returns to BotSelectionScene
- Preserves P1 character selection
- Quick iteration for testing different bot styles

## UI Consistency Requirements

### Pause Menu Design (All Modes)
**Position:** Center screen (X: 500, Y: 300)
**Size:** 400px wide, auto height
**Background:** Dark overlay (#000000, 70% opacity)
**Font:** 
- Title: 32px, bold, yellow (#ffff00)
- Options: 20px, white (#ffffff)
- Hover: Bright yellow (#ffff00)

### Button/Option Layout
```typescript
// Standard menu option spacing
const optionSpacing = 60;
const startY = 100;

options.forEach((opt, i) => {
  const y = startY + (i * optionSpacing);
  // Create button at (centerX, y)
});
```

### Keyboard Navigation
- Arrow Up/Down: Select option
- Enter: Confirm
- ESC: Close menu / go back
- Consistent across CharacterSelectScene, BotSelectionScene, PauseMenu

## Implementation Priority

### Phase 1: Pause Menu System
1. Create unified pause menu in PhaserGameScene
2. Replace scattered F-keys with menu options
3. Implement ESC key handling
4. Test across single player and practice modes

### Phase 2: Character Switching
1. Build inline character selector overlay
2. Integrate with pause menu
3. Handle character swap without scene restart
4. Update move list when character changes

### Phase 3: Information Display Area
1. Consolidate all bottom-screen displays
2. Ensure consistent positioning (Y: 505)
3. Handle visibility states (default/moves/paused)
4. Test on mobile (touch-friendly)

### Phase 4: Cleanup
1. Remove CharacterTestScene from menu
2. Update menu button labels if needed
3. Remove F3-F9 training hotkeys
4. Keep F2 for quick move list toggle
5. Update user documentation

## Removed Features (Simplification)

### From Character Test Lab:
- ❌ Frame data display (too technical)
- ❌ Debug info overlay (position, velocity, frame numbers)
- ❌ Frame advantage indicators
- ❌ Hitstun/blockstun values
- ❌ F-key hotkey complexity (F3-F9)
- ❌ Always-on move list panel (use toggle instead)

### Rationale:
- Frame data is expert-level info that clutters the UI
- Most players don't need frame-by-frame analysis
- Pause menu provides cleaner access to all features
- Keep interface approachable for casual players

## Files to Modify

### Primary Changes
- `src/scenes/PhaserGameScene.ts` - Add pause menu system, consolidate training tools
- `src/scenes/BotSelectionScene.ts` - Minor tweaks for re-entry flow

### Scene Removal
- `src/scenes/CharacterTestScene.ts` - Deprecate after migration
- `src/scenes/MenuScene.ts` - Remove "Character Test Lab" button

### Configuration
- `src/config/gameConfig.ts` - Remove CharacterTestScene from scene list (after migration)

## Success Criteria

1. ✅ Single ESC-based pause menu works across all modes
2. ✅ Move list accessible via F2 or pause menu
3. ✅ Character switching works without leaving match
4. ✅ UI position/styling consistent across all modes
5. ✅ No F3-F9 hotkeys needed (except F2 for moves)
6. ✅ Mobile-friendly (pause menu touch-enabled)
7. ✅ Simpler, cleaner interface than Character Test Lab
8. ✅ Practice Mode remains master entry point

## Future Considerations

### Optional Enhancements (Post-Implementation)
- Training dummy modes (standing, blocking, jumping) - via pause menu
- Recording/playback system - if player demand exists
- Hitbox visualization toggle - developer-only feature
- Combo counter display - during active combos

### Not Included (Keep Simple)
- Frame data overlays
- Input history display
- Advanced training metrics
- Multiple simultaneous overlays
