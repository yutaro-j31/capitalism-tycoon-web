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
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];const out=path.join(DIR,'refounding-ledger-result.json');try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');const url='http://127.0.0.1:'+server.address().port+'/';
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
