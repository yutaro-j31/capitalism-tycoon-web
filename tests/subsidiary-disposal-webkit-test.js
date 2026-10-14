'use strict';
// #975 in real iPhone WebKit + real IndexedDB: group-restructuring disposals of a VC subsidiary (sale, liquidation)
// and of a taken-private listing whose book carries a legacy fraction (sale), built in Node with production writers.
// The disposal leaves accounting valid at once and for 13 weeks, removes the exact book through the ledger and
// moves cash only by the ledger amount. Every injected save fault rolls live, mirror, cache and durable state back;
// the retry reaches the unfaulted result; reload and a fresh durable-only context agree.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const D=require('./fixtures/subsidiary-disposal');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
// The disposal writers raise no 'notify', so the harness's notify fault has no writer to reach.
const FAULTS=['save-false','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','pending-save-false','pending-save-throw'];
const SOFT=['save-false','mirror','enqueue-false','enqueue-throw'];
const pick=`(g)=>({week:g.week,companyCash:g.companyCash,simulationRng:g.simulationRng,transactions:((g.finance||{}).transactions||[]).length,
 subsidiaries:(g.subsidiaries||[]).map(x=>({id:x.id,status:x.status||'active',ownership:x.ownership,carryingBookValue:x.carryingBookValue}))})`;
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
  const subOf=state=>state.subsidiaries.find(x=>String(x.id)===String(f.subsidiaryID));
  const valid=(state,label)=>{const check=m.finance.validate(JSON.parse(JSON.stringify(state)));if(!check.ok)throw new Error(label+' accounting invalid '+JSON.stringify(check.errors));};
  valid(e.g,'pre-disposal');
  // Liquidation needs four deterministic operating signals; they are set before the baseline save.
  if(f.action==='liquidated')Object.assign(subOf(e.g),{growth:.01,risk:.6,weeklyProfit:-1000,lossMakingWeeks:30,valuation:Math.round(subOf(e.g).carryingBookValue*.3)});
  await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('baseline save failed');await backend.flush();
  const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  const puts=[],basePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)puts.push(String(v));return basePut.call(this,v,k);};
  if(pending&&!e.save())throw new Error('prior pending save failed');
  const before=JSON.stringify(e.g),bytes=backend.readSync(key);
  const dispose=()=>f.action==='sold'?e.executeGroupRestructuringSale(f.subsidiaryID):e.executeGroupRestructuringLiquidation(f.subsidiaryID);
  const disposed=state=>{
   const base=JSON.parse(before),pre=subOf(base),now=subOf(state),rows=state.finance.transactions.slice(base.finance.transactions.length).filter(t=>t.category==='assetSale');
   if(now.status!==f.action||now.ownership!==0||now.carryingBookValue!==0)throw new Error('disposal state '+JSON.stringify(now));
   valid(state,'right after the disposal');
   if(rows.length!==1||-rows[0].assetEffect!==pre.carryingBookValue)throw new Error('ledger book removal '+JSON.stringify({rows,book:pre.carryingBookValue}));
   if(state.companyCash!==base.companyCash+rows[0].cashEffect)throw new Error('cash moved without the ledger');
   const bs=m.finance.buildStatements(JSON.parse(JSON.stringify(state))).balanceSheet.assets.subsidiariesAndAffiliates;
   if(bs!==0)throw new Error('disposed subsidiary still held: '+bs);
   return {cash:state.companyCash,rng:JSON.stringify(state.simulationRng),book:pre.carryingBookValue,ledgerRows:state.finance.transactions.length};};
  const injection=normal?{hits:()=>0,restore(){}}:__peInject(e,m,localStorage,key,kind);
  let returned=null,error=null;
  try{returned=dispose();}catch(ex){error=ex.message;}finally{injection.restore();}
  let signature,retry=null,weeks=null;
  if(normal){if(returned===false||error)throw new Error('normal disposal result '+JSON.stringify({returned,error}));signature=disposed(e.g);}
  else{
   if(!injection.hits())throw new Error('fault not reached');
   if(SOFT.includes(kind)?(returned!==false||error):!error)throw new Error('fault not reported '+JSON.stringify({returned,error}));
   if(JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||backend.readSync(key)!==bytes)throw new Error('live/mirror/cache rollback failed');
  }
  await backend.flush();const final=await durable();IDBObjectStore.prototype.put=basePut;
  if(final!==(normal?backend.readSync(key):bytes))throw new Error('durable mismatch');
  if(puts.length!==(normal?1:0)+(pending?1:0))throw new Error('boundary puts '+puts.length);
  if(!normal){
   if(!e.save())throw new Error('recovery save rejected');await backend.flush();
   if(subOf(JSON.parse(await durable())).status==='sold'||subOf(JSON.parse(await durable())).status==='liquidated')throw new Error('recovery revived the failed disposal');
   if(dispose()===false)throw new Error('retry after failure');signature=disposed(e.g);retry='PASS';await backend.flush();
  }else{
   // 13 weeks after the disposal close, each with valid accounting.
   const start=e.g.week;while(e.g.week<start+13){if(e.advanceWeek(false)===false)throw new Error('week '+(e.g.week+1)+' refused');valid(e.g,'week '+e.g.week);}
   weeks=`${start+1}-${e.g.week}`;await backend.flush();
  }
  if(reference&&JSON.stringify(signature)!==JSON.stringify(reference))throw new Error('determinism: disposal differs from the unfaulted run '+JSON.stringify({signature,reference}));
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  return {expected:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g),signature,summary:{name:f.name,fault,hits:injection.hits(),returned,error,boundaryPuts:puts.length,retry,weeks}};
 },{f,fault,snap:pick,SOFT,reference});
 await p.reload({waitUntil:'networkidle'});await loaded(p,proof.expected,`${f.name} ${fault} reload`);
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 await loaded(fp,proof.expected,`${f.name} ${fault} fresh durable-only`);
 await fresh.close();await context.close();
 return proof;
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];const out=path.join(DIR,'subsidiary-disposal-result.json');try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 const vc=D.vcState(),vcID=JSON.parse(vc).subsidiaries.at(-1).id,legacy=D.privateGame(D.FRACTION);
 const scenarios=[
  {name:'VC sale',action:'sold',state:vc,subsidiaryID:vcID,faults:FAULTS},
  {name:'VC liquidation',action:'liquidated',state:vc,subsidiaryID:vcID,faults:FAULTS},
  {name:'taken-private listing with a legacy fractional book, sale',action:'sold',state:JSON.stringify(legacy.game.g),subsidiaryID:legacy.subsidiaryID,faults:['save-false','save-throw']}];
 for(const f of scenarios){
  const first=await run(browser,url,f,'normal',null),reference=first.signature;
  assert.deepEqual((await run(browser,url,f,'normal',reference)).signature,reference,`${f.name}: same state, same disposal`);
  results.push(first.summary);
  console.log(`iPhone WebKit ${f.name} normal x2 / validate at once / exact book and cash / 13 weeks / deterministic PASS`);
  for(const fault of f.faults){
   const proof=await run(browser,url,f,fault,reference);
   results.push({...proof.summary,reload:'PASS',freshDurableOnly:'PASS'});
   console.log(`iPhone WebKit ${f.name} ${fault} / rollback+retry / reload / fresh real IDB PASS`);
   fs.writeFileSync(out,JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
  }
 }
 fs.writeFileSync(out,JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit subsidiary disposal PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
