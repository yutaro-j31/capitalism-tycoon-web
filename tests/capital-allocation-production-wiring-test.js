const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
assert.doesNotMatch(strategySource, /document\.createElement\(\s*['"]script['"]\s*\)/, 'strategy-balance.js must not create module script elements');
assert.doesNotMatch(strategySource, /\bloadPhaseScript\b/, 'the legacy phase script loader must remain removed');
assert.doesNotMatch(strategySource, /document\.currentScript|__capitalismTycoonAssetVersion/, 'strategy-balance.js must not derive dynamic module URLs');

const staticPhaseScripts = [
  './js/macro-cycle.js',
  './js/product-lifecycle.js',
  './js/treasury-prepayment.js',
  './js/treasury-refinancing-policy.js',
  './js/capital-allocation-forecast.js',
  './js/capital-allocation-actions.js',
  './js/capital-allocation-decision-memo.js',
  './js/capital-allocation-stress-test.js',
  './js/capital-allocation-resilience-memo.js',
  './js/capital-allocation-recovery-audit.js',
  './js/capital-allocation-recovery-funding.js',
  './js/capital-allocation-recovery-funding-options.js',
  './js/capital-allocation-recovery-funding-readiness.js',
  './js/capital-allocation-recovery-funding-reconciliation.js',
  './js/capital-allocation-recovery-funding-outcome.js',
  './js/capital-allocation-management-guide.js'
];
assert.equal(sources.filter(item => item === './js/strategy-balance.js').length, 1, 'strategy-balance.js must be loaded exactly once');
for (const source of staticPhaseScripts) {
  assert.equal(sources.filter(item => item === source).length, 1, `${source} must be loaded exactly once by index.html`);
  assert.ok(indexOf(source) < indexOf('./js/strategy-balance.js'), `${source} must load before strategy-balance.js`);
}
for (let i = 1; i < staticPhaseScripts.length; i++) {
  assert.ok(indexOf(staticPhaseScripts[i - 1]) < indexOf(staticPhaseScripts[i]), `${staticPhaseScripts[i]} must preserve the static dependency order`);
}

const load = loadGame();
const { modules, ctx } = load;
for (const file of ['player-debt-service.js','treasury-prepayment.js','capital-allocation-forecast.js','capital-allocation-actions.js','capital-allocation-decision-memo.js','capital-allocation-stress-test.js','capital-allocation-resilience-memo.js','capital-allocation-recovery-audit.js','capital-allocation-recovery-funding.js','capital-allocation-recovery-funding-options.js','capital-allocation-recovery-funding-readiness.js','capital-allocation-recovery-funding-reconciliation.js','capital-allocation-recovery-funding-outcome.js','capital-allocation-management-guide.js']) {
  const key=file.replace('.js','').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  if (!modules[key]) vm.runInContext(fs.readFileSync(path.join(ROOT,'js',file),'utf8'),ctx,{filename:file});
}
assert.ok(modules.shareholderReturns?.__installed, 'shareholder returns must register in the production runtime');
assert.ok(modules.capitalAllocationScore?.__installed, 'capital allocation score must register in the production runtime');
assert.ok(modules.capitalAllocationPolicy?.__installed, 'capital allocation policy must register in the production runtime');
assert.ok(modules.capitalAllocationRecoveryAudit?.__installed, 'capital allocation recovery audit must register through its production dependency chain');
assert.ok(modules.capitalAllocationRecoveryFunding?.__installed, 'capital allocation recovery funding must register through its production dependency chain');
assert.ok(modules.capitalAllocationRecoveryFundingOptions?.__installed, 'capital allocation recovery funding options must register through its production dependency chain');
assert.ok(modules.capitalAllocationRecoveryFundingReadiness?.__installed, 'capital allocation recovery funding readiness must register through its production dependency chain');
assert.ok(modules.capitalAllocationRecoveryFundingReconciliation?.__installed, 'capital allocation recovery funding reconciliation must register through its production dependency chain');
assert.ok(modules.capitalAllocationRecoveryFundingOutcome?.__installed, 'capital allocation recovery funding outcome must register through its production dependency chain');
assert.ok(modules.capitalAllocationManagementGuide?.__installed, 'capital allocation management guide must register through its production dependency chain');
assert.ok(ctx.__ct_engine, 'the production app engine must be captured');
assert.equal(typeof ctx.__ct_engine.setDividend, 'function');
assert.equal(typeof ctx.__ct_engine.evaluateCapitalAllocation, 'function');
assert.equal(typeof ctx.__ct_engine.setCapitalAllocationPolicy, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationPolicyTrend, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationRecoveryAudit, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationRecoveryAuditFrontier, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationRecoveryFundingInventory, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationRecoveryFundingPlan, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationRecoveryFundingFrontier, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationRecoveryFundingOptions, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationRecoveryFundingOptionFrontier, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationRecoveryFundingReadiness, 'function');
assert.equal(typeof ctx.__ct_engine.validateCapitalAllocationRecoveryFundingSnapshot, 'function');
assert.equal(typeof ctx.__ct_engine.pinCapitalAllocationRecoveryFundingSnapshot, 'function');
assert.equal(typeof ctx.__ct_engine.clearCapitalAllocationRecoveryFundingSnapshot, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationRecoveryFundingReconciliation, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationRecoveryFundingOutcome, 'function');
assert.equal(typeof ctx.__ct_engine.capitalAllocationManagementGuide, 'function');
assert.equal(modules.engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(modules.engine.SAVE_VERSION, 9);

ctx.__ct_engine.g.configured = true;
ctx.__ct_engine.g.publicCompany = true;
ctx.__ct_engine.g.selectedTab = 'market';
assert.match(modules.shareholderReturns.render(ctx.__ct_engine), /data-shareholder-returns-ui/);
assert.match(modules.capitalAllocationScore.render(ctx.__ct_engine), /data-capital-allocation-score-ui/);
assert.match(modules.capitalAllocationPolicy.render(ctx.__ct_engine), /data-capital-allocation-policy-ui/);
assert.match(modules.capitalAllocationRecoveryAudit.render(ctx.__ct_engine), /data-capital-allocation-recovery-audit/);
assert.match(modules.capitalAllocationRecoveryFunding.render(ctx.__ct_engine), /data-capital-allocation-recovery-funding/);
assert.match(modules.capitalAllocationRecoveryFundingOptions.render(ctx.__ct_engine), /data-capital-allocation-recovery-funding-options/);
assert.match(modules.capitalAllocationRecoveryFundingReadiness.render(ctx.__ct_engine), /data-capital-allocation-recovery-funding-readiness/);
assert.match(modules.capitalAllocationRecoveryFundingReconciliation.render(ctx.__ct_engine), /data-capital-allocation-recovery-funding-reconciliation/);
assert.match(modules.capitalAllocationRecoveryFundingOutcome.render(ctx.__ct_engine), /data-capital-allocation-recovery-funding-outcome/);
assert.match(modules.capitalAllocationManagementGuide.render(ctx.__ct_engine), /data-capital-allocation-management-guide/);

console.log('capital allocation production wiring tests passed');
