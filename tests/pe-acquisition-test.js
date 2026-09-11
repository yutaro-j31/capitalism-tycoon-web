'use strict';

// PE mode T17 (docs/PE_MODE_TASKS.md): ファンド資金による取得とExit決済. Uses the full VM
// harness because js/pe-acquisition.js wraps completeTargetAcquisition, which only exists once
// js/app.js has called installMADealRoom (same deferral as js/pe-deal-supply.js).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');

function makeRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }
function freshLoad(seed) { return loadGame({ random: makeRandom(seed), isolatedLegacyIndex: true }); }

const main = freshLoad(7);
const { engineModule, modules } = main;
const pf = modules.peFund, ds = modules.peDealSupply, ops = modules.pePortfolioOperations, pa = modules.peAcquisition;

function setupFirm(handles, { personalCash = 30_000_000_000, companyCash = 50_000_000_000 } = {}) {
  const e = new handles.engineModule.TycoonEngine();
  e.configure({ playerName: 'S', companyName: 'S商事', difficulty: 'normal' });
  e.g.departments.investment = { established: true };
  e.g.departmentStaff.investment = 9;
  e.g.executives.CSO = { role: 'CSO', skill: 80 };
  e.g.executives.CFO = { role: 'CFO', skill: 80 };
  e.g.companyCash = companyCash;
  handles.modules.peFund.recordExit(e.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52, profitableWeekStreak: 260, employeeCount: 30 });
  e.g.personalCash = personalCash;
  return e;
}
function formFund(handles, e) {
  const p = handles.modules.peFund;
  const size = p.formableFundSize(e.g);
  return p.createFund(e.g, { size, gpCommit: size * p.requiredGPRatio(e.g.peFirm.trackRecord.score), terms: p.fundTermsForScore(e.g.peFirm.trackRecord.score), y0: e.g.week });
}
function peTargets(handles, e) { return e.g.acquisitionTargets.filter(handles.modules.peDealSupply.isPETarget); }
// 供給 → ディールルーム → DD → 受諾 まで進めた状態を返す。
function bidToAccepted(handles, e, fund, { priceFactor = 1.02 } = {}) {
  let target = null;
  for (let i = 0; i < 80 && !target; i++) { e.advanceWeek(false); target = peTargets(handles, e)[0] || null; }
  assert.ok(target, 'sanity: a PE target must be supplied');
  assert.equal(e.openMADealRoom(target.id), true);
  const deal = e.g.maDealRooms.find(d => d.targetID === target.id);
  assert.equal(e.startMADueDiligence(deal.id, 'screening', fund.id), true);
  for (let i = 0; i < 6 && deal.status === 'diligence'; i++) e.advanceWeek(false);
  assert.equal(deal.status, 'ready');
  const quote = e.calculateMAAcquisitionPrice(target, 'friendly');
  const price = Math.ceil(quote.minimumPrice * priceFactor);
  return { target, deal, price };
}
function acceptOffer(e, deal, price) {
  assert.equal(e.submitMAOffer(deal.id, { method: 'friendly', offerPrice: price }), true);
  for (let i = 0; i < 4 && deal.status === 'offer_pending'; i++) e.advanceWeek(false);
  return deal.status;
}

// 1. The module is registered and its wrapper is actually installed on the prototype.
{
  assert.ok(pa && pa.__installed, 'peAcquisition module must be registered');
  assert.equal(engineModule.TycoonEngine.prototype.__peAcquisitionInstalled, true);
  assert.equal(typeof engineModule.TycoonEngine.prototype.setPEDealCoinvest, 'function');
  assert.equal(typeof engineModule.TycoonEngine.prototype.exitPEPortfolioCompany, 'function');
}

