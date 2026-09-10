'use strict';

// PE mode T23 (docs/PE_MODE_TASKS.md): リターンの再較正.
// T20の実測が設計書の較正値より甘く（Fund I DPI中央値 2.48 / Fund II到達率 100%）、
// 「腕が普通でも15%程度は足踏みする」という設計の緊張感が消えていた。
// このテストは較正の"向き"を契約として固定する: 上振れを抑え、最悪ケースは悪化させない。

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const main = loadGame({ random: () => 0.5, isolatedLegacyIndex: true });
const { engineModule, modules } = main;
const pf = modules.peFund, ops = modules.pePortfolioOperations, tiers = modules.peIndustryTiers;

// レバー（仕入れ改革・商品構成の刷新・品質投資・出店）はいずれも買収先自身の手元資金から
// 支払うので、検証用に少しだけ現金を持たせる（持たせないと操作が全部失敗し、レバーの差を
// 測っていないことになる）。
function heldDeal({ ev = 10_000_000_000, week = 1, cash = 1_000_000_000 } = {}) {
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'GP', companyName: 'PE', difficulty: 'normal' });
  e.g.personalCash = 100_000_000_000;
  const fund = pf.createFund(e.g, { size: 200_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: ev, week });
  ops.ensure(e.g);
  deal.portfolioCompany.cash = cash;
  return { e, fund, deal, pc: deal.portfolioCompany };
}

// 1. Exit倍率の幅: 下限は据え置き、management fee込みの較正でも上側だけを動かす。
{
  assert.equal(ops.EXIT_MULTIPLE_FLOOR, .80, 'スコア0でも取得倍率の80%では売れる（救済導線の前提）');
  assert.ok(ops.EXIT_MULTIPLE_SCORE_SPAN <= .35, '満点でのマルチプル拡大は抑えられている');
  assert.ok(ops.EXIT_MULTIPLE_FLOOR + ops.EXIT_MULTIPLE_SCORE_SPAN <= 1.15, '満点でもマルチプル拡大は限定的');
  assert.ok(ops.EXIT_MULTIPLE_FLOOR + ops.EXIT_MULTIPLE_SCORE_SPAN > ops.EXIT_MULTIPLE_FLOOR, 'スコアは依然として売却価格に効く');
}

// 2. 上振れ側のレバーの効果に天井がある（払える額なら誰でも上限まで買える状態を作らない）。
{
  assert.ok(ops.QUALITY_MAX_REVENUE_GAIN <= .25, '品質投資による売上増の天井');
  assert.ok(ops.QUALITY_MAX_REVENUE_GAIN > 0, '品質投資には依然として意味がある');
  assert.ok(ops.STORE_MARGINAL_EBITDA_SHARE <= .06, '出店1件あたりの増分');
  // 出店は「Exitまでに回収しきらない」水準（費用EVの5%に対し、年あたりの増分はその半分未満）。
  const annualGainPerStore = ops.STORE_MARGINAL_EBITDA_SHARE / 8; // EV/取得倍率 に対する比
  assert.ok(annualGainPerStore < ops.EXPANSION_COST_FRACTION / 2, '出店の回収は4年では終わらない');
}

// 3. 改善スコアは簡単には満点にならない（T20実測では全案件が100に張り付いていた）。
{
  assert.ok(ops.PROFIT_SCORE_EV_FRACTION >= .4, '満点には企業価値の相当割合を現金で稼ぐ必要がある');
  const { deal, pc } = heldDeal();
  pc.cash = deal.enterpriseValue * .10; // T20時点なら満点だった水準
  pc.qualityInvestment = 100;
  const score = ops.computeImprovementScore(deal);
  assert.ok(score < 100, `EVの10%の現金では満点にならない（実測 ${score}）`);
  assert.ok(score > ops.BASELINE_SCORE, '稼いでいれば基準点は上回る');
  // 下振れ側は据え置き: 稼げていない会社の点は基準点のまま（悪化させない）。
  pc.cash = 0; pc.qualityInvestment = 0;
  assert.equal(ops.computeImprovementScore(deal), ops.BASELINE_SCORE, '無成果の点は基準点のまま');
}

