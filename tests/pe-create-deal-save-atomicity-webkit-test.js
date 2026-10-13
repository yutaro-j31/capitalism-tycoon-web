'use strict';
// #954 (writer 1/4) in real iPhone WebKit + real IndexedDB: the installed createPEDeal moves cash, creates
// the deal, posts the ledger event and syncs the PE subsidiary in ONE durable commit. Every injected save
// fault rolls live, mirror, cache and durable state back; the retry then issues the same deal (same
// deterministic RNG / ID) as an unfaulted run; reload and a fresh durable-only context agree.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {scenario}=require('./fixtures/stock-split-atomicity');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
const AMOUNT=20_000_000;
// Every fault kind of the shared Node harness that the browser can raise; each must roll back fully.
const FAULTS=['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify','pending-save-false','pending-change','normal'];
const SOFT=['save-false','mirror','enqueue-false','enqueue-throw'];
async function fixture(){const s=await scenario('own');s.game.g.personalCash=50_000_000;return JSON.parse(JSON.stringify(s.game.g));}
// Economic view compared across live, reload and fresh durable-only hydration.
const pick=`(g)=>({companyCash:g.companyCash,personalCash:g.personalCash,simulationRng:g.simulationRng,
 deals:(g.peDeals||[]).map(d=>({id:d.id,status:d.status,ownerAccount:d.ownerAccount,investedAmount:d.investedAmount,ownershipRatio:d.ownershipRatio,currentValuation:d.currentValuation,targetName:d.targetName})),
 subsidiaries:(g.subsidiaries||[]).filter(x=>x.source==='pe').map(x=>({id:x.id,peDealID:x.peDealID,ownership:x.ownership,carryingBookValue:x.carryingBookValue})),
 ledger:((g.finance||{}).transactions||[]).filter(t=>t.sourceType==='peAcquisition').map(t=>({operationID:t.operationID,cashEffect:t.cashEffect,assetEffect:t.assetEffect}))})`;
