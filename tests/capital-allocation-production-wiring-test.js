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
for (const file of ['shareholder-returns.js', 'capital-allocation-score.js', 'capital-allocation-policy.js']) {
  assert.ok(!strategySource.includes(file), `${file} must not be dynamically loaded by strategy-balance.js`);
}
const actionsLoader = "loadPhaseScript('./js/capital-allocation-actions.js','8C-10'";
const decisionMemoLoader = "loadPhaseScript('./js/capital-allocation-decision-memo.js','8D-1'";
const stressLoader = "loadPhaseScript('./js/capital-allocation-stress-test.js','8D-3'";
const resilienceLoader = "loadPhaseScript('./js/capital-allocation-resilience-memo.js','8D-5'";
const recoveryAuditLoader = "loadPhaseScript('./js/capital-allocation-recovery-audit.js','8D-11'";
const recoveryFundingLoader = "loadPhaseScript('./js/capital-allocation-recovery-funding.js','8D-13'";
const recoveryFundingOptionsLoader = "loadPhaseScript('./js/capital-allocation-recovery-funding-options.js','8D-15'";
const recoveryFundingReadinessLoader = "loadPhaseScript('./js/capital-allocation-recovery-funding-readiness.js','8D-17'";
const recoveryFundingReconciliationLoader = "loadPhaseScript('./js/capital-allocation-recovery-funding-reconciliation.js','8D-19'";
for (const [loader,label,file] of [
  [decisionMemoLoader,'Phase 8D-1 board memo','capital-allocation-decision-memo.js'],
  [stressLoader,'Phase 8D-3 stress test','capital-allocation-stress-test.js'],
  [resilienceLoader,'Phase 8D-5 resilience memo','capital-allocation-resilience-memo.js'],
  [recoveryAuditLoader,'Phase 8D-11 recovery audit','capital-allocation-recovery-audit.js'],
  [recoveryFundingLoader,'Phase 8D-13 recovery funding','capital-allocation-recovery-funding.js'],
  [recoveryFundingOptionsLoader,'Phase 8D-15 recovery funding options','capital-allocation-recovery-funding-options.js'],
  [recoveryFundingReadinessLoader,'Phase 8D-17 funding execution readiness','capital-allocation-recovery-funding-readiness.js'],
  [recoveryFundingReconciliationLoader,'Phase 8D-19 funding execution reconciliation','capital-allocation-recovery-funding-reconciliation.js']
]) {
  assert.ok(strategySource.includes(loader), `${label} must be dynamically loaded in production`);
  assert.equal((strategySource.match(new RegExp(file.replace('.', '\\.\'), 'g')) || []).length, 1, `${label} must be wired exactly once`);
}
assert.ok(strategySource.indexOf(actionsLoader) < strategySource.indexOf(decisionMemoLoader), 'the board memo must load after Phase 8C-15 actions');
assert.ok(strategySource.indexOf(decisionMemoLoader) < strategySource.indexOf(stressLoader), 'the stress test must load after the board memo');
assert.ok(strategySource.indexOf(stressLoader) < strategySource.indexOf(resilienceLoader), 'the resilience memo must load after the stress test');
assert.ok(strategySource.indexOf(resilienceLoader) < strategySource.indexOf(recoveryAuditLoader), 'the recovery audit must load after resilience planning');
assert.ok(strategySource.indexOf(recoveryAuditLoader) < strategySource.indexOf(recoveryFundingLoader), 'the recovery funding plan must load after the recovery audit');
assert.ok(strategySource.indexOf(recoveryFundingLoader) < strategySource.indexOf(recoveryFundingOptionsLoader), 'the recovery funding options must load after the recovery funding plan');
assert.ok(strategySource.indexOf(recoveryFundingOptionsLoader) < strategySource.indexOf(recoveryFundingReadinessLoader), 'funding readiness must load after the option matrix');
assert.ok(strategySource.indexOf(recoveryFundingReadinessLoader) < strategySource.indexOf(recoveryFundingReconciliationLoader), 'funding reconciliation must load after readiness');

const load = loadGame();
const { modules, ctx } = load;
for (const file of ['player-debt-service.js','treasury-prepayment.js','capital-allocation-forecast.js','capital-allocation-actions.js','capital-allocation-decision-memo.js','capital-allocation-stress-test.js','capital-allocation-resilience-memo.js','capital-allocation-recovery-audit.js','capital-allocation-recovery-funding.js','capital-allocation-recovery-funding-options.js','capital-allocation-recovery-funding-readiness.js','capital-allocation-recovery-funding-reconciliation.js']) {
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

console.log('capital allocation production wiring tests passed');
