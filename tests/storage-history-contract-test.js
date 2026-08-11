const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadGame } = require('./harness');

const harnessSource = fs.readFileSync(path.join(ROOT, 'tests', 'harness.js'), 'utf8');
assert.ok(!harnessSource.includes('recordStorageHistory'), 'storage history must not have an opt-out identifier');

const forbiddenEnvironmentVariable = 'CAPITALISM_TYCOON_DISABLE_' + 'STORAGE_HISTORY';
for (const entry of fs.readdirSync(path.join(ROOT, 'tests'), { withFileTypes: true })) {
  if (!entry.isFile() || entry.name === path.basename(__filename)) continue;
  const source = fs.readFileSync(path.join(ROOT, 'tests', entry.name), 'utf8');
  assert.ok(!source.includes(forbiddenEnvironmentVariable), `${entry.name} must not disable storage history`);
}

const { ctx, engineModule } = loadGame({ headless: true });
const engine = new engineModule.TycoonEngine();
ctx.__localStorageHistory.setItem.length = 0;
assert.equal(engine.save(), true, 'the test save must succeed');
assert.equal(ctx.__localStorageHistory.setItem.length, 1, 'the test save must be recorded');
const [entry] = ctx.__localStorageHistory.setItem;
assert.ok(!Object.hasOwn(entry, 'value'), 'history must not retain the save JSON');
assert.ok(Object.hasOwn(entry, 'bytes'), 'history must retain the save byte count');
assert.equal(entry.bytes, ctx.__localStorageData.get(entry.key).length);

console.log('storage history contract tests passed');
