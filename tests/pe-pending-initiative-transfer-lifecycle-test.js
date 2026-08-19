'use strict';

// Follow-up to tests/pe-pending-initiative-exit-lifecycle-test.js -- that audit's item 8
// ("subsidiary conversionでも同じcleanup問題がないか") turned up a DIFFERENT bug from EXIT's,
// specific to transferPEDealToCompany (自社グループへ移管).
//
// transferPEDealToCompany doesn't end the deal -- ownerAccount changes but status stays
// 'active', so a pending initiative keeps resolving normally afterward and there is no
// orphaned-state problem like EXIT had. But activeInitiativeCount() recomputes live from
// deal.ownerAccount, and transferPEDealToCompany changed that field immediately: the
// instant a deal became 'company', it stopped counting against the 'personal' concurrency
// cap it was still occupying for an unresolved initiative. A player (or a company with
// enough cash to keep buying deals off itself) could chain
//   commit on personal deal A (uses the personal slot)
//   -> transferPEDealToCompany(A) (frees the personal slot immediately, A still pending)
//   -> commit on personal deal B (uses the personal slot again)
// and repeat indefinitely, exceeding MAX_CONCURRENT_INITIATIVES.personal and defeating the
// entire point of the cap: modeling "limited management attention" as a real, contested,
// per-account resource (see js/pe-value-creation.js's R2 comment above
// MAX_CONCURRENT_INITIATIVES).
//
// Fix mirrors the EXIT guard: transferPEDealToCompany now refuses while the deal has a
// pendingInitiative, with the same "wait for the decision" framing.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

// 0. The transfer button itself must be disabled while an initiative is pending, same as
// the EXIT button already is.
{
  const appSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const transferButtonLine = appSrc.split('\n').find(line => line.includes("'transfer-pe'"));
  assert.ok(transferButtonLine, '移管ボタンの定義が見つかる');
  assert.match(transferButtonLine, /disabled:Boolean\(plan\?\.pending\)/, '移管ボタンはpending中は無効化される');
}

function lcg(seed = 260819701) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260819701) {
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

function commitInitiative(engine, deal) {
  const plan = engine.peValueCreationPlan(deal.id);
  assert.equal(plan.pending, null, '前提: まだ何も進行中でない');
  assert.equal(engine.applyPEInitiative(deal.id, plan.issue.initiativeID), true);
  assert.ok(deal.pendingInitiative);
  return deal.pendingInitiative;
}

// 1. The core exploit: transferring a deal mid-flight must not free its concurrency slot.
{
  const { engine, modules } = newGame();
  enableCompanyPE(engine, modules);

  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const dealA = engine.g.peDeals.find(d => d.status === 'active');
  commitInitiative(engine, dealA);
  assert.equal(modules.peValueCreation.activeInitiativeCount(engine.g, 'personal', null), 1, '個人枠1/1を使用中');

  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const dealB = engine.g.peDeals.find(d => d.status === 'active' && d.id !== dealA.id);
  const blockedBefore = engine.peValueCreationPlan(dealB.id).blockedReason;
  assert.ok(blockedBefore, '修正前の時点でも2件目は個人枠不足でブロックされる（前提確認）');

  assert.equal(engine.transferPEDealToCompany(dealA.id), false, 'pending中の移管は拒否される');
  assert.equal(dealA.ownerAccount, 'personal', '拒否後もownerAccountは変わらない');
  assert.equal(modules.peValueCreation.activeInitiativeCount(engine.g, 'personal', null), 1, '個人枠は空かない');

  const stillBlocked = engine.peValueCreationPlan(dealB.id).blockedReason;
  assert.ok(stillBlocked, '2件目は依然としてブロックされる（抜け穴が塞がっている）');
  assert.equal(engine.applyPEInitiative(dealB.id, engine.peValueCreationPlan(dealB.id).issue.initiativeID), false, '2件目の施策は着手できない');
}

// 2. Once the pending initiative resolves, transfer works normally again.
{
  const { engine, modules } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  const pending = commitInitiative(engine, deal);

  assert.equal(engine.transferPEDealToCompany(deal.id), false, '解決前は移管不可');
  while (engine.g.week < pending.resolveWeek) assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(deal.pendingInitiative, null, '週が進むと自動的に解決される');

  assert.equal(engine.transferPEDealToCompany(deal.id), true, '解決後は移管できる');
  assert.equal(deal.ownerAccount, 'company');
}

// 3. A normal transfer (no initiative ever committed) is completely unaffected.
{
  const { engine, modules } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  assert.equal(deal.pendingInitiative, undefined);
  assert.equal(engine.transferPEDealToCompany(deal.id), true, '何も進行中でなければ従来どおり移管できる');
  assert.equal(deal.ownerAccount, 'company');
}

// 4. A pending initiative committed AFTER a (successful, unblocked) transfer still
// resolves normally on the company side -- the guard must not disturb the deal once it is
// legitimately on the company account.
{
  const { engine, modules } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  assert.equal(engine.transferPEDealToCompany(deal.id), true);

  const pending = commitInitiative(engine, deal);
  assert.equal(engine.g.finance.transactions.length > 0, true, '会社保有分の施策費用は台帳に記帳される');
  while (engine.g.week < pending.resolveWeek) assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(deal.pendingInitiative, null, '移管後に着手した施策も正常に解決する');
  assert.equal(modules.finance.validate(engine.g).ok, true);
}

// 5. Rejected transfer moves no cash on either side, and rejects with no company ledger
// entry -- a blocked action must be a true no-op, not a partial one.
{
  const { engine, modules } = newGame();
  enableCompanyPE(engine, modules);
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  commitInitiative(engine, deal);

  const companyCashBefore = engine.g.companyCash;
  const personalCashBefore = engine.g.personalCash;
  const ledgerBefore = engine.g.finance.transactions.length;
  assert.equal(engine.transferPEDealToCompany(deal.id), false);
  assert.equal(engine.g.companyCash, companyCashBefore);
  assert.equal(engine.g.personalCash, personalCashBefore);
  assert.equal(engine.g.finance.transactions.length, ledgerBefore, '拒否された移管は台帳に記帳しない');
}

// 6. Save/reload: the guard's condition (deal.pendingInitiative) must survive a round trip
// on a deal still sitting on the personal account.
{
  const { engine, modules } = newGame();
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  commitInitiative(engine, deal);
  engine.save();

  const reloaded = modules.engine.TycoonEngine.load();
  const reloadedDeal = reloaded.g.peDeals.find(d => String(d.id) === String(deal.id));
  assert.ok(reloadedDeal.pendingInitiative);
  assert.equal(reloaded.transferPEDealToCompany(reloadedDeal.id), false, 'reload後も同じ理由で移管が拒否される');
  assert.equal(reloaded.g.saveVersion, 9);
}

// 7. Determinism / RNG budget: a rejected transfer draws no random numbers.
{
  const { engine } = newGame();
  assert.equal(engine.createPEDeal('tech', 20_000_000, 'personal'), true);
  const deal = engine.g.peDeals.find(d => d.status === 'active');
  commitInitiative(engine, deal);

  let calls = 0;
  const originalRandom = Math.random;
  Math.random = () => { calls++; return originalRandom(); };
  try {
    assert.equal(engine.transferPEDealToCompany(deal.id), false);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(calls, 0, '拒否される移管はMath.randomを消費しない');
}

console.log('PE pending initiative transfer lifecycle tests passed');
