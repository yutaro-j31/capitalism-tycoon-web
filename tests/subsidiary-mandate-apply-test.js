'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
class TycoonEngine{constructor(g){this.g=g;}normalize(){}runTransaction(fn){return fn();}fail(){return false;}notify(){}}
const modules={engine:{TycoonEngine},playerEngineBridge:{getEngine:()=>null},subsidiaryPerformanceReview:{}};
const context={globalThis:{__capitalismTycoonModules:modules},console};context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(fs.readFileSync('js/subsidiary-mandate-apply.js','utf8'),context);
const api=modules.subsidiaryMandateApply;
const state={week:12,cash:500,personalCash:200,maSubsidiaries:[{id:'a',name:'A',groupMandate:'維持改善',groupPerformanceReview:{week:12,recommendedMandate:'成長投資'}},{id:'b',name:'B',groupMandate:'再建',groupPerformanceReview:{week:11,recommendedMandate:'配当'}}]};
api.ensure(state);const before=JSON.stringify({cash:state.cash,personalCash:state.personalCash});assert.equal(api.apply(state),true);assert.equal(state.maSubsidiaries[0].groupMandate,'成長投資');assert.equal(state.maSubsidiaries[1].groupMandate,'再建');assert.equal(api.apply(state),false);assert.equal(JSON.stringify({cash:state.cash,personalCash:state.personalCash}),before);const round=JSON.parse(JSON.stringify(state));api.ensure(round);assert.equal(round.subsidiaryMandateApply.history.length,1);for(let i=0;i<70;i++){round.week++;round.subsidiaryMandateApply.lastApplyWeek=null;api.apply(round);}assert.ok(round.subsidiaryMandateApply.history.length<=60);console.log('subsidiary mandate apply tests passed');