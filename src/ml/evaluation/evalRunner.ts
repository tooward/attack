/**
 * Shared headless evaluation utilities.
 *
 * Used by both the standalone `npm run eval` script and the training loop for
 * periodic progress checks.
 */

import { FightingGameEnv, ActionBundle } from '../core/Environment';
import { ObservationEncoder, DEFAULT_OBSERVATION_CONFIG } from '../core/ObservationEncoder';
import { ActorCriticPolicy } from '../training/PPOTrainer';
import { OpponentPool, OpponentSnapshot } from '../training/OpponentPool';
import { MUSASHI } from '../../core/data/musashi';

export type EpisodeResult = {
  winner: 'player1' | 'player2' | 'draw';
  frames: number;
  damageDealtByP1: number;
  damageDealtByP2: number;
};

export type EvalSummary = {
  episodes: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgFrames: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
};

export type EvalReport = {
  policyVsScripted: EvalSummary;
  policyVsSnapshots?: EvalSummary;
  scriptedVsPolicy?: EvalSummary;
  scriptedVsSnapshots?: EvalSummary;
  debug?: {
    policyVsSnapshots?: {
      actionCountsP1: Record<string, number>;
      actionCountsP2: Record<string, number>;
      buttonCountsP1: Record<string, number>;
      buttonCountsP2: Record<string, number>;
      frames: number;
    };
  };
  snapshotsLoaded: number;
};

type ActionHistogramAccumulator = {
  actionCountsP1: Map<string, number>;
  actionCountsP2: Map<string, number>;
  buttonCountsP1: Map<string, number>;
  buttonCountsP2: Map<string, number>;
  frames: number;
};

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function bundleKey(bundle: ActionBundle): string {
  return `${bundle.direction}:${bundle.button}`;
}

function buttonKey(bundle: ActionBundle): string {
  return bundle.button;
}

function mapToRecord(map: Map<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of map.entries()) out[k] = v;
  return out;
}

function actionToBundle(action: number): ActionBundle {
  const actions: ActionBundle[] = [
    { direction: 'neutral', button: 'none', holdDuration: 0 },
    { direction: 'right', button: 'none', holdDuration: 0 },
    { direction: 'left', button: 'none', holdDuration: 0 },
    { direction: 'up', button: 'none', holdDuration: 0 },
    { direction: 'down', button: 'none', holdDuration: 0 },
    { direction: 'neutral', button: 'lp', holdDuration: 0 },
    { direction: 'neutral', button: 'hp', holdDuration: 0 },
    { direction: 'neutral', button: 'lk', holdDuration: 0 },
    { direction: 'neutral', button: 'hk', holdDuration: 0 },
    { direction: 'neutral', button: 'block', holdDuration: 0 },
  ];

  return actions[action % actions.length];
}

function uncanonicalizeBundleForEntity(state: any, entityId: string, bundle: ActionBundle): ActionBundle {
  const entity = state.entities?.find((e: any) => e.id === entityId);
  const facing = entity?.facing ?? 1;
  if (facing !== -1) return bundle;
  if (bundle.direction === 'left') return { ...bundle, direction: 'right', holdDuration: 0 };
  if (bundle.direction === 'right') return { ...bundle, direction: 'left', holdDuration: 0 };
  return { ...bundle, holdDuration: 0 };
}

function pickEntityId(state: any, candidates: string[]): string {
  const found = state.entities?.find((e: any) => candidates.includes(e.id));
  return found?.id ?? candidates[0];
}

function getStepDamage(damageMap: Map<string, number>, entityId: string): number {
  return damageMap.get(entityId) ?? 0;
}

/**
 * "Tight" scripted opponent used for evaluation.
 * Aggressively closes distance and applies pressure strings.
 */
