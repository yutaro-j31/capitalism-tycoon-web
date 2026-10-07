'use strict';

const assert=require('node:assert/strict');
const acceptance=require('../scripts/phase1-acceptance');

const SOURCE_SHA='1234567890abcdef1234567890abcdef12345678';
const report=acceptance.runPhase1Acceptance({
  seed:0x51010001,
  sourceMainSha:SOURCE_SHA,
  generatedAt:'2000-01-01T00:00:00.000Z'
});

assert.equal(report.phase1AcceptanceSchemaVersion,1);
assert.equal(report.sourceMainSha,SOURCE_SHA);
assert.equal(report.phase1Baseline,'deea67049953375d10995a49e60d1fcd58cf09a3');
assert.deepEqual([...report.acceptedCutoverFamilies],['company:store-renovation']);
assert.equal(report.overallAcceptanceStatus,'PASS');
assert.deepEqual([...report.failedGates],[]);

const REQUIRED_GATES=[
  'P1_OPERATION_CONTRACT',
  'P1_READ_ONLY_RECONCILIATION',
  'P1_SHADOW_REPLAY',
  'P1_ATOMICITY_IDEMPOTENCY_ROLLBACK',
  'P1_SINGLE_WRITER_CUTOVER',
  'P1_LATER_DOMAINS_READ_ONLY',
  'P1_SAVE_COMPATIBILITY',
  'P1_PHASE0_5_REGRESSION'
];
assert.deepEqual(Object.keys(report.gates),REQUIRED_GATES);
for(const code of REQUIRED_GATES){
  assert.equal(report.gates[code].ok,true,JSON.stringify(report.gates[code],null,2));
}

const save=report.gates.P1_SAVE_COMPATIBILITY.details;
assert.equal(save.saveKey,'capitalism_tycoon_web_v1');
assert.equal(save.saveVersion,9);
assert.equal(save.hasEconomicJournalRoot,false);
assert.equal(save.saveV9Contract,true);

const writer=report.gates.P1_SINGLE_WRITER_CUTOVER.details;
assert.equal(writer.inventoryOk,true);
assert.equal(writer.limitedCutoverSingleWriter,true);
assert.equal(writer.exactWriterCount,1);
assert.deepEqual(writer.exactAuthority,[{
  file:'js/economic-settlement.js',
  paths:['state.companyCash (store renovation EconomicOperation settlement)']
}]);

const domains=report.gates.P1_LATER_DOMAINS_READ_ONLY.details;
assert.equal(domains.onlyApprovedSettlement,true);
assert.deepEqual([...domains.settleFunctions],['settleStoreRenovation']);
assert.deepEqual([...domains.forbiddenHits],[]);
assert.equal(domains.legacyRenovateNoDirectCashWriter,true);
assert.equal(domains.legacyRenovateUsesProjection,true);

const replay=report.gates.P1_SHADOW_REPLAY.details;
assert.equal(replay.reloadStable,true);
assert.equal(replay.duplicateAfterReload,true);
assert.equal(replay.conflictRejected,true);
assert.equal(replay.deterministicReplay,true);
assert.equal(replay.capacityFailClosed,true);
assert.equal(replay.authoritativeStateUnchanged,true);

const atomic=report.gates.P1_ATOMICITY_IDEMPOTENCY_ROLLBACK.details;
assert.equal(atomic.rollback,true);
assert.equal(atomic.idempotency,true);
assert.equal(atomic.limitedCutover.ok,true);
assert.equal(atomic.limitedCutover.cashMovedOnce,true);
assert.equal(atomic.limitedCutover.operationType,'company:store-renovation');

const markdown=acceptance.formatMarkdown(report);
assert.match(markdown,/Overall: \*\*PASS\*\*/);
assert.match(markdown,/P1_SINGLE_WRITER_CUTOVER/);
assert.match(markdown,/does not authorize a second settlement family/);

console.log('Phase 1 acceptance gate tests passed');
