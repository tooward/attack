#!/usr/bin/env ts-node
/**
 * Training Progress Viewer
 * 
 * Reads training-progress.jsonl and displays visual progress chart
 * Usage: npx ts-node scripts/show-training-progress.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const PROGRESS_FILE = './models/training-progress.jsonl';

interface ProgressRecord {
  timestamp: number;
  step: number;
  style: string;
  phase?: string;
  snapshotsLoaded: number;
  recentTrain?: {
    episodes?: number;
    wins?: number;
    losses?: number;
    draws?: number;
    anyDamageRate?: number;
    avgDamageDealt?: number;
    avgDamageTaken?: number;
  };
  scripted: {
    winRate: number;
    avgDamageDealt: number;
    avgDamageTaken: number;
    avgFrames: number;
  };
  snapshots?: {
    winRate: number;
    avgDamageDealt: number;
    avgDamageTaken: number;
    avgFrames: number;
  } | null;
}

function readProgress(): ProgressRecord[] {
  if (!fs.existsSync(PROGRESS_FILE)) {
    console.error(`Progress file not found: ${PROGRESS_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(PROGRESS_FILE, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);
  
  return lines.map(line => JSON.parse(line));
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function createSparkline(values: number[], width: number = 20): string {
  if (values.length === 0) return ' '.repeat(width);
  
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  
  const chars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  
  return values.slice(-width).map(v => {
    const normalized = (v - min) / range;
    const index = Math.min(Math.floor(normalized * chars.length), chars.length - 1);
    return chars[index];
  }).join('');
}

function main() {
  console.log('\n📊 TRAINING PROGRESS REPORT\n');
  console.log('='.repeat(80));
  
  const records = readProgress();
  
  if (records.length === 0) {
    console.log('No training records found.');
    return;
  }

  // Latest stats
  const latest = records[records.length - 1];
  const oldest = records[0];
  
  console.log('Latest Stats:');
  console.log(`  Step:            ${latest.step.toLocaleString()}`);
  console.log(`  Style:           ${latest.style}`);
  if (latest.phase) {
    console.log(`  Curriculum:      ${latest.phase}`);
  }
  console.log(`  Snapshots:       ${latest.snapshotsLoaded}`);
  console.log();
  
  // Performance vs Scripted
  console.log('Performance vs Scripted:');
  console.log(`  Win Rate:        ${formatPercent(latest.scripted.winRate)}`);
  console.log(`  Damage Dealt:    ${latest.scripted.avgDamageDealt.toFixed(1)}`);
  console.log(`  Damage Taken:    ${latest.scripted.avgDamageTaken.toFixed(1)}`);
  console.log(`  Avg Match:       ${latest.scripted.avgFrames.toFixed(0)} frames (${(latest.scripted.avgFrames / 60).toFixed(1)}s)`);
  
  // Performance vs Snapshots
  if (latest.snapshots) {
    console.log('\nPerformance vs Snapshots:');
    console.log(`  Win Rate:        ${formatPercent(latest.snapshots.winRate)}`);
    console.log(`  Damage Dealt:    ${latest.snapshots.avgDamageDealt.toFixed(1)}`);
    console.log(`  Damage Taken:    ${latest.snapshots.avgDamageTaken.toFixed(1)}`);
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Progress over time
  console.log('\n📈 PROGRESS TRENDS\n');
  
  const winRates = records.map(r => r.scripted.winRate);
  const damageDealt = records.map(r => r.scripted.avgDamageDealt);
  const damageTaken = records.map(r => r.scripted.avgDamageTaken);
  
  console.log(`Win Rate:        ${createSparkline(winRates, 40)} ${formatPercent(winRates[winRates.length - 1])}`);
  console.log(`Damage Dealt:    ${createSparkline(damageDealt, 40)} ${damageDealt[damageDealt.length - 1].toFixed(1)}`);
  console.log(`Damage Taken:    ${createSparkline(damageTaken, 40)} ${damageTaken[damageTaken.length - 1].toFixed(1)}`);
  
  // Training engagement
  if (latest.recentTrain && latest.recentTrain.anyDamageRate !== undefined) {
    console.log('\n📊 TRAINING ENGAGEMENT\n');
    console.log(`  Episodes:        ${latest.recentTrain.episodes}`);
    console.log(`  W/L/D:           ${latest.recentTrain.wins}/${latest.recentTrain.losses}/${latest.recentTrain.draws}`);
    console.log(`  Any Damage:      ${formatPercent(latest.recentTrain.anyDamageRate)}`);
    console.log(`  Avg Damage:      ${latest.recentTrain.avgDamageDealt?.toFixed(1)} / ${latest.recentTrain.avgDamageTaken?.toFixed(1)}`);
  }
  
  // Calculate improvement
  if (records.length > 1) {
    console.log('\n📈 IMPROVEMENT SINCE START\n');
    
    const startWR = oldest.scripted.winRate;
    const endWR = latest.scripted.winRate;
    const wrDelta = endWR - startWR;
    
    const startDmg = oldest.scripted.avgDamageDealt;
    const endDmg = latest.scripted.avgDamageDealt;
    const dmgDelta = endDmg - startDmg;
    
    console.log(`  Win Rate:        ${formatPercent(startWR)} → ${formatPercent(endWR)} (${wrDelta > 0 ? '+' : ''}${formatPercent(wrDelta)})`);
    console.log(`  Damage Dealt:    ${startDmg.toFixed(1)} → ${endDmg.toFixed(1)} (${dmgDelta > 0 ? '+' : ''}${dmgDelta.toFixed(1)})`);
    console.log(`  Steps:           ${oldest.step.toLocaleString()} → ${latest.step.toLocaleString()}`);
    
    // Time estimate
    const timeElapsed = latest.timestamp - oldest.timestamp;
    const stepsElapsed = latest.step - oldest.step;
    const stepsPerHour = (stepsElapsed / timeElapsed) * 3600000;
    
    console.log(`  Training Rate:   ${stepsPerHour.toFixed(0)} steps/hour`);
  }
  
  // Milestones
  console.log('\n🎯 MILESTONES\n');
  const milestones = [
    { name: 'Beat Random (20% WR)', achieved: latest.scripted.winRate >= 0.20, target: 0.20 },
    { name: 'Competent (50% WR)', achieved: latest.scripted.winRate >= 0.50, target: 0.50 },
    { name: 'Strong (70% WR)', achieved: latest.scripted.winRate >= 0.70, target: 0.70 },
    { name: 'Expert (90% WR)', achieved: latest.scripted.winRate >= 0.90, target: 0.90 },
  ];
  
  for (const milestone of milestones) {
    const status = milestone.achieved ? '✅' : '⏳';
    const progress = milestone.achieved ? 'COMPLETE' : `${formatPercent(latest.scripted.winRate / milestone.target)} progress`;
    console.log(`  ${status} ${milestone.name.padEnd(25)} ${progress}`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

if (require.main === module) {
  main();
}
