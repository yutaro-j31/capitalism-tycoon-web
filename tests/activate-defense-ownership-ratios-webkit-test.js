'use strict';
// W-DEFENSE in real iPhone WebKit + real IndexedDB on the booted production app: a takeover defense sells only named
// competitor shares (pro rata, whole shares) to outside market investors, pays each seller price × its shares, charges
// the company the defense cost only, keeps founder / treasury / stock price, and recomputes the ratios (sum 1). The
// shared save/mirror/enqueue/post-save event fault set, pending predecessors and enclosing transactions roll the whole
// defense back (ratios, named holdings, seller cash, company cash, journal) in live, mirror and durable IndexedDB;
// retries match the uninterrupted command and survive a fresh durable-only context. With only an unnamed aggregate
// stake the white knight is refused at no cost.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const {FAULT_KINDS,SOFT_FAILURES}=require('./helpers/transaction-fault-case');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
const pick=`(g)=>({sharesOut:g.sharesOut,treasury:g.treasuryBuybackShares,founderShares:g.founderShares,founder:g.founderOwnershipRatio,competitor:g.competitorOwnedRatio,external:g.externalShareholderRatio,companyCash:g.companyCash,stockPrice:g.stockPrice,
 holdings:(g.competitors||[]).map(c=>[c.ownedPlayerShares??0,c.cash])})`;
