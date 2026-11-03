'use strict';
// The turnaround-fund ratchet (settle()) issues free shares after this week's updateMarket. A company that listed during
// the fund term must see its own market row mirror the issued quantity in the same week, as the share swap and the M&A
// equity raise do since #1204; otherwise the P3-4 planner refuses the listing (issued mirror mismatch) until the next
// market pass. An unlisted company has no own row and is unchanged. The ratchet's quantity, the fund record, the cash and
// the ledger are what they were before the mirror; no RNG is drawn by the mirror.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
function lcg(seed = 7) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

// The distressed company of tests/player-crisis-turnaround-ratchet-week-rollback-test.js accepts the fund; `listed`
// then hand-sets the listing an IPO during the term would leave, and the plan is marked failed so the next installed
// week ratchets.
function fixture(listed, loadOptions = {}) {
  const loaded = loadGame({ random: lcg(7), headless: true, ...loadOptions });
  const { engine, finance, playerCrisis, playerTurnaroundPlan } = loaded.modules;
  const state = engine.createInitialState({ configured: true });
  state.week = 2; state.companyCash = -3_000_000; state.companyCredit = 80;
  const property = state.properties[0];
  property.owner = 'company'; property.purchasePrice = property.price = property.value = 100_000_000;
  state.finance = finance.defaultFinanceState(state);
  playerCrisis.evaluate(state);
  const game = new engine.TycoonEngine(state);
  assert.notEqual(game.acceptTurnaroundFund(), false, 'fund accepted');
  const save = game.save;
  game.save = () => true;
  const g = game.g;
  if (listed) {
    Object.assign(g, { publicCompany: true, ticker: 'CPTY', stockPrice: 1000 });
    g.market = g.market.filter(row => row.id !== 'CPTY');
    g.market.push({ id: 'CPTY', name: 'Own', price: 1000, previous: 1000, issuedShares: g.sharesOut, marketCap: 1000 * g.sharesOut,
      volatility: 0, trend: 0, priceHistory: [{ week: g.week, price: 1000 }] });
  }
  playerTurnaroundPlan.ensure(g).status = 'failed';
  return { loaded, game, g, save };
}
const plain = value => JSON.parse(JSON.stringify(value));

for (const listed of [true, false]) {
  const { loaded, game, g } = fixture(listed), label = listed ? 'listed' : 'unlisted';
  const before = g.sharesOut, ratchet = loaded.modules.playerCrisisTurnaroundFund.ratchetSharesFor(plain(g));
  assert.notEqual(game.advanceWeek(false), false, `${label}: week advances`);
  assert.equal(game.turnaroundFundSnapshot().status, 'ratcheted', `${label}: the fund ratchets`);
  assert.equal(g.sharesOut, before + ratchet, `${label}: the ratchet quantity is unchanged`);
  assert.equal(game.turnaroundFundSnapshot().ratchetShares, ratchet);
  if (listed) {
    const own = g.market.find(row => row.id === g.ticker);
    assert.equal(own.issuedShares, g.sharesOut, 'listed: own market row mirrors the issued quantity in the ratchet week');
    assert.equal(own.marketCap, own.price * g.sharesOut, 'listed: market cap follows the issued quantity');
    const scope = { family: 'player-common', issuerEntityId: 'entity:company:player', securityClassId: 'security:player-company:common', currentCompanySerial: 1 };
    assert.equal(loaded.modules.phase3OwnershipPlanner.inspectOwnershipAuthority(g, scope).status, 'OBSERVED', 'listed: the planner observes the listing');
  } else assert.equal(g.market.some(row => row.id === g.ticker), false, 'unlisted: no own row is created');
  assert.equal(loaded.modules.finance.validate(plain(g)).ok, true, `${label}: accounting valid`);
  console.log(`turnaround ratchet ${label}: issued mirror and ratchet quantity PASS`);
}
console.log('turnaround ratchet listed mirror PASS');

