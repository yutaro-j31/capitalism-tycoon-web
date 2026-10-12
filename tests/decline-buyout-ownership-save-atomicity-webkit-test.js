'use strict';
// #955 (7A) in real iPhone WebKit + real IndexedDB: the installed declineInboundBuyoutOffer marks the offer
// declined and, for a hostile bidder, raises the competitor stake out of the external float (existing
// updateOwnershipRatios rule) in ONE durable commit; founder + external + competitor stays 1. Every injected save
// fault rolls live, mirror, cache and durable state back; the retry equals an unfaulted run; a second decline is
// refused; reload and a fresh durable-only context agree. (The pre-existing founder + competitor > 1 edge is an
// ownership-model question for the Owner and is not exercised here.)
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {scenario}=require('./fixtures/stock-split-atomicity');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
// Every fault kind of the shared Node harness that the browser can raise; each must roll back fully.
const FAULTS=['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify','pending-save-false','pending-change'];
const SOFT=['save-false','mirror','enqueue-false','enqueue-throw'];
async function fixture(variant){
 const s=await scenario('own'),g=s.game.g;
 g.competitorOwnedRatio=.1;s.game.updateOwnershipRatios();g.shareholderTrust=60;
 g.inboundBuyoutOffers=[{id:'offer-fixture',bidderName:'Rival Holdings',offerAmount:500_000_000,premiumRate:1.3,createdWeek:g.week,expiresWeek:g.week+8,hostile:variant==='hostile',status:'pending'}];
 return {g:JSON.parse(JSON.stringify(g)),variant};
}
const pick=`(g)=>({companyCash:g.companyCash,personalCash:g.personalCash,sharesOut:g.sharesOut,founderShares:g.founderShares,shareholderTrust:g.shareholderTrust,
 founder:g.founderOwnershipRatio,external:g.externalShareholderRatio,competitor:g.competitorOwnedRatio,offers:(g.inboundBuyoutOffers||[]).map(o=>({id:o.id,status:o.status})),history:(g.companyBuyoutHistory||[]).length,simulationRng:g.simulationRng})`;
