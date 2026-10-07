'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const baseline=require('../scripts/phase2-accounting-baseline');

const SOURCE_SHA='1a14987e14b10b0cf9d5da2f3a75e002b7b5a43d';
const registry=baseline.registry();

assert.equal(registry.schemaVersion,1);
assert.equal(registry.phase,'Phase 2');
assert.equal(registry.status,'legacy-compatibility-baseline');
assert.equal(registry.rules.length,15);
assert.deepEqual(registry.rules.map(row=>row.id),[
  'P2-ACC-001','P2-ACC-002','P2-ACC-003','P2-ACC-004','P2-ACC-005',
  'P2-ACC-006','P2-ACC-007','P2-ACC-008','P2-ACC-009','P2-ACC-010',
  'P2-ACC-011','P2-ACC-012','P2-ACC-013','P2-ACC-014','P2-ACC-015'
]);
assert.deepEqual(registry.roadmapGaps.map(row=>row.id),[
  'P2-GAP-001','P2-GAP-002','P2-GAP-003','P2-GAP-004'
]);
assert.deepEqual(registry.roadmapGaps.map(row=>row.plannedSlice),['P2-3','P2-4','P2-5','P2-2']);

const sourceEvidence=baseline.sourceToleranceEvidence();
assert.equal(sourceEvidence.ok,true,JSON.stringify(sourceEvidence.checks.filter(row=>!row.ok)));
assert.equal(sourceEvidence.checks.length,15);

const first=baseline.runAccountingBaseline({
  weeks:13,
  seed:0x52020011,
  sourceMainSha:SOURCE_SHA
});
const second=baseline.runAccountingBaseline({
  weeks:13,
  seed:0x52020011,
  sourceMainSha:SOURCE_SHA
});

assert.equal(first.ok,true,JSON.stringify(first,null,2));
assert.equal(first.readOnly,true);
assert.equal(first.registryRuleCount,15);
assert.equal(first.roadmapGapCount,4);
assert.equal(first.evaluation.ok,true,JSON.stringify(first.evaluation,null,2));
assert.equal(first.metrics.financeValidateOk,true,JSON.stringify(first.metrics.financeValidationErrors));
assert.equal(first.baselineHash,second.baselineHash,'same seed/state horizon must produce identical accounting baseline evidence');
assert.deepEqual(first.metrics,second.metrics);
assert.equal(first.semanticStateHash,second.semanticStateHash);

for(const check of first.evaluation.checks){
  assert.equal(check.ok,true,`${check.id} baseline must pass`);
}

const brokenBs={...first.metrics,balanceSheetDifference:2.01};
const brokenBsEval=baseline.evaluateMetrics(brokenBs,registry);
assert.equal(brokenBsEval.ok,false);
assert.equal(brokenBsEval.checks.find(row=>row.id==='P2-ACC-001').ok,false);

const brokenDebt={...first.metrics,debtPrincipalDifference:0.11};
const brokenDebtEval=baseline.evaluateMetrics(brokenDebt,registry);
assert.equal(brokenDebtEval.ok,false);
assert.equal(brokenDebtEval.checks.find(row=>row.id==='P2-ACC-008').ok,false);

const brokenFinite={...first.metrics,transactionNonFiniteCount:1};
const brokenFiniteEval=baseline.evaluateMetrics(brokenFinite,registry);
assert.equal(brokenFiniteEval.ok,false);
assert.equal(brokenFiniteEval.checks.find(row=>row.id==='P2-ACC-013').ok,false);

const longRunSource=fs.readFileSync(path.join(__dirname,'full-index-weekly-validate-208w-test.js'),'utf8');
assert.match(longRunSource,/phase2Baseline\.snapshotAccounting/);
assert.match(longRunSource,/phase2AccountingBaseline:'passed'/);
assert.match(longRunSource,/accountingEvaluation\.ok,true/);

console.log('Phase 2 standalone accounting baseline tests passed');
