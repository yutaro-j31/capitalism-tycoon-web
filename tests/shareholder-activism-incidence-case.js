'use strict';
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');
const { SCENARIOS, makeRandom, runScenario } = require('./strategy-balance-runner');

const WEEKS = 208;
const BASE_SCENARIO = SCENARIOS.find(row => row.id === 'ramen-bootstrap');
const GROWTH_STORE_LIMIT = 6;
const BALANCED_STORE_LIMIT = 5;
const GROWTH_RND_INVESTMENT = 1_500_000;
const BALANCED_RESERVE = 30_000_000;
const BALANCED_BUYBACK_LIMIT = 5_000_000;

function continuationSeed(seed, style) {
  let value = seed >>> 0;
  for (const char of style) value = (Math.imul(value ^ char.charCodeAt(0), 16777619)) >>> 0;
  return value;
}

function activeStores(engine) {
  return engine.g.stores.filter(row => row && !['closed','sold'].includes(String(row.status || 'open')));
}

function healthyExpansionReady(engine) {
  const stores = activeStores(engine);
  if (stores.some(row => String(row.status || 'open') !== 'open')) return false;
  const aggregateProfit = stores.reduce((sum,row) => sum + Number(row.lastProfit || 0), 0);
  const recent = (engine.g.weeklyProfitHistory || []).slice(-8).map(Number);
  const recentProfit = recent.reduce((sum,row) => sum + (Number.isFinite(row) ? row : 0), 0);
  return aggregateProfit > 0 && (recent.length < 4 || recentProfit > 0);
}

function openGrowthStore(engine, businessID, reserve, storeLimit) {
  if (engine.g.companyCash <= reserve || activeStores(engine).length >= storeLimit || !healthyExpansionReady(engine)) return false;
  const business = engine.business(businessID);
  const tenant = engine.g.tenants.filter(row => !row.occupiedBy).sort((a,b) => b.traffic-a.traffic || a.deposit-b.deposit)[0];
  if (!business || !tenant) return false;
  const cost = Number(business.storeCost || 0) + Number(tenant.deposit || 0);
  if (engine.g.companyCash < cost + reserve) return false;
  return Boolean(engine.openStore({tenantID:tenant.id,businessID,name:`Incidence-${engine.g.stores.length+1}`,operatingHours:3}));
}

function investInGrowth(engine, reserve) {
  if (!healthyExpansionReady(engine) || engine.g.companyCash < reserve + GROWTH_RND_INVESTMENT) return false;
  return Boolean(engine.investBusiness('ramen','quality',GROWTH_RND_INVESTMENT));
}

function buyBackBalancedCapital(engine) {
  const capacity = engine.shareholderReturnCapacity();
  const cashRoom = Math.max(0, Number(engine.g.companyCash || 0) - BALANCED_RESERVE);
  const amount = Math.floor(Math.min(BALANCED_BUYBACK_LIMIT, Number(capacity?.safeAmount || 0) * 0.2, cashRoom));
  if (amount < Math.max(1, Number(engine.g.stockPrice || 0))) return false;
  return Boolean(engine.buybackOwnShares(amount));
}

function applyStyle(engine, modules, style, postIpoWeek) {
  if (style === 'growth-reinvestment') {
    if (postIpoWeek % 6 === 0) investInGrowth(engine, 12_000_000);
    if (postIpoWeek % 13 === 0) openGrowthStore(engine, 'ramen', 12_000_000, GROWTH_STORE_LIMIT);
  }
  if (style === 'balanced-returns') {
    if (postIpoWeek % 26 === 0) openGrowthStore(engine, 'ramen', BALANCED_RESERVE, BALANCED_STORE_LIMIT);
    const capacity = engine.shareholderReturnCapacity();
    const dividend = Number(capacity?.maxDividendPerShare || 0) * 0.9;
    if (dividend > 0) engine.setDividend(dividend);
    if (postIpoWeek % 13 === 0) buyBackBalancedCapital(engine);
  }
  assert(modules.finance.validate(engine.g).ok, 'weekly style action must keep finance valid');
}