export function scriptedOpponentActionTight(state: any, actorId: string, targetId: string): ActionBundle {
  const actor = state.entities.find((e: any) => e.id === actorId);
  const target = state.entities.find((e: any) => e.id === targetId);
  if (!actor || !target) return { direction: 'neutral', button: 'none', holdDuration: 0 };

  const dx = target.position.x - actor.position.x;
  const distance = Math.abs(dx);
  const inAir = !(actor?.isGrounded ?? true);
  const toward: ActionBundle['direction'] = dx > 0 ? 'right' : 'left';

  if (distance > 140) {
    if (!inAir && state.frame % 120 === 0) {
      return { direction: 'up', button: 'lp', holdDuration: 0 };
    }
    return { direction: toward, button: 'none', holdDuration: 0 };
  }

  if (distance > 80) {
    const phase = state.frame % 20;
    if (phase < 6) {
      return { direction: toward, button: 'none', holdDuration: 0 };
    }
    if (phase < 10) {
      return { direction: 'neutral', button: 'lk', holdDuration: 0 };
    }
    if (!inAir && phase === 10) {
      return { direction: 'up', button: 'lp', holdDuration: 0 };
    }
    return { direction: toward, button: 'none', holdDuration: 0 };
  }

  const closePhase = state.frame % 16;
  if (closePhase < 4) return { direction: 'neutral', button: 'lp', holdDuration: 0 };
  if (closePhase < 7) return { direction: 'neutral', button: 'lk', holdDuration: 0 };
  if (closePhase < 10) return { direction: toward, button: 'hp', holdDuration: 0 };
  if (closePhase < 12) return { direction: 'neutral', button: 'hk', holdDuration: 0 };
  return { direction: toward, button: 'none', holdDuration: 0 };
}

/**
 * "Easy" scripted opponent used for curriculum bootstrapping.
 * Mostly approaches, blocks a bit, and rarely attacks.
 */
export function scriptedOpponentActionEasy(state: any, actorId: string, targetId: string): ActionBundle {
  const actor = state.entities.find((e: any) => e.id === actorId);
  const target = state.entities.find((e: any) => e.id === targetId);
  if (!actor || !target) return { direction: 'neutral', button: 'none', holdDuration: 0 };

  const dx = target.position.x - actor.position.x;
  const distance = Math.abs(dx);
  const toward: ActionBundle['direction'] = dx > 0 ? 'right' : 'left';

  // Far: walk in slowly.
  if (distance > 170) {
    return { direction: toward, button: 'none', holdDuration: 0 };
  }

  // Mid: occasionally walk in, otherwise idle.
  if (distance > 90) {
    if (state.frame % 10 < 4) {
      return { direction: toward, button: 'none', holdDuration: 0 };
    }
    return { direction: 'neutral', button: 'none', holdDuration: 0 };
  }

  // Close: mostly idle/block, rare light attack.
  const phase = state.frame % 40;
  if (phase < 6) return { direction: 'neutral', button: 'block', holdDuration: 3 };
  if (phase === 10) return { direction: 'neutral', button: 'lp', holdDuration: 0 };
  return { direction: 'neutral', button: 'none', holdDuration: 0 };
}

