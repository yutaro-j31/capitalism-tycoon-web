'use strict';
// P3-4 W-PE-FORM: the installed formPEFund, now one transaction, forming Fund I from a PE firm with a recorded track
// record. Every save fault rolls back the whole formation (GP commitment, fund, LP commitments, news, RNG, mirror,
// cache and durable bytes); recovery and retry sequences are monotonic; the retry equals the uninterrupted formation;
// a second fund cannot be formed before Fund I meets the follow-on conditions. Node/fake-IDB; WebKit is separate.
const assert = require('node:assert/strict');
const { fixture, command, snapshot, economic, VARIANTS } = require('./fixtures/pe-fund-formation-atomicity');
const { makeTransactionFaultCase, FAULT_KINDS } = require('./helpers/transaction-fault-case');
const json = value => JSON.parse(JSON.stringify(value));
const CHANGED = ['personalCash', 'news', 'peFirm', 'lastSaveDate', 'saveSequence'];

function success(before, after, s) {
  // The plan is the installed read-only preview before the command; the oracle checks the formation against it and the
  // cash conservation that tests/pe-fund-formation-test.js states.
  const plan = s.plan;
  assert.equal(after.peFirm.funds.length, before.peFirm.funds.length + 1, 'exactly one new fund');
  const fund = after.peFirm.funds.at(-1);
  assert.equal(fund.size, plan.size); assert.equal(fund.gpCommit, plan.gpCommit);
  assert.equal(fund.lpContributed, fund.size - fund.gpCommit, 'LP contribution is size minus GP commitment');
  assert.equal(fund.cash, fund.gpCommit + fund.lpContributed, 'fund cash comes only from GP and LP contributions');
  assert.equal(after.personalCash, before.personalCash - fund.gpCommit, 'the GP commitment leaves personal cash');
  assert.equal(after.companyCash, before.companyCash, 'company cash is untouched');
  assert.ok(Array.isArray(fund.lps) && fund.lps.length > 0, 'LP commitments recorded');
  assert.deepEqual(json(fund.terms), json(plan.terms), 'planned terms');
  assert.deepEqual(json(after.peFirm.funds.slice(0, -1)), json(before.peFirm.funds), 'existing funds untouched');
  assert.deepEqual(json(after.finance), json(before.finance), 'company ledger untouched');
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)]))
    if (!CHANGED.includes(key)) assert.deepEqual(json(after[key]), json(before[key]), `${key} untouched`);
  assert.equal(s.modules.finance.validate(json(after)).ok, true);
}
const planned = async variant => { const s = await fixture(variant); s.plan = json(s.game.formablePEFund(s.options)); assert.equal(s.plan.ok, true); return s; };

(async () => {
  const harness = makeTransactionFaultCase({ name: 'PE fund formation', fixture: planned, command, snapshot, economic, expectSuccess: success });
  for (const variant of Object.keys(VARIANTS)) {
    for (const kind of FAULT_KINDS) await harness.rejected(variant, kind);
    const s = await planned(variant), before = snapshot(s.game), events = [], emit = s.game.emit, save = s.game.save;
    let saves = 0;
    s.game.emit = function (type = 'change', ...args) { events.push(type); return emit.call(this, type, ...args); };
    s.game.save = function (...args) { if (!this.inTransaction()) saves++; return save.apply(this, args); };
    assert.equal(command(s), true); s.game.emit = emit; s.game.save = save;
    assert.deepEqual(events, ['notify', 'saved', 'change']); assert.equal(saves, 1);
    const done = snapshot(s.game); success(before, done, s);
    await s.backend.flush(); await harness.loaded(s, s.game.g);
    const replay = await planned(variant); assert.equal(command(replay), true);
    assert.deepEqual(economic(replay.game.g), economic(s.game.g), 'deterministic formation');
    {
      const state = economic(snapshot(s.game)), bytes = s.backend.readSync(s.key), inner = s.game.save;
      let refusedSaves = 0;
      s.game.save = function (...args) { if (!this.inTransaction()) refusedSaves++; return inner.apply(this, args); };
      assert.equal(command(s), false, 'Fund II is refused before Fund I meets the follow-on conditions'); s.game.save = inner;
      assert.deepEqual(economic(snapshot(s.game)), state); assert.equal(refusedSaves, 0);
      await s.backend.flush(); assert.equal(s.backend.readSync(s.key), bytes);
    }
    const compact = s.modules.saveStorage.compactStateForStorage(done, 'critical').state;
    const restored = new s.engineModule.TycoonEngine(json(compact)), fund = done.peFirm.funds.at(-1), kept = restored.g.peFirm.funds.at(-1);
    for (const field of ['id', 'size', 'gpCommit', 'lpContributed', 'cash']) assert.equal(kept[field], fund[field], field);
    assert.equal(restored.g.personalCash, done.personalCash); assert.equal(restored.g.saveVersion, 9);
  }
  for (const kind of ['save-false', 'save-throw']) for (const options of [{ pending: true }, { nested: true }])
    await harness.rejected('custom', kind, options);
  const broken = makeTransactionFaultCase({ name: 'broken PE fund formation rollback', fixture: async variant => {
    const s = await planned(variant); s.game.restoreTransactionSnapshot = () => {}; return s;
  }, command, snapshot, economic, expectSuccess: success });
  await assert.rejects(broken.rejected('maximum', 'save-false'), /full live rollback/);
  const wrong = await planned('maximum'), before = snapshot(wrong.game); assert.equal(command(wrong), true);
  const cash = snapshot(wrong.game); cash.personalCash += 1;
  assert.throws(() => success(before, cash, wrong), /GP commitment leaves personal cash/);
  const lp = snapshot(wrong.game); lp.peFirm.funds.at(-1).lpContributed -= 1;
  assert.throws(() => success(before, lp, wrong), /LP contribution is size minus GP commitment/);
  console.log('PE fund formation save-fault evidence PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
