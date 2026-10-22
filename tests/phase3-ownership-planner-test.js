'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(ROOT,'js/phase3-ownership-planner.js'),'utf8');
const constants=Object.freeze({PLAYER_COMPANY_ENTITY_ID:'entity:company:player',FOUNDER_ENTITY_ID:'entity:person:founder',PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID:'security:player-company:common'});
const registry={economicReadModel:new Proxy(constants,{get(target,key){if(!Object.hasOwn(target,key))throw Error('planner may not invoke a reader or financial helper');return target[key];}})};
const ctx=vm.createContext({__capitalismTycoonModules:registry});
vm.runInContext(`Date=new Proxy(function(){},{apply(){throw Error('clock');},construct(){throw Error('clock');},get(){throw Error('clock');}});Math.random=()=>{throw Error('RNG');};`,ctx);
vm.runInContext(source,ctx,{filename:'phase3-ownership-planner.js'});
const api=registry.phase3OwnershipPlanner,inspect=api.inspectOwnershipAuthority,plan=api.planOwnershipChange;
const plain=x=>JSON.parse(JSON.stringify(x));
function deepFreeze(x,seen=new Set()){if(x&&typeof x==='object'&&!seen.has(x)){seen.add(x);for(const d of Object.values(Object.getOwnPropertyDescriptors(x)))if('value'in d)deepFreeze(d.value,seen);Object.freeze(x);}return x;}
function state(){return {currentCompanySerial:1,isCompanySold:false,publicCompany:true,companyName:'Own',ticker:'OWN',sharesOut:1000,founderShares:600,treasuryBuybackShares:100,
 personalStocks:{OWN:{qty:10,avg:123},X:{qty:20,avg:34}},companyStocks:{X:{qty:30,avg:45}},market:[{id:'OWN',issuedShares:1000,price:99},{id:'X',issuedShares:2000}],startups:[]};}
