'use strict';
// D4 in real iPhone WebKit + real IndexedDB: the installed purchase method (committed in a transaction) and the
// production weekly path (advanceWeek → updateCompetitors) let a competitor buy player-company shares only from the external float, up to 49%, in whole shares, paying filled ×
// price; founder shares never move and the ownership ratios stay at 1 every committed week. The committed state
// survives reload and a fresh durable-only context.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {webkit,devices}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),DIR=path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR||'artifacts/ma-deal-room-webkit');
const options={...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',serviceWorkers:'block'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost'),file=path.resolve(ROOT,u.pathname==='/'?'index.html':decodeURIComponent(u.pathname).slice(1));assert.ok(file.startsWith(ROOT+path.sep));res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
const pick=`(g)=>({week:g.week,sharesOut:g.sharesOut,treasury:g.treasuryBuybackShares,founderShares:g.founderShares,founder:g.founderOwnershipRatio,competitor:g.competitorOwnedRatio,external:g.externalShareholderRatio,
 holdings:(g.competitors||[]).map(c=>[c.id,c.ownedPlayerShares,c.cash])})`;
async function view(p){return p.evaluate(async snap=>{const m=__capitalismTycoonModules;await m.saveStorageIDB.hydrate();const g=m.engine.TycoonEngine.load().g;return {view:eval(snap)(g),saveVersion:g.saveVersion};},pick);}
(async()=>{fs.mkdirSync(DIR,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await webkit.launch();console.log('Actual WebKit '+browser.version()+' / iPhone13 emulation / real IndexedDB');
 const url='http://127.0.0.1:'+server.address().port+'/',context=await browser.newContext(options),p=await context.newPage();
 await p.goto(url,{waitUntil:'networkidle'});
 const proof=await p.evaluate(async snap=>{
  const m=__capitalismTycoonModules,key=m.engine.SAVE_KEY,view=eval(snap),e=new m.engine.TycoonEngine(m.engine.createInitialState({configured:true,seed:97531}));
  // Float = 950,000 outstanding − 850,000 founder − 95,000 competitor = 5,000 shares.
  Object.assign(e.g,{publicCompany:true,stockPrice:1000,sharesOut:1000000,treasuryBuybackShares:50000,founderShares:850000,competitorOwnedRatio:.1});
  e.updateOwnershipRatios();for(const c of e.g.competitors)c.cash=Math.max(Number(c.cash)||0,1e9);
  await m.saveStorageIDB.hydrate();if(!m.saveStorageIDB.status().available)throw new Error('real IndexedDB prerequisite failed');
  if(!e.save())throw new Error('baseline save');await m.saveStorageIDB.flush();
  // 1. The installed purchase method inside a committed transaction (bounded: the weekly 0.5% draw would take ~190
  //    weeks to hit with this seed). Desired 5,000 shares twice from a 5,000-share float: fill 5,000, then 0.
  const c=e.g.competitors[0],calls=[];
  for(let i=0;i<2;i++){const cash=c.cash,price=e.g.stockPrice;let f;
   if(e.runTransaction(()=>{f=e.buyCompetitorStake(c);e.updateOwnershipRatios();return true;})!==true)throw new Error('purchase commit failed');
   calls.push({paid:cash-c.cash,filled:f,price});await m.saveStorageIDB.flush();}
  if(calls[0].filled!==5000||calls[1].filled!==0||calls[1].paid!==0)throw new Error('fill/partial/zero '+JSON.stringify(calls));
  // 2. The production weekly path keeps the invariants on every committed week.
  for(let w=0;w<12;w++){
   if(e.advanceWeek(false)===false)throw new Error('week '+w+' did not advance');
   const g=e.g,sum=g.founderOwnershipRatio+g.competitorOwnedRatio+g.externalShareholderRatio;
   if(Math.abs(sum-1)>1e-9||g.competitorOwnedRatio>.49+1e-9||g.founderShares!==850000)throw new Error('week '+w+' invariant '+JSON.stringify(view(g)));
  }
  for(const x of calls)if(Math.abs(x.paid-x.filled*x.price)>=.1)throw new Error('cash paid != filled × price '+JSON.stringify(x));
  const filled=calls.reduce((a,x)=>a+x.filled,0),named=e.g.competitors.reduce((a,x)=>a+(Number(x.ownedPlayerShares)||0),0);
  if(filled>5000||named<filled)throw new Error('filled beyond the float or holdings drift '+JSON.stringify({filled,named}));
  await m.saveStorageIDB.flush();
  if(key!=='capitalism_tycoon_web_v1'||e.g.saveVersion!==9)throw new Error('save identity');
  return {calls:calls.length,filled,live:view(new m.engine.TycoonEngine(JSON.parse(JSON.stringify(e.g))).g)};
 },pick);
 console.log(`iPhone WebKit competitor purchase: ${proof.filled} shares filled from a 5,000-share float then a zero fill, cash = filled × price; 12 weekly commits keep ratios at 1 PASS`);
 await p.reload({waitUntil:'networkidle'});const r=await view(p);assert.equal(r.saveVersion,9);assert.deepEqual(r.view,proof.live,'reload');
 const state=await context.storageState({indexedDB:true});for(const origin of state.origins)origin.localStorage=[];
 const fresh=await browser.newContext({...options,storageState:state}),fp=await fresh.newPage();await fp.goto(url,{waitUntil:'networkidle'});
 assert.deepEqual((await view(fp)).view,proof.live,'fresh durable-only');await fresh.close();await context.close();
 console.log('iPhone WebKit competitor stake: reload / fresh real IDB PASS');
 fs.writeFileSync(path.join(DIR,'competitor-stake-float-result.json'),JSON.stringify({physicalDevice:false,device:'iPhone13',ok:true,attempts:proof.calls,filled:proof.filled},null,2));
 console.log('iPhone WebKit competitor stake float PASS');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
