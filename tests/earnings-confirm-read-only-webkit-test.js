'use strict';
// #988 in real iPhone WebKit + real IndexedDB on the booted production app: the market-tab 「決算イベントを確認」
// button is read-only. Tapped repeatedly in one week it opens the latest-earnings view (or the defined
// "no result yet" view) and changes nothing: no live, mirror, cache or durable change, no save, no RNG draw,
// no price / market cap / trust / guidance / news / schedule change. Reload and a fresh durable-only context agree.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {scenario}=require('./fixtures/stock-split-atomicity');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
const LATEST='第12週：好決算：売上2,000,000円 / 利益300,000円。株主信頼55。';
async function fixture(withResult){
 const s=await scenario('own'),g=s.game.g;
 Object.assign(g,{shareholderTrust:55,activistPressure:20,earningsGuidanceRevenue:withResult?2_100_000:0,earningsGuidanceProfit:withResult?310_000:0,
  lastEarningsAnnouncementWeek:withResult?g.week:0,earningsEventLog:withResult?[LATEST]:[],selectedTab:'market'});
 g.lastReport={...(g.lastReport||{}),week:g.week,sales:2_000_000,profit:300_000};
 return JSON.parse(JSON.stringify(g));
}
const pick=`(g)=>({week:g.week,stockPrice:g.stockPrice,own:(g.market||[]).filter(x=>x.id==='CPTY').map(x=>({price:x.price,marketCap:x.marketCap})),shareholderTrust:g.shareholderTrust,activistPressure:g.activistPressure,
 lastEarningsAnnouncementWeek:g.lastEarningsAnnouncementWeek,earningsEventLog:g.earningsEventLog,earningsGuidanceRevenue:g.earningsGuidanceRevenue,earningsGuidanceProfit:g.earningsGuidanceProfit,
 simulationRng:g.simulationRng,news:g.news,companyCash:g.companyCash,personalCash:g.personalCash})`;
async function durableView(p){return p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB / real button tap');
 const url='http://127.0.0.1:'+server.address().port+'/';
 for(const withResult of [true,false]){
  const label=withResult?'latest result':'no result yet',g=await fixture(withResult),context=await browser.newContext(options),p=await context.newPage();
  await p.goto(url,{waitUntil:'networkidle'});
  await p.evaluate(async g=>{const m=__capitalismTycoonModules,key=m.engine.SAVE_KEY;await m.saveStorageIDB.hydrate();if(!m.saveStorageIDB.status().available)throw new Error('real IndexedDB prerequisite failed');
   const saved=m.saveStorage.saveWithAdapter({g},{key});if(!saved.ok)throw saved.error||new Error('seed save failed');await saved.flush();},g);
  await p.reload({waitUntil:'networkidle'});
  const button=p.locator('[data-action="view-earnings"]').first();await button.waitFor({state:'visible',timeout:20_000});
  assert.equal(await p.locator('[data-action="force-earnings"]').count(),0,'the forcing action no longer exists');
  await p.evaluate(async()=>{const m=__capitalismTycoonModules,e=m.playerEngineBridge.getEngine(),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
   if(!e||e.g.selectedTab!=='market')throw new Error('app engine not on the market tab');await backend.flush();
   const w=globalThis.__earnings={puts:[],events:[],basePut:IDBObjectStore.prototype.put,before:JSON.stringify(e.g),bytes:backend.readSync(key),mirror:localStorage.getItem(key)};
   IDBObjectStore.prototype.put=function(v,k){if(this.name==='saves'&&k===key)w.puts.push(String(v));return w.basePut.call(this,v,k);};
   w.emit=e.emit;e.emit=function(type='change',...a){w.events.push(type);return w.emit.call(this,type,...a);};});
  for(let i=0;i<5;i++){
   await button.tap();const dialog=p.locator('[data-modal-panel]');await dialog.waitFor({state:'visible',timeout:5_000});
   const text=await dialog.innerText();assert.match(text,/直近の決算・業績予想/);
   if(withResult){assert.ok(text.includes(LATEST),'shows the latest result');assert.ok(!text.includes('未発表'));}
   else{assert.match(text,/まだ決算発表はありません/,'defined no-result view');assert.match(text,/未発表/);}
   assert.match(text,/確認専用です/);
   await p.locator('[data-modal-panel] [data-action="close-modal"]').first().tap();await p.waitForTimeout(50);
   assert.equal(await p.locator('[data-modal-panel]').count(),0,'view closes');
  }
  const proof=await p.evaluate(async snap=>{const m=__capitalismTycoonModules,e=m.playerEngineBridge.getEngine(),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,w=globalThis.__earnings;
   e.emit=w.emit;await backend.flush();IDBObjectStore.prototype.put=w.basePut;
   const durable=await new Promise((resolve,reject)=>{const open=indexedDB.open('capitalism-tycoon',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);tx.oncomplete=()=>{db.close();resolve(get.result);};tx.onerror=()=>reject(tx.error);};});
   if(JSON.stringify(e.g)!==w.before)throw new Error('live state changed by the read-only view');
   if(localStorage.getItem(key)!==w.mirror||backend.readSync(key)!==w.bytes||durable!==w.bytes)throw new Error('mirror/cache/durable changed');
   if(w.puts.length)throw new Error('save attempted: '+w.puts.length);
   if(w.events.length)throw new Error('engine events emitted: '+w.events.join(','));
   if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw new Error('accounting invalid');
   if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
   return {live:eval(snap)(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g)};},pick);
  console.log(`iPhone WebKit 決算イベントを確認 x5 (${label}) / view shown / nothing changed / no save / no event PASS`);
  await p.reload({waitUntil:'networkidle'});const r=await durableView(p);assert.equal(r.saveVersion,9);assert.deepEqual(r.view,proof.live,'reload');
  const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
  const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
  assert.deepEqual((await durableView(fp)).view,proof.live,'fresh durable-only');await fresh.close();await context.close();
  console.log(`iPhone WebKit 決算イベントを確認 (${label}) / reload / fresh real IDB PASS`);
  results.push({view:label,taps:5,stateUnchanged:'PASS',noSave:'PASS',reload:'PASS',freshDurableOnly:'PASS'});
 }
 fs.writeFileSync(path.join(DIR,'earnings-confirm-read-only-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit earnings confirm read-only PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
