'use strict';
// P3-4 scoped evidence: raw margin helpers execute inside the caller's existing transaction.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {fixture,SETTLEMENT}=require('./fixtures/personal-stock-margin-atomicity');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const {FAULT_KINDS,SOFT_FAILURES}=require('./helpers/transaction-fault-case');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/personal-stock-margin-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
async function page(context,url){const p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});return p;}
(async()=>{
 fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];
 try{
  browser=await webkit.launch();const url='http://127.0.0.1:'+server.address().port+'/';
  for(const variant of ['liquidate','weekly','interest','canonical']){
   const f=await fixture(variant==='canonical'?'weekly':variant),state=JSON.parse(JSON.stringify(f.game.g));
   const kinds=variant==='canonical'?['none','save-throw','saved','week']:['none',...FAULT_KINDS.filter(k=>k!=='notify'||variant!=='interest')];
   for(const kind of kinds){
    const context=await browser.newContext(options),p=await page(context,url);
    await p.addScriptTag({content:'globalThis.__injectMarginFault='+inject.toString()+';'});
    const expected=await p.evaluate(async({state,variant,kind,soft,settlement})=>{
     const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(state),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
     await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB unavailable');if(!e.save())throw new Error('baseline save failed');await backend.flush();
     const before=JSON.stringify(e.g),prior=JSON.parse(before),bytes=backend.readSync(key),save=e.save;
     let injection={hits:()=>0,restore(){}};
     if(kind==='save-before-throw'){let hits=0;e.save=()=>{hits++;throw new Error('margin save before admission threw');};injection={hits:()=>hits,restore(){e.save=save;}};}
     else if(kind==='week'){const emit=e.emit;let hits=0;e.emit=function(type,...args){if(type==='week'){if(this.g.personalMarginLoan.liquidatedCount!==1)throw Error('margin not reached');hits++;throw Error('canonical margin week threw');}return emit.call(this,type,...args);};injection={hits:()=>hits,restore(){e.emit=emit;}};}
     else if(kind!=='none')injection=__injectMarginFault(e,m,localStorage,key,kind);
     let result,error;
     try{result=variant==='canonical'?e.advanceWeek(false):e.runTransaction(()=>variant==='liquidate'?m.personalStockMargin.liquidate(e):m.personalStockMargin.processWeek(e));}
     catch(ex){error=ex;}finally{injection.restore();}
     await backend.flush();
     if(kind!=='none'){
      if(injection.hits()<1)throw new Error('fault not reached');
      if(soft.includes(kind)?result!==false||error:!error||!/threw/.test(error.message))throw new Error('wrong failure result');
      if(JSON.stringify(e.g)!==before||localStorage.getItem(key)!==bytes||backend.readSync(key)!==bytes)throw new Error('failed margin changed state/mirror/cache');
     }else{
      if(!result||error)throw new Error('margin command failed');
      if(variant!=='canonical'){
       for(const k of ['companyCash','companyDebt','companyStocks','finance','simulationRng','sharesOut','founderShares','treasuryBuybackShares'])if(JSON.stringify(e.g[k])!==JSON.stringify(prior[k]))throw new Error('margin changed '+k);
       if(variant==='interest'){if(e.g.personalMarginLoan.balance!==1001000||e.g.personalMarginLoan.interestCapitalized!==1000||JSON.stringify(e.g.personalStocks)!==JSON.stringify(prior.personalStocks))throw new Error('interest conservation failed');}
       else{
        for(const id of ['CPTY','EXT']){const stock=prior.market.find(x=>x.id===id),lot=prior.personalStocks[id];if(stock.price!==100||stock.issuedShares!==1000000||lot.qty!==20000||lot.avg!==1000)throw Error('pinned fixture changed');}
        const raised=settlement.raised;
        if(e.g.realizedPersonalStockPL-prior.realizedPersonalStockPL!==settlement.realizedPL||result.raised!==raised||result.repaid!==raised)throw Error('pinned proceeds/P&L failed');
        for(const stock of e.g.market.filter(x=>['CPTY','EXT'].includes(x.id)))if(stock.price!==settlement.priceAfter||stock.marketCap!==settlement.marketCapAfter)throw Error('pinned price impact failed');
        if(e.g.personalCash!==0||e.g.personalDebt-prior.personalDebt!==prior.personalMarginLoan.balance+(variant==='weekly'?10000:0)-raised)throw new Error('liquidation cash/debt conservation failed');
       }
      }
      if(variant!=='interest'&&(e.g.personalMarginLoan.balance!==0||e.g.personalMarginLoan.liquidatedCount!==1||Object.keys(e.g.personalStocks).length!==0))throw new Error('liquidation not completed once');
      if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok)throw new Error('company book invalid');
     }
     const normalized=new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g;
     delete normalized.lastSaveDate;delete normalized.saveSequence;return JSON.parse(JSON.stringify(normalized));
    },{state,variant,kind,soft:SOFT_FAILURES,settlement:SETTLEMENT});
    const storageState=await context.storageState({indexedDB:true});for(const origin of storageState.origins)origin.localStorage=[];
    const fresh=await browser.newContext({...options,storageState}),fp=await page(fresh,url);
    const actual=await fp.evaluate(async()=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const e=m.engine.TycoonEngine.load();if(!e)throw new Error('durable-only load failed');const g=JSON.parse(JSON.stringify(e.g));delete g.lastSaveDate;delete g.saveSequence;return g;});
    assert.deepEqual(actual,expected,variant+'/'+kind+': fresh real IndexedDB hydration');assert.equal(actual.saveVersion,9);
    results.push({variant,kind,pass:true});fs.writeFileSync(path.join(DIR,'personal-stock-margin-result.json'),JSON.stringify({physicalDevice:false,browser:browser.version(),ok:false,results},null,2));
    console.log(`iPhone WebKit margin ${variant}/${kind} / real IDB PASS`);await fresh.close();await context.close();
   }
  }
  fs.writeFileSync(path.join(DIR,'personal-stock-margin-result.json'),JSON.stringify({physicalDevice:false,browser:browser.version(),ok:true,results},null,2));
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
