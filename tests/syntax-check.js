require('./test-registration-contract-test');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const { extractScripts, extractEventHandlers } = require('./harness');

for (const file of [
  'tests/bank-loans-covenants-accounting-test.js',
  'tests/board-governance-resolution-test.js',
  'tests/business-record-sanitizer-test.js',
  'tests/crisis-ui-observer-contract-test.js',
  'tests/game-over-settings-ui-test.js',
  'tests/macro-cycle-test.js',
  'tests/player-turnaround-plan-ui-test.js',
  'tests/product-lifecycle-determinism-test.js',
  'tests/save-storage-budget-test.js',
  'tests/setup-recovery-ui-test.js'
]) {
  const result = spawnSync('node', [file], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: false
  });
  if (result.status) {
    console.error(`registration backfill failed: ${file}`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}

let failures = 0;
extractScripts().forEach((s, i) => { try { new vm.Script(s.code, { filename: `index.html <script #${i+1}> line ${s.startLine}` }); console.log(`ok script #${i+1} starting line ${s.startLine}`); } catch (e) { failures++; console.error(`script #${i+1} starting line ${s.startLine}: ${e.message}`); } });
extractEventHandlers().forEach(h => { try { new vm.Script(`(function(event){${h.code}\n})`, { filename: `index.html ${h.name} line ${h.line}` }); } catch (e) { failures++; console.error(`${h.name} at line ${h.line}: ${e.message}`); } });
if (failures) process.exit(1);
