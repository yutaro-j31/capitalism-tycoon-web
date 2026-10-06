'use strict';

const fs=require('node:fs');
const path=require('node:path');
const phase05=require('./phase0-5-harness');
const phase05Acceptance=require('./phase0-5-acceptance');

const ROOT=path.resolve(__dirname,'..');
const PHASE1_ACCEPTANCE_SCHEMA_VERSION=1;
const REQUIRED_SAVE_KEY='capitalism_tycoon_web_v1';
const REQUIRED_SAVE_VERSION=9;
const REQUIRED_CUTOVER_OPERATION_TYPE='company:store-renovation';

function gate(code,ok,details={}) {
  return Object.freeze({code,ok:Boolean(ok),details:Object.freeze(details)});
}
function source(relativePath){
  return fs.readFileSync(path.join(ROOT,relativePath),'utf8');
}
function p1Scenario(seed){
  return phase05.createScenario({
    tier:'smoke',
    durationWeeks:2,
    requestedScenarioSeed:seed,
    scenarioId:'phase1-exit',
    scenarioIdentityFields:{
      playerName:'Phase 1 Exit Founder',
      companyName:'Phase 1 Exit Co',
      ticker:'P1EX',
      fixtureLabel:'phase1-exit'
    }
  });
}
function operationContractEvidence(runtime){
  const core=runtime.loaded.modules.economicOperation;
  const id='phase1-exit-contract-op';
  const operation={
    schemaVersion:core.SCHEMA_VERSION,
    operationId:id,
    idempotencyKey:id,
    operationType:'phase1:acceptance-probe',
    decisionPeriod:1,
    settlementPeriod:1,
    status:'committed',
    metadata:{fixture:'phase1-exit'},
    postings:[
      {
        postingId:id+':0',
        operationId:id,
        postingSequence:0,
        entityId:'entity:company:player',
        accountId:'expense:operating',
        side:'debit',
        amount:100,
        currency:'JPY'
      },
      {
        postingId:id+':1',
        operationId:id,
        postingSequence:1,
        entityId:'entity:company:player',
        accountId:'asset:cash',
        side:'credit',
        amount:100,
        currency:'JPY'
      }
    ]
  };
  const valid=core.validateOperation(operation);
  const invalid=JSON.parse(JSON.stringify(operation));
  invalid.postings[1].amount=99;
  const rejected=core.validateOperation(invalid);
  return Object.freeze({
    schemaVersion:core.SCHEMA_VERSION,
    accountTaxonomyVersion:core.ACCOUNT_TAXONOMY_VERSION,
    validBalancedOperation:valid.ok===true,
    rejectsUnbalancedOperation:rejected.ok===false
  });
}
function laterDomainBoundaryEvidence(){
  const settlement=source('js/economic-settlement.js');
  const storeEquipment=source('js/store-equipment.js');
  const saveV9=source('js/save-v9.js');
  const settleFunctions=[...settlement.matchAll(/function\s+(settle[A-Za-z0-9_]*)\s*\(/g)].map(match=>match[1]).sort();
  const exportedTypes=[...settlement.matchAll(/const\s+([A-Z0-9_]*OPERATION_TYPE)\s*=\s*'([^']+)'/g)]
    .map(match=>({constant:match[1],operationType:match[2]}));
  const forbiddenEconomicAuthority=[
    'personalCash',
    'companyDebt',
    'personalDebt',
    'founderShares',
    'sharesOut',
    'treasuryBuybackShares',
    'fund.cash',
    'portfolioCompany.cash',
    'carryingBookValue',
    'personalRealEstateHoldings',
    'advanceWeek(',
    'buyStock(',
    'sellStock('
  ];
  const forbiddenHits=forbiddenEconomicAuthority.filter(token=>settlement.includes(token));
  const renovateStart=storeEquipment.indexOf('function renovate(engine,storeID){');
  const renovateEnd=storeEquipment.indexOf('\nfunction operatingHoursOf',renovateStart);
  const renovate=renovateStart>=0&&renovateEnd>renovateStart?storeEquipment.slice(renovateStart,renovateEnd):'';
  return Object.freeze({
    settleFunctions:Object.freeze(settleFunctions),
    exportedTypes:Object.freeze(exportedTypes.map(row=>Object.freeze(row))),
    forbiddenHits:Object.freeze(forbiddenHits),
    onlyApprovedSettlement:settleFunctions.length===1
      &&settleFunctions[0]==='settleStoreRenovation'
      &&exportedTypes.length===1
      &&exportedTypes[0].operationType===REQUIRED_CUTOVER_OPERATION_TYPE,
    legacyRenovateNoDirectCashWriter:renovate.length>0&&!/state\.companyCash\s*[-+*/]?=/.test(renovate),
    legacyRenovateUsesProjection:renovate.includes('finance.event(')
      &&renovate.includes('operationID:operation.operationId')
      &&renovate.includes('idempotencyKey:operation.idempotencyKey'),
    saveV9Contract:/const\s+SAVE_VERSION\s*=\s*9\s*;/.test(saveV9)
      &&/const\s+SAVE_KEY\s*=\s*engine\.SAVE_KEY\s*;/.test(saveV9)
  });
}
function compatibilityEvidence(runtime){
  const state=runtime.engine.g;
  return Object.freeze({
    saveKey:runtime.loaded.engineModule.SAVE_KEY,
    saveVersion:Number(state.saveVersion),
    hasEconomicJournalRoot:Object.prototype.hasOwnProperty.call(state,'economicJournal')
      ||Object.prototype.hasOwnProperty.call(state,'economicOperationJournal')
      ||Object.prototype.hasOwnProperty.call(state,'economicLedger'),
    simulationRngPresent:Boolean(state.simulationRng),
    simulationRngFinite:Number.isFinite(Number(state.simulationRng?.seed))
      &&Number.isFinite(Number(state.simulationRng?.state))
      &&Number.isFinite(Number(state.simulationRng?.draws))
  });
}
function runPhase1Acceptance(options={}){
  const seed=Number(options.seed??0x51010001);
  const sourceMainSha=phase05.resolveSourceMainSha(options.sourceMainSha);
  const scenario=p1Scenario(seed);
  const runtime=phase05.createRuntime(scenario,{sourceMainSha});
  const phase05Report=phase05Acceptance.runAcceptance({
    tier:'smoke',
    weeks:2,
    seeds:[seed,(seed+1)>>>0],
    sourceMainSha,
    generatedAt:options.generatedAt||'2000-01-01T00:00:00.000Z'
  });
  const persistence=phase05.runPersistenceCharacterization(scenario,{sourceMainSha});
  const operationContract=operationContractEvidence(runtime);
  const laterDomains=laterDomainBoundaryEvidence();
  const compatibility=compatibilityEvidence(runtime);
  const writerInventory=phase05Acceptance.verifyWriterInventory();

  const gates=[
    gate('P1_OPERATION_CONTRACT',
      operationContract.schemaVersion===1
      &&operationContract.accountTaxonomyVersion===1
      &&operationContract.validBalancedOperation
      &&operationContract.rejectsUnbalancedOperation,
      operationContract),
    gate('P1_READ_ONLY_RECONCILIATION',
      persistence.legacyAdapterParity.ok===true
      &&persistence.engineCapabilities.entityAwareLegacyReadModel===true,
      {
        legacyAdapterParity:persistence.legacyAdapterParity.ok,
        capability:persistence.engineCapabilities.entityAwareLegacyReadModel
      }),
    gate('P1_SHADOW_REPLAY',
      persistence.shadowJournalEvidence.ok===true
      &&persistence.shadowJournalEvidence.reloadStable===true
      &&persistence.shadowJournalEvidence.duplicateAfterReload===true
      &&persistence.shadowJournalEvidence.deterministicReplay===true
      &&persistence.shadowJournalEvidence.capacityFailClosed===true,
      persistence.shadowJournalEvidence),
    gate('P1_ATOMICITY_IDEMPOTENCY_ROLLBACK',
      persistence.rollbackEvidence.ok===true
      &&persistence.idempotencyEvidence.ok===true
      &&persistence.limitedCutoverEvidence.ok===true
      &&persistence.limitedCutoverEvidence.cashMovedOnce===true,
      {
        rollback:persistence.rollbackEvidence.ok,
        idempotency:persistence.idempotencyEvidence.ok,
        limitedCutover:persistence.limitedCutoverEvidence
      }),
    gate('P1_SINGLE_WRITER_CUTOVER',
      writerInventory.ok===true
      &&writerInventory.limitedCutoverSingleWriter===true
      &&writerInventory.exactAuthorityCounts.limitedStoreRenovationCompanyCash===1,
      {
        inventoryOk:writerInventory.ok,
        limitedCutoverSingleWriter:writerInventory.limitedCutoverSingleWriter,
        exactWriterCount:writerInventory.exactAuthorityCounts.limitedStoreRenovationCompanyCash,
        exactAuthority:writerInventory.exactAuthority.limitedStoreRenovationCompanyCash
      }),
    gate('P1_LATER_DOMAINS_READ_ONLY',
      laterDomains.onlyApprovedSettlement
      &&laterDomains.forbiddenHits.length===0
      &&laterDomains.legacyRenovateNoDirectCashWriter
      &&laterDomains.legacyRenovateUsesProjection,
      laterDomains),
    gate('P1_SAVE_COMPATIBILITY',
      compatibility.saveKey===REQUIRED_SAVE_KEY
      &&compatibility.saveVersion===REQUIRED_SAVE_VERSION
      &&compatibility.hasEconomicJournalRoot===false
      &&compatibility.simulationRngPresent
      &&compatibility.simulationRngFinite
      &&laterDomains.saveV9Contract,
      {...compatibility,saveV9Contract:laterDomains.saveV9Contract}),
    gate('P1_PHASE0_5_REGRESSION',
      phase05Report.overallAcceptanceStatus==='PASS'
      &&persistence.ok===true,
      {
        phase05Status:phase05Report.overallAcceptanceStatus,
        phase05FailedGates:phase05Report.failedGates,
        persistenceCharacterization:persistence.ok
      })
  ];
  const failedGates=gates.filter(row=>!row.ok).map(row=>row.code);
  const report=Object.freeze({
    phase1AcceptanceSchemaVersion:PHASE1_ACCEPTANCE_SCHEMA_VERSION,
    sourceMainSha,
    phase1Baseline:'deea67049953375d10995a49e60d1fcd58cf09a3',
    acceptedCutoverFamilies:Object.freeze([REQUIRED_CUTOVER_OPERATION_TYPE]),
    gates:Object.freeze(Object.fromEntries(gates.map(row=>[row.code,row]))),
    failedGates:Object.freeze(failedGates),
    overallAcceptanceStatus:failedGates.length?'FAIL':'PASS'
  });
  if(failedGates.length&&!options.returnFailure){
    throw Object.assign(new Error(`Phase 1 acceptance failed: ${failedGates.join(', ')}`),{report});
  }
  return report;
}
function formatMarkdown(report){
  return `# Phase 1 Acceptance Evidence

- Source main SHA: \`${report.sourceMainSha}\`
- Phase 1 baseline before P1-5: \`${report.phase1Baseline}\`
- Overall: **${report.overallAcceptanceStatus}**
- Authoritative EconomicOperation cutover families: ${report.acceptedCutoverFamilies.map(value=>`\`${value}\``).join(', ')}

## Gates

${Object.values(report.gates).map(row=>`- ${row.ok?'PASS':'FAIL'} \`${row.code}\``).join('\n')}

## Exit boundary

Phase 1 acceptance authorizes the completed Entity-aware Operation / Ledger Foundation only.
It does not authorize a second settlement family, broad ledger cutover, Phase 2 accounting migration, or migration of debt/ownership/personal/PE/VC/real-estate authority.
`;
}

if(require.main===module){
  try{
    const report=runPhase1Acceptance({sourceMainSha:process.env.GITHUB_SHA});
    process.stdout.write(formatMarkdown(report));
  }catch(error){
    if(error.report)process.stderr.write(JSON.stringify(error.report,null,2)+'\n');
    console.error(error.stack||error.message);
    process.exit(1);
  }
}

module.exports=Object.freeze({
  PHASE1_ACCEPTANCE_SCHEMA_VERSION,
  REQUIRED_SAVE_KEY,
  REQUIRED_SAVE_VERSION,
  REQUIRED_CUTOVER_OPERATION_TYPE,
  laterDomainBoundaryEvidence,
  runPhase1Acceptance,
  formatMarkdown
});
