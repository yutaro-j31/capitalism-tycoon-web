'use strict';

// 事業再生ファンド (js/player-crisis-turnaround-fund.js): the last-resort crisis rescue lever.
//
// Unlike the sponsor injection (js/player-crisis-actions.js), which is unconditional equity at a
// 40% discount, the fund puts in more money at a steeper 25% discount AND imposes conditions: it
// mandatorily starts the existing turnaround plan (js/player-turnaround-plan.js) with a raised
// cash target, and if that plan fails a ratchet hands it a further 15% of the company for free.
//
// Two things these tests pin down that were found and fixed during implementation:
//   1. The plan's default cash target is the reserve threshold, which the fund's OWN injection
//      clears immediately -- leaving the conditions satisfied before any recovery and the ratchet
//      unreachable. The fund raises the target by its injection amount so the company must
//      genuinely earn the money back.
//   2. A distressed company can be worth so little that the injection prices out at ~94% of the
//      equity, wiping out the founder. MAX_INITIAL_EQUITY caps the initial stake at 60%.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, findStateIssues } = require('./harness');

function lcg(seed = 7) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

// Hand-built distressed fixture, matching tests/player-crisis-actions-test.js's crisisState().
// Used for single-action assertions; accounting is validated immediately after the action.
function crisisGame({ cash = -3_000_000, propertyValue = 100_000_000, seed = 7 } = {}) {
  const loaded = loadGame({ random: lcg(seed), headless: true });
  const { engine, finance, playerCrisis } = loaded.modules;
  const state = engine.createInitialState({ configured: true });
  state.week = 2;
  state.companyCash = cash;
  state.companyCredit = 80;
  if (propertyValue > 0) {
    const property = state.properties[0];
    property.owner = 'company';
    property.purchasePrice = propertyValue;
    property.price = propertyValue;
    property.value = propertyValue;
  }
  state.finance = finance.defaultFinanceState(state);
  playerCrisis.evaluate(state);
  return { loaded, e: new engine.TycoonEngine(state) };
}

// Fully configured game, for multi-week runs where the finance ledger must stay consistent.
// (The hand-built fixture above drifts over many advanceWeek() calls regardless of this feature,
// so long-horizon accounting is checked here instead.)
function configuredCrisisGame({ seed = 11 } = {}) {
  const loaded = loadGame({ random: lcg(seed), headless: true });
  const e = new loaded.engineModule.TycoonEngine();
  e.configure({ playerName: 'P', companyName: 'C', difficulty: 'normal', scenario: 'free' });
  e.g.companyCash = -4_000_000;
  e.g.finance = loaded.modules.finance.defaultFinanceState(e.g);
  e.advanceWeek(false);
  return { loaded, e };
}

// 1. Registered like every other crisis module, with the documented constants.
{
  const { loaded } = crisisGame();
  const fund = loaded.modules.playerCrisisTurnaroundFund;
  assert.ok(fund?.__installed, 'playerCrisisTurnaroundFund モジュールが登録されている');
  assert.equal(loaded.modules.engine.TycoonEngine.prototype.__playerCrisisTurnaroundFundInstalled, true);
  assert.equal(fund.FUND_VALUATION_DISCOUNT, .25, 'スポンサー出資(.40)より厳しいディスカウント');
  assert.equal(fund.RATCHET_EQUITY, .15);
  assert.equal(fund.MAX_INITIAL_EQUITY, .6);
  assert.deepEqual([...fund.ELIGIBLE_STATUSES], ['distressed'], '最終手段なので資金繰り危機時のみ');
}

// 2. Pricing is a fixed discount off companyValue() with no dice roll, and the plan target is
// raised by the injection amount.
{
  const { loaded, e } = crisisGame();
  const fund = loaded.modules.playerCrisisTurnaroundFund;
  const options = e.turnaroundFundOptions();
  assert.equal(options.canAccept, true);
  assert.equal(options.preMoneyValuation, Math.max(1_000_000, Math.round(e.companyValue() * fund.FUND_VALUATION_DISCOUNT)));
  assert.ok(options.amount >= fund.MIN_INJECTION);
  assert.equal(options.targetCash, loaded.modules.playerCrisis.reserveThreshold(e.g) + options.amount,
    '再建目標は「準備額＋出資額」= 出資金を自力で稼ぎ戻すこと');
  // Same inputs must quote identically -- nothing here consumes randomness.
  assert.deepEqual(e.turnaroundFundOptions(), options);
}