async function runEpisode(params: {
  env: FightingGameEnv;
  obsEncoder: ObservationEncoder;
  policyP1: ActorCriticPolicy;
  policyStyle: string;
  opponent: 'scripted' | OpponentSnapshot;
  greedy: boolean;
  maxFrames: number;
  scriptedOpponentAction: (state: any, actorId: string, targetId: string) => ActionBundle;
  reverseRoles?: boolean;
  debugHistogram?: ActionHistogramAccumulator;
}): Promise<EpisodeResult> {
  const {
    env,
    obsEncoder,
    policyP1,
    policyStyle,
    opponent,
    greedy,
    maxFrames,
    scriptedOpponentAction,
    reverseRoles = false,
    debugHistogram,
  } = params;

  let state = env.reset();

  const p1Id = pickEntityId(state, ['player1', '1']);
  const p2Id = pickEntityId(state, ['player2', '2']);

  let frames = 0;
  let damageDealtByP1 = 0;
  let damageDealtByP2 = 0;

  while (!env.isDone() && frames < maxFrames) {
    let action1Bundle: ActionBundle;
    let action2Bundle: ActionBundle;

    if (reverseRoles) {
      // Policy plays as player2, scripted/snapshot as player1
      if (opponent === 'scripted') {
        action1Bundle = scriptedOpponentAction(state, p1Id, p2Id);
      } else {
        const opponentStyle = opponent.metadata?.style ?? policyStyle ?? 'mixup';
        const obs1 = obsEncoder.encodeCanonical(state, p1Id, opponentStyle);
        const action1 = greedy
          ? opponent.policy.selectBestAction(obs1)
          : opponent.policy.sampleAction(obs1).action;
        action1Bundle = uncanonicalizeBundleForEntity(state, p1Id, actionToBundle(action1));
      }

      const obs2 = obsEncoder.encodeCanonical(state, p2Id, policyStyle);
      const action2 = greedy ? policyP1.selectBestAction(obs2) : policyP1.sampleAction(obs2).action;
      action2Bundle = uncanonicalizeBundleForEntity(state, p2Id, actionToBundle(action2));
    } else {
      // Normal: policy as player1, opponent as player2
      const obs1 = obsEncoder.encodeCanonical(state, p1Id, policyStyle);
      const action1 = greedy ? policyP1.selectBestAction(obs1) : policyP1.sampleAction(obs1).action;
      action1Bundle = uncanonicalizeBundleForEntity(state, p1Id, actionToBundle(action1));

      if (opponent === 'scripted') {
        action2Bundle = scriptedOpponentAction(state, p2Id, p1Id);
      } else {
        const opponentStyle = opponent.metadata?.style ?? policyStyle ?? 'mixup';
        const obs2 = obsEncoder.encodeCanonical(state, p2Id, opponentStyle);
        const action2 = greedy
          ? opponent.policy.selectBestAction(obs2)
          : opponent.policy.sampleAction(obs2).action;
        action2Bundle = uncanonicalizeBundleForEntity(state, p2Id, actionToBundle(action2));
      }
    }

    const actions = new Map<string, ActionBundle>();
    actions.set(p1Id, action1Bundle);
    actions.set(p2Id, action2Bundle);

    if (debugHistogram) {
      inc(debugHistogram.actionCountsP1, bundleKey(action1Bundle));
      inc(debugHistogram.actionCountsP2, bundleKey(action2Bundle));
      inc(debugHistogram.buttonCountsP1, buttonKey(action1Bundle));
      inc(debugHistogram.buttonCountsP2, buttonKey(action2Bundle));
      debugHistogram.frames++;
    }

    const stepResult = env.step(actions);

    damageDealtByP1 += getStepDamage(stepResult.info.damageDealt, p1Id);
    damageDealtByP2 += getStepDamage(stepResult.info.damageDealt, p2Id);

    state = env.getState();
    frames++;
  }

  const finalState = env.getState();
  const winnerRaw = finalState.round?.winner ?? null;

  let winner: EpisodeResult['winner'] = 'draw';
  if (winnerRaw === p1Id) winner = 'player1';
  else if (winnerRaw === p2Id) winner = 'player2';
  else {
    const p1 = finalState.entities.find((e: any) => e.id === p1Id);
    const p2 = finalState.entities.find((e: any) => e.id === p2Id);
    const p1Hp = p1?.health ?? 0;
    const p2Hp = p2?.health ?? 0;
    if (p1Hp > p2Hp) winner = 'player1';
    else if (p2Hp > p1Hp) winner = 'player2';
  }

  return { winner, frames, damageDealtByP1, damageDealtByP2 };
}

function summarize(results: EpisodeResult[]): EvalSummary {
  const wins = results.filter(r => r.winner === 'player1').length;
  const losses = results.filter(r => r.winner === 'player2').length;
  const draws = results.filter(r => r.winner === 'draw').length;

  const total = results.length;
  const winRate = total > 0 ? wins / total : 0;

  const avgFrames = results.reduce((s, r) => s + r.frames, 0) / Math.max(total, 1);
  const avgDamageDealt = results.reduce((s, r) => s + r.damageDealtByP1, 0) / Math.max(total, 1);
  const avgDamageTaken = results.reduce((s, r) => s + r.damageDealtByP2, 0) / Math.max(total, 1);

  return {
    episodes: total,
    wins,
    losses,
    draws,
    winRate,
    avgFrames,
    avgDamageDealt,
    avgDamageTaken,
  };
}

