'use strict';
// #955 (7B) in real iPhone WebKit + real IndexedDB through the REAL market-tab button ("決算イベントを確認",
// data-action="force-earnings"), tapped on the booted production app: one tap = one earnings event, one
// commit (one 'change' event, one durable put) and the simulation-RNG draws persisted with it. A rejected or
// throwing save rolls live, mirror, cache and durable state (RNG included) back; the next tap then produces
// exactly the state an unfaulted tap produces (deterministic). Reload and a fresh durable-only context agree.
// 'notify' is not raised by this writer (see the Node test) and is not exercised here.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {scenario}=require('./fixtures/stock-split-atomicity');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
const FAULTS=['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change'];
const SOFT=['save-false','mirror','enqueue-false','enqueue-throw'];
async function fixture(){
 const s=await scenario('own'),g=s.game.g;
 Object.assign(g,{shareholderTrust:55,activistPressure:20,earningsGuidanceRevenue:1_000_000,earningsGuidanceProfit:100_000,lastEarningsAnnouncementWeek:0,selectedTab:'market'});
 g.lastReport={...(g.lastReport||{}),week:g.week,sales:2_000_000,profit:300_000};
 return JSON.parse(JSON.stringify(g));
}
const pick=`(g)=>({week:g.week,stockPrice:g.stockPrice,shareholderTrust:g.shareholderTrust,activistPressure:g.activistPressure,lastEarningsAnnouncementWeek:g.lastEarningsAnnouncementWeek,
 earningsEventLog:g.earningsEventLog,earningsGuidanceRevenue:g.earningsGuidanceRevenue,earningsGuidanceProfit:g.earningsGuidanceProfit,simulationRng:g.simulationRng,companyCash:g.companyCash,personalCash:g.personalCash})`;