async function helpers(p){await p.evaluate(`globalThis.__peInject=(${inject.toString()});`);}
async function loaded(p,expected,label){
 const actual=await p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);
 assert.equal(actual.saveVersion,9,`${label} saveVersion`);assert.deepEqual(actual.view,expected,label);
}
async function run(browser,url,g,account,fault,reference){
 const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});await helpers(p);
 const proof=await p.evaluate(async({g,account,fault,snap,AMOUNT,SOFT,reference})=>{
  const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(g),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,view=eval(snap);
  const pending=fault.startsWith('pending-'),kind=fault.replace(/^pending-/,''),normal=kind==='normal';
  await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('baseline save failed');await backend.flush();
  const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  const puts=[],basePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)puts.push(String(v));return basePut.call(this,v,k);};
  if(pending&&!e.save())throw new Error('prior pending save failed');
  const before=JSON.stringify(e.g),base=JSON.parse(before),bytes=backend.readSync(key),events=[],emit=e.emit;
  const injection=normal?{hits:()=>0,restore(){}}:__peInject(e,m,localStorage,key,kind);
  const counted=e.emit;e.emit=function(type='change',...a){events.push(type);return counted.call(this,type,...a);};
  let returned=null,error=null;
  try{returned=e.createPEDeal('テック',AMOUNT,account);}catch(ex){error=ex.message;}finally{e.emit=counted;injection.restore();}
  const cashKey=account==='company'?'companyCash':'personalCash',other=account==='company'?'personalCash':'companyCash';
  const effect=state=>{const deal=state.peDeals.at(-1);
   if(state.peDeals.length!==base.peDeals.length+1||state[cashKey]!==base[cashKey]-AMOUNT||state[other]!==base[other])throw new Error('cash/deal effect');
   if(deal.ownerAccount!==account||deal.investedAmount!==AMOUNT||deal.status!=='active')throw new Error('deal terms');
   const ledger=(state.finance.transactions||[]).filter(t=>t.operationID===`pe-acquire-${deal.id}`),subs=state.subsidiaries.filter(x=>x.peDealID===deal.id);
   if(account==='company'?(ledger.length!==1||subs.length!==1||ledger[0].cashEffect!==-AMOUNT||ledger[0].assetEffect!==AMOUNT):(ledger.length!==0||subs.length!==0))throw new Error('ledger/subsidiary effect '+JSON.stringify({ledger:ledger.length,subs:subs.length}));
   if(!m.finance.validate(JSON.parse(JSON.stringify(state))).ok)throw new Error('company accounting invalid');
   return {id:deal.id,targetName:deal.targetName,ownershipRatio:deal.ownershipRatio,currentValuation:deal.currentValuation,rng:JSON.stringify(state.simulationRng)};};
  let signature;
  if(normal){
   if(returned!==true||error)throw new Error('normal createPEDeal result');
   signature=effect(e.g);
   if(JSON.stringify(events)!==JSON.stringify(['notify','saved','change']))throw new Error('single commit expected, events '+events.join(','));
  }else{
   if(!injection.hits())throw new Error('fault not reached');
   if(SOFT.includes(kind)?(returned!==false||error):!error)throw new Error('fault not reported '+JSON.stringify({returned,error}));
   // Post-save listener faults ('saved'/'change') are inside the transaction boundary too: full rollback.
   if(JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||backend.readSync(key)!==bytes)throw new Error('live/mirror/cache rollback failed');
  }
  await backend.flush();const final=await durable();IDBObjectStore.prototype.put=basePut;
  const committed=normal;
  if(final!==(committed?backend.readSync(key):bytes))throw new Error('durable mismatch');
  if(puts.length!==(committed?1:0)+(pending?1:0))throw new Error('boundary puts '+puts.length);
  let retry=null;
  if(!committed){
   if(!e.save())throw new Error('recovery save rejected');await backend.flush();
   if(JSON.parse(await durable()).peDeals.length!==base.peDeals.length)throw new Error('recovery revived the failed deal');
   if(e.createPEDeal('テック',AMOUNT,account)!==true)throw new Error('retry after failure');signature=effect(e.g);retry='PASS';await backend.flush();
  }
  if(reference&&JSON.stringify(signature)!==JSON.stringify(reference))throw new Error('determinism: deal differs from the unfaulted run '+JSON.stringify({signature,reference}));
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  // Reload oracle: the production-normalized form of the committed state (as the Node harness does).
  return {expected:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g),signature,summary:{account,fault,hits:injection.hits(),returned,error,boundaryPuts:puts.length,retry}};
 },{g,account,fault,snap:pick,AMOUNT,SOFT,reference});
 await p.reload({waitUntil:'networkidle'});await loaded(p,proof.expected,`${account} ${fault} reload`);
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 await loaded(fp,proof.expected,`${account} ${fault} fresh durable-only`);
 await fresh.close();await context.close();
 return proof;
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/',g=await fixture();
 for(const account of ['company','personal']){
  const reference=(await run(browser,url,g,account,'normal',null)).signature;
  const again=await run(browser,url,g,account,'normal',reference);
  assert.deepEqual(again.signature,reference,'same seed, same deal');
  for(const fault of FAULTS.filter(f=>f!=='normal')){
   const proof=await run(browser,url,g,account,fault,reference);
   results.push({...proof.summary,reload:'PASS',freshDurableOnly:'PASS'});
   console.log(`iPhone WebKit createPEDeal ${account} ${fault} / rollback+retry / reload / fresh real IDB PASS`);
   fs.writeFileSync(path.join(DIR,'pe-create-deal-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
  }
  console.log(`iPhone WebKit createPEDeal ${account} normal x2 / single commit / deterministic ID+RNG PASS`);
 }
 fs.writeFileSync(path.join(DIR,'pe-create-deal-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit createPEDeal atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