function scope(){return {family:'player-common',issuerEntityId:constants.PLAYER_COMPANY_ENTITY_ID,securityClassId:constants.PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID,currentCompanySerial:1};}
const kinds={
 'W-BUY':'personal-buy','W-SELL':'personal-sell','W-MARGIN-LIQ':'personal-sell','W-SPLIT':'split','W-FOUNDER-SALE':'founder-sale','W-INVESTOR':'external-issue',
 'W-IPO-CHAIN':'ipo','W-SHARE-SWAP':'external-issue','W-MA-EQUITY/SH':'external-issue','W-BUYBACK':'buyback','W-SPONSOR':'external-issue','W-TURNAROUND-ACCEPT':'external-issue','W-TURNAROUND-RATCHET':'external-issue'
};
const rejections={
 INTERNAL_ENTRY:['W-MARGIN-RAW','W-IPO-BASE','W-ISSUE-RAW','W-ACQUIRE-COMPAT','W-BUYBACK-BASE'],
 REPLACEMENT_UNSUPPORTED:['W-INIT','W-NEW-COMPANY','W-LOAD-NORMALIZE','W-LOAD-IMPORT','W-COMPACTION','W-RESTORE/SH-REPLACE'],
 NO_COMMON_QUANTITY_CHANGE:['W-INVESTOR-AUX','W-RATIOS','W-DECLINE','W-DIV-SET','W-DIV-PAY','W-WEEK-MARKET','W-WEEK-EXPANDED','W-EARNINGS','W-CAPALLOC-PRICE'],
 HOLDER_UNPROVEN:['W-DEFENSE','W-WEEK-COMPETITOR'],ORCHESTRATION_ONLY:['W-ACTIVISM','W-MA-ACQUIRE'],
 ISSUER_FAMILY_UNSUPPORTED:['W-MBO','W-VC-INITIAL','W-VC-FOLLOW','W-VC-CLOSE','W-VC-WRITEOFF','W-VC-LIST','W-VC-SECONDARY','W-MAKE-SUB','W-SUB-IPO','W-SUB-SECONDARY','W-SUB-MARKET','W-SUB-CONTROL','W-SUB-FOLLOWON','W-SUB-RELIST','W-GROUP-DISPOSAL','W-GROUP-NEGOTIATED','W-INTERNAL-VENTURE','W-COMMERCIAL-SPINOUT','W-MA-SALE','W-PE-FORM','W-PE-FUND-ACQ','W-PE-FUND-EXIT','W-PE-PARENT','W-PE-LEGACY-CREATE','W-PE-LEGACY-EXIT','W-PE-TRANSFER','W-PE-SYNC','W-ANGEL','W-WEEK-STARTUPS','W-WEEK-PE']
};
function intent(s,id='W-BUY'){
 const evidence=inspect(s,scope());assert.equal(evidence.status,'OBSERVED');
 const kind=kinds[id]||'external-issue';
 const buckets=kind==='split'?['sharesOut','treasuryBuybackShares','founderShares','personalOwnShares']:kind.startsWith('personal-')?['personalOwnShares']:kind==='founder-sale'?['founderShares']:kind==='buyback'?['treasuryBuybackShares']:kind==='ipo'?['sharesOut','founderShares']:['sharesOut'];
 return {scope:scope(),writerId:id,kind,operationId:'existing-operation-1',account:kind==='ipo'?'company-and-personal':['personal-buy','personal-sell','founder-sale'].includes(kind)?'personal':'company',
 sourceLots:buckets.map(k=>evidence.sourcePaths[k]),expected:{sourceState:s,sourceFingerprint:evidence.sourceFingerprint,quantities:{sharesOut:s.sharesOut,treasuryBuybackShares:s.treasuryBuybackShares,founderShares:s.founderShares,personalOwnShares:evidence.quantities.personalOwnShares}},
 change:kind==='split'?{factor:2}:kind==='ipo'?{issuedQuantity:100,founderSecondaryQuantity:20,listingTicker:s.companyName.replace(/[^A-Za-z]/g,'').slice(0,4).toUpperCase()||'CPTY'}:{quantity:5}};
}
function reject(result,code){assert.equal(result.status,'REJECTED');assert.equal(result.executable,false);assert.equal(result.authority,'read-only');assert.equal(result.reasons[0].code,code);assert.equal(typeof result.reasons[0].path,'string');assert.equal(typeof result.reasons[0].message,'string');assert(Object.isFrozen(result.reasons[0]));}
function ok(result){assert.equal(result.status,'PLANNED',JSON.stringify(result));assert.equal(result.executable,false);assert.equal(result.wholeCommandValidated,false);assert.equal(result.unallocatedIsIdentifiedHolder,false);assert.equal(result.after.sharesOut,result.after.treasuryBuybackShares+result.after.outstanding);assert.equal(result.after.outstanding,result.after.founderBeneficial+result.after.unallocated);assert.equal(result.after.founderBeneficial,result.after.founderShares+result.after.personalOwnShares);}
assert.equal(api.applyOwnershipPlan,undefined);assert.deepEqual(Object.keys(api).sort(),['BUCKETS','VERSION','WRITER_POLICIES','inspectOwnershipAuthority','planOwnershipChange'].sort());

