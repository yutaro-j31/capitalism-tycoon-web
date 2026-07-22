'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame } = require('./harness');
const files = ['player-debt-service.js','treasury-prepayment.js','shareholder-returns.js','capital-allocation-score.js','capital-allocation-policy.js','capital-allocation-forecast.js','capital-allocation-actions.js','capital-allocation-decision-memo.js','capital-allocation-stress-test.js','capital-allocation-resilience-memo.js','capital-allocation-recovery-funding.js','capital-allocation-recovery-funding-options.js','capital-allocation-recovery-funding-readiness.js','capital-allocation-recovery-funding-reconciliation.js','capital-allocation-recovery-funding-outcome.js','capital-allocation-management-guide.js'];
function install(load){for(const file of files){const key=file.replace('.js','').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());if(!load.modules[key])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),load.ctx,{filename:file});}return load;}
function game(modules,{cash=10_000_000,debt=300_000_000,policyWeek=-999}={}){const {engine,finance}=modules,state=engine.createInitialState({configured:true});Object.assign(state,{week:27,publicCompany:true,selectedTab:'market',companyCash:cash,companyDebt:debt,companyCredit:100,sharesOut:1_000_000,founderShares:600_000,stockPrice:100,ticker:'CPTY'});state.market=state.market.filter(row=>!['CPTY','EXT'].includes(row.id));state.market.push({id:'CPTY',name:state.companyName,sector:'コングロマリット',price:100,previous:100,dividendYield:0,volatility:0,trend:0,marketCap:100_000_000,per:20,pbr:2,issuedShares:1_000_000,dividendPerShare:0,shareholders:{},description:'test',listingMarket:'東証グロース',priceHistory:[{week:27,price:100}]},{id:'EXT',name:'外部上場株',sector:'IT',price:10_000,previous:10_000,dividendYield:0,volatility:0,trend:0,marketCap:10_000_000_000,per:20,pbr:2,issuedShares:1_000_000,dividendPerShare:0,shareholders:{},description:'asset',listingMarket:'東証プライム',priceHistory:[{week:27,price:10_000}]});state.companyStocks={EXT:{qty:10_000,avg:8_000}};Object.assign(state.properties[0],{owner:'company',value:1_000_000_000,price:1_000_000_000,purchasePrice:600_000_000,bookValue:600_000_000});state.finance=finance.defaultFinanceState(state);state.finance.capitalAllocationPolicy={id:'balanced',lastChangedWeek:policyWeek,lastEvaluatedWeek:-1,executionScore:50,history:[]};finance.event(state,'revenue',100_000_000,{week:27,cashEffect:0,profitEffect:100_000_000,receivableAmount:100_000_000,sourceType:'managementGuideFixture',sourceID:'baseline',idempotencyKey:`management-guide-${cash}-${debt}-${policyWeek}`,description:'売掛売上'});state.finance.loans=[{id:'test-loan',loanID:'test-loan',status:'active',principal:debt,outstandingPrincipal:debt,interestRate:.1,maturityWeek:104}];finance.rebuildSnapshotForWeek(state,27);return new engine.TycoonEngine(state);}
const load=install(loadGame()),{modules}=load,mod=modules.capitalAllocationManagementGuide;

