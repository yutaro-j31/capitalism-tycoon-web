'use strict';

// #776: in the production runtime a week advance is one transaction. Every advanceWeek wrapper,
// the delegated executive work and the final weekly boundary (accounting snapshot, crisis state,
// validation, weekly summary) run inside it. Before this, the outermost week transaction was
// opened by player-crisis.js, so 19 later-loaded wrappers and the final boundary ran outside it:
// an exception there left an advanced, partly processed week in memory and in the save.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const KEY = 'capitalism_tycoon_web_v1';

function lcg(seedValue) {
  let seed = seedValue >>> 0;
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
}

// Week 51 with a scheduled debt maturity at week 52: player-debt-service.js repays it from a
// wrapper that sits outside player-crisis.js's own transaction.
function maturityGame() {
  const loaded = loadGame({ random: lcg(0x74000001) });
  const { engineModule, modules } = loaded;
  const state = engineModule.createInitialState({ configured: true });
  state.week = 51;
  state.companyCash = 20_000_000;
  state.companyDebt = 100_000_000;
  state.companyCredit = 60;
  state.policyRate = 0.005;
  state.finance = modules.finance.defaultFinanceState(state);
  state.finance.debtRefinancing = { termWeeks:52, nextMaturityWeek:52, principalShare:.1, feeRate:.005, status:'scheduled', lastProcessedWeek:-1, history:[] };
  const game = new engineModule.TycoonEngine(state);
  assert.equal(Object.getPrototypeOf(game).advanceWeek.__canonicalNormalizeBoundary, true, 'full production runtime ends at the canonical week boundary');
  game.save();
  return { loaded, modules, game };
}

function observe(loaded, game) {
  return {
    state: JSON.stringify(game.g),
    saved: loaded.ctx.__localStorageData.get(KEY)
  };
}

// Throw once from the first finance call made inside a function whose name matches `where`.
function throwOnceFrom(modules, method, where) {
  const original = modules.finance[method];
  let thrown = 0;
  modules.finance[method] = function (...args) {
    if (!thrown && where.test(new Error().stack)) { thrown++; throw new Error(`synthetic failure in ${where}`); }
    return original.apply(this, args);
  };
  return () => thrown;
}

// 1. An exception in a wrapper outside player-crisis.js (debt maturity) rolls the whole week back.
{
  const { loaded, modules, game } = maturityGame();
  const before = observe(loaded, game);
  const thrown = throwOnceFrom(modules, 'event', /processDebtMaturity/);
  assert.throws(() => game.advanceWeek(false), /synthetic failure/);
  assert.equal(thrown(), 1, 'precondition: the debt-maturity wrapper ran and failed');
  const after = observe(loaded, game);
  assert.equal(game.g.week, 51, 'the week does not advance when an outer wrapper fails');
  assert.equal(after.state, before.state, 'the in-memory state is exactly the pre-week state');
  assert.equal(after.saved, before.saved, 'the save is not overwritten with a partly processed week');
}

// 2. An exception in the final weekly boundary rolls the whole week back as well.
{
  const { loaded, modules, game } = maturityGame();
  const before = observe(loaded, game);
  const thrown = throwOnceFrom(modules, 'rebuildSnapshotForWeek', /finalizeWeekBoundary/);
  assert.throws(() => game.advanceWeek(false), /synthetic failure/);
  assert.equal(thrown(), 1, 'precondition: the final weekly boundary ran and failed');
  const after = observe(loaded, game);
  assert.equal(game.g.week, 51, 'the week does not advance when finalization fails');
  assert.equal(after.state, before.state, 'the in-memory state is exactly the pre-week state');
  assert.equal(after.saved, before.saved, 'the save still holds the pre-week state');
}

// 3. Without a failure the same week commits once, finalized, and is saved.
{
  const { loaded, modules, game } = maturityGame();
  const weekEvents = [];
  game.addEventListener('week', event => weekEvents.push(event.detail));
  assert.equal(game.advanceWeek(true), true);
  assert.equal(game.g.week, 52);
  assert.ok(game.g.finance.debtRefinancing.history.some(row => row.week === 52), 'debt maturity ran');
  assert.equal(game.g.playerCrisis.lastEvaluationWeek, 52, 'the final boundary evaluated this week');
  assert.equal(game.g.playerCrisis.lastCash, game.g.companyCash, 'crisis state reads the final cash');
  assert.deepEqual(JSON.parse(JSON.stringify(game.g.finance.lastValidation)), JSON.parse(JSON.stringify(modules.finance.validate(game.g))), 'the recorded validation describes the committed state');
  assert.equal(JSON.parse(loaded.ctx.__localStorageData.get(KEY)).week, 52, 'the committed week is saved');
  assert.equal(weekEvents.length, 1, 'one week event per committed week');
  assert.equal(weekEvents[0].summary, game.g.lastWeeklySummary, 'the week event carries the final weekly summary');
}

console.log('week transaction atomicity tests passed');

