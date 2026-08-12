'use strict';
// Roadmap 8A.4: a competitor launches a product that really moves the market, and the
// player answers with one of four counter-campaigns. The launch and every campaign act on
// brand, quality and price — fields the market calculation already reads — so no market
// code changes. Everything the player pays for goes through finance.event, and every
// effect is unwound when it expires, so nothing leaks into the rest of the run.
const assert = require('node:assert');
const { loadGame } = require('./harness');

// A fixed random value collapses every generated uuid to one string, merging unrelated
// entities. Tests that create or select entities need a varying deterministic source.
function lcg(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function createEngine() {
  const loaded = loadGame({ headless: true, random: lcg(7) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.g.companyCash = 500_000_000;
  engine.g.companyDebt = 0;
  delete engine.g.finance;
  engine.normalize();
  engine.g.configured = true;
  engine.g.difficulty = 'normal';
  engine.g.companyName = 'Counter Co';
  engine.g.companyCash = 500_000_000;
  return { loaded, engine };
}

function balanceGap(loaded, engine) {
  const sheet = loaded.modules.finance.buildStatements(engine.g, String(engine.g.week)).balanceSheet;
  return Math.round(
    (sheet.assets.totalAssets - (sheet.liabilities.totalLiabilities + sheet.equity.totalEquity)) * 100
  ) / 100;
}

// --- a launch strengthens the rival on the fields the market reads --------
{
  const { engine } = createEngine();
  const row = engine.g.competitors[0];
  const before = { brand: row.brand, quality: row.quality };

  const product = engine.launchCompetitorProduct(row);
  assert.ok(product, 'the launch produces a product record');
  assert.ok(product.brandBoost > 0 && product.qualityBoost > 0, 'the product carries a real boost');
  assert.equal(row.brand, before.brand + product.brandBoost, 'the rival brand rises by the boost');
  assert.equal(row.quality, before.quality + product.qualityBoost, 'the rival quality rises by the boost');
  assert.equal(engine.activeCompetitorProducts().length, 1, 'the product is active');

  engine.g.week = product.maturesWeek;
  engine.updateCompetitorProducts();
  assert.equal(row.brand, before.brand, 'the brand boost is unwound at maturity');
  assert.equal(row.quality, before.quality, 'the quality boost is unwound at maturity');
  assert.equal(engine.activeCompetitorProducts().length, 0, 'the product is no longer active');
}

// --- launches are rare: a cooldown holds them apart ----------------------
{
  const { engine } = createEngine();
  const row = engine.g.competitors[0];
  engine.launchCompetitorProduct(row);
  const firstWeek = engine.g.lastCompetitorProductWeek;

  engine.g.week = firstWeek + 5;
  assert.equal(engine.updateCompetitorProducts(), null, 'no second launch inside the cooldown');
  assert.equal(engine.g.lastCompetitorProductWeek, firstWeek, 'the cooldown clock is untouched');
}

// --- the four campaigns are genuinely different trade-offs ---------------
{
  const options = createEngine().engine.counterCampaignOptions();
  assert.equal(options.length, 4, 'four counter-campaigns are offered');
  const byID = Object.fromEntries(options.map(option => [option.id, option]));
  assert.ok(byID.price.cost < byID.advertising.cost, 'cutting price is the cheap answer');
  assert.ok(byID.product.cost > byID.quality.cost, 'launching a product is the expensive answer');
  assert.equal(byID.price.delayWeeks, 0, 'a price cut bites immediately');
  assert.equal(byID.advertising.delayWeeks, 0, 'advertising bites immediately');
  assert.ok(byID.quality.delayWeeks > 0, 'quality takes time to arrive');
  assert.ok(byID.product.delayWeeks > byID.quality.delayWeeks, 'a product takes the longest');
  assert.ok(byID.product.durationWeeks > byID.advertising.durationWeeks, 'the slow answers last longer');
  assert.ok(byID.price.priceRatio < 1, 'only the price answer moves price');
  for (const id of ['advertising', 'quality', 'product']) {
    assert.equal(byID[id].priceRatio, 1, `${id} leaves price alone`);
  }
}

// --- each campaign applies, is paid for, and unwinds ---------------------
for (const type of ['price', 'advertising', 'quality', 'product']) {
  const { loaded, engine } = createEngine();
  const row = engine.g.competitors[0];
  const product = engine.launchCompetitorProduct(row);
  const business = engine.business(row.businessID);
  const before = { price: business.price, brand: business.brand, quality: business.quality };
  const definition = engine.counterCampaignOptions().find(option => option.id === type);
  const cashBefore = engine.g.companyCash;

  assert.ok(engine.launchCounterCampaign(product.id, type), `${type} can be started`);
  assert.equal(cashBefore - engine.g.companyCash, definition.cost, `${type} is paid for in cash`);
  assert.equal(balanceGap(loaded, engine), 0, `${type} keeps the sheet balanced`);
  assert.ok(loaded.modules.finance.validate(engine.g).ok, `${type} keeps the ledger valid`);

  const campaign = engine.activeCounterCampaigns()[0];
  assert.ok(campaign, `${type} creates an active campaign`);

  if (definition.delayWeeks > 0) {
    engine.g.week = campaign.activatesWeek - 1;
    engine.updateCounterCampaigns();
    assert.equal(business.brand, before.brand, `${type} has not arrived before its delay elapses`);
  }

  engine.g.week = campaign.activatesWeek;
  engine.updateCounterCampaigns();
  const moved = business.price !== before.price
    || business.brand !== before.brand
    || business.quality !== before.quality;
  assert.ok(moved, `${type} actually changes the company's market position`);
  if (definition.priceRatio < 1) assert.ok(business.price < before.price, 'the price answer cuts price');
  if (definition.brandGain > 0) assert.ok(business.brand > before.brand, `${type} raises brand`);
  if (definition.qualityGain > 0) assert.ok(business.quality > before.quality, `${type} raises quality`);

  engine.g.week = campaign.endsWeek;
  engine.updateCounterCampaigns();
  assert.equal(business.price, before.price, `${type} restores price when it ends`);
  assert.equal(business.brand, before.brand, `${type} restores brand when it ends`);
  assert.equal(business.quality, before.quality, `${type} restores quality when it ends`);
  assert.equal(engine.activeCounterCampaigns().length, 0, `${type} is no longer active`);
  assert.equal(balanceGap(loaded, engine), 0, `${type} leaves the sheet balanced`);
}

// --- one answer per product, and only affordable answers -----------------
{
  const { engine } = createEngine();
  const product = engine.launchCompetitorProduct(engine.g.competitors[0]);
  assert.ok(engine.launchCounterCampaign(product.id, 'advertising'), 'the first answer is accepted');
  assert.equal(
    engine.launchCounterCampaign(product.id, 'price'),
    false,
    'a product cannot be answered twice'
  );

  const poor = createEngine();
  const poorProduct = poor.engine.launchCompetitorProduct(poor.engine.g.competitors[0]);
  poor.engine.g.companyCash = 100_000;
  assert.equal(
    poor.engine.launchCounterCampaign(poorProduct.id, 'product'),
    false,
    'an unaffordable answer is refused'
  );
  assert.equal(poor.engine.g.companyCash, 100_000, 'a refused answer costs nothing');
  assert.equal(poor.engine.activeCounterCampaigns().length, 0, 'a refused answer starts nothing');
}

// --- unknown inputs are rejected -----------------------------------------
{
  const { engine } = createEngine();
  const product = engine.launchCompetitorProduct(engine.g.competitors[0]);
  assert.equal(engine.launchCounterCampaign(product.id, 'nonsense'), false, 'an unknown answer is refused');
  assert.equal(engine.launchCounterCampaign('missing-product', 'price'), false, 'an unknown product is refused');
}

// --- the state survives a save round trip --------------------------------
{
  const { loaded, engine } = createEngine();
  const product = engine.launchCompetitorProduct(engine.g.competitors[0]);
  engine.launchCounterCampaign(product.id, 'quality');

  const restored = new loaded.engineModule.TycoonEngine();
  restored.g = JSON.parse(JSON.stringify(engine.g));
  restored.normalize();
  assert.equal(restored.activeCompetitorProducts().length, 1, 'the product survives a round trip');
  assert.equal(restored.activeCounterCampaigns().length, 1, 'the campaign survives a round trip');
  assert.equal(restored.activeCounterCampaigns()[0].type, 'quality', 'the chosen answer survives');
}

// --- old saves gain the new state safely ---------------------------------
{
  const { engine } = createEngine();
  delete engine.g.competitorProducts;
  delete engine.g.counterCampaigns;
  delete engine.g.lastCompetitorProductWeek;
  engine.ensureCompetitorProductState();
  assert.deepEqual(engine.g.competitorProducts, [], 'old saves gain a product list');
  assert.deepEqual(engine.g.counterCampaigns, [], 'old saves gain a campaign list');
  assert.equal(engine.g.lastCompetitorProductWeek, 0, 'old saves gain a cooldown clock');
}

console.log('competitor product counter tests passed');
