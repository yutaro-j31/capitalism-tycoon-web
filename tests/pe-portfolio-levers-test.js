'use strict';

// PE mode T18 (docs/PE_MODE_TASKS.md): 買収先経営の6レバー化.
// 6レバー = 価格 / 品質 / 拠点（出店と再編）/ 仕入れ・調達 / 人件費と人員 / 商品構成。
// Uses the lightweight module loader (these are pure state/calculation functions plus the
// peNetwork reputation coupling; no deal-room prototype wrapping is involved).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function makeRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }
const main = loadGame({ random: makeRandom(31), isolatedLegacyIndex: true });
const { engineModule, modules } = main;
const pf = modules.peFund, ops = modules.pePortfolioOperations, pn = modules.peNetwork;

// 十分な規模のファンドと、そこが買った1件をつくる。
function heldDeal({ employmentPromise = false, cash = 5_000_000_000 } = {}) {
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'S', companyName: 'S商事', difficulty: 'normal' });
  e.g.personalCash = 30_000_000_000;
  const fund = pf.createFund(e.g, { size: 200_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: 10_000_000_000, week: 1 });
  deal.employmentPromise = employmentPromise;
  deal.portfolioCompany.cash = cash;
  ops.ensure(e.g); // underperformingRatio を決定論的に確定させる
  return { e, fund, deal, pc: deal.portfolioCompany };
}
// n週ぶん経営し、その間の利益合計を返す。
function runWeeks({ fund, deal }, from, to) {
  let total = 0;
  for (let w = from; w <= to; w++) { ops.processDealWeek(fund, deal, w); total += deal.portfolioCompany.weeklyProfit; }
  return total;
}

// 1. 完了条件: 6レバーすべてが週次のP&Lに反映される。
//    既定値ではすべて中立（倍率1.0）で、T18以前の較正値が動いていないことも確認する。
{
  const { pc } = heldDeal();
  const neutral = ops.leverFactors(pc, 100);
  assert.equal(neutral.priceFactor, 1);
  assert.equal(neutral.qualityFactor, 1);
  assert.equal(neutral.mixFactor, 1);
  assert.equal(neutral.procurementFactor, 1);
  assert.equal(neutral.laborFactor, 1);
  assert.equal(neutral.consolidationFactor, 1);
  assert.equal(neutral.revenueFactor, 1, '既定値では週次P&Lの倍率が完全に中立');
  assert.equal(neutral.costFactor, 1);
  // 6レバーそれぞれが、単独で動かしたときに倍率を動かす。
  const move = (patch) => ops.leverFactors({ ...pc, ...patch }, 300);
  assert.notEqual(move({ priceMultiplier: 1.2 }).priceFactor, 1, 'レバー1: 価格');
  assert.notEqual(move({ qualityInvestment: 40 }).qualityFactor, 1, 'レバー2: 品質');
  assert.notEqual(move({ procurementReform: .5 }).procurementFactor, 1, 'レバー4: 仕入れ・調達');
  assert.notEqual(move({ headcountRatio: .8 }).laborFactor, 1, 'レバー5: 人件費と人員');
  assert.notEqual(move({ productMixLevel: 1, productMixSetWeek: 1 }).mixFactor, 1, 'レバー6: 商品構成');
  assert.notEqual(move({ consolidatedRatio: .1 }).consolidationFactor, 1, 'レバー3b: 拠点再編');
  // レバー3a（出店）は storeCount としてEBITDAに直接掛かる。
  const { fund, deal } = heldDeal();
  ops.processDealWeek(fund, deal, 2);
  const oneStore = deal.portfolioCompany.weeklyProfit;
  deal.portfolioCompany.storeCount = 2;
  ops.processDealWeek(fund, deal, 3);
  assert.ok(deal.portfolioCompany.weeklyProfit > oneStore, 'レバー3a: 出店');
}