const fixedFixture={targetScore:70,optionName:'検証案',optionId:'recommended'};
function assertStablePure(game, expectedId) {
  const before = JSON.stringify(game.g), first = game.capitalAllocationManagementGuide(), second = game.capitalAllocationManagementGuide();
  assert.deepEqual(first, second, `${expectedId} must be deterministic`);
  assert.equal(first.id, expectedId);
  assert.equal(JSON.stringify(game.g), before, `${expectedId} must not mutate save state`);
  return first;
}
function assertFixed(id, reconStatus, outcomeStatus, extra={}) {
  const first = mod.fixedPlanRecommendation(fixedFixture, { status:reconStatus, completedCount:0, totalSteps:3, reason:'recon reason', ...extra.recon }, { status:outcomeStatus, targetScore:70, actualScore:65, reason:'outcome reason', ...extra.outcome });
  const second = mod.fixedPlanRecommendation(fixedFixture, { status:reconStatus, completedCount:0, totalSteps:3, reason:'recon reason', ...extra.recon }, { status:outcomeStatus, targetScore:70, actualScore:65, reason:'outcome reason', ...extra.outcome });
  assert.deepEqual(first, second, `${id} fixed-plan recommendation must be deterministic`);
  assert.equal(first.id, id);
  assert.notEqual(first.id, 'planPinned', `${id} must not fall through to planPinned`);
  assert.doesNotMatch(first.title + first.reason, /最初の手動手順を実行する|最初の手順実行/, `${id} must not ask the player to rerun the first step`);
  assert.match(first.focus, /^\[data-capital-allocation-/);
  return first;
}
assert.ok(mod.__installed);assert.equal(modules.engine.SAVE_KEY,'capitalism_tycoon_web_v1');assert.equal(modules.engine.SAVE_VERSION,9);
const base=game(modules);assertStablePure(base,'executablePlan');
const html=mod.render(base);assert.match(html,/data-capital-allocation-management-guide/);assert.match(html,/aria-labelledby=/);assert.match(html,/次の推奨行動/);assert.match(html,/理由/);assert.match(html,/確認先/);assert.match(html,/data-capital-allocation-guide-focus=/);assert.doesNotMatch(html,/data-action=/);const focus=(html.match(/data-capital-allocation-guide-focus="([^"]+)"/)||[])[1];assert.ok(['[data-capital-allocation-recovery-funding-reconciliation]','[data-capital-allocation-recovery-funding-options]','[data-capital-allocation-recovery-funding-outcome]','[data-capital-allocation-decision-memo]','[data-capital-allocation-policy-ui]'].includes(focus),'UI focus selector must target an existing capital allocation card family');
const cooldown=game(modules,{policyWeek:27});assert.equal(cooldown.capitalAllocationManagementGuide().id,'policyCooldown');
const noPlan=game(modules,{cash:0,debt:5_000_000_000});assert.equal(noPlan.capitalAllocationManagementGuide().id,'noReachablePlan');
const ready=modules.capitalAllocationRecoveryFundingReconciliation.candidates(base,50).find(row=>row.ready&&row.steps.some(step=>step.kind==='securities'))||modules.capitalAllocationRecoveryFundingReconciliation.candidates(base,70).find(row=>row.ready&&row.steps.some(step=>step.kind==='securities'));assert.ok(ready);modules.capitalAllocationRecoveryFundingReconciliation.pin(base,ready.targetScore,ready.optionId);assertStablePure(base,'planPinned');
const step=modules.capitalAllocationRecoveryFundingReconciliation.pinned(base).steps.find(row=>row.kind==='securities');assert.ok(step);base.sellStock(step.sourceId,Math.max(1,Math.floor(step.units/2)),'company');assertStablePure(base,'partiallyExecuted');
const reached=game(modules,{cash:2_000_000_000,debt:0});modules.capitalAllocationRecoveryFundingReconciliation.setTarget(reached,50);assertStablePure(reached,'targetAlreadyReached');
assertFixed('planDiverged','diverged','pending');
assertFixed('planDiverged','complete','diverged');
assertFixed('accountingReview','complete','review');
assertFixed('belowTarget','complete','belowTarget');
assert.equal(mod.fixedPlanRecommendation(fixedFixture,{status:'notStarted'},{status:'pending'}).id,'planPinned');
assert.equal(mod.fixedPlanRecommendation(fixedFixture,{status:'complete'},{status:'verified',targetReached:true,verified:true,targetScore:70,actualScore:75}).id,'targetReached');
assert.equal(mod.fixedPlanRecommendation(fixedFixture,{status:'blocked'},{status:'blocked'}).id,'planReview');
const source=fs.readFileSync(path.join(__dirname,'../js/strategy-balance.js'),'utf8');assert.match(source,/capital-allocation-management-guide\.js/);assert.match(source,/'8D-29'/);
console.log('capital allocation management guide recommendation, UI, purity, determinism, and wiring tests passed');
