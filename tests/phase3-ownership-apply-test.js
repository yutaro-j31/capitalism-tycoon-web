'use strict';
// P3-4 dormant applyOwnershipPlan: applies a planner result only inside an active outer transaction, only when it is
// exactly the plan for the current state, with synchronous quantity/mirror writes and no clock, RNG, save or emit. No
// installed writer calls it, so loading the runtime changes nothing; a real engine transaction commits or restores it.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const constants=Object.freeze({PLAYER_COMPANY_ENTITY_ID:'entity:company:player',FOUNDER_ENTITY_ID:'entity:person:founder',PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID:'security:player-company:common'});
const registry={economicReadModel:constants};
const ctx=vm.createContext({__capitalismTycoonModules:registry});
vm.runInContext(`Date=new Proxy(function(){},{apply(){throw Error('clock');},construct(){throw Error('clock');},get(){throw Error('clock');}});Math.random=()=>{throw Error('RNG');};`,ctx);
vm.runInContext(read('js/phase3-ownership-planner.js'),ctx,{filename:'phase3-ownership-planner.js'});
vm.runInContext(read('js/phase3-ownership-apply.js'),ctx,{filename:'phase3-ownership-apply.js'});
const planner=registry.phase3OwnershipPlanner,api=registry.phase3OwnershipApply,apply=api.applyOwnershipPlan;
const plain=x=>JSON.parse(JSON.stringify(x));

assert.deepEqual(Object.keys(api).sort(),['ACTIVATION','KINDS','VERSION','applyOwnershipPlan','beginOwnershipLeg','confirmOwnershipLeg']);
assert.equal(api.ACTIVATION,'disabled');assert.ok(Object.isFrozen(api));
assert.deepEqual(plain(api.KINDS),['personal-buy','personal-sell','founder-sale','external-issue','buyback','split']);
assert.equal(planner.applyOwnershipPlan,undefined,'the planner stays read-only');

function state(){return {currentCompanySerial:1,isCompanySold:false,publicCompany:true,companyName:'Own',ticker:'OWN',sharesOut:1000,founderShares:600,treasuryBuybackShares:100,
 personalStocks:{OWN:{qty:10,avg:123},X:{qty:20,avg:34}},companyStocks:{X:{qty:30,avg:45}},market:[{id:'OWN',issuedShares:1000,price:99},{id:'X',issuedShares:2000}],startups:[],companyCash:5000};}
function scope(){return {family:'player-common',issuerEntityId:constants.PLAYER_COMPANY_ENTITY_ID,securityClassId:constants.PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID,currentCompanySerial:1};}
const changedOf={'personal-buy':['personalOwnShares'],'personal-sell':['personalOwnShares'],'founder-sale':['founderShares'],'external-issue':['sharesOut'],buyback:['treasuryBuybackShares'],
 split:['sharesOut','treasuryBuybackShares','founderShares','personalOwnShares'],ipo:['sharesOut','founderShares']};
