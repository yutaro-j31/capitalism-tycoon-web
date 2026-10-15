'use strict';
// D3 in real iPhone WebKit + real IndexedDB on the booted production app: a share-swap closing (installed deal-room
// chain) dilutes the founder and the competitor over the new outstanding shares (issued − treasury) and gives the
// new shares to external holders; ratios sum to 1. A rejected save rolls ratios back with everything else; the
// committed ratios survive reload and a fresh durable-only context.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
const pick=`(g)=>({sharesOut:g.sharesOut,treasury:g.treasuryBuybackShares,founderShares:g.founderShares,founder:g.founderOwnershipRatio,competitor:g.competitorOwnedRatio,external:g.externalShareholderRatio,companyCash:g.companyCash})`;
async function view(p){return p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');
 const url='http://127.0.0.1:'+server.address().port+'/',context=await browser.newContext(options),p=await context.newPage();
 await p.goto(url,{waitUntil:'networkidle'});
 const proof=await p.evaluate(async snap=>{
  const m=__capitalismTycoonModules,key=m.engine.SAVE_KEY,e=new m.engine.TycoonEngine(),view=eval(snap);
  e.g=m.engine.createInitialState({configured:true,seed:934013,companyName:'Share swap ratios WebKit',playerName:'Owner'});
  Object.assign(e.g,{week:24,companyCash:500000000,companyDebt:0,companyCredit:90,publicCompany:true,stockPrice:1000,sharesOut:1000000,founderShares:700000,treasuryBuybackShares:50000,competitorOwnedRatio:.2,
   reports:[{week:23,sales:20000000,expenses:2000000,profit:6000000}]});
  e.g.lastReport=e.g.reports[0];e.g.finance=m.finance.defaultFinanceState(e.g);
  e.g.acquisitionTargets=[{id:'swap-target',name:'Swap target',valuation:80000000,sales:120000000,operatingProfit:15000000,growth:.1,risk:.1,synergy:.12,activeDealID:'swap-deal'}];
  e.g.maDealRooms=[{id:'swap-deal',targetID:'swap-target',status:'accepted',diligenceLevel:'full',diligenceConfidence:.94,acceptedTerms:{method:'shareSwap',finalPrice:100000000,acceptedWeek:23,closingDeadlineWeek:28,offerRound:1},history:[]}];
  e.normalize();await m.saveStorageIDB.hydrate();if(!m.saveStorageIDB.status().available)throw new Error('real IndexedDB prerequisite failed');
  if(!e.approveMAClosing('swap-deal')||!e.save())throw new Error('baseline failed');await m.saveStorageIDB.flush();
  const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  // 1. A rejected save (mirror) rolls the ratios back with the rest of the state.
  const before=JSON.stringify(e.g),bytes=localStorage.getItem(key),prior=await durable(),setItem=Storage.prototype.setItem;let injected=false,result;
  Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===key&&!injected){injected=true;throw new DOMException('injected save rejection','SecurityError');}return setItem.call(this,k,v);};
  try{result=e.closeMADeal('swap-deal');}finally{Storage.prototype.setItem=setItem;}
  await m.saveStorageIDB.flush();
  if(!injected||result!==false||JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||await durable()!==prior)throw new Error('rejected save did not roll the ratios back');
  // 2. The committed closing dilutes founder and competitor; the new 100,000 shares are external.
  if(e.closeMADeal('swap-deal')!==true)throw new Error('closing failed');await m.saveStorageIDB.flush();
  const g=e.g,o=g.sharesOut-g.treasuryBuybackShares,eps=1e-12;
  const expect={founder:700000/1050000,competitor:190000/1050000,external:160000/1050000};
  for(const k of Object.keys(expect))if(Math.abs(g[{founder:'founderOwnershipRatio',competitor:'competitorOwnedRatio',external:'externalShareholderRatio'}[k]]-expect[k])>eps)throw new Error(k+' ratio '+JSON.stringify(view(g)));
  if(o!==1050000||Math.abs(g.founderOwnershipRatio+g.competitorOwnedRatio+g.externalShareholderRatio-1)>eps)throw new Error('ratios do not sum to 1');
  if(g.companyCash!==500000000||!m.finance.validate(JSON.parse(JSON.stringify(g))).ok)throw new Error('cash/accounting changed');
  if(await durable()!==m.saveStorageIDB.readSync(key))throw new Error('commit not durable');
  if(key!=='capitalism_tycoon_web_v1'||g.saveVersion!==9)throw new Error('save identity');
  return {live:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(g))).g)};
 },pick);
 console.log('iPhone WebKit share swap: rejected save rolls ratios back; committed closing dilutes founder 700k/1.05M and competitor 190k/1.05M, external 160k/1.05M, sum 1 PASS');
 // The app boots from the saved state; reload and a fresh durable-only context agree with the live ratios.
 await p.reload({waitUntil:'networkidle'});const r=await view(p);assert.equal(r.saveVersion,9);assert.deepEqual(r.view,proof.live,'reload');
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 assert.deepEqual((await view(fp)).view,proof.live,'fresh durable-only');await fresh.close();await context.close();
 console.log('iPhone WebKit share swap ratios: reload / fresh real IDB PASS');
 fs.writeFileSync(path.join(DIR,'share-swap-ownership-ratios-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,live:proof.live},null,2));
 console.log('iPhone WebKit share swap ownership ratios PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
