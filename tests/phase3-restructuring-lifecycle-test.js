'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../js/phase3-restructuring-lifecycle.js'),'utf8');
const context={__capitalismTycoonModules:{}};vm.runInNewContext(code,context);
const project=context.__capitalismTycoonModules.phase3RestructuringLifecycle.projectRestructuringLifecycle;
const plain=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const replacement=()=>({id:'r',status:'active',ownership:1,restructuredFrom:['a','b'],restructuredWeek:100,startupID:'inherited-startup',peDealID:'inherited-pe'});
const receipt=()=>({type:'merge',aID:'a',bID:'b',mergedID:'r',week:100});
const fixture=()=>({week:100,saveVersion:9,companyCash:123,personalCash:456,simulationRng:{seed:17},subsidiaries:[replacement()],groupRestructuringHistory:[receipt()]});
const get=s=>project(s).observations[0];
const input=fixture(),before=JSON.stringify(input),out=project(input);
assert.equal(get(input).status,'source-matched');assert.equal(get(input).isCurrent,true);
assert.deepEqual(plain(get(input).historicalPredecessorSourceIds),['a','b']);
for(const key of ['economicFraction','votingFraction','aliasReplacement'])assert.equal(get(input)[key],null);
assert.equal(get(input).assetRole,'lifecycle-only');assert.equal(get(input).parentGenerationStatus,'unproven');
for(const key of ['complete','commandEligible','wealthComplete'])assert.equal(out[key],false);
assert.equal(out.sourceSnapshotToken,null);assert.equal(JSON.stringify(input),before);assert(!Object.isFrozen(input));
assert(Object.isFrozen(out.observations[0].historicalPredecessorSourceIds));
assert.deepEqual(plain(project(freeze(plain(input)))),plain(out));assert.deepEqual(plain(project(plain(input))),plain(out));
assert.equal(project({saveVersion:9}).observations.length,0);
function unresolved(change,expected){const s=fixture();change(s);const r=project(s);assert.equal(r.observations[0]?.status,'unresolved');if(expected)assert(r.issues.some(i=>i.code===expected),JSON.stringify(r));}
unresolved(s=>s.groupRestructuringHistory=[], 'LIFECYCLE_UNPROVEN');
unresolved(s=>s.groupRestructuringHistory.push(receipt()),'LIFECYCLE_UNPROVEN');
unresolved(s=>s.groupRestructuringHistory[0].aID='other','LIFECYCLE_UNPROVEN');
unresolved(s=>s.groupRestructuringHistory[0].week=99,'LIFECYCLE_UNPROVEN');
unresolved(s=>s.subsidiaries.push({id:'a',status:'active'}),'LIVE_PREDECESSOR_CONFLICT');
unresolved(s=>s.subsidiaries.push({id:'a'}),'LIVE_PREDECESSOR_CONFLICT');
unresolved(s=>s.subsidiaries.push(replacement()),'IDENTITY_UNPROVEN');
unresolved(s=>s.subsidiaries[0].restructuredFrom=['a','a'],'ALIAS_CONFLICT');
unresolved(s=>s.subsidiaries[0].restructuredFrom=['r','b'],'ALIAS_CONFLICT');
unresolved(s=>s.week=99,'LIFECYCLE_UNKNOWN');
unresolved(s=>delete s.subsidiaries[0].status,'LIFECYCLE_UNKNOWN');
{
 const s=fixture();s.subsidiaries.push({id:'a',status:'integrated'});assert.equal(get(s).status,'source-matched');
 s.subsidiaries[0].status='sold';assert.equal(get(s).isCurrent,false);
}
{
 const s=fixture();s.groupRestructuringHistory.push({type:'merge',aID:'r',bID:'c',mergedID:'a',week:99});assert(project(s).issues.some(i=>i.code==='CYCLE_UNSUPPORTED'));
}
{
 const s=fixture();s.groupRestructuringHistory.push({type:'merge',aID:'x',bID:'c',mergedID:'a',week:101});assert(project(s).issues.some(i=>i.code==='LIFECYCLE_CONFLICT'));
}
{
 const s=fixture();s.groupRestructuringHistory.push({type:'merge',aID:'a',bID:'c',mergedID:'r2',week:100});assert(project(s).issues.some(i=>i.code==='ALIAS_CONFLICT'));
}
{
 const s=fixture();delete s.groupRestructuringHistory;s.integrationProjects=[{id:'p',aID:'b',bID:'a',mergedID:'r',status:'completed',completedWeek:100,completionApplied:true}];
 assert.equal(get(s).status,'source-matched');s.integrationProjects[0].completionApplied=false;assert.equal(get(s).status,'unresolved');
 s.integrationProjects[0].completionApplied=true;s.integrationProjects.push({...s.integrationProjects[0]});assert.equal(get(s).status,'unresolved');
}
{
 let reads=0;const s=fixture();Object.defineProperty(s.subsidiaries[0],'restructuredFrom',{get(){reads++;throw Error('getter');}});
 assert.equal(project(s).issues[0].code,'INPUT_INVALID');assert.equal(reads,0);
 const a=fixture();Object.defineProperty(a.subsidiaries,'0',{get(){reads++;throw Error('getter');}});assert.equal(project(a).issues[0].code,'INPUT_INVALID');assert.equal(reads,0);
 class Exotic{};const x=fixture();x.subsidiaries[0]=Object.assign(new Exotic(),x.subsidiaries[0]);assert.equal(project(x).issues[0].code,'INPUT_INVALID');
}
assert.throws(()=>vm.runInNewContext(code,context),/already registered/);
// Reuse the installed-engine harness: no second economic simulation fixture.
(async()=>{
 const {scenario}=require('./fixtures/stock-split-atomicity');const s=await scenario('own'),e=s.game;
 const sub=id=>({id,name:id,status:'active',ownership:1,valuation:100000000,carryingBookValue:70000000,investedCost:70000000,subsidiaryCash:1000000,weeklyProfit:1000000,growth:.1,risk:.2,domain:'retail'});
 e.g.companyCash=1000000000;e.g.subsidiaries=[sub('a'),sub('b')];
 assert.equal(e.executeGroupRestructuringMerge('a','b'),true);
 const snapshot=JSON.stringify(e.g),draws=s.host.draws,direct=project(e.g);assert.equal(s.host.draws,draws);assert.equal(direct.observations[0].status,'source-matched');assert.equal(JSON.stringify(e.g),snapshot);
 assert.deepEqual(plain(project(plain(e.g))),plain(direct));
 e.g.subsidiaries=[sub('c'),sub('d')];
 assert.equal(e.startSubsidiaryIntegrationProject('c','d'),true);
 for(let i=0;i<12;i++){e.g.week++;s.ctx.__capitalismTycoonModules.groupRestructuringProgress.processWeek(e.g,e.g.week);}
 const stagedBefore=JSON.stringify(e.g),stagedDraws=s.host.draws,staged=project(e.g);assert.equal(JSON.stringify(e.g),stagedBefore);assert.equal(s.host.draws,stagedDraws);assert.equal(staged.observations[0].status,'source-matched');assert.equal(e.g.integrationProjects[0].completionApplied,true);
 console.log('PASS P3-6 restructuring lifecycle: installed direct/staged receipts, history gaps, conflicts/cycles, account purity, v9 and immutable output');
})().catch(error=>{console.error(error);process.exitCode=1;});
