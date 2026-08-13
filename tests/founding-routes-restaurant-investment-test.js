const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadGame}=require('./harness');
const game=()=>loadGame().ctx.__ct_engine;

// Tokyo ramen opening, strategy defaults, failure atomicity and save-compatible fields.
{
 const e=game(),t=e.g.tenants.find(x=>x.prefID==='tokyo'&&x.businessID==='ramen'),cash=e.g.companyCash,b=e.business('ramen');
 assert.match(t.name,/東京 駅前1階/);assert.equal(e.openStore({tenantID:t.id,businessID:'ramen',name:'駅前本店'}),true);
 const s=e.g.stores.at(-1);assert.equal(s.tenantID,t.id);assert.equal(t.occupiedBy,'player');assert.equal(e.g.companyCash,cash-b.storeCost-t.deposit+500_000);
 assert.equal(s.concept,'station-tonkotsu');assert.equal(s.signatureMenu,'classic-value');assert(e.g.news.some(n=>n.includes('駅前本店')));assert(e.g.finance.transactions.some(x=>x.sourceType==='openStoreDeposit'));
 const snapshot=JSON.stringify({cash:e.g.companyCash,stores:e.g.stores,occupied:t.occupiedBy,tx:e.g.finance.transactions,news:e.g.news});assert.equal(e.openStore({tenantID:t.id,businessID:'ramen'}),false);assert.equal(JSON.stringify({cash:e.g.companyCash,stores:e.g.stores,occupied:t.occupiedBy,tx:e.g.finance.transactions,news:e.g.news}),snapshot);
 e.g.companyCash+=1_000_000;assert.equal(e.setRamenStrategy(s.id,{concept:'artisan-shoyu',signatureMenu:'rich-quality'}),true);assert(e.ramenModifiers(s.id).quality>1);assert(e.ramenModifiers(s.id).unitCost>1);assert(s.rebrandUntilWeek>e.g.week);
 assert.equal(e.setStoreManager(s.id,{name:'山田',planning:80,service:70,costControl:60,morale:75,fatigue:12},{price:'profit',procurement:'stable',staffing:'service'}),true);assert.equal(s.manager.planning,80);assert.equal(e.setStoreDelegation(s.id,'price','traffic'),true);
 const reloaded=new (loadGame().engineModule.TycoonEngine)(JSON.parse(JSON.stringify(e.g)));assert.equal(reloaded.g.stores.at(-1).concept,'artisan-shoyu');assert.equal(reloaded.g.stores.at(-1).manager.service,70);
}
// Deterministic bottlenecks and district tags.
{
 const e=game();e.g.stores=[{id:'s',businessID:'ramen',prefID:'tokyo',quality:50,brand:50}];e.g.marketResultsByStoreID.s={potentialDemand:100,unitsSold:50,lostDemand:50,effectiveCapacity:40};e.g.workforceResultsByStoreID.s={staffLimitedCapacity:55,serviceQuality:60};e.g.supplyResultsByStoreID.s={fillRate:.95,stockoutUnits:0,spoilageUnits:0};assert.equal(e.storeOperations('s').bottleneck,'capacity');
 e.g.supplyResultsByStoreID.s={fillRate:.2,stockoutUnits:40,spoilageUnits:0};assert.equal(e.storeOperations('s').bottleneck,'ingredients');const t=e.g.tenants.find(x=>x.prefID==='tokyo');assert.deepEqual(e.districtTags(t),e.districtTags(t));assert.equal(e.districtTags(t).wins.length,2);
}
// Company/personal books, partial fills, limit lifecycle and zero-store investment route.
{
 const e=game(),stock=e.g.market[0];e.g.personalCash=500_000_000;const q=e.stockExecution(stock,10_000_000,'buy');assert(q.filled<q.requested);e.g.companyCash=Math.max(500_000_000,Math.ceil(q.total*2));const c=e.g.companyCash;assert.equal(e.buyStock(stock.id,10_000_000,'company'),true);assert.equal(e.g.companyStocks[stock.id].qty,q.filled);assert(Math.abs((c-e.g.companyCash)-q.total)<1);
 const personalBefore=e.g.personalCash;assert.equal(e.buyStock(stock.id,10,'personal'),true);assert(e.g.personalCash<personalBefore);assert(e.g.personalStocks[stock.id]);assert(e.g.companyStocks[stock.id]);assert.equal(e.g.stores.length,0);assert(e.g.foundingMilestoneCompleted);
 const limit=stock.price;assert.equal(e.placeStockOrder({stockID:stock.id,qty:1,account:'company',side:'buy',type:'limit',limitPrice:limit}),true);const noFill=e.g.pendingStockOrders.at(-1);e.processStockOrders();assert.equal(noFill.status,'pending','spread must not cross a buy limit above the limit price');
 e.g.companyCash=1_000_000_000_000_000;const high=stock.price*10,liq=e.stockExecution(stock,10_000_000,'buy',{limitPrice:high}).filled;assert.equal(e.placeStockOrder({stockID:stock.id,qty:liq+5,account:'company',side:'buy',type:'limit',limitPrice:high}),true);const partial=e.g.pendingStockOrders.at(-1);e.processStockOrders();assert.equal(partial.status,'partial');assert.equal(partial.remaining,5);e.processStockOrders();assert.equal(partial.status,'filled');
 const company=e.portfolioSummary('company'),personal=e.portfolioSummary('personal');assert(company.marketValue>0&&personal.marketValue>0);assert(company.concentration>=0&&company.concentration<=1);
}
// Founder funding is an explicit equity/loan ledger and keeps finance balanced.
{
 const loaded=loadGame(),e=loaded.ctx.__ct_engine;e.g.personalCash=20_000_000;const pc=e.g.personalCash,cc=e.g.companyCash;assert(e.founderFund('equity',2_000_000));assert.equal(e.g.personalCash,pc-2_000_000);assert.equal(e.g.companyCash,cc+2_000_000);assert.equal(e.g.founderContributedEquity,2_000_000);assert(loaded.modules.finance.validate(e.g).ok);
 assert(e.founderFund('shareholder-loan',3_000_000));assert.equal(e.g.founderShareholderLoan,3_000_000);assert.equal(e.g.companyDebt,3_000_000);assert(loaded.modules.finance.validate(e.g).ok);const p=e.g.personalCash;assert(e.repayFounderLoan(1_000_000));assert.equal(e.g.personalCash,p+1_000_000);assert.equal(e.g.founderShareholderLoan,2_000_000);assert(loaded.modules.finance.validate(e.g).ok);
}
// Office, not stores/profit/investment department, is company VC/M&A capability gate.
{
 const e=game(),startup=e.g.startups.find(x=>x.alive);e.g.companyCash=100_000_000;startup.fundingOpen=true;assert.equal(e.investStartup(startup.id,startup.minTicket,'company'),false);assert.equal(e.generateMATargets(true),false);const office=e.g.rentalOffices[0];assert.equal(e.contractOffice(office.id),true);startup.fundingOpen=true;assert.equal(e.investStartup(startup.id,startup.minTicket,'company'),true);assert.equal(e.generateMATargets(true),true);assert.equal(e.g.stores.length,0);
}
// UI is reachable through existing enhancer registry without a MutationObserver.
{
 const src=fs.readFileSync('js/play-runtime-compat.js','utf8');for(const token of ['founding-routes-complete-v2','data-fr-concept','data-fr-menu','data-fr-delegation','data-fr-limit-order','data-decision-cards'])assert(src.includes(token),token);assert(!src.includes('new MutationObserver'));
}
console.log('founding routes restaurant investment: ok');
