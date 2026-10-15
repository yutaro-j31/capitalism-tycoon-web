'use strict';
// P4-AUD-003: real iPhone WebKit / real IndexedDB, not a physical-device claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/founder-capital-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
const server=http.createServer((req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(ROOT,pathname==='/'?'index.html':decodeURIComponent(pathname).slice(1));
 assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
 res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));
 }catch(err){res.statusCode=404;res.end(String(err));}});
const amount=1_000_000;
async function economic(page){return page.evaluate(()=>{
 const m=globalThis.__capitalismTycoonModules,g=m.engine.TycoonEngine.load().g;
 return {companyCash:g.companyCash,personalCash:g.personalCash,companyDebt:g.companyDebt,personalDebt:g.personalDebt,
 capitalSurplus:g.finance.balances.capitalSurplus,rows:g.finance.transactions.filter(t=>t.sourceType==='founderCapitalContribution').length,
 rng:JSON.stringify(g.simulationRng),valid:m.finance.validate(JSON.parse(JSON.stringify(g))).ok};
});}
(async()=>{fs.mkdirSync(DIR,{recursive:true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/';
 let browser;const output=[];
 try{
  browser=await webkit.launch();
  for(const fault of ['mirror','change']){
   const context=await browser.newContext(options),page=await context.newPage();
   await page.goto(url,{waitUntil:'networkidle'});
   const proof=await page.evaluate(async({fault,amount})=>{
    const m=globalThis.__capitalismTycoonModules,key=m.engine.SAVE_KEY;
    const state=m.engine.createInitialState({configured:true});
    Object.assign(state,{configured:true,week:12,companyCash:100_000_000,personalCash:40_000_000,companyDebt:0,personalDebt:0});
    state.finance=m.finance.defaultFinanceState(state);
    const e=new m.engine.TycoonEngine(state);
    if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok||!e.save())throw Error('invalid baseline');
    await m.saveStorageIDB.flush();
    const durable=()=>new Promise((resolve,reject)=>{
     const open=indexedDB.open('capitalism-tycoon',1);
     open.onerror=()=>reject(open.error);
     open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves','readonly'),get=tx.objectStore('saves').get(key);
      tx.oncomplete=()=>{const v=get.result;db.close();resolve(v)};tx.onerror=()=>reject(tx.error);};
    });
    const original=JSON.stringify(e.g),mirror=localStorage.getItem(key),priorDurable=await durable();
    let injected=false,result=null,thrown=false;
    const setItem=Storage.prototype.setItem,emit=e.emit;
    if(fault==='mirror')Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===key&&!injected){injected=true;throw new DOMException('injected mirror failure','SecurityError')}return setItem.call(this,k,v);};
    else e.emit=function(type,...args){if((type===undefined||type==='change')&&!injected){injected=true;throw Error('injected post-save change failure')}return emit.call(this,type,...args);};
    try{result=e.contributeFounderCapital(amount);}catch(_){thrown=true;}finally{Storage.prototype.setItem=setItem;e.emit=emit;}
    await m.saveStorageIDB.flush();
    const rollback=JSON.stringify(e.g)===original&&localStorage.getItem(key)===mirror
      &&m.saveStorageIDB.readSync(key)===mirror&&(await durable())===priorDurable;
    if(!injected||!rollback||(fault==='mirror'?(result!==false||thrown):!thrown))
     throw Error('bad rollback '+JSON.stringify({fault,injected,rollback,result,thrown}));
    const ok=e.contributeFounderCapital(amount);
    if(ok!==true)throw Error('normal retry rejected');
    await m.saveStorageIDB.flush();
    const g=e.g;
    if(g.companyCash!==101_000_000||g.personalCash!==39_000_000||g.companyDebt!==0||g.personalDebt!==0
     ||g.finance.transactions.filter(t=>t.sourceType==='founderCapitalContribution').length!==1
     ||m.finance.validate(JSON.parse(JSON.stringify(g))).ok!==true)throw Error('accounting invariant');
    return {fault,rollback,retry:ok,sequence:JSON.parse(await durable()).saveSequence,rng:JSON.stringify(g.simulationRng)};
   },{fault,amount});
   const expected=await economic(page);
   if(!expected.valid||expected.companyCash!==101_000_000||expected.personalCash!==39_000_000||expected.rows!==1)
     throw Error('incorrect post-commit projection');
   await page.reload({waitUntil:'networkidle'});
   assert.deepEqual(await economic(page),expected,'production reload');
   const storageState=await context.storageState({indexedDB:true});
   const fresh=await browser.newContext({...options,storageState}),freshPage=await fresh.newPage();
   await freshPage.goto(url,{waitUntil:'networkidle'});
   assert.deepEqual(await economic(freshPage),expected,'fresh real IndexedDB hydration');
   output.push(proof);await fresh.close();await context.close();
  }
  fs.writeFileSync(path.join(DIR,'founder-capital-atomicity.json'),JSON.stringify({device:'iPhone 13',output},null,2));
  console.log('P4-AUD-003 Founder Capital real iPhone WebKit / durable hydration PASS');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(err=>{console.error(err);process.exitCode=1;});
