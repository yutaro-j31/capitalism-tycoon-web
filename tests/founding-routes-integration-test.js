const assert=require('node:assert');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {loadGame,ROOT}=require('./harness');
function game(){const {ctx}=loadGame();const code=fs.readFileSync(path.join(ROOT,'js/founding-routes-integration.js'),'utf8');vm.runInContext(code,ctx,{filename:'founding-routes-integration.js'});const e=ctx.__ct_engine;e.g.configured=true;return {ctx,e,m:ctx.__capitalismTycoonModules.foundingRoutesIntegration};}
// Backward-compatible state and founding milestone.
{const {e}=game();assert(e.g.restaurantDesignByStoreID);assert(Array.isArray(e.g.stockOrders));assert(e.g.achievements.includes('company-founded'));assert.equal(e.g.capitalMarketsUnlocked,Boolean(e.g.hasHeadOffice));}
// Company and personal listed-stock trading are both available at start and remain separated.
{const {e}=game(),s=e.g.market[0],pc=e.g.personalCash,cc=e.g.companyCash;assert(e.buyStock(s.id,1,'personal'));assert(e.g.personalCash<pc);assert.equal(e.g.companyCash,cc);const personalQty=e.g.personalStocks[s.id].qty;assert(e.buyStock(s.id,1,'company'));assert(e.g.companyCash<cc);assert.equal(e.g.personalStocks[s.id].qty,personalQty);assert(e.g.companyStocks[s.id].qty>=1);}
// Failed purchase is atomic for both cash and holdings.
{const {e}=game(),s=e.g.market[0];e.g.companyCash=0;const before=JSON.stringify(e.g.companyStocks);assert.equal(e.buyStock(s.id,999999,'company'),false);assert.equal(e.g.companyCash,0);assert.equal(JSON.stringify(e.g.companyStocks),before);}
// Founder funding cannot silently move cash; equity/loan are explicit ledger-backed operations.
{const {e}=game(),p=e.g.personalCash,c=e.g.companyCash;assert(e.transferFounderFunds('equity',100000));assert.equal(e.g.personalCash,p-100000);assert.equal(e.g.companyCash,c+100000);assert(e.g.finance.transactions.some(t=>t.sourceType==='founderEquity'));}
// Office is the VC capability gate; store count/profit are irrelevant.
{const {e}=game(),startup=e.g.startups[0];e.g.stores=[];assert.equal(e.investStartup(startup.id,startup.minTicket,'company'),false);const office=e.g.rentalOffices[0];e.g.companyCash=Math.max(e.g.companyCash,office.deposit+startup.minTicket+1000000);assert(e.contractOffice(office.id));assert(e.g.capitalMarketsUnlocked);assert(e.investStartup(startup.id,startup.minTicket,'company'));}
// Restaurant design is store-local and market integration records explainable multipliers.
{const {e}=game(),t=e.g.tenants.find(x=>x.businessID==='ramen'&&!x.occupiedBy)||e.g.tenants.find(x=>!x.occupiedBy),b=e.business('ramen');assert(t&&b);e.g.companyCash=1e9;assert(e.openStore({tenantID:t.id,businessID:'ramen',name:'統合テスト店'}));const s=e.g.stores.at(-1);assert(e.g.restaurantDesignByStoreID[s.id]);assert(e.setStoreConcept(s.id,'artisan'));assert(e.setStoreMenuPolicy(s.id,'rich'));assert.equal(e.g.restaurantDesignByStoreID[s.id].conceptID,'artisan');assert.equal(e.g.restaurantDesignByStoreID[s.id].menuPolicyID,'rich');}
// Area tags and bottleneck translation are deterministic pure derivations.
{const {e,m}=game(),t=e.g.tenants[0],a=m.areaTags(e.g,t),fake={id:'fake'};assert.equal(a.wins.length,2);assert(a.warn);e.g.marketResultsByStoreID.fake={lostDemand:42,effectiveCapacity:100,customers:80};e.g.supplyResultsByStoreID.fake={fillRate:1,spoilageCost:0};const b=m.bottleneck(e.g,fake);assert.equal(b.top.id,'capacity');assert(b.top.reason.includes('42'));}
// Limit orders expose open/expiry state instead of pretending to fill immediately.
{const {e}=game(),s=e.g.market[0];assert(e.placeLimitStockOrder(s.id,10,s.price*.5,'personal','buy',1));assert.equal(e.g.stockOrders.at(-1).status,'open');}
// Static mobile and loader contracts.
{const css=fs.readFileSync(path.join(ROOT,'css/founding-routes-integration.css'),'utf8'),compat=fs.readFileSync(path.join(ROOT,'js/play-runtime-compat.js'),'utf8');assert(css.includes('@media(max-width:640px)'));assert(css.includes('.bottleneck-grid'));assert(compat.includes('founding-routes-integration.js'));assert(compat.includes('founding-routes-integration.css'));}
console.log('founding routes integration tests passed');
