'use strict';

// docs/feature-requests.md monitoring item: "pendingInitiativeを持つPE dealを完了前に
// EXITすると、inactive/exited deal上にpending stateが残る" -- audited and reproduced.
//
// Before this fix, exitPEDeal never checked deal.pendingInitiative. Exiting mid-flight:
//   - forfeited the already-paid initiative fee and the already-decided outcome (the
//     success/failure roll is locked in at commit time, only its reveal is delayed) with
//     no block and no confirmation beyond the "進行中" notice text, and
//   - left deal.pendingInitiative permanently set on a deal whose status is 'exited',
//     never cleared, forever serialized into every future save.
// Nothing currently misreads that stale field -- every reader (resolvePendingInitiatives,
// activeInitiativeCount, findDeal, the render filter) filters on status==='active' -- so it
// was inert rather than a live leak. But it is exactly the class of bug this codebase has
// hit before (js/real-estate-complete-cycle.js's g.realEstateCycle collision): a broken
// invariant that throws nothing and just sits there wrong, one future non-filtering reader
// away from becoming a real one.
//
// The fix mirrors the rule applicable() already enforces against committing a SECOND
// initiative on top of a pending one: EXIT now blocks while an initiative is in flight,
// with the same "wait for the decision" framing, so pendingInitiative can now only ever
// exist on an active, resolvable deal.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

// 0. The EXIT button itself must be disabled while an initiative is pending -- the engine
// guard alone would leave a clickable button that always fails, which is worse than not
// having the guard visibly reflected in the UI at all.
{
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const exitButtonLine = appSrc.split('\n').find(line => line.includes("'exit-pe'"));
  assert.ok(exitButtonLine, 'EXITボタンの定義が見つかる');
  assert.match(exitButtonLine, /disabled:Boolean\(plan\?\.pending\)/, 'EXITボタンはpending中は無効化される');
}

function lcg(seed = 260819501) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819501) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 500_000_000;
  return { modules, ctx, engine };
}

function enableCompanyPE(engine, modules) {
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  assert.equal(engine.establishDepartment('investment'), true);
  engine.g.companyCash = 500_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
}

function commitInitiative(engine, modules, deal) {
  const plan = engine.peValueCreationPlan(deal.id);
  assert.equal(plan.pending, null, '前提: まだ何も進行中でない');
  assert.equal(engine.applyPEInitiative(deal.id, plan.issue.initiativeID), true);
  assert.ok(deal.pendingInitiative, '施策がpendingInitiativeとして記録される');
  return deal.pendingInitiative;
}

// 1. EXIT is blocked while an initiative is in flight (personal deal).
{
  const { engine } = newGame();
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  const cashAfterCommit = (() => { commitInitiative(engine, null, deal); return engine.g.personalCash; })();

  assert.equal(engine.exitPEDeal(deal.id), false, 'pending中はEXITが拒否される');
  assert.equal(deal.status, 'active', '拒否後もdealはactiveのまま');
  assert.ok(deal.pendingInitiative, 'pendingInitiativeは残る（消えていない）');
  assert.equal(engine.g.personalCash, cashAfterCommit, '拒否されたEXITは現金を動かさない');
}

// 2. Once the pending initiative resolves, EXIT works normally again -- the block is
// specific to the in-flight window, not a permanent lock on the deal.
{
  const { engine, modules } = newGame();
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  const pending = commitInitiative(engine, modules, deal);

  assert.equal(engine.exitPEDeal(deal.id), false, '解決前はEXIT不可');
  while (engine.g.week < pending.resolveWeek) assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(deal.pendingInitiative, null, '週が進むと自動的に解決される');

  const cashBefore = engine.g.personalCash;
  assert.equal(engine.exitPEDeal(deal.id), true, '解決後はEXITできる');
  assert.equal(deal.status, 'exited');
  assert.notEqual(engine.g.personalCash, cashBefore, 'EXITで現金が動く');
}

// 3. A normal EXIT (no initiative ever committed) is completely unaffected by the guard.
{
  const { engine } = newGame();
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  assert.equal(deal.pendingInitiative, undefined);
  assert.equal(engine.exitPEDeal(deal.id), true, '何も進行中でなければ従来どおりEXITできる');
  assert.equal(deal.status, 'exited');
}

// 4. The company-owned path is guarded the same way, and the company ledger is untouched
// by a rejected EXIT (company/personal separation must survive a blocked action too).
{
  const { engine, modules } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'company'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active' && d.ownerAccount === 'company');
  commitInitiative(engine, modules, deal);

  const companyCashBefore = engine.g.companyCash;
  const personalCashBefore = engine.g.personalCash;
  const ledgerEventsBefore = engine.g.finance.transactions.length;
  assert.equal(engine.exitPEDeal(deal.id), false, '会社保有dealも同じ理由で拒否される');
  assert.equal(deal.status, 'active');
  assert.equal(engine.g.companyCash, companyCashBefore, '拒否されたEXITは会社資金を動かさない');
  assert.equal(engine.g.personalCash, personalCashBefore, '個人資金にも副作用がない');
  assert.equal(engine.g.finance.transactions.length, ledgerEventsBefore, '拒否されたEXITは台帳に記帳しない');
  assert.equal(modules.finance.validate(engine.g).ok, true);
}

// 5. Once the guard existed to check, it also had to survive save/reload: pendingInitiative
// on an active deal must round-trip, and the deal must still be un-exitable after reload.
{
  const { engine, modules } = newGame();
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  commitInitiative(engine, modules, deal);
  engine.save();

  const reloaded = modules.engine.TycoonEngine.load();
  const reloadedDeal = reloaded.g.peDeals.find(d => String(d.id) === String(deal.id));
  assert.ok(reloadedDeal.pendingInitiative, 'reload後もpendingInitiativeが残る');
  assert.equal(reloaded.exitPEDeal(reloadedDeal.id), false, 'reload後も同じ理由でEXITが拒否される');
  assert.equal(reloaded.g.saveVersion, 9);
}

// 6. The already-existing new-initiative gate and the new EXIT gate share the same
// underlying field without interfering with each other: rejecting EXIT must not somehow
// clear or duplicate pendingInitiative, and a second initiative attempt is still rejected
// too (applicable()'s pre-existing rule, unrelated to this fix but must survive it).
{
  const { engine, modules } = newGame();
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  const pending = commitInitiative(engine, modules, deal);

  assert.equal(engine.exitPEDeal(deal.id), false);
  assert.deepEqual(deal.pendingInitiative, pending, 'EXIT拒否はpendingInitiativeの中身を変えない');
  const plan = engine.peValueCreationPlan(deal.id);
  assert.equal(engine.applyPEInitiative(deal.id, plan.initiatives[0].id), false, '2件目の施策も従来どおり拒否される');
  assert.deepEqual(deal.pendingInitiative, pending, '2件目の拒否後もpendingInitiativeの中身は同じ');
}

// 7. Determinism / RNG budget: this is a gate on an existing action, not a new model.
// Rejecting an EXIT must draw no random numbers and must not change week-52 determinism
// for a run that never touches the gate.
{
  function run() {
    const { engine } = newGame(31415);
    for (let i = 0; i < 20; i++) engine.advanceWeek(false);
    return JSON.stringify({ cash: engine.g.personalCash, week: engine.g.week });
  }
  assert.equal(run(), run(), '同じseedで同じ結果になる');

  const { engine } = newGame();
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  commitInitiative(engine, null, deal);

  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    assert.equal(engine.exitPEDeal(deal.id), false);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, '拒否されるEXITはMath.randomを消費しない');
}

console.log('PE pending initiative EXIT lifecycle tests passed');
