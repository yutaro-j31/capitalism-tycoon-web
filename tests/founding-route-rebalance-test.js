'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
function lcg(seed=190826041){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/2**32;};}
function run(businessID,{weeks=500,expand=true}={}){
  const {ctx}=loadGame({random:lcg(),headless:true}),engine=new ctx.__ct_headlessEngineClass();
  engine.save=()=>{};engine.configure({playerName:'Tester',companyName:`${businessID} Co`,difficulty:'normal',scenario:'free'});engine.g.skipWeeklyValidation=true;
  let reached=null,minCash=engine.g.companyCash,maxStores=0;const profits=[];
  const tenant=()=>engine.g.tenants.filter(t=>!t.occupiedBy).sort((a,b)=>{const score=t=>engine.pref(t.prefID).traffic*engine.area(engine.pref(t.prefID).areaID).traffic;return score(b)-score(a)||String(a.id).localeCompare(String(b.id));})[0];
  function open(){const t=tenant();if(!t)return false;const b=engine.business(businessID),cost=b.storeCost+t.deposit;if(engine.g.stores.length&&(!expand||engine.g.companyCash<=cost*3))return false;return engine.openStore({tenantID:t.id,businessID,name:`${businessID}-${engine.g.stores.length+1}`,operatingHours:3});}
  open();
  while(engine.g.week<weeks&&!engine.g.gameOver){engine.advanceWeek(false);profits.push(engine.g.lastReport?.profit||0);minCash=Math.min(minCash,engine.g.companyCash);maxStores=Math.max(maxStores,engine.g.stores.length);if(reached===null&&engine.companyValue()>=1e9)reached=engine.g.week;if(engine.g.week%4===0&&profits.slice(-8).reduce((a,n)=>a+n,0)/Math.min(8,profits.length)>0)open();}
  return {week:engine.g.week,reached,gameOver:engine.g.gameOver,cash:engine.g.companyCash,value:engine.companyValue(),stores:engine.g.stores.length,maxStores,minCash,last8:profits.slice(-8),storeIDs:engine.g.stores.map(s=>s.id),profits};
}
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
if(!isMainThread){parentPort.postMessage(run(workerData.businessID,workerData.options));}
else{
  const worker=(businessID,options)=>new Promise((resolve,reject)=>{const w=new Worker(__filename,{workerData:{businessID,options}});w.once('message',resolve);w.once('error',reject);w.once('exit',code=>{if(code)reject(new Error(`worker ${businessID} exited ${code}`));});});
  (async()=>{
    const ids=['ramen','conveni','gym','realEstateAgency'];
    const rows=await Promise.all(ids.map(id=>worker(id,{weeks:500,expand:true})));
    const results=Object.fromEntries(ids.map((id,index)=>[id,rows[index]]));
    console.log(`FOUNDING_ROUTE_CALIBRATION ${JSON.stringify(results,(key,value)=>key==='profits'||key==='storeIDs'?undefined:value)}`);
    assert.ok(results.ramen.reached>=200&&results.ramen.reached<=300,`ramen reaches 1B in design range: ${results.ramen.reached}`);
    for(const [id,row] of Object.entries(results)){assert.equal(row.gameOver,false,`${id} survives 500 weeks`);assert.equal(row.week,500,`${id} reaches week 500`);assert.ok(row.last8.reduce((a,n)=>a+n,0)/8>=0,`${id} has no late structural loss`);}
    const [a,b]=await Promise.all([worker('conveni',{weeks:80}),worker('conveni',{weeks:80})]);
    assert.equal(JSON.stringify({cash:a.cash,value:a.value,stores:a.stores,storeIDs:a.storeIDs,profits:a.profits,reached:a.reached,gameOver:a.gameOver}),JSON.stringify({cash:b.cash,value:b.value,stores:b.stores,storeIDs:b.storeIDs,profits:b.profits,reached:b.reached,gameOver:b.gameOver}),'same founding actions are deterministic');
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