// 2. 設計意図: コスト側（仕入れ・人件費）は即効、トップライン側（商品構成）は2〜3年かかる。
{
  const a = heldDeal();
  const baseline = runWeeks(a, 2, 14);
  const b = heldDeal();
  ops.reformProcurement(b.e.g, b.fund.id, b.deal.id, .5);
  const reformed = runWeeks(b, 2, 14);
  assert.ok(reformed > baseline, '仕入れ改革は即効で利益を押し上げる');
  const c = heldDeal();
  ops.setStaffing(c.e.g, c.fund.id, c.deal.id, { headcountRatio: .8 });
  const leaner = runWeeks(c, 2, 14);
  assert.ok(leaner > baseline, '人件費削減も即効で利益を押し上げる');
  const d = heldDeal();
  const cashBeforeMix = d.pc.cash;
  ops.renewProductMix(d.e.g, d.fund.id, d.deal.id, 1);
  assert.ok(d.pc.cash < cashBeforeMix, '商品構成の刷新は先に一時費用を払う');
  const shortRun = runWeeks(d, 2, 14);
  assert.ok(shortRun - baseline < (reformed - baseline) * .2, '同じ13週で見ると、トップライン側の効きはコスト側よりはるかに遅い');
  // 2〜3年後には効いてくる。
  const early = ops.leverFactors(d.pc, d.pc.productMixSetWeek + 26).mixFactor;
  const late = ops.leverFactors(d.pc, d.pc.productMixSetWeek + ops.PRODUCT_MIX_RAMP_WEEKS).mixFactor;
  assert.ok(early < 1.1, '半年では効き目はまだ小さい');
  assert.ok(Math.abs(late - (1 + ops.PRODUCT_MIX_MAX_GAIN)) < 1e-9, '2.5年で効き切る');
}

// 3. 設計意図: 削る側の副作用は遅れて来る（即効の利益と、数年後のトップラインの交換）。
{
  const { pc } = heldDeal();
  const cut = { ...pc, procurementReform: 1, procurementSetWeek: 10, headcountRatio: .6, staffingSetWeek: 10 };
  assert.equal(ops.leverFactors(cut, 10).sideEffectFactor, 1, '削った直後には副作用が無い');
  assert.equal(ops.leverFactors(cut, 10 + ops.PROCUREMENT_DELAY_WEEKS).procurementDrag, 0, '仕入れの副作用は1年後から');
  assert.ok(ops.leverFactors(cut, 10 + ops.LABOR_DELAY_WEEKS + 26).laborDrag > 0, '人員削減の副作用は3四半期後から');
  const settled = ops.leverFactors(cut, 10 + 200);
  assert.ok(settled.sideEffectFactor < 1, '時間が経つと副作用が効く');
  assert.ok(settled.revenueFactor < 1, '客数（トップライン）が落ちる');
  // 安全水準までの仕入れ改革には副作用が無い。
  const safe = { ...pc, procurementReform: ops.PROCUREMENT_SAFE_LEVEL, procurementSetWeek: 10 };
  assert.equal(ops.leverFactors(safe, 10 + 300).procurementDrag, 0, '安全水準までなら副作用は出ない');
}

// 4. 完了条件: 雇用維持の約束がある案件で、人員削減と閉店が禁止される。
{
  const promised = heldDeal({ employmentPromise: true });
  assert.equal(ops.setStaffing(promised.e.g, promised.fund.id, promised.deal.id, { headcountRatio: .8 }), null, '約束がある案件では人員削減できない');
  assert.equal(promised.pc.headcountRatio, 1, '拒否された操作は状態を変えない');
  assert.equal(ops.consolidateSites(promised.e.g, promised.fund.id, promised.deal.id), null, '約束がある案件では閉店できない');
  assert.equal(promised.pc.closedSiteCount, 0);
  // 賃金を上げる方向・人を増やす方向は約束の対象外。
  assert.ok(ops.setStaffing(promised.e.g, promised.fund.id, promised.deal.id, { wageLevel: 1.1, headcountRatio: 1.1 }), '約束は増やす方向を縛らない');
  assert.equal(promised.pc.wageLevel, 1.1);
  // 約束が無ければ両方できる。
  const free = heldDeal();
  assert.ok(ops.setStaffing(free.e.g, free.fund.id, free.deal.id, { headcountRatio: .8 }));
  assert.ok(ops.consolidateSites(free.e.g, free.fund.id, free.deal.id));
  assert.equal(free.pc.closedSiteCount, 1);
}