function triggerDiagnostic(engine) {
  const state=engine.g;
  const value=engine.getShareholderValueDestructionPressure();
  const capital=engine.getShareholderActivismPressure();
  const stores=activeStores(engine);
  const profits=(state.weeklyProfitHistory||[]).slice(-13).map(Number);
  const values=(state.companyValueHistory||[]).slice(-13).map(Number);
  const aggregateStoreProfit=stores.reduce((sum,row)=>sum+Number(row.lastProfit||0),0);
  const trailingProfit=profits.reduce((sum,row)=>sum+(Number.isFinite(row)?row:0),0);
  const operatingRecovery=aggregateStoreProfit>0||trailingProfit>0||(values.length>=4&&Number(state.lastReport?.profit||0)>0&&Number(values.at(-1)||0)>=Number(values[0]||0));
  return {
    triggerPath:String(state.activeActivistCampaign?.triggerPath||''),
    capitalScore:Number(Number(capital.score||0).toFixed(4)),
    capitalThreshold:Number(capital.threshold||0),
    cashPressure:Number(Number(capital.metrics?.cashPressure||0).toFixed(4)),
    dividendPressure:Number(Number(capital.metrics?.dividendPressure||0).toFixed(4)),
    cashHoardingBonus:Number(capital.metrics?.cashHoardingBonus||0),
    stockPrice:Number(Number(state.stockPrice||0).toFixed(4)),
    valuePressure:Number(Number(value.valueDestructionPressure||0).toFixed(4)),
    recoveryRatio:Number(Number(value.recoveryRatio||0).toFixed(4)),
    averageIpoDrawdown:Number(Number(value.averageIpoDrawdown||0).toFixed(4)),
    averageHighDrawdown:Number(Number(value.averageHighDrawdown||0).toFixed(4)),
    cumulativeUnderperformance:Number(Number(value.cumulativeUnderperformance||0).toFixed(4)),
    persistenceRatio:Number(Number(value.persistenceRatio||0).toFixed(4)),
    operatingRecovery,
    activeStores:stores.length,
    aggregateStoreProfit:Math.round(aggregateStoreProfit),
    trailingProfit:Math.round(trailingProfit),
    trailingProfitWeeks:profits.length,
    latestReportProfit:Math.round(Number(state.lastReport?.profit||0)),
    companyValueStart:Math.round(Number(values[0]||0)),
    companyValueEnd:Math.round(Number(values.at(-1)||0)),
    companyValueWeeks:values.length
  };
}

function operatingSummary(engine) {
  const stores=activeStores(engine);
  const profits=(engine.g.weeklyProfitHistory||[]).slice(-13).map(Number);
  return {
    activeStores:stores.length,
    aggregateStoreProfit:Math.round(stores.reduce((sum,row)=>sum+Number(row.lastProfit||0),0)),
    trailingProfit:Math.round(profits.reduce((sum,row)=>sum+(Number.isFinite(row)?row:0),0)),
    trailingProfitWeeks:profits.length
  };
}

function runCase(style, seed) {
  const ipo = runScenario(BASE_SCENARIO, seed, {includeState:true, gameScenario:'free'});
  assert.equal(ipo.ipo, true, `${style} seed ${seed} reaches IPO`);
  const loaded = loadGame({headless:true, random:makeRandom(continuationSeed(seed, style))});
  const engine = new loaded.engineModule.TycoonEngine(JSON.parse(JSON.stringify(ipo.state)));
  engine.normalize();
  let firstCampaignWeek = null;
  let firstCampaignDiagnostic = null;
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
    if (after>before && firstCampaignWeek===null) {
      firstCampaignWeek=engine.g.week;
      firstCampaignDiagnostic=triggerDiagnostic(engine);
    }
  }
  const history=engine.g.activistCampaignHistory||[];
  const campaignStarts=history.filter(row=>row?.type==='campaignStarted');
  const campaignCount=campaignStarts.length;
  const campaignsByPath=campaignStarts.reduce((counts,row)=>{const path=String(row?.triggerPath||'capitalStagnation');counts[path]=(counts[path]||0)+1;return counts;},{});
  const validation=loaded.modules.finance.validate(engine.g);
  assert(validation.ok, JSON.stringify(validation));
  assert(history.length<=loaded.modules.shareholderActivism.HISTORY_LIMIT, 'activism history remains bounded');
  const finance=loaded.modules.finance.ensureFinance(engine.g);
  return {style,seed,ipoWeek:ipo.ipoWeek,firstCampaignWeek,firstCampaignDiagnostic,campaignCount,campaignsByPath,maxPressure,
    endingCash:Math.round(engine.g.companyCash),retainedEarnings:Math.round(finance.balances?.retainedEarnings||0),
    dividendPerShare:Number(engine.g.dividendPerShare||0),stores:engine.g.stores.length,operatingSummary:operatingSummary(engine),
    companyValue:Math.round(engine.companyValue()),finalWeek:engine.g.week};
}

const style=process.argv[2];
const seed=Number(process.argv[3]);
assert(['growth-reinvestment','balanced-returns','cash-hoarder'].includes(style), 'known style is required');
assert(Number.isFinite(seed), 'numeric seed is required');
console.log(`SHAREHOLDER_ACTIVISM_INCIDENCE_CASE ${JSON.stringify(runCase(style,seed))}`);
