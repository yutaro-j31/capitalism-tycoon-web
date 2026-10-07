'use strict';

const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

const SAVE_KEY='capitalism_tycoon_web_v1';
function lcg(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/0x100000000;};}
function setup(seed=0x52100001){
  const loaded=loadGame({headless:true,random:lcg(seed)});
  const game=new loaded.engineModule.TycoonEngine();
  game.configure({playerName:'P2 Close',companyName:'P2 Close Co',difficulty:'normal',scenario:'free',simulationSeed:seed});
  return {loaded,game,finance:loaded.modules.finance};
}
function savedPayload(loaded){return loaded.ctx.__localStorageData.get(SAVE_KEY)||null;}

// 1. Close output is deterministic and does not consume RNG or move authoritative cash/debt.
{
  const {game,finance}=setup();
  const before={
    cash:game.g.companyCash,
    debt:game.g.companyDebt,
    personalCash:game.g.personalCash,
    rng:JSON.stringify(game.g.simulationRng),
    transactionCount:game.g.finance.transactions.length
  };
  const first=finance.standaloneClose(game.g,'52');
  const second=finance.standaloneClose(game.g,'52');
  assert.equal(first.schemaVersion,1);
  assert.equal(first.ok,true,JSON.stringify(first,null,2));
  assert.deepEqual(second,first,'unchanged state must produce byte-equivalent close evidence');
  assert.deepEqual({...finance.STANDALONE_CLOSE_TOLERANCES},{
    balanceSheetIdentity:0.10,
    balanceSheetCash:0.01,
    cashFlowIdentity:0.05,
    cashFlowEndingCash:0.05,
    weeklyCashDifference:0.05,
    weeklyOpeningRollforward:0.01,
    financeCashRollforward:0.05
  });
  assert.equal(game.g.companyCash,before.cash);
  assert.equal(game.g.companyDebt,before.debt);
  assert.equal(game.g.personalCash,before.personalCash);
  assert.equal(JSON.stringify(game.g.simulationRng),before.rng);
  assert.equal(game.g.finance.transactions.length,before.transactionCount);
}

// 2. The strict close catches cent-scale divergence that the old ¥10 weekly tolerance allowed.
{
  const {game,finance}=setup(0x52100002);
  assert.equal(game.advanceWeek(false),true);
  const snap=game.g.finance.weeklySnapshots.find(row=>row.week===game.g.week);
  assert.ok(snap,'committed week snapshot exists');
  snap.cashDifference=0.06;
  snap.actualCompanyCash=Math.round((snap.endingCash+0.06)*100)/100;

  const close=finance.standaloneClose(game.g,'52');
  assert.equal(close.ok,false);
  const weekly=close.checks.find(row=>row.code==='P2-CLOSE-WEEKLY-CASH');
  assert.equal(weekly.ok,false);
  assert.equal(weekly.difference,0.06);
  assert.equal(weekly.limit,0.05);

  const validation=finance.validate(game.g);
  assert.equal(validation.ok,false);
  assert.ok(validation.errors.some(row=>String(row).includes('P2-CLOSE-WEEKLY-CASH')));
  assert.equal(validation.errors.some(row=>String(row).includes('cashDifference 0.06')),false,
    'legacy ¥10 weekly gate alone would not reject six cents');
}

// 3. Explicit validation-skip fixtures bypass the close stage just like legacy validation.
{
  const {game,finance}=setup(0x52100005);
  game.g.skipWeeklyValidation=true;
  const original=finance.standaloneClose;
  finance.standaloneClose=()=>{throw new Error('close must be skipped');};
  try{
    assert.equal(game.advanceWeek(false),true);
  }finally{
    finance.standaloneClose=original;
  }
}

// 4. A close failure aborts the complete production week and durable save.
{
  const {loaded,game,finance}=setup(0x52100003);
  assert.equal(game.save(),true);
  const beforeState=JSON.stringify(game.g);
  const beforePayload=savedPayload(loaded);
  const beforeRng=JSON.stringify(game.g.simulationRng);
  const original=finance.standaloneClose;
  finance.standaloneClose=()=>Object.freeze({ok:false,errors:Object.freeze(['synthetic-close-divergence'])});
  try{
    assert.throws(()=>game.advanceWeek(false),error=>{
      assert.equal(error.code,'standalone-accounting-close-failed');
      assert.equal(error.stage,'standalone-accounting-close');
      assert.deepEqual(error.financeValidation.reasons,['synthetic-close-divergence']);
      assert.equal(error.financeValidation.week,JSON.parse(beforeState).week+1);
      return true;
    });
  }finally{
    finance.standaloneClose=original;
  }
  assert.equal(JSON.stringify(game.g),beforeState,'failed close rolls back authoritative state exactly');
  assert.equal(JSON.stringify(game.g.simulationRng),beforeRng,'failed close rolls back RNG exactly');
  assert.equal(savedPayload(loaded),beforePayload,'failed close does not persist a new payload');
  assert.equal(game.financeValidationFailure.code,'standalone-accounting-close-failed');
  assert.equal(game.financeValidationFailure.stage,'standalone-accounting-close');
}

// 5. A close implementation exception is also fail-closed and rolled back.
{
  const {loaded,game,finance}=setup(0x52100004);
  assert.equal(game.save(),true);
  const beforeState=JSON.stringify(game.g);
  const beforePayload=savedPayload(loaded);
  const original=finance.standaloneClose;
  finance.standaloneClose=()=>{throw new Error('synthetic-close-crash');};
  try{
    assert.throws(()=>game.advanceWeek(false),error=>{
      assert.equal(error.code,'standalone-accounting-close-threw');
      assert.equal(error.stage,'standalone-accounting-close');
      assert.match(error.financeValidation.cause,/synthetic-close-crash/);
      return true;
    });
  }finally{
    finance.standaloneClose=original;
  }
  assert.equal(JSON.stringify(game.g),beforeState);
  assert.equal(savedPayload(loaded),beforePayload);
}

const boundary=loadGame({headless:true}).modules.financeValidationBoundary;
assert.equal(boundary.CLOSE_FAILURE_CODE,'standalone-accounting-close-failed');
assert.equal(boundary.CLOSE_EXCEPTION_CODE,'standalone-accounting-close-threw');
assert.ok(boundary.WEEK_EXECUTION_ORDER.indexOf('finance-snapshot-finalization')<boundary.WEEK_EXECUTION_ORDER.indexOf('standalone-accounting-close'));
assert.ok(boundary.WEEK_EXECUTION_ORDER.indexOf('standalone-accounting-close')<boundary.WEEK_EXECUTION_ORDER.indexOf('liquidity-crisis-finalization'));
assert.ok(boundary.WEEK_EXECUTION_ORDER.indexOf('standalone-accounting-close')<boundary.WEEK_EXECUTION_ORDER.indexOf('finance-validation'));

console.log('Phase 2 standalone close tests passed');
