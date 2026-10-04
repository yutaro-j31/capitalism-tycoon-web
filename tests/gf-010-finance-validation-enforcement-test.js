'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');
const phase05=require('../scripts/phase0-5-harness');

const SAVE_KEY='capitalism_tycoon_web_v1';
const clone=value=>JSON.parse(JSON.stringify(value));
function lcg(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};}
function setup(seed=0x0f010010){
  const loaded=loadGame({headless:true,random:lcg(seed)}),game=new loaded.engineModule.TycoonEngine();
  game.g.configured=true;
  game.g.companyCash=500_000_000;
  game.g.personalCash=50_000_000;
  game.g.companyDebt=0;
  game.g.personalDebt=2_000_000;
  game.g.finance=loaded.modules.finance.defaultFinanceState(game.g);
  const ramen=game.g.businesses.find(row=>row.id==='ramen');
  game.g.stores.push({id:'gf010-store',businessID:'ramen',prefID:'tokyo',name:'GF-010 Store',status:'open',quality:ramen.quality,brand:ramen.brand,condition:100,operatingHours:3,openingWeek:1,weeksToOpen:0});
  assert.equal(game.save(),true);
  return {loaded,game};
}
function snapshot(loaded,game){
  const payload=loaded.ctx.__localStorageData.get(SAVE_KEY);
  return {
    state:JSON.stringify(game.g),payload,sequence:JSON.parse(payload).saveSequence,
    week:game.g.week,month:game.g.month,companyCash:game.g.companyCash,personalCash:game.g.personalCash,
    companyDebt:game.g.companyDebt,personalDebt:game.g.personalDebt,rng:JSON.stringify(game.g.simulationRng),
    ids:JSON.stringify(Object.fromEntries(Object.entries(game.g).filter(([key])=>/^next[A-Z].*Seq$/.test(key)))),
    transactions:JSON.stringify(game.g.finance.transactions),hash:loaded.modules.semanticHashV2.semanticHashV2(game.g)
  };
}
function injectFinalValidation(modules,behavior){
  const original=modules.finance.validate;let failurePoint=null,calls=0;
  modules.finance.validate=function(state){
    if(/finalizeWeekBoundary/.test(new Error().stack)){calls++;failurePoint={week:state.week,transactionCount:state.finance.transactions.length,rng:clone(state.simulationRng),nextPurchaseOrderSeq:state.nextPurchaseOrderSeq,hash:modules.semanticHashV2.semanticHashV2(state)};return behavior(state,calls);}
    return original.call(this,state);
  };
  return {restore(){modules.finance.validate=original;},failurePoint:()=>failurePoint,calls:()=>calls};
}

// A failed authoritative result is a hard boundary: every economic field and durable byte rolls back.
{
  const {loaded,game}=setup(),before=snapshot(loaded,game);
  const injection=injectFinalValidation(loaded.modules,()=>({ok:false,errors:['synthetic-ledger-divergence']}));
  assert.throws(()=>game.advanceWeek(false),error=>{
    assert.equal(error.code,'finance-validation-failed');
    assert.equal(error.stage,'finance-validation');
    assert.deepEqual(error.financeValidation.reasons,['synthetic-ledger-divergence']);
    assert.equal(error.financeValidation.week,before.week+1);
    assert.equal(error.financeValidation.seed,game.g.simulationRng.seed);
    assert.equal(error.financeValidation.preWeekSemanticHashV2,before.hash);
    assert.ok(error.financeValidation.failureSemanticHashV2);
    return true;
  });
  const point=injection.failurePoint(),after=snapshot(loaded,game);
  assert.ok(point.transactionCount>JSON.parse(before.transactions).length,'finance rows existed at the failure point');
  assert.ok(point.rng.draws>JSON.parse(before.rng).draws,'RNG was consumed before validation');
  assert.notEqual(point.hash,before.hash,'failure-point economic state differs from the checkpoint');
  assert.equal(after.state,before.state,'the complete authoritative state rolls back');
  for(const key of ['week','month','companyCash','personalCash','companyDebt','personalDebt','rng','ids','transactions','hash'])assert.equal(after[key],before[key],`${key} rolls back`);
  assert.equal(after.payload,before.payload,'primary durable payload is byte-identical');
  assert.equal(after.sequence,before.sequence,'save sequence does not advance');
  assert.equal(game.financeValidationFailure.count,1);
  assert.equal(game.financeValidationFailure.firstCause,'synthetic-ledger-divergence');
  assert.equal(game.financeValidationFailure.latestCause,'synthetic-ledger-divergence');
  assert.equal(game.financeValidationFailure.firstFailure.failureSemanticHashV2,point.hash);

  // Repeated failures retain the immutable first occurrence while updating latest/count.
  injection.restore();
  const second=injectFinalValidation(loaded.modules,()=>({ok:false,errors:['second-divergence']}));
  assert.throws(()=>game.advanceWeek(false),error=>error.code==='finance-validation-failed');
  assert.equal(game.financeValidationFailure.count,2);
  assert.equal(game.financeValidationFailure.firstCause,'synthetic-ledger-divergence');
  assert.equal(game.financeValidationFailure.latestCause,'second-divergence');
  assert.equal(game.financeValidationFailure.firstFailure.cause,'synthetic-ledger-divergence');
  assert.equal(game.financeValidationFailure.latestFailure.cause,'second-divergence');
  second.restore();

  // A retry consumes the same RNG/IDs and reaches the same economic state as a clean control.
  const controlLoaded=loadGame({headless:true,random:lcg(0x11111111)});
  const control=new controlLoaded.engineModule.TycoonEngine(JSON.parse(before.state));
  control.g=JSON.parse(before.state); // Compare from the exact checkpoint, without a load-time normalize pass.
  assert.equal(game.advanceWeek(false),true);
  assert.equal(control.advanceWeek(false),true);
  assert.equal(loaded.modules.semanticHashV2.semanticHashV2(game.g),controlLoaded.modules.semanticHashV2.semanticHashV2(control.g),JSON.stringify(phase05.diffSemanticState(game.g,control.g,2)));
  assert.equal(JSON.stringify(game.g.simulationRng),JSON.stringify(control.g.simulationRng));
  assert.equal(game.g.nextPurchaseOrderSeq,control.g.nextPurchaseOrderSeq);
}

