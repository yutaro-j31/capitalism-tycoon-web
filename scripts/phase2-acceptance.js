'use strict';

// Read-only acceptance infrastructure. Production finance remains the accounting authority.
const phase05=require('./phase0-5-harness');
const SCHEMA_VERSION=1;
const REQUIRED_CLOSE_CHECKS=Object.freeze([
  'P2-CLOSE-BS-IDENTITY','P2-CLOSE-BS-CASH','P2-CLOSE-CF-IDENTITY',
  'P2-CLOSE-CF-ENDING-CASH','P2-CLOSE-WEEKLY-CASH','P2-CLOSE-WEEKLY-ROLLFORWARD',
  'P2-CLOSE-FINANCE-ROLLFORWARD','P2-DEBT-ROLLFORWARD','P2-DEBT-INSTRUMENTS',
  'P2-DEBT-PRINCIPAL-PNL','P2-DEBT-INTEREST-PRINCIPAL','P2-DEBT-DIRECTION',
  'P2-DEBT-PREVIOUS-SNAPSHOT','P2-DIVIDEND-PENDING','P2-DIVIDEND-RECEIPTS',
  'P2-DIVIDEND-FINITE','P2-DIVIDEND-RECOGNITION','P2-DIVIDEND-PAYER',
  'P2-DIVIDEND-CONSERVATION','P2-DIVIDEND-RETAINED-EARNINGS',
  'P2-BUYBACK-FINITE','P2-BUYBACK-RECEIPTS','P2-BUYBACK-EVIDENCE-COST',
  'P2-BUYBACK-EVIDENCE-SHARES','P2-BUYBACK-TREASURY','P2-BUYBACK-TREASURY-BOOK',
  'P2-BUYBACK-OUTSTANDING','P2-BUYBACK-OWNERSHIP','P2-BUYBACK-PER-SHARE',
  'P2-ASSET-FINITE','P2-ASSET-ACQUISITION','P2-ASSET-BOOK','P2-ASSET-DEPRECIATION',
  'P2-ASSET-DISPOSAL','P2-ASSET-INVESTING-CF','P2-ASSET-DUPLICATE'
]);
const LONG_RUN_ENVELOPE=Object.freeze({
  test:'tests/full-index-weekly-validate-208w-test.js',
  routes:Object.freeze(['ramen','conveni','gym','realEstateAgency']),
  weeks:208,reloadForkWeek:104,reloadForkWeeks:12,allowedViolations:0
});
function check(code,ok,details={}){return Object.freeze({code,ok:ok===true,details:Object.freeze(details)});}
function duplicates(rows,key){
  const seen=new Set(),found=[];
  for(const row of rows){const value=row[key];if(key==='idempotencyKey'&&!value)continue;
    if(seen.has(value))found.push(String(value));else seen.add(value);
  }
  return found;
}
function report(checks,details={}){
  const failedGates=checks.filter(row=>!row.ok).map(row=>row.code);
  return Object.freeze({schemaVersion:SCHEMA_VERSION,...details,checks:Object.freeze(checks),
    failedGates:Object.freeze(failedGates),ok:failedGates.length===0});
}
function snapshotAccountingAcceptance(state,finance){
  // Inspect raw values BEFORE JSON serialization or ensureFinance can normalize invalid numbers.
  const issues=phase05.findNonFiniteNumbers(state);
  const rows=state?.finance?.transactions;
  const validRows=Array.isArray(rows)&&rows.every(row=>row&&typeof row==='object'&&!Array.isArray(row));
  const checks=[check('P2-ACCEPT-RAW-FINITE',issues.length===0,{issues}),
    check('P2-ACCEPT-SAVE-V9',state?.saveVersion===9),
    check('P2-ACCEPT-TRANSACTION-SHAPE',validRows)];
  const transactionIDs=validRows?duplicates(rows,'transactionID'):[],idempotencyKeys=validRows?duplicates(rows,'idempotencyKey'):[];
  checks.push(check('P2-ACCEPT-TRANSACTION-ID',validRows&&transactionIDs.length===0,{duplicates:transactionIDs}),
    check('P2-ACCEPT-IDEMPOTENCY-KEY',validRows&&idempotencyKeys.length===0,{duplicates:idempotencyKeys}));
  if(issues.length||!validRows){
    checks.push(check('P2-ACCEPT-CLOSE',false,{reason:'invalid raw state; close not evaluated'}));
    return report(checks,{readOnly:true});
  }
  const before=JSON.stringify(state),copy=JSON.parse(before);
  let close,validation;
  try{
    close=finance.standaloneClose(copy,'52');
    validation=finance.validate(copy);
    const missing=REQUIRED_CLOSE_CHECKS.filter(code=>close.checks?.filter(row=>row.code===code).length!==1);
    checks.push(check('P2-ACCEPT-CLOSE-COVERAGE',missing.length===0,{missing}),
      check('P2-ACCEPT-CLOSE',close.ok===true&&close.checks?.every(row=>row.ok===true),{errors:close.errors}),
      check('P2-ACCEPT-LEGACY-VALIDATION',validation.ok===true,{errors:validation.errors}));
  }catch(error){checks.push(check('P2-ACCEPT-CLOSE',false,{error:error.message}));}
  const readOnly=before===JSON.stringify(state);
  checks.push(check('P2-ACCEPT-READ-ONLY',readOnly));
  return report(checks,{readOnly,close,validation});
}
function createAcceptanceRuntime(options={}){
  const scenario=phase05.createScenario({requestedScenarioSeed:options.seed??0x52600001,
    durationWeeks:13,scenarioId:'phase2-acceptance',
    scenarioIdentityFields:{companyName:'Phase 2 Acceptance',playerName:'P2 Founder',ticker:'P2AC',fixtureLabel:'p2-acceptance'}});
  const runtime=phase05.createRuntime(scenario,options),g=runtime.engine.g,finance=runtime.loaded.modules.finance;
  // Opening listed-company fixture matches the P2-3/P2-4 tests; all subsequent movements use production actions.
  Object.assign(g,{week:12,companyCash:500_000_000,companyDebt:0,publicCompany:true,
    sharesOut:1_000_000,founderShares:300_000,treasuryBuybackShares:0,stockPrice:100,ticker:'P2AC'});
  g.market=g.market.filter(row=>row.id!=='P2AC');
  g.market.push({id:'P2AC',name:g.companyName,sector:'コングロマリット',price:100,previous:100,
    dividendYield:0,volatility:0,trend:0,marketCap:100_000_000,per:20,pbr:2,issuedShares:1_000_000,
    dividendPerShare:0,shareholders:{},description:'acceptance fixture',listingMarket:'東証グロース',priceHistory:[]});
  runtime.engine.updateOwnershipRatios();
  g.finance=finance.defaultFinanceState(g);g.finance.ledgerCoverageVersion=finance.LEDGER_COVERAGE_VERSION;
  finance.ensureFinance(g);
  const tenant=g.tenants.filter(row=>!row.occupiedBy).sort((a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0)[0];
  const actions=[runtime.engine.borrow(1_000_000,'company'),
    runtime.engine.openStore({tenantID:tenant?.id,businessID:'ramen',name:'P2 acceptance store',operatingHours:3})];
  const store=g.stores.at(-1);
  actions.push(runtime.engine.upgradeStoreEquipment(store?.id),runtime.engine.buybackOwnShares(1_000_000),runtime.engine.setDividend(.123456789));
  if(actions.some(result=>result!==true))throw new Error('Phase 2 production acceptance fixture action failed');
  return runtime;
}
function replayRecognizedTransactions(runtime){
  const state=runtime.engine.g,finance=runtime.loaded.modules.finance;
  const selectors=[row=>row.category==='debtBorrowing',row=>row.dividendDistribution,
    row=>row.buybackReconciliation,row=>row.fixedAssetLifecycle==='acquisition'];
  const rows=selectors.map(select=>state.finance.transactions.find(select));
  if(rows.some(row=>!row))throw new Error('Missing recognized Phase 2 replay family');
  const before=JSON.stringify(state),outcomes=[];
  for(const row of rows){
    try{outcomes.push(finance.event(state,row.category,row.amount,{...row})===null);}
    catch(error){outcomes.push(/^P2-(ASSET|BUYBACK)-DUPLICATE:/.test(error.message));}
  }
  return Object.freeze({ok:outcomes.every(Boolean)&&before===JSON.stringify(state),
    families:Object.freeze(['debt','dividend','buyback','fixed-asset']),unchanged:before===JSON.stringify(state)});
}
function accountingState(state){
  const keys=['saveVersion','week','companyCash','personalCash','companyDebt','personalDebt',
    'companyStocks','personalStocks','sharesOut','founderShares','treasuryBuybackShares',
    'founderOwnershipRatio','externalShareholderRatio','competitorOwnedRatio','stockPrice',
    'dividendPerShare','publicCompany','ticker','simulationRng','finance'];
  return Object.fromEntries(keys.map(key=>[key,state[key]]));
}
function runPhase2Acceptance(options={}){
  const weeks=options.weeks??13;
  if(!Number.isInteger(weeks)||weeks<1||weeks>208)throw new RangeError('Acceptance smoke weeks must be an integer in [1, 208]');
  const runtime=createAcceptanceRuntime(options),snapshots=[];
  snapshots.push(snapshotAccountingAcceptance(runtime.engine.g,runtime.loaded.modules.finance));
  for(let week=0;week<weeks;week++){
    phase05.stepEconomicTick(runtime);
    snapshots.push(snapshotAccountingAcceptance(runtime.engine.g,runtime.loaded.modules.finance));
  }
  const persistence=[];
  for(const mode of ['production-auto','compacted']){
    const persisted=phase05.persistRuntime(runtime,{mode,profile:'normal'});
    const left=phase05.loadRuntimeFromPayload(runtime,persisted.payload,{hostEntropy:.13});
    const right=phase05.loadRuntimeFromPayload(runtime,persisted.payload,{hostEntropy:.87});
    const comparison=mode==='compacted'||persisted.storageMode!=='raw'?'compacted':'semantic';
    if(phase05.stableStringify(accountingState(runtime.engine.g))!==phase05.stableStringify(accountingState(left.engine.g)))
      throw new Error('Phase 2 accounting state changed across save/reload');
    const replay=replayRecognizedTransactions(left);
    const checkpoints=phase05.advanceForkPair(left,right,3,{comparison,profile:'normal'});
    const leftAccounting=snapshotAccountingAcceptance(left.engine.g,left.loaded.modules.finance);
    const rightAccounting=snapshotAccountingAcceptance(right.engine.g,right.loaded.modules.finance);
    persistence.push(Object.freeze({mode,replay,checkpoints,ok:replay.ok&&leftAccounting.ok&&rightAccounting.ok}));
  }
  // Keep the existing whole-state continuous/reload and compacted/replay contracts, independently
  // of the listed-company accounting fixture's presentation/history initialization.
  const canonicalPersistence=phase05.runPersistenceCharacterization(runtime.scenario,{sourceMainSha:runtime.sourceMainSha});
  const checks=[check('P2-ACCEPT-WEEKLY',snapshots.every(row=>row.ok),
    {snapshots:snapshots.length,violations:snapshots.filter(row=>!row.ok).length}),
    check('P2-ACCEPT-SAVE-RELOAD-REPLAY',persistence.every(row=>row.ok),{persistence}),
    check('P2-ACCEPT-CANONICAL-PERSISTENCE',canonicalPersistence.ok===true),
    check('P2-ACCEPT-SAVE-KEY',runtime.loaded.engineModule.SAVE_KEY==='capitalism_tycoon_web_v1')];
  return report(checks,{scope:'smoke',sourceMainSha:runtime.sourceMainSha,seed:runtime.scenario.requestedScenarioSeed,
    weeks,longRunEnvelope:LONG_RUN_ENVELOPE,finalHash:phase05.semanticStateHash(runtime.engine.g,runtime.scenario.stateHashVersion)});
}
if(require.main===module){
  try{const result=runPhase2Acceptance({sourceMainSha:process.env.GITHUB_SHA});
    process.stdout.write(JSON.stringify(result,null,2)+'\n');if(!result.ok)process.exitCode=1;
  }catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}
module.exports=Object.freeze({SCHEMA_VERSION,REQUIRED_CLOSE_CHECKS,LONG_RUN_ENVELOPE,
  snapshotAccountingAcceptance,createAcceptanceRuntime,replayRecognizedTransactions,accountingState,runPhase2Acceptance});
