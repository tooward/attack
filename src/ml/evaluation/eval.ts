/**
 * Headless evaluation runner (CLI)
 */

import { ActorCriticPolicy } from '../training/PPOTrainer';
import { OpponentPool, DEFAULT_POOL_CONFIG } from '../training/OpponentPool';
import { evaluatePolicy } from './evalRunner';

function parseEnvInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function parseEnvBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  return raw === '1' || raw.toLowerCase() === 'true' || raw.toLowerCase() === 'yes';
}

function parseEnvString(key: string, fallback: string): string {
  const raw = process.env[key];
  if (!raw) return fallback;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function printTopActions(label: string, counts: Record<string, number>, frames: number, topK: number) {
  const entries = Object.entries(counts);
  entries.sort((a, b) => b[1] - a[1]);

  console.log(`\n--- Action Histogram: ${label} (top ${topK}) ---`);
  const denom = Math.max(1, frames);
  for (const [key, count] of entries.slice(0, topK)) {
    const pct = (100 * count) / denom;
    console.log(`${key.padEnd(16)} ${String(count).padStart(8)}  (${pct.toFixed(1)}%)`);
  }
}

function printTopButtons(label: string, counts: Record<string, number>, frames: number, topK: number) {
  const entries = Object.entries(counts);
  entries.sort((a, b) => b[1] - a[1]);

  console.log(`\n--- Button Histogram: ${label} (top ${topK}) ---`);
  const denom = Math.max(1, frames);
  for (const [key, count] of entries.slice(0, topK)) {
    const pct = (100 * count) / denom;
    console.log(`${key.padEnd(16)} ${String(count).padStart(8)}  (${pct.toFixed(1)}%)`);
  }
}

function printSummary(label: string, summary: { episodes: number; wins: number; losses: number; draws: number; winRate: number; avgFrames: number; avgDamageDealt: number; avgDamageTaken: number; }) {
  console.log(`\n=== ${label} ===`);
  console.log(
    `Episodes: ${summary.episodes} | Wins: ${summary.wins} | Losses: ${summary.losses} | ` +
    `Draws: ${summary.draws} | WinRate: ${(summary.winRate * 100).toFixed(1)}%`
  );
  console.log(
    `Avg frames: ${summary.avgFrames.toFixed(0)} | Avg dmg dealt: ${summary.avgDamageDealt.toFixed(1)} | ` +
    `Avg dmg taken: ${summary.avgDamageTaken.toFixed(1)}`
  );
}

async function main() {
  const episodesVsScripted = parseEnvInt('EVAL_EPISODES_SCRIPTED', 30);
  const episodesVsSnapshots = parseEnvInt('EVAL_EPISODES_SNAPSHOTS', 30);
  const episodesScriptedVsPolicy = parseEnvInt('EVAL_EPISODES_SCRIPTED_VS_POLICY', 30);
  const episodesScriptedVsSnapshots = parseEnvInt('EVAL_EPISODES_SCRIPTED_VS_SNAPSHOTS', 30);
  const maxFrames = parseEnvInt('EVAL_MAX_FRAMES', 60 * 60); // 60 seconds @ 60fps
  const greedy = parseEnvBool('EVAL_GREEDY', true);
  const debugHist = parseEnvBool('EVAL_DEBUG_HIST', false);
  const debugHistTopK = parseEnvInt('EVAL_DEBUG_HIST_TOPK', 10);

  const modelPath = parseEnvString('EVAL_MODEL_PATH', './models/policy');
  const poolPath = parseEnvString('EVAL_POOL_PATH', DEFAULT_POOL_CONFIG.savePath);
  const policyStyle = parseEnvString('EVAL_STYLE', 'mixup');

  console.log('\n=== Eval Runner (Headless) ===');
  console.log(`Model: ${modelPath}`);
  console.log(`Pool:  ${poolPath}`);
  console.log(`Style: ${policyStyle} | Greedy: ${greedy ? 'yes' : 'no'}`);

  // Construct policy with a valid obs size; `load()` will swap the model.
  const policy = new ActorCriticPolicy(1, 10);
  await policy.load(modelPath);

  const pool = new OpponentPool({ ...DEFAULT_POOL_CONFIG, savePath: poolPath });
  await pool.loadAllSnapshots();

  const report = await evaluatePolicy({
    policy,
    opponentPool: pool,
    policyStyle,
    greedy,
    maxFrames,
    episodesVsScripted,
    episodesVsSnapshots,
    episodesScriptedVsPolicy,
    episodesScriptedVsSnapshots,
    debugActionHistogram: debugHist,
  });

  printSummary('Policy vs Scripted', report.policyVsScripted);

  if (report.scriptedVsPolicy) {
    printSummary('Scripted vs Policy (Reverse Test)', report.scriptedVsPolicy);
  }

  if (!report.policyVsSnapshots) {
    console.log('\n=== Policy vs Snapshots ===');
    console.log('No snapshots found; run training long enough to create snapshots (default frequency 100k steps).');
    return;
  }

  console.log(`\nLoaded snapshots: ${report.snapshotsLoaded}`);
  printSummary('Policy vs Snapshots', report.policyVsSnapshots);

  if (debugHist && report.debug?.policyVsSnapshots) {
    const h = report.debug.policyVsSnapshots;
    printTopActions('Policy vs Snapshots (P1 actions)', h.actionCountsP1, h.frames, debugHistTopK);
    printTopActions('Policy vs Snapshots (P2 actions)', h.actionCountsP2, h.frames, debugHistTopK);

    printTopButtons('Policy vs Snapshots (P1 buttons)', h.buttonCountsP1, h.frames, debugHistTopK);
    printTopButtons('Policy vs Snapshots (P2 buttons)', h.buttonCountsP2, h.frames, debugHistTopK);
  }

  if (report.scriptedVsSnapshots) {
    printSummary('Scripted vs Snapshots', report.scriptedVsSnapshots);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Eval failed:', err);
    process.exit(1);
  });
}

export { main };