// 2. 完了条件: 入札で勝つとファンドの現金が減り、案件が保有に入る。
//    会計分離: 取得価格は companyCash からは一切出ず、連結子会社にもならない。
{
  const e = setupFirm(main);
  const fund = formFund(main, e);
  const { target, deal, price } = bidToAccepted(main, e, fund);
  const fundCashBefore = fund.cash, companyCashBefore = e.g.companyCash, subsBefore = e.g.maSubsidiaries.length, goodwillBefore = e.g.goodwillRecords.length;
  assert.equal(acceptOffer(e, deal, price), 'accepted');
  // T26-2以降、週が進むあいだ会社（＝GP法人）は管理報酬も受け取るため、companyCash の差分は
  // 「アドバイザリー費用 − 管理報酬 + チーム人件費」の混合になる。ここで固定したい不変条件は
  //「取得価格が会社の現金から出ない」ことなので、それはクロージング前後の比較（下）で見る。
  const advisoryFee = companyCashBefore - e.g.companyCash;
  assert.ok(Math.abs(advisoryFee) < price * .01, `アドバイザリー費用と管理報酬の範囲を超えて会社の現金が動いた: ${advisoryFee}`);
  const companyCashAtClose = e.g.companyCash;
  // T26-2以降、週が進むあいだ管理報酬もファンドの現金から引かれるので、取得ぶんの減少は
  // クロージング直前の残高と比べる（クロージング自体は週を進めない）。
  const fundCashAtClose = fund.cash;
  assert.equal(e.closeMADeal(deal.id), true, 'the PE close must succeed');
  assert.equal(deal.status, 'acquired');
  assert.equal(e.g.companyCash, companyCashAtClose, '取得価格は会社の現金から出てはならない');
  assert.equal(e.g.maSubsidiaries.length, subsBefore, 'PE取得は連結子会社を作らない');
  assert.equal(e.g.goodwillRecords.length, goodwillBefore, 'PE取得はのれんを計上しない');
  assert.equal(e.g.acquisitionTargets.some(t => t.id === target.id), false, '取得した候補は板から消える');
  const pd = fund.deals[fund.deals.length - 1];
  assert.ok(pd, 'a portfolio deal must be created');
  assert.equal(pd.status, 'active');
  assert.equal(pd.sourceTargetID, target.id);
  assert.equal(pd.acquisitionPrice, price);
  assert.equal(pd.enterpriseValue, target.peEnterpriseValue, '保有中の企業価値は入札価格ではなく本来の企業価値');
  assert.ok(pd.portfolioCompany, 'the deal must carry an operating company');
  assert.equal(Math.round(fundCashAtClose - fund.cash), Math.round(pd.fundPortion), 'ファンドの現金は投下額ぶんだけ減る');
  assert.ok(fundCashBefore > fund.cash, 'ファンドの現金は取得と管理報酬で減っている');
  assert.ok(pd.fundPortion > 0);
}

// 3. 完了条件: スロット満杯で取得が拒否される（T9 slotCapacity / activeDealCount）。
{
  const e = setupFirm(main);
  const fund = formFund(main, e);
  const { deal, price } = bidToAccepted(main, e, fund);
  const cap = pf.slotCapacity(fund);
  assert.ok(cap > 0);
  for (let i = 0; i < cap; i++) fund.deals.push({ id: `filler-${i}`, status: 'active', investedAmount: 1, fundPortion: 1, coinvestPortion: 0 });
  assert.equal(pf.activeDealCount(fund) >= cap, true);
  const check = pa.evaluateFundPurchase(e.g, deal, price);
  assert.equal(check.ok, false, 'スロット満杯なら取得判定は通らない');
  const fundCashBefore = fund.cash;
  assert.equal(e.submitMAOffer(deal.id, { method: 'friendly', offerPrice: price }), false, 'スロット満杯ならオファーも出せない');
  assert.equal(fund.cash, fundCashBefore, '拒否された取得はファンドの現金を動かさない');
  // 枠が空けば同じ案件が通る。
  fund.deals.length = 0;
  assert.equal(pa.evaluateFundPurchase(e.g, deal, price).ok, true);
}

