'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
class TycoonEngine{constructor(g){this.g=g;}normalize(){}runTransaction(fn){return fn();}fail(){return false;}notify(){}}
const modules={engine:{TycoonEngine},playerEngineBridge:{getEngine:()=>null},subsidiaryPerformanceReview:{__installed:true}};
const context={globalThis:{__capitalismTycoonModules:modules},console,queueMicrotask:fn=>fn(),setTimeout};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(fs.readFileSync('js/subsidiary-mandate-actions.js','utf8'),context);
const api=modules.subsidiaryMandateActions;
const state={week:12,companyCash:1000,personalCash:500,maSubsidiaries:[{id:'b',name:'B',groupMandate:'維持改善',groupPerformanceReview:{score:.95,recommendedMandate:'成長投資'}},{id:'a',name:'A',groupMandate:'成長投資',groupPerformanceReview:{score:.3,recommendedMandate:'再建'}}]};
api.ensure(state);assert.strictEqual(api.summarize(state).eligible,2);assert.strictEqual(api.applyOne(state,'a'),true);assert.strictEqual(state.maSubsidiaries[1].groupMandate,'再建');assert.strictEqual(state.companyCash,1000);assert.strictEqual(state.personalCash,500);
const clone=JSON.parse(JSON.stringify(state));assert.strictEqual(api.applyAll(clone),1);assert.strictEqual(clone.maSubsidiaries[0].groupMandate,'成長投資');assert.strictEqual(api.applyAll(clone),0);assert.strictEqual(clone.subsidiaryMandateActions.history.length,2);
const reversed=JSON.parse(JSON.stringify(state));reversed.maSubsidiaries.reverse();assert.strictEqual(api.applyAll(reversed),1);assert.deepStrictEqual(reversed.subsidiaryMandateActions.history.map(x=>x.subsidiaryId),clone.subsidiaryMandateActions.history.map(x=>x.subsidiaryId));
for(let i=0;i<80;i++){state.week++;state.maSubsidiaries[0].groupMandate=i%2?'維持改善':'成長投資';state.maSubsidiaries[0].groupPerformanceReview.recommendedMandate=i%2?'成長投資':'維持改善';api.applyAll(state);}assert.ok(state.subsidiaryMandateActions.history.length<=60);
assert.ok(api.renderSection({g:{...state,configured:true,selectedTab:'venture'}}).includes('子会社経営会議'));
console.log('subsidiary mandate actions tests passed');