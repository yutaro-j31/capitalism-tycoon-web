'use strict';
// #971 in real iPhone WebKit + real IndexedDB: with a VC or an M&A subsidiary (built in Node with production
// writers up to week 12), the week-13 quarter close commits with valid accounting and no subsidiary dividend.
// Every injected save fault rolls live, mirror, cache and durable state back; the retry reaches the same cash,
// RNG and retainedEarnings as an unfaulted run; the normal run keeps closing quarters up to week 26; reload and a
// fresh durable-only context agree.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {eveState}=require('./fixtures/subsidiary-quarter-close');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
// A week commits as change (inside the transaction) -> saved -> week and never emits notify, so the harness's
// post-commit 'change' / 'notify' kinds do not apply; 'saved' is the post-commit event fault for a week.
const FAULTS=['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','pending-save-false','pending-save-throw'];
const SOFT=['save-false','mirror','enqueue-false','enqueue-throw'];
const pick=`(g)=>({week:g.week,companyCash:g.companyCash,personalCash:g.personalCash,simulationRng:g.simulationRng,
 subsidiaries:(g.subsidiaries||[]).map(x=>({id:x.id,ownership:x.ownership,carryingBookValue:x.carryingBookValue,retainedEarnings:x.retainedEarnings})),
 maSubsidiaries:(g.maSubsidiaries||[]).map(x=>({id:x.id,acquisitionPrice:x.acquisitionPrice,retainedEarnings:x.retainedEarnings})),
 subsidiaryDividends:((g.finance||{}).transactions||[]).filter(t=>t.sourceType!=='listedSubsidiaryDividend'&&/subsidiaryDividend|subsDividend/i.test(String(t.sourceType||''))).length})`;
