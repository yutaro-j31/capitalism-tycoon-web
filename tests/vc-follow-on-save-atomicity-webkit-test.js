'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright'),{loadGame}=require('./harness');
const {fixture,economic,random,snapshot}=require('./fixtures/vc-follow-on-atomicity');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
async function helpers(p){await p.evaluate(`globalThis.__vcSnapshot=(${snapshot.toString()});globalThis.__vcEconomic=(${economic.toString()});globalThis.__vcInject=(${inject.toString()});`);}
async function loaded(p,expected){await helpers(p);const actual=await p.evaluate(async()=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();if(!m.saveStorageIDB.status().available)throw new Error('real IndexedDB hydration prerequisite failed '+JSON.stringify(m.saveStorageIDB.status()));return __vcEconomic(m.engine.TycoonEngine.load().g);});assert.deepEqual(actual,expected,'full production reload/fresh hydration');}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 for(const account of ['company','personal']){
  for(const fault of ['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify','pending-save-false','pending-save-throw','pending-saved','pending-change','nested-change','normal','full-normal','tail-normal']){
   const s=loadGame({headless:true,random:random()}),prepared=fixture(s.modules,account,fault.startsWith('full-')?'full':fault.startsWith('tail-')?'tail':'split');
   const f={g:JSON.parse(JSON.stringify(prepared.e.g)),id:prepared.id,amount:prepared.amount,account};
   const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});await helpers(p);
   const proof=await p.evaluate(async({fixture,fault})=>{
    const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(fixture.g),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
    const pending=fault.startsWith('pending-'),nested=fault.startsWith('nested-'),kind=fault.replace(/^(pending-|nested-|full-|tail-)/,'');
    await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed '+JSON.stringify(backend.status()));if(!e.save())throw new Error('baseline save failed');await backend.flush();
    const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
    const oldDurable=await durable(),puts=[],basePut=IDBObjectStore.prototype.put;
    if(oldDurable!==backend.readSync(key))throw new Error('real IndexedDB baseline save prerequisite failed '+JSON.stringify(backend.status()));
    IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)puts.push(String(v));return basePut.call(this,v,k);};
    if(pending&&!e.save())throw new Error('prior pending save failed');
    const before=JSON.stringify(e.g),baseline=JSON.parse(before),bytes=backend.readSync(key),injection=__vcInject(e,m,localStorage,key,kind),emit=e.emit,events=[];
    let returned=null,error=null;
    if(kind==='normal')e.emit=function(type='change',...args){events.push(type);return emit.call(this,type,...args);};
    try{returned=nested?e.runTransaction(()=>e.participateStartupFundingRound(fixture.id,fixture.amount,fixture.account)):e.participateStartupFundingRound(fixture.id,fixture.amount,fixture.account);}catch(ex){error={name:ex.name,message:ex.message,stack:ex.stack};}finally{injection.restore();}
    const isNormal=kind==='normal';
    if(isNormal){
      if(returned!==true||error||JSON.stringify(events)!==JSON.stringify(['notify','saved','change']))throw new Error('normal VC result/event order');
      const old=baseline.startups.find(x=>x.id===fixture.id),target=e.g.startups.find(x=>x.id===fixture.id),account=fixture.account,amount=fixture.amount;
      const cashKey=account==='company'?'companyCash':'personalCash',other=account==='company'?'personalCash':'companyCash',own=account==='company'?'ownedCompany':'ownedPersonal',basis=account==='company'?'totalInvestedCompany':'totalInvestedPersonal';
      const cap=account==='company'?'Company':'Personal';
      if(e.g[cashKey]!==baseline[cashKey]-amount||e.g[other]!==baseline[other]||target[basis]!==old[basis]+amount||target.activeFundingRound['contributed'+cap]!==old.activeFundingRound['contributed'+cap]+amount||target.ownedCompany!==old.ownedCompany||target.ownedPersonal!==old.ownedPersonal||target.valuation!==old.valuation||target.runwayWeeks!==old.runwayWeeks||target.fundingOpen!==old.fundingOpen)throw new Error('normal follow-on economic calculation');
      if(e.g.startupFundingHistory[fixture.id].length!==baseline.startupFundingHistory[fixture.id].length+1)throw new Error('follow-on contribution history');
      if(e.g.finance.transactions.length-baseline.finance.transactions.length!==(account==='company'?1:0)||JSON.stringify(e.g.simulationRng)!==JSON.stringify(baseline.simulationRng))throw new Error('VC accounting/RNG separation');
    }else{
      if(!injection.hits()||(['save-false','mirror','enqueue-false','enqueue-throw'].includes(kind)?returned!==false||error:!error))throw new Error('fault not reached/rejected');
      if(JSON.stringify(__vcSnapshot(e.g))!==JSON.stringify(__vcSnapshot(baseline))||localStorage.getItem(key)!==bytes||backend.readSync(key)!==bytes)throw new Error('full VC live/mirror/cache rollback failed');
    }
    await backend.flush();const final=await durable();IDBObjectStore.prototype.put=basePut;
    if(final!==(isNormal?backend.readSync(key):bytes)){
      const expected=isNormal?backend.readSync(key):bytes,sequence=raw=>{try{return JSON.parse(raw).saveSequence;}catch{return null;}};
      let firstDifference=0;while(firstDifference<Math.min(final?.length||0,expected?.length||0)&&final[firstDifference]===expected[firstDifference])firstDifference++;
      throw new Error('durable VC mismatch '+JSON.stringify({fault,account:fixture.account,status:backend.status(),expectedSequence:sequence(expected),actualSequence:sequence(final),putSequences:puts.map(sequence),expectedLength:expected?.length,actualLength:final?.length,firstDifference,expectedFragment:expected?.slice(firstDifference,firstDifference+160),actualFragment:final?.slice(firstDifference,firstDifference+160)}));
    }
    if(puts.length!==(isNormal?1:pending?1:0)||(!isNormal&&puts.some(raw=>JSON.parse(raw).startups.find(x=>x.id===fixture.id).totalInvestedCompany!==baseline.startups.find(x=>x.id===fixture.id).totalInvestedCompany||JSON.parse(raw).startups.find(x=>x.id===fixture.id).totalInvestedPersonal!==baseline.startups.find(x=>x.id===fixture.id).totalInvestedPersonal)))throw new Error('failed candidate queued or predecessor lost');
    if(!isNormal){if(!e.save())throw new Error('recovery save rejected');await backend.flush();if(JSON.stringify(__vcSnapshot(__vcEconomic(e.g)))!==JSON.stringify(__vcSnapshot(__vcEconomic(baseline))))throw new Error('recovery revived failed VC follow-on investment');}
    if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw new Error('company accounting invalid');
    if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
    const expected=__vcEconomic(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g);
    if(JSON.stringify(__vcSnapshot(__vcEconomic(m.engine.TycoonEngine.load().g)))!==JSON.stringify(__vcSnapshot(expected)))throw new Error('production load mismatch');
    return {fault,account:fixture.account,hits:injection.hits(),returned,error,pending,boundaryPuts:puts.length,priorSequence:JSON.parse(oldDurable).saveSequence,boundarySequence:JSON.parse(final).saveSequence,expected};
   },{fixture:f,fault});
   await p.reload({waitUntil:'networkidle'});await loaded(p,proof.expected);
   const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
   const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});await loaded(fp,proof.expected);
   const {expected,...metadata}=proof;results.push({...metadata,reload:'PASS',freshDurableOnly:'PASS'});console.log(`iPhone WebKit VC follow-on investment ${account} ${fault} / reload / fresh real IDB PASS`);
   fs.writeFileSync(path.join(DIR,'vc-follow-on-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
   await fresh.close();await context.close();
  }
 }
 fs.writeFileSync(path.join(DIR,'vc-follow-on-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));console.log('iPhone WebKit VC follow-on investment atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
