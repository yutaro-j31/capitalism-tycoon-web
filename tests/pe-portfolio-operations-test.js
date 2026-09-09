'use strict';

// PE mode T14 (docs/PE_MODE_TASKS.md): operating an acquired 5-pillar-tier company through its
// own simplified P&L -- acquisition, weekly processing, price/quality levers, store expansion,
// exit with reputation feedback, and full accounting separation from the player's own company/
// personal cash.

const assert = require('node:assert/strict');
const fs = require('node:fs');

function load() {
  delete globalThis.__capitalismTycoonModules;
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
  globalThis.document = { addEventListener() {} };
  globalThis.window = globalThis;
  for (const m of ['../js/runtime.js', '../js/data.js', '../js/workforce.js', '../js/supply.js', '../js/competitor.js', '../js/competitor-projects.js', '../js/competitor-entry.js', '../js/competitor-credit.js', '../js/competitor-distress.js', '../js/market.js', '../js/finance.js', '../js/engine.js', '../js/completion.js', '../js/pe-fund.js', '../js/pe-industry-tiers.js', '../js/pe-network.js', '../js/pe-portfolio-operations.js']) {
    delete require.cache[require.resolve(m)];
    require(m);
  }
  const modules = globalThis.__capitalismTycoonModules;
  return { modules, TycoonEngine: modules.engine.TycoonEngine, pf: modules.peFund, pn: modules.peNetwork, ops: modules.pePortfolioOperations };
}
const { TycoonEngine, pf, pn, ops } = load();

function bigFund(score = 35, size = 30_000_000_000) {
  const e = new TycoonEngine();
  const fund = pf.createFund(e.g, { size, y0: 1, terms: pf.fundTermsForScore(score) });
  return { e, fund };
}

// 1. Completion criterion: acquiring a pillar-tier company creates a deal with its own
// portfolioCompany, debits the fund's cash by the equity check, and only accepts a real
// 5-pillar businessID.
{
  const { e, fund } = bigFund();
  const cashBefore = fund.cash;
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: 2_000_000_000, week: 10 });
  assert.ok(deal);
  assert.equal(deal.businessID, 'ramen');
  assert.equal(deal.status, 'active');
  assert.ok(deal.portfolioCompany);
  assert.equal(deal.portfolioCompany.cash, 0);
  assert.equal(deal.portfolioCompany.storeCount, 1);
  assert.equal(fund.cash, cashBefore - deal.fundPortion);
  assert.ok(fund.deals.includes(deal));

  assert.equal(ops.acquirePillarCompany(e.g, fund.id, { businessID: 'not-a-pillar', enterpriseValue: 1_000_000_000, week: 10 }), null);
}

// 2. Insufficient fund cash refuses the acquisition and leaves state untouched.
{
  const { e, fund } = bigFund(5, 1_000_000_000);
  fund.cash = 1_000_000; // far too little
  const dealsBefore = fund.deals.length;
  const result = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'gym', enterpriseValue: 2_000_000_000, week: 1 });
  assert.equal(result, null);
  assert.equal(fund.deals.length, dealsBefore);
  assert.equal(fund.cash, 1_000_000);
}

// 3. Completion criterion: weekly operation produces a real P&L that changes the portfolio
// company's own cash and improvementScore, deterministically.
{
  const { e, fund } = bigFund();
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'conveni', enterpriseValue: 3_000_000_000, week: 1 });
  ops.processDealWeek(fund, deal, 2);
  assert.notEqual(deal.portfolioCompany.weeklyProfit, 0);
  assert.equal(deal.portfolioCompany.lastProcessedWeek, 2);
  assert.equal(deal.portfolioCompany.profitHistory.length, 1);
  ops.processDealWeek(fund, deal, 2); // reprocessing the same week must be a no-op
  assert.equal(deal.portfolioCompany.profitHistory.length, 1);
  const cashAfterOne = deal.portfolioCompany.cash;
  ops.processDealWeek(fund, deal, 3);
  assert.notEqual(deal.portfolioCompany.cash, cashAfterOne);
}

// 4. Determinism: processing the same deal/week combination from a fresh identical setup
// yields identical results (hash-based, no Math.random()).
{
  const { e: e1, fund: f1 } = bigFund();
  const d1 = ops.acquirePillarCompany(e1.g, f1.id, { businessID: 'gym', enterpriseValue: 2_500_000_000, week: 1 });
  ops.processDealWeek(f1, d1, 5);
  const { e: e2, fund: f2 } = bigFund();
  const d2 = ops.acquirePillarCompany(e2.g, f2.id, { businessID: 'gym', enterpriseValue: 2_500_000_000, week: 1 });
  ops.processDealWeek(f2, d2, 5);
  assert.equal(d1.portfolioCompany.weeklyProfit, d2.portfolioCompany.weeklyProfit);
  assert.equal(d1.portfolioCompany.cash, d2.portfolioCompany.cash);
}

