'use strict';

// PE mode T21 (docs/PE_MODE_TASKS.md): GP出資の会計とファンド組成の入口.
//   21-1 GP出資が個人資産から引かれ、系全体の現金総額が保存されること（会計整合性）
//   21-2 プレイヤー操作でFund Iを組成でき、Fund II以降も同じアクションを通ること
//   21-3 PE案件のDDがファンド指定なしでも（稼働中1本なら）開始できること
// Uses the full VM harness because formPEFund / startMADueDiligence are engine actions and the
// deal-supply wrapper only installs after js/app.js has run.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function makeRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }
function freshLoad(seed) { return loadGame({ random: makeRandom(seed), isolatedLegacyIndex: true }); }

const main = freshLoad(53);
const { engineModule, modules } = main;
const pf = modules.peFund, ds = modules.peDealSupply;

function setupFirm({ handles = main, personalCash = 30_000_000_000, companyCash = 50_000_000_000, exits = 1 } = {}) {
  const e = new handles.engineModule.TycoonEngine();
  e.configure({ playerName: 'GP', companyName: 'PEパートナーズ', difficulty: 'normal' });
  e.g.departments.investment = { established: true };
  e.g.departmentStaff.investment = 9;
  e.g.executives.CSO = { role: 'CSO', skill: 80 };
  e.g.executives.CFO = { role: 'CFO', skill: 80 };
  e.g.companyCash = companyCash;
  for (let i = 0; i < exits; i++) handles.modules.peFund.recordExit(e.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
  e.g.personalCash = personalCash;
  return e;
}
// 系全体の現金。ファンドの現金・保有企業の現金まで含めて数える。
function systemCash(g) {
  const funds = g.peFirm?.funds || [];
  return (Number(g.personalCash) || 0) + (Number(g.companyCash) || 0)
    + funds.reduce((sum, f) => sum + (Number(f.cash) || 0) + (f.deals || []).reduce((s, d) => s + (Number(d.portfolioCompany?.cash) || 0), 0), 0);
}

// 1. 完了条件: ファンド組成前後で系全体の現金総額が保存される。
//    プレイヤーの外から入る資金はLP拠出だけで、その額は必ず記録される。
{
  const e = setupFirm({});
  const personalBefore = e.g.personalCash, companyBefore = e.g.companyCash, systemBefore = systemCash(e.g);
  assert.equal(e.formPEFund(), true, 'Fund I must be formable');
  const fund = e.g.peFirm.funds[0];
  assert.ok(fund.gpCommit > 0, 'GP出資がゼロではない');
  assert.equal(fund.lpContributed, fund.size - fund.gpCommit, 'LP拠出＝規模−GP出資');
  assert.equal(fund.cash, fund.gpCommit + fund.lpContributed, 'fund.cash の出どころはGP出資とLP拠出だけ');
  assert.equal(e.g.personalCash, personalBefore - fund.gpCommit, 'GP出資は個人資産から引かれる');
  assert.equal(e.g.companyCash, companyBefore, '会社の現金はファンド組成に関与しない');
  assert.equal(systemCash(e.g), systemBefore + fund.lpContributed, '系全体の現金は「LP拠出ぶんだけ」増える（無から生まれない）');
}

// 2. 完了条件: 個人資産が不足していると組成が拒否され、状態は一切変わらない。
{
  const e = setupFirm({ personalCash: 0 });
  const before = JSON.stringify({ p: e.g.personalCash, c: e.g.companyCash, f: e.g.peFirm.funds.length });
  const plan = e.formablePEFund();
  assert.equal(plan.ok, false, '個人資産ゼロでは組成計画が立たない');
  assert.equal(e.formPEFund(), false, '組成は拒否される');
  assert.equal(JSON.stringify({ p: e.g.personalCash, c: e.g.companyCash, f: e.g.peFirm.funds.length }), before, '拒否された組成は状態を変えない');
  // createFund を直接叩いても、個人資産が足りなければ何も起きない。
  const e2 = setupFirm({ personalCash: 1_000_000 });
  const personalBefore = e2.g.personalCash;
  assert.equal(pf.createFund(e2.g, { size: 10_000_000_000, gpCommit: 2_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 } }), null);
  assert.equal(e2.g.personalCash, personalBefore, '拒否された createFund は個人資産を動かさない');
  assert.equal(e2.g.peFirm.funds.length, 0, '拒否された createFund はファンドを積まない');
}

