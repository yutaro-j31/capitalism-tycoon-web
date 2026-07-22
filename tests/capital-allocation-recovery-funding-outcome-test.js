const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadGame}=require('./harness');
function install(load){for(const file of ['player-debt-service.js','treasury-prepayment.js','shareholder-returns.js','capital-allocation-score.js','capital-allocation-policy.js','capital-allocation-forecast.js','capital-allocation-actions.js','capital-allocation-decision-memo.js','capital-allocation-stress-test.js','capital-allocation-resilience-memo.js','capital-allocation-recovery-funding.js','capital-allocation-recovery-funding-options.js','capital-allocation-recovery-funding-readiness.js','capital-allocation-recovery-funding-reconciliation.js','capital-allocation-recovery-funding-outcome.js']){const key=file.replace('.js','').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());if(!load.modules[key])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),load.ctx,{filename:file});}return load;}
const load=install(loadGame()),modules=load.modules,mod=modules.capitalAllocationRecoveryFundingOutcome;
assert.ok(mod?.__installed);assert.equal(modules.engine.SAVE_KEY,'capitalism_tycoon_web_v1');assert.equal(modules.engine.SAVE_VERSION,9);
const snapshot={fingerprint:'outcome-fixture',targetScore:70,projectedScore:74,optionId:'recommended',optionName:'現行推奨',assetFunding:100,borrowing:50};
const reconciled={status:'complete',complete:true,issues:[],cashVariance:0,debtVariance:0,steps:[{evidence:{count:1,cashEffect:100,assetEffect:-80,liabilityEffect:0,profitEffect:20}},{evidence:{count:1,cashEffect:50,assetEffect:0,liabilityEffect:50,profitEffect:0}}]};
const verified=mod.summarize(reconciled,snapshot,{cash:150,debt:50},76);assert.equal(verified.status,'verified');assert.equal(verified.targetReached,true);assert.equal(verified.scoreVariance,2);assert.equal(verified.evidence.cashEffect,150);assert.equal(verified.evidence.liabilityEffect,50);assert.equal(verified.evidence.transactionCount,2);
const below=mod.summarize(reconciled,snapshot,{},68);assert.equal(below.status,'belowTarget');assert.equal(below.targetReached,false);assert.equal(below.targetGap,-2);assert.match(below.reason,/あと2点/);
const diverged=mod.summarize({...reconciled,status:'diverged',complete:false,issues:[{id:'cashVariance'}],cashVariance:1_000},snapshot,{},75);assert.equal(diverged.status,'diverged');assert.equal(diverged.verified,false);
const blocked=mod.summarize({status:'blocked',steps:[]},null,{},50);assert.equal(blocked.status,'blocked');assert.equal(blocked.fingerprint,'');
const state=modules.engine.createInitialState({configured:true});state.publicCompany=true;state.selectedTab='market';const game=new modules.engine.TycoonEngine(state),before=JSON.stringify(game.g),report=game.capitalAllocationRecoveryFundingOutcome();assert.equal(report.status,'blocked');assert.equal(JSON.stringify(game.g),before,'outcome report must remain read-only');const html=mod.render(game);assert.match(html,/data-capital-allocation-recovery-funding-outcome/);assert.match(html,/Phase 8D-22/);assert.match(html,/回復資金・結果検証/);
require('./capital-allocation-recovery-target-selector-test.js');
console.log('funding outcome verification, score variance, evidence totals, target selection, and read-only UI tests passed');