// One explicit disposition per #1081 matrix row, including raw, weekly, SH and replacement routes.
const inventory=fs.readFileSync(path.join(ROOT,'docs/economic-engine/PHASE_3_P3_4_WRITER_FAILURE_WEBKIT_EVIDENCE.md'),'utf8');
const writerIDs=[...inventory.matchAll(/^\| (W-[^:]+): /gm)].map(x=>x[1]);
const expectedIDs=[...Object.keys(kinds),...Object.values(rejections).flat()];
assert.equal(writerIDs.length,67);assert.equal(new Set(expectedIDs).size,67);
assert.deepEqual([...writerIDs].sort(),[...expectedIDs].sort());
assert.deepEqual(Object.keys(api.WRITER_POLICIES).sort(),[...expectedIDs].sort());
for(const [id,kind] of Object.entries(kinds)){
 const s=state();if(kind==='ipo'){s.publicCompany=false;s.market=[];}
 const request=intent(s,id),before=plain(s);deepFreeze(request);
 const result=plan(s,request);ok(result);assert.deepEqual(plain(s),before,id+' frozen input unchanged');
 assert.deepEqual(plain(plan(s,request)),plain(result),id+' deterministic repeat');
 const wrong={...request,account:request.account==='company'?'personal':'company'};reject(plan(s,wrong),'ACCOUNT_UNSUPPORTED');
 reject(plan(s,{...request,kind:'create-trust-votes'}),'COMMAND_UNSUPPORTED');
}
for(const [code,ids] of Object.entries(rejections))for(const id of ids){const s=state(),request=intent(s,id),before=plain(s);deepFreeze(request);reject(plan(s,request),code);assert.deepEqual(plain(s),before);}

// Independently calculated expected quantities; not just mirrors of exported policy metadata.
for(const [id,changes] of [
 ['W-BUY',{personalOwnShares:15,founderBeneficial:615,unallocated:285}],
 ['W-SELL',{personalOwnShares:5,founderBeneficial:605,unallocated:295}],
 ['W-FOUNDER-SALE',{founderShares:595,founderBeneficial:605,unallocated:295}],
 ['W-INVESTOR',{sharesOut:1005,outstanding:905,unallocated:295}],
 ['W-BUYBACK',{treasuryBuybackShares:105,outstanding:895,unallocated:285}],
 ['W-SPLIT',{sharesOut:2000,treasuryBuybackShares:200,founderShares:1200,personalOwnShares:20,outstanding:1800,founderBeneficial:1220,unallocated:580}]
]){const s=state(),r=plan(s,intent(s,id));ok(r);for(const [key,value] of Object.entries(changes))assert.equal(r.after[key],value,id+'/'+key);}
{
 const s=state();s.publicCompany=false;s.market=[];const r=plan(s,intent(s,'W-IPO-CHAIN'));ok(r);
 assert.equal(r.after.sharesOut,1100);assert.equal(r.after.founderShares,580);assert.equal(r.after.unallocated,410);
 assert.deepEqual(plain(r.listingRequirement),{ticker:'OWN',previousTicker:'OWN',issuedShares:1100,requiresExistingWriter:true});
}
// IPO identity follows the installed writer's companyName rule, not the private ticker.
function privateIPO(){const s=state();s.publicCompany=false;s.ticker='CPTY';s.companyName='Acme';s.market=[];s.personalStocks={};s.companyStocks={};return s;}
{
 const s=privateIPO(),req=intent(s,'W-IPO-CHAIN'),before=plain(s);deepFreeze(req);
 const r=plan(s,req);ok(r);assert.deepEqual(plain(r.listingRequirement),{ticker:'ACME',previousTicker:'CPTY',issuedShares:1100,requiresExistingWriter:true});
 assert.deepEqual(plain(r.mirrors),[]);assert.deepEqual(plain(s),before);assert.deepEqual(plain(plan(s,req)),plain(r));
}
for(const mutate of [s=>{s.market=[{id:'ACME',issuedShares:1000}];},s=>{s.startups=[{ipoStockID:'ACME'}];},
 ...['personalStocks','companyStocks'].flatMap(key=>['CPTY','ACME'].map(ticker=>s=>{s[key][ticker]={qty:0};}))]){
 const s=privateIPO();mutate(s);const req=intent(s,'W-IPO-CHAIN'),before=plain(s);deepFreeze(req);
 reject(plan(s,req),'ALIAS_BINDING_UNPROVEN');assert.deepEqual(plain(s),before);
}
{
 const s=privateIPO(),req=intent(s,'W-IPO-CHAIN');let calls=0;
 s.market=[{id:'ACME',get issuedShares(){calls++;throw Error('external issuer');}}];
 reject(plan(s,req),'ALIAS_BINDING_UNPROVEN');assert.equal(calls,0);
 const t=privateIPO(),stale=intent(t,'W-IPO-CHAIN');t.companyName='Beta';reject(plan(t,stale),'STALE_SOURCE');
 const u=privateIPO(),accessor=intent(u,'W-IPO-CHAIN');Object.defineProperty(u,'companyName',{enumerable:true,get(){calls++;throw Error('name accessor');}});
 reject(plan(u,accessor),'INPUT_INVALID');assert.equal(calls,0);
 const v=privateIPO(),missing=intent(v,'W-IPO-CHAIN');delete missing.change.listingTicker;reject(plan(v,missing),'INPUT_INVALID');
}
for(const [name,target] of [['日本会社','CPTY'],['a-1b éC dEF','ABCD']]){
 const s=privateIPO();s.companyName=name;const r=plan(s,intent(s,'W-IPO-CHAIN'));ok(r);assert.equal(r.listingRequirement.ticker,target);
}
{
 const s=state(),r=plan(s,intent(s,'W-INVESTOR'));assert.deepEqual(plain(r.mirrors),[{sourcePath:'market[0].issuedShares',before:1000,after:1005}]);
 assert.deepEqual(plain(r.updates),[{bucket:'sharesOut',sourcePath:'sharesOut',before:1000,after:1005,attribution:{role:'issuer-total',entityId:constants.PLAYER_COMPANY_ENTITY_ID}}]);
 const r2=plan(s,intent(s));assert(!Object.isFrozen(s));assert(!Object.isFrozen(s.personalStocks));assert.throws(()=>{r2.after.sharesOut=0;},TypeError);
}