// 3. 解禁条件: Exit経験が無ければ組成できない。
{
  const e = setupFirm({ exits: 0 });
  assert.equal(e.g.peFirm.unlocked, false);
  assert.equal(e.formablePEFund().reason, 'locked');
  assert.equal(e.formPEFund(), false, 'PEモードが解禁されていなければ組成できない');
  assert.equal(e.g.peFirm.funds.length, 0);
}

// 4. 完了条件: Fund II 以降も同じアクションを通り、次号ゲートを満たす場合だけ実行できる。
{
  const e = setupFirm({});
  assert.equal(e.formPEFund(), true);
  const fundI = e.g.peFirm.funds[0];
  assert.equal(e.formablePEFund().reason, 'gate', 'ゲート未達では次号を組成できない');
  assert.equal(e.formPEFund(), false);
  assert.equal(e.g.peFirm.funds.length, 1);
  // DPI 1.2以上・資金消化80%以上を満たせば、同じアクションで組成できる。
  fundI.deals.push({ id: 'synthetic', status: 'exited', investedAmount: fundI.size * .9, fundPortion: fundI.size * .9, coinvestPortion: 0 });
  fundI.cash = 0;
  pf.distributeToInvestors(e.g, fundI, fundI.size * 1.5);
  assert.equal(pf.canFormNextFund(e.g), true);
  const personalBefore = e.g.personalCash, systemBefore = systemCash(e.g);
  assert.equal(e.formPEFund(), true, 'ゲートを満たせば同じアクションでFund IIを組成できる');
  const fundII = e.g.peFirm.funds[1];
  assert.ok(fundII && fundII.id !== fundI.id);
  assert.equal(e.g.personalCash, personalBefore - fundII.gpCommit, 'Fund IIのGP出資も個人資産から出る');
  assert.equal(systemCash(e.g), systemBefore + fundII.lpContributed, 'Fund IIでも保存則が成り立つ');
  assert.ok(fundII.lps.length > 0, 'LP構成が確定している');
  assert.ok(fundII.lps.length <= pf.MAX_LPS_PER_FUND);
}

// 5. 完了条件: Exit時にGP出資の元本が個人資産へ戻る（従来はキャリーだけだった）。
{
  const e = setupFirm({});
  const fund = pf.createFund(e.g, { size: 10_000_000_000, gpCommit: 2_000_000_000, terms: { fee: .02, carry: .2, hurdle: 0 }, y0: 1 });
  assert.ok(fund);
  const share = pf.gpShareOfFund(fund);
  assert.ok(Math.abs(share - .2) < 1e-9, 'GP持分＝gpCommit/size');
  const personalBefore = e.g.personalCash;
  // 投下10億が2倍で戻る案件。ハードル0なので利益10億、キャリー20%=2億。
  const settlement = pf.settleExitProceeds(e.g, fund, { id: 'd1', fundPortion: 1_000_000_000, coinvestPortion: 0, acquiredWeek: 52 }, 2_000_000_000, 156);
  const expectedCarry = 200_000_000;
  const expectedDistribution = 2_000_000_000 - expectedCarry;
  const expectedGPPrincipal = expectedDistribution * share;
  assert.ok(Math.abs(settlement.gpCarry - expectedCarry) < 1, 'キャリーは従来どおり');
  assert.ok(Math.abs(settlement.gpPrincipalAndGain - expectedGPPrincipal) < 1, 'GP出資分の元本・利益が分配から戻る');
  assert.ok(Math.abs((e.g.personalCash - personalBefore) - (expectedCarry + expectedGPPrincipal)) < 1, '個人資産にはキャリーとGP持分の両方が入る');
  assert.ok(Math.abs(fund.gpDistributed - expectedGPPrincipal) < 1, 'GPが受け取った分配額が記録される');
  assert.ok(Math.abs(fund.distributed - expectedDistribution) < 1, 'DPIの分子はファンド全体の分配額のまま');
}