async function boot(context,url,g){
 const p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});
 // Seed through the production save path, then boot the real app from it.
 await p.evaluate(async g=>{const m=__capitalismTycoonModules,key=m.engine.SAVE_KEY;await m.saveStorageIDB.hydrate();if(!m.saveStorageIDB.status().available)throw new Error('real IndexedDB prerequisite failed');
  const saved=m.saveStorage.saveWithAdapter({g},{key});if(!saved.ok)throw saved.error||new Error('seed save failed');await saved.flush();},g);
 await p.reload({waitUntil:'networkidle'});

 await p.locator('[data-action="force-earnings"]').first().waitFor({state:'visible',timeout:20_000});
 await p.evaluate(`globalThis.__peInject=(${inject.toString()});`);
 return p;
}
async function durableView(p){
 return p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);
}
async function arm(p,fault){
 // Instrument the app's own engine instance (the one the button dispatches to).
 return p.evaluate(async({fault})=>{
  const m=__capitalismTycoonModules,e=m.playerEngineBridge.getEngine(),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
  if(!e||e.g.selectedTab!=='market')throw new Error('app engine not on the market tab');
  await backend.flush();
  const pending=fault.startsWith('pending-'),kind=fault.replace(/^pending-/,'');
  const w=globalThis.__forceEarnings={puts:[],events:[],kind,pending,basePut:IDBObjectStore.prototype.put};
  IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)w.puts.push(String(v));return w.basePut.call(this,v,k);};
  if(pending&&!e.save())throw new Error('prior pending save failed');
  w.before=JSON.stringify(e.g);w.bytes=backend.readSync(key);
  w.injection=kind==='normal'?{hits:()=>0,restore(){}}:__peInject(e,m,localStorage,key,kind);
  const emit=e.emit;w.emit=emit;e.emit=function(type='change',...a){w.events.push(type);return emit.call(this,type,...a);};
  return true;
 },{fault});
}
async function settle(p,{SOFT,snap}){
 return p.evaluate(async({SOFT,snap})=>{
  const m=__capitalismTycoonModules,e=m.playerEngineBridge.getEngine(),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,w=globalThis.__forceEarnings,view=eval(snap);
  e.emit=w.emit;w.injection.restore();// counter first, then the injector (it restores the original emit)
  await backend.flush();IDBObjectStore.prototype.put=w.basePut;
  const durable=await new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  const normal=w.kind==='normal',base=JSON.parse(w.before);
  if(normal){
   if(e.g.earningsEventLog.length!==base.earningsEventLog.length+1||e.g.lastEarningsAnnouncementWeek!==base.week)throw new Error('one tap must produce exactly one earnings event '+JSON.stringify({before:base.earningsEventLog.length,after:e.g.earningsEventLog.length,week:base.week,last:e.g.lastEarningsAnnouncementWeek,events:w.events}));
   if(JSON.stringify(e.g.simulationRng)===JSON.stringify(base.simulationRng))throw new Error('earnings draws must consume state-held simulation RNG');
   if(w.events.filter(x=>x==='change').length!==1)throw new Error('one tap must commit once (change events '+w.events.join(',')+')');
   if(durable!==backend.readSync(key)||JSON.stringify(JSON.parse(durable).simulationRng)!==JSON.stringify(e.g.simulationRng))throw new Error('RNG draws must be durable with the commit');
   if(w.puts.length!==1+(w.pending?1:0))throw new Error('boundary puts '+w.puts.length);
  }else{
   if(!w.injection.hits())throw new Error('fault not reached through the UI');
   if(JSON.stringify(e.g)!==w.before||localStorage.getItem(key)!==w.bytes||backend.readSync(key)!==w.bytes||durable!==w.bytes)throw new Error('live/mirror/cache/durable rollback failed (RNG included)');
   if(w.puts.length!==(w.pending?1:0))throw new Error('failed candidate queued: '+w.puts.length);
  }
  if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw new Error('company accounting invalid');
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  return {live:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g),hits:w.injection.hits(),puts:w.puts.length,changeEvents:w.events.filter(x=>x==='change').length};
 },{SOFT,snap});
}
async function tap(p){await p.locator('[data-action="force-earnings"]').first().tap();await p.waitForTimeout(50);}
const recoveryDialog=p=>p.locator('#runtime-recovery-root [role="dialog"]');
// A throwing save surfaces as an uncaught UI error: the production recovery dialog must open (the player is
// told, the save is not touched); the player closes it and can tap again. Soft failures stay in-app.
async function surfaced(p,fault){
 const kind=fault.replace(/^pending-/,''),shown=await recoveryDialog(p).count();
 if(SOFT.includes(kind)){assert.equal(shown,0,`${fault}: soft failure must not open the recovery dialog`);return 'in-app';}
 assert.equal(shown,1,`${fault}: thrown failure must open the production recovery dialog`);
 await p.locator('[data-runtime-recovery-action="close"]').first().tap();await p.waitForTimeout(50);
 assert.equal(await recoveryDialog(p).count(),0,`${fault}: recovery dialog closes`);return 'recovery-dialog';
}
async function check(browser,context,url,p,expected,label){
 await p.reload({waitUntil:'networkidle'});const r=await durableView(p);assert.equal(r.saveVersion,9);assert.deepEqual(r.view,expected,`${label} reload`);
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 const d=await durableView(fp);assert.deepEqual(d.view,expected,`${label} fresh durable-only`);await fresh.close();
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB / real button tap');const url='http://127.0.0.1:'+server.address().port+'/',g=await fixture();
 let reference=null;
 for(const run of [1,2]){
  const context=await browser.newContext(options),p=await boot(context,url,g);
  await arm(p,'normal');await tap(p);const proof=await settle(p,{SOFT,snap:pick});
  assert.equal(await recoveryDialog(p).count(),0,'normal tap opens no recovery dialog');
  const log=await p.locator('.news-line').allInnerTexts();
  assert.ok(log.some(x=>x===proof.live.earningsEventLog[0]),'rendered earnings log shows the committed event');
  if(reference)assert.deepEqual(proof.live,reference,'same seed + one tap = same committed state');else reference=proof.live;
  await check(browser,context,url,p,proof.live,`normal #${run}`);
  results.push({fault:'normal',run,changeEvents:proof.changeEvents,puts:proof.puts,reload:'PASS',freshDurableOnly:'PASS'});
  console.log(`iPhone WebKit force-earnings tap normal #${run} / one event / one commit / RNG durable / reload / fresh real IDB PASS`);
  await context.close();
 }
 for(const fault of [...FAULTS,'pending-save-false','pending-change']){
  const context=await browser.newContext(options),p=await boot(context,url,g);
  await arm(p,fault);await tap(p);const failed=await settle(p,{SOFT,snap:pick}),surface=await surfaced(p,fault);
  // Retry with a second tap: identical to an unfaulted tap (rolled-back RNG is reused deterministically).
  await arm(p,'normal');await tap(p);const retried=await settle(p,{SOFT,snap:pick});
  assert.deepEqual(retried.live,reference,`${fault}: retry tap equals the unfaulted tap`);
  await check(browser,context,url,p,retried.live,fault);
  results.push({fault,hits:failed.hits,surface,puts:failed.puts,retry:'PASS',reload:'PASS',freshDurableOnly:'PASS'});
  console.log(`iPhone WebKit force-earnings tap ${fault} / full rollback / retry tap deterministic / reload / fresh real IDB PASS`);
  fs.writeFileSync(path.join(DIR,'force-earnings-ui-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
  await context.close();
 }
 fs.writeFileSync(path.join(DIR,'force-earnings-ui-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,notExercised:{notify:'writer never emits notify (Node probe)'},results},null,2));
 console.log('iPhone WebKit force-earnings UI atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
