'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Engine {
  constructor(state) {
    this.g = state;
    this.notifications = [];
    this.failures = [];
  }

  normalize() {}
  runTransaction(work) { return work(); }
  notify(message, type) { this.notifications.push({ message, type }); }
  fail(message) { this.failures.push(message); return false; }
}

const modules = {
  engine: { TycoonEngine: Engine },
  playerEngineBridge: { getEngine: () => null }
};

const context = {
  globalThis: { __capitalismTycoonModules: modules },
  console,
  queueMicrotask: callback => callback(),
  setTimeout
};

const source = fs.readFileSync(
  path.join(__dirname, '../js/board-governance-resolution.js'),
  'utf8'
);

vm.runInNewContext(source, context, {
  filename: 'board-governance-resolution.js'
});

const api = modules.boardGovernanceResolution;
assert.ok(api && api.__installed, 'board governance module must register');
assert.equal(api.VERSION, 1, 'module version must remain stable');
assert.equal(api.HISTORY_LIMIT, 120, 'resolution history must be bounded');

function createState(overrides = {}) {
  return {
    configured: true,
    selectedTab: 'finance',
    week: 20,
    companyCash: 100_000_000,
    personalCash: 12_000_000,
    companyDebt: 10_000_000,
    companyValue: 500_000_000,
    weeklyProfit: 1_500_000,
    growthRate: 0.12,
    ...overrides
  };
}

{
  const state = createState();
  api.ensure(state);
  assert.ok(state.boardGovernance, 'normalize must add boardGovernance');
  assert.equal(state.boardGovernance.version, 1);
  assert.equal(state.boardGovernance.members.length, 3, 'default board must have three members');
  assert.equal(
    state.boardGovernance.members.filter(member => member.independent).length,
    1,
    'default board must have one independent director'
  );
  assert.equal(state.boardGovernance.resolutions.length, 0);
  assert.equal(state.boardGovernance.nextResolutionID, 1);
}

{
  const first = createState();
  const second = JSON.parse(JSON.stringify(first));
  api.ensure(first);
  api.ensure(second);
  assert.deepEqual(
    api.evaluateProposal(first, 20_000_000),
    api.evaluateProposal(second, 20_000_000),
    'voting must be deterministic'
  );
}

{
  const original = createState();
  api.ensure(original);
  const before = api.evaluateProposal(original, 25_000_000);
  const restored = JSON.parse(JSON.stringify(original));
  api.ensure(restored);
  assert.deepEqual(
    api.evaluateProposal(restored, 25_000_000),
    before,
    'JSON round-trip must preserve deterministic result'
  );
}

{
  const state = createState();
  const companyCashBefore = state.companyCash;
  const personalCashBefore = state.personalCash;
  api.ensure(state);
  const result = api.submitResolution(state, 10_000_000);
  assert.equal(result.ok, true);
  assert.ok(result.resolution);
  assert.equal(
    result.resolution.votesFor + result.resolution.votesAgainst + result.resolution.abstentions,
    3,
    'every director must cast one vote'
  );
  assert.equal(state.companyCash, companyCashBefore, 'board decision must not move company cash');
  assert.equal(state.personalCash, personalCashBefore, 'board decision must not move personal cash');
}

{
  const state = createState();
  api.ensure(state);
  const result = api.submitResolution(state, 0);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid-amount');
  assert.equal(state.boardGovernance.resolutions.length, 0);
}

{
  const state = createState();
  api.ensure(state);
  assert.equal(api.submitResolution(state, 15_000_000).ok, true);
  const duplicate = api.submitResolution(state, 15_000_000);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.reason, 'duplicate-resolution');
  assert.equal(state.boardGovernance.resolutions.length, 1);
}

{
  const state = createState();
  api.ensure(state);
  assert.equal(api.submitResolution(state, 10_000_000).ok, true);
  assert.equal(api.submitResolution(state, 12_000_000).ok, true);
  assert.equal(state.boardGovernance.resolutions.length, 2);
}

{
  const state = createState();
  const engine = new Engine(state);
  engine.normalize();
  const companyCashBefore = state.companyCash;
  const personalCashBefore = state.personalCash;
  assert.equal(engine.submitGrowthInvestmentResolution(10_000_000), true);
  assert.equal(state.boardGovernance.resolutions.length, 1);
  assert.equal(state.companyCash, companyCashBefore);
  assert.equal(state.personalCash, personalCashBefore);
  assert.equal(engine.notifications.length, 1);
}

{
  const state = createState();
  api.ensure(state);
  const evaluation = api.evaluateProposal(state, 10_000_000);
  assert.equal(evaluation.proposal.requiredApprovalRatio, 2 / 3);
  assert.equal(evaluation.approved, evaluation.votesFor / 3 >= 2 / 3);
}

{
  const state = createState({
    companyCash: 5_000_000,
    companyDebt: 450_000_000,
    companyValue: 500_000_000,
    weeklyProfit: -2_000_000,
    growthRate: -0.25
  });
  api.ensure(state);
  const evaluation = api.evaluateProposal(state, 400_000_000);
  assert.ok(Number.isFinite(evaluation.approvalRatio));
  for (const vote of evaluation.memberVotes) {
    assert.ok(Number.isFinite(vote.score), 'vote score must remain finite');
  }
}

{
  const state = createState();
  api.ensure(state);
  for (let index = 0; index < 160; index += 1) {
    state.week = index + 1;
    assert.equal(api.submitResolution(state, 1_000_000 + index).ok, true);
  }
  assert.equal(state.boardGovernance.resolutions.length, 120);
  assert.equal(state.boardGovernance.resolutions[0].week, 41, 'oldest entries must be discarded');
}

{
  const state = createState();
  api.ensure(state);
  for (let week = 1; week <= 500; week += 1) {
    state.week = week;
    state.companyCash = 100_000_000 + week * 10_000;
    state.companyDebt = 10_000_000 + week * 1_000;
    state.weeklyProfit = 1_000_000 + week * 100;
    state.growthRate = ((week % 21) - 10) / 100;
    api.submitResolution(state, 2_000_000 + week);
  }
  const summary = api.summarize(state);
  assert.ok(Number.isFinite(summary.governanceQuality));
  assert.ok(summary.governanceQuality >= 0 && summary.governanceQuality <= 100);
  assert.ok(state.boardGovernance.resolutions.length <= 120);
  for (const resolution of state.boardGovernance.resolutions) {
    assert.ok(Number.isFinite(resolution.amount));
    assert.ok(Number.isFinite(resolution.governanceQualityAfter));
    assert.ok(Number.isFinite(resolution.companyCashSnapshot));
  }
}

{
  const state = createState();
  const engine = new Engine(state);
  engine.normalize();
  modules.playerEngineBridge.getEngine = () => engine;
  const html = api.renderSection(engine);
  assert.match(html, /data-board-governance-resolution/);
  assert.match(html, /data-board-resolution-submit/);
  assert.match(html, /min-height:44px/);
  assert.match(html, /3分の2以上/);
}

{
  assert.doesNotMatch(source, /Math\.random\s*\(/);
  assert.doesNotMatch(source, /Date\.now\s*\(/);
}

const index = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.match(
  index,
  /<script src="\.\/js\/player-engine-bridge\.js"><\/script><script src="\.\/js\/board-governance-resolution\.js"><\/script><script src="\.\/js\/internal-venture-business\.js"><\/script>/,
  'board governance module must be wired directly after player-engine-bridge.js'
);

console.log('board governance resolution tests passed');