// 4b. Codex独立監査対応: T9's attentionMultiplier (team headcount ÷ active deal count) must
// actually be connected to weekly EBITDA -- diluting a fund's attention across many concurrent
// deals must measurably lower each deal's weeklyProfit relative to the same fund/deal
// processed with attention undiluted, all else (price/quality/noise) held equal.
{
  const { e, fund } = bigFund();
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: 2_500_000_000, week: 1 });
  const focusedMultiplier = pf.attentionMultiplier(fund);
  assert.equal(focusedMultiplier, 1, 'sanity: a single active deal must not dilute attention');
  ops.processDealWeek(fund, deal, 2);
  const focusedProfit = deal.portfolioCompany.weeklyProfit;

  // Same fund, but now with enough other active deals pushed onto it directly (bypassing the
  // acquisition flow, purely to manipulate activeDealCount for this isolated check) to dilute
  // attention well below 1 -- reprocessing the SAME week-2 transition on a fresh identical
  // deal must produce a strictly lower weeklyProfit.
  const { e: e2, fund: fund2 } = bigFund();
  const deal2 = ops.acquirePillarCompany(e2.g, fund2.id, { businessID: 'ramen', enterpriseValue: 2_500_000_000, week: 1 });
  for (let i = 0; i < 40; i++) fund2.deals.push({ id: `filler-${i}`, businessID: null, status: 'active' });
  const dilutedMultiplier = pf.attentionMultiplier(fund2);
  assert.ok(dilutedMultiplier < focusedMultiplier, `attention must be diluted: ${dilutedMultiplier} should be < ${focusedMultiplier}`);
  ops.processDealWeek(fund2, deal2, 2);
  const dilutedProfit = deal2.portfolioCompany.weeklyProfit;
  assert.ok(dilutedProfit < focusedProfit, `diluted attention must lower weeklyProfit: ${dilutedProfit} should be < ${focusedProfit}`);
  assert.ok(Math.abs(dilutedProfit / focusedProfit - dilutedMultiplier / focusedMultiplier) < 1e-9, 'the profit ratio must match the attentionMultiplier ratio exactly (single multiplicative factor)');
}

// 5. Completion criterion: price/quality levers and store expansion visibly change future
// weekly results, and improvementScore responds monotonically to sustained profitability.
{
  const { e, fund } = bigFund();
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'productVentures', enterpriseValue: 4_000_000_000, week: 1 });
  // Force a healthy cash pile so we can afford quality investment and expansion for the test.
  deal.portfolioCompany.cash = 500_000_000;
  const scoreBefore = deal.portfolioCompany.improvementScore;
  // T20の較正修正以降、品質1点の値段は企業価値に比例する（0.3%/点）。EV40億の会社なら
  // 1点=1200万円なので、1億円では約8.3点しか買えない。上限まで上げるにはEVの30%が要る。
  ops.investQuality(e.g, fund.id, deal.id, 100_000_000);
  const pointsPerYen = 1 / (ops.QUALITY_COST_FRACTION_PER_POINT * 4_000_000_000);
  assert.ok(Math.abs(deal.portfolioCompany.qualityInvestment - 100_000_000 * pointsPerYen) < 1e-6);
  deal.portfolioCompany.cash = 4_000_000_000; // 上限まで買うにはEVの30%が要る
  ops.investQuality(e.g, fund.id, deal.id, 4_000_000_000 * ops.QUALITY_COST_FRACTION_PER_POINT * 100);
  assert.equal(deal.portfolioCompany.qualityInvestment, 100, '上限は100点で頭打ち');
  assert.ok(deal.portfolioCompany.cash < 4_000_000_000, 'investQuality must spend the portfolio company\'s own cash');
  assert.ok(deal.portfolioCompany.cash >= 0, 'investQuality must never spend more than the company has');
  const afterQuality = ops.computeImprovementScore(deal);
  assert.ok(afterQuality > scoreBefore, `quality investment must raise improvementScore: ${scoreBefore} -> ${afterQuality}`);

  ops.setPriceMultiplier(e.g, fund.id, deal.id, 1.5);
  assert.equal(deal.portfolioCompany.priceMultiplier, 1.5);
  assert.equal(ops.setPriceMultiplier(e.g, fund.id, deal.id, 10), deal, 'out-of-range values must be clamped, not rejected');
  assert.equal(deal.portfolioCompany.priceMultiplier, 2, 'priceMultiplier must clamp to its [.5,2] band');

  const storesBefore = deal.portfolioCompany.storeCount;
  const expanded = ops.expandPortfolioStore(e.g, fund.id, deal.id);
  assert.ok(expanded);
  assert.equal(deal.portfolioCompany.storeCount, storesBefore + 1);
}
{
  // Expansion is refused when the portfolio company can't afford it, and nothing changes.
  const { e, fund } = bigFund();
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: 2_000_000_000, week: 1 });
  deal.portfolioCompany.cash = 1;
  assert.equal(ops.expandPortfolioStore(e.g, fund.id, deal.id), null);
  assert.equal(deal.portfolioCompany.storeCount, 1);
}

