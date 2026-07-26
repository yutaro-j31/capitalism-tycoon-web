'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/listed-subsidiary-market.js'),'utf8');
const launcher=fs.readFileSync(path.join(__dirname,'../play.html'),'utf8');
class Engine{
  constructor(state){this.g=state;this.saved=0;this.emitted=0;this.notices=[];this.normalize();}
  normalize(){}
  fail(message){this.lastError=message;return false;}
  notify(message,severity){this.notices.push({message,severity});}
  save(){this.saved++;return true;}
  emit(){this.emitted++;}
  runTransaction(work){const result=work();if(result!==false){this.save();this.emit();}return result;}
}
const financeEvents=[];
const modules={engine:{TycoonEngine:Engine,compactYen:v=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`},finance:{event:(state,type,amount,meta)=>financeEvents.push({state,type,amount,meta})},playerEngineBridge:{getEngine:()=>null}};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(code,context,{filename:'listed-subsidiary-market.js'});
const mod=modules.listedSubsidiaryMarket;
function state(week=40){return {week,configured:true,selectedTab:'venture',companyCash:150_000_000,personalCash:12_000_000,saveVersion:9,subsidiaries:[{id:'sub-1',name:'地域物流テック',ticker:'RLT',status:'active',publicCompany:true,valuation:500_000_000,ownership:.7,carryingBookValue:120_000_000,investedCost:120_000_000,weeklyProfit:4_000_000,growth:.25,risk:.12,subsidiaryCash:100_000_000,ipoPreparation:{listedWeek:20},ipoOfferTerms:{listingPriceIndex:100,volatility:.18,lockupUntilWeek:30}}],listedSubsidiaryMarketHistory:[]};}
const a=state(),personalBefore=a.personalCash,engine=new Engine(a),view=engine.listedSubsidiaryMarketSnapshot('sub-1');
assert.equal(engine.g.saveVersion,9);assert.equal(view.locked,false);assert.equal(view.ownership,.7);assert.ok(view.priceIndex>=20&&view.priceIndex<=400);assert.equal(engine.g.personalCash,personalBefore);
const deterministicA=JSON.parse(JSON.stringify(state())),deterministicB=JSON.parse(JSON.stringify(state()));new Engine(deterministicA);new Engine(deterministicB);assert.deepEqual(deterministicA,deterministicB,'weekly listed market catch-up must be deterministic');
const cashBeforeSale=engine.g.companyCash,bookBeforeSale=engine.g.subsidiaries[0].carryingBookValue,ownershipBeforeSale=engine.g.subsidiaries[0].ownership;const salePreview=mod.tradePreview(engine.g,engine.g.subsidiaries[0],.05,'sell');assert.equal(engine.sellListedSubsidiaryStake('sub-1',.05),true);assert.equal(engine.g.subsidiaries[0].ownership,ownershipBeforeSale-.05);assert.equal(engine.g.companyCash,cashBeforeSale+salePreview.price);assert.ok(engine.g.subsidiaries[0].carryingBookValue<bookBeforeSale);assert.equal(financeEvents.at(-1).type,'assetSale');assert.equal(engine.g.personalCash,personalBefore);
const cashBeforeBuy=engine.g.companyCash,ownershipBeforeBuy=engine.g.subsidiaries[0].ownership,buyPreview=mod.tradePreview(engine.g,engine.g.subsidiaries[0],.05,'buy');assert.equal(engine.buyListedSubsidiaryStake('sub-1',.05),true);assert.equal(engine.g.subsidiaries[0].ownership,ownershipBeforeBuy+.05);assert.equal(engine.g.companyCash,cashBeforeBuy-buyPreview.price);assert.equal(financeEvents.at(-1).type,'assetPurchase');
assert.equal(engine.setListedSubsidiaryDividendPolicy('sub-1','income'),true);assert.equal(engine.g.subsidiaries[0].dividendPolicyID,'income');
const lockedState=state(25),lockedEngine=new Engine(lockedState);assert.equal(lockedEngine.sellListedSubsidiaryStake('sub-1',.05),false);assert.match(lockedEngine.lastError,/ロックアップ/);
const dividendState=state(52);dividendState.subsidiaries[0].dividendPolicyID='income';dividendState.subsidiaries[0].marketLastWeek=51;const dividendCashBefore=dividendState.companyCash;new Engine(dividendState);assert.ok(dividendState.companyCash>dividendCashBefore,'quarterly parent dividend must increase company cash');assert.equal(dividendState.personalCash,personalBefore,'personal cash must remain separated');assert.equal(financeEvents.at(-1).type,'dividendIncome');
const render=mod.renderSection({g:state()});assert.match(render,/上場子会社の資本市場運営/);assert.match(render,/5%売却/);assert.match(render,/高配当/);
assert.match(launcher,/\.\/js\/listed-subsidiary-market\.js\?launch=/,'public launcher must cache-bust listed market module');
assert.match(launcher,/上場子会社市場モジュールを公開起動順へ追加できませんでした/,'public launcher must fail closed when market module injection is missing');
assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|personalInvestments/.test(code),'listed market must stay deterministic and company-only');
assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=/.test(code),'save key/version contract is not changed');
console.log('Listed subsidiary weekly market, lockup, stake trades, dividends, accounting, launcher and determinism tests passed');
