const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let randomSeed = 0x5b4c0a11;
const deterministicRandom = () => {
  randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0;
  return randomSeed / 0x100000000;
};
const { modules } = loadGame({ random: deterministicRandom });
const { engine, competitor, market } = modules;
const clone = value => JSON.parse(JSON.stringify(value));

function makeState() {
  const state = engine.createInitialState({ configured: true });
  competitor.ensure(state);
  for (const company of state.competitorStates) {
    company.decisionCooldownWeeks = 1000;
    company.cash = 50_000_000;
    company.debt = 0;
    company.creditScore = 80;
    company.missedDebtPayments = 0;
    company.lossWeeks = 0;
    company.weeklyProfit = 500_000;
    company.status = 'active';
    company.lifecycleStatus = 'active';
    for (const presence of company.marketPresence || []) {
      if (!presence.active) continue;
      presence.fixedCost = 0;
      presence.revenue = 1_000_000;
      presence.variableCost = 100_000;
      presence.contributionMargin = 900_000;
      presence.profit = 900_000;
      presence.totalCapacity = Math.max(1, Number(presence.totalCapacity) || 100);
    }
    competitor.refreshCreditMetrics(state, company);
  }
  return state;
}

{
  const state = makeState();
  const legacyText = '第1週：旧形式の競合イベント';
  state.competitorEvents = [legacyText];
  competitor.ensure(state);
  assert.ok(state.competitorEvents.includes(legacyText), 'legacy string event must survive ensure');
  state.week = 2;
  competitor.processDistressWeek(state);
  assert.ok(state.competitorEvents.includes(legacyText), 'legacy string event must survive lifecycle processing');
}

{
  const state = makeState();
  const company = state.competitorStates[0];
  const presence = company.marketPresence[0];
  const legacy = state.competitors.find(row => row.id === company.legacyCompetitorID);
  assert.ok(legacy, 'detailed competitor must retain its legacy seed record');
  const originalAreaID = legacy.areaID;
  const legacyText = '第3週：保存済みの旧競合イベント';
  state.competitorEvents = [legacyText];
  state.week = 10;
  const action = {
    actionID: `ca-${state.nextCompetitorActionSeq++}`,
    competitorID: company.competitorID,
    presenceID: presence.presenceID,
    decisionWeek: state.week,
    effectiveWeek: state.week + 8,
    actionType: 'capacityExpansion',
    targetBusinessID: 'ramen',
    targetPrefID: presence.prefID,
    previousValue: presence.totalCapacity,
    newValue: presence.totalCapacity * 1.2,
    cost: 700_000,
    reasonCodes: ['test'],
    reasonText: 'pending before bankruptcy',
    status: 'pending',
    applied: false,
    appliedWeek: null,
    operationID: `terminal-compat-${company.competitorID}`
  };
  state.competitorActions.push(action);
  competitor.ensure(state);
  const project = state.competitorProjects.find(row => row.operationID === action.operationID);
  assert.ok(project, 'pending action must have a linked project');

  competitor.declareBankruptcy(state, company, '互換性テスト倒産');
  assert.equal(company.lifecycleStatus, 'bankrupt');
  assert.equal(company.active, false);
  assert.equal(legacy.archivedAreaID, originalAreaID);
  assert.equal(legacy.areaID, '__bankrupt__');
  assert.equal(legacy.lifecycleStatus, 'bankrupt');
  assert.equal(legacy.stores, 0);
  assert.equal(action.status, 'skipped');
  assert.equal(action.lifecycleFailureReason, '互換性テスト倒産');
  assert.equal(project.status, 'failed');
  assert.equal(project.spentCost, 0);
  assert.equal(project.failureReason, 'bankruptcy');
  assert.ok(state.competitorEvents.includes(legacyText), 'legacy string event must survive bankruptcy');
  assert.ok(state.competitorEvents.some(event => event && typeof event === 'object' && event.type === 'bankruptcy'));

  const offers = market.competitorOffers(state, 'ramen', presence.prefID);
  assert.ok(!offers.some(offer => offer.id === presence.presenceID || offer.presenceID === presence.presenceID || offer.competitorID === company.competitorID), 'bankrupt company must not reappear through legacy market fallback');

  competitor.ensure(state);
  competitor.ensure(state);
  assert.equal(legacy.areaID, '__bankrupt__');
  assert.equal(state.competitorEvents.filter(event => event === legacyText).length, 1);
  const beforeValidate = JSON.stringify(state);
  assert.doesNotThrow(() => competitor.validate(state));
  assert.equal(JSON.stringify(state), beforeValidate, 'terminal compatibility validation must be read-only');
  assert.deepEqual(findStateIssues(state), []);

  const restored = new engine.TycoonEngine(clone(state));
  const restoredCompany = restored.g.competitorStates.find(row => row.competitorID === company.competitorID);
  const restoredLegacy = restored.g.competitors.find(row => row.id === company.legacyCompetitorID);
  assert.equal(restoredCompany.lifecycleStatus, 'bankrupt');
  assert.equal(restoredLegacy.areaID, '__bankrupt__');
  assert.ok(restored.g.competitorEvents.includes(legacyText));
}

{
  const state = makeState();
  const company = state.competitorStates[0];
  const presence = company.marketPresence[0];
  const legacy = state.competitors.find(row => row.id === company.legacyCompetitorID);
  company.lifecycleStatus = 'inactive';
  company.status = 'inactive';
  company.active = false;
  presence.active = false;
  presence.totalCapacity = 0;
  competitor.ensure(state);
  assert.equal(legacy.areaID, '__inactive__');
  assert.equal(legacy.lifecycleStatus, 'inactive');
  assert.equal(legacy.stores, 0);
  const offers = market.competitorOffers(state, 'ramen', presence.prefID);
  assert.ok(!offers.some(offer => offer.id === presence.presenceID || offer.presenceID === presence.presenceID || offer.competitorID === company.competitorID), 'inactive company must not reappear through legacy market fallback');
}

{
  const state = makeState();
  const company = state.competitorStates[0];
  const presence = company.marketPresence[0];
  const action = {
    actionID: `ca-${state.nextCompetitorActionSeq++}`,
    competitorID: company.competitorID,
    presenceID: presence.presenceID,
    decisionWeek: 5,
    effectiveWeek: 9,
    actionType: 'qualityInvestment',
    targetBusinessID: 'ramen',
    targetPrefID: presence.prefID,
    previousValue: presence.quality,
    newValue: presence.quality + 2,
    cost: 500_000,
    reasonCodes: ['distress'],
    reasonText: 'cancelled by distress',
    status: 'skipped',
    applied: true,
    appliedWeek: 6,
    lifecycleFailureReason: '財務危機により成長投資を中止',
    operationID: `distress-cancel-${company.competitorID}`
  };
  state.competitorActions.push(action);
  competitor.ensure(state);
  const project = state.competitorProjects.find(row => row.operationID === action.operationID);
  assert.ok(project);
  assert.equal(project.status, 'failed');
  assert.equal(project.spentCost, 0);
  assert.equal(project.failureReason, action.lifecycleFailureReason);
}

console.log('competitor terminal compatibility tests passed');
