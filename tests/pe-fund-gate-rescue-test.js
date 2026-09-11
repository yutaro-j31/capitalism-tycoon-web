'use strict';

// PE mode T24 (docs/PE_MODE_TASKS.md): 梯子の恒久ロックアウト解消と上限の再設定.
//   24-1 次号ゲートの救済導線（設計書§10「2号を組めない年は起業に戻って会社を作りExitする」）
//   24-2 ファンド1本の絶対上限 5兆円 → 1兆円（設計書§12。年4件×§15の帯では5兆円は消化不能）

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const main = loadGame({ random: () => 0.5, isolatedLegacyIndex: true });
const { engineModule, modules } = main;
const pf = modules.peFund;

// DPIが基準に届かないまま終わったファンドを1本持つ状態を作る。
function firmWithFailedFund({ personalCash = 50_000_000_000, score = 20 } = {}) {
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'GP', companyName: 'PE', difficulty: 'normal' });
  e.g.personalCash = personalCash;
  pf.recordExit(e.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52 });
  e.g.peFirm.trackRecord.score = score;
  const fund = pf.createFund(e.g, { size: 10_000_000_000, gpCommit: 1_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: e.g.week });
  fund.deals.push({ id: 'd', status: 'exited', investedAmount: fund.size, fundPortion: fund.size, coinvestPortion: 0 });
  fund.cash = 0;
  fund.distributed = fund.size * 1.0; // DPI 1.0 < 1.2 → 通常のゲートは通らない
  fund.status = 'closed';
  return { e, fund };
}
// 起業パートに戻ってExitしたことを production の recordExit で記録する。
function foundAndExit(e, { week, moic = 3 } = {}) {
  e.g.week = week;
  return pf.recordExit(e.g, { exitType: 'buyout', realizedAmount: 100_000_000 * moic, investedAmount: 100_000_000, foundedWeek: week - 208, exitedWeek: week, profitableWeekStreak: 208, employeeCount: 40 });
}

// 1. 前提: DPIが足りないファンドは通常のゲートを通らない。
{
  const { e, fund } = firmWithFailedFund();
  assert.ok(pf.fundDPI(fund) < pf.NEXT_FUND_MIN_DPI);
  assert.equal(pf.canFormNextFund(e.g), false, 'DPI 1.2未満では通常のゲートは通らない');
  assert.equal(pf.gateRescueAvailable(e.g, fund), false, '新しい実績が無ければ救済もされない');
}

// 2. 完了条件: その後の新しいExit実績があれば次号を組める（恒久ロックアウトの解消）。
{
  const { e, fund } = firmWithFailedFund();
  const scoreBefore = e.g.peFirm.trackRecord.score;
  for (let i = 0; i < pf.RESCUE_MIN_NEW_EXITS; i++) foundAndExit(e, { week: fund.y0 + 300 + i * 208 });
  assert.ok(e.g.peFirm.trackRecord.score >= Math.min(100, fund.trackScoreAtFormation + pf.RESCUE_MIN_SCORE_GAIN), 'スコアが基準以上に伸びている');
  assert.ok(e.g.peFirm.trackRecord.score > scoreBefore);
  assert.equal(pf.gateRescueAvailable(e.g, fund), true);
  assert.equal(pf.canFormNextFund(e.g), true, '起業に戻って実績を積めば次号を組める');
  // 実際に組成できる（GP出資の現金があるかぎり）。
  assert.equal(e.formPEFund(), true);
  assert.equal(e.g.peFirm.funds.length, 2);
}

// 3. 無条件ではない: Exit1回だけでは失敗を帳消しにできない。
{
  const { e, fund } = firmWithFailedFund();
  foundAndExit(e, { week: fund.y0 + 300 });
  assert.equal(pf.newExitsSinceFund(e.g, fund), 1);
  assert.equal(pf.gateRescueAvailable(e.g, fund), false, `Exit ${pf.RESCUE_MIN_NEW_EXITS}件未満では再開放されない`);
  assert.equal(pf.canFormNextFund(e.g), false);
}

// 4. スコアが伸びていなければ再開放されない（件数だけでは足りない）。
{
  const { e, fund } = firmWithFailedFund({ score: 60 });
  fund.trackScoreAtFormation = 90; // 組成時点のスコアが高く、その後伸びていない状況
  for (let i = 0; i < pf.RESCUE_MIN_NEW_EXITS; i++) foundAndExit(e, { week: fund.y0 + 300 + i * 208, moic: 1.05 });
  assert.ok(pf.newExitsSinceFund(e.g, fund) >= pf.RESCUE_MIN_NEW_EXITS);
  assert.ok(e.g.peFirm.trackRecord.score < 100);
  assert.equal(pf.gateRescueAvailable(e.g, fund), false, 'スコアが伸びていなければ再開放されない');
}

