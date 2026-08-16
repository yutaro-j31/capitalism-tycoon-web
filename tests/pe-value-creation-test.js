'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 4242) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 4242) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.personalCash = 500_000_000;
  return { modules, ctx, engine };
}

function openDeal(engine, amount = 20_000_000) {
  assert.equal(engine.createPEDeal('テック', amount), true, 'PE案件を組成できる');
  return engine.g.peDeals[engine.g.peDeals.length - 1];
}

// 1. 課題は既存フィールドから導出され、保存もされず、同じ案件なら常に同じ。
{
  const { modules, engine } = newGame();
  const deal = openDeal(engine);
  assert.equal(Object.prototype.hasOwnProperty.call(deal, 'issue'), false, '課題は案件に保存しない');
  const first = modules.peValueCreation.issueOf(deal);
  assert.ok(first, '課題が導出される');
  assert.equal(modules.peValueCreation.issueOf(deal).id, first.id, '同じ案件なら同じ課題');
  assert.ok(modules.peValueCreation.ISSUES.some(x => x.id === first.id), '定義済みの課題から選ばれる');
}

// 2. 課題に合った施策は、合わない施策より改善度も企業価値も大きく伸ばす。
{
  const { modules } = newGame();
  const run = initiativeID => {
    const { engine } = newGame(777);
    const deal = openDeal(engine);
    const before = { score: deal.improvementScore, valuation: deal.currentValuation };
    assert.equal(engine.applyPEInitiative(deal.id, initiativeID), true);
    return {
      scoreGain: deal.improvementScore - before.score,
      valuationRatio: deal.currentValuation / before.valuation
    };
  };
  const probe = newGame(777);
  const probeDeal = openDeal(probe.engine);
  const issue = probe.modules.peValueCreation.issueOf(probeDeal);
  const matched = run(issue.initiativeID);
  const other = modules.peValueCreation.INITIATIVES.find(x => x.id !== issue.initiativeID);
  const mismatched = run(other.id);

  assert.equal(matched.scoreGain, modules.peValueCreation.MATCHED_SCORE_GAIN, '的中時の改善度');
  assert.equal(mismatched.scoreGain, modules.peValueCreation.MISMATCHED_SCORE_GAIN, '不一致時の改善度');
  assert.ok(matched.scoreGain > mismatched.scoreGain, '的中の方が改善度が大きい');
  assert.ok(matched.valuationRatio > mismatched.valuationRatio, '的中の方が企業価値が伸びる');
}

// 3. 進めると課題が移り変わる（再建が段階的に進む）。
{
  const { modules, engine } = newGame();
  const deal = openDeal(engine);
  const seen = new Set();
  let guard = 0;
  while (!modules.peValueCreation.isResolved(deal) && guard++ < 60) {
    const issue = modules.peValueCreation.issueOf(deal);
    if (issue) seen.add(`${modules.peValueCreation.stageOf(deal)}:${issue.id}`);
    engine.applyPEInitiative(deal.id, modules.peValueCreation.INITIATIVES[0].id);
  }
  assert.equal(modules.peValueCreation.isResolved(deal), true, '施策を重ねれば再建は完了する');
  assert.equal(deal.improvementScore, modules.peValueCreation.MAX_SCORE, '改善度は上限で止まる');
  assert.ok(seen.size >= 2, '途中で段階（課題）が切り替わる');
  assert.equal(modules.peValueCreation.issueOf(deal), null, '完了後は課題が無い');
}

// 4. 完了した案件へはそれ以上施策を打てない。
{
  const { modules, engine } = newGame();
  const deal = openDeal(engine);
  deal.improvementScore = modules.peValueCreation.MAX_SCORE;
  const cashBefore = engine.g.personalCash;
  const valuationBefore = deal.currentValuation;
  assert.equal(engine.applyPEInitiative(deal.id, 'cost-cut'), false, '完了案件は施策不可');
  assert.equal(engine.g.personalCash, cashBefore, '現金は動かない');
  assert.equal(deal.currentValuation, valuationBefore, '企業価値は動かない');
  assert.equal(engine.peValueCreationPlan(deal.id).resolved, true, 'plan は完了を伝える');
}

// 5. 個人資金だけを使い、会社側の現金と財務諸表には触れない（資産分離）。
{
  const { modules, engine } = newGame();
  const deal = openDeal(engine);
  const companyCashBefore = engine.g.companyCash;
  const txBefore = (engine.g.finance.transactions || []).length;
  const assetsBefore = engine.g.finance.fixedAssets.length;
  const personalBefore = engine.g.personalCash;
  const cost = modules.peValueCreation.initiativeCost(deal);

  assert.equal(engine.applyPEInitiative(deal.id, 'cost-cut'), true);
  assert.equal(engine.g.personalCash, personalBefore - cost, '個人資金から支払う');
  assert.equal(engine.g.companyCash, companyCashBefore, '会社現金は動かない');
  assert.equal((engine.g.finance.transactions || []).length, txBefore, '会社の会計へは計上しない');
  assert.equal(engine.g.finance.fixedAssets.length, assetsBefore, '会社の固定資産も動かない');
}

