/**
 * Example: Using GuardianBot in Training
 * 
 * This example shows how to integrate the GuardianBot into
 * your ML training pipeline as an opponent.
 */

import { FightingGameEnv } from '../../../ml/core/Environment';
import { GuardianBot } from '../../../core/ai/scripted/bots/GuardianBot';
import { MUSASHI } from '../../../core/data/musashi';

// Example 1: Simple training loop with GuardianBot
function trainAgainstGuardian() {
  // Create environment
  const env = new FightingGameEnv({
    player1Character: MUSASHI,
    player2Character: MUSASHI,
    roundTime: 99,
  });

  // Create GuardianBot at medium difficulty
  const guardian = new GuardianBot(5);

  // Training loop
  for (let episode = 0; episode < 1000; episode++) {
    let state = env.reset();
    let done = false;
    let totalReward = 0;

    while (!done) {
      // Your ML policy chooses action for player 1
      const policyAction = {
        direction: 'neutral' as const,
        button: 'lp' as const,
        holdDuration: 0
      };

      // Guardian chooses action for player 2
      const guardianAction = guardian.decide(state, 'player2', 'player1');

      // Step environment
      const result = env.step(new Map([
        ['player1', policyAction],
        ['player2', guardianAction]
      ]));

      totalReward += result.rewards.get('player1') || 0;
      done = result.done;
      state = env.getState();
    }

    // Reset bot state between episodes
    guardian.reset();

    console.log(`Episode ${episode}: Reward = ${totalReward}`);
  }
}

// Example 2: Curriculum training with difficulty progression
function curriculumTraining() {
  const env = new FightingGameEnv({
    player1Character: MUSASHI,
    player2Character: MUSASHI,
    roundTime: 99,
  });

  const guardian = new GuardianBot(1); // Start easy
  let winStreak = 0;

  for (let episode = 0; episode < 10000; episode++) {
    let state = env.reset();
    let done = false;

    while (!done) {
      const policyAction = { direction: 'neutral' as const, button: 'lp' as const, holdDuration: 0 };
      const guardianAction = guardian.decide(state, 'player2', 'player1');

      const result = env.step(new Map([
        ['player1', policyAction],
        ['player2', guardianAction]
      ]));

      done = result.done;
      state = env.getState();

      // Check winner
      if (done && state.round.winner === 'player1') {
        winStreak++;
      } else if (done) {
        winStreak = 0;
      }
    }

    guardian.reset();

    // Increase difficulty after 10 consecutive wins
    if (winStreak >= 10) {
      const newDifficulty = Math.min(10, guardian.getDifficulty() + 1);
      guardian.setDifficulty(newDifficulty);
      console.log(`Difficulty increased to ${newDifficulty}`);
      winStreak = 0;
    }
  }
}

// Example 3: Bot statistics tracking
function trackBotStats() {
  const env = new FightingGameEnv({
    player1Character: MUSASHI,
    player2Character: MUSASHI,
    roundTime: 99,
  });

  const guardian = new GuardianBot(7);

  // Track bot action distribution
  const actionCounts = {
    block: 0,
    attack: 0,
    move: 0,
    idle: 0
  };

  let state = env.reset();

  for (let frame = 0; frame < 3600; frame++) {
    const policyAction = { direction: 'neutral' as const, button: 'lp' as const, holdDuration: 0 };
    const guardianAction = guardian.decide(state, 'player2', 'player1');

    // Categorize action
    if (guardianAction.button === 'block') {
      actionCounts.block++;
    } else if (['lp', 'hp', 'lk', 'hk', 'special1', 'special2', 'super'].includes(guardianAction.button)) {
      actionCounts.attack++;
    } else if (guardianAction.direction !== 'neutral') {
      actionCounts.move++;
    } else {
      actionCounts.idle++;
    }

    const result = env.step(new Map([
      ['player1', policyAction],
      ['player2', guardianAction]
    ]));

    state = env.getState();

    if (result.done) {
      state = env.reset();
      guardian.reset();
    }
  }

  console.log('GuardianBot Action Distribution (60 seconds):');
  console.log(`  Block: ${(actionCounts.block / 3600 * 100).toFixed(1)}%`);
  console.log(`  Attack: ${(actionCounts.attack / 3600 * 100).toFixed(1)}%`);
  console.log(`  Move: ${(actionCounts.move / 3600 * 100).toFixed(1)}%`);
  console.log(`  Idle: ${(actionCounts.idle / 3600 * 100).toFixed(1)}%`);
}

// Example 4: Compare difficulties
function compareDifficulties() {
  const env = new FightingGameEnv({
    player1Character: MUSASHI,
    player2Character: MUSASHI,
    roundTime: 99,
  });

  const difficulties = [1, 3, 5, 7, 10];

  for (const diff of difficulties) {
    const guardian = new GuardianBot(diff);
    let wins = 0;
    const matches = 10;

    for (let match = 0; match < matches; match++) {
      let state = env.reset();
      let done = false;

      while (!done) {
        // Random policy
        const buttons: Array<'lp' | 'hp' | 'lk' | 'hk' | 'none'> = ['lp', 'hp', 'lk', 'hk', 'none'];
        const policyAction = {
          direction: 'neutral' as const,
          button: buttons[Math.floor(Math.random() * buttons.length)],
          holdDuration: 0
        };

        const guardianAction = guardian.decide(state, 'player2', 'player1');

        const result = env.step(new Map([
          ['player1', policyAction],
          ['player2', guardianAction]
        ]));

        done = result.done;
        state = env.getState();

        if (done && state.round.winner === 'player2') {
          wins++;
        }
      }

      guardian.reset();
    }

    console.log(`Difficulty ${diff}: Guardian won ${wins}/${matches} matches`);
  }
}

// Uncomment to run examples:
// trainAgainstGuardian();
// curriculumTraining();
// trackBotStats();
// compareDifficulties();