// 4. 市況は入口と出口の両方に対称に効く（分散の源。平均を下げるための係数ではない）。
{
  const level = tiers.marketPriceLevel;
  assert.ok(level(1.3) > level(1.0) && level(1.0) > level(0.8), '好況ほど高く売れる');
  const boom = heldDeal(), bust = heldDeal();
  for (let w = 2; w <= 210; w++) { ops.processDealWeek(boom.fund, boom.deal, w); ops.processDealWeek(bust.fund, bust.deal, w); }
  boom.e.g.economy = 1.28; bust.e.g.economy = 0.72;
  ops.exitPortfolioCompany(boom.e.g, boom.fund.id, boom.deal.id, { week: 211 });
  ops.exitPortfolioCompany(bust.e.g, bust.fund.id, bust.deal.id, { week: 211 });
  assert.ok(boom.deal.exitProceeds > bust.deal.exitProceeds, '好況で売った方が回収額は大きい');
  assert.ok(boom.deal.exitMarketLevel > bust.deal.exitMarketLevel);
  // 不況で売っても元本が吹き飛ぶような水準にはしない（半減の発生率0〜1%を守るため）。
  assert.ok(bust.deal.exitProceeds > bust.deal.investedAmount * .6, '不況Exitでも半減はしない');
}

// 5. 4年保有の標準的な案件のMOICが、設計書の水準（Fund I DPI 1.3〜1.7）に載る帯に収まる。
//    レバーを一通り使った「普通の経営」を4年続けたときの回収倍率を見る。
{
  const { e, fund, deal, pc } = heldDeal();
  ops.reformProcurement(e.g, fund.id, deal.id, .7);
  ops.setStaffing(e.g, fund.id, deal.id, { headcountRatio: .9 });
  for (let w = 2; w <= 210; w++) {
    ops.processDealWeek(fund, deal, w);
    if (w === 104) ops.renewProductMix(e.g, fund.id, deal.id, .5);
    if (w % 26 === 0 && pc.cash > 0) ops.investQuality(e.g, fund.id, deal.id, pc.cash * .3);
    if (w % 52 === 0) ops.expandPortfolioStore(e.g, fund.id, deal.id);
  }
  e.g.economy = 1.0;
  ops.exitPortfolioCompany(e.g, fund.id, deal.id, { week: 211 });
  const moic = deal.exitProceeds / deal.investedAmount;
  assert.ok(moic > 1.0, `4年経営してプラスにはなる（実測 ${moic.toFixed(2)}）`);
  assert.ok(moic < 2.4, `上振れが抑えられている（T20時点は2.5〜2.9倍。実測 ${moic.toFixed(2)}）`);
  assert.ok(deal.exitScore < 100, `改善スコアが張り付かない（実測 ${deal.exitScore}）`);
}

// 6. 腕の効き幅は保たれる: よく経営した案件と、削って放置した案件で回収額に明確な差が出る。
{
  const good = heldDeal(), bad = heldDeal();
  ops.reformProcurement(good.e.g, good.fund.id, good.deal.id, .5);
  ops.renewProductMix(good.e.g, good.fund.id, good.deal.id, 1);
  ops.reformProcurement(bad.e.g, bad.fund.id, bad.deal.id, 1);      // 限界まで削る
  ops.setStaffing(bad.e.g, bad.fund.id, bad.deal.id, { headcountRatio: .6 });
  for (let w = 2; w <= 210; w++) { ops.processDealWeek(good.fund, good.deal, w); ops.processDealWeek(bad.fund, bad.deal, w); }
  good.e.g.economy = 1.0; bad.e.g.economy = 1.0;
  ops.exitPortfolioCompany(good.e.g, good.fund.id, good.deal.id, { week: 211 });
  ops.exitPortfolioCompany(bad.e.g, bad.fund.id, bad.deal.id, { week: 211 });
  const ratio = good.deal.exitProceeds / bad.deal.exitProceeds;
  assert.ok(ratio > 1.15, `経営の差が回収額に出る（実測 ${ratio.toFixed(2)}倍）`);
}

// 7. 決定論は保たれる（較正は係数の変更であって、乱数の使い方は変えていない）。
{
  const run = () => {
    const { e, fund, deal } = heldDeal();
    for (let w = 2; w <= 210; w++) ops.processDealWeek(fund, deal, w);
    e.g.economy = 1.0;
    ops.exitPortfolioCompany(e.g, fund.id, deal.id, { week: 211 });
    return JSON.stringify(deal);
  };
  assert.equal(run(), run());
}

console.log('pe return calibration tests passed');