// Numeric validation, exact representability, conservation, command limits and source attribution.
for(const value of [NaN,Infinity,-1,'1000',null,Number.MAX_SAFE_INTEGER+1]){const s=state();s.sharesOut=value;reject(inspect(s,scope()),'QUANTITY_INVALID');}
for(const mutate of [s=>{s.treasuryBuybackShares=1001;},s=>{s.founderShares=901;}]){const s=state();mutate(s);reject(inspect(s,scope()),'CONSERVATION_FAILED');}
{
 const s=state();s.founderShares=600.25;assert.equal(inspect(s,scope()).quantities.founderBeneficial,610.25);
 reject(plan(s,intent(s)),'NUMERIC_DOMAIN_UNSUPPORTED');assert.equal(s.founderShares,600.25,'no quantity rounding');
}
for(const [id,change,code] of [
 ['W-BUY',{quantity:291},'CONSERVATION_FAILED'],['W-SELL',{quantity:11},'CONSERVATION_FAILED'],['W-FOUNDER-SALE',{quantity:601},'CONSERVATION_FAILED'],
 ['W-BUYBACK',{quantity:291},'CONSERVATION_FAILED'],['W-BUY',{quantity:0},'COMMAND_DOMAIN'],['W-BUY',{quantity:.5},'NUMERIC_DOMAIN_UNSUPPORTED'],
 ['W-SPLIT',{factor:1},'COMMAND_DOMAIN'],['W-SPLIT',{factor:2.5},'NUMERIC_DOMAIN_UNSUPPORTED'],['W-SPLIT',{factor:Number.MAX_SAFE_INTEGER},'QUANTITY_INVALID'],
 ['W-INVESTOR',{quantity:Number.MAX_SAFE_INTEGER},'CONSERVATION_FAILED']
]){const s=state();reject(plan(s,{...intent(s,id),change}),code);}
{
 const s=state();reject(plan(s,{...intent(s),sourceLots:['companyStocks["OWN"].qty']}),'SOURCE_LOT_UNSUPPORTED');
 reject(plan(s,{...intent(s),writerId:'__proto__'}),'WRITER_UNSUPPORTED');
 reject(plan(s,{...intent(s),operationId:''}),'INPUT_INVALID');
 const r=intent(s);r.expected.quantities.founderShares--;reject(plan(s,r),'STALE_SOURCE');
 const req=intent(s);s.personalStocks.OWN.qty++;reject(plan(s,req),'STALE_SOURCE');
 const req2=intent(s);s.ticker='OTHER';reject(plan(s,req2),'MIRROR_MISMATCH');
}
for(const [badScope,code] of [
 [{...scope(),family:'fund'},'ISSUER_FAMILY_UNSUPPORTED'],[{...scope(),issuerEntityId:'entity:company:external'},'ISSUER_FAMILY_UNSUPPORTED'],
 [{...scope(),securityClassId:'preferred'},'CLASS_UNSUPPORTED'],[{...scope(),currentCompanySerial:2},'GENERATION_UNPROVEN']
])reject(inspect(state(),badScope),code);