// 4. オファー時の資金判定はファンド側で行う（会社の現金・調達可能額は無関係）。
{
  const e = setupFirm(main, { companyCash: 1_000_000_000 });
  const fund = formFund(main, e);
  const { target, deal, price } = bidToAccepted(main, e, fund);
  // 会社の現金では到底払えない金額でも、ファンドに余力があればオファーは通る。
  assert.ok(price > e.g.companyCash, 'sanity: the price must exceed company cash for this check');
  assert.equal(e.submitMAOffer(deal.id, { method: 'friendly', offerPrice: price }), true);
  // 逆にファンドが空ならファンド側の判定で落ちる。
  const e2 = setupFirm(main);
  const fund2 = formFund(main, e2);
  const b2 = bidToAccepted(main, e2, fund2);
  fund2.cash = 0;
  assert.equal(e2.submitMAOffer(b2.deal.id, { method: 'friendly', offerPrice: b2.price }), false, 'ファンドの資金が尽きていればオファーは出せない');
  assert.equal(pa.validateOfferFunding(e2.g, b2.target, b2.deal, b2.price, 'friendly').handled, true);
  // 通常のM&A候補にはこのフックは掛からない（handled を返さない）。
  const ordinary = e2.g.acquisitionTargets.find(t => !ds.isPETarget(t));
  assert.ok(ordinary, 'sanity: an ordinary target must exist');
  assert.equal(pa.validateOfferFunding(e2.g, ordinary, b2.deal, 1, 'friendly'), null);
  // 株式交換はファンドの取得手段にならない。
  assert.equal(pa.validateOfferFunding(e2.g, b2.target, b2.deal, b2.price, 'shareSwap').ok, false);
}

// 5. Exit決済のウォーターフォール（設計書§2・§14）。純関数として直接検証する。
{
  const e = setupFirm(main);
  const fund = pf.createFund(e.g, { size: 10_000_000_000, terms: { fee: .02, carry: .20, hurdle: .08 }, y0: 1 });
  fund.distributed = 0;
  const deal = { id: 'd1', fundPortion: 1_000_000_000, coinvestPortion: 0, acquiredWeek: 52, status: 'active' };
  const personalBefore = e.g.personalCash, companyBefore = e.g.companyCash;
  // 2年保有、回収額20億（元本10億 + 利益10億）。ハードルは 1.08^2-1 = 16.64% → 1.664億。
  const s = pf.settleExitProceeds(e.g, fund, deal, 2_000_000_000, 52 + 104);
  const expectedHurdle = 1_000_000_000 * (Math.pow(1.08, 2) - 1);
  const expectedCarry = (1_000_000_000 - expectedHurdle) * .20;
  assert.ok(Math.abs(s.fundHurdleAmount - expectedHurdle) < 1, 'ハードルは保有年数の複利で効く');
  assert.ok(Math.abs(s.fundCarry - expectedCarry) < 1, 'キャリーはハードル超過分にのみ掛かる');
  assert.equal(s.fundPrincipalReturned, 1_000_000_000, '元本が返済される');
  assert.ok(Math.abs(fund.distributed - (2_000_000_000 - expectedCarry)) < 1, '分配額はキャリー控除後');
  assert.ok(Math.abs((e.g.personalCash - personalBefore) - expectedCarry) < 1, 'GPのキャリーは個人資産に入る');
  assert.equal(e.g.companyCash, companyBefore, 'キャリーは会社の現金に触れない');
  // 二重徴収なし: 同じ案件をもう一度決済しても何も動かない。
  const personalAfter = e.g.personalCash, distributedAfter = fund.distributed;
  const again = pf.settleExitProceeds(e.g, fund, deal, 5_000_000_000, 52 + 200);
  assert.equal(again.settledWeek, s.settledWeek, '決済済みの案件は再決済されない');
  assert.equal(e.g.personalCash, personalAfter);
  assert.equal(fund.distributed, distributedAfter);
}

// 6. ハードルに届かない利益ではキャリーが発生しない。元本割れも同じ。
{
  const e = setupFirm(main);
  const fund = pf.createFund(e.g, { size: 10_000_000_000, terms: { fee: .02, carry: .20, hurdle: .08 }, y0: 1 });
  const personalBefore = e.g.personalCash;
  const small = pf.settleExitProceeds(e.g, fund, { id: 'd-small', fundPortion: 1_000_000_000, coinvestPortion: 0, acquiredWeek: 52 }, 1_050_000_000, 52 + 104);
  assert.equal(small.fundCarry, 0, 'ハードル未達ならキャリーはゼロ');
  const loss = pf.settleExitProceeds(e.g, fund, { id: 'd-loss', fundPortion: 1_000_000_000, coinvestPortion: 0, acquiredWeek: 52 }, 400_000_000, 52 + 104);
  assert.equal(loss.fundCarry, 0, '元本割れならキャリーはゼロ');
  assert.equal(loss.fundPrincipalReturned, 400_000_000, '返せるのは回収額まで');
  assert.equal(e.g.personalCash, personalBefore, 'キャリーが無ければ個人資産は動かない');
}

