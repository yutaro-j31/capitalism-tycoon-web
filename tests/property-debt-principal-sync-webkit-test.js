'use strict';
// Regression in real iPhone WebKit emulation / real IndexedDB; not a physical device test.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {fixture}=require('./fixtures/property-debt-principal-sync');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/property-debt-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const file=path.resolve(ROOT,new URL(req.url,'http://localhost').pathname.slice(1)||'index.html');assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();const url='http://127.0.0.1:'+server.address().port+'/';
 for(const writer of ['generic','voluntary','maturity','full']){
  const s=fixture(),context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});
  const expected=await p.evaluate(async({g,writer})=>{
   const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(g),b=m.saveStorageIDB,key=m.engine.SAVE_KEY;
   await b.hydrate();if(!b.status().available)throw Error('real IDB prerequisite');
   const check=()=>{const l=e.g.realEstateMarket.loans[0],f=e.g.finance.loans.find(x=>x.loanID===l.id);if(l.balance!==f.outstandingPrincipal||l.balance!==e.g.companyDebt)throw Error('principal mismatch');if(!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok||!m.finance.debtRollforwardStatus(e.g).ok)throw Error('accounting');};
   if(!e.save())throw Error('baseline');await b.flush();
   if(writer==='maturity'){const r=m.playerDebtService.refinancingState(e);r.nextMaturityWeek=e.g.week;e.runTransaction(()=>{m.playerDebtService.processDebtMaturity(e);return true;});}
   else if((writer==='voluntary'?e.prepayCompanyDebtVoluntarily(1_000_000):e.repay(writer==='full'?60_000_000:1_000_000,'company'))!==true)throw Error('repayment');
   check();e.g.week++;e.runTransaction(()=>{m.realEstateCompleteCycle.processLoans(e.g);return true;});check();await b.flush();
   const pick=g=>({cash:g.companyCash,personalCash:g.personalCash,debt:g.companyDebt,principal:g.finance.loans.map(l=>({id:l.loanID,balance:l.outstandingPrincipal,status:l.status})),property:g.realEstateMarket.loans,ledger:g.finance.transactions,rng:g.simulationRng,saveVersion:g.saveVersion});
   globalThis.__propertyPick=pick;return pick(e.g);
  },{g:JSON.parse(JSON.stringify(s.game.g)),writer});
  const pick=g=>({cash:g.companyCash,personalCash:g.personalCash,debt:g.companyDebt,principal:g.finance.loans.map(l=>({id:l.loanID,balance:l.outstandingPrincipal,status:l.status})),property:g.realEstateMarket.loans,ledger:g.finance.transactions,rng:g.simulationRng,saveVersion:g.saveVersion});
  const loaded=page=>page.evaluate(async src=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();return eval('('+src+')')(m.engine.TycoonEngine.load().g);},pick.toString());
  await p.reload({waitUntil:'networkidle'});assert.deepEqual(await loaded(p),expected,'reload');
  const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
  const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});assert.deepEqual(await loaded(fp),expected,'fresh durable-only hydration');
  await fresh.close();await context.close();results.push({writer,ok:true});console.log(writer+' property principal / next week / reload / fresh real IDB PASS');
 }
 fs.writeFileSync(path.join(DIR,'property-debt-result.json'),JSON.stringify({physicalDevice:false,ok:true,results},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
