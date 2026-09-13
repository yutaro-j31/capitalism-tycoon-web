const assert=require('node:assert/strict');
const {loadGame}=require('./harness');

function fixture(random=()=>.5){
  const loaded=loadGame({random}),e=new loaded.modules.engine.TycoonEngine();
  e.configure({playerName:'p',companyName:'c',difficulty:'normal',scenario:'free'});
  return {...loaded,e,ops:loaded.modules.pePortfolioOperations};
}
function deal(id,businessID='gym'){
  return {id,businessID,status:'active',enterpriseValue:8e9,acquisitionMultiple:8,portfolioCompany:{cash:0,priceMultiplier:1,qualityInvestment:0,storeCount:1,weeklyRevenue:0,weeklyProfit:0,profitHistory:[],improvementScore:50,lastProcessedWeek:1}};
}

{
  let rng=0;const {e,ops}=fixture(()=>{rng++;return .5;});rng=0;
  const masters=ops.productionMasters(e.g),a=deal('same'),b=deal('same');
  assert.deepEqual(ops.derivePortfolioProductionSite(a,masters),ops.derivePortfolioProductionSite(b,masters));
  assert.equal(rng,0,'site derivation must not consume simulation RNG');
  const sites=Array.from({length:200},(_,i)=>ops.derivePortfolioProductionSite(deal(`distribution-${i}`),masters));
  assert(new Set(sites.map(x=>x.areaID)).size>1,'deterministic assignment must not collapse every deal onto one area');
  for(const site of sites){
    const area=e.g.areas.find(x=>x.id===site.areaID),pref=e.g.prefs.find(x=>x.id===site.prefID);
    assert(area&&pref&&pref.areaID===area.id);
  }
}

{
  const {e,ops,modules}=fixture(),fund=modules.peFund.createFund(e.g,{size:30e9,y0:1,terms:modules.peFund.fundTermsForScore(35)}),cash=fund.cash;
  const acquired=ops.acquirePillarCompany(e.g,fund.id,{businessID:'gym',enterpriseValue:2e9,week:10});
  assert(acquired&&ops.isValidPortfolioProductionSite(acquired.portfolioCompany.productionSite,ops.productionMasters(e.g)),'new pillar acquisition must persist a valid site');
  assert.equal(fund.cash,cash-acquired.fundPortion,'site initialization must not add an acquisition cash effect');
}

{
  const {e,ops,modules}=fixture(),fund={id:'fund-site',status:'investing',cash:1e12,distributed:0,deals:[]};
  e.g.peFirm.funds=[fund];
  for(const businessID of modules.peIndustryTiers.TIERS.pillar.businessIDs){fund.deals.push(deal(`pillar-${businessID}`,businessID));}
  const nonPillar=deal('non-pillar','cafe');fund.deals.push(nonPillar);
  const accounting=structuredClone({companyCash:e.g.companyCash,personalCash:e.g.personalCash,fundCash:fund.cash,distributed:fund.distributed,finance:e.g.finance,stores:e.g.stores,businesses:e.g.businesses});
  ops.ensure(e.g);
  for(const row of fund.deals.slice(0,-1))assert(ops.isValidPortfolioProductionSite(row.portfolioCompany.productionSite,ops.productionMasters(e.g)));
  assert.equal(nonPillar.portfolioCompany.productionSite,undefined);
  const first=structuredClone(fund.deals[0].portfolioCompany.productionSite);ops.ensure(e.g);assert.equal(JSON.stringify(fund.deals[0].portfolioCompany.productionSite),JSON.stringify(first));
  const read=ops.getPortfolioProductionSite(e.g,fund.id,fund.deals[0].id),before=structuredClone(e.g);read.prefID='mutated';assert.equal(JSON.stringify(e.g),JSON.stringify(before),'read API must return a detached value without normalization');
  assert.equal(JSON.stringify({companyCash:e.g.companyCash,personalCash:e.g.personalCash,fundCash:fund.cash,distributed:fund.distributed,finance:e.g.finance,stores:e.g.stores,businesses:e.g.businesses}),JSON.stringify(accounting));
  const corrupt=fund.deals[1];corrupt.portfolioCompany.productionSite={schemaVersion:1,prefID:'missing',areaID:'missing'};ops.ensure(e.g);assert(ops.isValidPortfolioProductionSite(corrupt.portfolioCompany.productionSite,ops.productionMasters(e.g)));
  const valid=structuredClone(corrupt.portfolioCompany.productionSite);ops.ensure(e.g);assert.equal(JSON.stringify(corrupt.portfolioCompany.productionSite),JSON.stringify(valid));
  const gym=fund.deals.find(x=>x.businessID==='gym'),generic=ops.calculateGenericPortfolioOperatingWeek(fund,gym,2),dispatched=ops.calculatePortfolioOperatingWeek(fund,gym,2);
  assert.strictEqual(ops.resolvePortfolioOperatingCalculator(gym),ops.calculateGenericPortfolioOperatingWeek);
  assert.equal(JSON.stringify(dispatched),JSON.stringify(generic));assert.equal(dispatched.source,'generic');
  const pcBefore=structuredClone(gym.portfolioCompany);ops.settlePortfolioOperatingWeek(gym,dispatched);
  assert.equal(gym.portfolioCompany.weeklyRevenue,dispatched.revenue);assert.equal(gym.portfolioCompany.weeklyProfit,dispatched.profit);
  assert.equal(gym.portfolioCompany.cash,pcBefore.cash+dispatched.profit);
}

{
  const first=fixture(),fund={id:'fund-roundtrip',status:'investing',cash:1e12,deals:[deal('roundtrip')]};first.e.g.peFirm.funds=[fund];first.ops.ensure(first.e.g);
  const site=structuredClone(fund.deals[0].portfolioCompany.productionSite),saved=JSON.stringify(first.e.g);
  const second=fixture();second.e.g=JSON.parse(saved);second.e.normalize();
  assert.equal(JSON.stringify(second.ops.getPortfolioProductionSite(second.e.g,'fund-roundtrip','roundtrip')),JSON.stringify(site));
}

console.log('PE portfolio production site identity ok');