// 7. 完了条件: 共同投資分のキャリーが半分になり、共同投資の元本・利益はファンドの分配に混ざらない。
{
  const e = setupFirm(main);
  const fund = pf.createFund(e.g, { size: 10_000_000_000, terms: { fee: .02, carry: .20, hurdle: 0 }, y0: 1 });
  fund.distributed = 0;
  const personalBefore = e.g.personalCash;
  // ファンド10億・共同投資10億の案件が2倍で戻る。ハードル0なので利益はそれぞれ10億。
  const s = pf.settleExitProceeds(e.g, fund, { id: 'd-co', fundPortion: 1_000_000_000, coinvestPortion: 1_000_000_000, acquiredWeek: 52 }, 4_000_000_000, 52 + 104);
  assert.ok(Math.abs(s.fundShare - 2_000_000_000) < 1, '回収額は投下額の比で按分される');
  assert.ok(Math.abs(s.coinvestShare - 2_000_000_000) < 1);
  assert.ok(Math.abs(s.fundCarry - 200_000_000) < 1, 'ファンド分はフルのキャリー率');
  assert.ok(Math.abs(s.coinvestCarry - 100_000_000) < 1, '共同投資分のキャリーはフルの半分');
  assert.ok(Math.abs(s.coinvestCarry - s.fundCarry * pf.COINVEST_CARRY_FACTOR) < 1);
  assert.ok(Math.abs(fund.distributed - (2_000_000_000 - 200_000_000)) < 1, '共同投資の回収額はファンドの分配（DPIの分子）に入らない');
  assert.ok(Math.abs(fund.coinvestReturned - (2_000_000_000 - 100_000_000)) < 1, '共同投資家への返還は専用の欄に記録される');
  assert.ok(Math.abs((e.g.personalCash - personalBefore) - (s.fundCarry + s.coinvestCarry)) < 1, 'GPは両方のキャリーを受け取る');
}

// 8. 保有 → Exit の一連の流れ（production path）。会計分離が最後まで保たれる。
{
  const e = setupFirm(main);
  const fund = formFund(main, e);
  const { deal, price } = bidToAccepted(main, e, fund);
  assert.equal(acceptOffer(e, deal, price), 'accepted');
  assert.equal(e.closeMADeal(deal.id), true);
  const pd = fund.deals[fund.deals.length - 1];
  for (let i = 0; i < 208; i++) e.advanceWeek(false);
  assert.ok(pd.portfolioCompany.lastProcessedWeek > pd.acquiredWeek, '保有中は週次で経営が進む');
  assert.ok(pd.portfolioCompany.profitHistory.length > 0);
  const companyBefore = e.g.companyCash, personalBefore = e.g.personalCash, distributedBefore = fund.distributed;
  assert.equal(e.exitPEPortfolioCompany(fund.id, pd.id, { method: 'sale' }), true);
  assert.equal(pd.status, 'exited');
  assert.ok(pd.exitSettlement, 'Exitは決済結果を残す');
  assert.ok(fund.distributed > distributedBefore, 'Exit代金はファンドへ分配される');
  assert.equal(e.g.companyCash, companyBefore, 'Exit代金は会社の現金に入らない');
  // T21以降、個人資産に入るのは「キャリー」＋「GP出資持分に対する分配（元本と利益）」の2つ。
  const expectedPersonal = pd.exitSettlement.gpCarry + pd.exitSettlement.gpPrincipalAndGain;
  assert.ok(Math.abs((e.g.personalCash - personalBefore) - expectedPersonal) < 1, '個人資産の増加はキャリーとGP持分の合計と厳密に一致する');
  // Exit済みの案件はスロットを占有しない。
  assert.equal(pf.activeDealCount(fund), 0);
  assert.equal(e.exitPEPortfolioCompany(fund.id, pd.id, { method: 'sale' }), false, 'Exit済みの案件は再度Exitできない');
}

