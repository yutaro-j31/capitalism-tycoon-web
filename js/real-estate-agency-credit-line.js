// Deterministic, company-level revolving credit line for realEstateAgency's founding-period
// cash crunch. Measured (harness sweeps, 10/40/100 seeds): commission income arrives as a
// memoryless "time to first deal" process -- roughly -540,000/week burn from rent+fixedCost+wage
// while no deal has closed -- so a founding store can face a long dry spell before its first
// commission. A plain top-up to exactly zero does nothing: js/player-crisis.js's grace-period
// recovery only resets on a week that ends non-negative, and the very next week's typical
// dry-spell loss immediately erases an exact-zero top-up before that check runs again. This
// module instead draws up to a cushion whenever cash would fall below it, and sweeps repayment
// once cash is comfortably above that cushion, fully revolving within a finite cap. It never
// touches js/bank-loans-covenants.js's own bookkeeping (state.bankFinancing.loans), so it cannot
// reach that module's covenant-breach/default path.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine must be loaded before real-estate-agency-credit-line.js.');
if(!modules?.finance)throw new Error('Capitalism Tycoon finance must be loaded before real-estate-agency-credit-line.js.');
if(!modules?.playerCrisis?.__installed)throw new Error('Capitalism Tycoon playerCrisis must be loaded before real-estate-agency-credit-line.js.');
if(modules.realEstateAgencyCreditLine)throw new Error('Capitalism Tycoon realEstateAgencyCreditLine module is already registered.');
const EngineClass=modules.engine.TycoonEngine,finance=modules.finance;
const BUSINESS_ID='realEstateAgency',SOURCE_TYPE='realEstateAgencyCreditLine';
// Measured minimums: CAP=6,000,000 reaches 0/100 single-store bankruptcies in the founding-period
// cluster (100-seed sweep); the 2 residual multi-store failures at this cap are a distinct,
// out-of-scope late-game clustering risk (see founding-route-verification-log.md), not a
// founding dry spell. CUSHION=1,200,000 (~2 weeks of the ~540,000/week dry-spell burn) is the
// point past which a larger cushion stops reducing failures (600K -> 3/40, 1.2M -> 2/40,
// 1.8M -> 2/40, same 2 seeds). REPAY_FLOOR leaves a full cushion of headroom after repaying so
// the same week's repayment cannot immediately trigger a re-draw.
const CAP=6_000_000,CUSHION=1_200_000,REPAY_FLOOR=CUSHION*2;
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
function creditLineLoans(g){return finance.ensureFinance(g).loans.filter(l=>l&&l.sourceType===SOURCE_TYPE);}
function outstandingBalance(g){return creditLineLoans(g).filter(l=>l.status==='active').reduce((a,l)=>a+finite(l.outstandingPrincipal),0);}
function eligible(g){return (Array.isArray(g?.stores)?g.stores:[]).some(s=>s?.businessID===BUSINESS_ID&&s.status==='open');}
function draw(g,amount){
  amount=Math.max(0,finite(amount));if(amount<=0)return 0;
  const f=finance.ensureFinance(g),week=finite(g.week,1),seq=finite(f.nextTransactionSeq,1),id=`realestate-credit-draw-${week}-${seq}`;
  g.companyCash=finite(g.companyCash)+amount;g.companyDebt=finite(g.companyDebt)+amount;
  f.loans.push({loanID:id,principal:amount,outstandingPrincipal:amount,interestRate:0,termWeeks:9999,remainingWeeks:9999,repaymentMethod:'manual',weeklyPrincipalPayment:0,nextPaymentWeek:week+1,status:'active',sourceType:SOURCE_TYPE,sourceID:id});
  finance.event(g,'debtBorrowing',amount,{cashEffect:amount,liabilityEffect:amount,sourceType:SOURCE_TYPE,sourceID:id,operationID:id,idempotencyKey:`${id}-ledger`,description:'不動産仲介 運転資金credit line引き出し'});
  return amount;
}
function repay(g,amount){
  amount=Math.max(0,finite(amount));if(amount<=0)return 0;
  const active=creditLineLoans(g).filter(l=>l.status==='active'&&l.outstandingPrincipal>0);
  let remaining=amount,paid=0;
  for(const loan of active){
    if(remaining<=0)break;
    const pay=Math.min(remaining,loan.outstandingPrincipal);
    loan.outstandingPrincipal=Math.max(0,loan.outstandingPrincipal-pay);
    remaining-=pay;paid+=pay;
    if(loan.outstandingPrincipal<=.01){loan.outstandingPrincipal=0;loan.status='repaid';}
  }
  if(paid<=0)return 0;
  g.companyCash=finite(g.companyCash)-paid;g.companyDebt=Math.max(0,finite(g.companyDebt)-paid);
  const f=finance.ensureFinance(g),week=finite(g.week,1),seq=finite(f.nextTransactionSeq,1),id=`realestate-credit-repay-${week}-${seq}`;
  finance.event(g,'debtRepayment',paid,{cashEffect:-paid,liabilityEffect:-paid,sourceType:SOURCE_TYPE,sourceID:id,operationID:id,idempotencyKey:`${id}-ledger`,description:'不動産仲介 運転資金credit line返済'});
  return paid;
}
function service(g){
  if(!eligible(g))return 0;
  const outstanding=outstandingBalance(g),cash=finite(g.companyCash);
  if(cash<CUSHION){
    const room=Math.max(0,CAP-outstanding),need=Math.min(room,CUSHION-cash);
    return need>0?draw(g,need):0;
  }
  if(cash>REPAY_FLOOR&&outstanding>0)return repay(g,Math.min(cash-REPAY_FLOOR,outstanding));
  return 0;
}
function install(){
  const proto=EngineClass.prototype;
  if(proto.__realEstateAgencyCreditLineInstalled)return true;
  const baseAdvanceWeek=proto.advanceWeek;
  proto.advanceWeek=function(showSummary=true){
    const result=baseAdvanceWeek.call(this,showSummary);
    if(result!==false&&!this.g.gameOver&&service(this.g)!==0){this.save();this.emit();}
    return result;
  };
  Object.defineProperty(proto,'__realEstateAgencyCreditLineInstalled',{value:true});
  return true;
}
install();
modules.realEstateAgencyCreditLine=Object.freeze({BUSINESS_ID,SOURCE_TYPE,CAP,CUSHION,REPAY_FLOOR,eligible,outstandingBalance,draw,repay,service});
})();
