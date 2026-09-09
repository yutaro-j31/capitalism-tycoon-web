'use strict';

// PE mode T13 (docs/PE_MODE_TASKS.md): the 4-path sourcing network -- nodes, trust decay,
// weekly action budget, and the 40% monopoly-share cap.

const assert = require('node:assert/strict');
const fs = require('node:fs');

function load() {
  delete globalThis.__capitalismTycoonModules;
  globalThis.localStorage = { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = String(v); }, removeItem(k) { delete this.store[k]; } };
  globalThis.document = { addEventListener() {} };
  globalThis.window = globalThis;
  for (const m of ['../js/runtime.js', '../js/data.js', '../js/workforce.js', '../js/supply.js', '../js/competitor.js', '../js/competitor-projects.js', '../js/competitor-entry.js', '../js/competitor-credit.js', '../js/competitor-distress.js', '../js/market.js', '../js/finance.js', '../js/engine.js', '../js/completion.js', '../js/pe-fund.js', '../js/pe-network.js']) {
    delete require.cache[require.resolve(m)];
    require(m);
  }
  const modules = globalThis.__capitalismTycoonModules;
  return { modules, TycoonEngine: modules.engine.TycoonEngine, pn: modules.peNetwork };
}
const { TycoonEngine, pn } = load();

// 1. Exactly 4 sourcing paths, matching the design doc's §6.5 table.
{
  assert.equal(pn.PATH_TYPE_IDS.length, 4);
  assert.deepEqual([...pn.PATH_TYPE_IDS].sort(), ['longTermCultivation', 'portfolioReferral', 'referrer', 'reputation'].sort());
  assert.equal(pn.PATH_TYPES.referrer.upperContributionShare, .22);
  assert.equal(pn.PATH_TYPES.longTermCultivation.upperContributionShare, .55);
}

// 2. Completion criterion: nodes.length is capped at 100.
{
  const e = new TycoonEngine();
  for (let i = 0; i < 150; i++) pn.addNode(e.g, { sourceType: 'test', pathType: 'referrer', week: 1 });
  assert.equal(e.g.peNetwork.nodes.length, 100);
}

// 3. Completion criterion: each path grows independently -- decaying/contacting one node of
// one path type must not affect a node of another path type.
{
  const e = new TycoonEngine();
  const nodes = pn.PATH_TYPE_IDS.map(pathType => pn.addNode(e.g, { sourceType: 'src', pathType, week: 1, trust: 50 }));
  pn.contactNode(e.g, nodes[0].id, 1); // only the first path's node is contacted
  assert.equal(nodes[0].trust, 54);
  for (let i = 1; i < nodes.length; i++) assert.equal(nodes[i].trust, 50, `${nodes[i].pathType} must be unaffected by contacting a different path's node`);
}

// 4. Completion criterion: the referrer path decays -- and decays faster than the other 3
// (設計書: 紹介者には年5ポイントの追加減衰).
{
  const e = new TycoonEngine();
  const referrerNode = pn.addNode(e.g, { sourceType: 'bank', pathType: 'referrer', week: 1, trust: 50 });
  const reputationNode = pn.addNode(e.g, { sourceType: 'peer', pathType: 'reputation', week: 1, trust: 50 });
  pn.decayWeek(e.g);
  assert.ok(referrerNode.trust < 50, 'referrer trust must decay');
  assert.ok(reputationNode.trust < 50, 'all paths decay generically');
  assert.ok(referrerNode.trust < reputationNode.trust, 'referrer must decay strictly faster than the other paths');
  assert.ok(Math.abs((50 - reputationNode.trust) - pn.GENERIC_DECAY_PER_WEEK) < 1e-9);
  assert.ok(Math.abs((50 - referrerNode.trust) - (pn.GENERIC_DECAY_PER_WEEK + pn.REFERRER_EXTRA_DECAY_PER_WEEK)) < 1e-9);
}

// 5. A full year of decay (52 weeks) drops an uncontacted node by ~8 points generically, and
// the referrer path by an additional ~5 (design doc's own stated figures).
{
  const e = new TycoonEngine();
  const node = pn.addNode(e.g, { sourceType: 'bank', pathType: 'referrer', week: 1, trust: 90 });
  const other = pn.addNode(e.g, { sourceType: 'peer', pathType: 'reputation', week: 1, trust: 90 });
  for (let i = 0; i < 52; i++) pn.decayWeek(e.g);
  assert.ok(Math.abs((90 - other.trust) - 7.8) < .5, `generic 52-week decay should be ~7.8, got ${90 - other.trust}`);
  assert.ok(Math.abs((90 - node.trust) - (7.8 + 5)) < .5, `referrer 52-week decay should be ~12.8, got ${90 - node.trust}`);
}