// 5. 完了条件: 約束なしで削減した場合、業界の評判が下がる（T13 経路3への接続）。
{
  const { e, fund, deal } = heldDeal();
  const node = pn.addNode(e.g, { sourceType: 'peer', pathType: 'reputation', industryTag: 'ramen', week: 1, trust: 80 });
  const other = pn.addNode(e.g, { sourceType: 'peer', pathType: 'reputation', industryTag: 'gym', week: 1, trust: 80 });
  ops.setStaffing(e.g, fund.id, deal.id, { headcountRatio: .8 });
  assert.equal(node.trust, 80 - ops.REPUTATION_PENALTY_FOR_CUTS, '人員削減で同業種の評判が下がる');
  assert.equal(other.trust, 80, '無関係な業種の評判は動かない');
  ops.consolidateSites(e.g, fund.id, deal.id);
  assert.equal(node.trust, 80 - ops.REPUTATION_PENALTY_FOR_CUTS * 2, '閉店でも評判が下がる');
  // 賃金だけを動かしても評判は下がらない。
  const before = node.trust;
  ops.setStaffing(e.g, fund.id, deal.id, { wageLevel: .9 });
  assert.equal(node.trust, before, '賃金水準の変更だけでは評判は下がらない');
}

// 6. 拠点再編は買収時点の不採算比率までしか進まない（閉じ続けて無限に利益を出せない）。
{
  const { e, fund, deal, pc } = heldDeal();
  assert.ok(pc.underperformingRatio >= ops.UNDERPERFORMING_MIN && pc.underperformingRatio <= ops.UNDERPERFORMING_MAX);
  for (let i = 0; i < 20; i++) ops.consolidateSites(e.g, fund.id, deal.id);
  assert.ok(pc.consolidatedRatio <= pc.underperformingRatio + 1e-9, '不採算比率を超えて閉じられない');
  assert.equal(ops.consolidateSites(e.g, fund.id, deal.id), null, '閉じきったらそれ以上は拒否される');
  // 閉店は利益率を上げるが売上は落とす。
  const factors = ops.leverFactors(pc, 300);
  assert.ok(factors.consolidationFactor > 1, '不採算を落とせば利益率は上がる');
  assert.ok(factors.revenueFactor < 1, '閉じた分だけ売上は落ちる');
}

// 7. 完了条件: attention倍率は全レバーに一度だけ乗る（二重適用しない）。
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pe-portfolio-operations.js'), 'utf8');
  const calls = src.split('attentionMultiplier(').length - 1;
  assert.equal(calls, 1, 'attentionMultiplier の呼び出しは週次P&Lの1箇所だけ');
  assert.equal(ops.leverFactors({}, 1).costFactor, 1, 'leverFactors には attention が入らない');
  // 案件数が増えて attention が下がると、利益はその比率どおりに下がる（レバーごとに重ねて掛からない）。
  // attention が実際に効くのはチームが薄いファンドなので、ここでは小さいファンドを使う。
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'S', companyName: 'S商事', difficulty: 'normal' });
  const fund = pf.createFund(e.g, { size: 4_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: 1_000_000_000, week: 1 });
  ops.ensure(e.g);
  Object.assign(deal.portfolioCompany, { procurementReform: .8, productMixLevel: 1, headcountRatio: .8, cash: 1_000_000_000 });
  ops.processDealWeek(fund, deal, 2);
  const full = deal.portfolioCompany.weeklyProfit;
  const attentionFull = pf.attentionMultiplier(fund);
  for (let i = 0; i < 7; i++) fund.deals.push({ id: `filler-${i}`, status: 'active', investedAmount: 1 });
  ops.processDealWeek(fund, deal, 3);
  const thin = deal.portfolioCompany.weeklyProfit;
  const attentionThin = pf.attentionMultiplier(fund);
  assert.ok(attentionThin < attentionFull, 'sanity: 案件が増えれば attention は下がる');
  // 週ごとのノイズぶんの誤差は残るので、比が attention の比と同じ桁で一致することを見る。
  const ratio = thin / full, expected = attentionThin / attentionFull;
  assert.ok(Math.abs(ratio - expected) < .2, `attention は1回だけ効く (ratio=${ratio}, expected=${expected})`);
}

