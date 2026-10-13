'use strict';
// #966 in real iPhone WebKit + real IndexedDB, with a listed subsidiary built in Node through production writers
// (VC subsidiary -> IPO preparation -> IPO at week 17) and advanced to week 25:
// - the week-26 quarter commits the market catch-up and the listed dividend once, inside the week; every injected
//   save fault rolls live, mirror, cache and durable state back and the retry matches the unfaulted run;
// - the committed quarter survives the real app: a reload (load / normalize), opening the venture tab in the real
//   UI (the listed-subsidiary market and portfolio sections render) and re-rendering it change no economic state,
//   and the next week then closes (before the fix that week failed P2-CLOSE-WEEKLY-CASH / P2-CLOSE-BS-IDENTITY);
// - a fresh durable-only context hydrates the same state.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {listedState}=require('./fixtures/subsidiary-quarter-close');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
// A week commits as change (inside the transaction) -> saved -> week and never emits notify, so the harness's
// post-commit 'change' / 'notify' kinds do not apply; 'saved' is the post-commit event fault for a week.
const FAULTS=['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','pending-save-false','pending-save-throw'];
const SOFT=['save-false','mirror','enqueue-false','enqueue-throw'];
// Economic state a render or a load must never change.
const pick=`(g)=>{const s=(g.subsidiaries||[]).find(x=>x.publicCompany)||{};return {week:g.week,companyCash:g.companyCash,simulationRng:g.simulationRng,
 transactions:((g.finance||{}).transactions||[]).length,
 listedDividends:((g.finance||{}).transactions||[]).filter(t=>t.sourceType==='listedSubsidiaryDividend').map(t=>t.operationID+':'+t.cashEffect),
 subsidiaryDividends:((g.finance||{}).transactions||[]).filter(t=>t.sourceType!=='listedSubsidiaryDividend'&&/subsidiaryDividend|subsDividend/i.test(String(t.sourceType||''))).length,
 market:{index:s.marketPriceIndex,valuation:s.valuation,listing:s.marketListingValuation,book:s.carryingBookValue,lastWeek:s.marketLastWeek,lastDividendWeek:s.lastDividendWeek,received:s.parentDividendsReceived}};}`;
