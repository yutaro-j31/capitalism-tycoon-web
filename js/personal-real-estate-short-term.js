// Short-term letting for personal property: trade a signed lease for nightly occupancy.
//
// feature-requests.md R4. A personal holding had exactly one way to earn: sign a tenant on a
// 52-week lease and collect the same rent every week until they renew or leave. Steady, and
// with nothing to decide after the purchase.
//
// Switching a holding to short-term letting raises the headline rate substantially but stops
// guaranteeing it. Occupancy is recomputed every week from seasonality, the building's
// condition and the wider economy, so income arrives as a varying stream rather than a fixed
// one, and the running costs are much higher (cleaning and platform fees on every booking
// rather than a flat management fee on a signed rent).
//
// This is deliberately sharpest for a mortgaged holding: the payment does not care how the
// season went, so a leveraged property run short-term is the fastest way to a missed payment
// and the foreclosure clock. Property tax behaves the same way -- assessed on the building,
// not on how well it let.
//
// Converting costs money (furnishing and fitting out) and locks the mode for a while, so the
// choice cannot be flipped week to week to chase whichever is currently better.
//
// Occupancy is derived, never rolled: the same holding in the same week always returns the
// same figure, so no random numbers are drawn and the deterministic fingerprint is untouched.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before personal-real-estate-short-term.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before personal-real-estate-short-term.js.');
if(modules.personalRealEstateShortTerm)throw new Error('Personal real estate short-term is already registered.');
const Engine=modules.engine.TycoonEngine;

const MODE_LONG='long';
const MODE_SHORT='short';