// 9. evaluateFund が週次処理から自動的に呼ばれる（DPI・資金消化率が毎週更新される）。
//    トラックレコードへの加算はファンド終了時に1回だけ。
{
  const e = setupFirm(main);
  const fund = formFund(main, e);
  e.advanceWeek(false);
  assert.ok(Number.isFinite(fund.dpiAtEvaluation), '週次でDPIが評価される');
  assert.equal(fund.evaluatedWeek, e.g.week);
  const exitsBefore = e.g.peFirm.trackRecord.exits.length;
  // 80%以上を投下した状態にしても、稼働中のファンドではトラックレコードに加算されない。
  fund.deals.push({ id: 'synthetic', status: 'active', investedAmount: fund.size * .9, fundPortion: fund.size * .9, coinvestPortion: 0 });
  fund.distributed = fund.size * 1.5;
  e.advanceWeek(false);
  assert.equal(e.g.peFirm.trackRecord.exits.length, exitsBefore, '稼働中のファンドはトラックレコードに加算されない');
  assert.ok(fund.dpiAtEvaluation >= 1.5, 'DPIは毎週最新化される');
  // 満期に到達した週（status が closed に変わる週）に1回だけ加算される。
  const closeWeek = fund.y0 + pf.FUND_TERM_WEEKS;
  fund.lastProcessedWeek = 0;
  pf.processFundsWeek(e.g, closeWeek);
  assert.equal(fund.status, 'closed');
  assert.equal(e.g.peFirm.trackRecord.exits.length, exitsBefore + 1, 'ファンド終了時に1回だけ加算される');
  // 以後は何度処理しても増えない（closed のファンドは以降スキップされ、once ガードも効く）。
  fund.lastProcessedWeek = 0;
  pf.processFundsWeek(e.g, closeWeek + 1);
  pf.evaluateFund(e.g, fund.id, closeWeek + 1);
  assert.equal(e.g.peFirm.trackRecord.exits.length, exitsBefore + 1, '二重加算されない');
}

// 10. 決定論: 同一seedで取得後のファンド状態が完全に一致する。
{
  const a = freshLoad(23), b = freshLoad(23);
  const run = (handles) => {
    const e = setupFirm(handles);
    const fund = formFund(handles, e);
    const { deal, price } = bidToAccepted(handles, e, fund);
    acceptOffer(e, deal, price);
    e.closeMADeal(deal.id);
    for (let i = 0; i < 60; i++) e.advanceWeek(false);
    return JSON.stringify(fund);
  };
  assert.equal(run(a), run(b), '同一seedならファンドの状態はバイト単位で一致する');
}

// 11. 旧セーブ互換: 新しい欄を持たないファンドを読み込んでも壊れない。
{
  const e = setupFirm(main);
  e.g.peFirm = { trackRecord: { score: 10, exits: [], realizedDPI: 0 }, funds: [{ id: 'legacy', size: 1_000_000_000, cash: 1_000_000_000, deals: [], terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1, status: 'investing' }], unlocked: true };
  e.normalize();
  const legacy = e.g.peFirm.funds[0];
  assert.equal(legacy.coinvestReturned, 0, '旧セーブには共同投資返還欄が補われる');
  assert.equal(legacy.coinvestCommitted, 0);
  e.advanceWeek(false);
  assert.ok(Number.isFinite(legacy.dpiAtEvaluation));
  assert.ok(Number.isFinite(e.g.personalCash) && Number.isFinite(e.g.companyCash));
}

// 12. 決定論の絶対条件: 新規モジュールに Math.random / Date.now / randomUUID が無い。
{
  const src = fs.readFileSync(require('node:path').join(__dirname, '..', 'js', 'pe-acquisition.js'), 'utf8');
  for (const banned of ['Math' + '.random', 'Date' + '.now', 'randomUUID']) {
    assert.equal(src.includes(banned), false, `${banned} must not appear in js/pe-acquisition.js`);
  }
}

console.log('pe acquisition tests passed');
