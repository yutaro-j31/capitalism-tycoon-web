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
//
// Timing fix (multi-store expansion follow-up): this module used to wrap
// EngineClass.prototype.advanceWeek() as its own outer layer, so its draw only ran AFTER
// js/player-crisis.js's own advanceWeek wrapper -- including that week's grace-period
// evaluate() -- had already read companyCash and possibly finalized gameOver. A 40-seed,
// 160-week multi-store expansion re-measurement found 2/40 bankruptcies where the credit line
// still had unused room under CAP at the moment of failure: the draw simply came one week too
// late to stop that week's raw-negative cash from counting against the grace-period countdown.
// This module now registers into js/player-crisis.js's registerPreEvaluateHook() instead, which
// runs strictly before evaluate() reads cash for the week, so a successful draw here is visible
// to that same week's grace-period decision instead of only cushioning the following week's
// starting balance.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine must be loaded before real-estate-agency-credit-line.js.');
if(!modules?.finance)throw new Error('Capitalism Tycoon finance must be loaded before real-estate-agency-credit-line.js.');
if(!modules?.playerCrisis?.__installed)throw new Error('Capitalism Tycoon playerCrisis must be loaded before real-estate-agency-credit-line.js.');
if(typeof modules.playerCrisis.registerPreEvaluateHook!=='function')throw new Error('Capitalism Tycoon playerCrisis must expose registerPreEvaluateHook before real-estate-agency-credit-line.js.');
if(modules.realEstateAgencyCreditLine)throw new Error('Capitalism Tycoon realEstateAgencyCreditLine module is already registered.');
const finance=modules.finance;
const BUSINESS_ID='realEstateAgency',SOURCE_TYPE='realEstateAgencyCreditLine';
// Measured minimums: CAP=6,000,000 reaches 0/100 single-store bankruptcies in the founding-period
// cluster (100-seed sweep). CUSHION (the single-store baseline, unchanged from the original
// measurement) =1,200,000 (~2 weeks of the ~540,000/week dry-spell burn) is the point past which
// a larger cushion stops reducing single-store failures (600K -> 3/40, 1.2M -> 2/40, 1.8M -> 2/40,
// same 2 seeds -- see below, that residual was a timing bug, not a cushion-size problem).
// REPAY_FLOOR_MULTIPLIER leaves a full cushion of headroom after repaying so the same week's
// repayment cannot immediately trigger a re-draw.
//
// Multi-store scaling: aggregate dry-spell burn grows roughly with open store count (each store
// contributes its own independent ~540,000/week worst case), so a fixed single-store cushion
// gives progressively less coverage as a company expands. cushionFor()/repayFloorFor() scale the
// cushion by CUSHION_PER_STORE for each store beyond the first, bounded by CUSHION_MAX so the
// resulting repay floor (cushion*REPAY_FLOOR_MULTIPLIER) never approaches CAP. CUSHION/REPAY_FLOOR
// remain exported as the unchanged single-store values for backward compatibility with existing
// single-store callers/tests.
const CAP=6_000_000,CUSHION=1_200_000,REPAY_FLOOR_MULTIPLIER=2,REPAY_FLOOR=CUSHION*REPAY_FLOOR_MULTIPLIER;
const CUSHION_PER_STORE=100_000,CUSHION_MAX=2_400_000;
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
function creditLineLoans(g){return finance.ensureFinance(g).loans.filter(l=>l&&l.sourceType===SOURCE_TYPE);}
function outstandingBalance(g){return creditLineLoans(g).filter(l=>l.status==='active').reduce((a,l)=>a+finite(l.outstandingPrincipal),0);}
function openStoreCount(g){return (Array.isArray(g?.stores)?g.stores:[]).filter(s=>s?.businessID===BUSINESS_ID&&s.status==='open').length;}
function eligible(g){return openStoreCount(g)>0;}
function cushionFor(g){const count=Math.max(1,openStoreCount(g));return Math.min(CUSHION_MAX,CUSHION+CUSHION_PER_STORE*(count-1));}
function repayFloorFor(g){return cushionFor(g)*REPAY_FLOOR_MULTIPLIER;}
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
  const cushion=cushionFor(g),repayFloor=repayFloorFor(g);
  const outstanding=outstandingBalance(g),cash=finite(g.companyCash);
  if(cash<cushion){
    const room=Math.max(0,CAP-outstanding),need=Math.min(room,cushion-cash);
    return need>0?draw(g,need):0;
  }
  if(cash>repayFloor&&outstanding>0)return repay(g,Math.min(cash-repayFloor,outstanding));
  return 0;
}
function install(){
  // registerPreEvaluateHook() is itself idempotent for the same function reference, and the
  // top-of-file guard above already prevents this module from loading twice in one runtime.
  modules.playerCrisis.registerPreEvaluateHook(service);
  return true;
}
install();
modules.realEstateAgencyCreditLine=Object.freeze({BUSINESS_ID,SOURCE_TYPE,CAP,CUSHION,REPAY_FLOOR,REPAY_FLOOR_MULTIPLIER,CUSHION_PER_STORE,CUSHION_MAX,eligible,openStoreCount,cushionFor,repayFloorFor,outstandingBalance,draw,repay,service});
})();
