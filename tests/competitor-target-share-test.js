'use strict';

// Phase 8A.2 (持続的な競合戦略) minimum core completion.
//
// docs/gameplay-systems-roadmap.md defines the core as: persistent market-share memory, a target
// share, market priority, and one strategic investment decision that changes competitor
// behavior. Three of those already existed in js/competitor.js -- 104-week presence/performance
// history (memory), evaluatePresences/selectDecisionPresence (priority), and the
// brand/quality/capacity actions (investments). The missing piece was a TARGET: a competitor had
// only reactive entry/exit thresholds, so it could not tell "we are winning" from "we are
// losing" and priced and invested identically either way.
//
// targetShare closes that. It is persistent per-competitor state, derived deterministically from
// the strategy, measured against the same 13-week share memory the rest of the decision logic
// uses, and it modulates the EXISTING price and investment decisions rather than adding new ones.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const loaded = loadGame({ random: () => 0.5, headless: true });
const { competitor: comp, engine } = loaded.modules;

// A competitor holding a steady 10% share for 13 weeks, with healthy margins so the low-margin
// price floor in decide() does not override the share ambition.
function scenario({ targetShare, week = 20, strategyID = 'balanced', brandAwareness = null, quality = null, utilization = .6 } = {}) {
  const state = engine.createInitialState({ configured: true });
  state.week = week;
  comp.ensure(state);
  const c = state.competitorStates[0];
  c.strategyID = strategyID;
  c.targetShare = targetShare;
  c.cash = 50_000_000;
  c.status = 'growing';
  c.lastDecisionWeek = 0;
  c.decisionCooldownWeeks = 0;
  const p = c.marketPresence[0];
  p.currentWeekShare = .10;
  p.revenue = 1_000_000; p.variableCost = 600_000; p.contributionMargin = 400_000;
  p.totalCapacity = 1000; p.fulfilledUnits = Math.round(1000 * utilization);
  if (brandAwareness !== null) p.brandAwareness = brandAwareness;
  if (quality !== null) p.quality = quality;
  state.competitorPresenceHistoryByID[p.presenceID] = Array.from({ length: 13 }, (_, i) => ({
    week: week - 13 + i, presenceID: p.presenceID, competitorID: c.competitorID,
    marketShare: .10, capacityUtilization: utilization, profit: 200_000, price: p.price
  }));
  return { state, c, p };
}
function lastAction(state, c) {
  return (state.competitorActions || []).filter(a => a.competitorID === c.competitorID).slice(-1)[0] || null;
}

// 1. Every strategy declares the share it is trying to hold, and the volume strategies aim
// higher than the premium one.
{
  const ids = Object.keys(comp.STRATEGIES);
  assert.ok(ids.length >= 5);
  for (const id of ids) {
    const share = comp.STRATEGIES[id].targetShare;
    assert.ok(Number.isFinite(share) && share > 0 && share < 1, `${id} に有効な目標シェアがある`);
  }
  assert.ok(comp.STRATEGIES.low_price.targetShare > comp.STRATEGIES.quality.targetShare,
    '低価格型は品質型より高いシェアを狙う');
  assert.ok(comp.STRATEGIES.convenience.targetShare > comp.STRATEGIES.quality.targetShare,
    '利便性型は品質型より高いシェアを狙う');
  assert.equal(comp.strategyTargetShare(undefined), comp.STRATEGIES.balanced.targetShare, '不明な戦略はバランス型の目標へ');
  assert.equal(comp.strategyTargetShare({ targetShare: 'bad' }), comp.STRATEGIES.balanced.targetShare);
}

// 2. shareAmbition is positive below target, zero at target, negative above -- and reads the
// 13-week memory rather than the latest week alone.
{
  const s = comp.STRATEGIES.balanced;
  const below = scenario({ targetShare: .40 });
  assert.equal(Number(comp.shareAmbition(below.state, below.c, below.p, s).toFixed(4)), .30);
  const at = scenario({ targetShare: .10 });
  // Averaging 13 stored shares leaves float residue, so compare within tolerance rather than to
  // an exact zero.
  assert.ok(Math.abs(comp.shareAmbition(at.state, at.c, at.p, s)) < 1e-9, '目標ちょうどなら差はゼロ');
  const above = scenario({ targetShare: .05 });
  assert.equal(Number(comp.shareAmbition(above.state, above.c, above.p, s).toFixed(4)), -.05);

  // A single spectacular week must not flip the ambition -- the 13-week average dominates.
  const spike = scenario({ targetShare: .40 });
  spike.p.currentWeekShare = .95;
  assert.equal(Number(comp.shareAmbition(spike.state, spike.c, spike.p, s).toFixed(4)), .30,
    '直近1週の急変では目標との差は動かない（13週メモリで判断する）');

  // Clamped so an absurd target cannot invert a strategy's identity.
  const extreme = scenario({ targetShare: 1 });
  assert.equal(comp.shareAmbition(extreme.state, extreme.c, extreme.p, s), comp.SHARE_AMBITION_LIMIT);
}

