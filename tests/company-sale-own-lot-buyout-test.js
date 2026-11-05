'use strict';
// G1 D1 (Owner 2026-11-05, docs/economic-engine/P3_4_G1_GENERATION_BINDING_DECISION.md): a company sale buys out the
// founder's personally bought own-company lot at the sale price per share, so no old-company lot survives to sit under
// the next company's ticker. Refounding drops the sold company's listing row. Both sale commands are one transaction.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function boot() {
  let x = 7;
  return loadGame({ headless: true, random: () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 2 ** 32; } });
}
function fixture({ lot = { qty: 10000, avg: 100 }, treasury = 0 } = {}) {
  const s = boot(), state = s.engineModule.createInitialState({ configured: true });
  Object.assign(state, { week: 20, companyCash: 100000000, companyDebt: 0, personalCash: 100000000, publicCompany: true, sharesOut: 100000,
    founderShares: 60000, treasuryBuybackShares: treasury, competitorOwnedRatio: 0, stockPrice: 100, ticker: 'CPTY', isCompanySold: false });
  state.market = state.market.filter(row => row.id !== 'CPTY');
  state.market.push({ id: 'CPTY', name: state.companyName, sector: 'コングロマリット', price: 100, previous: 100, issuedShares: 100000,
    marketCap: 10000000, dividendYield: 0, volatility: 0, trend: 0, dividendPerShare: 0, priceHistory: [{ week: 20, price: 100 }] });
  const other = state.market.find(row => row.id !== 'CPTY').id;
  state.personalStocks = { [other]: { qty: 30, avg: 500 } };
  if (lot !== null) state.personalStocks.CPTY = lot;
  state.finance = s.modules.finance.defaultFinanceState(state);
  const e = new s.engineModule.TycoonEngine(state);
  e.updateOwnershipRatios();
  e.g.inboundBuyoutOffers = [{ id: 'offer', bidderName: 'Rival', offerAmount: 500_000_000, premiumRate: 1.3, createdWeek: 20, expiresWeek: 28,
    hostile: false, status: 'pending' }];
  return { s, e, g: e.g, other };
}
const copy = x => JSON.parse(JSON.stringify(x));

// Inbound offer: founder 60,000 of 100,000 → ¥300,000,000; the 10,000-share lot → ¥50,000,000.
{
  const { e, g, other } = fixture();
  const draws = r => JSON.stringify([r.seed, r.state, r.draws]);
  const cash = g.personalCash, pl = g.realizedPersonalStockPL, rng = draws(g.simulationRng);
  assert.equal(e.acceptInboundBuyoutOffer('offer'), true);
  assert.equal(g.isCompanySold, true);
  assert.equal(g.personalCash - cash, 350_000_000, 'founder proceeds plus the bought lot at the sale price per share');
  assert.equal(g.realizedPersonalStockPL - pl, 49_000_000, 'lot gain = ¥50,000,000 − ¥1,000,000 cost');
  assert.equal(g.personalStocks.CPTY, undefined, 'the own-company lot is gone');
  assert.deepEqual(copy(g.personalStocks[other]), { qty: 30, avg: 500 }, 'other personal holdings are untouched');
  assert.equal(g.pastCompanyRecords[0].founderProceeds, 300_000_000, 'the exit record keeps the founder-share proceeds');
  assert.equal(draws(g.simulationRng), rng, 'no random draw consumed (the exit record takes an ID, as before)');
}

// Treasury shares are outside the per-share denominator: 500,000,000 × 10,000 / 95,000, rounded up to whole yen.
{
  const { e, g } = fixture({ treasury: 5000 });
  const cash = g.personalCash, founder = Math.ceil(500_000_000 * (60000 / 95000));
  assert.equal(e.acceptInboundBuyoutOffer('offer'), true);
  assert.equal(g.personalCash - cash, founder + 52_631_579);
  assert.equal(g.personalStocks.CPTY, undefined);
}

// The settings-screen sale settles the lot too.
{
  const { e, g } = fixture();
  const cash = g.personalCash, value = e.companyValue() * 1.2;
  assert.equal(e.acceptBuyoutOffer(1.2), true);
  assert.equal(g.personalCash - cash, Math.ceil(value * .6) + Math.ceil(value * 10000 / 100000));
  assert.equal(g.personalStocks.CPTY, undefined);
}

// A lot that does not fit the outstanding quantity, or is malformed, is not priced and is left as is.
for (const lot of [{ qty: 50000, avg: 100 }, { qty: '100', avg: 1 }, { qty: -5, avg: 1 }, { qty: 1.5, avg: 1 }, { qty: 10, avg: NaN }]) {
  const { e, g } = fixture({ lot });
  const cash = g.personalCash, before = JSON.stringify(g.personalStocks.CPTY);
  assert.equal(e.acceptInboundBuyoutOffer('offer'), true);
  assert.equal(g.personalCash - cash, 300_000_000, `founder proceeds only for ${before}`);
  assert.equal(JSON.stringify(g.personalStocks.CPTY), before, `lot left as is: ${before}`);
}

// No lot: unchanged behaviour.
{
  const { e, g } = fixture({ lot: null });
  const cash = g.personalCash;
  assert.equal(e.acceptInboundBuyoutOffer('offer'), true);
  assert.equal(g.personalCash - cash, 300_000_000);
}

// A rejected or throwing save rolls the whole sale back, lot included, for both commands.
for (const fault of ['save-false', 'save-throw']) for (const command of [e => e.acceptInboundBuyoutOffer('offer'), e => e.acceptBuyoutOffer(1.2)]) {
  const { e, g } = fixture();
  const before = JSON.stringify(g), save = e.save;
  e.save = fault === 'save-false' ? () => false : () => { throw new Error('sale save threw'); };
  try {
    if (fault === 'save-false') assert.equal(command(e), false, 'a rejected save fails the sale');
    else assert.throws(() => command(e), /sale save threw/);
  } finally { e.save = save; }
  assert.equal(e.g, g, 'root identity kept');
  assert.equal(JSON.stringify(e.g), before, `${fault}: state, lot and cash are rolled back`);
  assert.equal(command(e), true, 'a retry commits');
  assert.equal(e.g.personalStocks.CPTY, undefined);
}

// Refounding after the sale: the old listing row is not carried over and no old-company lot remains.
{
  const { e, g, other } = fixture();
  assert.equal(e.acceptInboundBuyoutOffer('offer'), true);
  const otherRow = copy(g.market.find(row => row.id === other));
  assert.equal(e.foundNewCompanyAfterBuyout('Second Co', 10_000_000, 'store'), true);
  const h = e.g;
  assert.equal(h.currentCompanySerial, 2);
  assert.equal(h.market.some(row => row.id === 'CPTY'), false, 'the sold company listing row is dropped');
  assert.deepEqual(copy(h.market.find(row => row.id === other)), otherRow, 'other listings are carried over');
  assert.equal(h.personalStocks.CPTY, undefined, 'no old-company lot under the new ticker');
  assert.deepEqual(copy(h.personalStocks[other]), { qty: 30, avg: 500 });
}

console.log('company sale own-lot buyout tests passed');
