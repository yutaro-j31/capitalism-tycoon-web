// Property tax on personally-owned holdings: the cost of simply owning one.
//
// feature-requests.md R4. Until now a personal holding cost nothing to hold beyond upkeep and
// the management fee, so its headline yield was very close to what the player actually kept.
// Real property is taxed on assessed value whether or not it earns anything, which is exactly
// the pressure a vacant building should feel -- rent stops, the tax bill does not.
//
// The company side already models this (js/real-estate-property-taxes.js) with a rate on
// assessed value billed in instalments, and this reuses that shape. It does NOT reuse the
// money: every yen moves personalCash and nothing reaches the company finance ledger, like
// every other personal-only cash flow here.
//
// One flat rate rather than the company side's three regimes. Charging the pricier lots more
// would have cancelled out almost exactly against their yields -- the three offers would have
// landed within 0.4 points of each other after tax, and picking between them would stop
// mattering. A single rate preserves the spread the offers were tuned to have.
//
// No random numbers are drawn: the bill is a function of assessed value and the week.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before personal-real-estate-taxes.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before personal-real-estate-taxes.js.');
if(modules.personalRealEstateTaxes)throw new Error('Personal real estate taxes is already registered.');
const Engine=modules.engine.TycoonEngine;

// Japan's standard fixed-asset tax rate, billed quarterly like the real thing.
const ANNUAL_RATE=.014;
const INSTALMENTS=4;
const WEEKS_PER_INSTALMENT=13;

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const round=value=>Math.round(finite(value));

function assessedValueOf(asset){
  return Math.max(0,finite(asset?.currentValue,finite(asset?.purchasePrice)));
}

function annualTaxFor(asset){
  return round(assessedValueOf(asset)*ANNUAL_RATE);
}

function instalmentFor(asset){
  return round(annualTaxFor(asset)/INSTALMENTS);
}

// Bills land every 13th week of ownership rather than on a global calendar, so a property
// bought mid-year is not charged a full quarter it did not own.
function instalmentDue(asset,week){
  const owned=Math.floor(finite(week)-finite(asset?.purchasedWeek));
  return owned>0&&owned%WEEKS_PER_INSTALMENT===0;
}

function totalPaid(state){
  return (state?.personalRealEstateHoldings||[])
    .filter(asset=>asset.status==='owned')
    .reduce((sum,asset)=>sum+finite(asset.propertyTaxPaid),0);
}

// A sale ends the holding but not the owner's tax obligation.  Clear arrears from the
// proceeds left after the secured mortgage; if the property is underwater, preserve the
// unpaid amount as personal debt instead of letting it disappear with the sold asset.
function settleOnSale(state,asset,proceeds){
  const outstanding=Math.max(0,round(asset?.propertyTaxArrears));
  const available=Math.max(0,round(proceeds));
  const paid=Math.min(outstanding,available);
  const shortfall=round(outstanding-paid);
  asset.propertyTaxArrears=0;
  asset.propertyTaxPaid=round(finite(asset.propertyTaxPaid)+paid);
  if(shortfall>0)state.personalDebt=round(finite(state.personalDebt)+shortfall);
  return {paid,shortfall,net:available-paid};
}

// Called once per week from the personal-property weekly loop. An unpayable bill accrues as
// arrears rather than being skipped, so the debt is visible and still owed.
function processWeek(engine){
  const state=engine.g;
  const week=Math.floor(finite(state.week));
  const charged=[];
  for(const asset of (state.personalRealEstateHoldings||[]).filter(row=>row.status==='owned')){
    if(finite(asset.propertyTaxProcessedWeek)===week)continue;
    if(!instalmentDue(asset,week))continue;
    asset.propertyTaxProcessedWeek=week;
    const due=instalmentFor(asset)+round(asset.propertyTaxArrears);
    if(due<=0)continue;
    const cash=Math.max(0,round(state.personalCash));
    const paid=Math.min(due,cash);
    state.personalCash=round(finite(state.personalCash)-paid);
    asset.propertyTaxPaid=round(finite(asset.propertyTaxPaid)+paid);
    asset.propertyTaxArrears=round(due-paid);
    asset.lastPropertyTaxWeek=week;
    charged.push({assetID:asset.assetID,due,paid,arrears:asset.propertyTaxArrears});
    engine.notify?.(
      asset.propertyTaxArrears>0
        ?`${asset.name}の固定資産税${due.toLocaleString('ja-JP')}円のうち${paid.toLocaleString('ja-JP')}円を納付しました（未納${asset.propertyTaxArrears.toLocaleString('ja-JP')}円）。`
        :`${asset.name}の固定資産税${paid.toLocaleString('ja-JP')}円を納付しました。`,
      asset.propertyTaxArrears>0?'warning':'info');
  }
  return charged;
}

function summaryFor(state,asset){
  const week=Math.floor(finite(state?.week));
  const owned=Math.max(0,Math.floor(week-finite(asset?.purchasedWeek)));
  return Object.freeze({
    annualRate:ANNUAL_RATE,
    annualTax:annualTaxFor(asset),
    instalment:instalmentFor(asset),
    paidTotal:round(asset?.propertyTaxPaid),
    arrears:round(asset?.propertyTaxArrears),
    weeksUntilNext:WEEKS_PER_INSTALMENT-(owned%WEEKS_PER_INSTALMENT),
    // What the tax actually costs against this holding's rent, which is the number that
    // decides whether a leveraged purchase still clears its interest.
    effectiveYieldDrag:assessedValueOf(asset)>0?ANNUAL_RATE:0
  });
}

Engine.prototype.getPersonalRealEstateTax=function(assetID){
  const asset=(this.g.personalRealEstateHoldings||[]).find(row=>row.assetID===assetID&&row.status==='owned');
  return asset?summaryFor(this.g,asset):null;
};

modules.personalRealEstateTaxes=Object.freeze({
  ANNUAL_RATE,INSTALMENTS,WEEKS_PER_INSTALMENT,
  assessedValueOf,annualTaxFor,instalmentFor,instalmentDue,totalPaid,settleOnSale,processWeek,summaryFor,
  __installed:true
});
})();
