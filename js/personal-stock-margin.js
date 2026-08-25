// Personal margin trading: borrow against the market value of personally-held stocks to buy
// more of them, carrying real leverage risk.
//
// Shape reuses personal-real-estate-mortgage.js's pattern (a product with a rate and an LTV
// ceiling, borrow/prepay, a weekly processing pass, forced settlement on breach) but the two
// deliberately diverge where margin loans and mortgages actually differ:
//  - No amortization schedule. A margin loan is interest-only; unpaid weekly interest
//    capitalizes into the balance instead of accumulating a "delinquent weeks" counter, because
//    real margin interest just compounds onto what is owed.
//  - The trigger is mark-to-market, not a grace period. A mortgage forecloses after missing
//    MAX_DELINQUENT_WEEKS payments; a margin loan can be called the same week a price move pushes
//    current LTV (balance / portfolio value) over MAINTENANCE_LTV, which sits above every
//    product's borrowing ceiling (maxLTV) the same way a broker's maintenance margin sits above
//    the initial margin -- headroom the player can still lose to a single bad week.
//
// Forced settlement sells personally-held stocks directly (mirroring engine.sellStock's own
// math, without its notify/save/emit side effects so processWeek stays a single silent pass)
// rather than a flat "foreclosure sale rate" -- the market for a stock is already liquid and
// engine.sellStock's existing per-trade slippage is the realistic price impact model here.
// Any shortfall left after selling everything follows the borrower into personalDebt, exactly
// like a mortgage foreclosure shortfall does.
//
// Only personalCash / personalStocks / personalDebt ever move here. Company cash, company
// stocks and the finance ledger are untouched, matching every other personal-only feature.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before personal-stock-margin.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before personal-stock-margin.js.');
if(modules.personalStockMargin)throw new Error('Personal stock margin is already registered.');
const Engine=modules.engine.TycoonEngine;

// Ceilings are deliberately below what a broker calling itself "conservative" would offer in
// reality, and MAINTENANCE_LTV sits well above both so a player who borrows to the standard
// ceiling still has real room to absorb a drawdown before a margin call, not zero.
const PRODUCTS=Object.freeze({
  conservative:Object.freeze({id:'conservative',label:'低LTV型',baseRate:.038,maxLTV:.3,
    detail:'借入枠は小さいぶん金利が低く、値下がりしても追証まで余裕があります。'}),
  standard:Object.freeze({id:'standard',label:'標準型',baseRate:.052,maxLTV:.5,
    detail:'借入枠が大きい分、金利は高めで追証までの値下がり余地も小さくなります。'})
});

// Above every product's maxLTV -- the gap between borrowing ceiling and this is the player's
// margin of safety against a price drop before a call is forced.
const MAINTENANCE_LTV=.65;

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const round=value=>Math.round(finite(value));

function productOf(productID){return PRODUCTS[productID]||null;}
function annualRateFor(productID){return productOf(productID)?.baseRate||0;}

function portfolioValueOf(state){
  const stocks=state?.personalStocks||{};
  const market=state?.market||[];
  return Object.entries(stocks).reduce((sum,[id,h])=>{
    const stock=market.find(s=>s.id===id);
    return sum+(stock?finite(stock.price):0)*finite(h?.qty);
  },0);
}

function ensure(state){
  if(!state.personalMarginLoan||typeof state.personalMarginLoan!=='object')state.personalMarginLoan={};
  const loan=state.personalMarginLoan;
  loan.balance=Math.max(0,round(loan.balance));
  loan.productID=productOf(loan.productID)?loan.productID:'';
  if(loan.balance<=0)loan.productID='';
  loan.interestPaid=Math.max(0,round(loan.interestPaid));
  loan.interestCapitalized=Math.max(0,round(loan.interestCapitalized));
  loan.liquidatedCount=Math.max(0,Math.floor(finite(loan.liquidatedCount)));
  return loan;
}

function hasLoan(state){return ensure(state).balance>0;}
function balanceOf(state){return ensure(state).balance;}

function currentLTV(state){
  const loan=ensure(state);
  if(loan.balance<=0)return 0;
  const value=portfolioValueOf(state);
  return value>0?loan.balance/value:Infinity;
}