function planFor(s,writerId,kind,change){
 const e=planner.inspectOwnershipAuthority(s,scope());assert.equal(e.status,'OBSERVED');
 const account=['personal-buy','personal-sell','founder-sale'].includes(kind)?'personal':kind==='ipo'?'company-and-personal':'company';
 const p=planner.planOwnershipChange(s,{scope:scope(),writerId,kind,operationId:'operation-1',account,sourceLots:changedOf[kind].map(k=>e.sourcePaths[k]),
  expected:{sourceState:s,sourceFingerprint:e.sourceFingerprint,quantities:{sharesOut:e.quantities.sharesOut,treasuryBuybackShares:e.quantities.treasuryBuybackShares,
   founderShares:e.quantities.founderShares,personalOwnShares:e.quantities.personalOwnShares}},change});
 assert.equal(p.status,'PLANNED',JSON.stringify(p));return p;
}
function engine(s,active=true){return {g:s,inTransaction(){return active;},save(){throw Error('apply may not save');},emit(){throw Error('apply may not emit');},notify(){throw Error('apply may not notify');}};}
// Independently written expected writes for each supported fact leg.
const cases=[
 ['W-BUY','personal-buy',{quantity:5},s=>{s.personalStocks.OWN.qty=15;}],
 ['W-SELL','personal-sell',{quantity:4},s=>{s.personalStocks.OWN.qty=6;}],
 ['W-MARGIN-LIQ','personal-sell',{quantity:10},s=>{s.personalStocks.OWN.qty=0;}],
 ['W-FOUNDER-SALE','founder-sale',{quantity:50},s=>{s.founderShares=550;}],
 ['W-INVESTOR','external-issue',{quantity:200},s=>{s.sharesOut=1200;s.market[0].issuedShares=1200;}],
 ['W-SHARE-SWAP','external-issue',{quantity:300},s=>{s.sharesOut=1300;s.market[0].issuedShares=1300;}],
 ['W-BUYBACK','buyback',{quantity:25},s=>{s.treasuryBuybackShares=125;}],
 ['W-SPLIT','split',{factor:3},s=>{s.sharesOut=3000;s.treasuryBuybackShares=300;s.founderShares=1800;s.personalStocks.OWN.qty=30;s.market[0].issuedShares=3000;}]
];
for(const [writerId,kind,change,expect] of cases){
 const label=writerId+'/'+kind,s=state(),p=planFor(s,writerId,kind,change),untouched=plain(s);
 // Outside an active outer transaction nothing is written.
 assert.equal(apply(engine(s,false),p),false,label+' outside a transaction');assert.deepEqual(plain(s),untouched);
 assert.equal(apply({g:s},p),false,label+' without a transaction boundary');assert.deepEqual(plain(s),untouched);
 const result=apply(engine(s),p);
 assert.equal(result.status,'APPLIED',label);assert.equal(result.activation,'disabled');assert.ok(Object.isFrozen(result));
 assert.deepEqual(plain(result.after),plain(p.after));assert.deepEqual(plain(result.updates),plain(p.updates));
 const expected=state();expect(expected);assert.deepEqual(plain(s),expected,label+' writes exactly the planned quantities and mirror');
 // The applied plan is stale for the new state: replay cannot apply twice.
 assert.equal(apply(engine(s),p),false,label+' replay');assert.deepEqual(plain(s),expected);
 const reinspected=planner.inspectOwnershipAuthority(s,scope());assert.equal(reinspected.status,'OBSERVED');
 for(const k of planner.BUCKETS)assert.equal(reinspected.quantities[k],p.after[k],label+'/'+k);
}
// Stale, forged, unsupported and incomplete plans write nothing.
{
 const s=state(),p=planFor(s,'W-INVESTOR','external-issue',{quantity:200});
 s.founderShares=599;const changed=plain(s);
 assert.equal(apply(engine(s),p),false,'stale source');assert.deepEqual(plain(s),changed);
}
{
 const s=state(),p=planFor(s,'W-INVESTOR','external-issue',{quantity:200}),before=plain(s);
 for(const forge of [x=>{x.after.sharesOut=1300;},x=>{x.updates[0].after=1300;},x=>{x.mirrors[0].after=999;},x=>{x.sourceFingerprint+=' ';},
  x=>{x.status='OBSERVED';},x=>{x.kind='ipo';},x=>{x.before.founderShares=0;},x=>{x.account='personal';}]){
  const forged=plain(p);forge(forged);assert.equal(apply(engine(s),forged),false,JSON.stringify(forged).slice(0,80));assert.deepEqual(plain(s),before);
 }
 // A plan is identified by its content: another admissible writer or operation ID for the same fact leg is that
 // writer's own plan, and applies as such (the identifier is not a lifecycle or idempotency receipt).
 for(const relabel of [x=>{x.operationId='operation-2';},x=>{x.writerId='W-SPONSOR';}]){
  const t=state(),q=plain(planFor(t,'W-INVESTOR','external-issue',{quantity:200}));relabel(q);
  const r=apply(engine(t),q);assert.equal(r.status,'APPLIED');assert.equal(r.operationId,q.operationId);assert.equal(r.writerId,q.writerId);assert.equal(t.sharesOut,1200);
 }
 // A JSON copy of the genuine plan is still the genuine plan: application compares, it does not trust identity.
 assert.equal(apply(engine(s),plain(p)).status,'APPLIED');
}
{
 const s=state();s.publicCompany=false;s.market=[];const before=plain(s);
 const p=planFor(s,'W-IPO-CHAIN','ipo',{issuedQuantity:100,founderSecondaryQuantity:20,listingTicker:'OWN'});
 assert.equal(apply(engine(s),p),false,'IPO stays with the existing listing writer');assert.deepEqual(plain(s),before);
}
{
 const s=state();delete s.personalStocks.OWN;const before=plain(s),p=planFor(s,'W-BUY','personal-buy',{quantity:5});
 assert.equal(apply(engine(s),p),false,'lot creation stays with the existing writer');assert.deepEqual(plain(s),before);
}
for(const bad of [null,undefined,{},{status:'PLANNED'},'PLANNED',[]]){const s=state(),before=plain(s);assert.equal(apply(engine(s),bad),false);assert.deepEqual(plain(s),before);}
for(const bad of [null,{},{g:null,inTransaction(){return true;}},{g:state(),inTransaction(){throw Error('boundary');}}]){
 const s=state(),p=planFor(s,'W-BUYBACK','buyback',{quantity:1});assert.equal(apply(bad,p),false);
}