// Never read protected financial/lifecycle services, even when supplied as hostile getters.
{
 const s=state();let calls=0;
 for(const key of ['companyCash','personalCash','companyDebt','personalDebt','finance','simulationRng','week','save','now','companyName','pastCompanyRecords','peDeals','startupFundingHistory'])Object.defineProperty(s,key,{enumerable:true,get(){calls++;throw Error('must not read '+key);}});
 Object.defineProperty(s.personalStocks.OWN,'avg',{enumerable:true,get(){calls++;throw Error('cost is not a quantity');}});
 Object.defineProperty(s.market[0],'price',{enumerable:true,get(){calls++;throw Error('quote is not a quantity');}});
 const e=inspect(s,scope());assert.equal(e.status,'OBSERVED');const req=intent(s);deepFreeze(req);ok(plan(s,req));assert.equal(calls,0);
}
{
 let calls=0;const getter=()=>{calls++;throw Error('accessor');};
 const s=state();Object.defineProperty(s,'founderShares',{enumerable:true,get:getter});reject(inspect(s,scope()),'INPUT_INVALID');
 const t=state(),req=intent(t);Object.defineProperty(req.change,'quantity',{enumerable:true,get:getter});reject(plan(t,req),'INPUT_INVALID');
 const u=state(),req2=intent(u);Object.defineProperty(req2.expected,'sourceState',{enumerable:true,get:getter});reject(plan(u,req2),'INPUT_INVALID');assert.equal(calls,0);
}
for(const raw of [null,[],new Date(),Object.create({sharesOut:1000})])reject(inspect(raw,scope()),'INPUT_INVALID');
for(const mutate of [s=>{s.market=new Array(1);},s=>{s.startups=[,];},s=>{s.market.extra=1;},s=>{s.personalStocks=Object.create({OWN:{qty:10}});}]){const s=state();mutate(s);reject(inspect(s,scope()),'INPUT_INVALID');}
for(const mutate of [r=>{r.apply=true;},r=>{r.change.cash=1;},r=>{r.expected.quantities.extra=1;},r=>{r.sourceLots.push(r.sourceLots[0]);}]){
 const s=state(),req=intent(s);mutate(req);const code=req.sourceLots.length>1?'SOURCE_LOT_UNSUPPORTED':'INPUT_INVALID';reject(plan(s,req),code);
}

