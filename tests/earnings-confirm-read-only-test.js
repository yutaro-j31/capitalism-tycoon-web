'use strict';
// #988 (P1, Owner decision: option A). Earnings events happen only on the formal 13-week schedule of a listed
// company, from the weekly path runEarningsEventsIfNeeded(false). The market-tab 「決算イベントを確認」 action
// is read-only: it shows the latest result and guidance and changes nothing (price, market cap, trust, activist
// pressure, guidance, RNG, news/history, schedule), however often it is used in one week. A direct
// runEarningsEventsIfNeeded(true) can no longer force an event, listed or not, so the own price cannot be pumped
// and cashed out through founder or personal share sales. The weekly formula, timing and determinism are unchanged.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {scenario,economic}=require('./fixtures/stock-split-atomicity');
const {loadGame}=require('./harness');
const {indexedDBFor}=require('./fixtures/pe-fund-acquisition-faults');

async function fixture({listed=true,profit=300_000}={}){
 const s=await scenario('own'),g=s.game.g;
 Object.assign(g,{publicCompany:listed,shareholderTrust:55,activistPressure:20,earningsGuidanceRevenue:1_000_000,earningsGuidanceProfit:100_000,lastEarningsAnnouncementWeek:g.week-5});
 g.lastReport={...(g.lastReport||{}),week:g.week,sales:2_000_000,profit};
 assert.equal(s.game.save(),true);await s.backend.flush();
 return s;
}
// Everything the read-only action must never change, plus the stores and the RNG streams.
function frozen(s){return {state:JSON.stringify(s.game.g),bytes:s.backend.readSync(s.key),durable:s.durable.get(s.key),puts:s.control.attempts.length,draws:s.host.draws};}
function assertFrozen(s,before,label){
 assert.equal(JSON.stringify(s.game.g),before.state,`${label}: no state change (price, market cap, trust, activist, guidance, RNG, news, schedule)`);
 assert.equal(s.backend.readSync(s.key),before.bytes,`${label}: cache unchanged`);
 assert.equal(s.ctx.__localStorageData.get(s.key),before.bytes,`${label}: mirror unchanged`);
 assert.equal(s.durable.get(s.key),before.durable,`${label}: durable unchanged`);
 assert.equal(s.control.attempts.length,before.puts,`${label}: no save attempted`);
 assert.equal(s.host.draws,before.draws,`${label}: no host RNG`);
}
async function reloadEquals(s,label){
 await s.backend.flush();
 const wanted=JSON.stringify(economic(new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(s.game.g))).g));
 assert.equal(JSON.stringify(economic(s.engineModule.TycoonEngine.load().g)),wanted,`${label}: production reload equals live`);
 const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
 assert.equal(JSON.stringify(economic(fresh.engineModule.TycoonEngine.load().g)),wanted,`${label}: fresh durable-only hydration equals live`);
}

