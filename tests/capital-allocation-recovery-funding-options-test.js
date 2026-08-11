const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadGame}=require('./harness');
function install(load){
 for(const file of ['player-debt-service.js','treasury-prepayment.js','shareholder-returns.js','capital-allocation-score.js','capital-allocation-policy.js','capital-allocation-forecast.js','capital-allocation-actions.js','capital-allocation-decision-memo.js','capital-allocation-stress-test.js','capital-allocation-resilience-memo.js','capital-allocation-recovery-funding.js','capital-allocation-recovery-funding-options.js']){
  const key=file.replace('.js','').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
  if(!load.modules[key])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),load.ctx,{filename:file});
 }
 return load;
}
function publicGame(modules){
 const {engine,finance}=modules,state=engine.createInitialState({configured:true});
 state.week=27;state.publicCompany=true;state.selectedTab='market';state.companyCash=10_000_000;state.companyDebt=300_000_000;state.companyCredit=100;state.sharesOut=1_000_000;state.founderShares=600_000;state.stockPrice=100;state.ticker='CPTY';
 state.market=state.market.filter(row=>row.id!=='CPTY'&&row.id!=='EXT');
 state.market.push(
  {id:'CPTY',name:state.companyName,sector:'コングロマリット',price:100,previous:100,dividendYield:0,volatility:0,trend:0,marketCap:100_000_000,per:20,pbr:2,issuedShares:1_000_000,dividendPerShare:0,shareholders:{},description:'test',listingMarket:'東証グロース',priceHistory:[{week:27,price:100}]},
  {id:'EXT',name:'外部上場株',sector:'IT',price:10_000,previous:10_000,dividendYield:0,volatility:0,trend:0,marketCap:10_000_000_000,per:20,pbr:2,issuedShares:1_000_000,dividendPerShare:0,shareholders:{},description:'test asset',listingMarket:'東証プライム',priceHistory:[{week:27,price:10_000}]}
 );
 state.companyStocks={EXT:{qty:10_000,avg:8_000}};
 const property=state.properties[0];property.owner='company';property.value=800_000_000;property.price=800_000_000;property.purchasePrice=600_000_000;property.bookValue=600_000_000;
 state.finance=finance.defaultFinanceState(state);
 finance.event(state,'revenue',100_000_000,{week:27,cashEffect:0,profitEffect:100_000_000,receivableAmount:100_000_000,sourceType:'fundingOptionsFixture',sourceID:'baseline',idempotencyKey:'funding-options-revenue',description:'売掛売上'});
 state.finance.loans=[{id:'test-loan',loanID:'test-loan',status:'active',principal:300_000_000,outstandingPrincipal:300_000_000,interestRate:.1,maturityWeek:104}];
 finance.rebuildSnapshotForWeek(state,27);
 return new engine.TycoonEngine(state);
}
const load=install(loadGame()),modules=load.modules,mod=modules.capitalAllocationRecoveryFundingOptions;
assert.ok(mod?.__installed);assert.equal(modules.engine.SAVE_KEY,'capitalism_tycoon_web_v1');assert.equal(modules.engine.SAVE_VERSION,9);assert.deepEqual([...mod.OPTION_ORDER],['recommended','noNewDebt','preserveProperty','borrowOnly']);
assert.equal(mod.statusFor(false,0,0,0),'unreachable');assert.equal(mod.statusFor(true,0,0,0),'noAction');assert.equal(mod.statusFor(true,1,0,0),'liquidSale');assert.equal(mod.statusFor(true,1,1,0),'liquidAndDebt');assert.equal(mod.statusFor(true,1,0,1),'propertySale');assert.equal(mod.statusFor(true,1,1,1),'propertyAndDebt');assert.equal(mod.statusFor(true,0,1,0),'debtOnly');
const synthetic=[
 {id:'recommended',name:'A',targetReached:true,borrowing:100,propertyCount:0,disposalMarketValue:0,totalFunding:100,projectedScore:70},
 {id:'noNewDebt',name:'B',targetReached:true,borrowing:0,propertyCount:1,disposalMarketValue:200,totalFunding:200,projectedScore:75},
 {id:'preserveProperty',name:'C',targetReached:true,borrowing:20,propertyCount:0,disposalMarketValue:50,totalFunding:70,projectedScore:72},
 {id:'borrowOnly',name:'D',targetReached:false,borrowing:10,propertyCount:0,disposalMarketValue:0,totalFunding:10,projectedScore:60}
];
const syntheticLeaders=mod.tradeoffLeaders(synthetic);assert.equal(syntheticLeaders.leastBorrowing.id,'noNewDebt');assert.equal(syntheticLeaders.leastAssetSale.id,'recommended');assert.equal(syntheticLeaders.lowestTotalFunding.id,'preserveProperty');assert.equal(syntheticLeaders.highestScore.id,'noNewDebt');assert.equal(syntheticLeaders.propertyPreserving.id,'preserveProperty');
const game=publicGame(modules);game.g.finance.dirtyWeeks=[27];assert.deepEqual(modules.finance.validate(game.g).errors,[]);
const before=JSON.stringify(game.g),matrixA=game.capitalAllocationRecoveryFundingOptions(70),matrixB=game.capitalAllocationRecoveryFundingOptions(70);assert.deepEqual(matrixA,matrixB,'option matrix must be deterministic');assert.equal(JSON.stringify(game.g),before,'option matrix must remain read-only');assert.equal(matrixA.targetScore,70);assert.ok(matrixA.targetPolicy);assert.deepEqual(matrixA.rows.map(row=>row.id),['recommended','noNewDebt','preserveProperty','borrowOnly']);assert.equal(matrixA.reachableCount,matrixA.rows.filter(row=>row.targetReached).length);
const fundingPlan=game.capitalAllocationRecoveryFundingPlan(70),recommended=matrixA.rows.find(row=>row.id==='recommended'),noDebt=matrixA.rows.find(row=>row.id==='noNewDebt'),preserve=matrixA.rows.find(row=>row.id==='preserveProperty'),borrowOnly=matrixA.rows.find(row=>row.id==='borrowOnly');
assert.equal(recommended.targetPolicy,fundingPlan.targetPolicy);assert.equal(recommended.projectedScore,fundingPlan.projectedScore);assert.equal(recommended.totalFunding,fundingPlan.totalFunding);assert.equal(recommended.assetFunding,fundingPlan.assetFunding);assert.equal(recommended.borrowing,fundingPlan.borrowing);
assert.equal(noDebt.borrowing,0);assert.equal(preserve.propertyCount,0);assert.equal(borrowOnly.assetFunding,0);assert.equal(borrowOnly.propertyCount,0);assert.equal(borrowOnly.stockUnits,0);
const metrics=modules.capitalAllocationRecoveryFunding.metricsFor(game);
for(const row of matrixA.rows){
 assert.equal(row.targetReached,row.projectedScore>=70);assert.equal(row.totalFunding,row.assetFunding+row.borrowing);assert.equal(row.cashAfter,metrics.cash+row.assetFunding+row.borrowing);assert.equal(row.debtAfter,metrics.debt+row.borrowing);assert.ok(row.borrowing>=0);assert.ok(row.borrowing<=row.borrowingCapacity+1,'borrowing must not exceed capacity after disposals');assert.ok(row.disposalCarryingValue>=0);assert.equal(row.disposalGainLoss,row.assetFunding-row.disposalCarryingValue);
}
for(const leader of Object.values(matrixA.leaders)){if(leader)assert.ok(matrixA.rows.includes(leader)&&leader.targetReached);}
const frontierA=game.capitalAllocationRecoveryFundingOptionFrontier([80,50,70,70,60]),frontierB=game.capitalAllocationRecoveryFundingOptionFrontier([50,60,70,80]);assert.deepEqual(frontierA,frontierB);assert.deepEqual(frontierA.targets,[50,60,70,80]);assert.equal(frontierA.rows.length,4);assert.equal(frontierA.matrices.length,4);for(let i=0;i<frontierA.rows.length;i++){assert.equal(frontierA.rows[i].targetScore,frontierA.matrices[i].targetScore);assert.equal(frontierA.rows[i].reachableCount,frontierA.matrices[i].reachableCount);}assert.equal(JSON.stringify(game.g),before,'option frontier must remain read-only');
const html=mod.render(game);assert.equal(JSON.stringify(game.g),before,'option render must remain read-only');assert.match(html,/data-capital-allocation-recovery-funding-options/);assert.match(html,/回復資金・代替案比較/);assert.match(html,/現行推奨/);assert.match(html,/無借入/);assert.match(html,/不動産温存/);assert.match(html,/資産温存/);assert.match(html,/借入最少/);assert.match(html,/資産売却最少/);assert.match(html,/総調達額最少/);assert.match(html,/Phase 8D-16/);
const indexSource=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),wiringBefore=indexSource.indexOf('./js/capital-allocation-recovery-funding.js'),wiringTarget=indexSource.indexOf('./js/capital-allocation-recovery-funding-options.js');assert.ok(wiringBefore>=0&&wiringTarget>wiringBefore,'capital-allocation-recovery-funding-options.js must load after capital-allocation-recovery-funding.js');assert.equal(indexSource.split('./js/capital-allocation-recovery-funding-options.js').length-1,1);
console.log('recovery funding option matrix, deterministic trade-off leaders, and target frontier tests passed');
