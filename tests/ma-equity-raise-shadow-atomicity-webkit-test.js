'use strict';
// Audit follow-up to D3, in real iPhone WebKit + real IndexedDB: the M&A acquisition-financing shadow-state boundary
// (installed chain: board approval → financing shadow boundary → deal-room base) with a ¥20M public equity raise,
// treasury 50,000 and a 20% competitor stake. Node counterpart: tests/ma-equity-raise-shadow-atomicity-test.js.
//  1. save accepted, then throws: closeMADeal returns false; live, localStorage mirror, IDB cache and durable IDB keep
//     the pre-closing bytes (the accepted closing payload is withdrawn; its IDB put never lands). No fork.
//  2. the success `notify` emit throws after the save: same consistent rollback (gap G1 in the Node test header:
//     the notice is inside the rollback region, unlike the #955 after-commit notice pattern).
//  3. a throwing addEventListener('notify') listener: DOM dispatch reports, not rethrows, listener errors, so the
//     closing commits once; live = mirror = cache = durable.
// Then the committed ratios (founder 700k, competitor 190k, external 80k over 970k; sum 1), reload and a fresh
// durable-only context agree with live.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
const pick=`(g)=>({sharesOut:g.sharesOut,treasury:g.treasuryBuybackShares,founderShares:g.founderShares,founder:g.founderOwnershipRatio,competitor:g.competitorOwnedRatio,external:g.externalShareholderRatio,companyCash:g.companyCash,companyDebt:g.companyDebt,subsidiaries:g.maSubsidiaries.length,equityRows:g.finance.transactions.filter(t=>t.sourceType==='maPublicEquityRaise').length})`;
async function view(p){return p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');
 const url='http://127.0.0.1:'+server.address().port+'/',context=await browser.newContext(options),p=await context.newPage(),pageErrors=[];
 p.on('pageerror',e=>pageErrors.push(String(e?.message||e)));
 await p.goto(url,{waitUntil:'networkidle'});
 const proof=await p.evaluate(async snap=>{
  const m=__capitalismTycoonModules,key=m.engine.SAVE_KEY,e=new m.engine.TycoonEngine(),view=eval(snap);
  e.g=m.engine.createInitialState({configured:true,seed:934017,companyName:'Equity raise shadow WebKit',playerName:'Owner'});
  Object.assign(e.g,{week:24,companyCash:500000000,companyDebt:0,companyCredit:90,publicCompany:true,stockPrice:1000,sharesOut:1000000,founderShares:700000,treasuryBuybackShares:50000,competitorOwnedRatio:.2,
   reports:[{week:23,sales:20000000,expenses:2000000,profit:6000000}]});
  e.g.lastReport=e.g.reports[0];e.g.finance=m.finance.defaultFinanceState(e.g);
  e.g.acquisitionTargets=[{id:'eq-target',name:'Equity target',valuation:80000000,sales:120000000,operatingProfit:15000000,growth:.1,risk:.1,synergy:.12,activeDealID:'eq-deal'}];
  e.g.maDealRooms=[{id:'eq-deal',targetID:'eq-target',status:'accepted',diligenceLevel:'full',diligenceConfidence:.94,acceptedTerms:{method:'friendly',finalPrice:100000000,acceptedWeek:23,closingDeadlineWeek:28,offerRound:1},history:[]}];
  e.normalize();await m.saveStorageIDB.hydrate();if(!m.saveStorageIDB.status().available)throw new Error('real IndexedDB prerequisite failed');
  if(!e.selectMAAcquisitionFinancing('eq-deal',{presetID:'custom',cashAmount:40000000,termLoanAmount:40000000,bridgeLoanAmount:0,requestedEquityAmount:20000000,termWeeks:104,bridgeWeeks:26})||!e.approveMAClosing('eq-deal')||!e.save())throw new Error('baseline failed');await m.saveStorageIDB.flush();
  const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  const cases=[];
  async function rejected(name,arm){
   const before=JSON.stringify(e.g),bytes=localStorage.getItem(key),cache=m.saveStorageIDB.readSync(key),prior=await durable(),disarm=arm();let result,thrown=null;
   try{result=e.closeMADeal('eq-deal');}catch(error){thrown=String(error?.message||error);}finally{disarm.restore();}
   const sync={live:JSON.stringify(e.g)===before,mirror:localStorage.getItem(key)===bytes,cache:m.saveStorageIDB.readSync(key)===cache};
   await m.saveStorageIDB.flush();const after=await durable();
   const row={name,hits:disarm.hits(),accepted:disarm.accepted?.()??null,result,thrown,...sync,durable:after===prior,durableEqualsCache:after===m.saveStorageIDB.readSync(key)};
   cases.push(row);
   if(!row.hits||result!==false||thrown||!row.live||!row.mirror||!row.cache||!row.durable||!row.durableEqualsCache)throw new Error(name+' was not rolled back consistently '+JSON.stringify(row));
  }
  // 1. save accepted (mirror + IDB cache written, put queued), then throws.
  await rejected('save-throw',()=>{const save=e.save;let hits=0,accepted=false;e.save=function(...args){const r=save.apply(this,args);if(!this.inTransaction()){hits++;accepted=r===true&&localStorage.getItem(key).includes('maPublicEquityRaise');throw new Error('save accepted then threw');}return r;};return {hits:()=>hits,accepted:()=>accepted,restore(){e.save=save;}};});
  if(!cases[0].accepted)throw new Error('save-throw did not reach an accepted closing save');
  let alreadyClosed=false;
  // 2. the success notice emit throws after the accepted save: NOT a contract (G1). Only the no-fork invariant is
  //    checked: rolled back everywhere (today) or committed once (after a #955-style fix); live, mirror, cache, durable agree.
  // Economic projection compared between live and the persisted payload (and the pre-closing state when rolled back).
  const econ=g=>JSON.stringify({...view(g),deal:(g.maDealRooms||[]).find(x=>x.id==='eq-deal')?.status,tx:g.finance.transactions.length,loans:(g.finance.loans||[]).length,surplus:g.finance.balances.capitalSurplus,rng:g.simulationRng});
  const preClosing=econ(e.g);
  {const emit=e.emit;let hits=0;e.emit=function(type='change',...args){if(type==='notify'&&!this.inTransaction()){hits++;throw new Error('notify emit threw');}return emit.call(this,type,...args);};
   let result,thrown=false;try{result=e.closeMADeal('eq-deal');}catch(_){thrown=true;}finally{e.emit=emit;}
   await m.saveStorageIDB.flush();const d=await durable(),c=m.saveStorageIDB.readSync(key),closed=e.g.maDealRooms.find(x=>x.id==='eq-deal').status==='acquired';
   if(!hits||d!==c||localStorage.getItem(key)!==c||closed!==c.includes('maPublicEquityRaise')||(!thrown&&result!==closed))throw new Error('notify-emit-throw forked '+JSON.stringify({hits,result,thrown,closed}));
   const liveEcon=econ(e.g),storedEcon=econ(JSON.parse(c));
   if(liveEcon!==storedEcon)throw new Error('notify-emit-throw: live economic state differs from the persisted state '+JSON.stringify({liveEcon,storedEcon}));
   if(!closed&&liveEcon!==preClosing)throw new Error('notify-emit-throw: partial rollback '+JSON.stringify({liveEcon,preClosing}));
   cases.push({name:'notify-emit-throw (non-contract)',hits,result,thrown,closed,noFork:true});
   alreadyClosed=closed;}
  // 3. a throwing UI listener: the DOM reports it and the closing commits once.
  //    (Skipped only if step 2 already committed the closing after a future #955-style fix.)
  let listenerHits=0;
  if(!alreadyClosed){const listener=()=>{listenerHits++;throw new Error('notify listener threw');};e.addEventListener('notify',listener);
  let committed;try{committed=e.closeMADeal('eq-deal');}finally{e.removeEventListener('notify',listener);}
  await m.saveStorageIDB.flush();
  if(committed!==true||listenerHits<1)throw new Error('listener throw: closing expected to commit '+JSON.stringify({committed,listenerHits}));}
  if(e.closeMADeal('eq-deal')!==false)throw new Error('a second closing must be rejected');await m.saveStorageIDB.flush();
  const g=e.g,o=g.sharesOut-g.treasuryBuybackShares,eps=1e-12,v=view(g);
  if(o!==970000||v.subsidiaries!==1||v.equityRows!==1)throw new Error('commit once '+JSON.stringify(v));
  const expect={founderOwnershipRatio:700000/970000,competitorOwnedRatio:190000/970000,externalShareholderRatio:80000/970000};
  for(const k of Object.keys(expect))if(Math.abs(g[k]-expect[k])>eps)throw new Error(k+' '+JSON.stringify(v));
  if(Math.abs(g.founderOwnershipRatio+g.competitorOwnedRatio+g.externalShareholderRatio-1)>eps)throw new Error('ratios do not sum to 1');
  if(!m.finance.validate(JSON.parse(JSON.stringify(g))).ok)throw new Error('accounting invalid');
  const d=await durable();if(d!==m.saveStorageIDB.readSync(key)||d!==localStorage.getItem(key))throw new Error('commit: durable, cache and mirror differ');
  if(key!=='capitalism_tycoon_web_v1'||g.saveVersion!==9)throw new Error('save identity');
  return {cases,listenerHits,alreadyClosed,live:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(g))).g)};
 },pick);
 for(const row of proof.cases)console.log(`iPhone WebKit shadow boundary ${row.name}: ${row.noFork?'no fork (live = mirror = cache = durable)':'result=false live/mirror/cache/durable rolled back consistently'} PASS`);
 console.log(proof.alreadyClosed?'iPhone WebKit shadow boundary notify-listener-throw: skipped (step 2 already committed the closing); live = mirror = cache = durable PASS':'iPhone WebKit shadow boundary notify-listener-throw: closing commits once; live = mirror = cache = durable PASS');
 await p.reload({waitUntil:'networkidle'});const r=await view(p);assert.equal(r.saveVersion,9);assert.deepEqual(r.view,proof.live,'reload');
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();fp.on('pageerror',e=>pageErrors.push(String(e?.message||e)));await fp.goto(url,{waitUntil:'networkidle'});
 assert.deepEqual((await view(fp)).view,proof.live,'fresh durable-only');await fresh.close();await context.close();
 // Page errors from the first page, its reload and the fresh durable-only page, checked after all startups.
 if(!proof.alreadyClosed)assert.ok(pageErrors.some(x=>x.includes('notify listener threw')),'the throwing listener was reported by the page, not rethrown');
 assert.deepEqual(pageErrors.filter(x=>!x.includes('notify listener threw')),[],'no other page error');
 console.log('iPhone WebKit M&A equity raise shadow boundary: reload / fresh real IDB PASS');
 fs.writeFileSync(path.join(DIR,'ma-equity-raise-shadow-atomicity-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,cases:proof.cases,listenerHits:proof.listenerHits,live:proof.live},null,2));
 console.log('iPhone WebKit M&A equity raise shadow-state atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
