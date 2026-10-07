'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const phase05=require('./phase0-5-harness');

const ROOT=path.resolve(__dirname,'..');
const REGISTRY_PATH=path.join(ROOT,'docs','economic-engine','phase2-standalone-accounting-invariants.json');
const BASELINE_SCHEMA_VERSION=1;

function cloneJson(value){return JSON.parse(JSON.stringify(value));}
function finite(value){const n=Number(value);return Number.isFinite(n)?n:0;}
function abs(value){return Math.abs(Number(value)||0);}
function max(values){return values.length?Math.max(...values):0;}
function stableHash(value){return crypto.createHash('sha256').update(phase05.stableStringify(value)).digest('hex');}
function registry(){return JSON.parse(fs.readFileSync(REGISTRY_PATH,'utf8'));}

function sourceToleranceEvidence(){
  const source=fs.readFileSync(path.join(ROOT,'js','finance.js'),'utf8');
  const checks=[
    {id:'P2-ACC-001',ok:/Math\.abs\(st\.balanceSheet\.balanceDifference\)>2/.test(source)},
    {id:'P2-ACC-002',ok:/Math\.abs\(st\.balanceSheet\.assets\.cashAndDeposits-n\(g\.companyCash\)\)>\.1/.test(source)},
    {id:'P2-ACC-003',ok:/Math\.abs\(cf\.openingCash\+cf\.netCashChange-cf\.endingCash\)>10/.test(source)},
    {id:'P2-ACC-004',ok:/Math\.abs\(cf\.endingCash-n\(g\.companyCash\)\)>\.5/.test(source)},
    {id:'P2-ACC-005',ok:/Math\.abs\(n\(s\.cashDifference\)\)>10/.test(source)},
    {id:'P2-ACC-006',ok:/Math\.abs\(n\(f\.weeklySnapshots\[i-1\]\.endingCash\)-n\(s\.openingCash\)\)>10/.test(source)},
    {id:'P2-ACC-007',ok:/Math\.abs\(rolledCash-n\(g\.companyCash\)\)>10/.test(source)},
    {id:'P2-ACC-008',ok:/Math\.abs\(loanTotal-n\(g\.companyDebt\)\)>\.1/.test(source)},
    {id:'P2-ACC-009',ok:/Math\.abs\(expectedRE-st\.balanceSheet\.equity\.retainedEarnings\)>\.1/.test(source)},
    {id:'P2-ACC-010',ok:/n\(f\.balances\[k\]\)<-\.1/.test(source)},
    {id:'P2-ACC-011',ok:/ids\.has\(t\.transactionID\)/.test(source)},
    {id:'P2-ACC-012',ok:/idem\.has\(t\.idempotencyKey\)/.test(source)},
    {id:'P2-ACC-013',ok:/typeof v==='number'&&!Number\.isFinite\(v\)/.test(source)},
    {id:'P2-ACC-014',ok:/a\.status==='disposed'&&n\(a\.bookValue\)!==0/.test(source)},
    {id:'P2-ACC-015',ok:/n\(a\.accumulatedDepreciation\)-n\(a\.acquisitionCost\)>\.1/.test(source)}
  ];
  return Object.freeze({
    ok:checks.every(row=>row.ok),
    checks:Object.freeze(checks.map(Object.freeze)),
    sourceHash:crypto.createHash('sha256').update(source).digest('hex')
  });
}

function duplicateCount(rows,keyFn){
  const seen=new Set();
  let duplicates=0;
  for(const row of rows){
    const key=keyFn(row);
    if(key==null||key==='')continue;
    if(seen.has(key))duplicates++;
    else seen.add(key);
  }
  return duplicates;
}

