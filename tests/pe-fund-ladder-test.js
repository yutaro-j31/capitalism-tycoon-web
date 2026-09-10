'use strict';

// PE mode T22 (docs/PE_MODE_TASKS.md): ファンドの梯子の停止を解く.
// T20の通し検証で、ファンドが育つと eligibleTiers() が空になり案件が1件も供給されず、
// 資金消化率が上がらないため次号ゲートを二度と満たせず、年20前後で梯子が恒久停止した。
// ここでは (1) 帯のフォールバック (2) 規模に応じた消化率要件 (3) 市場が吸収できる規模の上限
// の3つを、単体の契約として固定する。

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const main = loadGame({ random: () => 0.5, isolatedLegacyIndex: true });
const { engineModule, modules } = main;
const pf = modules.peFund, tiers = modules.peIndustryTiers;

function fundOfSize(size, { score = 50, status = 'investing' } = {}) {
  const e = new engineModule.TycoonEngine();
  e.g.personalCash = 100_000_000_000_000;
  const fund = pf.createFund(e.g, { size, terms: pf.fundTermsForScore(score), y0: 1 });
  fund.status = status;
  return { e, fund };
}

// 1. 完了条件の前提: eligibleTiers は「買える帯が1つでもあるかぎり」空を返さない。
{
  // 通常サイズでは従来どおり適合する帯が返る（設計書§15の表は tests/pe-industry-tiers-test.js）。
  const mid = fundOfSize(13_200_000_000).fund;
  assert.ok(tiers.eligibleTiers(mid).length > 0);
  // 市場より大きく育ったファンドでも空にならず、「買える中で最大の帯」へフォールバックする。
  for (const size of [1_000_000_000_000, 3_000_000_000_000, pf.MAX_FUND_SIZE]) {
    const huge = fundOfSize(size).fund;
    const eligible = tiers.eligibleTiers(huge);
    assert.ok(eligible.length > 0, `${size / 1e8}億のファンドが打てる帯が無くなってはいけない`);
    const largest = tiers.TIER_IDS.reduce((best, id) => tiers.TIERS[id].sizeMax > tiers.TIERS[best].sizeMax ? id : best, tiers.TIER_IDS[0]);
    assert.ok(eligible.includes(largest), '大型ファンドは最大の帯を打てる');
  }
  // 資金が小さすぎてどの帯も買えない場合は従来どおり空（打つ手が無い）。
  const tiny = fundOfSize(1_000_000).fund;
  assert.equal(tiers.eligibleTiers(tiny).length, 0, '最小の帯にも届かないファンドは空のまま');
  assert.equal(tiers.eligibleTiers(null).length, 0);
}

// 2. 次号ゲートの消化率要件は規模に応じて緩む。DPI 1.2倍の要件は変えない。
{
  const small = fundOfSize(300_000_000_000).fund;   // 3,000億: 緩和開始前
  assert.equal(pf.requiredDeploymentRate(small), pf.NEXT_FUND_MIN_DEPLOYMENT, '緩和開始前は80%のまま');
  // T24-2で絶対上限が5兆円→1兆円になったため、上限を超える規模を渡しても ensureFund が
  // 1兆円へ切り詰める。以前この節は 2兆 と MAX_FUND_SIZE を比べていたが、どちらも1兆円に
  // 切り詰められるため「規模に対して単調」の検査が同値比較になって意味を失っていた
  // （FINAL-AUDIT時に発見）。上限内で実際に異なる2つの規模で単調性を検査する。
  const big = fundOfSize(600_000_000_000).fund;     // 6,000億: 緩和帯の途中
  const bigger = fundOfSize(pf.MAX_FUND_SIZE).fund; // 1兆（絶対上限）
  assert.ok(big.size < bigger.size, 'sanity: 単調性を検査する2つの規模は実際に異なること');
  assert.ok(pf.requiredDeploymentRate(big) < pf.NEXT_FUND_MIN_DEPLOYMENT, '大型ほど要件は緩む');
  assert.ok(pf.requiredDeploymentRate(bigger) < pf.requiredDeploymentRate(big), '規模に対して単調に緩む');
  assert.ok(pf.requiredDeploymentRate(bigger) >= pf.MIN_DEPLOYMENT_FLOOR, '下限より下には行かない');
  // 投資期間を終えたファンドはさらに一段緩む（もう消化する機会が無い）。
  const closed = fundOfSize(2_000_000_000_000, { status: 'closed' }).fund;
  assert.ok(pf.requiredDeploymentRate(closed) < pf.requiredDeploymentRate(big));
  // DPIの要件は不変。消化率を満たしていてもDPIが足りなければ次号は組めない。
  const { e, fund } = fundOfSize(300_000_000_000);
  fund.deals.push({ id: 'd', status: 'exited', investedAmount: fund.size, fundPortion: fund.size, coinvestPortion: 0 });
  fund.distributed = fund.size * (pf.NEXT_FUND_MIN_DPI - .01);
  assert.equal(pf.canFormNextFund(e.g), false, 'DPI 1.2倍未満では次号を組めない');
  fund.distributed = fund.size * pf.NEXT_FUND_MIN_DPI;
  assert.equal(pf.canFormNextFund(e.g), true, 'DPIと消化率を満たせば組める');
}

// 3. 市場が吸収できる規模を超えてファンドを集めない（集めても消化できず梯子が止まるため）。
{
  const ceiling = pf.marketAbsorbableFundSize();
  assert.ok(Number.isFinite(ceiling) && ceiling > 0);
  assert.ok(ceiling <= pf.MAX_FUND_SIZE, '吸収上限は絶対上限を超えない');
  // 個人資産をいくら積んでも、組成可能額はこの上限で頭打ちになる。
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'GP', companyName: 'PE', difficulty: 'normal' });
  pf.recordExit(e.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52 });
  e.g.peFirm.trackRecord.score = 100;
  for (const personal of [1_000_000_000_000, 100_000_000_000_000]) {
    e.g.personalCash = personal;
    assert.ok(pf.formableFundSize(e.g) <= ceiling + 1, `個人資産${personal / 1e12}兆でも吸収上限で頭打ち`);
  }
  // 小さいうちは従来どおり実績と個人資産で決まる（上限に当たらない）。
  e.g.personalCash = 30_000_000_000;
  e.g.peFirm.trackRecord.score = 5;
  assert.ok(pf.formableFundSize(e.g) < ceiling, '小規模なファンドは吸収上限の影響を受けない');
}

// 4. 回帰: 梯子が止まらない。育ちきったファンドでも案件が供給され、消化率が要件に届く。
//    （T20の停止は「eligibleTiers が空 → 供給ゼロ → 消化率13%で固定」だった）
{
  const { e, fund } = fundOfSize(pf.marketAbsorbableFundSize());
  const ds = modules.peDealSupply;
  e.configure({ playerName: 'GP', companyName: 'PE', difficulty: 'normal' });
  e.g.peFirm.funds.push(fund);
  e.g.departments.investment = { established: true };
  e.g.departmentStaff.investment = 9;
  fund.y0 = e.g.week;
  fund.investmentDeadlineWeek = e.g.week + pf.INVESTMENT_PERIOD_WEEKS;
  let supplied = 0;
  for (let w = e.g.week + 1; w <= e.g.week + 260; w++) if (ds.processSupplyWeek(e.g, w)) supplied++;
  assert.ok(supplied > 0, '吸収上限まで育ったファンドにも案件が供給される');
  assert.ok(tiers.eligibleTiers(fund).length > 0);
}

console.log('pe fund ladder tests passed');