// 6. 未投資返却（投資期間終了・満期）でもGP持分は個人資産へ戻る。
{
  const e = setupFirm({});
  const fund = pf.createFund(e.g, { size: 10_000_000_000, gpCommit: 2_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const personalBefore = e.g.personalCash, cashInFund = fund.cash;
  // 投資期間の全週を処理する（管理報酬は四半期ごとに課金されるので、途中の課金週も通す）。
  for (let w = fund.y0 + 1; w <= fund.y0 + pf.INVESTMENT_PERIOD_WEEKS; w++) pf.processFundsWeek(e.g, w);
  assert.equal(fund.status, 'harvesting');
  assert.equal(fund.cash, 0);
  // T26-2以降、同じ週に管理報酬がファンドの現金から引かれる（会社＝GPへ移る）ので、
  // 未投資返却されるのは「報酬を引いた残り」。返却額そのものは undeployedReturned が持つ。
  assert.ok(fund.managementFeePaid > 0, '管理報酬が引かれている');
  assert.ok(Math.abs(fund.undeployedReturned - (cashInFund - fund.managementFeePaid)) < 1, '返却額＝元の現金−管理報酬');
  assert.ok(Math.abs((e.g.personalCash - personalBefore) - fund.undeployedReturned * .2) < 1, '未投資返却のうちGP持分は個人資産へ戻る');
}

// 7. 完了条件: プレイヤー操作でFund Iを組成 → 案件が供給され → DDが開始でき → 取得まで到達する。
//    DDはファンドを指定しなくても、稼働中が1本なら自動選択される（21-3）。
{
  const e = setupFirm({});
  assert.equal(e.formPEFund(), true);
  const fund = e.g.peFirm.funds[0];
  let target = null;
  for (let i = 0; i < 80 && !target; i++) { e.advanceWeek(false); target = e.g.acquisitionTargets.filter(ds.isPETarget)[0] || null; }
  assert.ok(target, '組成後、週を進めるだけでPE案件が供給される');
  assert.equal(e.openMADealRoom(target.id), true);
  const deal = e.g.maDealRooms.find(d => d.targetID === target.id);
  const slotsBefore = pf.ddSlotsRemaining(e.g, e.g.week);
  assert.equal(e.startMADueDiligence(deal.id, 'screening'), true, 'ファンド指定なしでもDDを開始できる（稼働中1本）');
  assert.equal(deal.fundID, fund.id, '自動選択されたファンドが案件に刻まれる');
  assert.equal(pf.ddSlotsRemaining(e.g, e.g.week), slotsBefore - 1, 'DD枠は1つだけ消費される');
  for (let i = 0; i < 6 && deal.status === 'diligence'; i++) e.advanceWeek(false);
  assert.equal(deal.status, 'ready');
  const price = Math.ceil(e.calculateMAAcquisitionPrice(target, 'friendly').minimumPrice * 1.02);
  e.setPEDealCoinvest(deal.id, true);
  assert.equal(e.submitMAOffer(deal.id, { method: 'friendly', offerPrice: price }), true);
  for (let i = 0; i < 4 && deal.status === 'offer_pending'; i++) e.advanceWeek(false);
  assert.equal(deal.status, 'accepted');
  const fundCashBefore = fund.cash, companyCashBefore = e.g.companyCash;
  assert.equal(e.closeMADeal(deal.id), true, '取得まで到達する');
  const held = fund.deals[fund.deals.length - 1];
  assert.ok(held && held.status === 'active');
  assert.equal(e.g.companyCash, companyCashBefore, '取得価格は会社の現金から出ない');
  assert.ok(fund.cash < fundCashBefore, '取得価格はファンドの現金から出る');
}

// 8. 稼働中ファンドが2本あるときは自動で決めず、指定を求める。
{
  const e = setupFirm({});
  assert.equal(e.formPEFund(), true);
  const fundA = e.g.peFirm.funds[0];
  // 2本目を（ゲートを満たさせて）作る。
  fundA.deals.push({ id: 'synthetic', status: 'exited', investedAmount: fundA.size * .9, fundPortion: fundA.size * .9, coinvestPortion: 0 });
  pf.distributeToInvestors(e.g, fundA, fundA.size * 1.5);
  assert.equal(e.formPEFund(), true);
  assert.equal(ds.investingFunds(e.g).length, 2);
  assert.equal(ds.resolveInvestingFund(e.g, null), null, '2本あれば自動選択しない');
  assert.equal(ds.resolveInvestingFund(e.g, fundA.id).id, fundA.id, '明示指定は常に優先される');
  let target = null;
  for (let i = 0; i < 80 && !target; i++) { e.advanceWeek(false); target = e.g.acquisitionTargets.filter(ds.isPETarget).find(t => !t.activeDealID) || null; }
  assert.ok(target);
  assert.equal(e.openMADealRoom(target.id), true);
  const deal = e.g.maDealRooms.find(d => d.targetID === target.id);
  const slots = pf.ddSlotsRemaining(e.g, e.g.week);
  assert.equal(e.startMADueDiligence(deal.id, 'screening'), false, '2本あるのに指定が無ければ拒否される');
  assert.equal(pf.ddSlotsRemaining(e.g, e.g.week), slots, '拒否されたDDは枠を消費しない');
  assert.equal(e.startMADueDiligence(deal.id, 'screening', e.g.peFirm.funds[1].id), true, '指定すれば開始できる');
  assert.equal(deal.fundID, e.g.peFirm.funds[1].id);
}

// 9. 旧セーブ互換: T21以前のファンド（lpContributed / gpDistributed が無い）を読み込んでも壊れない。
{
  const e = setupFirm({});
  e.g.peFirm = { trackRecord: { score: 20, exits: [], realizedDPI: 0 }, unlocked: true, funds: [{
    id: 'legacy', size: 10_000_000_000, gpCommit: 2_000_000_000, cash: 10_000_000_000,
    y0: 1, status: 'investing', terms: { fee: .02, carry: .2, hurdle: .08 }, deals: [], distributed: 0
  }] };
  const personalBefore = e.g.personalCash;
  e.normalize();
  const legacy = e.g.peFirm.funds[0];
  assert.equal(legacy.lpContributed, 8_000_000_000, '旧セーブのLP拠出は規模−GP出資として補われる');
  assert.equal(legacy.gpDistributed, 0);
  assert.equal(e.g.personalCash, personalBefore, '読み込みは個人資産を動かさない（過去の拠出を二重に引かない）');
  assert.equal(legacy.cash, legacy.gpCommit + legacy.lpContributed, '旧セーブでも保存則の形が成り立つ');
}

// 10. 決定論: 同一seedで組成〜取得の結果が完全に一致する。
{
  const run = (handles) => {
    const e = setupFirm({ handles });
    e.formPEFund();
    for (let i = 0; i < 60; i++) e.advanceWeek(false);
    return JSON.stringify({ funds: e.g.peFirm.funds, personal: e.g.personalCash });
  };
  assert.equal(run(freshLoad(91)), run(freshLoad(91)), '同一seedなら組成結果はバイト単位で一致する');
}

console.log('pe fund formation tests passed');