// Verification legs: a plannable leg must leave exactly the planned quantities; an unplannable one is not checked.
{
 const begin=api.beginOwnershipLeg,confirm=api.confirmOwnershipLeg;
 const leg={writerId:'W-FOUNDER-SALE',kind:'founder-sale',operationId:'founder-sale-1',change:{quantity:50}};
 const s=state(),before=plain(s);
 assert.equal(begin(engine(s,false),leg),null,'no leg outside a transaction');
 const handle=begin(engine(s),leg);assert.equal(handle.plan.status,'PLANNED');assert.deepEqual(plain(s),before,'planning writes nothing');
 assert.equal(confirm(engine(s),handle),false,'nothing written yet');
 s.founderShares=549;assert.equal(confirm(engine(s),handle),false,'a different quantity is rejected');
 s.founderShares=550;assert.equal(confirm(engine(s),handle),true,'the planned quantity is confirmed');
 s.sharesOut=1001;assert.equal(confirm(engine(s),handle),false,'an unplanned bucket change or mirror mismatch is rejected');
 for(const unplannable of [t=>{t.currentCompanySerial=2;},t=>{t.publicCompany=false;t.market=[];},t=>{t.founderShares=10;}]){
  const t=state();unplannable(t);const h=begin(engine(t),leg);assert.equal(h,null);assert.equal(confirm(engine(t),h),true,'unplannable legs keep existing behaviour');
 }
 assert.equal(begin(engine(state()),{...leg,kind:'ipo'}),null);assert.equal(begin(engine(state()),null),null);
}

