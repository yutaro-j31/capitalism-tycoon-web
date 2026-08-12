'use strict';
// Phase 2 for roadmap 8A.3: the unit test drives the allocator directly, so it would still
// pass if nothing in the weekly loop ever called it, or if the player's share never
// reached it. This test plays: the player opens stores on one of the group's two fronts,
// weeks are advanced normally, and on hard the group is expected to shift its budget onto
// the contested front. Normal difficulty is the control — the same play must not move it.
const assert = require('node:assert');
const { loadGame } = require('./harness');

const CONTESTED_AREA = 'chubu';
const CONTESTED_FRONT = `ramen::${CONTESTED_AREA}`;
const WEEKS = 30;

// A fixed random value collapses every generated uuid to one string, which merges
// unrelated tenants and stores. A varying deterministic source keeps them distinct.
function lcg(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function run(difficulty) {
  const loaded = loadGame({ headless: true, random: lcg(20260812) });
  const engine = new loaded.engineModule.TycoonEngine();
  engine.normalize();
  engine.g.configured = true;
  engine.g.difficulty = difficulty;
  engine.g.companyName = 'Front Pressure Co';
  engine.g.companyCash = 400_000_000;

  const prefsInArea = new Set(
    engine.g.prefs.filter(pref => pref.areaID === CONTESTED_AREA).map(pref => pref.id)
  );
  let opened = 0;
  for (let index = 0; index < 3; index += 1) {
    const tenant = engine.g.tenants.find(row => prefsInArea.has(row.prefID) && !row.occupiedBy);
    if (tenant && engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: `店${index}` })) {
      opened += 1;
    }
  }

  for (let index = 0; index < WEEKS; index += 1) engine.advanceWeek();

  const rows = engine.g.competitors.filter(row => row.groupID === 'group-mega');
  const group = engine.g.competitorGroups.find(record => record.id === 'group-mega');
  const contestedRow = rows.find(row => `${row.businessID}::${row.areaID}` === CONTESTED_FRONT);
  const otherRow = rows.find(row => row !== contestedRow);

  return {
    opened,
    storesInArea: engine.g.stores.filter(store => prefsInArea.has(store.prefID)).length,
    playerShare: Number((engine.g.playerFrontShares || {})[CONTESTED_FRONT] || 0),
    average: Number(group?.shareAverages?.[CONTESTED_FRONT] || 0),
    contestedAllocation: Number(group?.lastAllocation?.[CONTESTED_FRONT] || 0),
    otherAllocation: Number(
      group?.lastAllocation?.[`${otherRow.businessID}::${otherRow.areaID}`] || 0
    ),
    allocationTotal: Object.values(group?.lastAllocation || {}).reduce((sum, value) => sum + value, 0)
  };
}

// --- the play itself has to create the pressure --------------------------
const hard = run('hard');
assert.equal(hard.opened, 3, 'the player opens stores on the contested front');
assert.ok(hard.storesInArea >= 3, 'the stores really sit in the contested area');
assert.ok(
  hard.playerShare > 0.3,
  `ordinary play must give the player real share on the contested front (got ${hard.playerShare})`
);
assert.ok(
  hard.average > 0.3,
  'the weekly loop feeds that share into the group, without being called directly'
);

// --- hard shifts its budget onto the player ------------------------------
assert.ok(
  hard.contestedAllocation > hard.otherAllocation,
  'hard concentrates its budget on the front the player is taking'
);
assert.equal(
  Math.round(hard.allocationTotal * 1000) / 1000,
  1,
  'the split stays within one finite budget'
);

// --- normal plays its own game -------------------------------------------
const normal = run('normal');
assert.ok(
  normal.playerShare > 0.3,
  'the control run applies the same pressure'
);
assert.ok(
  normal.contestedAllocation < normal.otherAllocation,
  'normal does not chase the player, so the difficulty setting is what changes behaviour'
);

// --- both outcomes are deterministic --------------------------------------
const hardAgain = run('hard');
assert.equal(hardAgain.contestedAllocation, hard.contestedAllocation, 'the hard split is deterministic');
assert.equal(hardAgain.average, hard.average, 'the moving average is deterministic');

console.log(
  `competitor group reachability: player share ${hard.playerShare.toFixed(3)} on ${CONTESTED_FRONT}; ` +
  `hard allocated ${hard.contestedAllocation} there versus ${normal.contestedAllocation} on normal`
);
