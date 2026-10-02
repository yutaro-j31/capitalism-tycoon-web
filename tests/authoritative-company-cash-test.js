'use strict';
const assert=require('node:assert');
const fs=require('node:fs');
const {loadGame}=require('./harness');

const {modules,engineModule:engine}=loadGame({headless:true});
const A=10_000_000,B=999_999_999;
const fresh=()=>engine.createInitialState({configured:true});

assert.equal(engine.SAVE_KEY,'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION,9);

const planState=fresh();
Object.assign(planState,{week:40,companyCash:A,cash:B,maSubsidiaries:[{id:'authority-sub',name:'Authority Sub',status:'active',groupMandate:'成長投資',risk:.2,groupPerformanceReview:{score:1}}],subsidiaries:[]});
assert.equal(modules.groupCapitalAllocationPlan.build(planState),true);
assert.equal(planState.groupCapitalAllocation.history[0].pool,1_000_000);
assert.equal(planState.cash,B);

const executionState=fresh();
Object.assign(executionState,{week:41,companyCash:A,cash:B,maSubsidiaries:[{id:'authority-sub',name:'Authority Sub',status:'active',investmentBookValue:0,identifiableNetAssetsBookValue:0,totalCarryingValue:0}],subsidiaries:[],groupCapitalAllocation:{lastPlanWeek:41,lastExecutionWeek:0,rows:[{id:'authority-sub',allocation:1_000_000}],history:[],executions:[]}});
const execution=modules.groupCapitalAllocationExecution.execute(executionState);
assert.equal(execution.total,1_000_000);
assert.equal(executionState.companyCash,9_000_000);
assert.equal(executionState.cash,B);

const researchState=fresh();
Object.assign(researchState,{week:42,companyCash:A,cash:B,personalCash:7_000_000,researchAssets:0,newBusinessAnalysis:{candidates:[{id:'too-expensive',name:'Too Expensive',sector:'AI',requiredCapital:11_000_000,attractiveness:.8,regulatoryRisk:.1},{id:'affordable',name:'Affordable',sector:'AI',requiredCapital:2_000_000,attractiveness:.8,regulatoryRisk:.1}]},newBusinessResearch:{projects:[],history:[]}});
const researchRng=JSON.stringify(researchState.simulationRng),personalBefore=researchState.personalCash;
assert.equal(modules.newBusinessResearchProjects.start(researchState,'too-expensive'),false);
const research=modules.newBusinessResearchProjects.start(researchState,'affordable');
assert.deepEqual({cashEffect:research.cashEffect,assetEffect:research.assetEffect,profitEffect:research.profitEffect},{cashEffect:-2_000_000,assetEffect:0,profitEffect:-2_000_000});
assert.equal(researchState.companyCash,8_000_000);
assert.equal(researchState.cash,B);
assert.equal(researchState.personalCash,personalBefore);
assert.equal(JSON.stringify(researchState.simulationRng),researchRng);
const researchRow=researchState.finance.transactions.find(row=>row.sourceType==='newBusinessResearch');
assert.equal(researchRow.category,'researchAndDevelopment');
assert.equal(researchRow.cashEffect,-2_000_000);
assert.equal(researchRow.profitEffect,-2_000_000);
assert.equal(researchRow.assetEffect,0);

const commercializationState=fresh();
Object.assign(commercializationState,{week:43,companyCash:A,cash:B,personalCash:7_000_000,newBusinessResearch:{projects:[{id:'commercialization-authority',name:'Authority Launch',sector:'AI',status:'ready',startWeek:30,invested:44_000_000,outcomeScore:.7}]}});
const commercializationRng=JSON.stringify(commercializationState.simulationRng),commercializationSnapshot=JSON.stringify(commercializationState);
assert.equal(modules.newBusinessCommercialization.act(commercializationState,'commercialization-authority','launch'),false);
assert.equal(JSON.stringify(commercializationState),commercializationSnapshot);
assert.equal(JSON.stringify(commercializationState.simulationRng),commercializationRng);

const bankState=fresh();
Object.assign(bankState,{week:44,companyCash:A,cash:B,totalAssets:undefined,companyDebt:0,economicFoundation:{indicators:{policyRate:0,stress:0}}});
const quote=modules.bankLoansCovenants.quote(bankState,1_000_000,52);
assert.equal(quote.maxBorrow,8_000_000);
assert.equal(bankState.cash,B);

const legacy=fresh();
delete legacy.companyCash;
legacy.cash=12_345_678;
legacy.saveVersion=8;
const migrated=engine.migrateSave(legacy);
assert.equal(migrated.ok,true,migrated.errors?.join('\n'));
assert.equal(migrated.state.companyCash,12_345_678);
const conflicting=fresh();
conflicting.companyCash=A;
conflicting.cash=B;
const current=engine.migrateSave(conflicting);
assert.equal(current.ok,true,current.errors?.join('\n'));
assert.equal(current.state.companyCash,A);
assert.equal(current.state.cash,B);

const economicModules=['group-capital-allocation-plan.js','group-capital-allocation-execution.js','new-business-research-projects.js','new-business-commercialization.js','bank-loans-covenants.js','long-run-guidance.js'];
for(const file of economicModules){
 const source=fs.readFileSync(`js/${file}`,'utf8');
 assert.equal(/(?:state|this\.g|\bg)\.cash\b/.test(source),false,`${file} must not access deprecated company cash`);
}

console.log('authoritative company cash tests passed');
