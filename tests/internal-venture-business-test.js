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
function state(){return {week:20,configured:true,selectedTab:'venture',companyCash:180_000_000,personalCash:12_000_000,saveVersion:9,internalVentures:[{id:'iv-1',name:'地域物流プロジェクト',domain:'地域物流',requiredBudget:20_000_000,status:'developing',progress:70,valuation:24_000_000,weeklyProfit:0,teamQuality:80,marketPotential:85,risk:.18}],subsidiaries:[],news:[],internalVentureBusinessHistory:[],subsidiaryFundingHistory:[]};}
const a=state(),beforeSaveVersion=a.saveVersion,engine=new Engine(a);
assert.equal(engine.g.saveVersion,beforeSaveVersion,'saveVersion must remain unchanged');
assert.equal(engine.companyValue(),124_000_000,'live internal venture valuation is included once');
assert.equal(engine.validateInternalVentureBusiness().ok,true);
const expectedLift=mod.valueLift(engine.g.internalVentures[0],10_000_000),expectedProgress=mod.progressLift(engine.g.internalVentures[0],10_000_000);
assert.equal(engine.fundInternalVenture('iv-1',10_000_000),true);
const funded=engine.g.internalVentures[0];
assert.equal(engine.g.companyCash,170_000_000);assert.equal(funded.investedCapital,30_000_000);assert.equal(funded.carryingBookValue,30_000_000);assert.equal(funded.additionalFunding,10_000_000);assert.equal(funded.fundingRounds,1);assert.equal(funded.valuation,24_000_000+expectedLift);assert.equal(funded.progress,Math.min(100,70+expectedProgress));
assert.equal(financeEvents.at(-1).type,'assetPurchase');assert.equal(financeEvents.at(-1).meta.cashEffect,-10_000_000);assert.equal(financeEvents.at(-1).meta.assetEffect,10_000_000);
const copy=state(),copyEngine=new Engine(copy);copyEngine.fundInternalVenture('iv-1',10_000_000);assert.deepEqual(JSON.parse(JSON.stringify(copy.internalVentures[0])),JSON.parse(JSON.stringify(funded)),'funding is deterministic');
funded.progress=100;funded.status='active';const cashBeforeSpin=engine.g.companyCash;assert.equal(engine.spinOffInternalVenture('iv-1'),true);assert.equal(engine.g.companyCash,cashBeforeSpin,'spin-off has no cash movement');assert.equal(funded.status,'spun-off');assert.equal(funded.carryingBookValue,0);assert.equal(engine.g.subsidiaries.length,1);const sub=engine.g.subsidiaries[0];assert.equal(sub.id,'internal-sub-iv-1');assert.equal(sub.ownership,1);assert.equal(sub.carryingBookValue,30_000_000);assert.equal(sub.source,'internalVenture');assert.equal(engine.companyValue(),100_000_000,'spun-off venture is excluded from incubation value to avoid double count');

sub.valuation=200_000_000;sub.weeklyProfit=2_000_000;sub.growth=.4;sub.risk=.1;
const personalBefore=engine.g.personalCash,externalCashBefore=engine.g.companyCash,externalBookBefore=sub.carryingBookValue,externalStakeBefore=sub.valuation*sub.ownership;
const externalPreview=mod.externalRoundPreview(sub,25_000_000);
assert.ok(mod.externalCapacity(sub)>=25_000_000,'strong subsidiary can raise selected external round');
assert.equal(engine.raiseSubsidiaryExternalRound(sub.id,25_000_000),true);
assert.equal(engine.g.companyCash,externalCashBefore,'external funding does not use parent cash');
assert.equal(engine.g.personalCash,personalBefore,'external funding does not touch personal cash');
assert.equal(sub.valuation,externalPreview.postMoney);assert.equal(sub.ownership,externalPreview.ownershipAfter);assert.equal(sub.carryingBookValue,externalBookBefore);assert.equal(sub.subsidiaryCash,25_000_000);assert.equal(sub.externalCapitalRaised,25_000_000);assert.equal(sub.externalFundingRounds,1);assert.equal(sub.lastExternalFundingWeek,20);
assert.ok(Math.abs(sub.valuation*sub.ownership-externalStakeBefore)<.01,'external round preserves parent stake value at transaction');
assert.equal(engine.raiseSubsidiaryExternalRound(sub.id,10_000_000),false,'external round cooldown prevents repeated same-week funding');assert.match(engine.lastError,/第33週以降/);

