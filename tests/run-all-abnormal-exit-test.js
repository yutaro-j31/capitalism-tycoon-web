'use strict';

// A test that dies from a signal (V8 heap OOM -> SIGABRT, the OOM killer -> SIGKILL) or floods past maxBuffer makes
// spawnSync return status === null. The shard runner must report that as a FAILURE, like a non-zero exit.
// The production tests/run-all.js, tests/run-all-shard.js and tests/run-all-shards.json are copied unchanged into a
// temporary directory whose owned tests are stubs, so this exercises the real runner code paths.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const shardConfig = require('./run-all-shards.json');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'run-all-abnormal-'));
const PASS = "console.log('PASS stub')";

function sandbox(shard, overrides = {}, env = {}) {
  const dir = fs.mkdtempSync(path.join(TMP, `${shard}-`));
  fs.mkdirSync(path.join(dir, 'tests'));
  for (const file of ['run-all.js', 'run-all-shard.js', 'run-all-shards.json']) fs.copyFileSync(path.join(ROOT, 'tests', file), path.join(dir, 'tests', file));
  const scripts = {};
  for (const label of shardConfig[shard]) {
    const body = overrides[label] || PASS;
    if (label.startsWith('test:')) scripts[label] = `node -e "${body.replace(/"/g, '\\"')}"`;
    else { fs.mkdirSync(path.dirname(path.join(dir, label)), { recursive: true }); fs.writeFileSync(path.join(dir, label), body); }
  }
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'sandbox', scripts }));
  return childProcess.spawnSync(process.execPath, ['tests/run-all-shard.js'], { cwd: dir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...process.env, TEST_SHARD: shard, ...env } });
}

const nodeLabel = 'tests/ramen-supply-payment-terms-negative-test.js'; // shard J, run by the `node <file>` loop
assert.ok(shardConfig.J.includes(nodeLabel));

// Documents the underlying behaviour: status is null for these endings, which a bare `if (result.status)` ignores.
const probe = childProcess.spawnSync(process.execPath, ['-e', "process.kill(process.pid,'SIGKILL')"]);
assert.equal(probe.status, null); assert.equal(probe.signal, 'SIGKILL');

// Controls: normal behaviour is unchanged.
const ok = sandbox('J');
assert.equal(ok.status, 0, ok.stderr); assert.match(ok.stdout, /canonical-test-shard-summary: shard=J contractOnly=false executed=10 seen=\d+ total=[\d.]+s/);
const plainFail = sandbox('J', { [nodeLabel]: 'process.exit(1)' });
assert.equal(plainFail.status, 1); assert.match(plainFail.stderr, /::error title=Test suite failed::ramen-supply-payment-terms-negative/); assert.doesNotMatch(plainFail.stderr, /abnormal exit/);
const contract = sandbox('J', {}, { TEST_SHARD_CONTRACT: '1' });
assert.equal(contract.status, 0, contract.stderr); assert.match(contract.stdout, /contractOnly=true executed=0 /);

// The false passes this test exists for.
for (const [name, body, detail] of [
  ['killed by SIGKILL (OOM killer)', "process.kill(process.pid,'SIGKILL')", /signal=SIGKILL/],
  ['aborted by SIGABRT (V8 heap exhaustion)', 'process.abort()', /signal=SIGABRT/],
  ['output beyond maxBuffer (ENOBUFS)', "process.stdout.write('x'.repeat(70*1024*1024))", /error=ENOBUFS/]
]) {
  const r = sandbox('J', { [nodeLabel]: body });
  assert.notEqual(r.status, 0, `${name}: the shard runner must fail, not report success`);
  assert.match(r.stderr, /::error title=Test suite failed::ramen-supply-payment-terms-negative/, name);
  assert.match(r.stderr, detail, name);
}

// The pre-step that runs before run-all.js (shard C owns it) uses its own check.
const preStep = 'tests/product-recall-reachability-runner.js';
assert.ok(shardConfig.C.includes(preStep));
const pre = sandbox('C', { [preStep]: "process.kill(process.pid,'SIGKILL')" });
assert.notEqual(pre.status, 0, 'a signal death in the registered pre-step fails the shard'); assert.match(pre.stderr, /::error title=Test suite failed::product-recall-reachability/); assert.match(pre.stderr, /signal=SIGKILL/);

// The `npm run` loop: npm already maps a child's signal death to an exit status, and that must stay a failure.
const npmLabel = shardConfig.H.find(label => label.startsWith('test:'));
const viaNpm = sandbox('H', { [npmLabel]: "process.kill(process.pid,'SIGKILL')" });
assert.notEqual(viaNpm.status, 0, 'a signal death behind npm run fails the shard'); assert.match(viaNpm.stderr, new RegExp(`::error title=Test suite failed::${npmLabel}`));

fs.rmSync(TMP, { recursive: true, force: true });
console.log('run-all-abnormal-exit-test: ok');
