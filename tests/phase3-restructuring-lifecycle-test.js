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
unresolved(s=>{s.week=101;s.groupRestructuringHistory.push({type:'merge',aID:'r',bID:'c',mergedID:'z',week:101});},'LIVE_PREDECESSOR_CONFLICT');
{
 const s=fixture();s.week=101;s.subsidiaries[0].status='integrated';
 s.groupRestructuringHistory.push({type:'merge',aID:'r',bID:'c',mergedID:'z',week:101});
 assert.equal(get(s).status,'source-matched');assert.equal(get(s).isCurrent,false);
 s.groupRestructuringHistory.push({type:'merge',aID:'r',bID:'d',mergedID:'z2',week:101});
 assert(project(s).issues.some(i=>i.code==='ALIAS_CONFLICT'));
}
// Historical status is not proof that the receipt consuming this row is sound.
for(const change of [
 s=>s.groupRestructuringHistory[1].week=99,
 s=>s.groupRestructuringHistory[1].week=102,
 s=>s.groupRestructuringHistory[1].week=NaN,
 s=>s.groupRestructuringHistory.push({...s.groupRestructuringHistory[1]}),
 s=>s.groupRestructuringHistory[1].bID='r',
 s=>delete s.groupRestructuringHistory[1].mergedID,
 s=>s.groupRestructuringHistory.push({type:'merge',aID:'x',bID:'y',mergedID:'z',week:101}),
 s=>s.groupRestructuringHistory.push({type:'merge',aID:'x',bID:'y',mergedID:'c',week:102})
]){
 const s=fixture();s.week=101;s.subsidiaries[0].status='integrated';
 s.groupRestructuringHistory.push({type:'merge',aID:'r',bID:'c',mergedID:'z',week:101});change(s);
 const result=project(s);assert.equal(result.observations[0].status,'unresolved',JSON.stringify(s));
 assert(result.issues.length>0);assert.equal(result.observations[0].isCurrent,null);
}
{
 const s=fixture();s.subsidiaries[0].status='integrated';
 s.groupRestructuringHistory.push({type:'merge',aID:'r',bID:'c',mergedID:'z',week:100});
 assert.equal(get(s).status,'source-matched');assert.equal(get(s).isCurrent,false);
}
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
// Source retention and the supported issuer envelope must not fabricate ancestry.
{
 const s=fixture();for(let i=1;i<80;i++)s.groupRestructuringHistory.push({type:'sale',week:100});
 assert.equal(get(s).status,'unresolved');assert(project(s).issues.some(i=>i.code==='ANCESTRY_UNPROVEN'));
}
{
 const s=fixture();for(let i=1;i<1000;i++)s.subsidiaries.push({id:'other-'+i,status:'active'});
 assert.equal(project(s).observations[0].status,'source-matched');
}
{
 const s={week:165,subsidiaries:[{id:'r65',status:'active',restructuredFrom:['r64','leaf65'],restructuredWeek:165}],groupRestructuringHistory:[]};
 for(let i=1;i<=65;i++)s.groupRestructuringHistory.push({type:'merge',aID:i===1?'leaf0':'r'+(i-1),bID:'leaf'+i,mergedID:'r'+i,week:100+i});
 assert.equal(project(s).observations[0].status,'source-matched');
}
// Reuse the installed-engine harness: no second economic simulation fixture.
for(const retained of [{id:'a',status:'active'},{id:'a',status:'sold'},{id:'a',status:'integrated'}]){
 const s={week:102,subsidiaries:[{id:'r2',status:'active',restructuredFrom:['r','c'],restructuredWeek:101},retained],groupRestructuringHistory:[receipt(),{type:'merge',aID:'r',bID:'c',mergedID:'r2',week:101}]};
 assert.equal(project(s).observations[0].status,retained.status==='integrated'?'source-matched':'unresolved');
 if(retained.status==='integrated'){s.subsidiaries.push({...retained});assert.equal(project(s).observations[0].status,'unresolved');}
}
{
 const s=fixture();s.week=102;s.subsidiaries[0].status='integrated';s.subsidiaries.push({id:'x',status:'active'});
 s.groupRestructuringHistory.push({type:'merge',aID:'x',bID:'y',mergedID:'c',week:99},{type:'merge',aID:'r',bID:'c',mergedID:'z',week:101});
 assert.equal(get(s).status,'unresolved');
}
for(const [consumer,change] of [
 [false,s=>s.subsidiaries[1].restructuredFrom=['x','y']],[false,s=>s.subsidiaries[1].restructuredWeek=99],
 [false,s=>delete s.subsidiaries[1].restructuredFrom],
 [true,s=>s.subsidiaries.push({id:'z',status:'active',restructuredFrom:['x','y'],restructuredWeek:101})]
]){
 const s={week:102,subsidiaries:[{id:'r2',status:'active',restructuredFrom:['r','c'],restructuredWeek:101},{...replacement(),status:'integrated'}],groupRestructuringHistory:[receipt(),{type:'merge',aID:'r',bID:'c',mergedID:'r2',week:101}]};
 // The optional z is the consumer of this historical r2 row.
 if(consumer){s.subsidiaries[0].status='integrated';s.groupRestructuringHistory.push({type:'merge',aID:'r2',bID:'d',mergedID:'z',week:102});}
 change(s);assert.equal(project(s).observations.find(r=>r.replacementSourceId==='r2').status,'unresolved');
}
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
