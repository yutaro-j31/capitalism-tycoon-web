'use strict';
// A stock split must leave every holder's quarterly dividend total unchanged: the per-share
// dividend is divided by the split ratio. Uses the production stockSplit, setDividend and the
// installed advanceWeek dividend path (engine weekly close + shareholder-returns payment week).
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
const {scenario,economic,snapshot,assertSplit}=require('./fixtures/stock-split-atomicity');
const {indexedDBFor,inject}=require('./fixtures/pe-fund-acquisition-faults');
const EXT_DPS=30,OWN_DPS=6,TOLERANCE=1e-6;
const finance=loadGame({headless:true}).modules.finance;
const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<=TOLERANCE*Math.max(1,Math.abs(expected)),`${label}: ${actual} != ${expected}`);
async function dividendScenario(family){
 const s=await scenario(family);
 s.game.stock('EXT').dividendPerShare=EXT_DPS;
 assert.equal(s.game.setDividend(OWN_DPS),true,'production dividend declaration');
 await s.backend.flush();
 return s;
}
function totals(state){
 const own=state.market.find(x=>x.id==='CPTY'),ext=state.market.find(x=>x.id==='EXT');
 return {
  ownDeclared:state.dividendPerShare*Math.max(0,state.sharesOut-state.treasuryBuybackShares),
  ownMarket:own.dividendPerShare*own.issuedShares,
  extIssued:ext.dividendPerShare*ext.issuedShares,
  companyExt:state.companyStocks.EXT.qty*ext.dividendPerShare,
  personalExt:state.personalStocks.EXT.qty*ext.dividendPerShare,
 };
}
function assertTotalsPreserved(before,after,label){
 const a=totals(before),b=totals(after);
 for(const key of Object.keys(a))close(b[key],a[key],`${label} ${key} sharesBefore*dpsBefore==sharesAfter*dpsAfter`);
}
function assertSplitSideEffects(before,after,stockID,ratio,label){
 assertSplit(before,after,stockID,ratio);
 const prior=before.market.find(x=>x.id===stockID),stock=after.market.find(x=>x.id===stockID);
 close(stock.dividendPerShare,prior.dividendPerShare/ratio,`${label} market dividendPerShare`);
 assert.equal(stock.dividendYield,prior.dividendYield,`${label} dividend yield unchanged`);
 close(after.dividendPerShare,before.dividendPerShare/(stockID==='CPTY'?ratio:1),`${label} declared dividendPerShare`);
 assert.equal(after.founderOwnershipRatio,before.founderOwnershipRatio,`${label} founder ownership ratio`);
 for(const key of ['externalShareholderRatio','competitorOwnedRatio'])assert.equal(after[key],before[key],`${label} ${key}`);
 assert.deepEqual(after.shareholderReturns,before.shareholderReturns,`${label} dividend policy/history untouched`);
}
async function payWeek(game){
 const state=game.g,personalCash=state.personalCash,companyCash=state.companyCash,week=state.week;
 assert.equal((week+1)%13,0,'fixture advances into a dividend payment week');
 assert.notEqual(game.advanceWeek(false),false,'week commits');
 const report=state.lastReport;
 assert.equal(report.week,week+1);
 const validation=finance.validate(snapshot(game));assert.equal(validation.ok,true,`finance ledger valid after dividend week: ${JSON.stringify(validation.errors||validation.reasons||'')}`);
 return {personal:state.personalCash-personalCash,company:state.companyCash-companyCash,dividend:report.dividend,stockIncome:report.stockIncome};
}
function assertPayment(actual,expected,label){
 for(const key of ['personal','company','dividend','stockIncome'])close(actual[key],expected[key],`${label} ${key}`);
}
async function loaded(s,expected){
 const wanted=economic(new s.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected))).g);
 const reloaded=s.engineModule.TycoonEngine.load();
 assert.deepEqual(economic(reloaded.g),wanted,'production reload');
 const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
 const hydrated=fresh.engineModule.TycoonEngine.load();
 assert.deepEqual(economic(hydrated.g),wanted,'fresh durable-only hydration');await fresh.modules.saveStorageIDB.flush();
 return {reloaded,fresh,hydrated};
}
let baselineCache;
async function baseline(){
 if(!baselineCache){const s=await dividendScenario('external');baselineCache={state:snapshot(s.game),payment:await payWeek(s.game)};}
 return baselineCache;
}
async function splitAndPay(family,ratios){
 const s=await dividendScenario(family),base=await baseline(),start=snapshot(s.game);
 assert.equal(start.dividendPerShare,OWN_DPS);assert.equal(start.market.find(x=>x.id==='EXT').dividendPerShare,EXT_DPS);
 for(const ratio of ratios){
  const before=snapshot(s.game),draws=s.host.draws;
  assert.equal(s.game.stockSplit(s.stockID,ratio),true);
  const after=snapshot(s.game);
  assertSplitSideEffects(before,after,s.stockID,ratio,`${family} 1:${ratio}`);
  assertTotalsPreserved(before,after,`${family} 1:${ratio}`);
  assert.equal(s.host.draws,draws,'split consumes no RNG');
 }
 assertTotalsPreserved(start,snapshot(s.game),`${family} ${ratios.join('x')} cumulative`);
 const factor=ratios.reduce((a,b)=>a*b,1);
 close(s.game.stock(s.stockID).dividendPerShare,(s.stockID==='CPTY'?OWN_DPS:EXT_DPS)/factor,'cumulative dividendPerShare');
 await s.backend.flush();
 const {reloaded,hydrated}=await loaded(s,s.game.g);
 // Weekly dividend cash, ledger and report match the never-split baseline for the live engine,
 // the production reload and a fresh durable-only IDB hydration.
 assertPayment(await payWeek(s.game),base.payment,`${family} ${ratios.join('x')} live`);
 assertPayment(await payWeek(reloaded),base.payment,`${family} ${ratios.join('x')} reload`);
 assertPayment(await payWeek(hydrated),base.payment,`${family} ${ratios.join('x')} fresh hydration`);
 console.log(`stockSplit dividend ${family} ratios=${ratios.join(',')} totals/payment/reload/hydration PASS`);
}
async function tradesAfterSplit(family){
 const s=await dividendScenario(family);
 assert.equal(s.game.stockSplit('EXT',2),true);
 for(const account of ['company','personal']){assert.equal(s.game.buyStock('EXT',1000,account),true);assert.equal(s.game.sellStock('EXT',400,account),true);}
 const state=s.game.g,dps=s.game.stock('EXT').dividendPerShare;
 close(dps,EXT_DPS/2,'post-split EXT dividendPerShare');
 const companyQty=state.companyStocks.EXT.qty,personalQty=state.personalStocks.EXT.qty;
 const payment=await payWeek(s.game);
 // Company account income is booked as stockIncome; external dividend income is only EXT here.
 close(payment.stockIncome,companyQty*dps,'company dividend uses post-split dps for post-split trades');
 const base=await baseline();
 close(payment.personal-base.payment.personal,(personalQty*dps-base.state.personalStocks.EXT.qty*EXT_DPS)*.797,'personal dividend uses post-split dps for post-split trades');
 assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true);
 console.log(`stockSplit dividend ${family} trades-after-split PASS`);
}
function fault(s,kind){
 if(kind!=='save-before-throw')return inject(s.game,s.modules,s.ctx.localStorage,s.key,kind);
 const save=s.game.save;let hits=0;s.game.save=()=>{hits++;throw new Error('save before admission threw');};
 return {hits:()=>hits,restore(){s.game.save=save;}};
}
async function rejected(family,kind,{pending=false,nested=false}={}){
 const s=await dividendScenario(family);
 if(pending){s.control.holdPut=true;assert.equal(s.game.save(),true);for(let i=0;i<100&&!s.control.release;i++)await new Promise(r=>setImmediate(r));assert.equal(typeof s.control.release,'function');}
 const before=snapshot(s.game),bytes=s.backend.readSync(s.key),durable=s.durable.get(s.key),puts=s.control.attempts.length,draws=s.host.draws;
 const injection=fault(s,kind);let result,error;
 try{result=nested?s.game.runTransaction(()=>s.game.stockSplit(s.stockID,2)):s.game.stockSplit(s.stockID,2);}catch(ex){error=ex;}finally{injection.restore();}
 assert.ok(injection.hits()>0,'fault reaches installed writer');
 if(kind==='save-false'){assert.equal(result,false);assert.equal(error,undefined);}else assert.match(error?.message||'',/threw/);
 assert.deepEqual(snapshot(s.game),before,'failed split restores dividendPerShare with the rest of state');
 assert.equal(s.game.g.dividendPerShare,OWN_DPS);assert.equal(s.game.stock('EXT').dividendPerShare,EXT_DPS);assert.equal(s.game.stock('CPTY').dividendPerShare,OWN_DPS);
 assert.equal(s.host.draws,draws);
 assert.equal(s.ctx.__localStorageData.get(s.key),bytes);assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.durable.get(s.key),durable);
 s.control.release?.();await s.backend.flush();
 assert.equal(s.durable.get(s.key),bytes,'predecessor preserved, failed split never durable');assert.equal(s.control.attempts.length,puts,'cancel failed pending put');
 await loaded(s,before);
 assert.equal(s.game.stockSplit(s.stockID,2),true,'failed split can retry');
 const after=snapshot(s.game);
 assertSplitSideEffects(before,after,s.stockID,2,`${family} retry after ${kind}`);assertTotalsPreserved(before,after,`${family} retry after ${kind}`);
 await s.backend.flush();const {hydrated}=await loaded(s,s.game.g);
 assertPayment(await payWeek(hydrated),(await baseline()).payment,`${family} retry after ${kind} hydrated payment`);
 console.log(`stockSplit dividend ${family}/${kind}/pending=${pending}/nested=${nested} rollback/retry PASS`);
}
// Outstanding per-share dividend terms (Owner decision on #951): an open activist dividend proposal
// and active dividend governance commitments are rescaled with the canonical dividend, exactly once.
const ACTIVIST_DPS=8;
const outstanding=state=>Math.max(0,state.sharesOut-state.treasuryBuybackShares);
async function activistScenario(family,{status='active',type='dividend'}={}){
 const s=await dividendScenario(family),g=s.game.g;
 g.activeActivistCampaign={id:`activist-${g.week}-${type}-fixture`,activistName:'North Star Capital',type,title:'配当方針の引き上げ',dividendPerShare:ACTIVIST_DPS,amount:type==='dividend'?ACTIVIST_DPS*outstanding(g):5_000_000,reason:'fixture',week:g.week,startedWeek:g.week,deadlineWeek:g.week+8,status,response:null,support:40,pressureScore:70,difficulty:'normal'};
 g.governanceCommitments=[
  {id:'commit-ended',campaignID:'old',type:'dividend',dueWeek:g.week+2,status:'fulfilled',target:ACTIVIST_DPS},
  {id:'commit-buyback',campaignID:'old-buyback',type:'buyback',dueWeek:g.week+40,status:'active',target:5_000_000},
 ];
 assert.equal(s.game.save(),true);await s.backend.flush();
 return s;
}
function activistTerms(state){return {campaign:state.activeActivistCampaign?{...state.activeActivistCampaign}:null,commitments:JSON.parse(JSON.stringify(state.governanceCommitments||[]))};}
function assertActivistRescaled(before,after,factor,label){
 const b=activistTerms(before),a=activistTerms(after);
 if(b.campaign&&b.campaign.type==='dividend'&&b.campaign.status==='active'){
  close(a.campaign.dividendPerShare,b.campaign.dividendPerShare/factor,`${label} campaign dividendPerShare`);
  close(a.campaign.dividendPerShare*outstanding(after),b.campaign.dividendPerShare*outstanding(before),`${label} campaign implied total preserved`);
  assert.deepEqual({...a.campaign,dividendPerShare:0},{...b.campaign,dividendPerShare:0},`${label} other campaign fields untouched`);
 }else assert.deepEqual(a.campaign,b.campaign,`${label} non-dividend / inactive campaign untouched`);
 assert.equal(a.commitments.length,b.commitments.length);
 a.commitments.forEach((c,i)=>{const o=b.commitments[i];
  if(o.type==='dividend'&&o.status==='active'){close(c.target,o.target/factor,`${label} ${o.id} target`);assert.deepEqual({...c,target:0},{...o,target:0});}
  else assert.deepEqual(c,o,`${label} ${o.id} untouched`);});
}
async function activistAccept(ratios){
 // A/B/C/D: proposal created before the split, own split, accept: the declared total must not grow.
 const s=await activistScenario('own'),g=s.game.g,before=snapshot(s.game),proposedTotal=ACTIVIST_DPS*outstanding(before);
 for(const ratio of ratios){const prior=snapshot(s.game),draws=s.host.draws;assert.equal(s.game.stockSplit('CPTY',ratio),true);assertActivistRescaled(prior,snapshot(s.game),ratio,`accept 1:${ratio}`);assert.equal(s.host.draws,draws);}
 await s.backend.flush();await loaded(s,s.game.g);
 const cash=g.companyCash,personal=g.personalCash;
 assert.equal(s.game.acceptShareholderProposal(),true,'production accept');
 close(g.dividendPerShare*outstanding(g),proposedTotal,`accept after ${ratios.join('x')} split keeps the proposed dividend total`);
 assert.equal(g.companyCash,cash);assert.equal(g.personalCash,personal);
 console.log(`stockSplit dividend activist proposal accept after ${ratios.join(',')} PASS`);
}
async function activistCommitment(ratio){
 // Negotiated dividend commitment, then split: the fulfilment check must compare like with like.
 const s=await activistScenario('own'),g=s.game.g;
 assert.equal(s.game.negotiateShareholderProposal(),true,'production negotiate creates the commitment');
 assert.equal(s.game.setDividend(ACTIVIST_DPS),true,'policy meets the commitment before the split');
 assert.equal(s.game.save(),true);await s.backend.flush();
 const before=snapshot(s.game),created=before.governanceCommitments.find(c=>c.campaignID===before.activeActivistCampaign.id);
 assert.equal(created.type,'dividend');assert.equal(created.status,'active');assert.equal(created.target,ACTIVIST_DPS);
 assert.equal(s.game.stockSplit('CPTY',ratio),true);
 const after=snapshot(s.game);assert.equal(before.activeActivistCampaign.status,'active','negotiated campaign stays acceptable');
 assertActivistRescaled(before,after,ratio,`commitment 1:${ratio}`);
 await s.backend.flush();await loaded(s,s.game.g);
 while(s.game.g.week<created.dueWeek)assert.notEqual(s.game.advanceWeek(false),false);
 const judged=s.game.g.governanceCommitments.find(c=>c.id===created.id);
 assert.equal(judged.status,'fulfilled',`unchanged total payout after a 1:${ratio} split is not a breach`);
 assert.equal(s.game.g.governanceCommitments.find(c=>c.id==='commit-ended').target,ACTIVIST_DPS);
 assert.equal(s.modules.finance.validate(snapshot(s.game)).ok,true);
 console.log(`stockSplit dividend governance commitment 1:${ratio} fulfilment PASS`);
}
async function activistUntouched(){
 // External split, inactive (proxyFight) or buyback campaigns, ended / non-dividend commitments: unchanged.
 for(const [family,options,label] of [['external',{},'external split'],['own',{status:'proxyFight'},'proxyFight campaign'],['own',{type:'buyback'},'buyback campaign']]){
  const s=await activistScenario(family,options),before=snapshot(s.game);
  assert.equal(s.game.stockSplit(s.stockID,2),true);
  const after=snapshot(s.game);
  if(family==='external')assert.deepEqual(activistTerms(after),activistTerms(before),`${label} leaves activist terms untouched`);
  else assertActivistRescaled(before,after,2,label);
 }
 console.log('stockSplit dividend activist terms untouched outside scope PASS');
}
async function activistRejected(kind,{pending=false,nested=false}={}){
 const s=await activistScenario('own');
 if(pending){s.control.holdPut=true;assert.equal(s.game.save(),true);for(let i=0;i<100&&!s.control.release;i++)await new Promise(r=>setImmediate(r));}
 const before=snapshot(s.game),bytes=s.backend.readSync(s.key),draws=s.host.draws;
 const injection=fault(s,kind);let result,error;
 try{result=nested?s.game.runTransaction(()=>s.game.stockSplit('CPTY',2)):s.game.stockSplit('CPTY',2);}catch(ex){error=ex;}finally{injection.restore();}
 assert.ok(injection.hits()>0);if(kind==='save-false')assert.equal(result,false);else assert.match(error?.message||'',/threw/);
 assert.deepEqual(snapshot(s.game),before,'activist terms roll back with the split');assert.equal(s.host.draws,draws);
 assert.equal(s.backend.readSync(s.key),bytes);s.control.release?.();await s.backend.flush();assert.equal(s.durable.get(s.key),bytes);
 await loaded(s,before);
 assert.equal(s.game.stockSplit('CPTY',2),true,'retry');assertActivistRescaled(before,snapshot(s.game),2,`retry after ${kind}`);
 await s.backend.flush();await loaded(s,s.game.g);
 console.log(`stockSplit dividend activist terms ${kind}/pending=${pending}/nested=${nested} rollback/retry/reload PASS`);
}
async function legacyZeroDividend(){
 const s=await scenario('external');
 const ext=s.game.stock('EXT');delete ext.dividendPerShare;ext.dividendYield=.04;s.game.g.dividendPerShare=0;
 const before=snapshot(s.game);
 assert.equal(s.game.stockSplit('EXT',2),true);
 const after=snapshot(s.game),stock=after.market.find(x=>x.id==='EXT');
 assert.equal(Object.prototype.hasOwnProperty.call(stock,'dividendPerShare'),false,'missing dps is not invented');
 assert.equal(stock.dividendYield,.04);assert.equal(after.dividendPerShare,0);
 assertSplit(before,after,'EXT',2);
 console.log('stockSplit dividend legacy yield-only stock PASS');
}
(async()=>{
 for(const family of ['own','external'])for(const ratios of [[2],[3],[2,3]])await splitAndPay(family,ratios);
 for(const family of ['own','external'])await tradesAfterSplit(family);
 for(const family of ['own','external']){
  for(const kind of ['save-false','save-throw','save-before-throw'])for(const nested of [false,true])await rejected(family,kind,{nested});
  for(const kind of ['save-false','save-throw'])await rejected(family,kind,{pending:true});
 }
 await legacyZeroDividend();
 for(const ratios of [[2],[3],[2,3]])await activistAccept(ratios);
 for(const ratio of [2,3])await activistCommitment(ratio);
 await activistUntouched();
 for(const kind of ['save-false','save-throw'])for(const nested of [false,true])await activistRejected(kind,{nested});
 await activistRejected('save-false',{pending:true});
 console.log('Stock split dividend rescale PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
