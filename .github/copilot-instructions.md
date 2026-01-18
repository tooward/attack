# Copilot Instructions

This is a javascript game that uses the the latest version 3.88.2 of the Phaser game engine.

## Project Status
- **Phase 1-2 Complete**: All 5 advanced scripted bots implemented (Tutorial, Guardian, Aggressor, Tactician, Wildcard) - 116 tests passing
- **Phase 3 Complete**: Bot training integration finished - progressive curriculum enabled by default, all legacy options removed
- **Phase 4 Complete**: UI integration for bot selection and exhibition modes with keyboard/mouse controls, post-match options, and visual polish
- **Next**: Phase 5 - Character system expansion or App Store deployment

## Training System
- The training system uses **progressive bot curriculum** by default (Tutorial→Guardian→Aggressor→Tactician→Wildcard)
- Just run `npm run train` - no configuration needed
- **NO LEGACY OPTIONS** - removed all legacy curriculum code
- Episode frame limit (1200 frames) prevents stalling
- Reward weights optimized for engagement (attack rewards 2x, stalling penalty 50x)

## Exhibition/Practice Mode
- Accessible via "Practice Mode" button on main menu
- 5 bot personalities with 10 difficulty levels each
- **In-match pause menu (ESC)** for training tools:
  - Change characters without leaving match
  - Reset match positions and health
  - View move list
  - Change opponent or return to main menu
- Full keyboard navigation support (arrow keys, enter, escape, +/-)
- Move list display (F2 quick toggle)
- Post-match options include Replay, Change Opponent, and Main Menu
- Visual feedback with card animations and color coding

## AI Guidelines
- If I tell you that you are wrong, think about whether or not you think that's true and respond with facts.
- Avoid apologizing or making conciliatory statements.
- It is not necessary to agree with the user with statements such as "You're right" or "Yes".
- Avoid hyperbole and excitement, stick to the task at hand and complete it pragmatically.
- When I show you a failure first try to recreate the issue with a unit test. Then respond with a proposed fix and after we agree, fix the issue.