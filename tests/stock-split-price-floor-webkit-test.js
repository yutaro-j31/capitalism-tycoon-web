'use strict';
// Real iPhone WebKit + real IndexedDB: a split below the 10-yen weekly floor (or with an invalid ratio)
// is rejected without touching live or durable state; a split landing exactly on the floor persists.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {scenario}=require('./fixtures/stock-split-atomicity');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
async function fixture(family,price){
 const s=await scenario(family),g=JSON.parse(JSON.stringify(s.game.g));
 for(const stock of g.market.filter(x=>x.id==='CPTY'||x.id==='EXT')){stock.price=price;stock.previous=price;stock.marketCap=price*stock.issuedShares;}
 g.stockPrice=price;
 return {g,stockID:s.stockID};
}
async function page(context,url){const p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});return p;}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 for(const family of ['own','external']){
  for(const [label,price,ratio,accept] of [['exactly 10 accepted',20,2,true],['below floor rejected',19.98,2,false],['NaN ratio rejected',100,NaN,false],['non-integer ratio rejected',100,2.5,false]]){
   const f=await fixture(family,price),context=await browser.newContext(options),p=await page(context,url);
   const proof=await p.evaluate(async({fixture,ratio,accept})=>{
    const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(fixture.g),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
    await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('fixture save failed');await backend.flush();
    const before=JSON.stringify(e.g),bytes=backend.readSync(key),events=[],emit=e.emit;e.emit=function(type='change',...args){events.push([type,args[0]?.severity]);return emit.call(this,type,...args);};
    const result=e.stockSplit(fixture.stockID,ratio);e.emit=emit;await backend.flush();
    const stock=e.stock(fixture.stockID);
    if(accept){if(result!==true||stock.price!==10)throw new Error('floor split not accepted');}
    else if(result!==false||JSON.stringify(e.g)!==before||backend.readSync(key)!==bytes||localStorage.getItem(key)!==bytes||JSON.stringify(events)!==JSON.stringify([['notify','error']]))throw new Error('rejection changed state/storage or broke the fail() contract '+JSON.stringify(events));
    return {result,price:stock.price,events};
   },{fixture:f,ratio,accept});
   const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
   const fresh=await browser.newContext({...options,storageState:state}),fp=await page(fresh,url);
   const durable=await fp.evaluate(async id=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const e=m.engine.TycoonEngine.load();return {price:e.stock(id).price,splits:e.g.stockSplitHistory.length,saveVersion:e.g.saveVersion};},f.stockID);
   assert.equal(durable.price,accept?10:price,`${family} ${label}: durable price`);assert.equal(durable.splits,accept?1:0,`${family} ${label}: durable split history`);assert.equal(durable.saveVersion,9);
   results.push({family,case:label,proof,durable});
   console.log(`iPhone WebKit stock split price floor ${family} ${label} / durable-only fresh IDB PASS`);
   fs.writeFileSync(path.join(DIR,'stock-split-price-floor-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
   await fresh.close();await context.close();
  }
 }
 fs.writeFileSync(path.join(DIR,'stock-split-price-floor-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));console.log('iPhone WebKit stock split price floor PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