// 6. Weekly action budget: exactly 2 per week, refused beyond that, refreshed the next week.
{
  const e = new TycoonEngine();
  const a = pn.addNode(e.g, { sourceType: 'a', pathType: 'referrer', week: 1, trust: 10 });
  const b = pn.addNode(e.g, { sourceType: 'b', pathType: 'reputation', week: 1, trust: 10 });
  const c = pn.addNode(e.g, { sourceType: 'c', pathType: 'longTermCultivation', week: 1, trust: 10 });
  assert.equal(pn.weeklyActionsRemaining(e.g, 5), 2);
  assert.equal(pn.contactNode(e.g, a.id, 5), true);
  assert.equal(pn.weeklyActionsRemaining(e.g, 5), 1);
  assert.equal(pn.contactNode(e.g, b.id, 5), true);
  assert.equal(pn.weeklyActionsRemaining(e.g, 5), 0);
  assert.equal(pn.contactNode(e.g, c.id, 5), false, 'a 3rd contact in the same week must be refused');
  assert.equal(c.trust, 10, 'a refused contact must not change trust');
  assert.equal(pn.contactNode(e.g, c.id, 6), true, 'the next week must restore the budget');
}

// 7. trust tiers (設計書§6): 20/40/60/80 thresholds.
{
  assert.deepEqual(pn.trustTier({ trust: 10 }), { limitedAuctionInvite: false, ddInsiderInfo: false, monopolyDeal: false, exitBuyerIntroduction: false });
  assert.deepEqual(pn.trustTier({ trust: 20 }), { limitedAuctionInvite: true, ddInsiderInfo: false, monopolyDeal: false, exitBuyerIntroduction: false });
  assert.deepEqual(pn.trustTier({ trust: 40 }), { limitedAuctionInvite: true, ddInsiderInfo: true, monopolyDeal: false, exitBuyerIntroduction: false });
  assert.deepEqual(pn.trustTier({ trust: 60 }), { limitedAuctionInvite: true, ddInsiderInfo: true, monopolyDeal: true, exitBuyerIntroduction: false });
  assert.deepEqual(pn.trustTier({ trust: 80 }), { limitedAuctionInvite: true, ddInsiderInfo: true, monopolyDeal: true, exitBuyerIntroduction: true });
}

// 8. bringMonopolyDeal requires trust>=60 and costs a fixed 25 points (60 -> 35, the design
// doc's own example); below threshold it is refused and costs nothing.
{
  const e = new TycoonEngine();
  const weak = pn.addNode(e.g, { sourceType: 'x', pathType: 'reputation', week: 1, trust: 59 });
  assert.equal(pn.bringMonopolyDeal(e.g, weak.id), null);
  assert.equal(weak.trust, 59);
  const strong = pn.addNode(e.g, { sourceType: 'y', pathType: 'reputation', week: 1, trust: 60 });
  const result = pn.bringMonopolyDeal(e.g, strong.id);
  assert.ok(result);
  assert.equal(strong.trust, 35);
}

// 9. Completion criterion: the rolling monopoly share never exceeds 40% even under a stream of
// monopoly-heavy requests, once past the bootstrap sample size -- yet plenty are still granted
// (the cap is not overly conservative).
{
  const e = new TycoonEngine();
  let grantedCount = 0;
  for (let i = 0; i < 200; i++) {
    const entry = pn.recordDealSourced(e.g, { week: i, monopoly: true }); // always REQUEST monopoly
    if (entry.monopoly) grantedCount++;
    if (i >= pn.MONOPOLY_MIN_SAMPLE) {
      assert.ok(pn.monopolyShare(e.g) <= pn.MAX_MONOPOLY_SHARE + 1e-9, `monopoly share must never exceed ${pn.MAX_MONOPOLY_SHARE} at iteration ${i}, got ${pn.monopolyShare(e.g)}`);
    }
  }
  assert.ok(grantedCount > 0, 'the cap must not reject every single monopoly request');
  assert.ok(grantedCount < 200, 'an unbroken stream of monopoly requests must eventually be throttled');
}
{
  // A non-monopoly request is always recorded as such, regardless of window state.
  const e = new TycoonEngine();
  const entry = pn.recordDealSourced(e.g, { week: 1, monopoly: false });
  assert.equal(entry.monopoly, false);
}

// 10. Old save (no peNetwork field at all) loads safely and gets backfilled.
{
  const e = new TycoonEngine();
  delete e.g.peNetwork;
  pn.ensure(e.g);
  assert.deepEqual(e.g.peNetwork.nodes, []);
  assert.equal(e.g.peNetwork.weeklyActionsUsed, 0);
  assert.deepEqual(e.g.peNetwork.favorsOwed, []);
  assert.deepEqual(e.g.peNetwork.dealSourcingLog, []);
}

// 11. No new Math.random()/Date.now()/randomUUID usage.
{
  const src = fs.readFileSync('js/pe-network.js', 'utf8');
  assert.ok(!src.includes('Math.random()'));
  assert.ok(!src.includes('Date.now()'));
  assert.ok(!src.includes('randomUUID'));
}

console.log('pe network tests passed');
