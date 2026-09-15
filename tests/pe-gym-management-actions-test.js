'use strict';
// PE gym "経営する" (management action) wiring: js/pe-portfolio-operations.js's
// setPortfolioGymMembershipStrategy() plus the pre-existing setPriceMultiplier(), both gated
// through js/management-context.js's resolvePortfolioManagementCapability() (actionsEnabled:true
// for gym only -- see tests/pe-management-context-test.js for the capability boundary itself and
// tests/pe-ui-phase2-test.js for the D UI wiring). This file verifies, against the real
// production engine: (1) the new action's validation and write-scoping, (2) that a settled week
// after using these actions keeps fund.cash / portfolioCompany.cash / companyCash+personalCash
// fully isolated, exactly like the pre-existing exit/settlement isolation tests already prove
// for the read side.
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let randomCalls=0,randomState=0x9e2f61ab;
const {engineModule,modules}=loadGame({random:()=>{randomCalls+=1;randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/0x100000000;},isolatedLegacyIndex:true});
const pf=modules.peFund,ops=modules.pePortfolioOperations,context=modules.managementContext,gymModel=modules.gymMembershipModel;
const plain=value=>JSON.parse(JSON.stringify(value));

function fixture(businessID='gym'){
  const engine=new engineModule.TycoonEngine();
  engine.configure({playerName:'Manage Test',companyName:'Self Company',difficulty:'normal'});
  engine.g.companyCash=7_000_000_000;engine.g.personalCash=20_000_000_000;
  pf.recordExit(engine.g,{exitType:'buyout',realizedAmount:200_000_000,investedAmount:8_000_000,foundedWeek:1,exitedWeek:52,profitableWeekStreak:260,employeeCount:30});
  const fund=pf.createFund(engine.g,{size:10_000_000_000,gpCommit:1_000_000_000,terms:{fee:.02,carry:.2,hurdle:.08},y0:1});
  const deal=ops.acquirePillarCompany(engine.g,fund.id,{businessID,enterpriseValue:2_000_000_000,useCoinvest:false,week:1});
  ops.ensure(engine.g); // fix underperformingRatio deterministically so later snapshots are stable
  return {engine,fund,deal};
}

// ---- setPortfolioGymMembershipStrategy: validation ----------------------------------------
{
  const {engine,fund,deal}=fixture('ramen'),before=plain(engine.g),callsBefore=randomCalls;
  assert.equal(ops.setPortfolioGymMembershipStrategy(engine.g,fund.id,deal.id,'offPeak'),null,'refuses a non-gym deal');
  assert.deepEqual(plain(engine.g),before);assert.equal(randomCalls,callsBefore);
}
{
  const {engine,fund,deal}=fixture('gym'),before=plain(engine.g),callsBefore=randomCalls;
  assert.equal(ops.setPortfolioGymMembershipStrategy(engine.g,fund.id,deal.id,'not-a-real-strategy'),null,'refuses an invalid strategy id');
  assert.deepEqual(plain(engine.g),before);assert.equal(randomCalls,callsBefore);
}
{
  const {engine,fund,deal}=fixture('gym');
  deal.status='exited';
  const before=plain(engine.g),callsBefore=randomCalls;
  assert.equal(ops.setPortfolioGymMembershipStrategy(engine.g,fund.id,deal.id,'premium'),null,'refuses an inactive deal');
  assert.deepEqual(plain(engine.g),before);assert.equal(randomCalls,callsBefore);
}
{
  assert.equal(ops.setPortfolioGymMembershipStrategy({peFirm:{funds:[]}},'missing','missing','premium'),null,'refuses an unknown fund/deal without throwing');
}