// 6. Completion criterion: exit distributes proceeds to the fund (never reinvested, T5's
// rule), marks the deal exited, and a good improvementScore (>=65) raises matching reputation
// nodes while cutting employees on exit lowers them instead (経路3接続, 設計書§6.5/§11).
{
  const { e, fund } = bigFund();
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'realEstateAgency', enterpriseValue: 3_000_000_000, week: 1 });
  deal.portfolioCompany.improvementScore = 80; // force a strong score
  const goodNode = pn.addNode(e.g, { sourceType: 'peer', pathType: 'reputation', industryTag: 'realEstateAgency', week: 1, trust: 30 });
  const otherIndustryNode = pn.addNode(e.g, { sourceType: 'peer2', pathType: 'reputation', industryTag: 'ramen', week: 1, trust: 30 });
  const distributedBefore = fund.distributed;
  const result = ops.exitPortfolioCompany(e.g, fund.id, deal.id, { method: 'sale', week: 100, cutEmployees: false });
  assert.ok(result);
  assert.equal(deal.status, 'exited');
  assert.ok(fund.distributed > distributedBefore, 'exit proceeds must be added to fund.distributed');
  assert.ok(goodNode.trust > 30, 'a strong exit must raise a same-industry reputation node');
  assert.equal(otherIndustryNode.trust, 30, 'a different-industry reputation node must be unaffected');
  assert.equal(ops.exitPortfolioCompany(e.g, fund.id, deal.id, { week: 101 }), null, 'an already-exited deal cannot be exited again');
}
{
  const { e, fund } = bigFund();
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'gym', enterpriseValue: 3_000_000_000, week: 1 });
  deal.portfolioCompany.improvementScore = 20; // weak score
  const node = pn.addNode(e.g, { sourceType: 'peer', pathType: 'reputation', industryTag: 'gym', week: 1, trust: 50 });
  ops.exitPortfolioCompany(e.g, fund.id, deal.id, { method: 'sale', week: 50, cutEmployees: true });
  assert.ok(node.trust < 50, 'cutting employees on exit must lower matching-industry reputation, regardless of score');
}

// 7. Completion criterion: accounting separation -- acquiring, operating, and exiting a
// portfolio company must NEVER touch the player's own companyCash. Only fund.cash /
// fund.distributed / fund.coinvestCommitted / portfolioCompany.cash move, plus (since T17)
// the GP's carried interest, which is personal income by design and lands in personalCash --
// the amount is exactly the settlement's gpCarry and nothing else.
{
  const { e, fund } = bigFund();
  e.g.companyCash = 12_345_678;
  e.g.personalCash = 87_654_321;
  const companyCashBefore = e.g.companyCash, personalCashBefore = e.g.personalCash;
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: 5_000_000_000, week: 1, useCoinvest: true });
  assert.ok(deal);
  for (let w = 2; w <= 20; w++) ops.processDealWeek(fund, deal, w);
  ops.setPriceMultiplier(e.g, fund.id, deal.id, 1.2);
  ops.investQuality(e.g, fund.id, deal.id, 50_000_000);
  ops.expandPortfolioStore(e.g, fund.id, deal.id);
  ops.exitPortfolioCompany(e.g, fund.id, deal.id, { week: 21 });
  assert.equal(e.g.companyCash, companyCashBefore, 'companyCash must be completely untouched by portfolio operations');
  assert.ok(deal.exitSettlement, 'T17: an exit records its settlement');
  // T21: 個人資産に入るのはキャリーとGP出資持分への分配のみ（このフィクスチャは gpCommit=0 なので後者は0）。
  const expectedPersonalMove = deal.exitSettlement.gpCarry + deal.exitSettlement.gpPrincipalAndGain;
  assert.ok(Math.abs((e.g.personalCash - personalCashBefore) - expectedPersonalMove) < 1e-6, 'personalCash moves by exactly the GP carry plus the GP capital share and nothing else');
}

// 8. findFundAndDeal / ensure are safe on missing funds/deals.
{
  const { e } = bigFund();
  assert.deepEqual(ops.findFundAndDeal(e.g, 'nope', 'nope'), { fund: null, deal: null });
  assert.equal(ops.setPriceMultiplier(e.g, 'nope', 'nope', 1), null);
  assert.equal(ops.investQuality(e.g, 'nope', 'nope', 1), null);
  assert.equal(ops.expandPortfolioStore(e.g, 'nope', 'nope'), null);
  assert.equal(ops.exitPortfolioCompany(e.g, 'nope', 'nope', {}), null);
}

// 9. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-portfolio-operations.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe portfolio operations tests passed');