// A fully booked week earns well above the equivalent lease, but full weeks are the exception.
const SHORT_TERM_RATE_MULTIPLIER=2.8;
// Occupancy swings around this before seasonality and condition are applied.
const BASE_OCCUPANCY=.62;
const SEASONAL_SWING=.26;      // peak season adds this, off season removes it
const CONDITION_WEIGHT=.30;    // a well-kept place books out, a tired one does not
const ECONOMY_WEIGHT=.35;
const OCCUPANCY_FLOOR=.10;
const OCCUPANCY_CEILING=.96;
// Cleaning, utilities and platform commission, charged on what was actually earned, plus a
// standing cost for keeping the place furnished and listed whether or not anyone books.
const SHORT_TERM_VARIABLE_COST=.25;
// Weekly, as a fraction of purchase price. Roughly 1.5%/yr, about 2.5x the long-let fixed
// upkeep of 0.6%/yr -- furnishing, utilities and staying listed cost more than a signed lease
// does. Setting this at a plausible-looking annual rate by mistake made it 14x the long-let
// figure and left short-term earning a fiftieth of a lease, which is worth stating because
// the number reads like an annual one.
const SHORT_TERM_STANDING_COST_RATE=.00045;
// Furnishing and fitting out, paid once per switch into short-term.
const CONVERSION_COST_RATE=.018;
// Both directions lock for this long, so the mode cannot be flipped to chase the better week.
const MODE_LOCK_WEEKS=13;
// Short-term guests are harder on a building than a long lease: turnover every few nights
// against a single tenant for a year. The long-let path wears at .12 occupied / .08 vacant, so
// this has to sit clearly above that or short-term would be gentler on the building than a
// lease, which is backwards. Condition feeds occupancy, so letting it slide compounds: a tired
// place books less, earns less, and still owes its standing costs.
const SHORT_TERM_CONDITION_DRAG=.24;

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const round=value=>Math.round(finite(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Same FNV-1a derivation the rest of the codebase uses for save-stable pseudo-values.
function deterministicUnit(...parts){
  let hash=2166136261;
  const text=parts.map(value=>String(value??'')).join('|');
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return ((hash>>>0)%10000)/10000;
}

function modeOf(asset){
  return asset?.rentalMode===MODE_SHORT?MODE_SHORT:MODE_LONG;
}
function isShortTerm(asset){return modeOf(asset)===MODE_SHORT;}

function conditionOf(asset){
  return clamp(finite(asset?.rentalOps?.condition,90),0,100);
}

// Demand peaks and troughs once a year. Keyed to the calendar week so every holding shares a
// season, which is what makes a seasonal dip something to plan around rather than noise.
function seasonalFactor(week){
  return Math.sin((finite(week)%52)/52*Math.PI*2)*SEASONAL_SWING;
}

// Everything here is derived from state the holding already carries plus the week, so the same
// holding in the same week always books the same. No RNG.
function occupancyFor(state,asset){
  if(!isShortTerm(asset))return 0;
  const week=finite(state?.week);
  const season=seasonalFactor(week);
  const condition=(conditionOf(asset)-70)/100*CONDITION_WEIGHT;
  const economy=(clamp(finite(state?.economy,1),.7,1.4)-1)*ECONOMY_WEIGHT;
  // A little week-to-week jitter so a run of weeks is not perfectly flat, still derived.
  const jitter=(deterministicUnit('short-term',asset?.assetID,week)-.5)*.18;
  return clamp(BASE_OCCUPANCY+season+condition+economy+jitter,OCCUPANCY_FLOOR,OCCUPANCY_CEILING);
}

// The nightly rate a fully booked week would earn, before occupancy is applied.
function fullRateFor(asset){
  const base=Math.max(0,finite(asset?.weeklyRent));
  return round(base*SHORT_TERM_RATE_MULTIPLIER);
}

function grossFor(state,asset){
  return round(fullRateFor(asset)*occupancyFor(state,asset));
}

function expenseFor(state,asset,gross){
  const standing=round(Math.max(0,finite(asset?.purchasePrice))*SHORT_TERM_STANDING_COST_RATE);
  return round(standing+round(gross)*SHORT_TERM_VARIABLE_COST);
}

// What one week of short-term letting nets, computed exactly as the weekly loop computes it.
function weeklyResultFor(state,asset){
  const occupancy=occupancyFor(state,asset);
  const gross=grossFor(state,asset);
  const expense=expenseFor(state,asset,gross);
  return {occupancy,fullRate:fullRateFor(asset),gross,expense,noi:gross-expense};
}

function conversionCostFor(asset){
  return round(Math.max(0,finite(asset?.purchasePrice))*CONVERSION_COST_RATE);
}

function weeksUntilUnlocked(state,asset){
  const changed=finite(asset?.rentalModeChangedWeek,-MODE_LOCK_WEEKS);
  return Math.max(0,MODE_LOCK_WEEKS-(finite(state?.week)-changed));
}

function canSwitch(state,asset,target){
  if(!asset||asset.status!=='owned')return {ok:false,reason:'対象の物件が見つかりません。'};
  if(target!==MODE_LONG&&target!==MODE_SHORT)return {ok:false,reason:'その運用方式は選べません。'};
  if(modeOf(asset)===target)return {ok:false,reason:'すでにその運用方式です。'};
  const locked=weeksUntilUnlocked(state,asset);
  if(locked>0)return {ok:false,reason:`運用方式の変更は切替から${MODE_LOCK_WEEKS}週おきです。あと${locked}週お待ちください。`};
  if(target===MODE_SHORT){
    const cost=conversionCostFor(asset);
    if(finite(state?.personalCash)<cost)return {ok:false,reason:`家具・設備の初期費用${cost.toLocaleString('ja-JP')}円が不足しています。`};
  }
  return {ok:true,reason:''};
}

function switchMode(engine,assetID,target){
  const state=engine.g;
  const asset=(state.personalRealEstateHoldings||[]).find(row=>row.assetID===assetID&&row.status==='owned');
  const gate=canSwitch(state,asset,target);
  if(!gate.ok)return engine.fail(gate.reason);

  if(target===MODE_SHORT){
    const cost=conversionCostFor(asset);
    state.personalCash=round(finite(state.personalCash)-cost);
    asset.shortTermConversionPaid=round(finite(asset.shortTermConversionPaid)+cost);
    asset.rentalMode=MODE_SHORT;
    // A signed lease does not survive the change; the unit is taken back for nightly letting.
    if(asset.rentalOps){
      asset.rentalOps.occupancyStatus='vacant';
      asset.rentalOps.contractWeeklyRent=0;
      asset.rentalOps.renewalStatus='none';
      asset.rentalOps.renewalStrategyID=null;
      asset.rentalOps.renewalProposedWeeklyRent=0;
      asset.rentalOps.renewalDecisionChance=0;
      asset.rentalOps.currentVacancyWeeks=0;
    }
    engine.notify(`${asset.name}を短期賃貸へ切り替えました（初期費用${cost.toLocaleString('ja-JP')}円）。稼働率次第で収入が上下します。`,'success');
  }else{
    asset.rentalMode=MODE_LONG;
    // Back to hunting for a tenant; the existing weekly loop takes it from vacant.
    if(asset.rentalOps){
      asset.rentalOps.occupancyStatus='vacant';
      asset.rentalOps.contractWeeklyRent=0;
      asset.rentalOps.currentVacancyWeeks=0;
    }
    engine.notify(`${asset.name}を長期賃貸へ戻しました。入居者が決まるまで家賃は入りません。`,'info');
  }
  asset.rentalModeChangedWeek=Math.floor(finite(state.week));
  engine.save();
  engine.emit('change');
  return true;
}

// Called from the personal-property weekly loop for short-term holdings, in place of the
// lease/vacancy path. Returns the NOI so the caller can fold it into its own running total.
function processWeek(engine,asset){
  const state=engine.g;
  if(!isShortTerm(asset))return null;
  const ops=asset.rentalOps;
  if(!ops)return null;
  const result=weeklyResultFor(state,asset);

  state.personalCash=round(finite(state.personalCash)+result.noi);
  ops.weeksTracked=finite(ops.weeksTracked)+1;
  // Occupancy here is a fraction of the week, not a yes/no, so it accrues proportionally and
  // the existing occupancy-rate readout stays meaningful across both modes.
  ops.occupiedWeeks=finite(ops.occupiedWeeks)+result.occupancy;
  ops.vacantWeeks=finite(ops.vacantWeeks)+(1-result.occupancy);
  ops.grossRentTotal=finite(ops.grossRentTotal)+result.gross;
  ops.operatingExpenseTotal=finite(ops.operatingExpenseTotal)+result.expense;
  ops.noiTotal=finite(ops.noiTotal)+result.noi;
  ops.lastGrossRent=result.gross;
  ops.lastOperatingExpense=result.expense;
  ops.lastNOI=result.noi;
  ops.condition=clamp(finite(ops.condition,90)-SHORT_TERM_CONDITION_DRAG,0,100);
  ops.lastProcessedWeek=Math.floor(finite(state.week));
  asset.shortTermGrossTotal=finite(asset.shortTermGrossTotal)+result.gross;
  asset.shortTermWeeks=finite(asset.shortTermWeeks)+1;
  return result.noi;
}

function summaryFor(state,asset){
  const short=isShortTerm(asset);
  const result=short?weeklyResultFor(state,asset):null;
  return Object.freeze({
    mode:modeOf(asset),
    isShortTerm:short,
    fullRate:fullRateFor(asset),
    occupancy:result?result.occupancy:0,
    gross:result?result.gross:0,
    expense:result?result.expense:0,
    noi:result?result.noi:0,
    conversionCost:conversionCostFor(asset),
    lockedWeeks:weeksUntilUnlocked(state,asset),
    canSwitchToShort:canSwitch(state,asset,MODE_SHORT).ok,
    canSwitchToLong:canSwitch(state,asset,MODE_LONG).ok,
    switchBlockedReason:canSwitch(state,asset,short?MODE_LONG:MODE_SHORT).reason,
    shortTermWeeks:finite(asset?.shortTermWeeks),
    shortTermGrossTotal:round(asset?.shortTermGrossTotal)
  });
}

Engine.prototype.getPersonalRealEstateRentalMode=function(assetID){
  const asset=(this.g.personalRealEstateHoldings||[]).find(row=>row.assetID===assetID&&row.status==='owned');
  return asset?summaryFor(this.g,asset):null;
};
Engine.prototype.switchPersonalRealEstateRentalMode=function(assetID,target){return switchMode(this,assetID,target);};

modules.personalRealEstateShortTerm=Object.freeze({
  MODE_LONG,MODE_SHORT,SHORT_TERM_RATE_MULTIPLIER,BASE_OCCUPANCY,SEASONAL_SWING,
  CONDITION_WEIGHT,ECONOMY_WEIGHT,OCCUPANCY_FLOOR,OCCUPANCY_CEILING,
  SHORT_TERM_VARIABLE_COST,SHORT_TERM_STANDING_COST_RATE,CONVERSION_COST_RATE,
  MODE_LOCK_WEEKS,SHORT_TERM_CONDITION_DRAG,
  modeOf,isShortTerm,seasonalFactor,occupancyFor,fullRateFor,grossFor,expenseFor,
  weeklyResultFor,conversionCostFor,weeksUntilUnlocked,canSwitch,switchMode,processWeek,summaryFor,
  __installed:true
});
})();
