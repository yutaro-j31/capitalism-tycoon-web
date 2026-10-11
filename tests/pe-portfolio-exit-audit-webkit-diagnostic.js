'use strict';
// Unregistered diagnostic only; real browser/IDB prerequisites are assertions.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright'),{inject}=require('./fixtures/pe-fund-acquisition-faults');
const {summary,find,clone}=require('./pe-portfolio-exit-audit-diagnostic');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.WRITER_AUDIT_DIR||'artifacts/pe-portfolio-exit-audit');
const f=JSON.parse(fs.readFileSync(path.join(DIR,'fixture.json'),'utf8'));
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
async function helpers(p){await p.evaluate(`globalThis.__auditClone=(${clone.toString()});globalThis.find=(${find.toString()});globalThis.clone=__auditClone;globalThis.__auditSummary=(${summary.toString()});globalThis.__auditInject=(${inject.toString()});`);}
async function loaded(p){await helpers(p);return p.evaluate(async(f)=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();if(!m.saveStorageIDB.status().available)throw new Error('real IDB unavailable');return __auditSummary(m.engine.TycoonEngine.load().g,f);},f);}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();const version=browser.version(),url='http://127.0.0.1:'+server.address().port+'/';console.log('Actual WebKit '+version+' / iPhone13 / real IndexedDB');
 for(const route of ['engine','adapter'])for(const method of ['sale','ipo'])for(const fault of route==='adapter'?['normal','save-false','mirror','save-throw']:['normal','save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','pending-save-false','pending-save-throw']){
  const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});await helpers(p);
  const proof=await p.evaluate(async({f,method,fault,route})=>{
   const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(__auditClone(f.g)),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
   await backend.hydrate();if(!backend.status().available)throw new Error('real IDB prerequisite failed '+JSON.stringify(backend.status()));
   if(e.previewPEPortfolioExit(f.fundID,f.portfolioID,{method}).ok!==true)throw new Error('normal fixture ineligible');
   const read=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(backend.DB_NAME,backend.DB_VERSION);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction(backend.STORE_NAME,'readonly').objectStore(backend.STORE_NAME).get(key);q.onerror=()=>reject(q.error);q.onsuccess=()=>{const v=q.result;db.close();resolve(v);};};});
   if(e.save()!==true)throw new Error('baseline save rejected');await backend.flush();const old=await read();if(old!==backend.readSync(key))throw new Error('baseline durable mismatch');
   const pending=fault.startsWith('pending-'),kind=fault.replace(/^pending-/,''),before=__auditClone(e.g);if(pending&&e.save()!==true)throw new Error('predecessor rejected');
   const injection=kind==='normal'?{hits:()=>0,restore(){}}:__auditInject(e,m,localStorage,key,kind);let returned,error;
   try{if(route==='adapter'){m.playerEngineBridge.bindEngine(e);returned=m.peUIAdapter.performPortfolio('exit',{fundID:f.fundID,dealID:f.portfolioID,method});}else returned=e.exitPEPortfolioCompany(f.fundID,f.portfolioID,{method});}catch(ex){error={message:ex.message,stack:ex.stack};}finally{injection.restore();}
   if(kind!=='normal'&&injection.hits()===0)throw new Error('fault unreachable');
   const live=__auditClone(e.g),mirror=localStorage.getItem(key),cache=backend.readSync(key);await backend.flush();const durable=await read(),reload=__auditSummary(m.engine.TycoonEngine.load().g,f);
   return{route,method,fault,pending,returned,error,hits:injection.hits(),before:__auditSummary(before,f),after:__auditSummary(live,f),liveRestored:JSON.stringify(live)===JSON.stringify(before),rngUnchanged:JSON.stringify(before.simulationRng)===JSON.stringify(live.simulationRng),ledgerUnchanged:JSON.stringify(before.finance)===JSON.stringify(live.finance),mirrorBaseline:mirror===old,cacheBaseline:cache===old,durableBaseline:durable===old,reload,beforeFull:before,liveFull:live,baselineBytes:old,mirrorBytes:mirror,cacheBytes:cache,durableBytes:durable};
  },{f,method,fault,route});
  await p.reload({waitUntil:'networkidle'});proof.pageReload=await loaded(p);
  const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
  const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});proof.freshDurableOnly=await loaded(fp);await fresh.close();
  // Restore the original post-fault LIVE snapshot, then a later healthy save: no load normalization repair.
  await p.evaluate(async(g)=>{const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(g);if(e.save()!==true)throw new Error('recovery save failed');await m.saveStorageIDB.flush();},proof.liveFull);
  await p.reload({waitUntil:'networkidle'});proof.recoveryPageReload=await loaded(p);
  const recoveredState=await context.storageState({indexedDB:true});for(const origin of recoveredState.origins)origin.localStorage=[];
  const recovered=await browser.newContext({...options,storageState:recoveredState}),rp=await recovered.newPage();await rp.goto(url,{waitUntil:'networkidle'});proof.recoveryFreshDurableOnly=await loaded(rp);await recovered.close();
  fs.writeFileSync(path.join(DIR,'webkit-'+route+'-'+method+'-'+fault+'.json'),JSON.stringify(proof,null,2));
  const{beforeFull,liveFull,baselineBytes,mirrorBytes,cacheBytes,durableBytes,...metadata}=proof;results.push(metadata);console.log(JSON.stringify({method,fault,returned:proof.returned,error:proof.error?.message,liveRestored:proof.liveRestored,personalCashDelta:proof.after.personalCash-proof.before.personalCash,flushStatus:proof.reload.status,recoveryStatus:proof.recoveryFreshDurableOnly.status}));
  fs.writeFileSync(path.join(DIR,'webkit-result.json'),JSON.stringify({version,physicalDevice:false,device:'iPhone13',realIndexedDB:true,complete:false,results},null,2));await context.close();
 }
 fs.writeFileSync(path.join(DIR,'webkit-result.json'),JSON.stringify({version,physicalDevice:false,device:'iPhone13',realIndexedDB:true,complete:true,results},null,2));
 assert.ok(results.filter(x=>x.fault!=='normal').every(x=>x.liveRestored),'RED: failed real-WebKit exit must restore full live state');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