const parentCashBefore=engine.g.companyCash,parentBookBefore=sub.carryingBookValue,parentStakeBefore=sub.valuation*sub.ownership,parentPreview=mod.parentRoundPreview(sub,25_000_000);
assert.equal(engine.fundSubsidiaryFromParent(sub.id,25_000_000),true);
assert.equal(engine.g.companyCash,parentCashBefore-25_000_000);assert.equal(sub.valuation,parentPreview.postMoney);assert.equal(sub.ownership,parentPreview.ownershipAfter);assert.ok(sub.ownership>externalPreview.ownershipAfter,'parent funding recovers ownership after dilution');assert.equal(sub.carryingBookValue,parentBookBefore+25_000_000);assert.equal(sub.investedCost,55_000_000);assert.equal(sub.subsidiaryCash,50_000_000);assert.equal(sub.parentCapitalInjected,25_000_000);assert.ok(Math.abs(sub.valuation*sub.ownership-(parentStakeBefore+25_000_000))<.01,'parent funding raises stake value by invested amount');
assert.equal(financeEvents.at(-1).type,'assetPurchase');assert.equal(financeEvents.at(-1).meta.sourceType,'fundSubsidiaryFromParent');assert.equal(financeEvents.at(-1).meta.cashEffect,-25_000_000);assert.equal(financeEvents.at(-1).meta.assetEffect,25_000_000);
assert.equal(engine.validateInternalVentureBusiness().ok,true);
const fundingModel=engine.subsidiaryFundingSnapshot();assert.equal(fundingModel.subsidiaries,1);assert.equal(fundingModel.totalParentCapital,25_000_000);assert.equal(fundingModel.totalExternalCapital,25_000_000);
assert.match(mod.renderSection(engine),/子会社成長資金/);assert.match(mod.renderSection(engine),/親会社出資/);assert.match(mod.renderSection(engine),/外部調達/);
assert.equal(JSON.stringify([...mod.PARENT_FUNDING_OPTIONS]),JSON.stringify([10_000_000,25_000_000,50_000_000]));assert.equal(JSON.stringify([...mod.EXTERNAL_FUNDING_OPTIONS]),JSON.stringify([10_000_000,25_000_000,50_000_000]));

const saleState=state(),saleEngine=new Engine(saleState),saleVenture=saleState.internalVentures[0],saleBook=20_000_000,price=mod.salePrice(saleVenture);assert.equal(saleEngine.sellInternalVenture('iv-1'),true);assert.equal(saleState.companyCash,180_000_000+price);assert.equal(saleVenture.status,'sold');assert.equal(saleVenture.exitPrice,price);assert.equal(saleVenture.exitGain,price-saleBook);assert.equal(financeEvents.at(-1).type,'assetSale');assert.equal(financeEvents.at(-1).meta.assetEffect,-saleBook);assert.equal(financeEvents.at(-1).meta.profitEffect,price-saleBook);
const model=mod.build(state());assert.equal(model.live,1);assert.equal(model.portfolioValue,24_000_000);assert.match(mod.renderSection({g:state()}),/新規事業インキュベーション/);assert.match(mod.renderSection({g:state()}),/100%子会社へ/);assert.equal(JSON.stringify([...mod.FUNDING_OPTIONS]),JSON.stringify([5_000_000,10_000_000,25_000_000]));
assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|personalInvestments/.test(code),'new feature stays deterministic and company-only');
assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=/.test(code),'save key/version contract is not changed');
console.log('Internal venture incubation, subsidiary parent funding, external dilution, accounting and determinism tests passed');
