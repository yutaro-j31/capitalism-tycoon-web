// Deterministic property mortgages, weekly debt service and refinancing.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;if(!modules?.engine?.TycoonEngine||!modules?.realEstatePropertyTaxes)throw new Error('real-estate-property-taxes.js must load before real-estate-mortgage-refinancing.js.');if(modules.realEstateMortgageRefinancing)throw new Error('real-estate-mortgage-refinancing.js already registered.');
const Engine=modules.engine.TycoonEngine,finance=modules.finance,VERSION=1,HISTORY_LIMIT=500;
// #1079 (Owner decision, 2026-10-27): as for personal holdings (personal-real-estate-mortgage.js), eight consecutive
// short weeks foreclose the property at 85% of its value; the sale settles the mortgage and its unpaid interest, and
// any deficiency stays with the borrower.
const MAX_DELINQUENT_WEEKS=8,FORECLOSURE_SALE_RATE=.85;
const PRODUCTS=Object.freeze({fixed:{id:'fixed',label:'固定金利',annualRate:.032,maxLTV:.65,termWeeks:520,feeRate:.012},variable:{id:'variable',label:'変動金利',annualRate:.024,maxLTV:.72,termWeeks:416,feeRate:.016},conservative:{id:'conservative',label:'低LTV融資',annualRate:.021,maxLTV:.5,termWeeks:624,feeRate:.008}});
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d,ceilYen=v=>modules.economicOperation.ceilYen(n(v));
// One weekly payment (YEN_CEILING_ROUNDING_CONTRACT §4): the due is rounded once and capped at balance + interest,
// interest is the charge, principal is the remainder. The final instalment pays the balance exactly, so a fractional
// balance from an older save is cleared (§3.5). syncLoan's forecast and processWeek share it.
function scheduledPayment(balance,annualRate,remainingWeeks){const b=Math.max(0,n(balance)),rawInterest=b*n(annualRate)/52,rawPrincipal=Math.min(b,b/Math.max(1,n(remainingWeeks,1))),interestCharge=ceilYen(rawInterest);if(rawPrincipal>=b)return {interest:interestCharge,principal:b,due:interestCharge+b};const due=Math.min(ceilYen(rawInterest+rawPrincipal),b+interestCharge),interest=Math.min(interestCharge,due);return {interest,principal:due-interest,due};}function valueOf(p){return Math.max(1,n(p.marketValue,n(p.purchasePrice,n(p.value,10000000))));}function ownerOf(p){return p.owner==='personal'?'personal':'company';}function cashKey(o){return o==='personal'?'personalCash':'companyCash';}function property(g,id){return(g.properties||[]).find(p=>p.id===id)||null;}
// P4-AUD-007 Option A: a company mortgage originated from a zero balance is on book. It has one finance.loans row
// (one stable ID per property) and is part of companyDebt, and every principal movement posts its liability effect.
// An older off-book mortgage (no flag) keeps its legacy behaviour until it is paid off.
const LOAN_SOURCE='propertyMortgage';
function tracked(p){return ownerOf(p)==='company'&&p.mortgageAccountingTracked===true;}
// Untracked mortgages keep interest arrears outside both generic debt aggregates. No retroactive accrual.
function interestArrears(p){return tracked(p)?0:Math.max(0,n(p?.mortgageUnpaidInterest));}
function outstandingBalance(p){return Math.max(0,n(p?.mortgageBalance))+interestArrears(p);}
function loanIDOf(p){return `property-mortgage-${p.id}`;}
function check(row,category){if(finance?.event&&!row)throw new Error(`Property mortgage finance post failed: ${category}`);return row;}
function syncLoan(g,p,product,principal){if(!finance?.ensureFinance)return null;const f=finance.ensureFinance(g),id=loanIDOf(p),balance=Math.max(0,n(p.mortgageBalance)),remaining=Math.max(0,Math.floor(n(p.mortgageRemainingWeeks)));let row=f.loans.find(x=>x.loanID===id);if(!row){row={loanID:id,sourceType:LOAN_SOURCE,propertyID:p.id,repaymentMethod:'individual',principal:0};f.loans.push(row);}if(principal!==undefined)row.principal=n(principal);if(product){row.interestRate=product.annualRate;row.termWeeks=product.termWeeks;}
// weeklyPrincipalPayment is the writer's own next scheduled principal, read by the cash forecast and the M&A buffer.
Object.assign(row,{outstandingPrincipal:balance,remainingWeeks:remaining,weeklyPrincipalPayment:scheduledPayment(balance,PRODUCTS[p.mortgageProductID]?.annualRate,remaining).principal,nextPaymentWeek:Math.floor(n(g.week,1))+1,status:balance>0?'active':'repaid'});return row;}
function ensure(g){const s=modules.realEstatePropertyTaxes.ensure(g);if(!Array.isArray(s.propertyMortgageHistory))s.propertyMortgageHistory=[];s.propertyMortgageHistory=s.propertyMortgageHistory.slice(-HISTORY_LIMIT);s.propertyMortgageSchemaVersion=VERSION;s.lastPropertyMortgageProcessedWeek=Math.max(0,Math.floor(n(s.lastPropertyMortgageProcessedWeek)));for(const p of(g.properties||[])){if(p.mortgageProductID&&!PRODUCTS[p.mortgageProductID])p.mortgageProductID='';p.mortgageBalance=Math.max(0,n(p.mortgageBalance));p.mortgageUnpaidInterest=Math.max(0,n(p.mortgageUnpaidInterest));p.mortgageDelinquentWeeks=Math.max(0,Math.floor(n(p.mortgageDelinquentWeeks)));p.mortgagePrincipalPaid=Math.max(0,n(p.mortgagePrincipalPaid));p.mortgageInterestPaid=Math.max(0,n(p.mortgageInterestPaid));p.mortgageRemainingWeeks=Math.max(0,Math.floor(n(p.mortgageRemainingWeeks)));p.lastMortgageActionWeek=Math.max(0,Math.floor(n(p.lastMortgageActionWeek)));if(p.mortgageAccountingTracked!==undefined&&p.mortgageAccountingTracked!==true)delete p.mortgageAccountingTracked;}return s;}
// P4-AUD-009: a specialist property loan (real-estate-complete-cycle.js) already secured on this property, active or
// defaulted, uses the same collateral; the mortgage targets the product's full LTV, so it is refused while such a loan is outstanding.
function otherSecuredDebt(g,id){return(Array.isArray(g.realEstateMarket?.loans)?g.realEstateMarket.loans:[]).filter(l=>l?.propertyID===id&&['active','defaulted'].includes(l.status)&&n(l.balance)>0).reduce((a,l)=>a+n(l.balance),0);}
const SHARED_COLLATERAL_REASON='この物件には不動産担保融資の残高があります。先に完済してください。';
function record(g,row){const s=ensure(g);s.propertyMortgageHistory.push(row);s.propertyMortgageHistory=s.propertyMortgageHistory.slice(-HISTORY_LIMIT);return row;}
Engine.prototype.getPropertyMortgageProducts=function(id){const p=property(this.g,id);if(!p)return[];const old=outstandingBalance(p),week=Math.floor(n(this.g.week,1));return Object.values(PRODUCTS).map(x=>{const target=ceilYen(valueOf(p)*x.maxLTV),gross=Math.max(0,target-old),fee=ceilYen(target*x.feeRate);const refinanceReason=p.lastMortgageActionWeek===week?'同じ週に再度借換できません。':otherSecuredDebt(this.g,id)>0?SHARED_COLLATERAL_REASON:target<old?'既存元本の返済が必要です。':gross<fee?'新規借入額で借換手数料を賄えません。':gross<=0&&old<=0?'借換対象の借入がありません。':null;return {...x,maxPrincipal:target,available:gross,refinanceEligible:refinanceReason===null,refinanceReason};});};
Engine.prototype.refinancePropertyMortgage=function(id,productID){return this.runTransaction(()=>{const g=this.g,p=property(g,id),product=PRODUCTS[productID],week=Math.floor(n(g.week,1));if(!p||!product||p.lastMortgageActionWeek===week||otherSecuredDebt(g,id)>0)return false;const target=ceilYen(valueOf(p)*product.maxLTV),old=outstandingBalance(p),arrears=interestArrears(p),gross=Math.max(0,target-old),fee=ceilYen(target*product.feeRate),net=Math.max(0,gross-fee),owner=ownerOf(p),key=cashKey(owner);
// A lower target would erase unpaid principal. Fees are funded only from the new draw;
// reject unsupported cash-in refinancing before changing any balance or history.
if(target<old||gross<fee||(gross<=0&&old<=0))return false;const track=owner==='company'&&(old<=0||p.mortgageAccountingTracked===true);g[key]=n(g[key])+net;p.mortgageProductID=productID;p.mortgageBalance=target;p.mortgageUnpaidInterest=0;p.mortgageInterestPaid=n(p.mortgageInterestPaid)+arrears;p.mortgageDelinquentWeeks=0;p.mortgageRemainingWeeks=product.termWeeks;p.lastMortgageActionWeek=week;if(track){p.mortgageAccountingTracked=true;g.companyDebt=n(g.companyDebt)+gross;if(gross>0)check(finance?.event?.(g,'propertyMortgageProceeds',gross,{cashEffect:gross,profitEffect:0,assetEffect:0,liabilityEffect:gross,sourceType:LOAN_SOURCE,sourceID:id,idempotencyKey:`property-mortgage-proceeds-${id}-w${week}`,description:`${p.name||id} 住宅ローン借入`}),'propertyMortgageProceeds');if(fee>0)check(finance?.event?.(g,'propertyMortgageFee',fee,{cashEffect:-fee,profitEffect:-fee,assetEffect:0,sourceType:LOAN_SOURCE,sourceID:id,idempotencyKey:`property-mortgage-fee-${id}-w${week}`,description:`${p.name||id} 借換手数料`}),'propertyMortgageFee');syncLoan(g,p,product,target);}else if(owner==='company'){if(arrears>0)check(finance?.event?.(g,'interestExpense',arrears,{cashEffect:0,profitEffect:-arrears,sourceType:'property-mortgage-interest-settled',sourceID:id,idempotencyKey:`property-mortgage-interest-settled-${id}-w${week}`,description:'借換による未払利息精算'}),'interestExpense');if(net>0)finance?.event?.(g,'propertyMortgageProceeds',net,{cashEffect:net,profitEffect:0,sourceType:'property-mortgage',sourceID:id,idempotencyKey:`property-mortgage-proceeds-${id}-w${week}`,description:`${p.name||id} 借換手取金`});if(fee>0)finance?.event?.(g,'propertyMortgageFee',fee,{cashEffect:0,profitEffect:-fee,sourceType:'property-mortgage-fee',sourceID:id,idempotencyKey:`property-mortgage-fee-${id}-w${week}`,description:`${p.name||id} 借換手数料`});}record(g,{type:'mortgage-refinance',week,propertyID:id,owner,productID,oldBalance:old,newBalance:target,fee,netProceeds:net});return{oldBalance:old,newBalance:target,fee,netProceeds:net};});};
Engine.prototype.prepayPropertyMortgage=function(id,amount){return this.runTransaction(()=>{
  const g=this.g,p=property(g,id),week=Math.floor(n(g.week,1)),requested=Math.max(0,n(amount));
  if(!p||outstandingBalance(p)<=0||requested<=0||p.lastMortgageActionWeek===week)return false;
  const owner=ownerOf(p),key=cashKey(owner),paid=Math.min(ceilYen(requested),outstandingBalance(p),Math.max(0,n(g[key])));
  if(paid<=0)return false;
  const interestPaid=Math.min(interestArrears(p),paid),principalPaid=paid-interestPaid;
  g[key]=n(g[key])-paid;p.mortgageBalance=n(p.mortgageBalance)-principalPaid;
  p.mortgageUnpaidInterest=interestArrears(p)-interestPaid;
  p.mortgagePrincipalPaid=n(p.mortgagePrincipalPaid)+principalPaid;p.mortgageInterestPaid=n(p.mortgageInterestPaid)+interestPaid;p.lastMortgageActionWeek=week;
  if(outstandingBalance(p)<=0){p.mortgageRemainingWeeks=0;p.mortgageDelinquentWeeks=0;}
  if(tracked(p)){
    g.companyDebt=n(g.companyDebt)-principalPaid;
    if(principalPaid>0)check(finance?.event?.(g,'propertyMortgagePrepayment',principalPaid,{cashEffect:-principalPaid,profitEffect:0,assetEffect:0,liabilityEffect:-principalPaid,sourceType:LOAN_SOURCE,sourceID:id,idempotencyKey:`property-mortgage-prepay-${id}-w${week}`,description:`${p.name||id} 繰上返済`}),'propertyMortgagePrepayment');
    syncLoan(g,p);
  }else if(owner==='company'){
    if(interestPaid>0)check(finance?.event?.(g,'interestExpense',interestPaid,{cashEffect:-interestPaid,profitEffect:-interestPaid,sourceType:'property-mortgage-prepayment-interest',sourceID:id,idempotencyKey:`property-mortgage-prepay-interest-${id}-w${week}`,description:'未払住宅ローン利息の精算'}),'interestExpense');
    if(principalPaid>0)finance?.event?.(g,'propertyMortgagePrepayment',principalPaid,{cashEffect:-principalPaid,profitEffect:0,sourceType:'property-mortgage-prepayment',sourceID:id,idempotencyKey:`property-mortgage-prepay-${id}-w${week}`,description:`${p.name||id} 繰上返済`});
  }
  record(g,{type:'mortgage-prepayment',week,propertyID:id,owner,amount:paid,interest:interestPaid,principal:principalPaid,balance:p.mortgageBalance,unpaidInterest:p.mortgageUnpaidInterest});return paid;
});};
// A company mortgage from before P4-AUD-007 is off book and its sale is quarantined (real-estate-property-disposals.js),
// so it keeps counting delinquency without being foreclosed. The sale would also throw inside the week, rolling the
// whole week back, without canonical book values or when another secured loan would be left short; those cases keep
// counting delinquency too.
function foreclose(engine,p,week){const disposals=modules.realEstatePropertyDisposals,owner=ownerOf(p);if(!(owner==='personal'||tracked(p))||!disposals)return null;const g=engine.g,gross=ceilYen(valueOf(p)*FORECLOSURE_SALE_RATE),debt=disposals.securedLoans(g,p,owner);if(!disposals.canonicalBook(g,p)||(debt.total>gross&&(debt.marketLoans.length||debt.collateralLoans.length)))return null;const name=p.name||p.id,owed=outstandingBalance(p),result=disposals.settlePropertyDisposition(engine,{propertyID:p.id,reason:'foreclosure',grossSalePrice:gross,fees:0,retainProperty:true,sourceType:'propertyMortgageForeclosure',saleWeek:week,idempotencyKey:`property-mortgage-foreclosure-${p.id}-w${week}`});if(!result)return null;const carried=n(result.mortgageDeficiency);engine.notify?.(carried>0?`${name}が住宅ローンの延滞により差し押さえられました。売却代金では返済しきれず、${carried.toLocaleString('ja-JP')}円が負債として残りました。`:`${name}が住宅ローンの延滞により差し押さえられました。売却代金で残債${owed.toLocaleString('ja-JP')}円を清算しました。`,'error');return record(g,{type:'mortgage-foreclosure',week,propertyID:p.id,owner,salePrice:result.salePrice,mortgagePaid:result.mortgage,deficiency:carried});}
function processWeek(engine){
  const g=engine.g,s=ensure(g),week=Math.floor(n(g.week,1));if(s.lastPropertyMortgageProcessedWeek===week)return[];
  const rows=[];
  for(const p of(g.properties||[])){
    const product=PRODUCTS[p.mortgageProductID];if(!product||outstandingBalance(p)<=0)continue;
    const owner=ownerOf(p),key=cashKey(owner),scheduled=scheduledPayment(p.mortgageBalance,product.annualRate,p.mortgageRemainingWeeks);
    // Previously accrued interest is already settled debt, so neither round it again nor charge interest on it.
    const arrears=interestArrears(p),interest=scheduled.interest+arrears,due=scheduled.due+arrears;
    const paid=Math.min(Math.max(0,n(g[key])),due),interestPaid=Math.min(interest,paid),principalPaid=paid-interestPaid,unpaidInterest=interest-interestPaid;
    g[key]=n(g[key])-paid;p.mortgageBalance=Math.max(0,n(p.mortgageBalance)-principalPaid);
    p.mortgageInterestPaid=n(p.mortgageInterestPaid)+interestPaid;p.mortgagePrincipalPaid=n(p.mortgagePrincipalPaid)+principalPaid;
    p.mortgageDelinquentWeeks=paid<due?Math.floor(n(p.mortgageDelinquentWeeks))+1:0;
    // A short instalment is still due. An old save already at zero weeks gets one overdue instalment,
    // rather than silently keeping an active debt with a zero schedule.
    p.mortgageRemainingWeeks=paid<due?Math.max(1,Math.floor(n(p.mortgageRemainingWeeks))):Math.max(0,Math.floor(n(p.mortgageRemainingWeeks)-1));
    if(tracked(p)){
      if(interestPaid>0)check(finance?.event?.(g,'interestExpense',interestPaid,{cashEffect:-interestPaid,profitEffect:-interestPaid,assetEffect:0,sourceType:LOAN_SOURCE,sourceID:p.id,idempotencyKey:`property-mortgage-interest-${p.id}-w${week}`,description:`${p.name||p.id} 住宅ローン利息`}),'interestExpense');
      if(principalPaid>0){
        g.companyDebt=n(g.companyDebt)-principalPaid;
        check(finance?.event?.(g,'debtRepayment',principalPaid,{cashEffect:-principalPaid,profitEffect:0,assetEffect:0,liabilityEffect:-principalPaid,sourceType:LOAN_SOURCE,sourceID:p.id,idempotencyKey:`property-mortgage-principal-${p.id}-w${week}`,description:`${p.name||p.id} 住宅ローン元本返済`}),'debtRepayment');
      }
      // Preserve Option A: on-book company interest is expensed and capitalised exactly once.
      if(unpaidInterest>0){
        p.mortgageBalance=n(p.mortgageBalance)+unpaidInterest;g.companyDebt=n(g.companyDebt)+unpaidInterest;
        check(finance?.event?.(g,'interestExpense',unpaidInterest,{cashEffect:0,profitEffect:-unpaidInterest,assetEffect:0,sourceType:LOAN_SOURCE,sourceID:p.id,idempotencyKey:`property-mortgage-interest-accrued-${p.id}-w${week}`,description:`${p.name||p.id} 住宅ローン未払利息`}),'interestExpense');
        check(finance?.event?.(g,'debtBorrowing',unpaidInterest,{cashEffect:0,profitEffect:0,assetEffect:0,liabilityEffect:unpaidInterest,sourceType:LOAN_SOURCE,sourceID:p.id,idempotencyKey:`property-mortgage-capitalised-${p.id}-w${week}`,description:`${p.name||p.id} 未払利息の元本組入`}),'debtBorrowing');
      }
      syncLoan(g,p);
    }else{
      // Personal/legacy debt remains off the generic aggregates. Record the unpaid charge explicitly;
      // legacy company books retain their cash-basis interest treatment until that charge is actually paid.
      p.mortgageUnpaidInterest=unpaidInterest;
      if(owner==='company'){
        if(interestPaid>0)finance?.event?.(g,'interestExpense',interestPaid,{cashEffect:-interestPaid,profitEffect:-interestPaid,sourceType:'property-mortgage-payment',sourceID:p.id,idempotencyKey:`property-mortgage-interest-${p.id}-w${week}`,description:`${p.name||p.id} 住宅ローン利息`});
        if(principalPaid>0)finance?.event?.(g,'debtRepayment',principalPaid,{cashEffect:-principalPaid,profitEffect:0,sourceType:'property-mortgage-payment',sourceID:p.id,idempotencyKey:`property-mortgage-principal-${p.id}-w${week}`,description:`${p.name||p.id} 住宅ローン元本返済`});
      }
    }
    if(outstandingBalance(p)<=0)p.mortgageRemainingWeeks=0;
    rows.push(record(g,{type:'mortgage-payment',week,propertyID:p.id,owner,interest:interestPaid,principal:principalPaid,unpaid:due-paid,unpaidInterest,delinquentWeeks:p.mortgageDelinquentWeeks,balance:p.mortgageBalance}));
    if(p.mortgageDelinquentWeeks>=MAX_DELINQUENT_WEEKS){const row=foreclose(engine,p,week);if(row)rows.push(row);}
    else if(p.mortgageDelinquentWeeks===MAX_DELINQUENT_WEEKS-2&&(owner==='personal'||tracked(p)))engine.notify?.(`${p.name||p.id}の住宅ローンが${p.mortgageDelinquentWeeks}週延滞しています。あと2週延滞すると差し押さえられます。`,'warning');
  }
  s.lastPropertyMortgageProcessedWeek=week;return rows;
}
const baseNormalize=Engine.prototype.normalize;Engine.prototype.normalize=function(){const out=baseNormalize.call(this);ensure(this.g);return out;};const existing=Engine.prototype.updateParityWeekly;function wrap(base){if(typeof base!=='function')return base;const fn=function(){const out=base.apply(this,arguments);processWeek(this);return out;};Object.defineProperty(fn,'__realEstateMortgageRefinancingWrapped',{value:true});return fn;}if(typeof existing==='function'&&!existing.__realEstateMortgageRefinancingWrapped)Engine.prototype.updateParityWeekly=wrap(existing);else if(typeof existing!=='function')Object.defineProperty(Engine.prototype,'updateParityWeekly',{configurable:true,get(){return undefined;},set(fn){Object.defineProperty(Engine.prototype,'updateParityWeekly',{value:fn?.__realEstateMortgageRefinancingWrapped?fn:wrap(fn),writable:true,configurable:true});}});
modules.realEstateMortgageRefinancing=Object.freeze({VERSION,MAX_DELINQUENT_WEEKS,FORECLOSURE_SALE_RATE,HISTORY_LIMIT,PRODUCTS,LOAN_SOURCE,loanIDOf,scheduledPayment,interestArrears,outstandingBalance,ensure,processWeek});


})();