// 5. 数え方: ファンド評価のExitと、その号より前のExitは数えない。
{
  const { e, fund } = firmWithFailedFund();
  const before = pf.newExitsSinceFund(e.g, fund);
  // ファンド評価によるトラックレコード加算は「起業に戻った証拠」ではない。
  e.g.week = fund.y0 + 400;
  pf.recordExit(e.g, { exitType: 'fund', realizedAmount: 1, investedAmount: 1, foundedWeek: fund.y0, exitedWeek: e.g.week });
  assert.equal(pf.newExitsSinceFund(e.g, fund), before, 'ファンド評価のExitは救済の実績に数えない');
  // 組成より前のExit（セットアップで与えた1件）も数えない。
  assert.equal(before, 0, '組成前のExitは数えない');
}

// 6. スコアが既に100の場合は「100を維持していること」が条件になる（min(100, ...)）。
{
  const { e, fund } = firmWithFailedFund({ score: 100 });
  fund.trackScoreAtFormation = 100;
  for (let i = 0; i < pf.RESCUE_MIN_NEW_EXITS; i++) foundAndExit(e, { week: fund.y0 + 300 + i * 208 });
  e.g.peFirm.trackRecord.score = 100;
  assert.equal(pf.gateRescueAvailable(e.g, fund), true, 'スコア上限に張り付いていても救済経路は塞がらない');
}

// 7. 救済は他の条件を免除しない: 個人資産が足りなければ組成は拒否される。
{
  const { e, fund } = firmWithFailedFund();
  for (let i = 0; i < pf.RESCUE_MIN_NEW_EXITS; i++) foundAndExit(e, { week: fund.y0 + 300 + i * 208 });
  assert.equal(pf.canFormNextFund(e.g), true);
  e.g.personalCash = 0;
  const plan = e.formablePEFund();
  assert.equal(plan.ok, false);
  assert.equal(e.formPEFund(), false, '救済されてもGP出資の現金は要る');
}

// 8. 通常のゲートを通るファンドは救済を必要としない（上手いプレイヤーの経路は不変）。
{
  const { e, fund } = firmWithFailedFund();
  fund.distributed = fund.size * 1.5; // DPI 1.5
  assert.equal(pf.newExitsSinceFund(e.g, fund), 0, '新しいExitは無い');
  assert.equal(pf.canFormNextFund(e.g), true, '通常のゲートだけで次号を組める');
}

// 9. 24-2: ファンド1本の絶対上限が1兆円で、どの経路からも効く。
{
  assert.equal(pf.MAX_FUND_SIZE, 1_000_000_000_000, '設計書§12の上限は1兆円');
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'GP', companyName: 'PE', difficulty: 'normal' });
  e.g.personalCash = 100_000_000_000_000;
  // createFund に直接大きな額を渡しても切り詰められる。
  const fund = pf.createFund(e.g, { size: 9_000_000_000_000, gpCommit: 100_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  assert.equal(fund.size, pf.MAX_FUND_SIZE);
  assert.equal(fund.cash, pf.MAX_FUND_SIZE);
  assert.equal(fund.lpContributed, pf.MAX_FUND_SIZE - fund.gpCommit, '上限適用後も保存則の形が保たれる');
  // 旧セーブに5兆円のファンドが入っていても読み込み時に切り詰められる。
  fund.size = 5_000_000_000_000;
  e.normalize();
  assert.equal(e.g.peFirm.funds[0].size, pf.MAX_FUND_SIZE, '旧上限のセーブは読み込み時に切り詰められる');
  // 組成可能額も上限を超えない。
  pf.recordExit(e.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52 });
  e.g.peFirm.trackRecord.score = 100;
  assert.ok(pf.formableFundSize(e.g) <= pf.MAX_FUND_SIZE);
}

// 10. 旧セーブ互換: T24以前のファンドには救済の基準点が無いので、読み込み時点のスコアで補う。
{
  const e = new engineModule.TycoonEngine();
  e.configure({ playerName: 'GP', companyName: 'PE', difficulty: 'normal' });
  e.g.peFirm = { trackRecord: { score: 40, exits: [], realizedDPI: 0 }, unlocked: true, funds: [{
    id: 'legacy', size: 10_000_000_000, gpCommit: 1_000_000_000, cash: 0, distributed: 10_000_000_000,
    y0: 1, status: 'closed', terms: { fee: .02, carry: .2, hurdle: .08 }, deals: []
  }] };
  e.normalize();
  const legacy = e.g.peFirm.funds[0];
  assert.equal(legacy.trackScoreAtFormation, 40, '基準点は読み込み時点のスコアで補われる');
  assert.equal(pf.gateRescueAvailable(e.g, legacy), false, '補われた直後は救済されない');
  assert.equal(Number.isFinite(e.g.personalCash), true);
}

console.log('pe fund gate rescue tests passed');
