'use strict';
// Real iPhone WebKit + real IndexedDB proof that a stock split rescales per-share dividends:
// the split state survives a durable-only fresh context and the next production dividend week
// pays exactly what the never-split baseline pays. Includes save rejection rollback + retry.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {scenario}=require('./fixtures/stock-split-atomicity');
const {inject}=require('./fixtures/pe-fund-acquisition-faults');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const EXT_DPS=30,OWN_DPS=6,TOLERANCE=1e-6;
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end(String(e));}});
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=TOLERANCE*Math.max(1,Math.abs(expected)),`${label}: ${actual} != ${expected}`);
async function fixture(family){
 const s=await scenario(family);
 s.game.stock('EXT').dividendPerShare=EXT_DPS;
 assert.equal(s.game.setDividend(OWN_DPS),true);
 return {g:JSON.parse(JSON.stringify(s.game.g)),stockID:s.stockID};
}
async function page(context,url){const p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});return p;}
// Loads the durable save (IDB only) in a fresh context and runs the production dividend week.
async function durablePayment(browser,context,url){
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),p=await page(fresh,url);
 const result=await p.evaluate(async()=>{
  const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();
  if(!m.saveStorageIDB.status().available)throw new Error('real IndexedDB hydration prerequisite failed');
  const e=m.engine.TycoonEngine.load(),g=e.g,personal=g.personalCash,company=g.companyCash;
  const dps={declared:g.dividendPerShare,own:e.stock('CPTY').dividendPerShare,ext:e.stock('EXT').dividendPerShare,shares:g.sharesOut,extIssued:e.stock('EXT').issuedShares,saveVersion:g.saveVersion};
  if(e.advanceWeek(false)===false)throw new Error('dividend week failed');
  if(!m.finance.validate(JSON.parse(JSON.stringify(g))).ok)throw new Error('company accounting invalid after dividend week');
  return {dps,payment:{personal:g.personalCash-personal,company:g.companyCash-company,dividend:g.lastReport.dividend,stockIncome:g.lastReport.stockIncome}};
 });
 await fresh.close();return result;
}
async function baselinePayment(browser,url,f){
 const context=await browser.newContext(options),p=await page(context,url);
 await p.evaluate(async fixture=>{const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(fixture.g);await m.saveStorageIDB.hydrate();if(!e.save())throw new Error('baseline save failed');await m.saveStorageIDB.flush();},f);
 const result=await durablePayment(browser,context,url);await context.close();return result;
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 const baseline=await baselinePayment(browser,url,await fixture('external'));
 assert.equal(baseline.dps.declared,OWN_DPS);assert.equal(baseline.dps.ext,EXT_DPS);assert.equal(baseline.dps.saveVersion,9);
 for(const family of ['own','external']){
  for(const [label,ratios,fault] of [['1:2',[2],null],['1:3',[3],null],['1:2 then 1:3',[2,3],null],['save-false then retry',[2],'save-false'],['save-throw then retry',[2],'save-throw']]){
   const f=await fixture(family),context=await browser.newContext(options),p=await page(context,url);
   await p.evaluate(`globalThis.__dividendInject=(${inject.toString()});`);
   const proof=await p.evaluate(async({fixture,ratios,fault})=>{
    const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(fixture.g),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
    await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('fixture save failed');await backend.flush();
    let rejected=null;
    if(fault){
     const before=JSON.stringify(e.g),bytes=backend.readSync(key),injection=__dividendInject(e,m,localStorage,key,fault);let returned,error;
     try{returned=e.stockSplit(fixture.stockID,2);}catch(ex){error=ex.message;}finally{injection.restore();}
     if(!injection.hits()||(fault==='save-false'?returned!==false||error:!error))throw new Error('fault contract failed '+JSON.stringify({fault,returned,error}));
     if(JSON.stringify(e.g)!==before||backend.readSync(key)!==bytes||localStorage.getItem(key)!==bytes)throw new Error('failed split did not roll back dividendPerShare/state/storage');
     await backend.flush();if(backend.readSync(key)!==bytes)throw new Error('failed split became durable');
     rejected={fault,returned:returned??null,error:error??null,dps:e.g.dividendPerShare,ownDps:e.stock('CPTY').dividendPerShare,extDps:e.stock('EXT').dividendPerShare};
    }
    const draws=e.g.simulationRng?JSON.stringify(e.g.simulationRng):null,cash=[e.g.companyCash,e.g.personalCash],cap=e.stock(fixture.stockID).marketCap,ratio=e.g.founderOwnershipRatio;
    for(const r of ratios)if(e.stockSplit(fixture.stockID,r)!==true)throw new Error('split '+r+' failed');
    if((e.g.simulationRng?JSON.stringify(e.g.simulationRng):null)!==draws)throw new Error('split consumed RNG');
    if(e.g.companyCash!==cash[0]||e.g.personalCash!==cash[1]||e.g.founderOwnershipRatio!==ratio||Math.abs(e.stock(fixture.stockID).marketCap-cap)>1e-6)throw new Error('split moved cash/ownership/market cap');
    await backend.flush();
    return {rejected,live:{declared:e.g.dividendPerShare,own:e.stock('CPTY').dividendPerShare,ext:e.stock('EXT').dividendPerShare}};
   },{fixture:f,ratios,fault});
   const factor=ratios.reduce((a,b)=>a*b,1),ownFactor=family==='own'?factor:1,extFactor=family==='external'?factor:1;
   if(proof.rejected){assert.equal(proof.rejected.dps,OWN_DPS);assert.equal(proof.rejected.ownDps,OWN_DPS);assert.equal(proof.rejected.extDps,EXT_DPS);}
   close(proof.live.declared,OWN_DPS/ownFactor,`${family} ${label} live declared dps`);close(proof.live.own,OWN_DPS/ownFactor,`${family} ${label} live own dps`);close(proof.live.ext,EXT_DPS/extFactor,`${family} ${label} live ext dps`);
   const durable=await durablePayment(browser,context,url);
   close(durable.dps.declared,OWN_DPS/ownFactor,`${family} ${label} durable declared dps`);close(durable.dps.ext,EXT_DPS/extFactor,`${family} ${label} durable ext dps`);
   close(durable.dps.declared*durable.dps.shares,baseline.dps.declared*baseline.dps.shares,`${family} ${label} own total`);
   close(durable.dps.ext*durable.dps.extIssued,baseline.dps.ext*baseline.dps.extIssued,`${family} ${label} ext total`);
   for(const key of ['personal','company','dividend','stockIncome'])close(durable.payment[key],baseline.payment[key],`${family} ${label} ${key} payment`);
   results.push({family,case:label,rejected:proof.rejected,durable,baseline:baseline.payment});
   console.log(`iPhone WebKit stock split dividend ${family} ${label} / durable-only fresh IDB / dividend week PASS`);
   fs.writeFileSync(path.join(DIR,'stock-split-dividend-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:false,results},null,2));
   await context.close();
  }
 }
 // Activist dividend proposal created before an own split: after a durable-only reload, accepting it
 // must declare the same dividend total the proposal asked for (Owner decision on #951).
 for(const ratios of [[2],[2,3]]){
  const f=await fixture('own'),outstanding=f.g.sharesOut-f.g.treasuryBuybackShares,ACTIVIST_DPS=8;
  f.g.activeActivistCampaign={id:'activist-webkit-dividend',activistName:'North Star Capital',type:'dividend',title:'配当方針の引き上げ',dividendPerShare:ACTIVIST_DPS,amount:ACTIVIST_DPS*outstanding,reason:'fixture',week:f.g.week,startedWeek:f.g.week,deadlineWeek:f.g.week+8,status:'active',response:null,support:40,pressureScore:70,difficulty:'normal'};
  f.g.governanceCommitments=[{id:'commit-webkit',campaignID:'old',type:'dividend',dueWeek:f.g.week+20,status:'active',target:ACTIVIST_DPS}];
  const context=await browser.newContext(options),p=await page(context,url);
  await p.evaluate(async({fixture,ratios})=>{const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(fixture.g);await m.saveStorageIDB.hydrate();if(!e.save())throw new Error('fixture save failed');for(const r of ratios)if(e.stockSplit('CPTY',r)!==true)throw new Error('split failed');await m.saveStorageIDB.flush();},{fixture:f,ratios});
  const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
  const fresh=await browser.newContext({...options,storageState:state}),fp=await page(fresh,url);
  const accepted=await fp.evaluate(async()=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const e=m.engine.TycoonEngine.load(),g=e.g;const terms={campaign:g.activeActivistCampaign.dividendPerShare,commitment:g.governanceCommitments[0].target,outstanding:g.sharesOut-g.treasuryBuybackShares};const ok=e.acceptShareholderProposal();return {ok,terms,declaredTotal:g.dividendPerShare*(g.sharesOut-g.treasuryBuybackShares)};});
  const factor=ratios.reduce((a,b)=>a*b,1);
  assert.equal(accepted.ok,true);close(accepted.terms.campaign,ACTIVIST_DPS/factor,'durable campaign dividendPerShare');close(accepted.terms.commitment,ACTIVIST_DPS/factor,'durable commitment target');
  close(accepted.declaredTotal,ACTIVIST_DPS*outstanding,`accept after ${ratios.join('x')} keeps the proposed total`);
  results.push({family:'own',case:`activist accept after ${ratios.join('x')}`,accepted});
  console.log(`iPhone WebKit stock split dividend activist accept after ${ratios.join(',')} / durable-only fresh IDB PASS`);
  await fresh.close();await context.close();
 }
 fs.writeFileSync(path.join(DIR,'stock-split-dividend-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));console.log('iPhone WebKit stock split dividend rescale PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
