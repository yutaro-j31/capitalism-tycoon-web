'use strict';
// #985: after a company sale (isCompanySold, before refounding) the sold company's cash and holdings belong to its
// buyer. Company-account PE actions (create, transfer a personal deal to the company, exit a company deal, a company
// deal's initiative, a parent acquisition of a fund portfolio company) fail closed: no state, storage or RNG change.
// The founder's personal PE actions keep working, with their save-failure rollback; refounding re-opens company PE
// actions; a legacy save without isCompanySold behaves as unsold.
const assert=require('node:assert/strict');
const R=require('./fixtures/refounding-ledger');
const {makeTransactionFaultCase}=require('./helpers/transaction-fault-case');
const {loadGame}=require('./harness');
const SOLD='会社売却後は会社名義のPE操作はできません。';

async function sold(){
 const ctx=await R.soldCompany({companyPE:true,personalPE:true}),g=ctx.game.g;
 g.departments.investment=true;assert.equal(ctx.game.save(),true);await ctx.backend.flush();
 return Object.assign(ctx,{co:g.peDeals.find(d=>d.ownerAccount==='company'&&d.status==='active'),pe:g.peDeals.find(d=>d.ownerAccount!=='company'&&d.status==='active')});
}
const initiative=(game,id)=>game.peValueCreationPlan(id).initiatives[0].id;
// A refusal changes nothing: live state, mirror, cache and durable bytes, save attempts and host RNG; it reports why.
function refused(ctx,label,command,message=SOLD){
 const before=JSON.stringify(ctx.game.g),bytes=ctx.backend.readSync(ctx.key),durable=ctx.durable.get(ctx.key),puts=ctx.control.attempts.length,draws=ctx.host.draws,errors=[];
 const emit=ctx.game.emit;ctx.game.emit=function(type='change',...args){if(type==='notify'&&args[0]?.severity==='error')errors.push(args[0].message);return emit.call(this,type,...args);};
 let result;try{result=command(ctx.game);}finally{ctx.game.emit=emit;}
 assert.equal(result,false,`${label} refused after the sale`);
 assert.equal(JSON.stringify(ctx.game.g),before,`${label}: no state change`);
 assert.equal(ctx.backend.readSync(ctx.key),bytes,`${label}: cache unchanged`);assert.equal(ctx.ctx.__localStorageData.get(ctx.key),bytes,`${label}: mirror unchanged`);
 assert.equal(ctx.durable.get(ctx.key),durable,`${label}: durable unchanged`);assert.equal(ctx.control.attempts.length,puts,`${label}: no save attempted`);
 assert.equal(ctx.host.draws,draws,`${label}: no host RNG`);
 if(message)assert.deepEqual(errors,[message],`${label}: the player is told why`);
}

