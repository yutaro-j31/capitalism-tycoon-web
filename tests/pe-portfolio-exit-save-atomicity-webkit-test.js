'use strict';
// PE-PORTFOLIO-EXIT-ATOMICITY-001: real iPhone WebKit + real IndexedDB proof that a rejected or throwing
// save rolls a PE portfolio Exit back on the installed engine route, survives reload and a fresh
// durable-only browser context. Economics are not asserted beyond "unchanged on failure / committed on success".
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright'),{loadGame}=require('./harness');
const {prepareAcceptedPE,makeRandom}=require('./fixtures/pe-fund-acquisition-atomicity');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
const clone=x=>JSON.parse(JSON.stringify(x));
function makeFixture(){
  const s=loadGame({headless:true,random:makeRandom()}),p=prepareAcceptedPE(s.modules,true);
  assert.equal(p.e.closeMADeal(p.dealID),true,'actual accepted PE acquisition closes');
  const fund=p.e.g.peFirm.funds.find(x=>x.id===p.fundID),deal=fund.deals.at(-1);
  assert.ok(deal.portfolioCompany&&deal.status==='active');
  p.e.g.week=deal.acquiredWeek+156;deal.portfolioCompany.improvementScore=67;
  for(const method of ['sale','ipo'])assert.equal(p.e.previewPEPortfolioExit(fund.id,deal.id,{method}).ok,true,'eligible '+method);
  return{g:clone(p.e.g),fundID:fund.id,portfolioID:deal.id};
}
async function helpers(p){await p.evaluate(`globalThis.__peInject=(${inject.toString()});`);}
const snapshot=`(g,f)=>{const fund=g.peFirm.funds.find(x=>x.id===f.fundID),deal=fund.deals.find(x=>x.id===f.portfolioID);return{status:deal.status,personalCash:g.personalCash,distributed:fund.distributed,fundCash:fund.cash};}`;
async function loaded(p,f,expected){await helpers(p);const actual=await p.evaluate(async({f,snap})=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();return eval(snap)(m.engine.TycoonEngine.load().g,f);},{f,snap:snapshot});assert.deepEqual(actual,expected,'full production reload/fresh hydration');}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();const url='http://127.0.0.1:'+server.address().port+'/',f=makeFixture();
 for(const method of ['sale','ipo'])for(const fault of ['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','pending-save-false','pending-change','normal']){
  const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});await helpers(p);
  const proof=await p.evaluate(async({f,method,fault,snap})=>{
   const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(f.g),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,pick=eval(snap);
   const pending=fault.startsWith('pending-'),kind=fault.replace(/^pending-/,''),isNormal=kind==='normal';
   await backend.hydrate();if(!e.save())throw new Error('baseline save failed');await backend.flush();
   const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
   const oldDurable=await durable(),puts=[],basePut=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)puts.push(String(v));return basePut.call(this,v,k);};
   if(pending&&!e.save())throw new Error('prior pending save failed');
   const before=JSON.stringify(e.g),baseline=JSON.parse(before),bytes=backend.readSync(key),before0=pick(baseline,f);
   const injection=isNormal?{hits:()=>0,restore(){}}:__peInject(e,m,localStorage,key,kind);
   let returned=null,error=null;
   try{returned=e.exitPEPortfolioCompany(f.fundID,f.portfolioID,{method});}catch(ex){error={name:ex.name,message:ex.message};}finally{injection.restore();}
   if(isNormal){
    if(returned!==true||error)throw new Error('normal PE Exit result');
    const after=pick(e.g,f);if(after.status!=='exited'||e.g.companyCash!==baseline.companyCash||JSON.stringify(e.g.simulationRng)!==JSON.stringify(baseline.simulationRng))throw new Error('normal PE Exit effect');
    const stored=backend.readSync(key),completed=JSON.stringify(e.g);if(e.exitPEPortfolioCompany(f.fundID,f.portfolioID,{method})!==false||JSON.stringify(e.g)!==completed||backend.readSync(key)!==stored)throw new Error('duplicate Exit changed state');
   }else{
    if(!injection.hits()||(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)?returned!==false||error:!error))throw new Error('fault not reached/rejected');
    if(JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||backend.readSync(key)!==bytes)throw new Error('full PE Exit live/mirror/cache rollback failed');
   }
   await backend.flush();const final=await durable();IDBObjectStore.prototype.put=basePut;
   if(final!==(isNormal?backend.readSync(key):bytes))throw new Error('durable PE Exit mismatch');
   if(puts.length!==(isNormal?1:pending?1:0))throw new Error('failed candidate queued or predecessor lost: '+puts.length);
   if(!isNormal){if(!e.save())throw new Error('recovery save rejected');await backend.flush();const rec=JSON.parse(await durable());if(pick(rec,f).status!=='active')throw new Error('recovery revived failed PE Exit');}
   if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw new Error('company accounting invalid');
   if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
   return{expected:pick(e.g,f),before:before0,summary:{method,fault,hits:injection.hits(),returned,error,boundaryPuts:puts.length}};
  },{f,method,fault,snap:snapshot});
  if(fault==='normal')assert.equal(proof.expected.status,'exited');else assert.deepEqual(proof.expected,proof.before,'failed Exit leaves fund/personal state untouched');
  await p.reload({waitUntil:'networkidle'});await loaded(p,f,proof.expected);
  const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
  const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});await loaded(fp,f,proof.expected);
  results.push({...proof.summary,reload:'PASS',freshDurableOnly:'PASS'});console.log(`iPhone WebKit PE portfolio Exit ${method} ${fault} / reload / fresh real IDB PASS`);
  await fresh.close();await context.close();
 }
 fs.writeFileSync(path.join(DIR,'pe-portfolio-exit-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));console.log('iPhone WebKit PE portfolio Exit atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
