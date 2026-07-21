const assert=require('node:assert');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadGame}=require('./harness');
function install(load){for(const file of ['shareholder-returns.js','capital-allocation-score.js','capital-allocation-policy.js','capital-allocation-forecast.js']){const key=file.replace('.js','').replace(/-([a-z])/g,(_,c)=>c.toUpperCase());if(!load.modules[key])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),load.ctx,{filename:file});}return load;}
function publicGame(modules){const {engine,finance}=modules,state=engine.createInitialState({configured:true});state.week=27;state.publicCompany=true;state.companyCash=80_000_000;state.companyDebt=120_000_000;state.sharesOut=1_000_000;state.founderShares=600_000;state.stockPrice=100;state.ticker='CPTY';state.market=state.market.filter(x=>x.id!=='CPTY');state.market.push({id:'CPTY',name:state.companyName,sector:'コングロマリット',price:100,previous:100,dividendYield:0,volatility:0,trend:0,marketCap:100_000_000,per:20,pbr:2,issuedShares:1_000_000,dividendPerShare:0,shareholders:{},description:'test',listingMarket:'東証グロース',priceHistory:[{week:27,price:100}]});state.finance=finance.defaultFinanceState(state);state.finance.transactions.push({week:27,category:'productDevelopment',amount:4_000_000,cashEffect:-4_000_000,profitEffect:0,description:'成長投資'});return new engine.TycoonEngine(state);}
const load=install(loadGame()),game=publicGame(load.modules),mod=load.modules.capitalAllocationForecast;
assert.ok(mod?.__installed);
assert.equal(load.modules.engine.SAVE_KEY,'capitalism_tycoon_web_v1');
assert.equal(load.modules.engine.SAVE_VERSION,9);
const warm=game.capitalAllocationPolicyComparison(),before=JSON.stringify(game.g),comparison=game.capitalAllocationPolicyComparison();
assert.deepEqual(comparison,warm,'comparison must be deterministic for identical state');
assert.equal(JSON.stringify(game.g),before,'comparison must not mutate game state');
assert.equal(comparison.rows.length,4);
assert.equal(comparison.rows[0].id,comparison.recommendedPolicy);
assert.equal(comparison.rows[0].score,comparison.recommendedScore);
assert.ok(comparison.rows.some(row=>row.current&&row.id===comparison.currentPolicy));
assert.ok(comparison.advantage>=0);
for(let i=0;i<comparison.rows.length;i++){const row=comparison.rows[i];assert.ok(row.score>=0&&row.score<=100);assert.ok(row.metCount>=0&&row.metCount<=4);if(i)assert.ok(comparison.rows[i-1].score>=row.score,'rows must be sorted by score');}
assert.equal(typeof game.capitalAllocationPolicyComparison,'function');
game.g.selectedTab='market';const html=mod.render(game);assert.match(html,/data-capital-allocation-comparison/);assert.match(html,/方針比較/);assert.match(html,/推奨/);assert.match(html,/目標達成/);
const snapshot=JSON.stringify(game.g);mod.render(game);assert.equal(JSON.stringify(game.g),snapshot,'comparison rendering must remain read-only');
console.log('capital allocation comparison tests passed');
