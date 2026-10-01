'use strict';

const assert=require('node:assert/strict');
const { loadGame }=require('./harness');

function legacySpinout(){
  return {
    id:'spinout-legacy-project',
    name:'旧形式スピンアウト',
    status:'active',
    investmentBookValue:40_000_000,
    enterpriseValue:72_000_000,
    risk:.45,
    quality:.6,
    growth:.7
  };
}

{
  const { ctx }=loadGame();
  const engine=ctx.__ct_engine;
  const mod=ctx.__capitalismTycoonModules.newBusinessCommercialization;
  engine.g.companyCash=462_959_970;
  engine.g.maSubsidiaries=[legacySpinout()];
  mod.ensure(engine.g);
  const sub=engine.g.maSubsidiaries[0];
  assert.equal(sub.valuation,1_000_000);
  assert.equal(sub.operatingProfit,0);
  assert.equal(sub.sales,0);
  assert.equal(sub.weeklyProfit,0);
  assert.equal(sub.standaloneWeeklyProfit,0);
  assert.equal(sub.retainedEarnings,0);
  assert(Number.isFinite(engine.g.companyCash));
  engine.advanceWeek(false);
  assert(Number.isFinite(engine.g.companyCash));
  assert(Number.isFinite(engine.companyValue()));
  for(let i=0;i<51;i++){
    engine.advanceWeek(false);
    assert(Number.isFinite(engine.g.companyCash),`week ${i+2} companyCash`);
  }
}

{
  const { ctx }=loadGame();
  const engine=ctx.__ct_engine;
  const mod=ctx.__capitalismTycoonModules.newBusinessCommercialization;
  engine.g.companyCash=400_000_000;
  engine.g.maSubsidiaries=[{
    ...legacySpinout(),
    valuation:1_000_000,
    operatingProfit:0,
    sales:0,
    weeklyProfit:-100_000_000_000,
    standaloneWeeklyProfit:-100_000_000_000,
    retainedEarnings:-9_900_000_000_000
  }];
  mod.ensure(engine.g);
  const sub=engine.g.maSubsidiaries[0];
  assert.equal(sub.weeklyProfit,0);
  assert.equal(sub.standaloneWeeklyProfit,0);
  assert.equal(sub.retainedEarnings,0);
}

{
  const { ctx }=loadGame();
  const engine=ctx.__ct_engine;
  const mod=ctx.__capitalismTycoonModules.newBusinessCommercialization;
  const row=legacySpinout();
  engine.g.companyCash=null;
  engine.g.maSubsidiaries=[row];
  const before=JSON.stringify(engine.g.maSubsidiaries);
  mod.ensure(engine.g);
  assert.equal(engine.g.companyCash,null);
  assert.equal(JSON.stringify(engine.g.maSubsidiaries),before,'corrupted-save evidence must remain untouched for GF2-009');
}

{
  const { ctx }=loadGame();
  const engine=ctx.__ct_engine;
  const mod=ctx.__capitalismTycoonModules.newBusinessCommercialization;
  const ordinary={id:'ma-normal',status:'active',weeklyProfit:-100_000_000_000};
  engine.g.companyCash=300_000_000;
  engine.g.maSubsidiaries=[ordinary];
  const before=JSON.stringify(ordinary);
  mod.ensure(engine.g);
  assert.equal(JSON.stringify(ordinary),before,'non-spinout M&A subsidiary must not be changed');
}

console.log('legacy spinout backfill tests passed');