// #1082 NG scenarios, represented as pure snapshots; no sale/refound or monetary writer is executed.
// NG-01/02: initial binding; rename leaves same facts; consistent reticker is a reader input variation.
{
 const s=state(),a=plain(inspect(s,scope()));s.companyName='Renamed';assert.deepEqual(plain(inspect(s,scope())),a);
 s.personalStocks.NEW=s.personalStocks.OWN;delete s.personalStocks.OWN;s.market[0].id='NEW';s.ticker='NEW';assert.equal(inspect(s,scope()).status,'OBSERVED');
 assert.equal(inspect(s,scope()).quantities.founderBeneficial,610);
}
// NG-03/04/05/12/15: sold and later generations cannot inherit the player common binding.
for(const serial of [undefined,null,'1',0,2,3]){const s=state();s.currentCompanySerial=serial;deepFreeze(s);reject(inspect(s,scope()),'GENERATION_UNPROVEN');assert.equal(s.personalStocks.OWN.qty,10);}
for(const sold of [true,undefined,null,0]){const s=state();s.isCompanySold=sold;reject(inspect(s,scope()),'GENERATION_UNPROVEN');}
{
 const s=state(),req=intent(s);s.currentCompanySerial=2;reject(plan(s,req),'GENERATION_UNPROVEN');s.currentCompanySerial=1;s.isCompanySold=true;reject(plan(s,req),'GENERATION_UNPROVEN');
}
// NG-06/08/09: ticker aliases and malformed/colliding sources are not repaired or merged.
{
 const s=state(),req=intent(s,'W-IPO-CHAIN');s.publicCompany=false;
 // Even an exact quantity/name match remains another issuer when the player is private.
 const before=plain(s);reject(inspect(s,scope()),'ALIAS_BINDING_UNPROVEN');reject(plan(s,req),'ALIAS_BINDING_UNPROVEN');assert.deepEqual(plain(s),before);
 let reads=0;Object.defineProperty(s.market[0],'issuedShares',{enumerable:true,get(){reads++;throw Error('external issuer quantity');}});
 reject(inspect(s,scope()),'ALIAS_BINDING_UNPROVEN');assert.equal(reads,0);
}
for(const map of ['personalStocks','companyStocks'])for(const bad of [undefined,null,false,0,'bad']){
 const s=state(),req=intent(s);s[map].OWN=bad;deepFreeze(s);const descriptor=Object.getOwnPropertyDescriptor(s[map],'OWN');
 reject(inspect(s,scope()),'INPUT_INVALID');reject(plan(s,req),'INPUT_INVALID');assert.deepEqual(Object.getOwnPropertyDescriptor(s[map],'OWN'),descriptor);
}
{
 const s=state();delete s.personalStocks.OWN;assert.equal(inspect(s,scope()).quantities.personalOwnShares,0);ok(plan(s,intent(s)));
 const t=state();t.startups=[{ipoStockID:123}];reject(inspect(t,scope()),'INPUT_INVALID');
}
for(const mutate of [s=>{s.startups=[{id:'vc-personal',ipoStockID:'OWN'}];},s=>{s.market.push({...s.market[0]});}]){const s=state();mutate(s);const before=plain(s);reject(inspect(s,scope()),'ALIAS_BINDING_UNPROVEN');assert.deepEqual(plain(s),before);}
{
 const s=state();s.companyStocks.OWN={qty:2};reject(inspect(s,scope()),'OWN_SHARE_ALIAS_UNRESOLVED');
 const t=state();t.market[0].issuedShares--;reject(inspect(t,scope()),'MIRROR_MISMATCH');
}
// NG-07/08: unrelated retained PE/VC data has no place in this class's denominator; not a paid-claim validation.
{
 const s=state(),before=plain(inspect(s,scope()));s.peDeals=[{ownerAccount:'personal',ownershipRatio:1}];s.startups=[{id:'vc',ownedPersonal:.7,ownedCompany:.2}];
 assert.deepEqual(plain(inspect(s,scope())),before);reject(plan(s,intent(s,'W-PE-PARENT')),'ISSUER_FAMILY_UNSUPPORTED');
}
// NG-10/11/12: no apply/commit/notice/replay service. Same pure request repeats; it never settles anything.
{
 const s=state(),req=intent(s),before=plain(s);const a=plan(s,req);assert.deepEqual(plain(plan(s,req)),plain(a));assert.deepEqual(plain(s),before);
}
// NG-13/14/15: JSON state reload is inspectable; old root binding rejects identical replacement.
{
 const s=state(),req=intent(s),reloaded=plain(s);assert.deepEqual(plain(inspect(reloaded,scope())),plain(inspect(s,scope())));
 reject(plan(reloaded,req),'STALE_SOURCE');ok(plan(reloaded,intent(reloaded)));
 for(const key of ['currentCompanySerial','isCompanySold']){const missing=plain(s);delete missing[key];reject(inspect(missing,scope()),'GENERATION_UNPROVEN');}
}
// NG-16: bounded deterministic sequences for store/digital/investment snapshots. No host services required.
for(const mode of ['store','digital','investment']){
 function sequence(){let s=state();s.scenario=mode;const out=[];for(let i=0;i<20;i++){deepFreeze(s);const r=plan(s,intent(s,i%2?'W-SELL':'W-BUY'));ok(r);out.push(plain(r));s={...s,personalStocks:{...s.personalStocks,OWN:{...s.personalStocks.OWN,qty:r.after.personalOwnShares}}};}assert.equal(s.personalStocks.OWN.qty,10);return out;}
 assert.deepEqual(sequence(),sequence());
}
// Precise rejection boundaries, including finite fractions that would be lost by addition.
{
 const s=state();s.sharesOut=Number.MAX_SAFE_INTEGER;s.market[0].issuedShares=s.sharesOut;s.treasuryBuybackShares=0;s.founderShares=Number.MAX_SAFE_INTEGER;s.personalStocks.OWN.qty=.5;
 reject(inspect(s,scope()),'CONSERVATION_FAILED');
 const zero=state();zero.sharesOut=zero.treasuryBuybackShares=zero.founderShares=zero.personalStocks.OWN.qty=zero.market[0].issuedShares=0;
 reject(plan(zero,intent(zero,'W-INVESTOR')),'DENOMINATOR_UNSUPPORTED');
 for(const ticker of ['__proto__','constructor','prototype','bad\u0000ticker']){const t=state();t.ticker=ticker;reject(inspect(t,scope()),'INPUT_INVALID');}
 const t=state();t.treasuryBuybackShares=-0;assert.equal(Object.is(inspect(t,scope()).quantities.treasuryBuybackShares,-0),false);assert(Object.is(t.treasuryBuybackShares,-0));
}
// Installing the module into the actual classic-script runtime changes no engine method/state.
{
 const {loadGameFromHtml,readIndex}=require('./harness');
 const loaded=loadGameFromHtml(readIndex().replace('<script src="./js/phase3-ownership-planner.js"></script>',''),{headless:true,random:()=>.25});
 const Engine=loaded.engineModule.TycoonEngine,game=new Engine(),s=game.g;
 const before=JSON.stringify(s),methods=Object.getOwnPropertyDescriptors(Engine.prototype);
 game.save=()=>{throw Error('save');};game.emit=()=>{throw Error('emit');};
 vm.runInContext('globalThis.__priorDate=Date;globalThis.__priorRandom=Math.random;Date=function(){throw Error("clock");};Date.now=()=>{throw Error("clock");};Math.random=()=>{throw Error("RNG");};',loaded.ctx);
 try{
  vm.runInContext(source,loaded.ctx);
  const a=loaded.modules.phase3OwnershipPlanner,e=a.inspectOwnershipAuthority(s,scope());assert.equal(e.status,'OBSERVED');
  const expected={sourceState:s,sourceFingerprint:e.sourceFingerprint,quantities:Object.fromEntries(['sharesOut','treasuryBuybackShares','founderShares','personalOwnShares'].map(k=>[k,e.quantities[k]]))};
  deepFreeze(s);ok(a.planOwnershipChange(s,{scope:scope(),writerId:'W-INVESTOR',kind:'external-issue',operationId:'existing-offer',account:'company',sourceLots:['sharesOut'],expected,change:{quantity:5}}));
  assert.equal(JSON.stringify(s),before);assert.deepEqual(Object.getOwnPropertyDescriptors(Engine.prototype),methods);
 }finally{vm.runInContext('Date=globalThis.__priorDate;Math.random=globalThis.__priorRandom;delete globalThis.__priorDate;delete globalThis.__priorRandom;',loaded.ctx);}
}
console.log('PASS P3-4 pure ownership planner: 67 writer dispositions, quantity/domain/alias/account checks, frozen inputs, deterministic replay, no protected reads, NG-01..16 pure scope');
