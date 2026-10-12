'use strict';
// #953 in real iPhone WebKit + real IndexedDB: an accepted activist buyback proposal is completed in the
// same durable commit as the buyback, so a durable-only reload cannot accept it again; a rejected save
// leaves live, mirror and durable state untouched.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {scenario}=require('./fixtures/stock-split-atomicity');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
async function fixture(type){
 const s=await scenario('own'),g=JSON.parse(JSON.stringify(s.game.g));
 g.activeActivistCampaign={id:`activist-webkit-${type}`,activistName:'North Star Capital',type,title:'fixture',amount:type==='buyback'?1_000_000:6*(g.sharesOut-g.treasuryBuybackShares),dividendPerShare:type==='dividend'?6:undefined,reason:'fixture',week:g.week,startedWeek:g.week,deadlineWeek:g.week+8,status:'active',response:null,support:40,pressureScore:70,difficulty:'normal'};
 return g;
}
async function page(context,url){const p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});return p;}
async function durable(browser,context,url){
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await page(fresh,url);
 const result=await fp.evaluate(async()=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const e=m.engine.TycoonEngine.load(),g=e.g;
  const before={campaign:g.activeActivistCampaign?.status??null,treasury:g.treasuryBuybackShares,cash:g.companyCash,dps:g.dividendPerShare};
  const second=e.acceptShareholderProposal();return {before,second,treasuryAfter:g.treasuryBuybackShares,cashAfter:g.companyCash,saveVersion:g.saveVersion};});
 await fresh.close();return result;
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 for(const type of ['buyback','dividend']){
  for(const fault of [null,'save-false','save-throw']){
   const g=await fixture(type),context=await browser.newContext(options),p=await page(context,url);
   const live=await p.evaluate(async({g,fault})=>{
    const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(g),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
    await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('fixture save failed');await backend.flush();
    const before=JSON.stringify(e.g),bytes=backend.readSync(key),save=e.save;let result,error=null;
    if(fault==='save-false')e.save=function(...a){return this.inTransaction()?save.apply(this,a):false;};
    if(fault==='save-throw')e.save=function(...a){const r=save.apply(this,a);if(!this.inTransaction())throw new Error('save accepted then threw');return r;};
    try{result=e.acceptShareholderProposal();}catch(ex){error=ex.message;}finally{e.save=save;}
    await backend.flush();
    if(fault){if(JSON.stringify(e.g)!==before||backend.readSync(key)!==bytes||localStorage.getItem(key)!==bytes)throw new Error('failed accept did not roll back '+JSON.stringify({fault,result,error}));}
    else if(result!==true||e.g.activeActivistCampaign!==null)throw new Error('accept failed');
    return {result:result??null,error,campaign:e.g.activeActivistCampaign?.status??null,treasury:e.g.treasuryBuybackShares,cash:e.g.companyCash,dps:e.g.dividendPerShare};
   },{g,fault});
   const d=await durable(browser,context,url);
   assert.equal(d.saveVersion,9);
   if(fault){assert.equal(d.before.campaign,'active',`${type} ${fault}: durable keeps the open proposal`);assert.equal(d.before.treasury,live.treasury);assert.equal(d.second,true,'retry after a failed save succeeds once');}
   else{assert.equal(d.before.campaign,null,`${type}: durable accepted proposal is completed`);assert.equal(d.second,false,`${type}: no second accept after durable reload`);
    assert.equal(d.treasuryAfter,live.treasury);assert.equal(d.cashAfter,live.cash);assert.equal(d.before.dps,live.dps);}
   results.push({type,fault,live,durable:d});
   console.log(`iPhone WebKit activism accept ${type} ${fault||'normal'} / durable-only fresh IDB PASS`);
   fs.writeFileSync(path.join(DIR,'activism-accept-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
   await context.close();
  }
 }
 fs.writeFileSync(path.join(DIR,'activism-accept-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));console.log('iPhone WebKit activism accept atomicity PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