// W-TURNAROUND-RATCHET verification: actual installed canonical week, first generation listed/unlisted and second
// generation. The mirror fix is a prerequisite; ordinary listed progress must never be refused as a stale-mirror skew.
const { indexedDBFor } = require('./fixtures/pe-fund-acquisition-faults');
(async () => {
  for (const listed of [true, false]) {
    const durable = new Map(), control = { attempts: [] };
    const { loaded, game, g, save } = fixture(listed, { indexedDB: indexedDBFor(durable, control) });
    const backend = loaded.modules.saveStorageIDB, key = loaded.engineModule.SAVE_KEY;
    await backend.hydrate(); game.save = save;
    const ownership = loaded.modules.phase3OwnershipApply;
    let planned = 0, confirmed = 0;
    loaded.modules.phase3OwnershipApply = { ...ownership,
      beginOwnershipLeg(engine, leg) {
        const h = ownership.beginOwnershipLeg(engine, leg);
        if (leg.writerId === 'W-TURNAROUND-RATCHET') {
          assert.equal(engine.inTransaction(), true, 'ratchet uses the real weekly transaction');
          assert(h && h.plan.status === 'PLANNED', 'first-generation ratchet is checked'); planned++;
        }
        return h;
      },
      confirmOwnershipLeg(engine, h) {
        if (h?.plan.writerId === 'W-TURNAROUND-RATCHET') confirmed++;
        return ownership.confirmOwnershipLeg(engine, h);
      }
    };
    assert.equal(game.save(), true); await backend.flush();
    const prior = JSON.stringify(g), bytes = backend.readSync(key), ratios = game.updateOwnershipRatios;
    // Skew only the ratchet write; preserve a consistent own market mirror so the planned bucket is the failing oracle.
    game.updateOwnershipRatios = function (...args) {
      if (this.g.playerTurnaroundFund.status === 'ratcheted') {
        this.g.sharesOut++;
        const own = this.g.publicCompany && this.g.market.find(row => row.id === this.g.ticker);
        if (own) { own.issuedShares = this.g.sharesOut; own.marketCap = own.price * this.g.sharesOut; }
      }
      return ratios.apply(this, args);
    };
    assert.throws(() => game.advanceWeek(false), /株式数の整合を確認できませんでした/, 'skewed ratchet refuses the whole week');
    assert.equal(planned, 1); assert.equal(confirmed, 1);
    assert.equal(JSON.stringify(g), prior, 'entire state and persisted RNG rolled back');
    assert.equal(loaded.ctx.__localStorageData.get(key), bytes, 'mirror unchanged');
    assert.equal(backend.readSync(key), bytes, 'cache unchanged');
    await backend.flush(); assert.equal(durable.get(key), bytes, 'failed ratchet not durable');
    const fresh = loadGame({ headless: true, indexedDB: indexedDBFor(durable, { attempts: [] }) });
    await fresh.modules.saveStorageIDB.hydrate();
    const reloaded = fresh.engineModule.TycoonEngine.load();
    assert.deepEqual(plain(reloaded.g), plain(new loaded.engineModule.TycoonEngine(JSON.parse(prior)).g),
      'fresh durable-only hydration retains the complete normalized predecessor');
    game.updateOwnershipRatios = ratios;
    assert.equal(game.advanceWeek(false), true, 'unskewed retry advances');
    assert.equal(planned, 2); assert.equal(confirmed, 2);
    const added = Math.round(JSON.parse(prior).sharesOut * .15 / .85);
    assert.equal(g.sharesOut, JSON.parse(prior).sharesOut + added, 'exact existing ratchet quantity');
    assert.equal(g.founderShares, JSON.parse(prior).founderShares, 'founder shares unchanged');
    await backend.flush(); assert.equal(durable.get(key), backend.readSync(key));
    const committed = JSON.stringify(g);
    assert.equal(loaded.modules.playerCrisisTurnaroundFund.settle(game), null);
    assert.equal(JSON.stringify(g), committed, 'terminal settlement cannot issue twice');
    assert.equal(game.advanceWeek(false), true, 'next ordinary week also advances');
    assert.equal(planned, 2, 'no new ratchet leg after terminal settlement');
    console.log(`ratchet verification ${listed ? 'listed' : 'unlisted'}: skew rollback / durable hydration / retry / next week PASS`);
  }
  for (const listed of [true, false]) {
    const { loaded, game, g } = fixture(listed);
    g.currentCompanySerial = 2;
    const ratios = game.updateOwnershipRatios;
    game.updateOwnershipRatios = function (...args) {
      if (this.g.playerTurnaroundFund.status === 'ratcheted') this.g.sharesOut++;
      return ratios.apply(this, args);
    };
    assert.equal(game.advanceWeek(false), true, 'second-generation existing writer remains unchecked');
    assert.equal(g.playerTurnaroundFund.status, 'ratcheted');
    assert.equal(loaded.modules.phase3OwnershipApply.ACTIVATION, 'disabled');
  }
  // Reach the listing through the installed IPO API during the fund term, rather than only seeding a market row.
  // The capitalized zero-store IPO fixture exercises the existing unlock conditions. Only opening distress and the
  // later failed-plan outcome are seeded; this is a writer-chain regression, not a natural occurrence-rate claim.
  {
    const loaded = loadGame({ headless: true, random: lcg(7) });
    const { prepareIPO } = require('./fixtures/parent-ipo-atomicity');
    const game = prepareIPO(loaded.modules), g = game.g;
    g.companyCash = -3000000; g.companyCredit = 80;
    g.finance = loaded.modules.finance.defaultFinanceState(g);
    loaded.modules.playerCrisis.evaluate(g);
    assert.equal(game.acceptTurnaroundFund(), true);
    assert.equal(game.executeIPO('東証グロース'), true, 'actual IPO remains available during the fund term');
    assert.equal(g.playerTurnaroundFund.status, 'active');
    loaded.modules.playerTurnaroundPlan.ensure(g).status = 'failed';
    const before = g.sharesOut, shares = Math.round(before * .15 / .85);
    assert.equal(game.advanceWeek(false), true, 'actual IPO followed by ratchet does not falsely block the week');
    assert.equal(g.playerTurnaroundFund.status, 'ratcheted');
    assert.equal(g.sharesOut, before + shares); assert.equal(game.stock(g.ticker).issuedShares, g.sharesOut);
    assert.equal(game.advanceWeek(false), true, 'ordinary progress after the actual IPO and ratchet');
    assert.equal(loaded.modules.finance.validate(plain(g)).ok, true);
  }
  console.log('Turnaround ratchet verification legs PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
