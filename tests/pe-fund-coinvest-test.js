'use strict';

// PE mode T12 (docs/PE_MODE_TASKS.md): co-investment -- LPs adding per-deal capital so a fund
// can write deals beyond its 25%-of-fund diversification cap, at half carry on that slice.

const assert = require('node:assert/strict');
const fs = require('node:fs');

function load() {
  delete globalThis.__capitalismTycoonModules;
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
  globalThis.document = { addEventListener() {} };
  globalThis.window = globalThis;
  for (const m of ['../js/runtime.js', '../js/data.js', '../js/store-market-environment.js', '../js/workforce.js', '../js/supply.js', '../js/competitor.js', '../js/competitor-projects.js', '../js/competitor-entry.js', '../js/competitor-credit.js', '../js/competitor-distress.js', '../js/market.js', '../js/finance.js', '../js/engine.js', '../js/completion.js', '../js/pe-fund.js']) {
    delete require.cache[require.resolve(m)];
    require(m);
  }
  const modules = globalThis.__capitalismTycoonModules;
  return { modules, TycoonEngine: modules.engine.TycoonEngine, pf: modules.peFund };
}
const { TycoonEngine, pf } = load();

function fundOf(size, score) {
  const e = new TycoonEngine();
  return pf.createFund(e.g, { size, y0: 1, terms: pf.fundTermsForScore(score) });
}

// 1. Coinvest capacity is exactly 1x fund size (設計書§14 採用値).
{
  const fund = fundOf(10_000_000_000, 35);
  assert.equal(pf.coinvestCapacity(fund), 10_000_000_000);
  assert.equal(pf.coinvestCommitted(fund), 0);
  assert.equal(pf.coinvestRemaining(fund), 10_000_000_000);
}

// 2. Without co-investment, a deal above the 25% cap is truncated at the cap and the excess is
// reported as rejected -- the fund alone cannot exceed its diversification limit.
{
  const fund = fundOf(10_000_000_000, 35); // cap = 2.5B
  const plan = pf.planDealFinancing(fund, 4_000_000_000, false);
  assert.equal(plan.fundPortion, 2_500_000_000);
  assert.equal(plan.coinvestPortion, 0);
  assert.equal(plan.rejectedAmount, 1_500_000_000);
  assert.equal(plan.blendedCarryRate, fund.terms.carry, 'no coinvest used -> full carry, unblended');
}

// 3. Completion criterion: with co-investment, a deal beyond the 25% cap can be fully financed
// (fund portion up to the cap, the rest from coinvest capacity).
{
  const fund = fundOf(10_000_000_000, 35); // cap 2.5B, coinvest capacity 10B
  const plan = pf.planDealFinancing(fund, 4_000_000_000, true);
  assert.equal(plan.fundPortion, 2_500_000_000);
  assert.equal(plan.coinvestPortion, 1_500_000_000);
  assert.equal(plan.rejectedAmount, 0, 'ample coinvest capacity must fully cover the excess');
}

// 4. A deal within the 25% cap is unaffected by the useCoinvest flag (no coinvest needed).
{
  const fund = fundOf(10_000_000_000, 35);
  const plan = pf.planDealFinancing(fund, 2_000_000_000, true);
  assert.equal(plan.fundPortion, 2_000_000_000);
  assert.equal(plan.coinvestPortion, 0);
  assert.equal(plan.blendedCarryRate, fund.terms.carry);
}

// 5. Completion criterion: co-investment carry is exactly half of full carry, blended
// proportionally across the fund/coinvest split.
{
  const fund = fundOf(10_000_000_000, 35); // terms.carry = carryRate(35) = .15+.10*.35 = .185
  const plan = pf.planDealFinancing(fund, 5_000_000_000, true); // fund 2.5B, coinvest 2.5B (50/50)
  const fullCarry = fund.terms.carry;
  const halfCarry = fullCarry * pf.COINVEST_CARRY_FACTOR;
  assert.ok(Math.abs(halfCarry - fullCarry / 2) < 1e-12);
  const expectedBlended = (2_500_000_000 * fullCarry + 2_500_000_000 * halfCarry) / 5_000_000_000;
  assert.ok(Math.abs(plan.blendedCarryRate - expectedBlended) < 1e-9);
  assert.ok(Math.abs(plan.blendedCarryRate - fullCarry * .75) < 1e-9, '50/50 split at half-carry on one side must land at 75% of full carry');
}

// 6. Coinvest capacity is a hard cap: exceeding it leaves a genuine rejectedAmount even with
// useCoinvest=true, and recordCoinvestment never over-commits.
{
  const fund = fundOf(1_000_000_000, 5); // cap 250M, coinvest capacity 1B
  const plan = pf.planDealFinancing(fund, 3_000_000_000, true); // needs 2.75B of coinvest, only 1B available
  assert.equal(plan.fundPortion, 250_000_000);
  assert.equal(plan.coinvestPortion, 1_000_000_000);
  assert.equal(plan.rejectedAmount, 1_750_000_000, 'a deal that exceeds fund cap + full coinvest capacity cannot be fully financed');

  // state を渡さない呼び出し（枠の計算だけを見る）。共同投資家の勘定への記録は
  // tests/pe-coinvest-ledger-test.js で検証する。
  const used1 = pf.recordCoinvestment(null, fund, 600_000_000);
  assert.equal(used1, 600_000_000);
  assert.equal(pf.coinvestCommitted(fund), 600_000_000);
  const used2 = pf.recordCoinvestment(null, fund, 600_000_000); // only 400M of capacity left
  assert.equal(used2, 400_000_000, 'recordCoinvestment must clamp to remaining capacity, not honor the full request');
  assert.equal(pf.coinvestCommitted(fund), 1_000_000_000);
  assert.equal(pf.coinvestRemaining(fund), 0);
  assert.equal(pf.recordCoinvestment(null, fund, 1), 0, 'no capacity left at all');
}

// 7. Completion criterion / 設計書「管理報酬は共同投資分にはかからない」: annualManagementFee
// is a pure function of fund.size and terms.fee -- committing coinvestment must never change it.
{
  const fund = fundOf(10_000_000_000, 35);
  const before = pf.annualManagementFee(fund);
  pf.recordCoinvestment(null, fund, 9_000_000_000);
  const after = pf.annualManagementFee(fund);
  assert.equal(before, after, 'management fee base must be unaffected by coinvest commitments');
  assert.ok(Math.abs(before - fund.size * fund.terms.fee) < 1e-6);
}

// 8. Safe on a null/absent fund.
{
  assert.equal(pf.coinvestCapacity(null), 0);
  assert.equal(pf.coinvestRemaining(null), 0);
  assert.equal(pf.annualManagementFee(null), 0);
  assert.equal(pf.recordCoinvestment(null, null, 100), 0);
}

// 9. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-fund.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe fund co-investment tests passed');
