/**
 * Live training progress watcher
 *
 * Tails the JSONL progress log written by src/ml/training/train.ts
 * and prints a concise summary line for each new record.
 */

import * as fs from 'fs';
import * as path from 'path';

type EvalSummary = {
  episodes: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgFrames: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
};

type ProgressRecord = {
  timestamp: number;
  step: number;
  style: string;
  phase?: string;
  snapshotsLoaded: number;
  // Optional training-side stats attached to eval records.
  recentTrain?: any;
  scripted: EvalSummary;
  snapshots: EvalSummary | null;
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const [key, inlineValue] = token.split('=', 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i++;
    } else {
      args.set(key, '1');
    }
  }
  return args;
}

function formatPct(v: number): string {
  if (!Number.isFinite(v)) return 'n/a';
  return (v * 100).toFixed(1) + '%';
}

function formatIso(ts: number): string {
  try {
    return new Date(ts).toISOString().replace('T', ' ').replace('Z', '');
  } catch {
    return String(ts);
  }
}

function formatSummary(label: string, s: EvalSummary): string {
  return `${label} WR=${formatPct(s.winRate)} dmg=${s.avgDamageDealt.toFixed(1)}/${s.avgDamageTaken.toFixed(1)} frames=${s.avgFrames.toFixed(0)} W/L/D=${s.wins}/${s.losses}/${s.draws}`;
}

function formatRecord(r: ProgressRecord): string {
  const parts = [
    `[${formatIso(r.timestamp)}]`,
    `step=${r.step}`,
    `style=${r.style}`,
    r.phase ? `phase=${r.phase}` : undefined,
    `snapshotsLoaded=${r.snapshotsLoaded}`,
    formatSummary('scripted', r.scripted),
  ].filter(Boolean) as string[];

  if (r.recentTrain) {
    const rt = r.recentTrain as any;
    if (typeof rt.episodes === 'number') {
      parts.push(
        `train W/L/D=${rt.wins}/${rt.losses}/${rt.draws}` +
          ` anyDmg=${(rt.anyDamageRate * 100).toFixed(0)}%` +
          ` firstHit=${(rt.firstHitRate * 100).toFixed(0)}%`
      );
    } else if (typeof rt.proxyOutcome === 'string') {
      parts.push(
        `train proxy=${rt.proxyOutcome}` +
          ` anyDmg=${rt.anyDamage ? 'yes' : 'no'}` +
          ` firstHit=${rt.firstHitDealt ? 'yes' : 'no'}`
      );
    }
  }

  if (r.snapshots) {
    parts.push(formatSummary('snapshots', r.snapshots));
  }

  return parts.join(' | ');
}

function safeParseJsonLine(line: string): ProgressRecord | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as ProgressRecord;
  } catch {
    return null;
  }
}

function readLastNRecords(filePath: string, n: number): ProgressRecord[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const slice = lines.slice(Math.max(0, lines.length - n));
  const records: ProgressRecord[] = [];
  for (const line of slice) {
    const rec = safeParseJsonLine(line);
    if (rec) records.push(rec);
  }
  return records;
}

async function main() {
  const args = parseArgs(process.argv);

  const defaultFile = './models/training-progress.jsonl';
  const filePath =
    args.get('--file') ??
    process.env.TRAIN_PROGRESS_PATH ??
    defaultFile;

  const resolved = path.resolve(process.cwd(), filePath);
  const lastN = Number(args.get('--last') ?? '5');
  const pollMs = Number(args.get('--poll') ?? '250');

  console.log(`Watching progress log: ${resolved}`);

  if (Number.isFinite(lastN) && lastN > 0) {
    const recent = readLastNRecords(resolved, lastN);
    for (const rec of recent) {
      console.log(formatRecord(rec));
    }
    if (recent.length > 0) console.log('---');
  }

  let position = 0;
  let pending = '';

  const initStat = () => {
    try {
      const st = fs.statSync(resolved);
      position = st.size;
    } catch {
      position = 0;
    }
  };

  initStat();

  const readNewData = () => {
    let st: fs.Stats | null = null;
    try {
      st = fs.statSync(resolved);
    } catch {
      // File might not exist yet.
      return;
    }

    if (st.size < position) {
      // Truncated/rotated
      position = 0;
      pending = '';
    }

    if (st.size === position) return;

    const fd = fs.openSync(resolved, 'r');
    try {
      const length = st.size - position;
      const buffer = Buffer.allocUnsafe(length);
      fs.readSync(fd, buffer, 0, length, position);
      position = st.size;

      pending += buffer.toString('utf8');
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? '';

      for (const line of lines) {
        const rec = safeParseJsonLine(line);
        if (rec) console.log(formatRecord(rec));
      }
    } finally {
      fs.closeSync(fd);
    }
  };

  // Polling is simple and robust across editors/OS.
  const interval = setInterval(readNewData, pollMs);

  const shutdown = () => {
    clearInterval(interval);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('progress watcher failed:', err);
  process.exit(1);
});