// 6. 実行できないケースでは状態を一切変えない。
{
  const { modules, engine } = newGame();
  const deal = openDeal(engine);
  const snapshot = () => JSON.stringify({ s: deal.improvementScore, v: deal.currentValuation, c: engine.g.personalCash });

  let before = snapshot();
  assert.equal(engine.applyPEInitiative(deal.id, 'no-such-initiative'), false, '不明な施策は失敗する');
  assert.equal(snapshot(), before, '状態は変わらない');

  assert.equal(engine.applyPEInitiative('missing-deal-id', 'cost-cut'), false, '不明な案件は失敗する');
  assert.equal(engine.peValueCreationPlan('missing-deal-id'), null, '不明な案件の計画は null');

  engine.g.personalCash = modules.peValueCreation.initiativeCost(deal) - 1;
  before = snapshot();
  assert.equal(engine.applyPEInitiative(deal.id, 'cost-cut'), false, '資金不足では失敗する');
  assert.equal(snapshot(), before, '資金不足でも状態は変わらない');

  deal.status = 'exited';
  engine.g.personalCash = 500_000_000;
  assert.equal(engine.applyPEInitiative(deal.id, 'cost-cut'), false, 'EXIT済みの案件は対象外');
}

// 7. 決定論：同じ種・同じ操作なら結果が完全に一致する。
{
  const run = () => {
    const { engine } = newGame(20260814);
    const deal = openDeal(engine);
    engine.applyPEInitiative(deal.id, 'cost-cut');
    engine.applyPEInitiative(deal.id, 'talent');
    return JSON.stringify({ s: deal.improvementScore, v: deal.currentValuation, c: engine.g.personalCash });
  };
  assert.equal(run(), run(), '同じ入力なら同じ結果になる');
}

// 8. 施策費用は乱数に依存せず、投資額から決まる。
{
  const a = newGame(5); const da = openDeal(a.engine, 30_000_000);
  const b = newGame(6000); const db = openDeal(b.engine, 30_000_000);
  assert.equal(
    a.modules.peValueCreation.initiativeCost(da),
    b.modules.peValueCreation.initiativeCost(db),
    '乱数種が違っても同じ費用'
  );
  const small = newGame(7); const ds = openDeal(small.engine, 1_000_000);
  assert.equal(
    small.modules.peValueCreation.initiativeCost(ds),
    small.modules.peValueCreation.MIN_INITIATIVE_COST,
    '小口案件では下限費用が適用される'
  );
}

// 9. 既存セーブ互換：issue を持たない既存案件でも課題が導出され、施策を打てる。
{
  const { modules, ctx, engine } = newGame();
  const EngineClass = modules.engine.TycoonEngine;
  const deal = openDeal(engine);
  engine.applyPEInitiative(deal.id, 'cost-cut');
  engine.save();

  const saved = JSON.parse(ctx.localStorage.getItem('capitalism_tycoon_web_v1'));
  assert.equal(saved.saveVersion, 9, 'saveVersion は 9 のまま');
  const savedDeal = saved.peDeals[0];
  assert.equal(Object.prototype.hasOwnProperty.call(savedDeal, 'issue'), false, '課題はセーブに増えない');

  const reloaded = EngineClass.load();
  const reloadedDeal = reloaded.g.peDeals[0];
  assert.equal(reloadedDeal.improvementScore, deal.improvementScore, '改善度は復元される');
  assert.ok(modules.peValueCreation.issueOf(reloadedDeal), 'ロード後も課題が導出できる');
  assert.equal(reloaded.applyPEInitiative(reloadedDeal.id, 'talent'), true, 'ロード後も施策を打てる');
}

// 10. 既存の improvePEDeal は従来どおり動く（後方互換）。
{
  const { engine } = newGame();
  const deal = openDeal(engine);
  const before = { s: deal.improvementScore, v: deal.currentValuation };
  assert.equal(engine.improvePEDeal(deal.id), true, '旧APIは引き続き動く');
  assert.equal(deal.improvementScore, before.s + 6, '旧APIの改善度は従来のまま');
  assert.ok(Math.abs(deal.currentValuation - before.v * 1.05) < 1e-6, '旧APIの評価額は従来のまま');
}

// 11. plan() が UI に必要な情報を返す。
{
  const { modules, engine } = newGame();
  const deal = openDeal(engine);
  const plan = engine.peValueCreationPlan(deal.id);
  assert.equal(plan.dealID, String(deal.id));
  assert.equal(plan.resolved, false);
  assert.equal(plan.affordable, true);
  assert.equal(plan.initiatives.length, modules.peValueCreation.INITIATIVES.length, '施策が全て並ぶ');
  const recommended = plan.initiatives.filter(x => x.recommended);
  assert.equal(recommended.length, 1, '推奨施策はちょうど1つ');
  assert.equal(recommended[0].id, plan.issue.initiativeID, '推奨施策が課題と対応する');
  assert.ok(recommended[0].scoreGain > plan.initiatives.find(x => !x.recommended).scoreGain, '推奨の方が効果が大きいと示される');

  engine.g.personalCash = 0;
  assert.equal(engine.peValueCreationPlan(deal.id).affordable, false, '資金不足は affordable=false で表現される');
}

console.log('PE value creation tests passed');
