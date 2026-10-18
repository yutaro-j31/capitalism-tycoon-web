'use strict';
// #955 (7C) in real iPhone WebKit + real IndexedDB through the REAL legacy-tab flow ("新会社創業" -> modal ->
// "創業する") on the booted production app. Refounding replaces the whole game state inside the SAME root
// object: the app engine's state root (held before the tap) stays the live, rendered and saved root after a
// success AND after a rollback. One tap = one commit (one change, one durable put) with the pe-fund
// founded-investment record; personal holdings carry over, the sold company's debt does not. Every applicable
// harness fault, including a prior pending put, rolls live, mirror, cache and durable state back into the same
// root; thrown faults open the production recovery dialog; the retry produces the unfaulted state. Reload and a
// fresh durable-only context agree. The success toast appears only after the commit (once on success, never for a
// rolled-back founding); a throwing notify listener therefore runs after the commit and leaves the founding saved.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {scenario}=require('./fixtures/stock-split-atomicity');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
const FAULTS=['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','pending-save-false','pending-change'];
// The success toast is emitted after the outermost commit, so its listener fault is a post-commit case, not a rollback.
const POST_COMMIT_FAULTS=['notify'];
const SOFT=['save-false','mirror','enqueue-false','enqueue-throw'];
const INVESTMENT=50_000_000,NAME='新会社WebKit';
async function fixture(){
 const s=await scenario('own'),g=s.game.g;
 assert.equal(s.game.createAngelInvestment(1_000_000),true,'personal angel holding to carry over');
 g.personalCash=200_000_000;
 const target=g.startups.find(x=>x.alive&&!x.subsidiary&&!x.ipoStockID&&x.minTicket<=100_000_000);
 assert.ok(target,'personal VC fixture target');
 assert.equal(s.game.investStartup(target.id,Math.max(20_000_000,target.minTicket),'personal'),true,'real personal VC stake');
 assert.notEqual(s.game.borrow(5_000_000,'company'),false,'production company borrowing (ledger-backed debt)');assert.ok(g.companyDebt>0);
 Object.assign(g,{isCompanySold:true,personalCash:200_000_000,companyName:'旧会社',selectedTab:'legacy'});
 assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(g))).ok,true,'sold-company fixture is ledger-valid');
 return JSON.parse(JSON.stringify(g));
}
const pick=`(g)=>({companyName:g.companyName,isCompanySold:g.isCompanySold,configured:g.configured,week:g.week,companyCash:g.companyCash,personalCash:g.personalCash,
 companyDebt:g.companyDebt,personalDebt:g.personalDebt,currentCompanyFoundedInvestment:g.currentCompanyFoundedInvestment,serialCompanyCount:g.serialCompanyCount,
 angels:(g.angelInvestments||[]).map(a=>a.id),vc:g.startups.filter(s=>s.ownedPersonal>0).map(s=>({id:s.id,name:s.name,ownedPersonal:s.ownedPersonal,ownedCompany:s.ownedCompany,totalInvestedPersonal:s.totalInvestedPersonal})),personalStocks:g.personalStocks,pastCompanyRecords:(g.pastCompanyRecords||[]).length,simulationRng:g.simulationRng})`;
