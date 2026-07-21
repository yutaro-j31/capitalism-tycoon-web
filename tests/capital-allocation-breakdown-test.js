const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadGame}=require('./harness');
function install(load){for(const file of ['player-debt-service.js','treasury-prepayment.js','shareholder-returns.js','capital-allocation-score.js','capital-allocation-policy.js','capital-allocation-forecast.js','capital-allocation-actions.js']){const key=file.replace('.js','').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());if(!load.modules[key])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),load.ctx,{filename:file});}return load;}
function publicGame(modules,cash=30_000_000,debt=100_000_000){const {engine,finance}=modules,state=engine.createInitialState({configured:true});state.week=27;state.publicCompany=true;state.selectedTab='market';state.companyCash=cash;state.companyDebt=debt;state.sharesOut=1_000_000;state.founderShares=600_000;state.stockPrice=100;state.ticker='CPTY';state.market=state.market.filter(row=>row.id!=='CPTY');state.market.push({id:'CPTY',name:state.companyName,sector:'コングロマリット',price:100,previous:100,dividendYield:0,volatility:0,trend:0,marketCap:100_000_000,per:20,pbr:2,issuedShares:1_000_000,dividendPerShare:0,shareholders:{},description:'test',listingMarket:'東証グロース',priceHistory:[{week:27,price:100}]});state.finance=finance.defaultFinanceState(state);state.finance.loans=[{id:'test-loan',loanID:'test-loan',status:'active',principal:debt,outstandingPrincipal:debt,interestRate:.12,maturityWeek:104}];return new engine.TycoonEngine(state);}
function legacyScore(policy,policyId,metrics){const p=policy.POLICIES[policyId]||policy.POLICIES.balanced,m=metrics||{},finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;let score=100;if(finite(m.growthRatio)<p.growth[0])score-=Math.min(35,(p.growth[0]-finite(m.growthRatio))*180);if(finite(m.growthRatio)>p.growth[1])score-=Math.min(30,(finite(m.growthRatio)-p.growth[1])*100);if(finite(m.leverageRatio)>p.maxLeverage)score-=Math.min(35,(finite(m.leverageRatio)-p.maxLeverage)*70);if(finite(m.payoutRatio)>p.maxPayout)score-=Math.min(35,(finite(m.payoutRatio)-p.maxPayout)*45);if(finite(m.debtReductionRatio)<p.minDebtReduction)score-=Math.min(30,(p.minDebtReduction-finite(m.debtReductionRatio))*400);return Math.max(0,Math.min(100,Math.round(score)));}
const load=install(loadGame()),modules=load.modules,policy=modules.capitalAllocationPolicy,actions=modules.capitalAllocationActions;
assert.ok(policy?.__installed);
assert.ok(actions?.__installed);
assert.equal(modules.engine.SAVE_KEY,'capitalism_tycoon_web_v1');
assert.equal(modules.engine.SAVE_VERSION,9);
const metrics={growthRatio:0,leverageRatio:1,payoutRatio:.5,debtReductionRatio:0},metricsBefore=JSON.stringify(metrics),breakdownA=policy.executionScoreBreakdown('deleveraging',metrics),breakdownB=policy.executionScoreBreakdown('deleveraging',metrics);
assert.deepEqual(breakdownA,breakdownB,'score breakdown must be deterministic');
assert.equal(JSON.stringify(metrics),metricsBefore,'score breakdown must not mutate input metrics');
assert.equal(breakdownA.score,policy.executionScore('deleveraging',metrics));
assert.equal(breakdownA.score,42);
assert.equal(breakdownA.penalties.length,5);
assert.ok(Math.abs(breakdownA.totalPenalty-breakdownA.penalties.reduce((sum,row)=>sum+row.amount,0))<1e-9);
assert.equal(breakdownA.bindingConstraint.id,'leverage');
assert.equal(breakdownA.bindingConstraint.amount,35);
assert.deepEqual(breakdownA.activePenalties.map(row=>row.id),['leverage','debtReduction','payout']);
const perfect=policy.executionScoreBreakdown('growth',{growthRatio:.1,leverageRatio:.5,payoutRatio:.2,debtReductionRatio:0});
assert.equal(perfect.score,100);
assert.equal(perfect.totalPenalty,0);
assert.equal(perfect.bindingConstraint,null);
assert.equal(policy.executionScoreBreakdown('invalid',metrics).policy,'balanced','invalid policy IDs must use the safe default');
const boundaryMetrics=[
  {growthRatio:0,leverageRatio:0,payoutRatio:0,debtReductionRatio:0},
  {growthRatio:.019999999999,leverageRatio:.750000000001,payoutRatio:.800000000001,debtReductionRatio:0},
  {growthRatio:.020000000001,leverageRatio:.749999999999,payoutRatio:.799999999999,debtReductionRatio:.000000000001},
  {growthRatio:.349999999999,leverageRatio:.899999999999,payoutRatio:.449999999999,debtReductionRatio:.039999999999},
  {growthRatio:.350000000001,leverageRatio:.900000000001,payoutRatio:1.000000000001,debtReductionRatio:.040000000001},
  {growthRatio:.123456789,leverageRatio:.987654321,payoutRatio:.567890123,debtReductionRatio:.0123456789},
  {growthRatio:1.5,leverageRatio:3,payoutRatio:4,debtReductionRatio:-1}
];
for(const policyId of Object.keys(policy.POLICIES))for(const sample of boundaryMetrics)assert.equal(policy.executionScoreBreakdown(policyId,sample).score,legacyScore(policy,policyId,sample),`${policyId} breakdown must preserve legacy sequential scoring at boundaries`);
const game=publicGame(modules),warm=game.capitalAllocationPolicyScoreBreakdown('deleveraging'),stateBefore=JSON.stringify(game.g),engineBreakdown=game.capitalAllocationPolicyScoreBreakdown('deleveraging');
assert.deepEqual(engineBreakdown,warm,'engine score breakdown must be deterministic');
assert.equal(JSON.stringify(game.g),stateBefore,'engine score breakdown must not mutate initialized game state');
const impactBefore=JSON.stringify(game.g),impact=game.capitalAllocationDebtActionImpact('deleveraging');
assert.equal(JSON.stringify(game.g),impactBefore,'debt impact breakdown must be read-only');
assert.equal(impact.beforeBreakdown.score,impact.beforeScore);
assert.equal(impact.afterBreakdown.score,impact.afterScore);
assert.equal(impact.componentEffects.length,5);
assert.equal(impact.largestImprovement.id,'debtReduction');
assert.ok(impact.largestImprovement.scoreEffect>0);
assert.equal(impact.afterBreakdown.bindingConstraint.id,'leverage');
const harmful=publicGame(modules,90_000_000,100_000_000),harmfulImpact=harmful.capitalAllocationDebtActionImpact('balanced');
assert.ok(harmfulImpact.improvement<0);
assert.equal(harmfulImpact.largestRegression.id,'leverage');
assert.ok(harmfulImpact.largestRegression.scoreEffect<0);
assert.equal(harmfulImpact.afterBreakdown.bindingConstraint.id,'leverage');
harmful.capitalAllocationPolicyComparison=()=>({recommendedPolicy:'balanced'});
const html=actions.render(harmful);
assert.match(html,/data-capital-allocation-score-breakdown/);
assert.match(html,/評価内訳/);
assert.match(html,/最大改善要因/);
assert.match(html,/最大悪化要因/);
assert.match(html,/返済後の主な減点/);
assert.match(html,/レバレッジ超過/);
console.log('capital allocation score breakdown tests passed');