// 8. 会計分離: レバーの費用は買収先自身のcashからのみ出る。
{
  const { e, fund, deal, pc } = heldDeal();
  e.g.companyCash = 12_345_678; e.g.personalCash = 87_654_321;
  const companyBefore = e.g.companyCash, personalBefore = e.g.personalCash, fundBefore = fund.cash, pcBefore = pc.cash;
  ops.reformProcurement(e.g, fund.id, deal.id, 1);
  ops.renewProductMix(e.g, fund.id, deal.id, 1);
  ops.setStaffing(e.g, fund.id, deal.id, { headcountRatio: .9 });
  ops.consolidateSites(e.g, fund.id, deal.id);
  assert.ok(pc.cash < pcBefore, 'レバーの費用は買収先のcashから出る');
  assert.equal(e.g.companyCash, companyBefore, '会社の現金は動かない');
  assert.equal(e.g.personalCash, personalBefore, '個人資産は動かない');
  assert.equal(fund.cash, fundBefore, 'ファンドの現金も動かない');
  // 手元資金が足りない改革は実行されない。
  pc.cash = 0;
  const level = pc.productMixLevel;
  assert.equal(ops.renewProductMix(e.g, fund.id, deal.id, 1), null);
  assert.equal(pc.productMixLevel, level);
}

// 9. Exit済み・存在しない案件へのレバー操作は安全に失敗する。
{
  const { e, fund, deal } = heldDeal();
  assert.equal(ops.reformProcurement(e.g, 'nope', 'nope', 1), null);
  assert.equal(ops.setStaffing(e.g, fund.id, 'nope', { headcountRatio: .8 }), null);
  ops.exitPortfolioCompany(e.g, fund.id, deal.id, { week: 30 });
  assert.equal(ops.reformProcurement(e.g, fund.id, deal.id, 1), null, 'Exit済みの案件は操作できない');
  assert.equal(ops.consolidateSites(e.g, fund.id, deal.id), null);
  assert.equal(ops.renewProductMix(e.g, fund.id, deal.id, 1), null);
}

// 10. 旧セーブ互換: T18以前の買収先（新レバーの欄が無い）を読み込んでも中立値が補われる。
{
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'S', companyName: 'S商事', difficulty: 'normal' });
  e.g.peFirm = { trackRecord: { score: 0, exits: [], realizedDPI: 0 }, funds: [{
    id: 'legacy', size: 10_000_000_000, cash: 5_000_000_000, y0: 1, status: 'investing', terms: { fee: .02, carry: .2, hurdle: .08 },
    deals: [{ id: 'legacy-deal', businessID: 'ramen', tierID: 'pillar', enterpriseValue: 3_000_000_000, acquisitionMultiple: 8, investedAmount: 3_000_000_000, fundPortion: 3_000_000_000, coinvestPortion: 0, acquiredWeek: 1, status: 'active', portfolioCompany: { cash: 0, priceMultiplier: 1, qualityInvestment: 0, storeCount: 1, profitHistory: [], improvementScore: 50, lastProcessedWeek: 1 } }]
  }], unlocked: true };
  e.normalize();
  const pc = e.g.peFirm.funds[0].deals[0].portfolioCompany;
  assert.equal(pc.procurementReform, 0);
  assert.equal(pc.wageLevel, 1);
  assert.equal(pc.headcountRatio, 1);
  assert.equal(pc.productMixLevel, 0);
  assert.equal(pc.consolidatedRatio, 0);
  assert.ok(Number.isFinite(pc.underperformingRatio), '不採算比率は読み込み時に決定論的に補われる');
  assert.equal(ops.leverFactors(pc, 500).revenueFactor, 1, '旧セーブの経営結果は従来どおり');
}

// 11. 決定論: 同じ操作列は同じ結果になる（不採算比率も案件IDから決まる）。
{
  const run = () => {
    const { e, fund, deal } = heldDeal();
    ops.reformProcurement(e.g, fund.id, deal.id, .75);
    ops.setStaffing(e.g, fund.id, deal.id, { headcountRatio: .8, wageLevel: .9 });
    ops.renewProductMix(e.g, fund.id, deal.id, 1);
    ops.consolidateSites(e.g, fund.id, deal.id);
    for (let w = 2; w <= 260; w++) ops.processDealWeek(fund, deal, w);
    return JSON.stringify(deal);
  };
  assert.equal(run(), run(), '同じ操作列なら結果はバイト単位で一致する');
}

console.log('pe portfolio levers tests passed');