async function helpers(p){await p.evaluate(`globalThis.__peInject=(${inject.toString()});`);}
async function loaded(p,expected,label){
 const actual=await p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);
 assert.equal(actual.saveVersion,9,`${label} saveVersion`);assert.deepEqual(actual.view,expected,`${label} (load is economically read-only)`);
}
async function run(browser,url,state,fault,reference){
 const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});await helpers(p);
 const proof=await p.evaluate(async({state,fault,snap,SOFT,reference})=>{
  const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(JSON.parse(state)),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,view=eval(snap);
  const pending=fault.startsWith('pending-'),kind=fault.replace(/^pending-/,''),normal=kind==='normal';
  if(e.g.week!==25)throw new Error('fixture is not the week-25 quarter eve');
  await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('baseline save failed');await backend.flush();
  const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  const puts=[],basePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)puts.push(String(v));return basePut.call(this,v,k);};
  if(pending&&!e.save())throw new Error('prior pending save failed');
  const before=JSON.stringify(e.g),bytes=backend.readSync(key),events=[];
  const injection=normal?{hits:()=>0,restore(){}}:__peInject(e,m,localStorage,key,kind);
  const counted=e.emit;e.emit=function(type='change',...a){events.push(type);return counted.call(this,type,...a);};
  let returned=null,error=null;
  try{returned=e.advanceWeek(false);}catch(ex){error=ex.message;}finally{e.emit=counted;injection.restore();}
  const quarter=g=>{
   if(g.week!==26)throw new Error('quarter week did not commit: '+g.week);
   const check=m.finance.validate(JSON.parse(JSON.stringify(g)));if(!check.ok)throw new Error('quarter accounting invalid '+JSON.stringify(check.errors));
   const v=view(g);if(v.subsidiaryDividends!==0)throw new Error('#971 subsidiary dividend booked');
   if(v.market.lastWeek!==26||v.market.lastDividendWeek!==26)throw new Error('market not settled inside the week '+JSON.stringify(v.market));
   if(v.listedDividends.filter(x=>x.includes('-26:')).length!==1)throw new Error('listed dividend must be booked exactly once '+JSON.stringify(v.listedDividends));
   return {cash:g.companyCash,rng:JSON.stringify(g.simulationRng),dividends:v.listedDividends,index:v.market.index};};
  let signature;
  if(normal){
   if(returned===false||error)throw new Error('normal quarter result '+JSON.stringify({returned,error}));
   signature=quarter(e.g);
   if(JSON.stringify(events)!==JSON.stringify(['change','saved','week']))throw new Error('single week commit expected, events '+events.join(','));
   // The module render paths, three times over, leave the committed quarter untouched.
   const frozen=JSON.stringify(view(e.g)),tab=e.g.selectedTab;e.g.selectedTab='venture';
   for(let i=0;i<3;i++){m.listedSubsidiaryMarket.renderSection(e);m.listedSubsidiaryMarket.allSnapshots(e.g);m.listedSubsidiaryPortfolioDashboard?.renderSection?.(e);}
   e.g.selectedTab=tab;if(JSON.stringify(view(e.g))!==frozen)throw new Error('render changed economic state');
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
   if(JSON.parse(await durable()).week!==25)throw new Error('recovery revived the failed week');
   if(e.advanceWeek(false)===false)throw new Error('retry after failure');signature=quarter(e.g);retry='PASS';await backend.flush();
  }
  if(reference&&JSON.stringify(signature)!==JSON.stringify(reference))throw new Error('determinism: quarter differs from the unfaulted run '+JSON.stringify({signature,reference}));
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  return {expected:view(e.g),signature,summary:{fault,hits:injection.hits(),returned,error,boundaryPuts:puts.length,retry}};
 },{state,fault,snap:pick,SOFT,reference});
 // Reload: the real app boots from the durable save (load / normalize) and nothing economic changes. For the
 // normal run the app's own engine is checked first (a second TycoonEngine.load() would take over the UI bridge).
 await p.reload({waitUntil:'networkidle'});if(fault!=='normal')await loaded(p,proof.expected,`${fault} reload`);
 let ui=null;
 if(fault==='normal'){
  // Open the venture tab in the real UI and re-render it; then the app advances the next week.
  const before=await p.evaluate(snap=>eval(snap)(__capitalismTycoonModules.playerEngineBridge.getEngine().g),pick);
  assert.deepEqual(before,proof.expected,'normal reload: the app booted the committed quarter unchanged (load is economically read-only)');
  await p.evaluate(()=>{const tab=document.querySelector('[data-action="tab"][data-tab="venture"]');if(!tab)throw new Error('venture tab button missing');tab.click();});
  await p.locator('[data-listed-subsidiary-market]').first().waitFor({state:'attached',timeout:20000});
  ui=await p.evaluate(snap=>{const app=__capitalismTycoonModules.playerEngineBridge.getEngine();
   const sections=document.querySelectorAll('[data-listed-subsidiary-market]').length;
   for(let i=0;i<3;i++)app.emit('change');
   const view=JSON.parse(JSON.stringify(eval(snap)(app.g)));let error=null,result=null;// copy: advanceWeek mutates simulationRng in place
   try{result=app.advanceWeek(false);}catch(ex){error=ex.message;}
   const check=__capitalismTycoonModules.finance.validate(JSON.parse(JSON.stringify(app.g)));
   return {sections,tab:app.g.selectedTab,afterRender:view,result:result===false?false:true,error,week:app.g.week,valid:check.ok,errors:check.errors};},pick);
  assert.equal(ui.tab,'venture');assert.ok(ui.sections>=1,'listed-subsidiary market section rendered in the venture tab');
  assert.deepEqual(ui.afterRender,proof.expected,'opening and re-rendering the venture tab changed no economic state');
  assert.equal(ui.error,null,'the week after a quarter-week render closes');assert.equal(ui.result,true);assert.equal(ui.week,27);assert.equal(ui.valid,true,JSON.stringify(ui.errors));
 }
 const storage=await context.storageState({indexedDB:true});for(const origin of storage.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:storage}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 if(fault!=='normal')await loaded(fp,proof.expected,`${fault} fresh durable-only`);
 else{const g=await fp.evaluate(async()=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {week:g.week,valid:m.finance.validate(JSON.parse(JSON.stringify(g))).ok,saveVersion:g.saveVersion};});
  assert.deepEqual(g,{week:27,valid:true,saveVersion:9},'fresh durable-only context hydrates the committed week 27');}
 await fresh.close();await context.close();
 return {...proof,ui};
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];const out=path.join(DIR,'listed-subsidiary-quarter-close-result.json');try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 const state=listedState();
 const first=await run(browser,url,state,'normal',null),reference=first.signature;
 assert.deepEqual((await run(browser,url,state,'normal',reference)).signature,reference,'same seed, same quarter');
 results.push({...first.summary,ui:first.ui});
 console.log('iPhone WebKit listed subsidiary quarter normal x2 / dividend once in-week / render x3 read-only / reload read-only / venture tab UI / week 27 closes / deterministic PASS');
 for(const fault of FAULTS){
  const proof=await run(browser,url,state,fault,reference);
  results.push({...proof.summary,reload:'PASS',freshDurableOnly:'PASS'});
  console.log(`iPhone WebKit listed subsidiary quarter ${fault} / rollback+retry / reload / fresh real IDB PASS`);
  fs.writeFileSync(out,JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
 }
 fs.writeFileSync(out,JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit listed subsidiary quarter close PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
