'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/group-restructuring-candidates.js'),'utf8'),events=[];
class Engine{constructor(g){this.g=g;this.normalize();}normalize(){}fail(m){this.lastError=m;return false;}runTransaction(fn){return fn();}}
const finance={event:(state,type,amount,detail)=>events.push({type,amount,...detail})};
const performance={summarize:state=>(state.interSubsidiarySynergyHistory||[]).map(r=>({pairKey:r.pairKey,measuredRounds:1,annualROI:r.annualROI,rounds:1,annualizedProfitLift:r.annualizedProfitLift||0,valuationLift:r.valuationLift||0}))};
const modules={engine:{TycoonEngine:Engine},finance,playerEngineBridge:{getEngine:()=>null},interSubsidiarySynergyPerformance:performance};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;vm.runInNewContext(code,context);
const mod=modules.groupRestructuringCandidates;
function base(){return {configured:true,selectedTab:'venture',week:100,saveVersion:9,companyCash:500_000_000,personalCash:12_000_000,subsidiaries:[
 {id:'loss',name:'赤字社',ownership:1,valuation:20_000_000,carryingBookValue:80_000_000,subsidiaryCash:5_000_000,weeklyProfit:-2_000_000,growth:.01,risk:.8,lossMakingWeeks:40,integrationSynergyRounds:2,integrationSynergyInvested:10_000_000},
 {id:'sale',name:'集中社',ownership:.8,valuation:900_000_000,carryingBookValue:800_000_000,weeklyProfit:3_000_000,growth:.08,risk:.3,parentDividendsReceived:2_000_000},
 {id:'merge-a',name:'同業A',domain:'retail',ownership:1,valuation:100_000_000,carryingBookValue:70_000_000,subsidiaryCash:10_000_000,weeklyProfit:1_000_000,growth:.1,risk:.3,integrationSynergyRounds:1},
 {id:'merge-b',name:'同業B',domain:'retail',ownership:1,valuation:80_000_000,carryingBookValue:50_000_000,subsidiaryCash:8_000_000,weeklyProfit:800_000,growth:.12,risk:.35,integrationSynergyRounds:1},
 {id:'listed',name:'上場社',publicCompany:true,ownership:.6,valuation:200_000_000,carryingBookValue:90_000_000,weeklyProfit:2_000_000,growth:.12,risk:.2,ipoOfferTerms:{lockupUntilWeek:120}}
 ],interSubsidiarySynergyHistory:[{pairKey:'merge-a::merge-b',annualROI:.04,annualizedProfitLift:5_200_000,valuationLift:3_000_000}]};}
const a=base(),b=base();b.subsidiaries.reverse();
assert.deepEqual(JSON.parse(JSON.stringify(mod.candidates(a))),JSON.parse(JSON.stringify(mod.candidates(b))),'array order must not change deterministic ranking');
assert.deepEqual(JSON.parse(JSON.stringify(mod.candidates(a))),JSON.parse(JSON.stringify(mod.candidates(JSON.parse(JSON.stringify(a))))),'JSON reload must preserve candidates');
const loss=mod.candidates(a).find(r=>r.id==='loss');assert.equal(loss.category,'清算候補');assert.equal(loss.stakeValue,20_000_000);assert.equal(loss.bookValue,80_000_000);assert.equal(loss.unrealizedGain,-60_000_000);
assert.equal(mod.candidates(a).find(r=>r.id==='sale').category,'売却候補');assert.equal(mod.candidates(a).find(r=>r.id==='listed').category,'保有継続','lockup takes precedence over control recommendation');
const unlocked=base();unlocked.week=121;assert.equal(mod.candidates(unlocked).find(r=>r.id==='listed').category,'完全子会社化候補');
const sale=mod.salePreview(a,'sale');assert.equal(sale.bookRemoved,800_000_000);assert.equal(sale.expectedSale,662_400_000);assert.equal(sale.expectedGain,-137_600_000);assert.ok(sale.postConcentration>=0&&sale.postConcentration<=1);assert.ok(sale.annualDividendDecrease>0);
const liquidation=mod.liquidationPreview(a,'loss');assert.equal(liquidation.subsidiaryCashRecovery,5_000_000);assert.equal(liquidation.recoveredCash,14_000_000);assert.equal(liquidation.liquidationGain,-66_000_000);
const merge=mod.mergePreview(a,'merge-b','merge-a');assert.equal(merge.mergedID,'restructured-merge-a-merge-b');assert.equal(merge.bookValue,120_000_000);assert.equal(merge.subsidiaryCash,18_000_000);assert.equal(merge.integrationCost,6_300_000);assert.equal(merge.postWeeklyProfit,2_044_000);assert.ok(mod.mergeCandidates(a).some(r=>r.mergedID===merge.mergedID));
const personal=a.personalCash,engine=new Engine(a),cash=a.companyCash;assert.equal(engine.executeGroupRestructuringLiquidation('loss'),true);assert.equal(a.companyCash,cash+14_000_000);assert.equal(a.personalCash,personal);let e=events.at(-1);assert.deepEqual({cash:e.cashEffect,asset:e.assetEffect,profit:e.profitEffect},{cash:14_000_000,asset:-80_000_000,profit:-66_000_000});
const beforeBook=a.subsidiaries.filter(s=>['merge-a','merge-b'].includes(s.id)).reduce((n,s)=>n+s.carryingBookValue,0),beforeCash=a.companyCash;assert.equal(engine.executeGroupRestructuringMerge('merge-a','merge-b'),true);const merged=a.subsidiaries.find(s=>s.id===merge.mergedID);assert.equal(merged.carryingBookValue,beforeBook,'investment book value must not be double counted');assert.equal(a.subsidiaries.filter(s=>['merge-a','merge-b'].includes(s.id)).length,0);assert.equal(a.companyCash,beforeCash-merge.integrationCost);assert.equal(a.personalCash,personal);e=events.at(-1);assert.deepEqual({cash:e.cashEffect,asset:e.assetEffect,profit:e.profitEffect},{cash:-merge.integrationCost,asset:0,profit:-merge.integrationCost});
assert.equal(a.saveVersion,9);assert.ok(a.groupRestructuringHistory.length<=80);assert.match(mod.renderSection({g:base()}),/グループ再編判断/);assert.match(mod.renderSection({g:base()}),/min-height:44px/);
assert.ok(!/Math\.random|Date\.now/.test(code));assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=|personalCash\s*[+\-*/]?=/.test(code));
const play=fs.readFileSync(path.join(__dirname,'../play.html'),'utf8'),runAll=fs.readFileSync(path.join(__dirname,'run-all.js'),'utf8');assert.match(play,/group-restructuring-candidates\.js\?launch=/);assert.match(play,/グループ再編判断モジュールを公開起動順へ追加できませんでした/);assert.match(runAll,/group-restructuring-candidates-test\.js/);
console.log('Group restructuring candidates, previews, accounting, determinism, save compatibility and mobile UI tests passed');