async function view(p){return p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);}
async function faultCase({kind,pending=false,nested=false,soft=[]}){
 const check=(ok,message)=>{if(!ok)throw Error(message);},plain=value=>JSON.parse(JSON.stringify(value));
 const m=globalThis.__capitalismTycoonModules,key=m.engine.SAVE_KEY,e=new m.engine.TycoonEngine(m.engine.createInitialState({configured:true,seed:86420})),g=e.g;
 Object.assign(g,{publicCompany:true,stockPrice:1000,sharesOut:1000000,treasuryBuybackShares:50000,founderShares:700000});
 g.market=g.market.filter(x=>x.id!==g.ticker);g.market.push({id:g.ticker,name:g.companyName,sector:'コングロマリット',price:1000,previous:1000,dividendYield:0,volatility:.08,trend:.003,marketCap:1e9,per:20,pbr:2,issuedShares:1000000,dividendPerShare:0,shareholders:{}});
 const fund=492000000;g.companyCash+=fund;m.finance.event(g,'equityFinancing',fund,{cashEffect:fund,equityEffect:fund,sourceType:'testFunding',sourceID:'defense'});m.finance.ensureFinance(g).balances.capitalSurplus=(Number(m.finance.ensureFinance(g).balances.capitalSurplus)||0)+fund;
 g.competitors.forEach((c,i)=>{c.ownedPlayerShares=[60000,30000][i]??0;c.cash=10000000;});g.competitorOwnedRatio=90000/950000;e.updateOwnershipRatios();
 const backend=m.saveStorageIDB;await backend.hydrate();check(backend.status().available,'real IndexedDB prerequisite failed');check(e.save()===true,'baseline save');await backend.flush();
 if(pending)check(e.save()===true,'pending predecessor rejected');
 const before=JSON.stringify(e.g),bytes=backend.readSync(key),predecessorSequence=backend.sequenceOf(bytes),allocated=[];
 async function durable(){return new Promise((resolve,reject)=>{const open=indexedDB.open(backend.DB_NAME,backend.DB_VERSION);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction(backend.STORE_NAME,'readonly'),get=tx.objectStore(backend.STORE_NAME).get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>{db.close();reject(tx.error);};};});}
 const normalized=value=>{const copy=plain(new m.engine.TycoonEngine(plain(value)).g);delete copy.lastSaveDate;delete copy.saveSequence;return copy;};
 if(kind==='none'){
  check((nested?e.runTransaction(()=>e.activateDefense('whiteKnight')):e.activateDefense('whiteKnight'))===true,'uninterrupted defense failed');await backend.flush();check(m.finance.validate(plain(e.g)).ok,'uninterrupted accounting');check(await durable()===backend.readSync(key),'uninterrupted defense not durable');return normalized(e.g);
 }
 m.saveStorageIDB={...backend,nextSequence(...args){const sequence=backend.nextSequence(...args);allocated.push(sequence);return sequence;}};
 let injection;
 if(kind==='save-before-throw'){
  const save=e.save;let hits=0;e.save=()=>{hits++;throw Error('defense save before admission threw');};injection={hits:()=>hits,restore(){e.save=save;}};
 }else injection=globalThis.__injectDefenseFault(e,m,localStorage,key,kind);
 let result,error;
 try{result=nested?e.runTransaction(()=>e.activateDefense('whiteKnight')):e.activateDefense('whiteKnight');}catch(ex){error=ex;}finally{injection.restore();m.saveStorageIDB=backend;}
 check(injection.hits()>0,'fault not reached');
 check(soft.includes(kind)?result===false&&!error:error&&/threw/.test(error.message),'wrong failure result');
 check(JSON.stringify(e.g)===before,'fault changed full live state');check(localStorage.getItem(key)===bytes&&backend.readSync(key)===bytes,'fault changed mirror/cache');
 await backend.flush();check(await durable()===bytes,'fault or pending predecessor changed durable state');check(allocated.every(Number.isSafeInteger),'invalid allocated sequence');
 const failedSequence=Math.max(predecessorSequence,...allocated);check(e.save()===true,'recovery save rejected');await backend.flush();const recoverySequence=backend.sequenceOf(backend.readSync(key));check(recoverySequence>failedSequence,'recovery reused failed sequence');
 check(e.activateDefense('whiteKnight')===true,'defense retry failed');await backend.flush();check(m.finance.validate(plain(e.g)).ok,'retry accounting');check(backend.sequenceOf(backend.readSync(key))>recoverySequence,'retry sequence not monotonic');check(await durable()===backend.readSync(key),'retry not durable');return normalized(e.g);
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');
 const url='http://127.0.0.1:'+server.address().port+'/',context=await browser.newContext(options),p=await context.newPage();
 await p.goto(url,{waitUntil:'networkidle'});
 const proof=await p.evaluate(async snap=>{
  const m=__capitalismTycoonModules,key=m.engine.SAVE_KEY,view=eval(snap),e=new m.engine.TycoonEngine(m.engine.createInitialState({configured:true,seed:86420}));
  const g=e.g;Object.assign(g,{publicCompany:true,stockPrice:1000,sharesOut:1000000,treasuryBuybackShares:50000,founderShares:700000});
  g.market=g.market.filter(x=>x.id!==g.ticker);g.market.push({id:g.ticker,name:g.companyName,sector:'コングロマリット',price:1000,previous:1000,dividendYield:0,volatility:.08,trend:.003,marketCap:1e9,per:20,pbr:2,issuedShares:1000000,dividendPerShare:0,shareholders:{}});
  const fund=492000000;g.companyCash+=fund;m.finance.event(g,'equityFinancing',fund,{cashEffect:fund,equityEffect:fund,sourceType:'testFunding',sourceID:'defense'});m.finance.ensureFinance(g).balances.capitalSurplus=(Number(m.finance.ensureFinance(g).balances.capitalSurplus)||0)+fund;
  g.competitors.forEach((c,i)=>{c.ownedPlayerShares=[60000,30000][i]??0;c.cash=10000000;});g.competitorOwnedRatio=90000/950000;e.updateOwnershipRatios();
  await m.saveStorageIDB.hydrate();if(!m.saveStorageIDB.status().available)throw new Error('real IndexedDB prerequisite failed');
  if(!e.save())throw new Error('baseline save');await m.saveStorageIDB.flush();
  const durable=()=>new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
  // 1. A rejected save (mirror) rolls the whole defense back: ratios, named holdings, seller cash, company cash, journal.
  const before=JSON.stringify(e.g),bytes=localStorage.getItem(key),prior=await durable(),setItem=Storage.prototype.setItem;let injected=false,result;
  Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===key&&!injected){injected=true;throw new DOMException('injected save rejection','SecurityError');}return setItem.call(this,k,v);};
  try{result=e.activateDefense('whiteKnight');}finally{Storage.prototype.setItem=setItem;}
  await m.saveStorageIDB.flush();
  if(!injected||result!==false||JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||await durable()!==prior)throw new Error('rejected save did not roll the defense back');
  // 2. The committed white knight sells 9% of outstanding (85,500) from the named 90,000, pro rata 57,000 / 28,500.
  const cash=e.g.companyCash,rows=e.g.finance.transactions.length;
  if(e.activateDefense('whiteKnight')!==true)throw new Error('defense failed');await m.saveStorageIDB.flush();
  const c=e.g.competitors,o=e.g.sharesOut-e.g.treasuryBuybackShares;
  if(c[0].ownedPlayerShares!==3000||c[1].ownedPlayerShares!==1500)throw new Error('pro rata '+JSON.stringify(view(e.g)));
  if(c[0].cash!==10000000+57000*1000||c[1].cash!==10000000+28500*1000)throw new Error('seller proceeds '+JSON.stringify(view(e.g)));
  if(Math.abs(e.g.competitorOwnedRatio*o-4500)>1e-6||Math.abs(e.g.founderOwnershipRatio+e.g.competitorOwnedRatio+e.g.externalShareholderRatio-1)>1e-12)throw new Error('ratios '+JSON.stringify(view(e.g)));
  if(e.g.companyCash!==cash-25000000||e.g.finance.transactions.length!==rows+1||e.g.stockPrice!==1000||e.g.founderShares!==700000||!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw new Error('cash/journal/price/founder/accounting');
  if(await durable()!==m.saveStorageIDB.readSync(key))throw new Error('commit not durable');
  // 3. With only an unnamed aggregate stake (no named holder), the white knight is refused at no cost and nothing is saved.
  e.g.competitors.forEach(x=>{x.ownedPlayerShares=0;});if(!e.save())throw new Error('save');await m.saveStorageIDB.flush();
  const quiet=JSON.stringify(e.g),quietBytes=await durable();
  if(e.activateDefense('whiteKnight')!==false||JSON.stringify(e.g)!==quiet||await durable()!==quietBytes)throw new Error('nothing sellable must be refused at no cost');
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  return {live:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g)};
 },pick);
 console.log('iPhone WebKit W-DEFENSE: rejected save rolls ratios, holdings and proceeds back; white knight sells 85,500 named shares pro rata (57,000 / 28,500), sellers paid, company pays the cost only, sum 1; unnamed stake refused at no cost PASS');
 await p.reload({waitUntil:'networkidle'});const r=await view(p);assert.equal(r.saveVersion,9);assert.deepEqual(r.view,proof.live,'reload');
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 assert.deepEqual((await view(fp)).view,proof.live,'fresh durable-only');await fresh.close();await context.close();
 console.log('iPhone WebKit W-DEFENSE: reload / fresh real IDB PASS');
 const faultResults=[],cases=[{kind:'none',pending:false,nested:false},...FAULT_KINDS.map(kind=>({kind,pending:false,nested:false})),...['save-false','save-throw'].flatMap(kind=>[{kind,pending:true,nested:false},{kind,pending:false,nested:true}])];let uninterrupted;
 for(const item of cases){const c=await browser.newContext(options);try{const page=await c.newPage();await page.goto(url,{waitUntil:'networkidle'});await page.addScriptTag({content:'globalThis.__injectDefenseFault='+inject.toString()+';'});const committed=await page.evaluate(faultCase,{...item,soft:SOFT_FAILURES});if(item.kind==='none')uninterrupted=committed;else assert.deepEqual(committed,uninterrupted,JSON.stringify(item)+': retry differs from uninterrupted');const stored=await c.storageState({indexedDB:true});for(const origin of stored.origins)origin.localStorage=[];const durableOnly=await browser.newContext({...options,storageState:stored});try{const loaded=await durableOnly.newPage();await loaded.goto(url,{waitUntil:'networkidle'});const actual=await loaded.evaluate(async()=>{const m=globalThis.__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const e=m.engine.TycoonEngine.load();if(!e)throw Error('durable-only load failed');const g=JSON.parse(JSON.stringify(e.g));delete g.lastSaveDate;delete g.saveSequence;return g;});assert.deepEqual(actual,committed,JSON.stringify(item)+': fresh durable-only mismatch');}finally{await durableOnly.close();}faultResults.push({...item,pass:true});console.log('iPhone WebKit W-DEFENSE '+JSON.stringify(item)+' / rollback + retry + fresh IDB PASS');}finally{await c.close();}}
 fs.writeFileSync(path.join(DIR,'activate-defense-ownership-ratios-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,live:proof.live,faultResults},null,2));
 console.log(`iPhone WebKit W-DEFENSE shared fault set PASS: ${faultResults.length} scenarios`);
 console.log('iPhone WebKit W-DEFENSE ownership ratios PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
