const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadGame}=require('./harness');
function install(load){
 for(const file of ['player-debt-service.js','treasury-prepayment.js','shareholder-returns.js','capital-allocation-score.js','capital-allocation-policy.js','capital-allocation-forecast.js','capital-allocation-actions.js','capital-allocation-decision-memo.js','capital-allocation-stress-test.js','capital-allocation-resilience-memo.js','capital-allocation-recovery-funding.js','capital-allocation-recovery-funding-options.js','capital-allocation-recovery-funding-readiness.js']){
  const key=file.replace('.js','').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  if(!load.modules[key])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),load.ctx,{filename:file});
 }
 return load;
}
function publicGame(modules){
 const {engine,finance}=modules,state=engine.createInitialState({configured:true});
 state.week=27;state.publicCompany=true;state.selectedTab='market';state.companyCash=10_000_000;state.companyDebt=300_000_000;state.companyCredit=100;state.sharesOut=1_000_000;state.founderShares=600_000;state.stockPrice=100;state.ticker='CPTY';
 state.market=state.market.filter(row=>row.id!=='CPTY'&&row.id!=='EXT');
 state.market.push({id:'CPTY',name:state.companyName,sector:'コングロマリット',price:100,previous:100,dividendYield:0,volatility:0,trend:0,marketCap:100_000_000,per:20,pbr:2,issuedShares:1_000_000,dividendPerShare:0,shareholders:{},description:'test',listingMarket:'東証グロース',priceHistory:[{week:27,price:100}]},{id:'EXT',name:'外部上場株',sector:'IT',price:10_000,previous:10_000,dividendYield:0,volatility:0,trend:0,marketCap:10_000_000_000,per:20,pbr:2,issuedShares:1_000_000,dividendPerShare:0,shareholders:{},description:'test asset',listingMarket:'東証プライム',priceHistory:[{week:27,price:10_000}]});
 state.companyStocks={EXT:{qty:10_000,avg:8_000}};
 const property=state.properties[0];property.owner='company';property.value=800_000_000;property.price=800_000_000;property.purchasePrice=600_000_000;property.bookValue=600_000_000;
 state.finance=finance.defaultFinanceState(state);
 finance.event(state,'revenue',100_000_000,{week:27,cashEffect:0,profitEffect:100_000_000,receivableAmount:100_000_000,sourceType:'fundingReadinessFixture',sourceID:'baseline',idempotencyKey:'funding-readiness-revenue',description:'売掛売上'});
 state.finance.loans=[{id:'test-loan',loanID:'test-loan',status:'active',principal:300_000_000,outstandingPrincipal:300_000_000,interestRate:.1,maturityWeek:104}];
 finance.rebuildSnapshotForWeek(state,27);return new engine.TycoonEngine(state);
}
const load=install(loadGame()),modules=load.modules,mod=modules.capitalAllocationRecoveryFundingReadiness;
assert.ok(mod?.__installed);assert.equal(modules.engine.SAVE_KEY,'capitalism_tycoon_web_v1');assert.equal(modules.engine.SAVE_VERSION,9);
assert.equal(mod.normalizeOptionId('recommended'),'recommended');assert.equal(mod.normalizeOptionId('borrowOnly'),'borrowOnly');assert.equal(mod.normalizeOptionId('unknown'),null);
const game=publicGame(modules);game.g.finance.dirtyWeeks=[27];assert.deepEqual(modules.finance.validate(game.g).errors,[]);
const before=JSON.stringify(game.g),snapA=game.capitalAllocationRecoveryFundingReadiness(70,'recommended'),snapB=game.capitalAllocationRecoveryFundingReadiness(70,'recommended');
assert.deepEqual(snapA,snapB,'readiness snapshot must be deterministic');assert.equal(JSON.stringify(game.g),before,'readiness snapshot must remain read-only');assert.equal(snapA.targetScore,70);assert.equal(snapA.optionId,'recommended');assert.ok(snapA.fingerprint);assert.ok(['ready','waitPolicy','blocked'].includes(snapA.status));assert.equal(snapA.ready,snapA.targetReached&&snapA.blockers.length===0);assert.ok(snapA.steps.length>=1);assert.deepEqual(snapA.steps.map(row=>row.order),snapA.steps.map((_,index)=>index+1));
for(const optionId of ['recommended','noNewDebt','preserveProperty','borrowOnly']){
 const snapshot=game.capitalAllocationRecoveryFundingReadiness(70,optionId),matrix=game.capitalAllocationRecoveryFundingOptions(70),row=matrix.rows.find(item=>item.id===optionId);assert.ok(row);assert.equal(snapshot.optionId,optionId);assert.equal(snapshot.projectedScore,row.projectedScore);assert.equal(snapshot.totalFunding,row.totalFunding);assert.equal(snapshot.assetFunding,row.assetFunding);assert.equal(snapshot.borrowing,row.borrowing);assert.equal(snapshot.targetReached,row.targetReached);assert.equal(snapshot.steps.filter(step=>step.kind==='borrowing').reduce((sum,step)=>sum+step.amount,0),row.borrowing);assert.equal(snapshot.steps.filter(step=>step.kind==='securities'||step.kind==='properties').reduce((sum,step)=>sum+step.amount,0),row.assetFunding);
 if(optionId==='noNewDebt')assert.equal(snapshot.borrowing,0);
 if(optionId==='preserveProperty')assert.equal(snapshot.steps.some(step=>step.kind==='properties'),false);
 if(optionId==='borrowOnly')assert.equal(snapshot.steps.some(step=>step.kind==='securities'||step.kind==='properties'),false);
}
const unchanged=game.validateCapitalAllocationRecoveryFundingSnapshot(snapA);assert.equal(unchanged.stale,false);assert.deepEqual(unchanged.reasons,[]);assert.equal(unchanged.currentFingerprint,snapA.fingerprint);assert.equal(JSON.stringify(game.g),before,'snapshot validation must remain read-only');
const weekGame=publicGame(modules),weekSnapshot=weekGame.capitalAllocationRecoveryFundingReadiness(70,'recommended');weekGame.g.week++;const weekValidation=weekGame.validateCapitalAllocationRecoveryFundingSnapshot(weekSnapshot);assert.equal(weekValidation.stale,true);assert.ok(weekValidation.reasons.some(row=>row.id==='weekChanged'));
const marketGame=publicGame(modules),marketSnapshot=marketGame.capitalAllocationRecoveryFundingReadiness(70,'noNewDebt');marketGame.stock('EXT').price*=1.1;const marketValidation=marketGame.validateCapitalAllocationRecoveryFundingSnapshot(marketSnapshot);assert.equal(marketValidation.stale,true);assert.ok(marketValidation.reasons.some(row=>row.id==='sourcesChanged'||row.id==='fundingChanged'));
const holdingGame=publicGame(modules),holdingSnapshot=holdingGame.capitalAllocationRecoveryFundingReadiness(70,'preserveProperty');holdingGame.g.companyStocks.EXT.qty=Math.max(1,holdingGame.g.companyStocks.EXT.qty-100);const holdingValidation=holdingGame.validateCapitalAllocationRecoveryFundingSnapshot(holdingSnapshot);assert.equal(holdingValidation.stale,true);assert.ok(holdingValidation.reasons.some(row=>row.id==='sourcesChanged'));
const unknown=game.capitalAllocationRecoveryFundingReadiness(70,'missing');assert.equal(unknown.status,'unavailable');assert.ok(unknown.blockers.some(row=>row.id==='unknownOption'));
const privateGame=publicGame(modules);privateGame.g.publicCompany=false;const unavailable=privateGame.capitalAllocationRecoveryFundingReadiness(70,'recommended');assert.equal(unavailable.ready,false);assert.ok(unavailable.blockers.some(row=>row.id==='notPublic'));
const html=mod.render(game);assert.equal(JSON.stringify(game.g),before,'readiness render must remain read-only');assert.match(html,/data-capital-allocation-recovery-funding-readiness/);assert.match(html,/回復資金・実行前確認/);assert.match(html,/手動実行チェックリスト/);assert.match(html,/計画識別子/);assert.match(html,/Phase 8D-18/);
console.log('recovery funding execution readiness, manual checklist, and stale-plan validation tests passed');
