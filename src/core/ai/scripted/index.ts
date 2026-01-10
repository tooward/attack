/**
 * Barrel exports for scripted AI bots
 */

// Base classes
export { AdvancedScriptedBot } from './AdvancedScriptedBot';
export type { BotConfig, TacticalSituation } from './AdvancedScriptedBot';

// Bot implementations
export { GuardianBot } from './bots/GuardianBot';
export { AggressorBot } from './bots/AggressorBot';
export { TacticianBot } from './bots/TacticianBot';
export { WildcardBot } from './bots/WildcardBot';
export { TutorialBot } from './bots/TutorialBot';

// Tactics modules
export { DefensiveTactics } from './tactics/DefensiveTactics';
export { OffensiveTactics } from './tactics/OffensiveTactics';
export { SpacingTactics } from './tactics/SpacingTactics';

// Systems
export { StateReader } from './utils/StateReader';
export { FrameDataAnalyzer } from './systems/FrameDataAnalyzer';
export { DifficultyModulator } from './systems/DifficultyModulator';
export { PatternRecognition } from './systems/PatternRecognition';
export type { BehaviorStats, PatternAnalysis } from './systems/PatternRecognition';