// The installed runtime registers the module without routing a writer to it, and a real engine transaction commits or
// restores the applied quantities with the rest of its command.
const { boot } = require('./fixtures/subsidiary-quarter-close');
(async()=>{
 const s=boot();await s.backend.hydrate();
 assert.equal(s.modules.phase3OwnershipApply.ACTIVATION,'disabled');
 const order=JSON.parse(read('tests/fixtures/module-load-order.json'));
 const list=Object.values(order).find(Array.isArray)||order;
 assert.equal(list.indexOf('./js/phase3-ownership-apply.js'),list.indexOf('./js/phase3-ownership-planner.js')+1,'loads right after the planner');
 const sources=fs.readdirSync(path.join(ROOT,'js')).filter(f=>f.endsWith('.js')&&f!=='phase3-ownership-apply.js');
 for(const f of sources)assert.ok(!read('js/'+f).includes('applyOwnershipPlan'),f+' must not route to the dormant apply');
 // Verification legs are routed only through the reviewed writers.
 const routed=sources.filter(f=>read('js/'+f).includes('beginOwnershipLeg'));
 assert.deepEqual(routed,['engine.js','expansion.js','player-crisis-actions.js','shareholder-returns.js']);
 assert.equal((read('js/expansion.js').match(/beginOwnershipLeg\(/g)||[]).length,2,'expansion.js: W-SPLIT and W-FOUNDER-SALE only');
 assert.equal((read('js/engine.js').match(/beginOwnershipLeg\(/g)||[]).length,2,'engine.js: W-BUY and W-SELL only');
 assert.equal((read('js/shareholder-returns.js').match(/beginOwnershipLeg\(/g)||[]).length,1,'shareholder-returns.js: W-BUYBACK only');
 assert.equal((read('js/player-crisis-actions.js').match(/beginOwnershipLeg\(/g)||[]).length,1,'player-crisis-actions.js: W-SPONSOR only');
 const game=new s.engineModule.TycoonEngine();
 game.configure({playerName:'T',companyName:'Apply',difficulty:'normal',scenario:'free',simulationSeed:971});
 assert.equal(game.save(),true);await s.backend.flush();
 const real=s.modules.phase3OwnershipPlanner,run=s.modules.phase3OwnershipApply.applyOwnershipPlan;
 function realPlan(){
  const e=real.inspectOwnershipAuthority(game.g,scope());assert.equal(e.status,'OBSERVED',JSON.stringify(e));
  const q=e.quantities;
  return real.planOwnershipChange(game.g,{scope:scope(),writerId:'W-INVESTOR',kind:'external-issue',operationId:'investor-offer-1',account:'company',sourceLots:[e.sourcePaths.sharesOut],
   expected:{sourceState:game.g,sourceFingerprint:e.sourceFingerprint,quantities:{sharesOut:q.sharesOut,treasuryBuybackShares:q.treasuryBuybackShares,founderShares:q.founderShares,personalOwnShares:q.personalOwnShares}},
   change:{quantity:1000}});
 }
 const prior=JSON.stringify(game.g),sharesOut=game.g.sharesOut,bytes=s.backend.readSync(s.key);
 assert.equal(run(game,realPlan()),false,'outside the outer transaction');assert.equal(JSON.stringify(game.g),prior);
 // The enclosing command fails after applying: the outer transaction restores the quantities with everything else.
 assert.equal(game.runTransaction(()=>{assert.equal(run(game,realPlan()).status,'APPLIED');assert.equal(game.g.sharesOut,sharesOut+1000);return false;}),false);
 assert.equal(JSON.stringify(game.g),prior,'rejected command restores the applied quantities');
 await s.backend.flush();assert.equal(s.backend.readSync(s.key),bytes,'nothing durable');
 // The enclosing command succeeds: the quantities commit once, with the command's own save.
 assert.equal(game.runTransaction(()=>run(game,realPlan()).status==='APPLIED'),true);
 assert.equal(game.g.sharesOut,sharesOut+1000);await s.backend.flush();
 assert.equal(JSON.parse(s.backend.readSync(s.key)).sharesOut,sharesOut+1000,'committed quantities are durable');
 // W-FOUNDER-SALE routed in verification mode: unchanged success, a diverging write is rejected and rolled back, and a
 // refounded (second-generation) company keeps the existing sale.
 function listed(serial=1){
  const st=s.engineModule.createInitialState({configured:true});
  Object.assign(st,{week:12,publicCompany:true,sharesOut:1000000,founderShares:600000,treasuryBuybackShares:0,stockPrice:100,ticker:'CPTY',currentCompanySerial:serial,companyCash:5e9});
  st.market=st.market.filter(x=>x.id!=='CPTY');st.market.push({id:'CPTY',name:st.companyName,price:100,issuedShares:1000000,priceHistory:[{week:12,price:100}]});
  st.personalStocks.CPTY={qty:20000,avg:100};st.finance=s.modules.finance.defaultFinanceState(st);
  return new s.engineModule.TycoonEngine(st);
 }
 {
  const g=listed(),cash=g.g.personalCash;
  assert.equal(g.sellFounderShares(1000),true);assert.equal(g.g.founderShares,599000);assert.equal(g.g.personalCash,cash+1000*100*.995);
  const bad=listed(),prior=JSON.stringify(bad.g),ratios=bad.updateOwnershipRatios;
  bad.updateOwnershipRatios=function(...args){this.g.founderShares-=1;return ratios.apply(this,args);};
  assert.equal(bad.sellFounderShares(1000),false,'a founder write that diverges from the plan is rejected');
  assert.equal(JSON.stringify(bad.g),prior,'and the whole sale is rolled back');
  const second=listed(2);
  assert.equal(s.modules.phase3OwnershipPlanner.inspectOwnershipAuthority(second.g,scope()).status,'REJECTED');
  assert.equal(second.sellFounderShares(1000),true,'second generation keeps the existing sale');assert.equal(second.g.founderShares,599000);
 }
 // W-BUY / W-SELL routed in verification mode for personal trades of the player's own shares: unchanged success,
 // a diverging lot write is rejected and rolled back, and other tickers, the company account and a second generation
 // keep the existing trade.
 {
  const g=listed(),cash=g.g.personalCash;
  assert.equal(g.buyStock('CPTY',100),true);assert.equal(g.g.personalStocks.CPTY.qty,20100);assert.ok(g.g.personalCash<cash);
  assert.equal(g.sellStock('CPTY',100),true);assert.equal(g.g.personalStocks.CPTY.qty,20000);
  assert.equal(g.sellStock('CPTY',20000),true);assert.equal(g.g.personalStocks.CPTY,undefined,'an exhausted lot is deleted as before');
  assert.equal(g.buyStock('CPTY',50),true,'a new lot is created as before');assert.equal(g.g.personalStocks.CPTY.qty,50);
  for(const side of ['buyStock','sellStock']){
   const bad=listed(),prior=JSON.stringify(bad.g);
   // Simulate a writer bug in the quantity write itself: the trade's lot write ends one share off the plan. Only that
   // first write is skewed; the transaction's in-place restore must still bring every field back.
   let armed=true;
   bad.g.personalStocks.CPTY=new Proxy(bad.g.personalStocks.CPTY,{set(target,key,value){target[key]=key==='qty'&&armed?value+1:value;if(key==='qty')armed=false;return true;}});
   assert.equal(bad[side]('CPTY',100),false,side+': a lot write that diverges from the plan is rejected');
   assert.equal(JSON.stringify(bad.g),prior,side+': and the whole trade is rolled back');
  }
  const other=listed(),ids=other.g.market.filter(x=>x.id!=='CPTY'&&x.issuedShares>0).map(x=>x.id);
  assert.equal(other.buyStock(ids[0],10),true,'another ticker is not an own-share leg');
  const second=listed(2);assert.equal(second.buyStock('CPTY',100),true,'second generation keeps the existing purchase');
  assert.equal(second.sellStock('CPTY',100),true,'second generation keeps the existing sale');
 }
 // W-SPLIT routed in verification mode for splits of the player's own shares: unchanged success, a diverging bucket
 // write is rejected and rolled back, and another ticker and a second generation keep the existing split.
 {
  const g=listed();
  assert.equal(g.stockSplit('CPTY',2),true);
  assert.deepEqual([g.g.sharesOut,g.g.founderShares,g.g.treasuryBuybackShares,g.g.personalStocks.CPTY.qty,g.stock('CPTY').issuedShares],
   [2000000,1200000,0,40000,2000000]);
  assert.equal(g.stockSplit('CPTY',3),true,'a later split plans against the split quantities');assert.equal(g.g.sharesOut,6000000);
  const bad=listed(),prior=JSON.stringify(bad.g);
  let armed=true;
  bad.g.personalStocks.CPTY=new Proxy(bad.g.personalStocks.CPTY,{set(target,key,value){target[key]=key==='qty'&&armed?value+1:value;if(key==='qty')armed=false;return true;}});
  assert.equal(bad.stockSplit('CPTY',2),false,'a bucket write that diverges from the plan is rejected');
  assert.equal(JSON.stringify(bad.g),prior,'and the whole split is rolled back');
  const other=listed(),id=other.g.market.find(x=>x.id!=='CPTY'&&x.price/2>=10).id,issued=other.stock(id).issuedShares;
  assert.equal(other.stockSplit(id,2),true,'another ticker is not an own-share leg');assert.equal(other.stock(id).issuedShares,issued*2);
  const second=listed(2);assert.equal(second.stockSplit('CPTY',2),true,'second generation keeps the existing split');
  assert.equal(second.g.sharesOut,2000000);
 }
 // W-BUYBACK routed in verification mode through the installed buybackOwnShares: unchanged success, a diverging
 // treasury write is rejected and rolled back, and a second generation keeps the existing buyback.
 {
  const g=listed(),cash=g.g.companyCash;
  assert.equal(g.buybackOwnShares(1000000),true);assert.equal(g.g.treasuryBuybackShares,10000);assert.equal(g.g.companyCash,cash-1000000);
  assert.equal(g.stock('CPTY').issuedShares,1000000,'issued mirror unchanged');
  assert.equal(g.buybackOwnShares(1000000),true,'a later buyback plans against the bought-back quantity');assert.ok(g.g.treasuryBuybackShares>10000);
  // buybackOwnShares builds the derived statement cache before its transaction (existing behaviour, W-BUYBACK
  // inventory row), so the rollback baseline is taken after the same read.
  const bad=listed();bad.shareholderReturnCapacity();
  const prior=JSON.stringify(bad.g),ratios=bad.updateOwnershipRatios;
  bad.updateOwnershipRatios=function(...args){this.g.treasuryBuybackShares+=1;return ratios.apply(this,args);};
  assert.equal(bad.buybackOwnShares(1000000),false,'a treasury write that diverges from the plan is rejected');
  assert.equal(JSON.stringify(bad.g),prior,'and the whole buyback is rolled back');
  const second=listed(2);assert.equal(second.buybackOwnShares(1000000),true,'second generation keeps the existing buyback');
  assert.equal(second.g.treasuryBuybackShares,10000);
 }
 // W-SPONSOR routed in verification mode through requestSponsorInjection on a distressed unlisted company (the state of
 // tests/fixtures/sponsor-injection-atomicity.js): unchanged success, a diverging issued-share write is rejected and
 // rolled back, and a second generation keeps the existing injection.
 function distressed(serial=1){
  const st=s.engineModule.createInitialState({configured:true});
  Object.assign(st,{week:2,companyCash:-1000000,personalCash:10000000,companyCredit:80,currentCompanySerial:serial});
  Object.assign(st.properties[0],{owner:'company',purchasePrice:100000000,price:100000000,value:100000000});
  st.finance=s.modules.finance.defaultFinanceState(st);s.modules.playerCrisis.evaluate(st);
  return new s.engineModule.TycoonEngine(st);
 }
 {
  const g=distressed();
  assert.equal(g.requestSponsorInjection(),true);assert.equal(g.g.sharesOut,12020,'2,020 new shares as before');
  const bad=distressed();s.modules.playerCrisisActions.ensure(bad.g);
  const prior=JSON.stringify(bad.g),ratios=bad.updateOwnershipRatios;
  bad.updateOwnershipRatios=function(...args){this.g.sharesOut+=1;return ratios.apply(this,args);};
  assert.equal(bad.requestSponsorInjection(),false,'an issued-share write that diverges from the plan is rejected');
  assert.equal(JSON.stringify(bad.g),prior,'and the whole injection is rolled back');
  const second=distressed(2);assert.equal(second.requestSponsorInjection(),true,'second generation keeps the existing injection');
  assert.equal(second.g.sharesOut,12020);
 }
 console.log('Phase 3 ownership apply (dormant) and W-FOUNDER-SALE / W-BUY / W-SELL / W-SPLIT / W-BUYBACK / W-SPONSOR verification legs PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
