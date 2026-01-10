# Copilot Instructions

This is a javascript game that uses the the latest version 3.88.2 of the Phaser game engine.

## Project Status
- **Phase 1-2 Complete**: All 5 advanced scripted bots implemented (Tutorial, Guardian, Aggressor, Tactician, Wildcard) - 116 tests passing
- **Phase 3 Complete**: Bot training integration finished - progressive curriculum enabled by default, all legacy options removed
- **Next**: Phase 4 - UI integration for bot selection and exhibition modes

## Training System
- The training system uses **progressive bot curriculum** by default (Tutorial→Guardian→Aggressor→Tactician→Wildcard)
- Just run `npm run train` - no configuration needed
- **NO LEGACY OPTIONS** - removed all legacy curriculum code
- Episode frame limit (1200 frames) prevents stalling
- Reward weights optimized for engagement (attack rewards 2x, stalling penalty 50x)

## AI Guidelines
- If I tell you that you are wrong, think about whether or not you think that's true and respond with facts.
- Avoid apologizing or making conciliatory statements.
- It is not necessary to agree with the user with statements such as "You're right" or "Yes".
- Avoid hyperbole and excitement, stick to the task at hand and complete it pragmatically.