// P3-4 W-WEEK-MARKET: the cases above use a private company. Exercise the actual listed
// weekly price/history/issued mirror writer with the real save and fake-IDB checkpoint.
(async () => {
  const { scenario, snapshot, economic } = require('./fixtures/stock-split-atomicity');
  const { injectFault } = require('./helpers/transaction-fault-case');
  const { indexedDBFor } = require('./fixtures/pe-fund-acquisition-faults');
  async function restored(s, expected) {
    const wanted = economic(new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected))).g);
    assert.deepEqual(economic(s.engineModule.TycoonEngine.load().g), wanted, 'public week production reload');
    const fresh = loadGame({ headless:true, indexedDB:indexedDBFor(s.durable, { attempts:[] }) });
    await fresh.modules.saveStorageIDB.hydrate();
    assert.deepEqual(economic(fresh.engineModule.TycoonEngine.load().g), wanted, 'public week fresh durable-only hydration');
  }
  for (const mirror of [1000000, 900000]) {
    let reference;
    for (const mode of ['normal', 'save-false', 'save-throw']) {
      const s = await scenario('own'), game = s.game;
      delete game.g.companyStocks.CPTY; // Remove only the fixture's unadopted company own-share alias.
      const own = game.stock('CPTY');
      Object.assign(own, { issuedShares:mirror, marketCap:own.price*mirror, trend:.01 });
      game.stock('EXT').trend = .02;
      game.g.finance = s.modules.finance.defaultFinanceState(game.g);
      assert.equal(s.modules.finance.validate(snapshot(game)).ok, true, 'fixture accounting agrees with retained holdings');
      assert.equal(game.save(), true); await s.backend.flush();
      const prior = snapshot(game), bytes = s.backend.readSync(s.key), puts = s.control.attempts.length, draws = s.host.draws;
      assert.equal(prior.market.find(row => row.id === 'CPTY').issuedShares, mirror, 'saved predecessor carries fixture mirror');
      let calls = 0;
      const update = game.updateMarket;
      game.updateMarket = function(...args) {
        assert.equal(this.inTransaction(), true, 'market runs inside the actual weekly transaction');
        const before = snapshot(this), result = update.apply(this, args), after = snapshot(this);
        calls++;
        for (const id of ['CPTY', 'EXT']) {
          const old = before.market.find(row => row.id === id), stock = this.stock(id);
          assert.notEqual(stock.price, old.price, id+' actual price movement');
          assert.equal(stock.previous, old.price, id+' prior quote');
          assert.equal(stock.marketCap, stock.price*stock.issuedShares, id+' quote/cap consistency');
          assert.equal(stock.priceHistory.filter(row => row.week === this.g.week).length, 1, id+' one current-week quote');
          assert.equal(stock.priceHistory.find(row => row.week === this.g.week).price, stock.price);
        }
        assert.equal(this.stock('CPTY').issuedShares, before.sharesOut, 'market mirrors authoritative issued quantity');
        assert.equal(this.g.stockPrice, this.stock('CPTY').price, 'player quote mirrors market quote');
        for (const key of ['sharesOut','founderShares','treasuryBuybackShares','companyCash','personalCash','companyDebt','personalDebt','companyStocks','personalStocks','finance'])
          assert.deepEqual(after[key], before[key], 'market helper alone preserves '+key);
        return result;
      };
      const fault = mode === 'normal' ? null : injectFault(s, mode);
      try {
        if (mode === 'save-throw') assert.throws(() => game.advanceWeek(false), /save accepted then threw/);
        else assert.equal(game.advanceWeek(false), mode === 'normal');
      } finally { fault?.restore(); }
      assert.equal(calls, 1, 'fault is after the actual market writer');
      if (fault) {
        assert.ok(fault.hits() > 0); assert.deepEqual(snapshot(game), prior, 'whole public week and stale/valid mirror roll back');
        await s.backend.flush();
        assert.equal(s.backend.readSync(s.key), bytes); assert.equal(s.ctx.localStorage.getItem(s.key), bytes);
        assert.equal(s.durable.get(s.key), bytes); assert.equal(s.control.attempts.length, puts, 'rejected public week starts no put');
        await restored(s, prior);
        calls = 0; assert.equal(game.advanceWeek(false), true); assert.equal(calls, 1, 'retry runs market once');
      }
      assert.equal(game.g.week, prior.week+1); assert.equal(s.host.draws, draws, 'no host RNG during weekly processing');
      assert.equal(game.g.sharesOut, prior.sharesOut); assert.equal(game.g.founderShares, prior.founderShares);
      assert.equal(game.g.treasuryBuybackShares, prior.treasuryBuybackShares);
      assert.equal(game.stock('CPTY').issuedShares, prior.sharesOut, 'committed own mirror, no share issuance');
      assert.equal(s.modules.finance.validate(snapshot(game)).ok, true);
      if (reference) assert.deepEqual(economic(game.g), reference, 'failed week + retry equals uninterrupted state/RNG');
      else reference = economic(game.g);
      await s.backend.flush(); assert.equal(s.control.attempts.length, puts+1, 'exactly one successful public-week put');
      await restored(s, game.g);
      console.log(`public weekly market mirror=${mirror} ${mode}: rollback / retry / fresh fake-IDB PASS`);
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