async function helpers(p){await p.evaluate(`globalThis.__peInject=(${inject.toString()});`);}
async function loaded(p,expected,label){
 const actual=await p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);
 assert.equal(actual.saveVersion,9,`${label} saveVersion`);assert.deepEqual(actual.view,expected,label);
}
async function run(browser,url,f,fault,reference){
 const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});await helpers(p);
 const proof=await p.evaluate(async({f,fault,snap,SOFT,reference})=>{
  const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(JSON.parse(f.state)),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,view=eval(snap);
  const pending=fault.startsWith('pending-'),kind=fault.replace(/^pending-/,''),normal=kind==='normal';
  if(e.g.week!==12)throw new Error('fixture is not the week-12 quarter eve');
  await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('baseline save failed');await backend.flush();
  const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  const puts=[],basePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)puts.push(String(v));return basePut.call(this,v,k);};
  if(pending&&!e.save())throw new Error('prior pending save failed');
  const before=JSON.stringify(e.g),base=JSON.parse(before),bytes=backend.readSync(key),events=[];
  const injection=normal?{hits:()=>0,restore(){}}:__peInject(e,m,localStorage,key,kind);
  const counted=e.emit;e.emit=function(type='change',...a){events.push(type);return counted.call(this,type,...a);};
  let returned=null,error=null;
  try{returned=e.advanceWeek(false);}catch(ex){error=ex.message;}finally{e.emit=counted;injection.restore();}
  const sub=state=>(f.kind==='vc'?state.subsidiaries:state.maSubsidiaries).find(x=>x.id===f.subsidiaryID);
  const quarter=state=>{
   if(state.week!==13)throw new Error('quarter week did not commit: '+state.week);
   const check=m.finance.validate(JSON.parse(JSON.stringify(state)));if(!check.ok)throw new Error('quarter accounting invalid '+JSON.stringify(check.errors));
   if(view(state).subsidiaryDividends!==0)throw new Error('subsidiary dividend booked');
   const prior=sub(base),now=sub(state);
   if(Math.abs(now.retainedEarnings-(prior.retainedEarnings+now.weeklyProfit))>1e-6)throw new Error('retainedEarnings deducted');
   for(const k of ['ownership','carryingBookValue','investedCost','acquisitionPrice'])if(now[k]!==prior[k])throw new Error(k+' changed');
   return {cash:state.companyCash,rng:JSON.stringify(state.simulationRng),retainedEarnings:now.retainedEarnings};};
  let signature;
  if(normal){
   if(returned===false||error)throw new Error('normal quarter close result '+JSON.stringify({returned,error}));
   signature=quarter(e.g);
   if(JSON.stringify(events)!==JSON.stringify(['change','saved','week']))throw new Error('single week commit expected, events '+events.join(','));
  }else{
   if(!injection.hits())throw new Error('fault not reached');
   if(SOFT.includes(kind)?(returned!==false||error):!error)throw new Error('fault not reported '+JSON.stringify({returned,error}));
   if(JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||backend.readSync(key)!==bytes)throw new Error('live/mirror/cache rollback failed');
  }
  await backend.flush();const final=await durable();IDBObjectStore.prototype.put=basePut;
  if(final!==(normal?backend.readSync(key):bytes))throw new Error('durable mismatch');
  if(puts.length!==(normal?1:0)+(pending?1:0))throw new Error('boundary puts '+puts.length);
  let retry=null,quarters=null;
  if(!normal){
   if(!e.save())throw new Error('recovery save rejected');await backend.flush();
   if(JSON.parse(await durable()).week!==12)throw new Error('recovery revived the failed week');
   if(e.advanceWeek(false)===false)throw new Error('retry after failure');signature=quarter(e.g);retry='PASS';await backend.flush();
  }else{
   // Quarters keep closing: run on to the week-26 close, every week valid, never a subsidiary dividend.
   while(e.g.week<26){if(e.advanceWeek(false)===false)throw new Error('week '+(e.g.week+1)+' refused');
    const check=m.finance.validate(JSON.parse(JSON.stringify(e.g)));if(!check.ok)throw new Error('week '+e.g.week+' accounting '+JSON.stringify(check.errors));
    if(view(e.g).subsidiaryDividends!==0)throw new Error('subsidiary dividend booked at week '+e.g.week);}
   quarters='13,26';await backend.flush();
  }
  if(reference&&JSON.stringify(signature)!==JSON.stringify(reference))throw new Error('determinism: quarter result differs from the unfaulted run '+JSON.stringify({signature,reference}));
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  return {expected:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g),signature,summary:{kind:f.kind,fault,hits:injection.hits(),returned,error,boundaryPuts:puts.length,retry,quarters}};
 },{f,fault,snap:pick,SOFT,reference});
 await p.reload({waitUntil:'networkidle'});await loaded(p,proof.expected,`${f.kind} ${fault} reload`);
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 await loaded(fp,proof.expected,`${f.kind} ${fault} fresh durable-only`);
 await fresh.close();await context.close();
 return proof;
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];const out=path.join(DIR,'subsidiary-quarter-close-result.json');try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 for(const kind of ['vc','ma']){
  const state=eveState(kind),g=JSON.parse(state),f={kind,state,subsidiaryID:(kind==='vc'?g.subsidiaries:g.maSubsidiaries).at(-1).id};
  const first=await run(browser,url,f,'normal',null),reference=first.signature;
  assert.deepEqual((await run(browser,url,f,'normal',reference)).signature,reference,`${kind}: same seed, same quarter close`);
  results.push(first.summary);
  for(const fault of FAULTS){
   const proof=await run(browser,url,f,fault,reference);
   results.push({...proof.summary,reload:'PASS',freshDurableOnly:'PASS'});
   console.log(`iPhone WebKit ${kind} subsidiary quarter close ${fault} / rollback+retry / reload / fresh real IDB PASS`);
   fs.writeFileSync(out,JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
  }
  console.log(`iPhone WebKit ${kind} subsidiary quarter close normal x2 / weeks 13-26 / single commit / no dividend / deterministic PASS`);
 }
 fs.writeFileSync(out,JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit subsidiary quarter close PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
