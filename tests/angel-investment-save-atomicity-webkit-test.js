'use strict';
// #954 (writer 4/4) in real iPhone WebKit + real IndexedDB: the installed personal angel investment create and
// exit move personal cash and the investment record in ONE durable commit; company cash never moves. Every
// injected save fault rolls live, mirror, cache and durable state back; the retry issues the same investment
// (same deterministic ID / RNG) or the same proceeds as an unfaulted run; a second exit is refused; reload and a
// fresh durable-only context agree.
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
const AMOUNT=1_000_000;
async function fixture(variant){
 const s=await scenario('own');s.game.g.personalCash=10_000_000;
 if(variant==='exit'){assert.equal(s.game.createAngelInvestment(AMOUNT),true,'production angel investment');s.game.g.angelInvestments.at(-1).multiple=2.5;}
 return {g:JSON.parse(JSON.stringify(s.game.g)),variant,angelID:s.game.g.angelInvestments.at(-1)?.id??null};
}
const pick=`(g)=>({companyCash:g.companyCash,personalCash:g.personalCash,simulationRng:g.simulationRng,
 angels:(g.angelInvestments||[]).map(a=>({id:a.id,startupName:a.startupName,investedAmount:a.investedAmount,multiple:a.multiple,status:a.status}))})`;
async function helpers(p){await p.evaluate(`globalThis.__peInject=(${inject.toString()});`);}
async function loaded(p,expected,label){
 const actual=await p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);
 assert.equal(actual.saveVersion,9,`${label} saveVersion`);assert.deepEqual(actual.view,expected,label);
}
async function run(browser,url,f,fault,reference){
 const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});await helpers(p);
 const proof=await p.evaluate(async({f,fault,snap,SOFT,reference,AMOUNT})=>{
  const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(f.g),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,view=eval(snap);
  const pending=fault.startsWith('pending-'),kind=fault.replace(/^pending-/,''),normal=kind==='normal';
  await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('baseline save failed');await backend.flush();
  const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  const puts=[],basePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)puts.push(String(v));return basePut.call(this,v,k);};
  if(pending&&!e.save())throw new Error('prior pending save failed');
  const before=JSON.stringify(e.g),base=JSON.parse(before),bytes=backend.readSync(key),events=[];
  const command=()=>f.variant==='create'?e.createAngelInvestment(AMOUNT):e.exitAngelInvestment(f.angelID);
  const injection=normal?{hits:()=>0,restore(){}}:__peInject(e,m,localStorage,key,kind);
  const counted=e.emit;e.emit=function(type='change',...a){events.push(type);return counted.call(this,type,...a);};
  let returned=null,error=null;
  try{returned=command();}catch(ex){error=ex.message;}finally{e.emit=counted;injection.restore();}
  const effect=state=>{
   if(state.companyCash!==base.companyCash)throw new Error('company cash must not move (personal investment)');
   if(!m.finance.validate(JSON.parse(JSON.stringify(state))).ok)throw new Error('company accounting invalid');
   if(f.variant==='create'){
    const added=state.angelInvestments.at(-1);
    if(state.personalCash!==base.personalCash-AMOUNT||state.angelInvestments.length!==base.angelInvestments.length+1||added.status!=='active'||added.investedAmount!==AMOUNT)throw new Error('create effect');
    return {id:added.id,startupName:added.startupName,rng:JSON.stringify(state.simulationRng)};
   }
   if(state.personalCash!==base.personalCash+AMOUNT*2.5||state.angelInvestments.find(a=>a.id===f.angelID).status!=='exited')throw new Error('exit effect');
   return {proceeds:state.personalCash-base.personalCash,rng:JSON.stringify(state.simulationRng)};};
  let signature;
  if(normal){
   if(returned!==true||error)throw new Error('normal angel result');
   signature=effect(e.g);
   if(JSON.stringify(events)!==JSON.stringify(['notify','saved','change']))throw new Error('single commit expected, events '+events.join(','));
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
   if(JSON.stringify(JSON.parse(await durable()).angelInvestments)!==JSON.stringify(base.angelInvestments))throw new Error('recovery revived the failed angel change');
   if(command()!==true)throw new Error('retry after failure');signature=effect(e.g);retry='PASS';await backend.flush();
  }
  if(f.variant==='exit'){const stored=backend.readSync(key),done=JSON.stringify(e.g);if(e.exitAngelInvestment(f.angelID)!==false||JSON.stringify(e.g)!==done||backend.readSync(key)!==stored)throw new Error('second exit changed state');}
  if(reference&&JSON.stringify(signature)!==JSON.stringify(reference))throw new Error('determinism: differs from the unfaulted run '+JSON.stringify({signature,reference}));
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  // Reload oracle: the production-normalized form of the committed state (as the Node harness does).
  return {expected:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g),signature,summary:{variant:f.variant,fault,hits:injection.hits(),returned,error,boundaryPuts:puts.length,retry}};
 },{f,fault,snap:pick,SOFT,reference,AMOUNT});
 await p.reload({waitUntil:'networkidle'});await loaded(p,proof.expected,`${f.variant} ${fault} reload`);
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 await loaded(fp,proof.expected,`${f.variant} ${fault} fresh durable-only`);
 await fresh.close();await context.close();
 return proof;
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 for(const variant of ['create','exit']){
  const f=await fixture(variant),reference=(await run(browser,url,f,'normal',null)).signature;
  assert.deepEqual((await run(browser,url,f,'normal',reference)).signature,reference,'same seed, same result');
  for(const fault of FAULTS){
   const proof=await run(browser,url,f,fault,reference);
   results.push({...proof.summary,reload:'PASS',freshDurableOnly:'PASS'});
   console.log(`iPhone WebKit angel ${variant} ${fault} / rollback+retry / reload / fresh real IDB PASS`);
   fs.writeFileSync(path.join(DIR,'angel-investment-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
  }
  console.log(`iPhone WebKit angel ${variant} normal x2 / single commit${variant==='exit'?' / no second exit':''} / deterministic PASS`);
 }
 fs.writeFileSync(path.join(DIR,'angel-investment-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit angel investment atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
