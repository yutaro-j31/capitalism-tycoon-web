'use strict';

// T26: PEで動く現金のsource/destinationを固定する会計保存則テスト。
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function makeRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }
const main = loadGame({ random: makeRandom(26), isolatedLegacyIndex: true });
const { engineModule, modules } = main;
const pf = modules.peFund;

function engineWithCash() {
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'GP', companyName: 'GP法人', difficulty: 'normal' });
  e.g.personalCash = 20_000_000_000;
  e.g.companyCash = 5_000_000_000;
  return e;
}

// 1. GP + LP拠出 → acquisition → exit のclaim reconciliation。
{
  const e = engineWithCash();
  const personalBefore = e.g.personalCash;
  const companyBefore = e.g.companyCash;
  const fund = pf.createFund(e.g, { size: 10_000_000_000, gpCommit: 2_000_000_000, terms: { fee: .02, carry: .20, hurdle: 0 }, y0: 1 });
  assert.equal(personalBefore - e.g.personalCash, fund.gpCommit, 'GP commitment source is personal cash');
  assert.equal(fund.cash, fund.gpCommit + fund.lpContributed, 'initial fund cash has only GP and LP sources');

  const fundInvestment = 1_000_000_000;
  const coinvestInvestment = pf.recordCoinvestment(fund, 1_000_000_000);
  fund.cash -= fundInvestment;
  assert.equal(pf.spendCoinvestment(fund, coinvestInvestment), coinvestInvestment, 'co-invest pool pays its acquisition slice');
  assert.equal(fund.coinvestCash, 0, 'co-invest cash is not duplicated after seller payment');
  assert.equal(fund.coinvestContributed, coinvestInvestment, 'LP co-invest contribution is recorded once');
  assert.equal(fund.cash, 9_000_000_000, 'fund pays only its ownership slice');
  assert.equal(e.g.companyCash, companyBefore, 'acquisition does not touch management-company cash');

  const deal = { id: 'ledger-deal', fundPortion: fundInvestment, coinvestPortion: coinvestInvestment, acquiredWeek: 1 };
  const personalBeforeExit = e.g.personalCash;
  const settlement = pf.settleExitProceeds(e.g, fund, deal, 4_000_000_000, 53);
  assert.equal(settlement.fundPrincipalReturned, fundInvestment);
  assert.equal(settlement.coinvestPrincipalReturned, coinvestInvestment);
  assert.equal(settlement.fundCarry, 200_000_000);
  assert.equal(settlement.coinvestCarry, 100_000_000);
  assert.equal(fund.distributed, 1_800_000_000, 'fund investors receive only the fund slice net of carry');
  assert.equal(fund.coinvestReturned, 1_900_000_000, 'co-investors receive only their slice net of reduced carry');
  assert.equal(fund.gpDistributed, 360_000_000, 'GP ownership claim receives its pro-rata fund distribution');
  assert.equal(fund.lpDistributed, 1_440_000_000, 'LP ownership claim receives the remainder');
  assert.equal(fund.gpCarryPaid, 300_000_000, 'full and reduced carry are accumulated once');
  assert.equal(e.g.personalCash - personalBeforeExit, 660_000_000, 'personal receives GP claim plus carry exactly once');
  assert.equal(pf.settleExitProceeds(e.g, fund, deal, 4_000_000_000, 53), settlement, 'exit settlement is idempotent');
  assert.equal(e.g.personalCash - personalBeforeExit, 660_000_000, 'reprocessing exit creates no cash');
}

// 2. Annual management fee: fund cash → GP法人 company cash, once per anniversary.
{
  const e = engineWithCash();
  const fund = pf.createFund(e.g, { size: 10_000_000_000, gpCommit: 2_000_000_000, terms: { fee: .02, carry: .20, hurdle: .08 }, y0: 1 });
  const fundBefore = fund.cash;
  const companyBefore = e.g.companyCash;
  const pretaxBefore = Number(e.g.quarterlyPretaxProfit) || 0;
  pf.processFundsWeek(e.g, 53);
  assert.equal(fundBefore - fund.cash, 200_000_000, 'fund is the explicit fee payer');
  assert.equal(e.g.companyCash - companyBefore, 200_000_000, 'GP法人 is the explicit fee receiver');
  assert.equal(e.g.quarterlyPretaxProfit - pretaxBefore, 200_000_000, 'management fee is taxable GP法人 revenue');
  assert.equal(fund.managementFeesPaid, 200_000_000);
  assert.equal(fund.lastManagementFeePeriod, 1);
  const transaction = e.g.finance.transactions.find(t => t.idempotencyKey === `pe-management-fee-${fund.id}-p1`);
  assert.ok(transaction, 'management-company ledger records the receipt');
  assert.equal(transaction.cashEffect, 200_000_000);
  const snapshot = JSON.stringify({ fundCash: fund.cash, companyCash: e.g.companyCash, paid: fund.managementFeesPaid, tx: e.g.finance.transactions.length });
  pf.processFundsWeek(e.g, 53);
  assert.equal(JSON.stringify({ fundCash: fund.cash, companyCash: e.g.companyCash, paid: fund.managementFeesPaid, tx: e.g.finance.transactions.length }), snapshot, 'same period cannot pay twice');

  const loaded = new engineModule.TycoonEngine(JSON.parse(JSON.stringify(e.g)));
  const loadedFund = loaded.g.peFirm.funds.find(f => f.id === fund.id);
  pf.processFundsWeek(loaded.g, 53);
  assert.equal(loadedFund.managementFeesPaid, 200_000_000, 'save/load does not replay a paid period');
}

// 3. T26以前の途中saveは過去年次分をload直後に遡及請求しない。
{
  const e = engineWithCash();
  e.g.week = 210;
  e.g.peFirm = { unlocked: true, trackRecord: { score: 20, exits: [], realizedDPI: 0 }, funds: [{
    id: 'legacy-fund', size: 10_000_000_000, gpCommit: 2_000_000_000, lpContributed: 8_000_000_000,
    cash: 5_000_000_000, distributed: 0, deals: [], terms: { fee: .02, carry: .20, hurdle: .08 },
    y0: 1, status: 'investing', lastProcessedWeek: 209
  }] };
  pf.ensure(e.g);
  const fund = e.g.peFirm.funds[0];
  assert.equal(fund.lastManagementFeePeriod, 4, 'legacy marker starts at the already-processed anniversary');
  const cashBefore = fund.cash;
  pf.processFundsWeek(e.g, 210);
  assert.equal(fund.cash, cashBefore, 'legacy load does not back-charge management fees');
}

console.log('PE accounting model tests passed');