function maxPrincipalFor(state,productID){
  const product=productOf(productID);
  if(!product)return 0;
  return round(portfolioValueOf(state)*product.maxLTV);
}

// Headroom under the ceiling for each product. A loan already open on a different product
// blocks the others -- prepay to zero before switching, same restriction the mortgage uses.
function quotesFor(state){
  const loan=ensure(state);
  return Object.values(PRODUCTS).map(product=>{
    if(loan.balance>0&&loan.productID&&loan.productID!==product.id){
      return Object.freeze({id:product.id,label:product.label,detail:product.detail,annualRate:product.baseRate,maxLTV:product.maxLTV,ceiling:0,available:0,weeklyInterest:0,eligible:false});
    }
    const ceiling=maxPrincipalFor(state,product.id);
    const available=Math.max(0,ceiling-loan.balance);
    return Object.freeze({
      id:product.id,label:product.label,detail:product.detail,
      annualRate:product.baseRate,maxLTV:product.maxLTV,
      ceiling,available,
      weeklyInterest:round(available*product.baseRate/52),
      eligible:available>0
    });
  });
}

function borrow(engine,productID){
  const state=engine.g;
  const product=productOf(productID);
  if(!product)return engine.fail('その信用取引商品は選べません。');
  const loan=ensure(state);
  if(loan.balance>0&&loan.productID!==productID)return engine.fail('既存の信用取引を完済してから商品を切り替えてください。');
  const quote=quotesFor(state).find(row=>row.id===productID);
  if(!quote?.eligible)return engine.fail('担保となる個人保有株式の評価額に対して借入余力がありません。');

  state.personalCash=round(finite(state.personalCash)+quote.available);
  loan.balance=round(loan.balance+quote.available);
  loan.productID=productID;

  engine.notify(`個人保有株式を担保に${quote.available.toLocaleString('ja-JP')}円を信用取引で借り入れました。`,'success');
  engine.save();
  engine.emit('change');
  return true;
}

function prepay(engine,amount){
  const state=engine.g;
  const loan=ensure(state);
  if(loan.balance<=0)return engine.fail('返済中の信用取引はありません。');
  const requested=Math.max(0,round(amount));
  const paid=Math.min(requested,loan.balance,Math.max(0,round(state.personalCash)));
  if(paid<=0)return engine.fail('返済に充てる個人資金が不足しています。');

  state.personalCash=round(finite(state.personalCash)-paid);
  loan.balance=round(loan.balance-paid);
  if(loan.balance<=0){
    loan.balance=0;
    loan.productID='';
    engine.notify('信用取引を完済しました。','success');
  }else{
    engine.notify(`信用取引を${paid.toLocaleString('ja-JP')}円返済しました（残債${loan.balance.toLocaleString('ja-JP')}円）。`,'success');
  }
  engine.save();
  engine.emit('change');
  return true;
}

// Mirrors engine.sellStock's personal-account math exactly, minus its notify/save/emit --
// liquidate() below fires possibly several of these in one silent pass and reports once itself.
function sellPersonalStockRaw(state,stockID,qty){
  const stock=(state.market||[]).find(s=>s.id===stockID);
  const holding=state.personalStocks?.[stockID];
  if(!stock||!holding||qty<1||holding.qty<qty)return 0;
  const proceeds=stock.price*qty*.999;
  const profit=proceeds-holding.avg*qty;
  state.personalCash=round(finite(state.personalCash)+proceeds);
  holding.qty-=qty;
  if(holding.qty<=0)delete state.personalStocks[stockID];
  state.realizedPersonalStockPL=round(finite(state.realizedPersonalStockPL)+profit);
  stock.price*=1-Math.min(.03,qty/Math.max(1,stock.issuedShares)*.6);
  stock.marketCap=stock.price*stock.issuedShares;
  return proceeds;
}

