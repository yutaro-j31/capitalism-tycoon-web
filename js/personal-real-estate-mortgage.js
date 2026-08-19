// Mortgages on personally-owned property: borrow against a holding to buy more of them, and
// carry the risk that comes with it.
//
// feature-requests.md R4. Personal property could only ever be bought outright, so the whole
// portfolio was capped by cash on hand and there was no capital decision to make beyond
// "buy when affordable". The company side already had mortgages
// (js/real-estate-mortgage-refinancing.js) and this reuses its shape -- products with a rate,
// an LTV ceiling, a term and an arrangement fee; weekly interest plus straight-line principal;
// optional prepayment. What it does NOT reuse is the money: everything here moves personalCash
// only and never touches the company finance ledger, matching every other personal-only cash
// flow in this codebase.
//
// The reason a mortgage is a decision rather than free money is foreclosure. A personal
// holding yields well but its rent stops entirely when the lease is not renewed, while the
// payment does not. Miss enough consecutive payments and the lender takes the property,
// settles the loan out of the sale, and leaves any shortfall as personal debt. Borrowing to
// the ceiling and then hitting a vacancy is how a player loses a building.
//
// Rates: the fixed products are constant, the variable one tracks the existing policyRate, so
// a cheap loan today can become the expensive one later. No random numbers are drawn here --
// every figure is a function of state the holding already carries.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before personal-real-estate-mortgage.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before personal-real-estate-mortgage.js.');
if(modules.personalRealEstateMortgage)throw new Error('Personal real estate mortgage is already registered.');
const Engine=modules.engine.TycoonEngine;

// Ceilings are deliberately below the company equivalents: a private borrower gets less
// leverage and pays more for it. variable starts cheapest and can end up dearest.
//
// Terms are long (20-30 years) because straight-line principal over a short term dwarfs the
// rent. At the 8-12 year terms this shipped with, a fully-let property still bled cash every
// single week -- borrowing guaranteed eventual foreclosure regardless of how well the building
// performed, which made the whole feature unusable. A let property now covers its payment
// comfortably and a vacant one does not, which is the tension this is supposed to create.
const PRODUCTS=Object.freeze({
  fixed:Object.freeze({id:'fixed',label:'固定金利',baseRate:.042,spread:0,variable:false,maxLTV:.60,termWeeks:1560,feeRate:.012,
    detail:'金利が動かないぶん割高。政策金利が上がっても返済額は変わりません。'}),
  variable:Object.freeze({id:'variable',label:'変動金利',baseRate:0,spread:.022,variable:true,maxLTV:.70,termWeeks:1300,feeRate:.016,
    detail:'政策金利に連動。いまは最も安いが、利上げ局面では固定より高くつきます。'}),
  conservative:Object.freeze({id:'conservative',label:'低LTV長期',baseRate:.034,spread:0,variable:false,maxLTV:.45,termWeeks:1820,feeRate:.008,
    detail:'借りられる額は小さいが、金利が最も低く期間も長い堅実な融資です。'})
});

