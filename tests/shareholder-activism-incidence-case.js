'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { SCENARIOS, makeRandom, runScenario } = require('./strategy-balance-runner');

const WEEKS = 208;
const BASE_SCENARIO = SCENARIOS.find(row => row.id === 'ramen-bootstrap');

function continuationSeed(seed, style) {
  let value = seed >>> 0;
  for (const char of style) value = (Math.imul(value ^ char.charCodeAt(0), 16777619)) >>> 0;
  return value;
}

function openGrowthStore(engine, businessID, reserve) {
  if (engine.g.companyCash <= reserve || engine.g.stores.length >= 10) return false;
  const business = engine.business(businessID);
  const tenant = engine.g.tenants.filter(row => !row.occupiedBy).sort((a,b) => b.traffic-a.traffic || a.deposit-b.deposit)[0];
  if (!business || !tenant) return false;
  const cost = Number(business.storeCost || 0) + Number(tenant.deposit || 0);
  if (engine.g.companyCash < cost + reserve) return false;
  return Boolean(engine.openStore({tenantID:tenant.id,businessID,name:`Incidence-${engine.g.stores.length+1}`,operatingHours:3}));
}

function applyStyle(engine, modules, style, postIpoWeek) {
  if (style === 'growth-reinvestment' && postIpoWeek % 8 === 0) openGrowthStore(engine, 'ramen', 12_000_000);
  if (style === 'balanced-returns') {
    if (postIpoWeek % 13 === 0) openGrowthStore(engine, 'ramen', 30_000_000);
    if (postIpoWeek % 13 === 1) {
      const capacity = engine.shareholderReturnCapacity();
      const dividend = Number(capacity?.maxDividendPerShare || 0) * 0.25;
      if (dividend > 0) engine.setDividend(dividend);
    }
  }
  assert(modules.finance.validate(engine.g).ok, 'weekly style action must keep finance valid');
}

function runCase(style, seed) {
  const ipo = runScenario(BASE_SCENARIO, seed, {includeState:true, gameScenario:'free'});
  assert.equal(ipo.ipo, true, `${style} seed ${seed} reaches IPO`);
  const loaded = loadGame({headless:true, random:makeRandom(continuationSeed(seed, style))});
  const engine = new loaded.engineModule.TycoonEngine(JSON.parse(JSON.stringify(ipo.state)));
  engine.normalize();
  let firstCampaignWeek = null;
  let maxPressure = null;
  const startingWeek = engine.g.week;
  const remainingWeeks = Math.max(0, WEEKS - startingWeek + 1);
  for (let i=0; i<remainingWeeks; i+=1) {
    const postIpoWeek = engine.g.week - startingWeek + 1;
    applyStyle(engine, loaded.modules, style, postIpoWeek);
    const pressure = engine.getShareholderActivismPressure();
    if (!maxPressure || pressure.score > maxPressure.score) {
      maxPressure = {
        week:engine.g.week, score:Number(pressure.score.toFixed(4)), threshold:pressure.threshold,
        cashPressure:Number(pressure.metrics.cashPressure.toFixed(4)),
        dividendPressure:Number(pressure.metrics.dividendPressure.toFixed(4)),
        lowRoic:Number(pressure.metrics.lowRoic.toFixed(4)), governance:Number(pressure.metrics.governance.toFixed(4)),
        performance:Number(pressure.metrics.performance.toFixed(4)), cashHoardingBonus:pressure.metrics.cashHoardingBonus || 0
      };
    }
    const before=(engine.g.activistCampaignHistory||[]).filter(row=>row?.type==='campaignStarted').length;
    assert.notEqual(engine.advanceWeek(false), false, `${style} seed ${seed} weekly progression continues`);
    const after=(engine.g.activistCampaignHistory||[]).filter(row=>row?.type==='campaignStarted').length;
    if (after>before && firstCampaignWeek===null) firstCampaignWeek=engine.g.week;
  }
  const history=engine.g.activistCampaignHistory||[];
  const campaignCount=history.filter(row=>row?.type==='campaignStarted').length;
  const validation=loaded.modules.finance.validate(engine.g);
  assert(validation.ok, JSON.stringify(validation));
  assert(history.length<=loaded.modules.shareholderActivism.HISTORY_LIMIT, 'activism history remains bounded');
  const finance=loaded.modules.finance.ensureFinance(engine.g);
  return {style,seed,ipoWeek:ipo.ipoWeek,firstCampaignWeek,campaignCount,maxPressure,
    endingCash:Math.round(engine.g.companyCash),retainedEarnings:Math.round(finance.balances?.retainedEarnings||0),
    dividendPerShare:Number(engine.g.dividendPerShare||0),stores:engine.g.stores.length,
    companyValue:Math.round(engine.companyValue()),finalWeek:engine.g.week};
}

const style=process.argv[2];
const seed=Number(process.argv[3]);
assert(['growth-reinvestment','balanced-returns','cash-hoarder'].includes(style), 'known style is required');
assert(Number.isFinite(seed), 'numeric seed is required');
console.log(`SHAREHOLDER_ACTIVISM_INCIDENCE_CASE ${JSON.stringify(runCase(style,seed))}`);
