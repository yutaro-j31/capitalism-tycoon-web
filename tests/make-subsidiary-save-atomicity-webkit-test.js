'use strict';
// #954 (writer 3/4) in real iPhone WebKit + real IndexedDB: the installed makeSubsidiary sets the startup
// flag, adds the subsidiary record and resets the negotiated stake in ONE durable commit. Every injected save
// fault rolls live, mirror, cache and durable state back; the retry issues the same subsidiary ID (same
// deterministic RNG) as an unfaulted run; a second consolidation is refused; reload and a fresh durable-only
// context agree.
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
async function fixture(){
 const s=await scenario('own'),g=s.game.g,startup=g.startups.find(x=>x.alive!==false);
 Object.assign(startup,{ownedCompany:.6,totalInvestedCompany:30_000_000,ddNegotiatedOwnedCompany:.1,subsidiary:false,activeFundingRound:null});
 g.finance=s.modules.finance.defaultFinanceState(g);
 assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(g))).ok,true,'fixture accounting valid');
 return {g:JSON.parse(JSON.stringify(g)),startupID:startup.id};
}
const pick=`(g)=>({companyCash:g.companyCash,personalCash:g.personalCash,simulationRng:g.simulationRng,
 startups:(g.startups||[]).map(s=>({id:s.id,subsidiary:!!s.subsidiary,ownedCompany:s.ownedCompany,ddNegotiatedOwnedCompany:s.ddNegotiatedOwnedCompany})),
 subsidiaries:(g.subsidiaries||[]).map(x=>({id:x.id,startupID:x.startupID,ownership:x.ownership,carryingBookValue:x.carryingBookValue,status:x.status}))})`;
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
  try{returned=e.makeSubsidiary(f.startupID);}catch(ex){error=ex.message;}finally{e.emit=counted;injection.restore();}
  const effect=state=>{
   const startup=state.startups.find(x=>x.id===f.startupID),added=state.subsidiaries.filter(x=>x.startupID===f.startupID);
   if(!startup.subsidiary||startup.ddNegotiatedOwnedCompany!==0||state.subsidiaries.length!==base.subsidiaries.length+1||added.length!==1)throw new Error('consolidation effect');
   if(added[0].ownership!==.6||added[0].carryingBookValue!==30_000_000||added[0].status!=='active')throw new Error('subsidiary terms');
   if(state.companyCash!==base.companyCash||state.personalCash!==base.personalCash)throw new Error('cash must not move');
   if(!m.finance.validate(JSON.parse(JSON.stringify(state))).ok)throw new Error('company accounting invalid');
   return {id:added[0].id,rng:JSON.stringify(state.simulationRng)};};
  let signature;
  if(normal){
   if(returned!==true||error)throw new Error('normal makeSubsidiary result');
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
   if(JSON.parse(await durable()).startups.find(x=>x.id===f.startupID).subsidiary)throw new Error('recovery revived the failed consolidation');
   if(e.makeSubsidiary(f.startupID)!==true)throw new Error('retry after failure');signature=effect(e.g);retry='PASS';await backend.flush();
  }
  const stored=backend.readSync(key),done=JSON.stringify(e.g);
  if(e.makeSubsidiary(f.startupID)!==false||JSON.stringify(e.g)!==done||backend.readSync(key)!==stored)throw new Error('second consolidation changed state');
  if(reference&&JSON.stringify(signature)!==JSON.stringify(reference))throw new Error('determinism: subsidiary ID/RNG differ from the unfaulted run '+JSON.stringify({signature,reference}));
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  // Reload oracle: the production-normalized form of the committed state (as the Node harness does).
  return {expected:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g),signature,summary:{fault,hits:injection.hits(),returned,error,boundaryPuts:puts.length,retry}};
 },{f,fault,snap:pick,SOFT,reference});
 await p.reload({waitUntil:'networkidle'});await loaded(p,proof.expected,`${fault} reload`);
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 await loaded(fp,proof.expected,`${fault} fresh durable-only`);
 await fresh.close();await context.close();
 return proof;
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 const f=await fixture(),reference=(await run(browser,url,f,'normal',null)).signature;
 assert.deepEqual((await run(browser,url,f,'normal',reference)).signature,reference,'same seed, same subsidiary ID');
 for(const fault of FAULTS){
  const proof=await run(browser,url,f,fault,reference);
  results.push({...proof.summary,reload:'PASS',freshDurableOnly:'PASS'});
  console.log(`iPhone WebKit makeSubsidiary ${fault} / rollback+retry / no second consolidation / reload / fresh real IDB PASS`);
  fs.writeFileSync(path.join(DIR,'make-subsidiary-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
 }
 console.log('iPhone WebKit makeSubsidiary normal x2 / single commit / no second consolidation / deterministic PASS');
 fs.writeFileSync(path.join(DIR,'make-subsidiary-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit makeSubsidiary atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