// A validator exception is fail-closed, diagnosed separately, rolled back, and never persisted.
{
  const {loaded,game}=setup(0x0f010011),before=snapshot(loaded,game);
  const injection=injectFinalValidation(loaded.modules,()=>{throw new Error('synthetic-validator-crash');});
  assert.throws(()=>game.advanceWeek(false),error=>{
    assert.equal(error.code,'finance-validator-threw');
    assert.match(error.financeValidation.cause,/synthetic-validator-crash/);
    return true;
  });
  assert.deepEqual(snapshot(loaded,game),before);
  assert.equal(game.financeValidationFailure.code,'finance-validator-threw');
  injection.restore();
}

// Phase 0.5 uses the production tick and therefore stops on the first failed week with structured context.
{
  const runtime=phase05.createRuntime(phase05.createScenario({requestedScenarioSeed:0x0f010012,durationWeeks:5,stateHashVersion:2}),{sourceMainSha:'45f61e3de9ab40c584b0ddd8dfae4f4e76ceb095'});
  const startWeek=runtime.engine.g.week,injection=injectFinalValidation(runtime.loaded.modules,()=>({ok:false,errors:['harness-injected-failure']}));
  // Exercise the harness's exact production tick; the throw prevents its scenario loop continuing.
  assert.throws(()=>phase05.stepEconomicTick(runtime),error=>error.code==='finance-validation-failed'&&error.financeValidation.seed===0x0f010012&&error.financeValidation.week===startWeek+1&&Boolean(error.financeValidation.failureSemanticHashV2));
  assert.equal(runtime.engine.g.week,startWeek);
  assert.equal(injection.calls(),1);
  injection.restore();
}

// Stable semantic stage identifiers, rather than source text/line numbers, guard commit ordering.
{
  const {loaded}=setup(0x0f010013),order=loaded.modules.financeValidationBoundary.WEEK_EXECUTION_ORDER;
  assert.deepEqual([...order],[
    'weekly-production-wrappers','delegated-executive-actions','critical-money-finite-guard','finance-snapshot-finalization','liquidity-crisis-finalization',
    'finance-validation','supporting-invariant-validation','weekly-summary-finalization','transaction-commit','persistence'
  ]);
  assert.ok(order.indexOf('weekly-production-wrappers')<order.indexOf('finance-validation'));
  assert.ok(order.indexOf('finance-validation')<order.indexOf('transaction-commit'));
  assert.ok(order.indexOf('transaction-commit')<order.indexOf('persistence'));
  const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.ok(index.indexOf('./js/semantic-hash-v2.js')<index.indexOf('./js/play-runtime-compat.js'));
}

assert.equal(loadGame({headless:true}).engineModule.SAVE_KEY,SAVE_KEY);
assert.equal(loadGame({headless:true}).engineModule.SAVE_VERSION,9);
console.log('GF-010 finance validation enforcement tests passed');
