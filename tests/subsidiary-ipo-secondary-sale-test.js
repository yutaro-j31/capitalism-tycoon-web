'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../js/subsidiary-ipo-secondary-sale.js'),'utf8');
class Engine{
  constructor(state){this.g=state;this.saved=0;this.emitted=0;this.notices=[];this.normalize();}
  normalize(){}
  fail(message){this.lastError=message;return false;}
  notify(message,severity){this.notices.push({message,severity});}
  runTransaction(work){const result=work();if(result!==false){this.saved++;this.emitted++;}return result;}
}
const financeEvents=[];
const modules={engine:{TycoonEngine:Engine,compactYen:v=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`},finance:{event:(state,type,amount,meta)=>financeEvents.push({state,type,amount,meta})},playerEngineBridge:{getEngine:()=>null}};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(code,context,{filename:'subsidiary-ipo-secondary-sale.js'});
const mod=modules.subsidiaryIPOSecondarySale;
function state(){return {week:50,configured:true,selectedTab:'venture',companyCash:100_000_000,personalCash:8_000_000,cumulativeProfit:20_000_000,saveVersion:9,subsidiaries:[{id:'listed-1',name:'Listed Growth',status:'active',publicCompany:true,ownership:.55,valuation:600_000_000,carryingBookValue:180_000_000,ipoOfferTerms:{lockupUntilWeek:60}}]};}
const locked=state(),lockedEngine=new Engine(locked),personalBefore=locked.personalCash;
const lockedView=mod.preview(locked,'listed-1',.10);
assert.equal(lockedView.lockupRemaining,10);
assert.equal(lockedView.canSell,false);
assert.equal(lockedEngine.sellSubsidiaryIPOStake('listed-1',.10),false);
assert.match(lockedEngine.lastError,/あと10週/);
assert.equal(locked.companyCash,100_000_000);
assert.equal(locked.personalCash,personalBefore);
locked.week=60;
const preview=mod.preview(locked,'listed-1',.10);
assert.equal(preview.gross,60_000_000);
assert.equal(preview.proceeds,58_800_000);
assert.equal(preview.costBasis,32_727_273);
assert.equal(preview.gain,26_072_727);
assert.equal(preview.remainingOwnership,.45);
assert.equal(preview.canSell,true);
const beforeProfit=locked.cumulativeProfit,beforeBook=locked.subsidiaries[0].carryingBookValue;
assert.equal(lockedEngine.sellSubsidiaryIPOStake('listed-1',.10),true);
assert.equal(locked.companyCash,158_800_000);
assert.equal(locked.cumulativeProfit,beforeProfit+preview.gain);
assert.equal(locked.subsidiaries[0].ownership,.45);
assert.equal(locked.subsidiaries[0].carryingBookValue,beforeBook-preview.costBasis);
assert.equal(locked.personalCash,personalBefore);
assert.equal(financeEvents.at(-1).type,'investmentSale');
assert.equal(financeEvents.at(-1).meta.cashEffect,preview.proceeds);
assert.equal(financeEvents.at(-1).meta.profitEffect,preview.gain);
assert.match(financeEvents.at(-1).meta.operationID,/sellSubsidiaryIPOStake-listed-1-0\.1-60/);
assert.equal(locked.subsidiaryIPOSecondarySaleHistory.length,1);
const boundary=state(),boundaryEngine=new Engine(boundary);boundary.week=60;boundary.subsidiaries[0].ownership=.30;
assert.equal(boundaryEngine.sellSubsidiaryIPOStake('listed-1',.25),false,'must retain at least 10% ownership');
assert.match(boundaryEngine.lastError,/10%以上/);
assert.equal(boundaryEngine.sellSubsidiaryIPOStake('listed-1',.10),true);
assert.equal(boundary.subsidiaries[0].ownership,.20);
const replayA=state(),replayB=JSON.parse(JSON.stringify(replayA));replayA.week=60;replayB.week=60;new Engine(replayA).sellSubsidiaryIPOStake('listed-1',.25);new Engine(replayB).sellSubsidiaryIPOStake('listed-1',.25);assert.equal(JSON.stringify(replayA),JSON.stringify(replayB),'same save and action must be deterministic');
const html=mod.renderSection(new Engine(state()));
assert.match(html,/上場子会社株式売却/);
assert.match(html,/ロックアップあと10週/);
assert.match(html,/10%売却/);
assert.match(html,/25%売却/);
assert.match(html,/50%売却/);
assert.equal(locked.saveVersion,9);
assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|personalInvestments/.test(code));
assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=/.test(code));
console.log('Subsidiary IPO secondary sale lockup, ownership floor, accounting, determinism, UI and asset separation tests passed');