'use strict';

// T26 (docs/PE_MODE_TASKS.md): 会計モデルの完成.
//   26-1 共同投資の cash ledger（出資元・返却先の勘定と、共同投資を含めた現金保存則）
//   26-2 management fee を経済に接続（ファンド→会社の収益→チームの人件費）
// Codex T21再監査 GAME-REAUDIT-001 / 005 に対応する。

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function makeRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }
const main = loadGame({ random: makeRandom(29), isolatedLegacyIndex: true });
const { engineModule, modules } = main;
const pf = modules.peFund, ops = modules.pePortfolioOperations;

function firm({ personalCash = 100_000_000_000, companyCash = 10_000_000_000 } = {}) {
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'GP', companyName: 'PE', difficulty: 'normal' });
  e.g.personalCash = personalCash;
  e.g.companyCash = companyCash;
  return e;
}
// 系全体の現金（プレイヤーの口座＋ファンド＋保有企業＋共同投資家の勘定）。
function systemCash(g) {
  const funds = g.peFirm?.funds || [];
  const inFunds = funds.reduce((sum, f) => sum + Math.max(0, Number(f.cash) || 0)
    + (f.deals || []).reduce((s, d) => s + (d.status === 'active' ? Math.max(0, Number(d.investedAmount) || 0) + Math.max(0, Number(d.portfolioCompany?.cash) || 0) : 0), 0), 0);
  return (Number(g.personalCash) || 0) + (Number(g.companyCash) || 0) + inFunds + Math.max(0, Number(g.peFirm?.coinvestCapital) || 0);
}
// プレイヤーの外から入った資金の累計（LP拠出＋共同投資の拠出）。
function externalInflow(g) {
  const funds = g.peFirm?.funds || [];
  return funds.reduce((sum, f) => sum + Math.max(0, Number(f.lpContributed) || 0), 0)
    + Math.max(0, Number(g.peFirm?.coinvestContributed) || 0);
}

// 1. 26-1: 共同投資の勘定が state に存在し、旧セーブでは既存の累計から復元される。
{
  const e = firm();
  assert.equal(e.g.peFirm.coinvestContributed, 0);
  assert.equal(e.g.peFirm.coinvestCapital, 0);
  // 旧セーブ（勘定が無く、ファンド側の累計だけがある）から復元する。
  e.g.peFirm = { trackRecord: { score: 0, exits: [], realizedDPI: 0 }, unlocked: true, funds: [
    { id: 'legacy', size: 10_000_000_000, gpCommit: 0, cash: 0, distributed: 0, y0: 1, status: 'harvesting', terms: { fee: .02, carry: .2, hurdle: .08 }, deals: [], coinvestCommitted: 3_000_000_000, coinvestReturned: 4_000_000_000 }
  ] };
  e.normalize();
  assert.equal(e.g.peFirm.coinvestContributed, 3_000_000_000, '出資済み累計はファンド側の累計から復元される');
  assert.equal(e.g.peFirm.coinvestCapital, 4_000_000_000, '返却残高も復元される');
}

