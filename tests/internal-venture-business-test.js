'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/internal-venture-business.js'),'utf8');
class Engine{
  constructor(state){this.g=state;this.saved=0;this.emitted=0;this.notices=[];this.normalize();}
  normalize(){}
  companyValue(){return 100_000_000;}
  fail(message){this.lastError=message;return false;}
  notify(message,severity){this.notices.push({message,severity});}
  save(){this.saved++;return true;}
  emit(){this.emitted++;}
  runTransaction(work){const result=work();if(result!==false){this.save();this.emit();}return result;}
}
const financeEvents=[];
const modules={engine:{TycoonEngine:Engine,compactYen:v=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`},finance:{event:(state,type,amount,meta)=>financeEvents.push({state,type,amount,meta})},playerEngineBridge:{getEngine:()=>null}};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(code,context,{filename:'internal-venture-business.js'});
const mod=modules.internalVentureBusiness;
function state(){return {week:20,configured:true,selectedTab:'venture',companyCash:80_000_000,saveVersion:9,internalVentures:[{id:'iv-1',name:'地域物流プロジェクト',domain:'地域物流',requiredBudget:20_000_000,status:'developing',progress:70,valuation:24_000_000,weeklyProfit:0,teamQuality:80,marketPotential:85,risk:.18}],subsidiaries:[],news:[],internalVentureBusinessHistory:[]};}
const a=state(),beforeSaveVersion=a.saveVersion,engine=new Engine(a);
assert.equal(engine.g.saveVersion,beforeSaveVersion,'saveVersion must remain unchanged');
assert.equal(engine.companyValue(),124_000_000,'live internal venture valuation is included once');
assert.equal(engine.validateInternalVentureBusiness().ok,true);
const expectedLift=mod.valueLift(engine.g.internalVentures[0],10_000_000),expectedProgress=mod.progressLift(engine.g.internalVentures[0],10_000_000);
assert.equal(engine.fundInternalVenture('iv-1',10_000_000),true);
const funded=engine.g.internalVentures[0];
assert.equal(engine.g.companyCash,70_000_000);assert.equal(funded.investedCapital,30_000_000);assert.equal(funded.carryingBookValue,30_000_000);assert.equal(funded.additionalFunding,10_000_000);assert.equal(funded.fundingRounds,1);assert.equal(funded.valuation,24_000_000+expectedLift);assert.equal(funded.progress,Math.min(100,70+expectedProgress));
assert.equal(financeEvents.at(-1).type,'assetPurchase');assert.equal(financeEvents.at(-1).meta.cashEffect,-10_000_000);assert.equal(financeEvents.at(-1).meta.assetEffect,10_000_000);
const copy=state(),copyEngine=new Engine(copy);copyEngine.fundInternalVenture('iv-1',10_000_000);assert.deepEqual(JSON.parse(JSON.stringify(copy.internalVentures[0])),JSON.parse(JSON.stringify(funded)),'funding is deterministic');
funded.progress=100;funded.status='active';const cashBeforeSpin=engine.g.companyCash;assert.equal(engine.spinOffInternalVenture('iv-1'),true);assert.equal(engine.g.companyCash,cashBeforeSpin,'spin-off has no cash movement');assert.equal(funded.status,'spun-off');assert.equal(funded.carryingBookValue,0);assert.equal(engine.g.subsidiaries.length,1);const sub=engine.g.subsidiaries[0];assert.equal(sub.id,'internal-sub-iv-1');assert.equal(sub.ownership,1);assert.equal(sub.carryingBookValue,30_000_000);assert.equal(sub.source,'internalVenture');assert.equal(engine.companyValue(),100_000_000,'spun-off venture is excluded from incubation value to avoid double count');
const saleState=state(),saleEngine=new Engine(saleState),saleVenture=saleState.internalVentures[0],saleBook=20_000_000,price=mod.salePrice(saleVenture);assert.equal(saleEngine.sellInternalVenture('iv-1'),true);assert.equal(saleState.companyCash,80_000_000+price);assert.equal(saleVenture.status,'sold');assert.equal(saleVenture.exitPrice,price);assert.equal(saleVenture.exitGain,price-saleBook);assert.equal(financeEvents.at(-1).type,'assetSale');assert.equal(financeEvents.at(-1).meta.assetEffect,-saleBook);assert.equal(financeEvents.at(-1).meta.profitEffect,price-saleBook);
const model=mod.build(state());assert.equal(model.live,1);assert.equal(model.portfolioValue,24_000_000);assert.match(mod.renderSection({g:state()}),/新規事業インキュベーション/);assert.match(mod.renderSection({g:state()}),/100%子会社へ/);assert.equal(JSON.stringify([...mod.FUNDING_OPTIONS]),JSON.stringify([5_000_000,10_000_000,25_000_000]));
assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|personalInvestments/.test(code),'new feature stays deterministic and company-only');
assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=/.test(code),'save key/version contract is not changed');
console.log('Internal venture staged funding, valuation, spin-off, sale, accounting and determinism tests passed');
