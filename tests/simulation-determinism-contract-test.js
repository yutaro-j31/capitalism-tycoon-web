'use strict';

// Issue #731 (P0-06): the production simulation drew from Math.random(), Date.now() and
// crypto.randomUUID(), whose state is not saved, so the same save and the same actions diverged
// across runtimes. js/simulation-rng.js keeps the stream in the save. This contract ratchets the
// remaining nondeterministic sources: a file may never gain one, and the simulation entries shrink
// to zero as each subsystem moves onto simulationRng (#731 PR2-PR4). Only the wall-clock/UI entries
// below stay: they never feed the simulation state.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PATTERNS = { 'Math.random': /Math\.random\(/g, 'Date.now': /Date\.now\(/g, randomUUID: /randomUUID/g, 'new Date': /new Date\(/g };

// Simulation sources still to migrate (#731). Each migration PR lowers these; PR5 empties the map.
const SIMULATION_PENDING = {
  'js/expansion.js': { 'Math.random': 11, 'Date.now': 1, randomUUID: 1 },
  'js/completion.js': { 'Math.random': 8, 'Date.now': 1, randomUUID: 1 },
  'js/parity.js': { 'Math.random': 8, 'Date.now': 1, randomUUID: 1 },
};
// Wall-clock metadata and UI/diagnostics only (never simulation state).
const NON_SIMULATION = {
  'js/engine.js': { 'new Date': 2, 'Math.random': 1 }, // lastSaveDate; configure's one entropy draw that seeds a new game's stream
  'js/save-storage.js': { 'new Date': 1 }, // save timestamp
  'js/app.js': { 'new Date': 1 }, // UI clock display
  'js/boot-recovery.js': { 'Date.now': 2, 'new Date': 1 },
  'js/physical-iphone-playtest.js': { 'new Date': 1 },
  'js/playtest-report-ui.js': { 'Date.now': 1, 'new Date': 3 },
  'js/release-diagnostics-ui.js': { 'Date.now': 2, 'new Date': 1 },
  'js/runtime-recovery-ui.js': { 'Date.now': 1, 'new Date': 1 },
};

const allowed = (file, name) => (SIMULATION_PENDING[file]?.[name] || 0) + (NON_SIMULATION[file]?.[name] || 0);
const found = [];
for (const name of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).sort()) {
  const file = `js/${name}`, source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const [pattern, re] of Object.entries(PATTERNS)) {
    const count = (source.match(re) || []).length;
    if (count > allowed(file, pattern)) found.push(`${file}: ${pattern} ${count} (allowed ${allowed(file, pattern)})`);
  }
}
assert.deepEqual(found, [], `new nondeterministic source in production code; draw from simulationRng instead:\n${found.join('\n')}`);

// The ratchet only goes down: an allowance above the current count must be lowered in the same PR.
const stale = [];
for (const table of [SIMULATION_PENDING, NON_SIMULATION]) {
  for (const [file, entries] of Object.entries(table)) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const pattern of Object.keys(entries)) {
      const count = (source.match(PATTERNS[pattern]) || []).length;
      if (count < allowed(file, pattern)) stale.push(`${file}: ${pattern} ${count} < allowed ${allowed(file, pattern)}`);
    }
  }
}
assert.deepEqual(stale, [], `lower the allowance to the current count:\n${stale.join('\n')}`);

// The deterministic module itself never touches a host source.
const rngSource = fs.readFileSync(path.join(ROOT, 'js/simulation-rng.js'), 'utf8').replace(/\/\/.*$/gm, '');
for (const [pattern, re] of Object.entries(PATTERNS)) assert.equal((rngSource.match(re) || []).length, 0, `simulation-rng.js must not use ${pattern}`);

console.log(`simulation determinism contract ok (pending simulation sources: ${Object.values(SIMULATION_PENDING).reduce((a, e) => a + Object.values(e).reduce((x, y) => x + y, 0), 0)})`);