// Two months of missed payments before the lender moves. Long enough to survive a short
// vacancy, short enough that borrowing at the ceiling is genuinely dangerous.
const MAX_DELINQUENT_WEEKS=8;
// A forced sale is not a market sale; the lender wants it gone.
const FORECLOSURE_SALE_RATE=.85;

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const round=value=>Math.round(finite(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function productOf(productID){return PRODUCTS[productID]||null;}

// The variable product reprices every week off the same policyRate the rest of the economy
// uses, so a mortgage taken in a cheap year is not cheap forever.
function annualRateFor(state,productID){
  const product=productOf(productID);
  if(!product)return 0;
  if(!product.variable)return product.baseRate;
  return clamp(finite(state?.policyRate,.005)+product.spread,.005,.12);
}

function valueOf(asset){
  return Math.max(1,finite(asset?.currentValue,finite(asset?.purchasePrice,1)));
}

function balanceOf(asset){
  return Math.max(0,round(asset?.mortgageBalance));
}

function hasMortgage(asset){
  return balanceOf(asset)>0&&Boolean(productOf(asset?.mortgageProductID));
}

// Total outstanding across every held property -- what personalNetWorth has to subtract, or
// borrowing would read as an instant gain in net worth instead of a swap of cash for debt.
function totalDebt(state){
  return (state?.personalRealEstateHoldings||[])
    .filter(asset=>asset.status==='owned')
    .reduce((sum,asset)=>sum+balanceOf(asset),0);
}

function maxPrincipalFor(asset,productID){
  const product=productOf(productID);
  if(!product)return 0;
  return round(valueOf(asset)*product.maxLTV);
}

// What the player is offered for one holding: headroom is the ceiling minus whatever is
// already owed, so a second loan on the same building is limited, not free.
function quotesFor(state,asset){
  if(!asset||asset.status!=='owned')return [];
  const outstanding=balanceOf(asset);
  return Object.values(PRODUCTS).map(product=>{
    const ceiling=maxPrincipalFor(asset,product.id);
    const available=Math.max(0,ceiling-outstanding);
    const fee=round(available*product.feeRate);
    const annualRate=annualRateFor(state,product.id);
    return Object.freeze({
      id:product.id,label:product.label,detail:product.detail,
      annualRate,maxLTV:product.maxLTV,termWeeks:product.termWeeks,feeRate:product.feeRate,
      variable:product.variable,ceiling,available,fee,
      netProceeds:Math.max(0,available-fee),
      weeklyInterest:round(available*annualRate/52),
      weeklyPrincipal:available>0?round(available/product.termWeeks):0,
      // Refuse rather than silently lend nothing once the building is already fully charged.
      eligible:available>0
    });
  });
}

function currentLTV(asset){
  return balanceOf(asset)/valueOf(asset);
}

// Interest on the balance plus straight-line principal over the remaining term.
function weeklyPaymentFor(state,asset){
  if(!hasMortgage(asset))return {interest:0,principal:0,due:0};
  const balance=balanceOf(asset);
  const interest=round(balance*annualRateFor(state,asset.mortgageProductID)/52);
  const remaining=Math.max(1,Math.floor(finite(asset.mortgageRemainingWeeks,1)));
  const principal=round(Math.min(balance,balance/remaining));
  return {interest,principal,due:interest+principal};
}

function borrow(engine,assetID,productID){
  const state=engine.g;
  const asset=(state.personalRealEstateHoldings||[]).find(row=>row.assetID===assetID&&row.status==='owned');
  if(!asset)return engine.fail('対象の物件が見つかりません。');
  const product=productOf(productID);
  if(!product)return engine.fail('その融資商品は選べません。');
  if(hasMortgage(asset)&&asset.mortgageProductID!==productID)return engine.fail('この物件には既に別の融資が実行されています。繰上返済で完済してから借り換えてください。');
  const quote=quotesFor(state,asset).find(row=>row.id===productID);
  if(!quote?.eligible)return engine.fail('この物件の担保余力がありません。');

  state.personalCash=round(finite(state.personalCash)+quote.netProceeds);
  asset.mortgageProductID=productID;
  asset.mortgageBalance=round(balanceOf(asset)+quote.available);
  asset.mortgageRemainingWeeks=product.termWeeks;
  asset.mortgageBorrowedWeek=Math.floor(finite(state.week));
  asset.mortgageInterestPaid=round(asset.mortgageInterestPaid);
  asset.mortgagePrincipalPaid=round(asset.mortgagePrincipalPaid);
  asset.mortgageDelinquentWeeks=0;
  asset.mortgageFeePaid=round(finite(asset.mortgageFeePaid)+quote.fee);

  engine.notify(`${asset.name}を担保に${quote.available.toLocaleString('ja-JP')}円を借り入れました（手数料${quote.fee.toLocaleString('ja-JP')}円を差し引き${quote.netProceeds.toLocaleString('ja-JP')}円を受け取り）。`,'success');
  engine.save();
  engine.emit('change');
  return true;
}

function prepay(engine,assetID,amount){
  const state=engine.g;
  const asset=(state.personalRealEstateHoldings||[]).find(row=>row.assetID===assetID&&row.status==='owned');
  if(!asset)return engine.fail('対象の物件が見つかりません。');
  if(!hasMortgage(asset))return engine.fail('この物件に返済中の融資はありません。');
  const requested=Math.max(0,round(amount));
  const paid=Math.min(requested,balanceOf(asset),Math.max(0,round(state.personalCash)));
  if(paid<=0)return engine.fail('繰上返済に充てる個人資金が不足しています。');

  state.personalCash=round(finite(state.personalCash)-paid);
  asset.mortgageBalance=round(balanceOf(asset)-paid);
  asset.mortgagePrincipalPaid=round(finite(asset.mortgagePrincipalPaid)+paid);
  if(balanceOf(asset)<=0){
    asset.mortgageProductID='';
    asset.mortgageRemainingWeeks=0;
    asset.mortgageDelinquentWeeks=0;
    engine.notify(`${asset.name}の融資を完済しました。`,'success');
  }else{
    engine.notify(`${asset.name}の融資を${paid.toLocaleString('ja-JP')}円繰上返済しました（残債${balanceOf(asset).toLocaleString('ja-JP')}円）。`,'success');
  }
  engine.save();
  engine.emit('change');
  return true;
}

// Selling a mortgaged property clears the loan out of the proceeds first. Without this the
// debt would simply vanish with the asset and selling would be a way to erase a loan.
function settleOnSale(state,asset,proceeds){
  const outstanding=balanceOf(asset);
  if(outstanding<=0)return {repaid:0,shortfall:0,net:round(proceeds)};
  const repaid=Math.min(outstanding,round(proceeds));
  const shortfall=round(outstanding-repaid);
  asset.mortgageBalance=0;
  asset.mortgageProductID='';
  asset.mortgageRemainingWeeks=0;
  asset.mortgageDelinquentWeeks=0;
  // Negative equity follows the borrower rather than disappearing with the building.
  if(shortfall>0)state.personalDebt=round(finite(state.personalDebt)+shortfall);
  return {repaid,shortfall,net:round(proceeds)-repaid};
}

function foreclose(engine,asset){
  const state=engine.g;
  const proceeds=round(valueOf(asset)*FORECLOSURE_SALE_RATE);
  const outcome=settleOnSale(state,asset,proceeds);
  state.personalCash=round(finite(state.personalCash)+outcome.net);
  asset.status='foreclosed';
  asset.foreclosedWeek=Math.floor(finite(state.week));
  asset.salePrice=proceeds;
  engine.notify(
    outcome.shortfall>0
      ?`${asset.name}が返済遅延により差し押さえられました。売却代金では返済しきれず、${outcome.shortfall.toLocaleString('ja-JP')}円が個人負債として残りました。`
      :`${asset.name}が返済遅延により差し押さえられました。売却代金で残債を清算し、${outcome.net.toLocaleString('ja-JP')}円が手元に残りました。`,
    'error');
  return outcome;
}

// Called once per week from the personal-property weekly loop, AFTER that week's rent has
// landed, so a tenant paying on time can cover the payment in the same week.
function processWeek(engine){
  const state=engine.g;
  const week=Math.floor(finite(state.week));
  const results=[];
  for(const asset of (state.personalRealEstateHoldings||[]).filter(row=>row.status==='owned'&&hasMortgage(row))){
    if(finite(asset.mortgageProcessedWeek)===week)continue;
    asset.mortgageProcessedWeek=week;
    const {interest,principal,due}=weeklyPaymentFor(state,asset);
    const cash=Math.max(0,round(state.personalCash));
    const paid=Math.min(due,cash);
    const interestPaid=Math.min(interest,paid);
    const principalPaid=Math.max(0,paid-interestPaid);

    state.personalCash=round(finite(state.personalCash)-paid);
    asset.mortgageBalance=round(Math.max(0,balanceOf(asset)-principalPaid));
    asset.mortgageInterestPaid=round(finite(asset.mortgageInterestPaid)+interestPaid);
    asset.mortgagePrincipalPaid=round(finite(asset.mortgagePrincipalPaid)+principalPaid);
    asset.mortgageRemainingWeeks=Math.max(0,Math.floor(finite(asset.mortgageRemainingWeeks))-1);

    if(paid+1<due){
      asset.mortgageDelinquentWeeks=Math.floor(finite(asset.mortgageDelinquentWeeks))+1;
      if(asset.mortgageDelinquentWeeks>=MAX_DELINQUENT_WEEKS){
        results.push({assetID:asset.assetID,foreclosed:true,...foreclose(engine,asset)});
        continue;
      }
    }else{
      asset.mortgageDelinquentWeeks=0;
    }

    if(balanceOf(asset)<=0){
      asset.mortgageProductID='';
      asset.mortgageRemainingWeeks=0;
      asset.mortgageDelinquentWeeks=0;
    }
    results.push({assetID:asset.assetID,foreclosed:false,interest:interestPaid,principal:principalPaid,unpaid:Math.max(0,due-paid),balance:balanceOf(asset)});
  }
  return results;
}

// Everything the UI needs for one holding, computed the same way the weekly loop computes it.
function summaryFor(state,asset){
  const payment=weeklyPaymentFor(state,asset);
  const product=productOf(asset?.mortgageProductID);
  return Object.freeze({
    hasMortgage:hasMortgage(asset),
    productID:asset?.mortgageProductID||'',
    productLabel:product?.label||'',
    variable:Boolean(product?.variable),
    annualRate:product?annualRateFor(state,asset.mortgageProductID):0,
    balance:balanceOf(asset),
    ltv:currentLTV(asset),
    weeklyInterest:payment.interest,
    weeklyPrincipal:payment.principal,
    weeklyPayment:payment.due,
    remainingWeeks:Math.max(0,Math.floor(finite(asset?.mortgageRemainingWeeks))),
    delinquentWeeks:Math.max(0,Math.floor(finite(asset?.mortgageDelinquentWeeks))),
    weeksUntilForeclosure:Math.max(0,MAX_DELINQUENT_WEEKS-Math.floor(finite(asset?.mortgageDelinquentWeeks))),
    interestPaid:round(asset?.mortgageInterestPaid),
    principalPaid:round(asset?.mortgagePrincipalPaid),
    equity:Math.max(0,valueOf(asset)-balanceOf(asset))
  });
}

Engine.prototype.getPersonalRealEstateMortgageQuotes=function(assetID){
  const asset=(this.g.personalRealEstateHoldings||[]).find(row=>row.assetID===assetID&&row.status==='owned');
  return asset?quotesFor(this.g,asset):[];
};
Engine.prototype.getPersonalRealEstateMortgage=function(assetID){
  const asset=(this.g.personalRealEstateHoldings||[]).find(row=>row.assetID===assetID&&row.status==='owned');
  return asset?summaryFor(this.g,asset):null;
};
Engine.prototype.borrowPersonalRealEstateMortgage=function(assetID,productID){return borrow(this,assetID,productID);};
Engine.prototype.prepayPersonalRealEstateMortgage=function(assetID,amount){return prepay(this,assetID,amount);};

modules.personalRealEstateMortgage=Object.freeze({
  PRODUCTS,MAX_DELINQUENT_WEEKS,FORECLOSURE_SALE_RATE,
  annualRateFor,valueOf,balanceOf,hasMortgage,totalDebt,maxPrincipalFor,quotesFor,currentLTV,
  weeklyPaymentFor,borrow,prepay,settleOnSale,foreclose,processWeek,summaryFor,
  __installed:true
});
})();