// ---- setPortfolioGymMembershipStrategy: success + write scoping ---------------------------
{
  const {engine,fund,deal}=fixture('gym');
  assert.equal(deal.portfolioCompany.gymOperatingState,undefined,'no operating state exists before the first action or settlement');
  const selfStores=plain(engine.g.stores),selfBusinesses=plain(engine.g.businesses),companyCashBefore=engine.g.companyCash,personalCashBefore=engine.g.personalCash;
  const callsBefore=randomCalls;
  const result=ops.setPortfolioGymMembershipStrategy(engine.g,fund.id,deal.id,'premium');
  assert.equal(result,deal,'returns the mutated deal on success');
  assert.equal(deal.portfolioCompany.gymOperatingState.gymMembership.membershipStrategy,'premium');
  // The rest of the normalized detached operating state must come from the same defaults the
  // gym bridge already uses (js/management-context.js's normalizePEPortfolioGymOperatingState),
  // not from ad hoc values invented here.
  const expected=context.defaultPEPortfolioGymOperatingState();
  assert.equal(deal.portfolioCompany.gymOperatingState.schemaVersion,expected.schemaVersion);
  assert.equal(deal.portfolioCompany.gymOperatingState.condition,expected.condition);
  assert.equal(deal.portfolioCompany.gymOperatingState.level,expected.level);
  assert.equal(deal.portfolioCompany.gymOperatingState.operatingHours,expected.operatingHours);
  // Write-scoping: nothing outside deal.portfolioCompany.gymOperatingState moved.
  assert.deepEqual(plain(engine.g.stores),selfStores,'self-company stores untouched');
  assert.deepEqual(plain(engine.g.businesses),selfBusinesses,'self-company businesses untouched (no leak into the shared MASTER.businesses-derived record)');
  assert.equal(engine.g.companyCash,companyCashBefore,'self-company cash untouched');
  assert.equal(engine.g.personalCash,personalCashBefore,'personal cash untouched');
  assert.equal(randomCalls,callsBefore,'setting the membership strategy consumes no simulation RNG');
}
{
  // Re-applying the same strategy id must stay a clean idempotent write, not throw or duplicate state.
  const {engine,fund,deal}=fixture('gym');
  ops.setPortfolioGymMembershipStrategy(engine.g,fund.id,deal.id,'offPeak');
  const once=plain(deal.portfolioCompany.gymOperatingState);
  ops.setPortfolioGymMembershipStrategy(engine.g,fund.id,deal.id,'offPeak');
  assert.deepEqual(plain(deal.portfolioCompany.gymOperatingState),once);
}

// ---- capability gate: gym only -------------------------------------------------------------
{
  const {engine,fund,deal}=fixture('gym');
  assert.equal(context.resolvePortfolioManagementCapability(deal).actionsEnabled,true);
  assert.equal(engine.canOpenPEPortfolioManagement(fund.id,deal.id).capability.actionsEnabled,true);
}
for(const businessID of ['ramen','conveni','realEstateAgency','productVentures']){
  const {deal}=fixture(businessID);
  assert.equal(context.resolvePortfolioManagementCapability(deal).actionsEnabled,false,`${businessID} must stay disabled until it has its own detached bridge`);
}

// ---- end-to-end: management actions -> settled week -> 3-pool cash isolation --------------
{
  const {engine,fund,deal}=fixture('gym');
  const pc=deal.portfolioCompany;
  ops.setPriceMultiplier(engine.g,fund.id,deal.id,1.3);
  ops.setPortfolioGymMembershipStrategy(engine.g,fund.id,deal.id,'premium');
  assert.equal(pc.priceMultiplier,1.3);
  assert.equal(pc.gymOperatingState.gymMembership.membershipStrategy,'premium');

  const outsideBefore=plain({
    companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,
    fundCash:fund.cash,distributed:fund.distributed,coinvestCapital:engine.g.peFirm.coinvestCapital,
    stores:engine.g.stores,businesses:engine.g.businesses,finance:engine.g.finance
  });
  const portfolioCashBefore=pc.cash;
  ops.processPortfolioWeek(engine.g,2);
  assert.equal(pc.lastProcessedWeek,2);
  assert.equal(pc.cash-portfolioCashBefore,pc.weeklyProfit,'the settled profit lands only in the portfolio company cash pool');
  assert.equal(pc.gymOperatingState.gymMembership.lastWeek.week,2,'the weekly settlement advances the same detached operating state the manage actions wrote to');
  // The three cash pools this task calls out explicitly: fund, portfolio company, and the
  // player's own company/personal cash must remain mutually isolated after using these actions.
  assert.deepEqual(
    plain({companyCash:engine.g.companyCash,personalCash:engine.g.personalCash,fundCash:fund.cash,distributed:fund.distributed,coinvestCapital:engine.g.peFirm.coinvestCapital,stores:engine.g.stores,businesses:engine.g.businesses,finance:engine.g.finance}),
    outsideBefore,
    'gym management actions plus their settlement never touch fund.cash, companyCash, personalCash, stores, businesses, or finance'
  );

  // The production membership model actually saw the higher price and premium strategy (not a
  // no-op abstract lever): a same-state control run at price=1x/standard must differ.
  const control=engine.previewPEPortfolioGymWeek(fund.id,deal.id,{week:3,operatingState:pc.gymOperatingState,priceMultiplierOverride:1,membershipStrategyOverride:'standard'});
  const actual=engine.previewPEPortfolioGymWeek(fund.id,deal.id,{week:3,operatingState:pc.gymOperatingState});
  assert.equal(control.ok,true);assert.equal(actual.ok,true);
  assert.notEqual(actual.sales,control.sales,'the manage-screen levers actually reach the production gym model, not just the abstract generic calculator');
}

console.log('pe gym management actions tests passed');