function snapshotAccounting(runtime){
  const authoritativeBefore=phase05.semanticStateHash(runtime.engine.g,runtime.scenario.stateHashVersion);
  const state=cloneJson(runtime.engine.g);
  const finance=runtime.loaded.modules.finance;
  const validation=finance.validate(state);
  const statements=finance.buildStatements(state,'52');
  const f=state.finance;
  const tx=Array.isArray(f?.transactions)?f.transactions:[];
  const weekly=Array.isArray(f?.weeklySnapshots)?f.weeklySnapshots:[];
  const loans=Array.isArray(f?.loans)?f.loans:[];
  const fixedAssets=Array.isArray(f?.fixedAssets)?f.fixedAssets:[];

  const archivedCash=finite(f.archivedOperatingCashFlow)+finite(f.archivedInvestingCashFlow)+finite(f.archivedFinancingCashFlow);
  const rolledCash=finite(f.openingCash)+archivedCash+tx.reduce((sum,row)=>sum+finite(row.cashEffect),0);
  const loanTotal=loans.filter(row=>row?.status!=='repaid').reduce((sum,row)=>sum+finite(row.outstandingPrincipal),0);
  const cumulativeNetIncome=finite(f.archivedProfitTotal)+tx.reduce((sum,row)=>sum+finite(row.profitEffect),0);
  const cumulativeDividends=finite(f.archivedDividendTotal)-tx
    .filter(row=>row?.category==='dividend')
    .reduce((sum,row)=>sum+finite(row.cashEffect),0);
  const expectedRetainedEarnings=finite(f.openingRetainedEarnings)+cumulativeNetIncome-cumulativeDividends+finite(f.balances?.priorPeriodAdjustments);

  const weeklyRollforwardDiffs=[];
  for(let i=1;i<weekly.length;i++){
    weeklyRollforwardDiffs.push(abs(finite(weekly[i-1].endingCash)-finite(weekly[i].openingCash)));
  }
  const workingCapitalValues=['accountsReceivable','inventory','accountsPayable','accruedExpenses','accruedTaxes']
    .map(key=>finite(f.balances?.[key]));
  const transactionNonFiniteCount=tx.reduce((count,row)=>count+Object.values(row||{}).filter(value=>typeof value==='number'&&!Number.isFinite(value)).length,0);
  const disposedBookValueNonZeroCount=fixedAssets.filter(row=>row?.status==='disposed'&&finite(row.bookValue)!==0).length;
  const maxDepreciationOverCost=max(fixedAssets.map(row=>finite(row.accumulatedDepreciation)-finite(row.acquisitionCost)));

  const metrics=Object.freeze({
    balanceSheetDifference:abs(statements.balanceSheet?.balanceDifference),
    balanceSheetCashDifference:abs(finite(statements.balanceSheet?.assets?.cashAndDeposits)-finite(state.companyCash)),
    cashFlowIdentityDifference:abs(finite(statements.cashFlow?.openingCash)+finite(statements.cashFlow?.netCashChange)-finite(statements.cashFlow?.endingCash)),
    cashFlowEndingCashDifference:abs(finite(statements.cashFlow?.endingCash)-finite(state.companyCash)),
    maxWeeklyCashDifference:max(weekly.map(row=>abs(row.cashDifference))),
    maxWeeklyOpeningRollforwardDifference:max(weeklyRollforwardDiffs),
    financeOpeningCashRollforwardDifference:abs(rolledCash-finite(state.companyCash)),
    debtPrincipalDifference:abs(loanTotal-finite(state.companyDebt)),
    retainedEarningsDifference:abs(expectedRetainedEarnings-finite(statements.balanceSheet?.equity?.retainedEarnings)),
    minimumWorkingCapitalBalance:workingCapitalValues.length?Math.min(...workingCapitalValues):0,
    duplicateTransactionIdCount:duplicateCount(tx,row=>row?.transactionID),
    duplicateIdempotencyKeyCount:duplicateCount(tx,row=>row?.idempotencyKey),
    transactionNonFiniteCount,
    disposedBookValueNonZeroCount,
    maxDepreciationOverCost,
    transactionCount:tx.length,
    weeklySnapshotCount:weekly.length,
    loanCount:loans.length,
    fixedAssetCount:fixedAssets.length,
    financeValidateOk:validation.ok===true,
    financeValidationErrors:Object.freeze([...(validation.errors||[])])
  });

  const authoritativeAfter=phase05.semanticStateHash(runtime.engine.g,runtime.scenario.stateHashVersion);
  return Object.freeze({
    metrics,
    readOnly:authoritativeBefore===authoritativeAfter,
    authoritativeBefore,
    authoritativeAfter
  });
}