// 3. Accepting: cash in, shares issued, founder diluted, NO new debt, equity financing recorded,
// and the mandatory plan started with the raised target.
{
  const { loaded, e } = crisisGame();
  const options = e.turnaroundFundOptions();
  const sharesBefore = e.g.sharesOut, founderSharesBefore = e.g.founderShares;
  const ratioBefore = e.g.founderOwnershipRatio, cashBefore = e.g.companyCash, debtBefore = e.g.companyDebt;
  assert.equal(e.acceptTurnaroundFund(), true);
  assert.equal(e.g.companyCash, cashBefore + options.amount, '出資額は全額会社資金へ入る');
  assert.equal(e.g.companyDebt, debtBefore, '出資なので負債は増えない');
  assert.equal(e.g.sharesOut, sharesBefore + options.shares);
  assert.equal(e.g.founderShares, founderSharesBefore, '創業者の株数自体は減らない（希薄化のみ）');
  assert.ok(e.g.founderOwnershipRatio < ratioBefore, '創業者持分が希薄化する');
  const txn = e.g.finance.transactions.find(row => row.sourceType === 'playerCrisisTurnaroundFund');
  assert.ok(txn, 'equityFinancing取引が記録される');
  assert.equal(txn.category, 'equityFinancing');
  assert.equal(txn.cashEffect, options.amount);
  assert.equal(txn.equityEffect, options.amount);
  assert.equal(loaded.modules.finance.validate(e.g).ok, true, loaded.modules.finance.validate(e.g).errors.join(' / '));
  const plan = e.turnaroundPlanSnapshot();
  assert.equal(plan.status, 'active', 'ファンドは再建計画を強制的に開始する');
  assert.equal(e.turnaroundFundSnapshot().planID, plan.planID);
  assert.ok(plan.targetCash > e.g.companyCash, '目標は注入直後の残高より上（自力回復が必要）');
}

// 4. The initial stake is capped, so a near-worthless company does not cost the founder
// everything.
{
  const { loaded, e } = configuredCrisisGame();
  const fund = loaded.modules.playerCrisisTurnaroundFund;
  const options = e.turnaroundFundOptions();
  assert.ok(e.companyValue() * fund.FUND_VALUATION_DISCOUNT < options.amount,
    'テスト前提: 無制限なら100%近い希薄化になる評価額');
  assert.equal(Number(options.equity.toFixed(6)), fund.MAX_INITIAL_EQUITY, '初回持分は上限で頭打ち');
  assert.equal(e.acceptTurnaroundFund(), true);
  assert.equal(Number(e.g.founderOwnershipRatio.toFixed(6)), 1 - fund.MAX_INITIAL_EQUITY);
}

// 5. Success path: meeting the raised target exits the fund with no further dilution.
{
  const { loaded, e } = crisisGame();
  e.acceptTurnaroundFund();
  const ratioAfterAccept = e.g.founderOwnershipRatio, sharesAfterAccept = e.g.sharesOut;
  e.g.companyCash = e.turnaroundPlanSnapshot().targetCash + 1_000_000; // genuine recovery
  e.advanceWeek(false);
  assert.equal(e.turnaroundPlanSnapshot().status, 'completed');
  assert.equal(e.turnaroundFundSnapshot().status, 'exited');
  assert.equal(e.turnaroundFundSnapshot().ratchetShares, 0, '達成すれば追加譲渡はない');
  assert.equal(e.g.sharesOut, sharesAfterAccept, '新株の追加発行なし');
  assert.equal(e.g.founderOwnershipRatio, ratioAfterAccept, '持分はそのまま');
  assert.ok(e.g.playerTurnaroundFund.history.some(row => row.type === 'exited'));
}

// 6. Failure path: missing the target fires the ratchet and dilutes the founder further.
{
  const { loaded, e } = crisisGame();
  e.acceptTurnaroundFund();
  const ratioAfterAccept = e.g.founderOwnershipRatio, sharesAfterAccept = e.g.sharesOut;
  const heldCash = e.g.companyCash;
  for (let week = 0; week < 12; week++) { e.g.companyCash = heldCash; e.advanceWeek(false); } // never earns it back
  assert.equal(e.turnaroundPlanSnapshot().status, 'failed');
  const snapshot = e.turnaroundFundSnapshot();
  assert.equal(snapshot.status, 'ratcheted');
  assert.ok(snapshot.ratchetShares > 0, '未達なら追加株式を無償譲渡する');
  assert.equal(e.g.sharesOut, sharesAfterAccept + snapshot.ratchetShares);
  assert.ok(e.g.founderOwnershipRatio < ratioAfterAccept, '創業者持分がさらに希薄化する');
  assert.ok(e.g.playerTurnaroundFund.history.some(row => row.type === 'ratcheted'));
  // The ratchet issues shares only -- it moves no cash, so it must not touch the finance ledger.
  assert.equal(e.g.finance.transactions.filter(row => row.sourceType === 'playerCrisisTurnaroundFund').length, 1,
    '無償の追加発行は会計イベントを発生させない（現金移動なし）');
}