export async function evaluatePolicy(params: {
  policy: ActorCriticPolicy;
  opponentPool?: OpponentPool;
  policyStyle?: string;
  greedy?: boolean;
  maxFrames?: number;
  episodesVsScripted?: number;
  episodesVsSnapshots?: number;
  episodesScriptedVsPolicy?: number;
  episodesScriptedVsSnapshots?: number;
  scriptedOpponentAction?: (state: any, actorId: string, targetId: string) => ActionBundle;
  debugActionHistogram?: boolean;
}): Promise<EvalReport> {
  const {
    policy,
    opponentPool,
    policyStyle = 'mixup',
    greedy = true,
    maxFrames = 60 * 60,
    episodesVsScripted = 30,
    episodesVsSnapshots = 30,
    episodesScriptedVsPolicy = 0,
    episodesScriptedVsSnapshots = 0,
    scriptedOpponentAction = scriptedOpponentActionTight,
    debugActionHistogram = false,
  } = params;

  const env = new FightingGameEnv({
    player1Character: MUSASHI,
    player2Character: MUSASHI,
    roundTime: 60,
  });

  const obsConfig = { ...DEFAULT_OBSERVATION_CONFIG, includeStyle: true };
  const obsEncoder = new ObservationEncoder(obsConfig);

  const scriptedResults: EpisodeResult[] = [];
  for (let i = 0; i < episodesVsScripted; i++) {
    scriptedResults.push(
      await runEpisode({
        env,
        obsEncoder,
        policyP1: policy,
        policyStyle,
        opponent: 'scripted',
        greedy,
        maxFrames,
        scriptedOpponentAction,
      })
    );
  }

  // Reverse role test: scripted attacks policy
  let reverseResults: EpisodeResult[] = [];
  if (episodesScriptedVsPolicy > 0) {
    for (let i = 0; i < episodesScriptedVsPolicy; i++) {
      reverseResults.push(
        await runEpisode({
          env,
          obsEncoder,
          policyP1: policy,
          policyStyle,
          opponent: 'scripted',
          greedy,
          maxFrames,
          scriptedOpponentAction,
          reverseRoles: true,
        })
      );
    }
  }

  const snapshots = opponentPool ? opponentPool.getAllSnapshots() : [];
  const snapshotsLoaded = snapshots.length;

  if (snapshotsLoaded === 0 || episodesVsSnapshots <= 0) {
    return {
      policyVsScripted: summarize(scriptedResults),
      scriptedVsPolicy: episodesScriptedVsPolicy > 0 ? summarize(reverseResults) : undefined,
      scriptedVsSnapshots: undefined,
      snapshotsLoaded,
    };
  }

  const snapshotResults: EpisodeResult[] = [];
  const policyVsSnapshotsHistogram: ActionHistogramAccumulator | undefined =
    debugActionHistogram
      ? {
          actionCountsP1: new Map(),
          actionCountsP2: new Map(),
          buttonCountsP1: new Map(),
          buttonCountsP2: new Map(),
          frames: 0,
        }
      : undefined;

  for (let i = 0; i < episodesVsSnapshots; i++) {
    const opponent = snapshots[Math.floor(Math.random() * snapshots.length)];
    snapshotResults.push(
      await runEpisode({
        env,
        obsEncoder,
        policyP1: policy,
        policyStyle,
        opponent,
        greedy,
        maxFrames,
        scriptedOpponentAction,
        debugHistogram: policyVsSnapshotsHistogram,
      })
    );
  }

  // Scripted vs snapshots (scripted attacks as player1; snapshot defends as player2)
  let scriptedVsSnapshotsResults: EpisodeResult[] = [];
  if (episodesScriptedVsSnapshots > 0) {
    for (let i = 0; i < episodesScriptedVsSnapshots; i++) {
      const snapshot = snapshots[Math.floor(Math.random() * snapshots.length)];
      const snapshotStyle = snapshot.metadata?.style ?? policyStyle ?? 'mixup';
      scriptedVsSnapshotsResults.push(
        await runEpisode({
          env,
          obsEncoder,
          // In reverseRoles mode, `policyP1` plays as player2.
          // We pass the snapshot policy as "policy" so scripted can be player1.
          policyP1: snapshot.policy,
          policyStyle: snapshotStyle,
          opponent: 'scripted',
          greedy,
          maxFrames,
          scriptedOpponentAction,
          reverseRoles: true,
        })
      );
    }
  }

  return {
    policyVsScripted: summarize(scriptedResults),
    policyVsSnapshots: summarize(snapshotResults),
    scriptedVsPolicy: episodesScriptedVsPolicy > 0 ? summarize(reverseResults) : undefined,
    scriptedVsSnapshots:
      episodesScriptedVsSnapshots > 0 ? summarize(scriptedVsSnapshotsResults) : undefined,
    debug: policyVsSnapshotsHistogram
      ? {
          policyVsSnapshots: {
            actionCountsP1: mapToRecord(policyVsSnapshotsHistogram.actionCountsP1),
            actionCountsP2: mapToRecord(policyVsSnapshotsHistogram.actionCountsP2),
            buttonCountsP1: mapToRecord(policyVsSnapshotsHistogram.buttonCountsP1),
            buttonCountsP2: mapToRecord(policyVsSnapshotsHistogram.buttonCountsP2),
            frames: policyVsSnapshotsHistogram.frames,
          },
        }
      : undefined,
    snapshotsLoaded,
  };
}