// Forced settlement: sell down personal holdings, largest first, until the loan is covered or
// the portfolio is exhausted. Any shortfall follows the borrower into personalDebt.
function liquidate(engine){
  const state=engine.g;
  const loan=ensure(state);
  if(loan.balance<=0)return {raised:0,repaid:0,shortfall:0};
  const holdings=Object.entries(state.personalStocks||{})
    .filter(([,h])=>finite(h?.qty)>0)
    .map(([id,h])=>({id,qty:finite(h.qty),value:finite((state.market||[]).find(s=>s.id===id)?.price)*finite(h.qty)}))
    .sort((a,b)=>b.value-a.value);

  let raised=0;
  for(const holding of holdings){
    if(raised>=loan.balance)break;
    const stock=(state.market||[]).find(s=>s.id===holding.id);
    if(!stock||!(stock.price>0))continue;
    const qty=Math.min(holding.qty,Math.max(1,Math.ceil((loan.balance-raised)/stock.price)));
    raised=round(raised+sellPersonalStockRaw(state,holding.id,qty));
  }

  const repaid=Math.min(loan.balance,raised);
  const shortfall=Math.max(0,round(loan.balance-raised));
  state.personalCash=round(finite(state.personalCash)-repaid);
  loan.balance=0;
  loan.productID='';
  loan.liquidatedCount=Math.floor(finite(loan.liquidatedCount))+1;
  if(shortfall>0)state.personalDebt=round(finite(state.personalDebt)+shortfall);

  engine.notify(
    shortfall>0
      ?`信用取引が追証水準を超過し、保有株式を強制決済しました。売却代金では返済しきれず、${shortfall.toLocaleString('ja-JP')}円が個人負債として残りました。`
      :`信用取引が追証水準を超過し、保有株式を強制決済しました。売却代金で残債を清算しました。`,
    'error');
  return {raised,repaid,shortfall};
}

// Called once per week from the personal-property weekly loop. No random numbers: interest is
// a pure function of balance and rate, and the margin-call trigger is a pure function of
// balance vs. whatever the market pass already set stock prices to this week.
function processWeek(engine){
  const state=engine.g;
  const week=Math.floor(finite(state.week));
  const loan=ensure(state);
  if(loan.balance<=0)return null;
  if(finite(loan.processedWeek)===week)return null;
  loan.processedWeek=week;

  const rate=annualRateFor(loan.productID);
  const interest=round(loan.balance*rate/52);
  const cash=Math.max(0,round(state.personalCash));
  const paid=Math.min(interest,cash);
  const unpaid=Math.max(0,interest-paid);

  state.personalCash=round(finite(state.personalCash)-paid);
  loan.interestPaid=round(finite(loan.interestPaid)+paid);
  if(unpaid>0){
    loan.balance=round(loan.balance+unpaid);
    loan.interestCapitalized=round(finite(loan.interestCapitalized)+unpaid);
  }

  if(currentLTV(state)>MAINTENANCE_LTV)return {interest,paid,unpaid,liquidated:true,...liquidate(engine)};
  return {interest,paid,unpaid,liquidated:false,balance:loan.balance,ltv:currentLTV(state)};
}

function summaryFor(state){
  const loan=ensure(state);
  const product=productOf(loan.productID);
  const portfolioValue=portfolioValueOf(state);
  const ltv=currentLTV(state);
  return Object.freeze({
    hasLoan:loan.balance>0,
    productID:loan.productID,
    productLabel:product?.label||'',
    annualRate:product?product.baseRate:0,
    balance:loan.balance,
    portfolioValue,
    ltv,
    equity:Math.max(0,portfolioValue-loan.balance),
    marginCall:loan.balance>0&&ltv>MAINTENANCE_LTV,
    interestPaid:loan.interestPaid,
    interestCapitalized:loan.interestCapitalized,
    liquidatedCount:loan.liquidatedCount
  });
}

Engine.prototype.getPersonalStockMarginQuotes=function(){return quotesFor(this.g);};
Engine.prototype.getPersonalStockMargin=function(){return summaryFor(this.g);};
Engine.prototype.borrowPersonalStockMargin=function(productID){return borrow(this,productID);};
Engine.prototype.prepayPersonalStockMargin=function(amount){return prepay(this,amount);};

modules.personalStockMargin=Object.freeze({
  PRODUCTS,MAINTENANCE_LTV,
  annualRateFor,portfolioValueOf,ensure,hasLoan,balanceOf,currentLTV,maxPrincipalFor,quotesFor,
  borrow,prepay,liquidate,processWeek,summaryFor,
  __installed:true
});
})();
