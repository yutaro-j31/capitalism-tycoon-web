'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright'),{loadGame}=require('./harness');
const {prepareAcceptedPE,economic,makeRandom,linkHistoryRows,fillHistoryCaps}=require('./fixtures/pe-fund-acquisition-atomicity');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
async function helpers(p){await p.evaluate(`globalThis.__peEconomic=(${economic.toString()});globalThis.__peLinkHistory=(${linkHistoryRows.toString()});globalThis.__peFillHistory=(${fillHistoryCaps.toString()});globalThis.__peInject=(${inject.toString()});`);}
async function loaded(p,expected){await helpers(p);const actual=await p.evaluate(async()=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();return __peEconomic(m.engine.TycoonEngine.load().g);});assert.deepEqual(actual,expected,'full production reload/fresh hydration');}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();const url='http://127.0.0.1:'+server.address().port+'/';
 for(const co of [false,true]){
  const s=loadGame({headless:true,random:makeRandom()}),prepared=prepareAcceptedPE(s.modules,co);
  const fixture={g:JSON.parse(JSON.stringify(prepared.e.g)),fundID:prepared.fundID,dealID:prepared.dealID,targetID:prepared.targetID,price:prepared.price,coinvest:co};
  for(const fault of ['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify','pending-save-false','pending-change','lp-save-false','lp-change','nested-save-false','capped-change','capped-save-false','normal','lp-normal']){
   const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});await helpers(p);
   const proof=await p.evaluate(async({fixture,fault})=>{
    const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(fixture.g),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
    const pending=fault.startsWith('pending-'),lp=fault.startsWith('lp-'),nested=fault.startsWith('nested-'),capped=fault.startsWith('capped-'),kind=fault.replace(/^(pending-|lp-|nested-|capped-)/,'');
    if(lp){const f=e.g.peFirm.funds.find(x=>x.id===fixture.fundID);if(!m.peFund.addLPCommitment(f,{lpTypeID:'universitySovereign',committedAmount:1000000,promiseAccepted:true}))throw new Error('LP fixture failed');e.g.acquisitionTargets.find(x=>x.id===fixture.targetID).peTierID='largeCap';}
    if(capped)__peFillHistory(e.g,fixture.dealID);
    await backend.hydrate();if(!e.save())throw new Error('baseline save failed');await backend.flush();
    const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
    const oldDurable=await durable(),puts=[],basePut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)puts.push(String(v));return basePut.call(this,v,k);};
    if(pending&&!e.save())throw new Error('prior pending save failed');
    __peLinkHistory(e.g);
    const before=JSON.stringify(e.g),baseline=JSON.parse(before),bytes=backend.readSync(key),injection=__peInject(e,m,localStorage,key,kind),emit=e.emit,events=[];
    let returned=null,error=null;
    if(kind==='normal')e.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
    try{returned=nested?e.runTransaction(()=>e.closeMADeal(fixture.dealID)):e.closeMADeal(fixture.dealID);}catch(ex){error={name:ex.name,message:ex.message,stack:ex.stack};}finally{injection.restore();}
    const isNormal=kind==='normal';
    if(isNormal){
      if(returned!==true||error||JSON.stringify(events)!==JSON.stringify(['notify','saved','change']))throw new Error('normal PE result/event order');
      const oldFund=baseline.peFirm.funds.find(x=>x.id===fixture.fundID),fund=e.g.peFirm.funds.find(x=>x.id===fixture.fundID),plan=m.peFund.planDealFinancing(oldFund,fixture.price,fixture.coinvest),holding=fund.deals.at(-1);
      if(lp&&fund.lps.find(x=>x.lpTypeID==='universitySovereign').promiseFulfilled!==false)throw new Error('LP outcome not committed');
      if(fund.cash!==oldFund.cash-plan.fundPortion||fund.coinvestCommitted!==oldFund.coinvestCommitted+plan.coinvestPortion||holding.acquisitionPrice!==fixture.price||holding.investedAmount!==plan.fundPortion+plan.coinvestPortion)throw new Error('normal PE allocation');
      if(e.g.companyCash!==baseline.companyCash||e.g.personalCash!==baseline.personalCash||JSON.stringify(e.g.finance)!==JSON.stringify(baseline.finance)||JSON.stringify(e.g.simulationRng)!==JSON.stringify(baseline.simulationRng))throw new Error('account/finance/RNG separation');
      const completed=JSON.stringify(e.g),stored=backend.readSync(key);if(e.closeMADeal(fixture.dealID)!==false||JSON.stringify(e.g)!==completed||backend.readSync(key)!==stored)throw new Error('duplicate PE close changed state');
    }else{
      if(!injection.hits()||(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)?returned!==false||error:!error))throw new Error('fault not reached/rejected');
      if(JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||backend.readSync(key)!==bytes)throw new Error('full PE live/mirror/cache rollback failed');
    }
    await backend.flush();const final=await durable();IDBObjectStore.prototype.put=basePut;
    if(final!==(isNormal?backend.readSync(key):bytes))throw new Error('durable PE mismatch');
    if(puts.length!==(isNormal?1:pending?1:0)||(!isNormal&&puts.some(raw=>JSON.parse(raw).maDealRooms.find(x=>x.id===fixture.dealID).status!=='accepted')))throw new Error('failed candidate queued or predecessor lost');
    if(!isNormal){if(!e.save())throw new Error('recovery save rejected');await backend.flush();if(JSON.parse(await durable()).maDealRooms.find(x=>x.id===fixture.dealID).status!=='accepted')throw new Error('recovery revived failed PE acquisition');}
    if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw new Error('company accounting invalid');
    if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
    const expected=__peEconomic(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g);
    if(JSON.stringify(__peEconomic(m.engine.TycoonEngine.load().g))!==JSON.stringify(expected))throw new Error('production load mismatch');
    return {fault,coinvest:fixture.coinvest,hits:injection.hits(),returned,error,pending,boundaryPuts:puts.length,priorSequence:JSON.parse(oldDurable).saveSequence,boundarySequence:JSON.parse(final).saveSequence,expected};
   },{fixture,fault});
   await p.reload({waitUntil:'networkidle'});await loaded(p,proof.expected);
   const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
   const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});await loaded(fp,proof.expected);
   const {expected,...metadata}=proof;results.push({...metadata,reload:'PASS',freshDurableOnly:'PASS'});console.log(`iPhone WebKit PE acquisition ${co?'coinvest':'fund-only'} ${fault} / reload / fresh real IDB PASS`);
   await fresh.close();await context.close();
  }
 }
 fs.writeFileSync(path.join(DIR,'pe-fund-acquisition-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));console.log('iPhone WebKit PE fund acquisition atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