(async()=>{
 // 1. Every company-account PE action of the sold company is refused.
 {const ctx=await sold();
  refused(ctx,'transferPEDealToCompany',game=>game.transferPEDealToCompany(ctx.pe.id));
  refused(ctx,'exitPEDeal (company deal)',game=>game.exitPEDeal(ctx.co.id));
  refused(ctx,'createPEDeal (company)',game=>game.createPEDeal('ramen',10_000_000,'company'));
  assert.equal(ctx.game.peValueCreationPlan(ctx.co.id).blockedReason,SOLD,'the company deal plan shows why initiatives are blocked');
  refused(ctx,'applyPEInitiative (company deal)',game=>game.applyPEInitiative(ctx.co.id,initiative(game,ctx.co.id)));
  assert.equal(ctx.modules.finance.validate(R.snapshot(ctx.game)).ok,true,'sold company accounting still valid');
  console.log('sold company: transfer / company exit / company create / company initiative refused, nothing changed PASS');}

 // 2. The founder's personal PE actions keep working after the sale.
 for(const [label,command,expect] of [
  ['exitPEDeal (personal deal)',(game,ctx)=>game.exitPEDeal(ctx.pe.id),(b,a,ctx)=>{assert.equal(a.peDeals.find(d=>d.id===ctx.pe.id).status,'exited');assert.ok(a.personalCash>b.personalCash,'proceeds paid to the founder');}],
  ['createPEDeal (personal)',game=>game.createPEDeal('ramen',10_000_000,'personal'),(b,a)=>{assert.equal(a.personalCash,b.personalCash-10_000_000);assert.equal(a.peDeals.length,b.peDeals.length+1);}],
  ['applyPEInitiative (personal deal)',(game,ctx)=>game.applyPEInitiative(ctx.pe.id,initiative(game,ctx.pe.id)),(b,a,ctx)=>{assert.ok(a.personalCash<b.personalCash,'fee paid by the founder');assert.ok(a.peDeals.find(d=>d.id===ctx.pe.id).pendingInitiative);}]
 ]){const ctx=await sold(),before=R.snapshot(ctx.game);
  assert.equal(command(ctx.game,ctx),true,`${label} allowed after the sale`);const after=R.snapshot(ctx.game);
  assert.equal(after.companyCash,before.companyCash,`${label}: the sold company's cash is untouched`);expect(before,after,ctx);
  assert.equal(ctx.modules.finance.validate(JSON.parse(JSON.stringify(after))).ok,true,`${label}: accounting valid`);
  await ctx.backend.flush();assert.equal(JSON.stringify(R.economic(ctx.engineModule.TycoonEngine.load().g)),JSON.stringify(R.economic(new ctx.engineModule.TycoonEngine(JSON.parse(JSON.stringify(after))).g)),`${label}: reload equals live`);}
 console.log('sold company: personal exit / create / initiative allowed, company cash untouched, reload PASS');

 // 3. A legitimate personal exit after the sale still rolls back fully on a failed save.
 {const h=makeTransactionFaultCase({name:'personal PE exit after the sale',fixture:sold,command:ctx=>ctx.game.exitPEDeal(ctx.pe.id),snapshot:R.snapshot,economic:R.economic,
   expectSuccess:(b,a,ctx)=>{assert.equal(a.peDeals.find(d=>d.id===ctx.pe.id).status,'exited');assert.equal(a.companyCash,b.companyCash);},
   label:(v,kind,{pending})=>`personal PE exit after the sale ${kind}/pending=${pending}`});
  for(const kind of ['save-false','save-throw'])await h.rejected('sold',kind);
  await h.rejected('sold','save-false',{pending:true});}

 // 4. Refounding re-opens company PE actions for the new company.
 {const ctx=await sold();assert.equal(R.refound(ctx),true,'production refounding');ctx.game.g.departments.investment=true;
  assert.equal(ctx.game.g.isCompanySold,false);assert.equal(ctx.game.createPEDeal('ramen',10_000_000,'company'),true,'the new company can invest again');
  assert.equal(ctx.modules.finance.validate(R.snapshot(ctx.game)).ok,true,'new company accounting valid');
  console.log('refounded company: company PE action allowed again PASS');}

 // 5. A legacy save without isCompanySold loads as unsold: company PE actions are not blocked.
 {const ctx=await sold(),g=JSON.parse(JSON.stringify(ctx.game.g));delete g.isCompanySold;
  const legacy=new ctx.engineModule.TycoonEngine(g);legacy.save=()=>true;assert.ok(!legacy.g.isCompanySold,'legacy save reads as unsold');
  assert.equal(legacy.createPEDeal('ramen',10_000_000,'company'),true,'legacy save keeps company PE actions');
  console.log('legacy save without isCompanySold / company PE allowed / saveVersion '+legacy.g.saveVersion+' PASS');assert.equal(legacy.g.saveVersion,9);}

 // 6. A parent acquisition of a fund portfolio company would be paid by the sold company: refused, with a preview reason.
 {let state=0x6b8b4567;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000;};
  const {ctx,modules}=loadGame({random}),engine=ctx.__ct_engine;
  engine.configure({playerName:'P',companyName:'Sold Co',difficulty:'normal'});engine.g.personalCash=20e9;engine.g.companyCash=10e9;engine.g.finance=modules.finance.defaultFinanceState(engine.g);
  const pf=modules.peFund,ops=modules.pePortfolioOperations;
  pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:2e8,investedAmount:8e6,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
  const fund=pf.createFund(engine.g,{size:1e10,gpCommit:1e9,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
  const deal=ops.acquirePillarCompany(engine.g,fund.id,{businessID:'gym',enterpriseValue:2e9,useCoinvest:false,week:1});
  deal.portfolioCompany.cash=3e8;deal.portfolioCompany.weeklyProfit=4e6;deal.portfolioCompany.improvementScore=70;engine.g.week=104;
  assert.equal(ops.previewParentCompanyAcquisition(engine.g,fund.id,deal.id).ok,true,'eligible before the sale');
  engine.g.isCompanySold=true;let saves=0;engine.save=()=>{saves++;return true;};
  const before=JSON.stringify(engine.g);
  assert.equal(ops.previewParentCompanyAcquisition(engine.g,fund.id,deal.id).reason,'company-sold','preview names the reason');
  assert.equal(engine.acquirePEPortfolioCompany(fund.id,deal.id),false,'parent acquisition refused after the sale');
  assert.equal(JSON.stringify(engine.g),before,'no fund, cash, carry or subsidiary change');assert.equal(saves,0,'no save attempted');
  console.log('sold company: parent acquisition of a portfolio company refused, nothing changed PASS');}
 console.log('Sold company PE authority PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
