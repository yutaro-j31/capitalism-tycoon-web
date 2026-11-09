'use strict';
// #968 in real iPhone WebKit + real IndexedDB: refounding after a company sale (built in Node with production writers,
// with a company-owned and a personally owned PE deal) opens the new company's book at the founder's contribution.
// Accounting is valid at once and for 13 weeks, personal cash is debited once, the sold company's PE deal is not
// carried, and reload and a fresh durable-only context agree on the ledger. (Save-fault atomicity of the refounding
// writer is #955 / PR #965.)
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const {soldCompany,INVESTMENT}=require('./fixtures/refounding-ledger');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
const pick=`(g)=>JSON.stringify({companyName:g.companyName,companyCash:g.companyCash,personalCash:g.personalCash,finance:g.finance,peDeals:g.peDeals,subsidiaries:g.subsidiaries,saveVersion:g.saveVersion})`;
async function loaded(p,expected,label){
 const actual=await p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),valid:m.finance.validate(JSON.parse(JSON.stringify(g))).ok};},pick);
 assert.equal(actual.view,expected,label);assert.equal(actual.valid,true,`${label} accounting valid`);
}
async function run(browser,url,state,mode){
 const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});
 const proof=await p.evaluate(async({state,mode,snap,INVESTMENT})=>{
  const m=__capitalismTycoonModules,e=new m.engine.TycoonEngine(JSON.parse(state)),backend=m.saveStorageIDB,key=m.engine.SAVE_KEY,view=eval(snap);
  const valid=label=>{const c=m.finance.validate(JSON.parse(JSON.stringify(e.g)));if(!c.ok)throw new Error(label+' accounting invalid '+JSON.stringify(c.errors));};
  await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');if(!e.save())throw new Error('baseline save failed');await backend.flush();
  const kept=d=>!(d.ownerAccount==='company'&&d.status==='active'),personal=e.g.personalCash,personalDeals=JSON.stringify(e.g.peDeals.filter(kept).map(d=>d.id));
  if(e.foundNewCompanyAfterBuyout('新会社',INVESTMENT,mode)!==true)throw new Error('refounding refused');
  const f=e.g.finance;
  if(e.g.companyCash!==INVESTMENT||f.openingCash!==INVESTMENT||f.openingEquity!==INVESTMENT)throw new Error('book does not open at the contribution '+JSON.stringify({cash:e.g.companyCash,open:f.openingCash,eq:f.openingEquity}));
  if(e.g.personalCash!==personal-INVESTMENT)throw new Error('personal cash not debited exactly once');
  if(e.g.peDeals.some(d=>!kept(d)))throw new Error('active company PE deal carried into the new company');
  if(JSON.stringify(e.g.peDeals.map(d=>d.id))!==personalDeals)throw new Error('personal PE deals changed');
  valid('right after refounding');
  const start=e.g.week;while(e.g.week<start+13){if(e.advanceWeek(false)===false)throw new Error('week '+(e.g.week+1)+' refused');valid('week '+e.g.week);}
  await backend.flush();if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  return {expected:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g),signature:{cash:e.g.companyCash,rng:JSON.stringify(e.g.simulationRng),week:e.g.week}};
 },{state,mode,snap:pick,INVESTMENT});
 await p.reload({waitUntil:'networkidle'});await loaded(p,proof.expected,`${mode} reload`);
 const storage=await context.storageState({indexedDB:true});for(const origin of storage.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:storage}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 await loaded(fp,proof.expected,`${mode} fresh durable-only`);
 await fresh.close();await context.close();
 return proof;
}
async function runCompanySaleFault(browser,url,command,fault){
 const context=await browser.newContext(options),p=await context.newPage();await p.goto(url,{waitUntil:'networkidle'});
 const proof=await p.evaluate(async({command,fault})=>{
  const m=__capitalismTycoonModules,backend=m.saveStorageIDB,key=m.engine.SAVE_KEY;
  const state=m.engine.createInitialState({configured:true,seed:135101,companyName:'G1 WebKit Sale',playerName:'Owner'});
  Object.assign(state,{week:20,companyCash:100000000,companyDebt:0,personalCash:100000000,publicCompany:true,sharesOut:100000,
   founderShares:60000,treasuryBuybackShares:0,competitorOwnedRatio:0,stockPrice:100,ticker:'CPTY',isCompanySold:false});
  state.market=state.market.filter(row=>row.id!=='CPTY');
  state.market.push({id:'CPTY',name:state.companyName,sector:'コングロマリット',price:100,previous:100,issuedShares:100000,
   marketCap:10000000,dividendYield:0,volatility:0,trend:0,dividendPerShare:0,priceHistory:[{week:20,price:100}]});
  state.personalStocks={CPTY:{qty:10000,avg:100}};state.finance=m.finance.defaultFinanceState(state);
  const e=new m.engine.TycoonEngine(state);
  e.updateOwnershipRatios();
  e.g.inboundBuyoutOffers=[{id:'offer',bidderName:'Rival',offerAmount:500000000,premiumRate:1.3,createdWeek:20,expiresWeek:28,
   hostile:false,status:'pending'}];
  await backend.hydrate();if(!backend.status().available)throw new Error('real IndexedDB prerequisite failed');
  if(!e.save())throw new Error('baseline save failed');await backend.flush();
  const before=JSON.stringify(e.g),durableBefore=await backend.readDurable(key),save=e.save;
  let result,thrown='';
  e.save=fault==='save-false'?()=>false:()=>{throw new Error('company sale save threw');};
  try{result=command==='inbound'?e.acceptInboundBuyoutOffer('offer'):e.acceptBuyoutOffer(1.2);}catch(error){thrown=String(error?.message||error);}
  finally{e.save=save;}
  if(fault==='save-false'&&result!==false)throw new Error('rejected save accepted');
  if(fault==='save-throw'&&!/company sale save threw/.test(thrown))throw new Error('throwing save did not escape');
  if(JSON.stringify(e.g)!==before)throw new Error('failed company sale changed live state');
  if(localStorage.getItem(key)!==before||backend.readSync(key)!==before)throw new Error('failed company sale changed mirror/cache');
  await backend.flush();if(await backend.readDurable(key)!==durableBefore)throw new Error('failed company sale changed durable bytes');
  const cash=e.g.personalCash,expectedIncrease=command==='inbound'?350000000:Math.ceil(e.companyValue()*1.2*.7);
  result=command==='inbound'?e.acceptInboundBuyoutOffer('offer'):e.acceptBuyoutOffer(1.2);
  if(result!==true||!e.g.isCompanySold||e.g.personalStocks.CPTY!==undefined)throw new Error('retry did not settle the lot once');
  if(e.g.personalCash-cash!==expectedIncrease)throw new Error('retry proceeds mismatch');
  await backend.flush();
  return {expected:JSON.stringify(e.g),command,fault,expectedIncrease};
 },{command,fault});
 await p.reload({waitUntil:'networkidle'});
 assert.equal(await p.evaluate(async()=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();return JSON.stringify(m.engine.TycoonEngine.load().g);}),proof.expected,`${command}/${fault} reload`);
 const storage=await context.storageState({indexedDB:true});for(const origin of storage.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:storage}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 assert.equal(await fp.evaluate(async()=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();return JSON.stringify(m.engine.TycoonEngine.load().g);}),proof.expected,`${command}/${fault} fresh durable-only`);
 await fresh.close();await context.close();return proof;
}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];const out=path.join(DIR,'refounding-ledger-result.json');try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
 for(const command of ['inbound','settings'])for(const fault of ['save-false','save-throw']){
  const sale=await runCompanySaleFault(browser,url,command,fault);results.push({...sale,reload:'PASS',freshDurableOnly:'PASS'});
  console.log(`iPhone WebKit company sale ${command} ${fault} / own lot rollback + retry / reload / fresh real IDB PASS`);
 }
 const ctx=await soldCompany({companyPE:true,personalPE:true}),state=JSON.stringify(ctx.game.g);
 for(const mode of ['store','digital']){
  const first=await run(browser,url,state,mode),second=await run(browser,url,state,mode);
  assert.deepEqual(second.signature,first.signature,`${mode}: same state, same refounding`);
  results.push({mode,signature:first.signature,reload:'PASS',freshDurableOnly:'PASS'});
  console.log(`iPhone WebKit refounding ${mode} x2 / book opens at the contribution / personal cash once / no company PE carried / 13 weeks / reload / fresh real IDB / deterministic PASS`);
 }
 fs.writeFileSync(out,JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,results},null,2));
 console.log('iPhone WebKit refounding ledger PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