function evaluateMetrics(metrics,inputRegistry=registry()){
  const map={
    'P2-ACC-001':metrics.balanceSheetDifference<=2,
    'P2-ACC-002':metrics.balanceSheetCashDifference<=0.1,
    'P2-ACC-003':metrics.cashFlowIdentityDifference<=10,
    'P2-ACC-004':metrics.cashFlowEndingCashDifference<=0.5,
    'P2-ACC-005':metrics.maxWeeklyCashDifference<=10,
    'P2-ACC-006':metrics.maxWeeklyOpeningRollforwardDifference<=10,
    'P2-ACC-007':metrics.financeOpeningCashRollforwardDifference<=10,
    'P2-ACC-008':metrics.debtPrincipalDifference<=0.1,
    'P2-ACC-009':metrics.retainedEarningsDifference<=0.1,
    'P2-ACC-010':metrics.minimumWorkingCapitalBalance>=-0.1,
    'P2-ACC-011':metrics.duplicateTransactionIdCount===0,
    'P2-ACC-012':metrics.duplicateIdempotencyKeyCount===0,
    'P2-ACC-013':metrics.transactionNonFiniteCount===0,
    'P2-ACC-014':metrics.disposedBookValueNonZeroCount===0,
    'P2-ACC-015':metrics.maxDepreciationOverCost<=0.1
  };
  const checks=inputRegistry.rules.map(rule=>Object.freeze({
    id:rule.id,
    ok:map[rule.id]===true,
    name:rule.name,
    legacyTolerance:rule.legacyTolerance
  }));
  return Object.freeze({
    ok:checks.every(row=>row.ok)&&metrics.financeValidateOk,
    checks:Object.freeze(checks),
    financeValidateOk:metrics.financeValidateOk,
    financeValidationErrors:metrics.financeValidationErrors
  });
}

function runAccountingBaseline(options={}){
  const weeks=Math.max(0,Math.floor(Number(options.weeks??52)));
  const seed=Number(options.seed??0x52020001)>>>0;
  const sourceMainSha=phase05.resolveSourceMainSha(options.sourceMainSha);
  const scenario=phase05.createScenario({
    requestedScenarioSeed:seed,
    durationWeeks:weeks,
    scenarioId:`phase2-accounting-baseline-${weeks}w-${seed}`,
    scenarioIdentityFields:{
      companyName:'Phase 2 Accounting Baseline',
      ticker:'P2AB',
      playerName:'Phase 2 Founder',
      fixtureLabel:`p2-baseline-${weeks}w`
    }
  });
  const runtime=phase05.createRuntime(scenario,{sourceMainSha});
  for(let i=0;i<weeks;i++)phase05.stepEconomicTick(runtime);
  const snapshot=snapshotAccounting(runtime);
  const reg=registry();
  const evaluation=evaluateMetrics(snapshot.metrics,reg);
  const sourceEvidence=sourceToleranceEvidence();
  const report={
    baselineSchemaVersion:BASELINE_SCHEMA_VERSION,
    sourceMainSha,
    scenario:Object.freeze({weeks,seed}),
    registrySchemaVersion:reg.schemaVersion,
    registryRuleCount:reg.rules.length,
    roadmapGapCount:reg.roadmapGaps.length,
    sourceToleranceEvidence,
    metrics:snapshot.metrics,
    evaluation,
    readOnly:snapshot.readOnly,
    semanticStateHash:snapshot.authoritativeAfter
  };
  const baselineHash=stableHash(report);
  return Object.freeze({...report,baselineHash,ok:evaluation.ok&&snapshot.readOnly&&sourceEvidence.ok});
}

function runBaselineMatrix(options={}){
  const sourceMainSha=phase05.resolveSourceMainSha(options.sourceMainSha);
  const cases=options.cases||[
    {weeks:52,seed:0x52020001},
    {weeks:208,seed:0x52020002}
  ];
  const reports=cases.map(row=>runAccountingBaseline({...row,sourceMainSha}));
  return Object.freeze({
    baselineSchemaVersion:BASELINE_SCHEMA_VERSION,
    sourceMainSha,
    reports:Object.freeze(reports),
    ok:reports.every(row=>row.ok)
  });
}

if(require.main===module){
  try{
    const weeks=process.argv[2]==null?52:Number(process.argv[2]);
    const seed=process.argv[3]==null?0x52020001:Number(process.argv[3]);
    process.stdout.write(JSON.stringify(runAccountingBaseline({weeks,seed}),null,2)+'\n');
  }catch(error){
    console.error(error.stack||error.message);
    process.exit(1);
  }
}

module.exports=Object.freeze({
  BASELINE_SCHEMA_VERSION,
  registry,
  sourceToleranceEvidence,
  snapshotAccounting,
  evaluateMetrics,
  runAccountingBaseline,
  runBaselineMatrix
});
