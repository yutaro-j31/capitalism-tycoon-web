const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('js/long-run-guidance.js','utf8'),index=fs.readFileSync('index.html','utf8');
assert(!/Math\.random|Date\.now/.test(source));
assert(source.includes('LIMIT=40'));
assert(source.includes('lastProcessedWeek===week'));
assert(source.includes('min-height:44px'));
assert(index.includes('<script src="./js/long-run-guidance.js"></script>'));
class E{constructor(g){this.g=g}normalize(){}updateMacro(){}}
const context={globalThis:{__capitalismTycoonModules:{engine:{TycoonEngine:E},playerEngineBridge:{getEngine(){return null}},hallOfFameGenerations:{}}}};
context.globalThis.globalThis=context.globalThis;
vm.runInNewContext(source,context);
const api=context.globalThis.__capitalismTycoonModules.longRunGuidance;
const clone=value=>JSON.parse(JSON.stringify(value));
const protectedSnapshot=value=>({
  companyCash:value.cash??value.companyCash,
  personalCash:value.personalCash,
  companyAssets:clone({buildings:value.buildings,companyStocks:value.companyStocks,subsidiaries:value.subsidiaries,properties:(value.properties||[]).filter(row=>row.owner==='company')}),
  personalAssets:clone({luxuryAssets:value.luxuryAssets,personalStocks:value.personalStocks,properties:(value.properties||[]).filter(row=>row.owner==='personal')}),
  finance:clone(value.finance)
});
let s={week:1,cash:100,personalCash:55,cumulativeProfit:-1,globalRanking:{currentRank:500},hallOfFame:{generation:1},buildings:[{id:'b1'}],companyStocks:{AAA:2},personalStocks:{BBB:3},subsidiaries:[{id:'sub1'}],properties:[{id:'cp',owner:'company'},{id:'pp',owner:'personal'}],luxuryAssets:[{id:'watch'}],finance:{cumulativeRevenue:999}};
api.ensure(s);
assert.strictEqual(s.longRunGuidance.lastProcessedWeek,null);
api.process(s);
const once=JSON.stringify(s);
assert.strictEqual(api.process(s),false);
assert.strictEqual(JSON.stringify(s),once);
s.week=2;s.cumulativeProfit=10;api.process(s);
assert(s.longRunGuidance.completed.includes('advance-week'));
assert(s.longRunGuidance.completed.includes('first-profit'));
const restored=clone(s);api.ensure(restored);
assert.deepStrictEqual(clone(restored.longRunGuidance),clone(s.longRunGuidance));

const legacySameWeek={week:7,cash:1,personalCash:2,cumulativeProfit:1,globalRanking:{currentRank:90},hallOfFame:{generation:2},longRunGuidance:{completed:['advance-week'],dismissed:false,lastProcessedWeek:'7',history:[{week:7,unlocked:['advance-week']}]}};
const legacySameWeekBefore=JSON.stringify(legacySameWeek);
assert.strictEqual(api.process(legacySameWeek),false,'numeric-string legacy week marker must prevent same-week reprocessing');
assert.strictEqual(legacySameWeek.longRunGuidance.lastProcessedWeek,7);
assert.strictEqual(legacySameWeek.longRunGuidance.history.length,1);
assert.deepStrictEqual(clone(legacySameWeek.longRunGuidance.completed),['advance-week']);
assert.notStrictEqual(JSON.stringify(legacySameWeek),legacySameWeekBefore,'legacy marker should normalize without processing the week again');

const legacyHistory=Array.from({length:55},(_,index)=>({week:index+1,unlocked:['advance-week','advance-week','unknown-step',null]}));
legacyHistory[20]={week:'bad-week',unlocked:'invalid'};
legacyHistory[21]=null;
const legacy={longRunGuidance:{completed:['advance-week','advance-week','unknown-step',null],dismissed:'yes',lastProcessedWeek:'not-a-week',history:legacyHistory}};
api.ensure(legacy);
assert.deepStrictEqual(clone(legacy.longRunGuidance.completed),['advance-week']);
assert.strictEqual(legacy.longRunGuidance.dismissed,true);
assert.strictEqual(legacy.longRunGuidance.lastProcessedWeek,null);
assert.strictEqual(legacy.longRunGuidance.history.length,api.LIMIT);
assert.strictEqual(legacy.longRunGuidance.history[0].week,15);
assert.strictEqual(legacy.longRunGuidance.history.at(-1).week,55);
assert(legacy.longRunGuidance.history.every(row=>Number.isFinite(row.week)&&row.week>=0));
assert(legacy.longRunGuidance.history.every(row=>Array.isArray(row.unlocked)&&row.unlocked.every(id=>api.STEPS.some(step=>step.id===id))));
assert(legacy.longRunGuidance.history.every(row=>new Set(row.unlocked).size===row.unlocked.length));
const normalizedLegacy=JSON.stringify(legacy.longRunGuidance);
api.ensure(legacy);
assert.strictEqual(JSON.stringify(legacy.longRunGuidance),normalizedLegacy,'legacy normalization must be idempotent');

for(let w=3;w<100;w++){s.week=w;api.process(s)}
assert(s.longRunGuidance.history.length<=40);
assert(Number.isFinite(s.longRunGuidance.lastProcessedWeek));

function runLong(segmented){
  let state=clone(s);
  state.week=1;
  state.cumulativeProfit=-1;
  state.globalRanking.currentRank=500;
  state.hallOfFame.generation=1;
  delete state.longRunGuidance;
  api.ensure(state);
  const protectedBefore=protectedSnapshot(state);
  for(let week=1;week<=1200;week++){
    state.week=week;
    if(week===2)state.cumulativeProfit=10;
    if(week===250)state.globalRanking.currentRank=100;
    if(week===500)state.hallOfFame.generation=2;
    const beforeProcess=protectedSnapshot(state);
    api.process(state);
    assert.deepStrictEqual(protectedSnapshot(state),beforeProcess,'guidance processing must preserve company cash, personal cash, assets, and accounting');
    if(segmented&&week%100===0){state=clone(state);api.ensure(state);}
  }
  assert.deepStrictEqual(protectedSnapshot(state),protectedBefore,'long-run guidance must preserve company cash, personal cash, assets, and accounting');
  assert.strictEqual(state.cumulativeProfit,10,'scenario profit input must remain unchanged by guidance processing');
  assert(state.longRunGuidance.history.length<=api.LIMIT);
  assert(Number.isFinite(state.longRunGuidance.lastProcessedWeek));
  assert.strictEqual(state.longRunGuidance.lastProcessedWeek,1200);
  assert.deepStrictEqual([...state.longRunGuidance.completed].sort(),['advance-week','first-profit','generation','global-top100','positive-cash'].sort());
  return state;
}
const weekly=runLong(false),segmented=runLong(true);
assert.deepStrictEqual(clone(segmented.longRunGuidance),clone(weekly.longRunGuidance),'weekly progression and segmented JSON reload progression must match');
console.log('long-run-guidance tests passed');
