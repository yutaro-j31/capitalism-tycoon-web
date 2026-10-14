'use strict';
// #985 in real iPhone WebKit + real IndexedDB on the booted production app: after a company sale (before refounding),
// the sold company's company-account PE actions (transfer a personal deal to the company, exit a company deal, create
// a company deal, a company deal's initiative) are refused with no live, mirror, cache or durable change and no save;
// the founder's personal PE exit commits once and survives reload and a fresh durable-only context.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {soldCompany}=require('./fixtures/refounding-ledger');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
const SOLD='会社売却後は会社名義のPE操作はできません。';
async function fixture(){
 const ctx=await soldCompany({companyPE:true,personalPE:true}),g=ctx.game.g;g.departments.investment=true;
 return {g:JSON.parse(JSON.stringify(g)),co:g.peDeals.find(d=>d.ownerAccount==='company'&&d.status==='active').id,pe:g.peDeals.find(d=>d.ownerAccount!=='company'&&d.status==='active').id};
}
const pick=`(g)=>({isCompanySold:g.isCompanySold,companyCash:g.companyCash,personalCash:g.personalCash,simulationRng:g.simulationRng,
 deals:(g.peDeals||[]).map(d=>({id:d.id,status:d.status,ownerAccount:d.ownerAccount,pending:Boolean(d.pendingInitiative)})),
 peSubsidiaries:(g.subsidiaries||[]).filter(x=>x.valuationManagedBy==='pe').map(x=>x.id),ledger:((g.finance||{}).transactions||[]).length})`;
async function durableView(p){return p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');
 const url='http://127.0.0.1:'+server.address().port+'/',f=await fixture(),context=await browser.newContext(options),p=await context.newPage();
 await p.goto(url,{waitUntil:'networkidle'});
 const proof=await p.evaluate(async({f,SOLD,snap})=>{
  const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(f.g),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,view=eval(snap);
  await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('baseline save failed');await backend.flush();
  const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  const puts=[],basePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)puts.push(String(v));return basePut.call(this,v,k);};
  const initiative=id=>e.peValueCreationPlan(id).initiatives[0].id,rows=[];
  for(const [label,command] of [['transfer personal deal to the sold company',()=>e.transferPEDealToCompany(f.pe)],['exit a company deal',()=>e.exitPEDeal(f.co)],
   ['create a company deal',()=>e.createPEDeal('ramen',10_000_000,'company')],['initiative on a company deal',()=>e.applyPEInitiative(f.co,initiative(f.co))]]){
   const before=JSON.stringify(e.g),bytes=backend.readSync(key),stored=await durable(),count=puts.length,errors=[];
   const emit=e.emit;e.emit=function(type='change',...a){if(type==='notify'&&a[0]?.severity==='error')errors.push(a[0].message);return emit.call(this,type,...a);};
   let result;try{result=command();}finally{e.emit=emit;}
   await backend.flush();
   if(result!==false)throw new Error(label+': not refused');
   if(JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||backend.readSync(key)!==bytes||await durable()!==stored)throw new Error(label+': live/mirror/cache/durable changed');
   if(puts.length!==count)throw new Error(label+': save attempted');
   if(JSON.stringify(errors)!==JSON.stringify([SOLD]))throw new Error(label+': refusal message '+JSON.stringify(errors));
   rows.push({action:label,refused:'PASS',stateUnchanged:'PASS',noSave:'PASS'});
  }
  if(e.peValueCreationPlan(f.co).blockedReason!==SOLD)throw new Error('company deal plan must show the refusal reason');
  // The founder's personal exit stays allowed and commits once.
  const company=e.g.companyCash,personal=e.g.personalCash,count=puts.length;
  if(e.exitPEDeal(f.pe)!==true)throw new Error('personal exit refused');await backend.flush();
  if(e.g.companyCash!==company||!(e.g.personalCash>personal))throw new Error('personal exit effect');
  if(puts.length!==count+1||await durable()!==backend.readSync(key))throw new Error('personal exit must commit once');
  if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw new Error('accounting invalid');
  IDBObjectStore.prototype.put=basePut;
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  return {rows,live:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g)};
 },{f,SOLD,snap:pick});
 for(const r of proof.rows)console.log(`iPhone WebKit sold company: ${r.action} / refused / nothing changed / no save PASS`);
 console.log('iPhone WebKit sold company: personal PE exit / one commit / company cash untouched PASS');
 await p.reload({waitUntil:'networkidle'});const r=await durableView(p);assert.equal(r.saveVersion,9);assert.deepEqual(r.view,proof.live,'reload');
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 assert.deepEqual((await durableView(fp)).view,proof.live,'fresh durable-only');await fresh.close();await context.close();
 console.log('iPhone WebKit sold company: reload / fresh real IDB PASS');
 results.push(...proof.rows,{action:'personal exit',committed:'PASS',reload:'PASS',freshDurableOnly:'PASS'});
 fs.writeFileSync(path.join(DIR,'sold-company-pe-authority-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit sold company PE authority PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
