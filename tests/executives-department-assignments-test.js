'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
class Engine{
  constructor(g){this.g=g;this.legacyCalls=[];}
  normalize(){}
  runTransaction(fn){const before=JSON.stringify(this.g),r=fn();if(!r)this.g=JSON.parse(before);return r;}
  fail(){return false;}
  notify(){}
  hireExecutive(id,salary,so){
    this.legacyCalls.push({id,salary,so});
    const index=(this.g.executiveMarket||[]).findIndex(row=>row.id===id);
    if(index<0)return false;
    const candidate=this.g.executiveMarket[index];
    const bonus=salary*.25;
    if(this.g.companyCash<bonus)return false;
    this.g.companyCash-=bonus;
    this.g.executives=this.g.executives||{};
    this.g.executives[candidate.role]={...candidate,salary,offeredSO:so,hired:true};
    this.g.executiveMarket.splice(index,1);
    return true;
  }
}
const finance={
  event(state,category,amount,opts={}){
    state.finance=state.finance&&typeof state.finance==='object'?state.finance:{transactions:[]};
    state.finance.transactions=Array.isArray(state.finance.transactions)?state.finance.transactions:[];
    if(opts.idempotencyKey&&state.finance.transactions.some(row=>row.idempotencyKey===opts.idempotencyKey))return null;
    const row={category,amount,idempotencyKey:opts.idempotencyKey||null,sourceType:opts.sourceType||null,sourceID:opts.sourceID||null,cashEffect:opts.cashEffect||0,profitEffect:opts.profitEffect||0};
    state.finance.transactions.push(row);
    return row;
  },
  rebuildSnapshotForWeek(){return true;}
};
const modules={engine:{TycoonEngine:Engine},playerEngineBridge:{getEngine:()=>null},preferredSharesDividends:{},finance},context={globalThis:null,console,setTimeout,queueMicrotask};context.globalThis=context;context.__capitalismTycoonModules=modules;vm.runInNewContext(fs.readFileSync('js/executives-department-assignments.js','utf8'),context);
const mod=modules.executivesDepartmentAssignments,state={week:10,cash:5000000,personalCash:500000,cumulativeProfit:3000000,companyName:'Test',ticker:'TST'},personal=state.personalCash,a=JSON.stringify(mod.generate(state)),b=JSON.stringify(mod.generate({week:10,cash:5000000,companyName:'Test',ticker:'TST'}));assert.strictEqual(a,b);const id=state.executiveManagement.candidates[0].id,before=state.cash,profit=state.cumulativeProfit,res=mod.hire(state,id);assert(res);assert(state.cash<before);assert(state.cumulativeProfit<profit);assert.strictEqual(state.personalCash,personal);assert.strictEqual(state.finance.transactions.filter(row=>row.sourceType==='executive-hire').length,1);assert.strictEqual(mod.hire(state,id),false);
assert.strictEqual(mod.assign(state,id,'finance'),true);assert.strictEqual(state.executiveManagement.assignments.finance,id);assert(state.executiveModifiers.finance>1);const weekCash=state.cash;state.week=11;assert.strictEqual(mod.payroll(state),true);assert(state.cash<weekCash);assert.strictEqual(state.finance.transactions.filter(row=>row.sourceType==='executive-payroll').length,1);assert.strictEqual(mod.payroll(state),false);
const poor={week:1,cash:0,cumulativeProfit:0,executiveManagement:{candidates:[{id:'x',salary:100000}],executives:[],assignments:{},history:[]}},snap=JSON.stringify(poor);assert.strictEqual(mod.hire(poor,'x'),false);assert.strictEqual(JSON.stringify(poor),snap);
const normalized={executiveManagement:{candidates:Array(9).fill({id:'c'}),executives:Array(9).fill({id:'e'}),history:Array(100).fill({type:'x'})}};mod.ensure(normalized);assert.strictEqual(normalized.executiveManagement.candidates.length,6);assert.strictEqual(normalized.executiveManagement.executives.length,6);assert.strictEqual(normalized.executiveManagement.history.length,80);

const routed=new Engine({week:20,companyCash:10000000,cumulativeProfit:0,executives:{},executiveMarket:[{id:'legacy-ceo',role:'CEO',name:'Legacy CEO'}],executiveManagement:{candidates:[{id:'manager-cfo',role:'CFO',name:'Manager CFO',salary:100000,skill:80,fit:'finance'}],executives:[],assignments:{},history:[]}});
assert.strictEqual(routed.hireExecutive('legacy-ceo',2000000,.03),true,'executiveMarket ID must use legacy salary/SO/bonus route');
assert.deepStrictEqual(routed.legacyCalls,[{id:'legacy-ceo',salary:2000000,so:.03}]);
assert.strictEqual(routed.g.companyCash,9500000,'legacy route must deduct the 25% signing bonus');
assert.strictEqual(routed.g.executives.CEO.offeredSO,.03);
assert.strictEqual(routed.g.executiveManagement.executives.length,0,'legacy candidate must not enter manager system');
assert.strictEqual(routed.hireExecutive('manager-cfo'),true,'manager candidate ID must use department leader route');
assert.strictEqual(routed.legacyCalls.length,1,'manager route must not call legacy executive market handler');
assert.strictEqual(routed.g.executiveManagement.executives[0].id,'manager-cfo');
assert.strictEqual(routed.g.executives.CFO,undefined,'manager candidate must not enter legacy executive slots');
assert.strictEqual(routed.g.finance.transactions.filter(row=>row.sourceType==='executive-hire').length,1);

const collision=new Engine({week:21,companyCash:10000000,cumulativeProfit:0,executives:{},executiveMarket:[{id:'shared-id',role:'CEO',name:'Market'}],executiveManagement:{candidates:[{id:'shared-id',role:'CFO',name:'Manager',salary:100000,skill:70,fit:'finance'}],executives:[],assignments:{},history:[]}});
assert.strictEqual(collision.hireExecutive('shared-id',1600000,.02),true,'mixed IDs must prioritize an exact executiveMarket candidate');
assert.strictEqual(collision.legacyCalls.length,1);
assert.strictEqual(collision.g.executives.CEO.id,'shared-id');
assert.strictEqual(collision.g.executiveManagement.executives.length,0);

const html=mod.renderSection({g:{configured:true,selectedTab:'finance',cash:5000000,companyName:'Test',ticker:'TST'}});assert(html.includes('min-height:44px'));assert(html.includes('役員・部門責任者'));const source=fs.readFileSync('js/executives-department-assignments.js','utf8');assert(!source.includes('Math.random'));assert(!source.includes('Date.now'));assert(source.includes('operationID'));assert(source.includes('legacyHireExecutive'));console.log('executives-department-assignments tests passed');