async function helpers(p){await p.evaluate(`globalThis.__peInject=(${inject.toString()});`);}
async function loaded(p,expected,label){
 const actual=await p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);
 assert.equal(actual.saveVersion,9,`${label} saveVersion`);assert.deepEqual(actual.view,expected,label);
}
async function run(browser,url,f,fault,reference){
 const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});await helpers(p);
 const proof=await p.evaluate(async({f,fault,snap,SOFT,reference})=>{
  const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(f.g),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,view=eval(snap);
  const pending=fault.startsWith('pending-'),kind=fault.replace(/^pending-/,''),normal=kind==='normal';
  await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('baseline save failed');await backend.flush();
  const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  const puts=[],basePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)puts.push(String(v));return basePut.call(this,v,k);};
  if(pending&&!e.save())throw new Error('prior pending save failed');
  const before=JSON.stringify(e.g),base=JSON.parse(before),bytes=backend.readSync(key),events=[];
  const injection=normal?{hits:()=>0,restore(){}}:__peInject(e,m,localStorage,key,kind);
  const counted=e.emit;e.emit=function(type='change',...a){events.push(type);return counted.call(this,type,...a);};
  let returned=null,error=null;
  try{returned=e.declineInboundBuyoutOffer('offer-fixture');}catch(ex){error=ex.message;}finally{e.emit=counted;injection.restore();}
  const close=(a,b)=>Math.abs(a-b)<1e-12;
  const effect=state=>{
   if(state.inboundBuyoutOffers[0].status!=='declined')throw new Error('offer not declined');
   if(f.variant==='hostile'){
    if(!close(state.competitorOwnedRatio,base.competitorOwnedRatio+.025)||!close(state.externalShareholderRatio,base.externalShareholderRatio-.025)||state.shareholderTrust!==base.shareholderTrust-2)throw new Error('hostile ownership effect');
   }else if(state.competitorOwnedRatio!==base.competitorOwnedRatio||state.externalShareholderRatio!==base.externalShareholderRatio||state.shareholderTrust!==base.shareholderTrust)throw new Error('friendly decline must not move ownership');
   if(state.founderOwnershipRatio!==base.founderOwnershipRatio)throw new Error('founder ratio must not move');
   if(!close(state.founderOwnershipRatio+state.externalShareholderRatio+state.competitorOwnedRatio,1))throw new Error('ownership ratios must sum to 1');
   for(const k of ['companyCash','personalCash','sharesOut','founderShares'])if(state[k]!==base[k])throw new Error(k+' must not move');
   if(!m.finance.validate(JSON.parse(JSON.stringify(state))).ok)throw new Error('company accounting invalid');
   return {competitor:state.competitorOwnedRatio,external:state.externalShareholderRatio,rng:JSON.stringify(state.simulationRng)};};
  let signature;
  if(normal){
   if(returned!==true||error)throw new Error('normal decline result');
   signature=effect(e.g);
   if(events.filter(x=>x==='change').length!==1||events.filter(x=>x==='saved').length!==1)throw new Error('single commit expected, events '+events.join(','));
  }else{
   if(!injection.hits())throw new Error('fault not reached');
   if(SOFT.includes(kind)?(returned!==false||error):!error)throw new Error('fault not reported '+JSON.stringify({returned,error}));
   if(JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||backend.readSync(key)!==bytes)throw new Error('live/mirror/cache rollback failed');
  }
  await backend.flush();const final=await durable();IDBObjectStore.prototype.put=basePut;
  if(final!==(normal?backend.readSync(key):bytes))throw new Error('durable mismatch');
  if(puts.length!==(normal?1:0)+(pending?1:0))throw new Error('boundary puts '+puts.length);
  let retry=null;
  if(!normal){
   if(!e.save())throw new Error('recovery save rejected');await backend.flush();
   if(JSON.parse(await durable()).inboundBuyoutOffers[0].status!=='pending')throw new Error('recovery revived the failed decline');
   if(e.declineInboundBuyoutOffer('offer-fixture')!==true)throw new Error('retry after failure');signature=effect(e.g);retry='PASS';await backend.flush();
  }
  const stored=backend.readSync(key),done=JSON.stringify(e.g);
  if(e.declineInboundBuyoutOffer('offer-fixture')!==false||JSON.stringify(e.g)!==done||backend.readSync(key)!==stored)throw new Error('second decline changed state');
  if(reference&&JSON.stringify(signature)!==JSON.stringify(reference))throw new Error('determinism: differs from the unfaulted run '+JSON.stringify({signature,reference}));
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  // Reload oracle: the production-normalized form of the committed state (as the Node harness does).
  return {expected:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g),signature,summary:{variant:f.variant,fault,hits:injection.hits(),returned,error,boundaryPuts:puts.length,retry}};
 },{f,fault,snap:pick,SOFT,reference});
 await p.reload({waitUntil:'networkidle'});await loaded(p,proof.expected,`${f.variant} ${fault} reload`);
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 await loaded(fp,proof.expected,`${f.variant} ${fault} fresh durable-only`);
 await fresh.close();await context.close();
 return proof;
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 for(const variant of ['hostile','friendly']){
  const f=await fixture(variant),reference=(await run(browser,url,f,'normal',null)).signature;
  assert.deepEqual((await run(browser,url,f,'normal',reference)).signature,reference,'same seed, same result');
  for(const fault of FAULTS){
   const proof=await run(browser,url,f,fault,reference);
   results.push({...proof.summary,reload:'PASS',freshDurableOnly:'PASS'});
   console.log(`iPhone WebKit decline buyout ${variant} ${fault} / rollback+retry / no second decline / reload / fresh real IDB PASS`);
   fs.writeFileSync(path.join(DIR,'decline-buyout-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
  }
  console.log(`iPhone WebKit decline buyout ${variant} normal x2 / single commit / ratios sum to 1 / deterministic PASS`);
 }
 fs.writeFileSync(path.join(DIR,'decline-buyout-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit decline buyout atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
