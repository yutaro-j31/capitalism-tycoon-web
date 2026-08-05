'use strict';

const childProcess = require('node:child_process');
const path = require('node:path');

const originalSpawnSync = childProcess.spawnSync;
const timings = [];
let summaryPrinted = false;

function commandLabel(command, args = []) {
  if (command === 'npm' && args[0] === 'run') return String(args[1] || 'npm-run');
  if (command === 'node' && args[0]) return path.relative(process.cwd(), String(args[0]));
  return [command, ...args].join(' ');
}

childProcess.spawnSync = function timedSpawnSync(command, args, options) {
  const startedAt = process.hrtime.bigint();
  const result = originalSpawnSync.call(this, command, args, options);
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  const label = commandLabel(command, args);
  timings.push({ label, elapsedMs });
  console.log(`::notice title=Test timing::${label} ${(elapsedMs / 1000).toFixed(3)}s`);
  return result;
};

function printSummary() {
  if (summaryPrinted) return;
  summaryPrinted = true;
  const sorted = [...timings].sort((a, b) => b.elapsedMs - a.elapsedMs);
  const totalMs = timings.reduce((sum, item) => sum + item.elapsedMs, 0);
  console.log('canonical-test-timing-top-10:');
  sorted.slice(0, 10).forEach((item, index) => {
    console.log(`${index + 1}. ${item.label} ${(item.elapsedMs / 1000).toFixed(3)}s`);
  });
  console.log(`canonical-test-timing-total: ${(totalMs / 1000).toFixed(3)}s across ${timings.length} entries`);
}

process.on('exit', printSummary);
process.on('SIGINT', () => {
  printSummary();
  process.exit(130);
});
process.on('SIGTERM', () => {
  printSummary();
  process.exit(143);
});

require('./run-all');
printSummary();
