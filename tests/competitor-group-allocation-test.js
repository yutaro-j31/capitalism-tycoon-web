'use strict';
// Roadmap 8A.3: a competitor group runs more than one business out of a single finite
// budget and the split produces measurably different growth. Each competitor row stays
// scoped to one business so the market calculation is untouched; the group owns the money.
// The allocation gets smarter with difficulty: easy splits evenly, normal backs its own
// stronger front, and hard backs whichever front the player is taking.
const assert = require('node:assert');
const { loadGame } = require('./harness');

// A fixed random value collapses every generated uuid to the same string, which silently
// merges unrelated entities. Tests that create or select entities need a varying source.
function lcg(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function createEngine(difficulty) {
  const loaded = loadGame({ headless: true, random: lcg(20260812) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.normalize();
  engine.g.configured = true;
  engine.g.difficulty = difficulty;
  engine.g.companyName = 'Allocation Co';
  return { loaded, engine };
}

function groupRows(engine) {
  return engine.g.competitors.filter(row => row.groupID === 'group-mega');
}

function groupRecord(engine) {
  return engine.g.competitorGroups.find(group => group.id === 'group-mega');
}

// --- the roster ships a group with two fronts ----------------------------
{
  const { engine } = createEngine('normal');
  const rows = groupRows(engine);
  assert.equal(rows.length, 2, 'the group runs two fronts');
  assert.ok(rows.every(row => row.groupID === 'group-mega'), 'both rows share the group');
  assert.equal(
    new Set(rows.map(row => `${row.businessID}::${row.areaID}`)).size,
    2,
    'the two fronts are distinct'
  );
  assert.ok(
    rows.every(row => typeof row.businessID === 'string' && row.businessID.length > 0),
    'each row still names exactly one business, so the market calculation is unaffected'
  );
  assert.equal(
    new Set(engine.g.competitors.map(row => row.id)).size,
    engine.g.competitors.length,
    'competitor ids are unique even when uuid repeats'
  );
}

// --- difficulty decides how concentrated the budget is -------------------
{
  const expected = { easy: 0.5, normal: 0.65, hard: 0.75 };
  for (const [difficulty, lead] of Object.entries(expected)) {
    const { engine } = createEngine(difficulty);
    const weights = engine.allocateCompetitorGroupBudgets();
    const rows = groupRows(engine);
    const values = rows.map(row => weights.get(row.id));
    assert.equal(
      Math.round(Math.max(...values) * 1000) / 1000,
      Math.round(lead * rows.length * 1000) / 1000,
      `${difficulty} concentrates the budget as specified`
    );
    assert.equal(
      Math.round(values.reduce((sum, value) => sum + value, 0) * 1000) / 1000,
      rows.length,
      `${difficulty} redistributes a finite budget rather than creating one`
    );
  }
}

// --- ungrouped competitors are unaffected --------------------------------
{
  const { engine } = createEngine('hard');
  const weights = engine.allocateCompetitorGroupBudgets();
  for (const row of engine.g.competitors) {
    if (row.groupID) continue;
    assert.equal(
      weights.get(row.id) ?? 1,
      1,
      'a competitor outside a group keeps its own pace'
    );
  }
}

// --- hard follows the player; normal does not ----------------------------
{
  const contested = 'ramen::chubu';
  for (const difficulty of ['normal', 'hard']) {
    const { engine } = createEngine(difficulty);
    const rows = groupRows(engine);
    const contestedRow = rows.find(row => `${row.businessID}::${row.areaID}` === contested);
    assert.ok(contestedRow, 'the group holds the contested front');

    engine.g.playerFrontShares = { [contested]: 0.8 };
    for (let index = 0; index < 60; index += 1) engine.allocateCompetitorGroupBudgets();

    const weights = engine.allocateCompetitorGroupBudgets();
    const contestedWeight = weights.get(contestedRow.id);
    const otherWeight = weights.get(rows.find(row => row !== contestedRow).id);
    if (difficulty === 'hard') {
      assert.ok(
        contestedWeight > otherWeight,
        'hard pours the budget into the front the player is taking'
      );
    } else {
      assert.ok(
        contestedWeight < otherWeight,
        'normal judges its own fronts and ignores where the player is winning'
      );
    }
  }
}

// --- the reaction is an average, not a reflex ----------------------------
{
  const contested = 'ramen::chubu';
  const { engine } = createEngine('hard');
  const rows = groupRows(engine);
  const contestedRow = rows.find(row => `${row.businessID}::${row.areaID}` === contested);

  engine.g.playerFrontShares = { [contested]: 0 };
  for (let index = 0; index < 30; index += 1) engine.allocateCompetitorGroupBudgets();
  const settled = groupRecord(engine).shareAverages[contested];

  engine.g.playerFrontShares = { [contested]: 1 };
  engine.allocateCompetitorGroupBudgets();
  const afterOneWeek = groupRecord(engine).shareAverages[contested];
  assert.ok(afterOneWeek > settled, 'the average moves toward the new reading');
  assert.ok(
    afterOneWeek < 0.5,
    'a single dominant week does not swing the whole budget, which a raw reading would'
  );

  for (let index = 0; index < 40; index += 1) engine.allocateCompetitorGroupBudgets();
  assert.ok(
    groupRecord(engine).shareAverages[contested] > 0.9,
    'sustained pressure is eventually recognised in full'
  );
  assert.ok(
    engine.allocateCompetitorGroupBudgets().get(contestedRow.id) > 1,
    'the contested front ends up favoured once the pressure is sustained'
  );
}

// --- fronts that have left the market drop out of the split --------------
{
  const { engine } = createEngine('hard');
  const rows = groupRows(engine);
  rows[1].areaID = '__bankrupt__';
  const weights = engine.allocateCompetitorGroupBudgets();
  assert.equal(weights.get(rows[0].id) ?? 1, 1, 'a lone surviving front takes its own pace');
  assert.equal(weights.get(rows[1].id), undefined, 'a bankrupt front receives no budget');

  const closed = createEngine('hard');
  const closedRows = groupRows(closed.engine);
  closedRows[1].stores = 0;
  const closedWeights = closed.engine.allocateCompetitorGroupBudgets();
  assert.equal(closedWeights.get(closedRows[1].id), undefined, 'a closed front receives no budget');
  assert.ok(
    groupRecord(closed.engine),
    'the group record survives so its averages are not lost when a front closes'
  );
}

// --- the group state survives a save round trip --------------------------
{
  const { loaded, engine } = createEngine('hard');
  engine.g.playerFrontShares = { 'ramen::chubu': 0.7 };
  for (let index = 0; index < 20; index += 1) engine.allocateCompetitorGroupBudgets();
  const before = JSON.stringify(groupRecord(engine).shareAverages);

  const restored = new loaded.engineModule.TycoonEngine();
  restored.g = JSON.parse(JSON.stringify(engine.g));
  restored.normalize();
  assert.equal(
    JSON.stringify(groupRecord(restored).shareAverages),
    before,
    'the moving averages survive a save round trip'
  );
}

console.log('competitor group allocation tests passed');