// 2. 26-1: 出資は共同投資家の勘定を通り、ファンドの現金からは出ない。
{
  const e = firm();
  const fund = pf.createFund(e.g, { size: 20_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const fundCashBefore = fund.cash, personalBefore = e.g.personalCash;
  const used = pf.recordCoinvestment(e.g, fund, 5_000_000_000);
  assert.equal(used, 5_000_000_000);
  assert.equal(e.g.peFirm.coinvestContributed, 5_000_000_000, '共同投資の拠出が記録される');
  assert.equal(fund.coinvestCommitted, 5_000_000_000);
  assert.equal(fund.cash, fundCashBefore, '共同投資はファンドの現金を使わない');
  assert.equal(e.g.personalCash, personalBefore, '共同投資はプレイヤーの現金でもない');
}

// 3. 26-1: Exitの返却は共同投資家の勘定に入り、ファンドの分配（DPIの分子）には混ざらない。
{
  const e = firm();
  const fund = pf.createFund(e.g, { size: 20_000_000_000, gpCommit: 4_000_000_000, terms: { fee: .02, carry: .2, hurdle: 0 }, y0: 1 });
  fund.distributed = 0;
  pf.recordCoinvestment(e.g, fund, 1_000_000_000);
  const deal = { id: 'd-co', fundPortion: 1_000_000_000, coinvestPortion: 1_000_000_000, acquiredWeek: 52 };
  const capitalBefore = e.g.peFirm.coinvestCapital;
  const s = pf.settleExitProceeds(e.g, fund, deal, 4_000_000_000, 156);
  assert.ok(s.returnedToCoinvestors > 0);
  assert.ok(Math.abs((e.g.peFirm.coinvestCapital - capitalBefore) - s.returnedToCoinvestors) < 1, '返却は共同投資家の勘定へ入る');
  assert.ok(Math.abs(fund.distributed - s.distributedToFund) < 1, 'ファンドの分配には共同投資分が混ざらない');
  // 共同投資分のキャリーはフルの半分（設計書§14）— T17からの契約を維持する。
  assert.ok(Math.abs(s.coinvestCarry - s.fundCarry * pf.COINVEST_CARRY_FACTOR) < 1);
}

// 4. 26-1 完了条件: 共同投資を含めた現金保存則。
//    系全体の現金（個人＋会社＋ファンド＋保有企業＋共同投資家の勘定）の増減は、
//    次の4つだけで説明できること。どれにも当てはまらない増減があれば現金が生まれている。
//      + 外から入った資金（LP拠出 + 共同投資の拠出）
//      + 保有企業が稼いだ営業利益（顧客から入る）
//      − チームの人件費（系の外への支出）
//      − LPへの分配（ファンドの分配のうちGP持分でない部分。出資者へ返る）
{
  const e = firm();
  const before = systemCash(e.g), inflowBefore = externalInflow(e.g);
  const fund = pf.createFund(e.g, { size: 20_000_000_000, gpCommit: 4_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  // 分散義務（25%＝50億）を超える案件なので、超過分が共同投資で埋まる＝共同投資の現金が実際に入る。
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: 8_000_000_000, useCoinvest: true, week: 1 });
  assert.ok(deal && deal.coinvestPortion > 0, '共同投資が実際に使われている');
  for (let w = 2; w <= 200; w++) { pf.processFundsWeek(e.g, w); ops.processDealWeek(fund, deal, w); }
  // Exitは系の外（買い手）との取引: 保有していた資産（投下額＋社内現金）が売却代金に替わる。
  const pcCashAtExit = deal.portfolioCompany.cash;
  ops.exitPortfolioCompany(e.g, fund.id, deal.id, { week: 201 });
  const saleGain = (Number(deal.exitProceeds) || 0) - ((Number(deal.investedAmount) || 0) + pcCashAtExit);
  const funds = e.g.peFirm.funds;
  const payroll = funds.reduce((s, f) => s + (Number(f.teamPayrollPaid) || 0), 0);
  const lpDistribution = funds.reduce((s, f) => s + Math.max(0, (Number(f.distributed) || 0) - (Number(f.gpDistributed) || 0)), 0);
  const operating = (deal.portfolioCompany.profitHistory || []).reduce((s, x) => s + Number(x), 0);
  const after = systemCash(e.g), inflowAfter = externalInflow(e.g);
  const explained = (inflowAfter - inflowBefore) + operating + saleGain - payroll - lpDistribution;
  assert.ok(Math.abs((after - before) - explained) < Math.max(1, Math.abs(explained) * 1e-9),
    `保存則: 実測${Math.round(after - before)} / 説明${Math.round(explained)}`);
  assert.ok(payroll > 0, 'チームの人件費が実際に支払われている');
  assert.ok(lpDistribution > 0, 'LPへ分配されている');
  assert.ok(e.g.peFirm.coinvestContributed > 0, '共同投資の拠出が記録されている');
  assert.ok(e.g.peFirm.coinvestCapital > 0, '共同投資家へ返却されている');
}

// 5. 26-2: 管理報酬がファンドの現金から会社（GP）へ移り、そこからチームの人件費が出る。
{
  const e = firm({ companyCash: 0 });
  const fund = pf.createFund(e.g, { size: 100_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const fundCashBefore = fund.cash;
  for (let w = 2; w <= 53; w++) pf.processFundsWeek(e.g, w);
  const annualFee = pf.annualManagementFee(fund);
  assert.ok(Math.abs(fund.managementFeePaid - annualFee) < annualFee * .05, `1年で年額ぶんの報酬が動く（実測 ${Math.round(fund.managementFeePaid)} / 年額 ${Math.round(annualFee)}）`);
  assert.ok(Math.abs((fundCashBefore - fund.cash) - fund.managementFeePaid) < 1, 'ファンドの現金は報酬ぶんだけ減る');
  const expectedPayroll = pf.teamCapacity(fund) * pf.MANAGEMENT_FEE_PER_HEAD;
  assert.ok(Math.abs(fund.teamPayrollPaid - expectedPayroll) < expectedPayroll * .05, `チーム人件費は1人あたり年${pf.MANAGEMENT_FEE_PER_HEAD}円（実測 ${Math.round(fund.teamPayrollPaid)} / 期待 ${expectedPayroll}）`);
  assert.ok(Math.abs(e.g.companyCash - (fund.managementFeePaid - fund.teamPayrollPaid)) < 1, '会社に残るのは報酬−人件費');
  // 設計書§4: チーム上限(60人)を超えた分の報酬は素直に利益になる。
  assert.equal(pf.teamCapacity(fund), pf.TEAM_CAP, 'この規模ではチームは上限に張り付く');
  assert.ok(fund.managementFeePaid > fund.teamPayrollPaid, '超過分は会社の利益として残る');
}

// 6. 26-2: 会計は finance の取引として記録される（収益と人件費の両方）。
{
  const e = firm({ companyCash: 0 });
  const fund = pf.createFund(e.g, { size: 50_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  for (let w = 2; w <= 30; w++) pf.processFundsWeek(e.g, w); // 四半期課金なので13週目・26週目に課金される
  const tx = e.g.finance.transactions || [];
  const fees = tx.filter(t => t.sourceType === 'peManagementFee');
  const payrolls = tx.filter(t => t.sourceType === 'peTeamPayroll');
  assert.ok(fees.length > 0, '管理報酬が取引として記録される');
  assert.ok(payrolls.length > 0, 'チーム人件費が取引として記録される');
  assert.equal(fees[0].category, 'revenue');
  assert.equal(payrolls[0].category, 'payroll');
  assert.ok(fees[0].cashEffect > 0 && payrolls[0].cashEffect < 0);
  // 同じ週を二重に処理しても二重計上しない（idempotencyKey）。
  const before = tx.length;
  fund.lastProcessedWeek = 0;
  pf.processFundsWeek(e.g, 26);
  assert.equal((e.g.finance.transactions || []).length, before, '同じ週の報酬は二重計上されない');
}

// 7. 26-2: ファンドの現金が尽きたら報酬は止まる（マイナスにならない）。
{
  const e = firm({ companyCash: 0 });
  const fund = pf.createFund(e.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  fund.cash = 1_000_000; // ほぼ空
  for (let w = 2; w <= 60; w++) pf.processFundsWeek(e.g, w);
  assert.ok(fund.cash >= 0, 'ファンドの現金がマイナスにならない');
  assert.ok(fund.managementFeePaid <= 1_000_000 + 1, '払えるのは残高までl'.slice(0, -1));
}

// 8. 26-0: ventureForumEvents に上限がある（push で積むので末尾＝最新を残す）。
{
  const caps = engineModule.LOG_ARRAY_TAIL_CAPS;
  assert.ok(Number.isInteger(caps.ventureForumEvents) && caps.ventureForumEvents > 0);
  const e = firm();
  const cap = caps.ventureForumEvents;
  e.g.ventureForumEvents = Array.from({ length: cap + 40 }, (_, i) => ({ id: `f-${i}`, status: 'expired', expiresWeek: i }));
  e.normalize();
  assert.equal(e.g.ventureForumEvents.length, cap, '上限まで切り詰められる');
  assert.equal(e.g.ventureForumEvents[cap - 1].id, `f-${cap + 39}`, '末尾＝最新が残る');
}

// 9. 決定論: 同じ操作列は同じ結果になる（報酬・共同投資の勘定を含めて）。
{
  const run = () => {
    const e = firm();
    const fund = pf.createFund(e.g, { size: 20_000_000_000, gpCommit: 4_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
    pf.recordCoinvestment(e.g, fund, 2_000_000_000);
    const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: 4_000_000_000, week: 1 });
    for (let w = 2; w <= 120; w++) { pf.processFundsWeek(e.g, w); ops.processDealWeek(fund, deal, w); }
    ops.exitPortfolioCompany(e.g, fund.id, deal.id, { week: 121 });
    return JSON.stringify({ fund, coinvestCapital: e.g.peFirm.coinvestCapital, contributed: e.g.peFirm.coinvestContributed, company: e.g.companyCash, personal: e.g.personalCash });
  };
  assert.equal(run(), run());
}

console.log('pe coinvest ledger / management fee tests passed');