async function boot(context,url,g){
 const p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});
 await p.evaluate(async g=>{const m=__capitalismTycoonModules,key=m.engine.SAVE_KEY;await m.saveStorageIDB.hydrate();if(!m.saveStorageIDB.status().available)throw new Error('real IndexedDB prerequisite failed');
  const saved=m.saveStorage.saveWithAdapter({g},{key});if(!saved.ok)throw saved.error||new Error('seed save failed');await saved.flush();},g);
 await p.reload({waitUntil:'networkidle'});
 await p.locator('[data-action="new-company"]').first().waitFor({state:'visible',timeout:20_000});
 await p.evaluate(`globalThis.__peInject=(${inject.toString()});`);
 return p;
}
async function arm(p,fault){
 return p.evaluate(async({fault})=>{
  const m=__capitalismTycoonModules,e=m.playerEngineBridge.getEngine(),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
  if(!e||!e.g.isCompanySold)throw new Error('app engine is not a sold company');
  await backend.flush();
  const pending=fault.startsWith('pending-'),kind=fault.replace(/^pending-/,'');
  // Hold the state root and the engine BEFORE the tap, as any long-lived browser reference would.
  const w=globalThis.__refound={puts:[],events:[],kind,pending,basePut:IDBObjectStore.prototype.put,root:e.g,engine:e};
  IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)w.puts.push(String(v));return w.basePut.call(this,v,k);};
  if(pending&&!e.save())throw new Error('prior pending save failed');
  w.before=JSON.stringify(e.g);w.bytes=backend.readSync(key);
  w.injection=kind==='normal'?{hits:()=>0,restore(){}}:__peInject(e,m,localStorage,key,kind);
  const emit=e.emit;w.emit=emit;e.emit=function(type='change',...a){w.events.push(type==='notify'?'notify:'+a[0]?.severity:type);return emit.call(this,type,...a);};
  return true;
 },{fault});
}
async function refound(p){
 await p.locator('[data-action="new-company"]').first().tap();
 await p.locator('#new-company-name').fill(NAME);await p.locator('#new-company-investment').fill(String(INVESTMENT));await p.locator('#new-company-mode').selectOption('store');
 await p.locator('#new-company-ok').tap();await p.waitForTimeout(80);
}
async function settle(p){
 return p.evaluate(async({snap,INVESTMENT,NAME})=>{
  const m=__capitalismTycoonModules,backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,w=globalThis.__refound,e=w.engine,view=eval(snap);
  e.emit=w.emit;w.injection.restore();// counter first, then the injector (it restores the original emit)
  await backend.flush();IDBObjectStore.prototype.put=w.basePut;
  const durable=await new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  const normal=w.kind==='normal'||w.kind==='notify',base=JSON.parse(w.before),g=e.g;
  // Root identity: the held root is still the engine's state, the bridge's state, and what gets saved.
  if(g!==w.root||m.playerEngineBridge.getEngine()!==e||m.playerEngineBridge.getEngine().g!==w.root)throw new Error('state root identity lost');
  // Rendered game state = the page without transient toasts. The success toast is emitted only after the commit:
  // once (after the change event) for a committed founding, never for a rolled-back one.
  const page=document.body.cloneNode(true);for(const t of page.querySelectorAll('.toast'))t.remove();
  const text=page.innerText,successToasts=[...document.querySelectorAll('.toast')].filter(t=>t.innerText.includes(NAME)).length;
  const successNotices=w.events.filter(x=>x==='notify:success').length;
  if(w.kind==='normal'&&(successNotices!==1||w.events.lastIndexOf('notify:success')<w.events.indexOf('change')||successToasts!==1))throw new Error('one success toast after the commit ('+w.events.join(',')+'; toasts '+successToasts+')');
  if(w.kind==='notify'&&(successNotices!==1||w.events.lastIndexOf('notify:success')<w.events.indexOf('change')||successToasts!==0))throw new Error('the throwing toast listener runs after the commit ('+w.events.join(',')+')');
  if(!normal&&(successNotices!==0||successToasts!==0))throw new Error('no success toast for a rolled-back founding ('+w.events.join(',')+'; toasts '+successToasts+')');
  if(normal){
   if(g.companyName!==NAME||g.isCompanySold!==false||g.companyCash!==INVESTMENT||g.personalCash!==base.personalCash-INVESTMENT)throw new Error('refounding effect');
   if(g.currentCompanyFoundedInvestment!==INVESTMENT)throw new Error('founded-investment record missing from the commit');
   if(g.companyDebt!==0)throw new Error('sold company debt must not carry into the new company');
   if(g.personalDebt!==base.personalDebt||JSON.stringify(g.angelInvestments.map(a=>a.id))!==JSON.stringify(base.angelInvestments.map(a=>a.id))||JSON.stringify(g.personalStocks)!==JSON.stringify(base.personalStocks))throw new Error('personal holdings must carry over unchanged');
   for(const old of base.startups.filter(s=>s.ownedPersonal>0)){
    const retained=g.startups.filter(s=>s.id===old.id);
    if(retained.length!==1||retained[0].name!==old.name||retained[0].ownedPersonal!==old.ownedPersonal||retained[0].ownedCompany!==0||retained[0].totalInvestedPersonal!==old.totalInvestedPersonal||retained[0].totalInvestedCompany!==0)throw new Error('P1 #1008 personal VC ownership/source identity lost or company stake transferred');
   }
   if(g.pastCompanyRecords.length<base.pastCompanyRecords.length)throw new Error('company history lost');
   if(w.events.filter(x=>x==='change').length!==1)throw new Error('one tap must commit once (change events '+w.events.join(',')+')');
   if(durable!==backend.readSync(key)||JSON.parse(durable).companyName!==NAME)throw new Error('durable must hold the committed new company');
   if(w.puts.length!==1+(w.pending?1:0))throw new Error('boundary puts '+w.puts.length);
   if(w.kind==='normal'&&!text.includes(NAME))throw new Error('rendered app must show the new company');
   if(w.kind==='notify'&&!w.injection.hits())throw new Error('toast listener fault not reached through the UI');
  }else{
   if(!w.injection.hits())throw new Error('fault not reached through the UI');
   // Order-insensitive state equality (the in-place rebuild may reorder keys; values must be identical),
   // as the Node harness's deepEqual; the stored bytes must be byte-identical.
   const canon=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(key=>[key,x[key]])):x);
   if(canon(g)!==canon(JSON.parse(w.before))||localStorage.getItem(key)!==w.bytes||backend.readSync(key)!==w.bytes||durable!==w.bytes)throw new Error('live/mirror/cache/durable rollback into the same root failed');
   if(w.puts.length!==(w.pending?1:0))throw new Error('failed candidate queued: '+w.puts.length);
   if(text.includes(NAME))throw new Error('rendered game state must not show the rolled-back company');
  }
  // The sold company (every rollback) and, since #968, the newly founded company must be ledger-valid; the new
  // company's next 13 weekly closes must also pass.
  const validation=m.finance.validate(JSON.parse(JSON.stringify(g)));
  if(!validation.ok)throw new Error((normal?'new company':'company after rollback')+' accounting invalid '+JSON.stringify(validation.errors));
  let closedWeeks=null;
  if(normal){const probe=new m.engine.TycoonEngine(JSON.parse(JSON.stringify(g))),start=probe.g.week;probe.save=()=>true;
   for(let i=0;i<13;i++){if(probe.advanceWeek(false)===false)throw new Error('new company week '+(probe.g.week+1)+' refused');const v=m.finance.validate(JSON.parse(JSON.stringify(probe.g)));if(!v.ok)throw new Error('new company week '+probe.g.week+' accounting '+JSON.stringify(v.errors));}
   closedWeeks=`${start+1}-${probe.g.week}`;}
  if(key!=='capitalism_tycoon_web_v1'||g.saveVersion!==9)throw new Error('save identity');
  return {live:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(g))).g),hits:w.injection.hits(),puts:w.puts.length,newCompanyLedgerValid:normal?validation.ok:null,closedWeeks,successToasts,successNotices,changeEvents:w.events.filter(x=>x==='change').length};
 },{snap:pick,INVESTMENT,NAME});
}
const recoveryDialog=p=>p.locator('#runtime-recovery-root [role="dialog"]');
async function surfaced(p,fault){
 const kind=fault.replace(/^pending-/,''),shown=await recoveryDialog(p).count();
 if(SOFT.includes(kind)){assert.equal(shown,0,`${fault}: soft failure must not open the recovery dialog`);return 'in-app';}
 assert.equal(shown,1,`${fault}: thrown failure must open the production recovery dialog`);
 await p.locator('[data-runtime-recovery-action="close"]').first().tap();await p.waitForTimeout(50);
 assert.equal(await recoveryDialog(p).count(),0,`${fault}: recovery dialog closes`);return 'recovery-dialog';
}
async function durableView(p){return p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);}
async function check(browser,context,url,p,expected,label,round=null){
 const retained=async page=>{if(round)assert.equal(await page.evaluate(({id})=>__capitalismTycoonModules.playerEngineBridge.getEngine().g.startups.find(s=>s.id===id).activeFundingRound.contributedPersonal,round),round.amount,`${label} pending personal contribution`);};
 await p.reload({waitUntil:'networkidle'});const r=await durableView(p);assert.equal(r.saveVersion,9);assert.deepEqual(r.view,expected,`${label} reload`);
 await retained(p);
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 const d=await durableView(fp);assert.deepEqual(d.view,expected,`${label} fresh durable-only`);await retained(fp);await fresh.close();
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB / real legacy-tab flow');const url='http://127.0.0.1:'+server.address().port+'/',g=await fixture();
 // #1027: reject incomplete personally funded rounds through the installed UI,
 // retaining the malformed old-v9 evidence rather than inventing a repair.
 for(const defect of ['missing-close','post-money']){
  const context=await browser.newContext(options),p=await boot(context,url,g);
  const before=await p.evaluate(async defect=>{
   const m=__capitalismTycoonModules,e=m.playerEngineBridge.getEngine(),st=e.g.startups.find(s=>s.ownedPersonal>0);
   st.fundingOpen=true;if(!e.openStartupFundingRound(st))throw Error('round opening');
   const amount=Math.min(1_000_000,e.getStartupFundingRoundPlan(st.id).personal.remaining/2);
   if(!e.participateStartupFundingRound(st.id,amount,'personal'))throw Error('subscription');
   if(defect==='missing-close')delete st.activeFundingRound.closesWeek;else st.activeFundingRound.postMoneyValuation++;
   if(e.getStartupFundingRoundPlan(st.id)!==null)throw Error('malformed fixture accepted');
   if(!e.save())throw Error('legacy fixture save');await m.saveStorageIDB.flush();
   globalThis.__invalidRoundRoot=e.g;
   return {json:JSON.stringify(e.g),bytes:m.saveStorageIDB.readSync(m.engine.SAVE_KEY),id:st.id,amount};
  },defect);
  await refound(p);
  await p.evaluate(async before=>{
   const m=__capitalismTycoonModules,e=m.playerEngineBridge.getEngine();await m.saveStorageIDB.flush();
   if(e.g!==globalThis.__invalidRoundRoot||JSON.stringify(e.g)!==before.json)throw Error('rejected round changed state/RNG/root');
   if(m.saveStorageIDB.readSync(m.engine.SAVE_KEY)!==before.bytes||localStorage.getItem(m.engine.SAVE_KEY)!==before.bytes)throw Error('rejected round replaced save');
  },before);
  const expected=await p.evaluate(snap=>eval(snap)(__capitalismTycoonModules.playerEngineBridge.getEngine().g),pick);
  await check(browser,context,url,p,expected,'invalid '+defect,{id:before.id,amount:before.amount});
  results.push({fault:'invalid-round-'+defect,rootIdentity:'PASS',unchanged:'PASS',reload:'PASS',freshDurableOnly:'PASS'});
  console.log(`#1027 ${defect} rejected via iPhone WebKit UI / unchanged root/assets/RNG/save / real IDB reload/fresh hydration PASS`);
  await context.close();
 }
 let reference=null;
 for(const run of [1,2]){
  const context=await browser.newContext(options),p=await boot(context,url,g);
  await arm(p,'normal');await refound(p);const proof=await settle(p);
  assert.equal(await recoveryDialog(p).count(),0,'normal refounding opens no recovery dialog');
  if(reference)assert.deepEqual(proof.live,reference,'same save + same input = same new company');else reference=proof.live;
  await check(browser,context,url,p,proof.live,`normal #${run}`);
  results.push({fault:'normal',run,changeEvents:proof.changeEvents,puts:proof.puts,newCompanyLedgerValid:proof.newCompanyLedgerValid,rootIdentity:'PASS',reload:'PASS',freshDurableOnly:'PASS'});
  console.log(`iPhone WebKit refounding normal #${run} / root identity / one commit / founded investment / reload / fresh real IDB PASS`);
  await context.close();
 }
 for(const fault of FAULTS){
  const context=await browser.newContext(options),p=await boot(context,url,g);
  await arm(p,fault);await refound(p);const failed=await settle(p),surface=await surfaced(p,fault);
  // Retry through the same UI with the same held root: identical to the unfaulted refounding.
  await arm(p,'normal');await refound(p);const retried=await settle(p);
  assert.deepEqual(retried.live,reference,`${fault}: retry equals the unfaulted refounding`);
  await check(browser,context,url,p,retried.live,fault);
  results.push({fault,hits:failed.hits,surface,successToasts:failed.successToasts,successNotices:failed.successNotices,puts:failed.puts,rootIdentity:'PASS',retry:'PASS',reload:'PASS',freshDurableOnly:'PASS'});
  console.log(`iPhone WebKit refounding ${fault} / rollback into the same root / no success toast / retry deterministic / reload / fresh real IDB PASS`);
  fs.writeFileSync(path.join(DIR,'found-new-company-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
  await context.close();
 }
 // A throwing success-toast listener: the founding has already committed (one change, one durable put) and reloads.
 for(const fault of POST_COMMIT_FAULTS){
  const context=await browser.newContext(options),p=await boot(context,url,g);
  await arm(p,fault);await refound(p);const proof=await settle(p),surface=await surfaced(p,fault);
  assert.deepEqual(proof.live,reference,`${fault}: the committed founding equals the unfaulted refounding`);
  await check(browser,context,url,p,proof.live,fault);
  results.push({fault,hits:proof.hits,surface,successNotices:proof.successNotices,changeEvents:proof.changeEvents,puts:proof.puts,committed:'PASS',reload:'PASS',freshDurableOnly:'PASS'});
  console.log(`iPhone WebKit refounding ${fault} listener fault after the commit / founding saved / reload / fresh real IDB PASS`);
  await context.close();
 }
 fs.writeFileSync(path.join(DIR,'found-new-company-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit found new company atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