(async()=>{
 // 0. The UI dispatches the read-only view, never the writer.
 const app=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
 assert.match(app,/btn\('決算イベントを確認','view-earnings'/,'market tab keeps the iPhone 「決算イベントを確認」 button, now read-only');
 assert.match(app,/case 'view-earnings':openEarningsSummary\(\);break;/,'the button opens the read-only earnings view');
 assert.doesNotMatch(app,/runEarningsEventsIfNeeded|forceEarningsEvent|'force-earnings'/,'the UI never runs an earnings event');
 console.log('UI: 「決算イベントを確認」 dispatches the read-only view only PASS');

 // 1-2. Same week, used many times: the read model is stable and nothing changes.
 for(const profit of [300_000,-300_000]){
  const s=await fixture({profit}),before=frozen(s),first=JSON.stringify(s.game.earningsSummary());
  for(let i=0;i<50;i++){assert.equal(JSON.stringify(s.game.earningsSummary()),first,'the summary is a pure read');}
  for(let i=0;i<50;i++)assert.equal(s.game.runEarningsEventsIfNeeded(true),false,'a direct forced call is refused');
  assertFrozen(s,before,`listed profit=${profit}: 50 views + 50 direct forced calls`);
  await reloadEquals(s,`listed profit=${profit}`);
  console.log(`listed profit=${profit}: 50 views + 50 forced calls in one week / price, market cap, trust, guidance, RNG, news, schedule unchanged / no save / reload / fresh hydration PASS`);
 }

 // 3. Direct forced calls on an unlisted company are refused too (and the weekly path does not run for it).
 {const s=await fixture({listed:false}),before=frozen(s);
  for(let i=0;i<10;i++)assert.equal(s.game.runEarningsEventsIfNeeded(true),false,'unlisted forced call refused');
  assert.equal(s.game.runEarningsEventsIfNeeded(false),false,'unlisted company has no earnings event');
  assertFrozen(s,before,'unlisted direct calls');
  const view=s.game.earningsSummary();assert.equal(view.listed,false);assert.equal(view.weeksUntilNext,null);
  console.log('unlisted: forced and scheduled direct calls refused / nothing changed PASS');}

 // 5. No unfair extra profit: founder and personal own-share sales after many uses pay the unchanged price.
 {const s=await fixture(),g=s.game.g,price=g.stockPrice;s.game.save=()=>true;
  for(let i=0;i<2000;i++){s.game.earningsSummary();s.game.runEarningsEventsIfNeeded(true);}
  assert.equal(g.stockPrice,price,'price unchanged after 2,000 uses');assert.equal(g.market.find(x=>x.id==='CPTY').price,price);
  let cash=g.personalCash;assert.equal(s.game.sellFounderShares(10_000),true);
  assert.equal(g.personalCash-cash,10_000*price*.995,'founder sale paid at the unchanged price');
  cash=g.personalCash;assert.equal(s.game.sellStock('CPTY',1000,'personal'),true);
  assert.ok(g.personalCash-cash<=1000*price,'personal own-ticker sale gains nothing from the button');
  assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(g))).ok,true,'accounting valid');
  console.log('2,000 uses then founder / personal share sale: paid at the unchanged price, accounting valid PASS');}

 // 4. The formal quarterly event still happens on schedule, exactly once, through the weekly path.
 {const run=async()=>{const s=await fixture(),e=s.game,g=e.g,last=g.lastEarningsAnnouncementWeek,draws=s.host.draws,weeks=[];
   for(let i=0;i<30;i++){const n=g.earningsEventLog.length;e.advanceWeek(false);if(g.earningsEventLog.length>n)weeks.push(g.week);}
   assert.deepEqual(weeks,[last+13,last+26],'weekly earnings at the 13-week boundaries only');
   assert.equal(g.lastEarningsAnnouncementWeek,last+26);assert.equal(s.host.draws,draws,'no host RNG');
   assert.equal(s.modules.finance.validate(JSON.parse(JSON.stringify(g))).ok,true);
   await reloadEquals(s,'after two formal quarters');return JSON.stringify(economic(g));};
  assert.equal(await run(),await run(),'formal earnings path deterministic');
  console.log('formal 13-week earnings via advanceWeek: on schedule, once per quarter, deterministic, reload PASS');}

 // The formal event still uses the formula (guidance redrawn from simulation RNG, trust and price react).
 {const s=await fixture(),e=s.game,g=e.g;g.lastEarningsAnnouncementWeek=g.week-13;
  const rng=JSON.stringify(g.simulationRng),trust=g.shareholderTrust,price=g.stockPrice;
  assert.equal(e.runEarningsEventsIfNeeded(false),true,'due scheduled event runs');
  assert.equal(g.lastEarningsAnnouncementWeek,g.week);assert.notEqual(JSON.stringify(g.simulationRng),rng);
  assert.ok(g.shareholderTrust>trust&&g.stockPrice>price,'profitable beat raises trust and price as before');
  assert.equal(e.runEarningsEventsIfNeeded(false),false,'not twice in the same quarter');
  const view=e.earningsSummary();assert.equal(view.latest,g.earningsEventLog[0]);assert.equal(view.hasResult,true);assert.equal(view.weeksUntilNext,13);
  assert.equal(view.guidanceRevenue,g.earningsGuidanceRevenue);assert.equal(view.guidanceProfit,g.earningsGuidanceProfit);
  console.log('scheduled event: formula applied once; summary shows the latest result and new guidance PASS');}

 // The countdown shown by the view is the advance on which the weekly path really announces: overdue right after
 // an IPO (no result yet, last announcement week 0) means the very next advance.
 {const s=await fixture(),e=s.game,g=e.g;Object.assign(g,{week:100,lastEarningsAnnouncementWeek:0,earningsEventLog:[]});
  const view=e.earningsSummary();assert.deepEqual({hasResult:view.hasResult,weeksUntilNext:view.weeksUntilNext},{hasResult:false,weeksUntilNext:1});
  e.advanceWeek(false);assert.equal(g.earningsEventLog.length,1,'announced on the next advance as shown');assert.equal(e.earningsSummary().weeksUntilNext,13);
  console.log('no-result view right after IPO: countdown matches the next weekly announcement PASS');}

 // 7. Legacy saveVersion 9 without any earnings fields: loads, summary defines the "no result yet" view, no change.
 {const s=await fixture(),g=JSON.parse(JSON.stringify(s.game.g));
  for(const k of ['earningsEventLog','lastEarningsAnnouncementWeek','earningsGuidanceRevenue','earningsGuidanceProfit','activistPressure'])delete g[k];
  const legacy=new s.engineModule.TycoonEngine(g);assert.equal(legacy.g.saveVersion,9);
  const before=JSON.stringify(legacy.g),view=legacy.earningsSummary();
  assert.deepEqual({hasResult:view.hasResult,latest:view.latest,listed:view.listed},{hasResult:false,latest:null,listed:true});
  assert.equal(legacy.runEarningsEventsIfNeeded(true),false);assert.equal(JSON.stringify(legacy.g),before,'legacy: read-only');
  console.log('legacy saveVersion 9 without earnings fields: no-result view, forced call refused, nothing changed PASS');}

 console.log('Earnings confirm read-only PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