// 7. Eligibility: distressed only, never while already active, never public, never after game over.
{
  for (const status of ['watch', 'turnaround', 'recovered', 'stable']) {
    const { e } = crisisGame();
    e.g.playerCrisis.status = status;
    e.g.playerCrisis.lastEvaluationWeek = e.g.week;
    assert.equal(e.turnaroundFundOptions().canAccept, false, `${status}では利用不可`);
    assert.equal(e.acceptTurnaroundFund(), false);
  }
  const active = crisisGame().e;
  assert.equal(active.acceptTurnaroundFund(), true);
  const sharesAfterFirst = active.g.sharesOut;
  assert.equal(active.acceptTurnaroundFund(), false, '再建期間中は二重に受け入れられない');
  assert.equal(active.g.sharesOut, sharesAfterFirst);

  const listed = crisisGame().e;
  listed.g.publicCompany = true;
  assert.equal(listed.turnaroundFundOptions().canAccept, false, '上場後は利用不可');
  assert.equal(listed.acceptTurnaroundFund(), false);

  const over = crisisGame().e;
  over.g.gameOver = true;
  assert.equal(over.turnaroundFundOptions().canAccept, false);
  assert.equal(over.acceptTurnaroundFund(), false);
}

// 8. Determinism: no Math.random anywhere in quoting, accepting, or settling.
{
  const { loaded, e } = crisisGame();
  let calls = 0;
  const original = loaded.ctx.Math.random;
  loaded.ctx.Math.random = () => { calls++; return original(); };
  e.turnaroundFundOptions();
  e.acceptTurnaroundFund();
  loaded.modules.playerCrisisTurnaroundFund.settle(e);
  loaded.ctx.Math.random = original;
  assert.equal(calls, 0, '事業再生ファンドはMath.randomを一切消費しない');
}

// 9. Old saves without the field normalize safely, and a live fund survives save/reload.
{
  const { loaded, e } = crisisGame();
  delete e.g.playerTurnaroundFund;
  const normalized = loaded.modules.playerCrisisTurnaroundFund.ensure(e.g);
  assert.equal(normalized.status, 'none');
  assert.equal(normalized.history.length, 0);
  assert.equal(normalized.investedWeek, null);
  for (const malformed of [null, 'bad', 42, { status: 'nope', shares: -5, history: 'x' }]) {
    e.g.playerTurnaroundFund = malformed;
    const row = loaded.modules.playerCrisisTurnaroundFund.ensure(e.g);
    assert.ok(loaded.modules.playerCrisisTurnaroundFund.STATUSES.includes(row.status));
    assert.ok(Number.isFinite(row.shares) && row.shares >= 0);
    assert.ok(Array.isArray(row.history));
  }

  const { loaded: savedLoaded, e: saveGame } = crisisGame({ seed: 99 });
  assert.equal(saveGame.acceptTurnaroundFund(), true);
  assert.equal(saveGame.save(), true);
  const saved = JSON.parse(savedLoaded.ctx.__localStorageData.get(savedLoaded.modules.engine.SAVE_KEY));
  assert.ok(saved.playerTurnaroundFund);
  const restored = new savedLoaded.modules.engine.TycoonEngine(saved);
  assert.equal(restored.g.playerTurnaroundFund.status, 'active');
  assert.equal(restored.g.playerTurnaroundFund.planID, saveGame.g.playerTurnaroundFund.planID);
  assert.equal(savedLoaded.modules.finance.validate(restored.g).ok, true);
  assert.deepEqual(findStateIssues(restored.g), []);
  assert.equal(savedLoaded.modules.playerCrisisTurnaroundFund.validate(restored.g), true);
}

// 10. Long-horizon accounting stays consistent on a properly configured game.
{
  const { loaded, e } = configuredCrisisGame({ seed: 23 });
  assert.equal(e.acceptTurnaroundFund(), true);
  assert.equal(loaded.modules.finance.validate(e.g).ok, true, '受け入れ直後の会計整合性');
  for (let week = 0; week < 15; week++) e.advanceWeek(false);
  const validation = loaded.modules.finance.validate(e.g);
  assert.equal(validation.ok, true, validation.errors.join(' / '));
  assert.deepEqual(findStateIssues(e.g), []);
  assert.ok(['exited', 'ratcheted'].includes(e.turnaroundFundSnapshot().status), '期限内に決着する');
}

// 11. UI wiring: one new action on the existing crisis panel, no new screen.
{
  const ui = fs.readFileSync(path.join(__dirname, '..', 'js', 'player-crisis-ui.js'), 'utf8');
  assert.match(ui, /事業再生ファンド/);
  // button() builds the data-player-crisis-action attribute from its action argument, so the
  // action name appears twice in source: the button() call and the dispatcher branch.
  assert.equal((ui.match(/'turnaround-fund'/g) || []).length, 2, 'ボタン1箇所＋dispatcher1箇所');
  assert.equal((ui.match(/'sponsor-injection'/g) || []).length, 2, '既存のスポンサー出資アクションは変更していない');
}

// 12. index.html and the module load order register the new script after its dependencies.
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /player-crisis-turnaround-fund\.js/);
  const order = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'module-load-order.json'), 'utf8')).scripts;
  const fundIndex = order.indexOf('./js/player-crisis-turnaround-fund.js');
  assert.ok(fundIndex > order.indexOf('./js/player-turnaround-plan.js'), 'player-turnaround-plan.jsより後');
  assert.ok(fundIndex > order.indexOf('./js/player-crisis-actions.js'), 'player-crisis-actions.jsより後');
}

console.log('player crisis turnaround fund tests passed');
