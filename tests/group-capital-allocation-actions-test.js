'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../js/group-capital-allocation-actions.js'),'utf8');
class Engine{constructor(state){this.g=state;this.normalize();}normalize(){}fail(message){this.lastError=message;return false;}notify(){}runTransaction(work){return work();}executeInterSubsidiarySynergy(a,b,plan){const costs={crossSell:20_000_000,procurement:30_000_000,platform:50_000_000};const cost=costs[plan];if(this.g.companyCash<cost)return false;this.g.companyCash-=cost;this.g.lastExecution={a,b,plan,cost};return true;}}
const plans={crossSell:{id:'crossSell',name:'共同クロスセル',cost:20_000_000},procurement:{id:'procurement',name:'共同調達',cost:30_000_000},platform:{id:'platform',name:'共通システム',cost:50_000_000}};
const allocation={PLANS:plans,preview:(state,a,b,planID)=>({aID:a,bID:b,cost:plans[planID].cost,cooldownRemaining:0})};
const performance={summarize:()=>[{pairKey:'a::b',label:'A × B',rounds:2,invested:40_000_000,annualizedProfitLift:12_000_000,valuationLift:20_000_000,measuredRounds:2,annualROI:.3,totalValueROI:.8,status:'高効率'},{pairKey:'a::c',label:'A × C',rounds:1,invested:20_000_000,annualizedProfitLift:1_000_000,valuationLift:5_000_000,measuredRounds:1,annualROI:.05,totalValueROI:.3,status:'低効率'}]};
const modules={engine:{TycoonEngine:Engine},playerEngineBridge:{getEngine:()=>null},interSubsidiarySynergyAllocation:allocation,interSubsidiarySynergyPerformance:performance};
const context={globalThis:{__capitalismTycoonModules:modules,confirm:()=>true}};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(code,context,{filename:'group-capital-allocation-actions.js'});
const mod=modules.groupCapitalAllocationActions;
function state(){return {week:100,configured:true,selectedTab:'venture',companyCash:300_000_000,personalCash:5_000_000,saveVersion:9,groupCapitalAllocationHistory:[]};}
const s=state(),engine=new Engine(s),personal=s.personalCash;
assert.equal(mod.budget(s).limit,100_000_000);assert.equal(mod.budget(s).remaining,100_000_000);
let rows=mod.ranked(s);assert.equal(rows[0].pairKey,'a::b');assert.equal(rows[0].planID,'platform');assert.equal(rows[0].canAllocate,true);assert.equal(rows[1].canAllocate,false);assert.equal(rows[1].reason,'低効率');
assert.equal(engine.executeRecommendedGroupCapitalAllocation('a::b'),true);assert.equal(s.companyCash,250_000_000);assert.equal(s.groupCapitalAllocationPolicy.spent,50_000_000);assert.equal(s.groupCapitalAllocationHistory.length,1);assert.equal(s.groupCapitalAllocationHistory[0].planID,'platform');assert.equal(s.personalCash,personal);assert.equal(s.saveVersion,9);
assert.equal(engine.setGroupCapitalAllocationProfile('conservative'),true);assert.equal(mod.budget(s).remaining,0);assert.equal(engine.executeRecommendedGroupCapitalAllocation('a::b'),false);assert.match(engine.lastError,/予算不足/);
assert.equal(engine.setGroupCapitalAllocationPairPaused('a::b',true),true);rows=mod.ranked(s);assert.equal(rows[0].paused,true);assert.equal(rows[0].reason,'停止中');assert.equal(engine.setGroupCapitalAllocationPairPaused('a::b',false),true);
s.week=153;engine.normalize();assert.equal(mod.budget(s).spent,0);assert.equal(mod.budget(s).cycleStartWeek,153);
const html=mod.renderSection({g:state()});assert.match(html,/グループ資本配分/);assert.match(html,/min-height:44px/);assert.match(html,/追加配分/);
assert.ok(!/Math\.random|Date\.now|personalCash\s*[+\-*/]?=|personalInvestments/.test(code));assert.ok(!/SAVE_KEY\s*=|saveVersion\s*=/.test(code));
const play=fs.readFileSync(path.join(__dirname,'../play.html'),'utf8');const runAll=fs.readFileSync(path.join(__dirname,'run-all.js'),'utf8');assert.match(play,/group-capital-allocation-actions\.js\?launch=/);assert.match(play,/グループ資本配分モジュールを公開起動順へ追加できませんでした/);assert.match(runAll,/group-capital-allocation-actions-test\.js/);
console.log('Group capital allocation budget, ranking, pause, accounting delegation, determinism and UI tests passed');