// 3. The target is persistent state: seeded on migration, defaulted for old saves that never had
// the field, and repaired when malformed.
{
  const state = engine.createInitialState({ configured: true });
  comp.ensure(state);
  const c = state.competitorStates[0];
  assert.ok(Number.isFinite(c.targetShare) && c.targetShare > 0, '移行時に目標シェアが入る');
  assert.equal(c.targetShare, comp.strategyTargetShare(comp.STRATEGIES[c.strategyID]), '戦略の既定値で初期化される');

  for (const malformed of [undefined, null, 'x', NaN, -1, 5]) {
    c.targetShare = malformed;
    comp.ensure(state);
    assert.ok(Number.isFinite(c.targetShare) && c.targetShare >= 0 && c.targetShare <= 1,
      `不正値(${String(malformed)})は有効な範囲へ正規化される`);
  }
  // A deliberately set target survives normalization untouched.
  c.targetShare = .33;
  comp.ensure(state);
  assert.equal(c.targetShare, .33, '明示的に設定した目標は保持される');
}

// 4. Behaviour actually changes: a competitor far below its target competes on price, while the
// same competitor at or above its target does not. (Without this the whole feature would be
// inert state.)
{
  const behind = scenario({ targetShare: .40 });
  comp.processWeek(behind.state);
  const behindAction = lastAction(behind.state, behind.c);
  assert.ok(behindAction, '目標に届いていない競合は行動する');
  assert.equal(behindAction.actionType, 'priceDecrease', '目標シェアに不足していれば値下げして取りにいく');
  assert.ok(behindAction.newValue < behind.p.price, `値下げ後の価格が元より低い (${behindAction.newValue} < ${behind.p.price})`);

  for (const targetShare of [.10, .05]) {
    const content = scenario({ targetShare });
    comp.processWeek(content.state);
    const action = lastAction(content.state, content.c);
    assert.ok(!action || action.actionType !== 'priceDecrease',
      `目標を満たしている競合(${targetShare})は値下げしない`);
  }
}

// 5. The same ambition relaxes the investment gates: a competitor short of its target invests in
// brand/quality at levels a satisfied competitor would leave alone.
{
  // week 13 is an investment week (13%13===0) but not a pricing week (13%4!==0).
  const behindBrand = scenario({ targetShare: .40, week: 13, brandAwareness: 80 });
  comp.processWeek(behindBrand.state);
  const brandAction = lastAction(behindBrand.state, behindBrand.c);
  assert.equal(brandAction && brandAction.actionType, 'brandInvestment',
    '目標に不足していればブランド認知80でもさらに投資する');

  const contentBrand = scenario({ targetShare: .10, week: 13, brandAwareness: 80 });
  comp.processWeek(contentBrand.state);
  const contentAction = lastAction(contentBrand.state, contentBrand.c);
  assert.ok(!contentAction || contentAction.actionType !== 'brandInvestment',
    '目標を満たしていればブランド認知80で追加投資しない');

  // With brand already saturated, the same ambition reaches the quality gate instead.
  const behindQuality = scenario({ targetShare: .40, week: 13, brandAwareness: 99, quality: 80 });
  comp.processWeek(behindQuality.state);
  const qualityAction = lastAction(behindQuality.state, behindQuality.c);
  assert.equal(qualityAction && qualityAction.actionType, 'qualityInvestment',
    '目標に不足していれば品質80でもさらに投資する');

  const contentQuality = scenario({ targetShare: .10, week: 13, brandAwareness: 99, quality: 80 });
  comp.processWeek(contentQuality.state);
  const contentQualityAction = lastAction(contentQuality.state, contentQuality.c);
  assert.ok(!contentQualityAction || contentQualityAction.actionType !== 'qualityInvestment',
    '目標を満たしていれば品質80で追加投資しない');
}

// 6. The decision stays explainable: the reason list names the target and the gap, the way every
// other competitor decision reason does.
{
  const behind = scenario({ targetShare: .40 });
  comp.processWeek(behind.state);
  const action = lastAction(behind.state, behind.c);
  assert.ok(action.reasonCodes.includes('targetShare'), '判断理由に目標シェアが含まれる');
  assert.match(action.reasonText, /目標シェア/);
  assert.match(action.reasonText, /不足/, '不足している旨が言語化される');
}

// 7. Determinism: identical state produces identical decisions, and none of this consumes
// randomness (competitor decisions are hash/history based by design).
{
  const run = () => {
    const { state, c } = scenario({ targetShare: .40 });
    comp.processWeek(state);
    const action = lastAction(state, c);
    return { type: action.actionType, value: action.newValue, reason: action.reasonText };
  };
  assert.deepEqual(run(), run(), '同一入力なら同一判断');

  const { state } = scenario({ targetShare: .40 });
  let calls = 0;
  const original = loaded.ctx.Math.random;
  loaded.ctx.Math.random = () => { calls++; return original(); };
  comp.processWeek(state);
  loaded.ctx.Math.random = original;
  assert.equal(calls, 0, '目標シェア判断はMath.randomを消費しない');
}

// 8. The state stays valid under the module's own contract after the new field is exercised.
{
  const { state } = scenario({ targetShare: .40 });
  comp.processWeek(state);
  assert.equal(comp.validate(state), true);
}

console.log('competitor target share tests passed');
