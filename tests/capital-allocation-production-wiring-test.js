const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, readIndex, extractScripts, loadGame } = require('./harness');

const html = readIndex();
const sources = extractScripts(html).map(script => script.src).filter(Boolean);
const required = [
  './js/player-engine-bridge.js',
  './js/app.js',
  './js/shareholder-returns.js',
  './js/capital-allocation-score.js',
  './js/capital-allocation-policy.js'
];

for (const source of required) {
  assert.ok(sources.includes(source), `${source} must be loaded by index.html`);
  assert.equal(sources.filter(item => item === source).length, 1, `${source} must be loaded exactly once`);
}

const indexOf = source => sources.indexOf(source);
assert.ok(indexOf('./js/player-engine-bridge.js') < indexOf('./js/app.js'), 'the engine bridge must wrap TycoonEngine.load before app startup');
assert.ok(indexOf('./js/app.js') < indexOf('./js/shareholder-returns.js'), 'capital allocation extensions must install after the app engine is captured');
assert.ok(indexOf('./js/shareholder-returns.js') < indexOf('./js/capital-allocation-score.js'), 'shareholder returns must load before capital allocation score');
assert.ok(indexOf('./js/capital-allocation-score.js') < indexOf('./js/capital-allocation-policy.js'), 'capital allocation score must load before policy');

const strategySource = fs.readFileSync(path.join(ROOT, 'js', 'strategy-balance.js'), 'utf8');
for (const file of ['shareholder-returns.js', 'capital-allocation-score.js', 'capital-allocation-policy.js']) {
  assert.ok(!strategySource.includes(file), `${file} must not be dynamically loaded by strategy-balance.js`);
}

const load = loadGame();
const { modules, ctx } = load;
assert.ok(modules.shareholderReturns?.__installed, 'shareholder returns must register in the production runtime');
assert.ok(modules.capitalAllocationScore?.__installed, 'capital allocation score must register in the production runtime');
assert.ok(modules.capitalAllocationPolicy?.__installed, 'capital allocation policy must register in the production runtime');
assert.ok(ctx.__ct_engine, 'the production app engine must be captured');
assert.equal(typeof ctx.__ct_engine.setDividend, 'function');
assert.equal(typeof ctx.__ct_engine.evaluateCapitalAllocation, 'function');
assert.equal(typeof ctx.__ct_engine.setCapitalAllocationPolicy, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationPolicyTrend, 'function');
assert.equal(modules.engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(modules.engine.SAVE_VERSION, 9);

ctx.__ct_engine.g.configured = true;
ctx.__ct_engine.g.publicCompany = true;
ctx.__ct_engine.g.selectedTab = 'market';
assert.match(modules.shareholderReturns.render(ctx.__ct_engine), /data-shareholder-returns-ui/);
assert.match(modules.capitalAllocationScore.render(ctx.__ct_engine), /data-capital-allocation-score-ui/);
assert.match(modules.capitalAllocationPolicy.render(ctx.__ct_engine), /data-capital-allocation-policy-ui/);

console.log('capital allocation production wiring tests passed');
