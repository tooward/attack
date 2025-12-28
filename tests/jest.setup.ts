// Jest setup: keep test output quiet by default.
// Opt-in to verbose logs with `TEST_LOGS=1`.

const verbose = process.env.TEST_LOGS === '1';

const shouldSuppress = (args: unknown[]): boolean => {
  if (verbose) return false;

  const msg = args
    .map(a => (typeof a === 'string' ? a : ''))
    .join(' ');

  // CurriculumManager stage progression spam
  if (msg.includes('=== Advanced to Stage')) return true;
  if (msg.includes('=== Curriculum Complete! ===')) return true;
  if (msg.includes('✓ Stage success criteria met')) return true;
  if (msg.includes('Stage skipping is disabled in config')) return true;

  // ModelOptimizer progress spam
  if (msg.includes('Starting model optimization')) return true;
  if (msg.includes('Applying weight pruning')) return true;
  if (msg.includes('Applying int8 quantization')) return true;
  if (msg.includes('Optimization complete!')) return true;
  if (msg.includes('=== Optimization Results ===')) return true;

  // TFJS "install node backend" banner (can appear depending on import order)
  if (msg.includes('Hi, looks like you are running TensorFlow.js in Node.js')) return true;

  // ImitationTrainer / training test progress logs
  if (msg.includes('Training on') && msg.includes('replays')) return true;
  if (msg.startsWith('Train:')) return true;
  if (msg.includes('Training complete!')) return true;

  return false;
};

const originalLog = console.log;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args: unknown[]) => {
  if (!shouldSuppress(args)) originalLog(...args);
};

console.info = (...args: unknown[]) => {
  if (!shouldSuppress(args)) originalInfo(...args);
};

console.warn = (...args: unknown[]) => {
  if (!shouldSuppress(args)) originalWarn(...args);
};

console.error = (...args: unknown[]) => {
  // Do not suppress errors by default.
  originalError(...args);
};

// Silence Node deprecation warnings that show up as test noise.
// This is scoped to the Jest process only.
const originalEmitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: any, ...rest: any[]) => {
  if (!verbose) {
    const code = typeof warning === 'object' && warning ? warning.code : undefined;
    if (code === 'DEP0044' || code === 'DEP0051') return;
  }
  return originalEmitWarning(warning, ...rest);
}) as any;
