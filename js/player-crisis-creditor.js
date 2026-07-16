// Phase 6A-4A: deterministic creditor negotiations during a player-company liquidity crisis.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before player-crisis-creditor.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.playerCrisis?.__installed)throw new Error('player-crisis.js must be loaded before player-crisis-creditor.js.');
if(!modules.playerCrisisActions?.__installed)throw new Error('player-crisis-actions.js must be loaded before player-crisis-creditor.js.');
if(!modules.playerCrisisRestructuring?.__installed)throw new Error('player-crisis-restructuring.js must be loaded before player-crisis-creditor.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before player-crisis-creditor.js.');
if(modules.playerCrisisCreditor)throw new Error('player crisis creditor module is already registered.');

const engine=modules.engine;
const finance=modules.finance;
const playerCrisis=modules.playerCrisis;
const EngineClass=engine.TycoonEngine;
const NEGOTIATION_TYPES=Object.freeze(['principalDeferral','maturityExtension','interestReduction']);
const ELIGIBLE_STATUSES=new Set(['watch','distressed','turnaround']);
const HISTORY_LIMIT=52;
const COOLDOWN_WEEKS=8;
const DEFERRAL_WEEKS=8;
const EXTENSION_WEEKS=26;
const FAILURE_CREDIT_PENALTY=3;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const text=value=>String(value??'');
const plain=value=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));

function hashRoll(input){let hash=2166136261;for(const char of String(input)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0)/4294967296;}
function normalizeHistory(value){
 const rows=Array.isArray(value)?value:[],seen=new Set(),out=[];
 for(const row of rows){
  if(!plain(row))continue;
  const negotiationID=text(row.negotiationID);
  if(!negotiationID||seen.has(negotiationID))continue;
  seen.add(negotiationID);
  out.push({
   negotiationID,
   operationID:text(row.operationID||`player-crisis-creditor-${negotiationID}`),
   week:integer(row.week),
   type:NEGOTIATION_TYPES.includes(row.type)?row.type:'principalDeferral',
   loanID:text(row.loanID),
   loanName:text(row.loanName),
   approvalChance:clamp(row.approvalChance,0,1),
   approvalRoll:clamp(row.approvalRoll,0,1),
   success:Boolean(row.success),
   creditBefore:clamp(row.creditBefore,0,100),
   creditAfter:clamp(row.creditAfter,0,100),
   previousValue:finite(row.previousValue),
   nextValue:finite(row.nextValue),
   statusBefore:text(row.statusBefore),
   statusAfter:text(row.statusAfter),
   detail:text(row.detail)
  });
 }
 return out.slice(-HISTORY_LIMIT);
}
function ensure(state){
 if(!plain(state))throw new Error('player crisis creditor state root must be an object.');
 const current=plain(state.playerCrisisCreditor)?state.playerCrisisCreditor:{};
 current.nextNegotiationSeq=Math.max(1,integer(current.nextNegotiationSeq,1));
 current.lastAttemptWeekByLoanID=plain(current.lastAttemptWeekByLoanID)?current.lastAttemptWeekByLoanID:{};
 for(const [loanID,week] of Object.entries(current.lastAttemptWeekByLoanID))current.lastAttemptWeekByLoanID[loanID]=integer(week);
 current.history=normalizeHistory(current.history);
 state.playerCrisisCreditor=current;
 return current;
}
function activeLoans(state){
 return finance.ensureFinance(state).loans
  .filter(loan=>loan&&loan.status==='active'&&finite(loan.outstandingPrincipal)>0)
  .sort((a,b)=>finite(b.outstandingPrincipal)-finite(a.outstandingPrincipal)||text(a.loanID).localeCompare(text(b.loanID)));
}
function cooldownRemaining(state,loanID){
 const last=ensure(state).lastAttemptWeekByLoanID[text(loanID)];
 return last==null?0:Math.max(0,COOLDOWN_WEEKS-(integer(state.week)-integer(last)));
}
function restructuringTrackRecord(state){
 const disposition=Array.isArray(state.playerCrisisRestructuring?.history)?state.playerCrisisRestructuring.history.length:0;
 const cost=Array.isArray(state.playerCrisisRestructuring?.costHistory)?state.playerCrisisRestructuring.costHistory.length:0;
 const founder=Array.isArray(state.playerCrisisActions?.history)?state.playerCrisisActions.history.filter(row=>row.type==='founderCapital').length:0;
 return Math.min(8,disposition+cost+founder);
}
function recentFailure(state,loanID){
 return [...ensure(state).history].reverse().find(row=>row.loanID===text(loanID))?.success===false;
}
function approvalChance(instance,type,loan){
 const state=instance.g;
 const base={principalDeferral:.76,maturityExtension:.66,interestReduction:.52}[type]??.5;
 const credit=clamp(state.companyCredit,0,100);
 const cfo=state.executives?.CFO||{};
 const cfoFinance=clamp(finite(cfo.finance,cfo.skill),0,100);
 const debt=Math.max(0,finite(state.companyDebt));
 const enterpriseBase=Math.max(1,finite(instance.companyValue())+debt);
 const leverage=clamp(debt/enterpriseBase,0,2);
 const crisis=playerCrisis.ensure(state);
 const chance=base
  +(credit-50)*.004
  +(cfoFinance-50)*.002
  +restructuringTrackRecord(state)*.01
  -Math.min(.22,leverage*.22)
  -(finite(state.companyCash)<0?.05:0)
  -(crisis.status==='distressed'?.05:crisis.status==='turnaround'?.02:0)
  -(recentFailure(state,loan.loanID)?.06:0);
 return clamp(chance,.12,.92);
}
function loanLabel(loan){
 if(loan.sourceType==='playerCrisisEmergencyLoan')return '危機対応ブリッジローン';
 if(loan.loanID==='legacy-company-debt')return '既存借入金';
 return text(loan.name||loan.loanID||'借入金');
}
function actionPreview(instance,type,loan){
 const state=instance.g;
 const chance=approvalChance(instance,type,loan);
 const outstanding=Math.max(0,finite(loan.outstandingPrincipal));
 const rate=clamp(finite(loan.interestRate,instance.companyBorrowRate()),0,.18);
 const cooldown=cooldownRemaining(state,loan.loanID);
 let currentValue=0,nextValue=0,benefit='';
 if(type==='principalDeferral'){
  currentValue=integer(loan.principalMoratoriumUntilWeek);
  nextValue=Math.max(currentValue,integer(state.week)+DEFERRAL_WEEKS);
  benefit=`元本返済を第${nextValue}週まで猶予`;
 }else if(type==='maturityExtension'){
  currentValue=integer(loan.remainingWeeks,loan.termWeeks);
  nextValue=currentValue+EXTENSION_WEEKS;
  benefit=`残存期間を${EXTENSION_WEEKS}週延長`;
 }else{
  currentValue=rate;
  const reduction=Math.max(.005,Math.min(.015,rate*.2));
  nextValue=Math.max(.008,rate-reduction);
  benefit=`年率${(rate*100).toFixed(2)}%→${(nextValue*100).toFixed(2)}%`;
 }
 return Object.freeze({type,loanID:text(loan.loanID),loanName:loanLabel(loan),outstandingPrincipal:outstanding,currentValue,nextValue,benefit,approvalChance:chance,approvalPercent:Math.round(chance*100),cooldownWeeksRemaining:cooldown,canExecute:ELIGIBLE_STATUSES.has(playerCrisis.ensure(state).status)&&cooldown===0&&!state.gameOver&&!state.isCompanySold});
}
function options(instance){
 const state=instance.g;
 const status=playerCrisis.ensure(state).status;
 const loans=activeLoans(state).map(loan=>Object.freeze({
  loanID:text(loan.loanID),
  loanName:loanLabel(loan),
  outstandingPrincipal:Math.max(0,finite(loan.outstandingPrincipal)),
  interestRate:clamp(finite(loan.interestRate,instance.companyBorrowRate()),0,.18),
  remainingWeeks:integer(loan.remainingWeeks,loan.termWeeks),
  cooldownWeeksRemaining:cooldownRemaining(state,loan.loanID),
  actions:Object.freeze(NEGOTIATION_TYPES.map(type=>actionPreview(instance,type,loan)))
 }));
 const recommended=loans.flatMap(row=>row.actions).filter(row=>row.canExecute).sort((a,b)=>b.approvalChance-a.approvalChance||b.outstandingPrincipal-a.outstandingPrincipal||a.type.localeCompare(b.type)).slice(0,5);
 return Object.freeze({status,eligible:ELIGIBLE_STATUSES.has(status)&&!state.gameOver&&!state.isCompanySold,loans:Object.freeze(loans),recommended:Object.freeze(recommended)});
}
function findCandidate(instance,type,loanID){
 if(!NEGOTIATION_TYPES.includes(type))return null;
 const data=options(instance);
 for(const loan of data.loans){const row=loan.actions.find(action=>action.type===type&&action.loanID===text(loanID));if(row)return row;}
 return null;
}
function reevaluate(state){const crisis=playerCrisis.ensure(state);crisis.lastEvaluationWeek=Math.max(0,integer(state.week)-1);return playerCrisis.evaluate(state);}
function applySuccess(state,type,loan,candidate){
 if(type==='principalDeferral'){
  const until=Math.max(integer(loan.principalMoratoriumUntilWeek),integer(state.week)+DEFERRAL_WEEKS);
  loan.principalMoratoriumUntilWeek=until;
  if(loan.nextPaymentWeek!=null&&integer(loan.nextPaymentWeek)<=until)loan.nextPaymentWeek=until+1;
  return {previousValue:candidate.currentValue,nextValue:until};
 }
 if(type==='maturityExtension'){
  const previous=integer(loan.remainingWeeks,loan.termWeeks);
  loan.termWeeks=integer(loan.termWeeks)+EXTENSION_WEEKS;
  loan.remainingWeeks=previous+EXTENSION_WEEKS;
  loan.maturityExtendedWeeks=integer(loan.maturityExtendedWeeks)+EXTENSION_WEEKS;
  return {previousValue:previous,nextValue:loan.remainingWeeks};
 }
 const previous=clamp(finite(loan.interestRate,candidate.currentValue),0,.18);
 const next=clamp(candidate.nextValue,.008,previous);
 loan.preCrisisNegotiationInterestRate=Number.isFinite(Number(loan.preCrisisNegotiationInterestRate))?finite(loan.preCrisisNegotiationInterestRate):previous;
 loan.crisisNegotiatedRateDiscount=Math.max(0,finite(loan.crisisNegotiatedRateDiscount)+(previous-next));
 loan.interestRate=next;
 return {previousValue:previous,nextValue:next};
}
function execute(instance,type,loanID){
 const state=instance.g,status=playerCrisis.ensure(state).status;
 if(state.gameOver||state.isCompanySold||status==='insolvent')return instance.fail('支払不能または会社売却後は債権者交渉を実行できません。');
 if(!ELIGIBLE_STATUSES.has(status))return instance.fail('債権者交渉は資金繰り注意・危機・再建中に利用できます。');
 const candidate=findCandidate(instance,type,loanID);
 if(!candidate)return instance.fail('交渉対象の借入が見つかりません。');
 if(candidate.cooldownWeeksRemaining>0)return instance.fail(`この借入の再交渉まで${candidate.cooldownWeeksRemaining}週必要です。`);
 const loan=activeLoans(state).find(row=>text(row.loanID)===text(loanID));
 if(!loan)return instance.fail('交渉対象の借入が見つかりません。');
 return instance.runTransaction(()=>{
  const negotiationState=ensure(state),seq=negotiationState.nextNegotiationSeq++,negotiationID=`pcc-${seq}`,operationID=`player-crisis-creditor-${negotiationID}`;
  const creditBefore=clamp(state.companyCredit,0,100),chance=approvalChance(instance,type,loan),roll=hashRoll(`${integer(state.week)}|${text(loan.loanID)}|${type}|${seq}|${Math.round(creditBefore)}`),success=roll<chance;
  const previousStatus=status;
  let values={previousValue:candidate.currentValue,nextValue:candidate.currentValue};
  if(success)values=applySuccess(state,type,loan,candidate);
  else state.companyCredit=clamp(creditBefore-FAILURE_CREDIT_PENALTY,0,100);
  negotiationState.lastAttemptWeekByLoanID[text(loan.loanID)]=integer(state.week);
  const crisis=reevaluate(state);
  const detail=success
   ?`${candidate.loanName} ${type} 承認 / ${candidate.benefit} / 状態 ${previousStatus}→${crisis.status}`
   :`${candidate.loanName} ${type} 否決 / 信用 ${Math.round(creditBefore)}→${Math.round(state.companyCredit)} / 状態 ${previousStatus}→${crisis.status}`;
  negotiationState.history.push({negotiationID,operationID,week:integer(state.week),type,loanID:text(loan.loanID),loanName:candidate.loanName,approvalChance:chance,approvalRoll:roll,success,creditBefore,creditAfter:state.companyCredit,previousValue:values.previousValue,nextValue:values.nextValue,statusBefore:previousStatus,statusAfter:crisis.status,detail});
  negotiationState.history=negotiationState.history.slice(-HISTORY_LIMIT);
  instance.notify(success?`${candidate.loanName}の条件変更交渉が成立しました。${candidate.benefit}。`:`${candidate.loanName}の条件変更交渉は不成立でした。会社信用が${FAILURE_CREDIT_PENALTY}低下しました。`,success?'success':'warning');
  validate(state);
  const financeResult=finance.validate(state);
  if(financeResult?.ok===false)throw new Error(financeResult.errors.join(' / '));
  return true;
 });
}
function validate(state){
 const current=state?.playerCrisisCreditor,errors=[];
 if(!plain(current))errors.push('playerCrisisCreditorがオブジェクトではありません。');
 else{
  if(!Number.isFinite(Number(current.nextNegotiationSeq))||Number(current.nextNegotiationSeq)<1)errors.push('playerCrisisCreditor.nextNegotiationSeqが不正です。');
  if(!plain(current.lastAttemptWeekByLoanID))errors.push('playerCrisisCreditor.lastAttemptWeekByLoanIDがオブジェクトではありません。');
  else for(const [loanID,week] of Object.entries(current.lastAttemptWeekByLoanID)){if(!loanID||!Number.isFinite(Number(week)))errors.push('playerCrisisCreditor.lastAttemptWeekByLoanID要素が不正です。');}
  if(!Array.isArray(current.history))errors.push('playerCrisisCreditor.historyが配列ではありません。');
  else{
   if(current.history.length>HISTORY_LIMIT)errors.push('playerCrisisCreditor.historyが上限を超えています。');
   const ids=new Set();
   for(const row of current.history){
    if(!plain(row)||!row.negotiationID||!NEGOTIATION_TYPES.includes(row.type)||!row.loanID)errors.push('playerCrisisCreditor.history要素が不正です。');
    else if(ids.has(row.negotiationID))errors.push('playerCrisisCreditor negotiationIDが重複しています。');else ids.add(row.negotiationID);
    for(const key of ['week','approvalChance','approvalRoll','creditBefore','creditAfter','previousValue','nextValue'])if(!Number.isFinite(Number(row?.[key])))errors.push(`playerCrisisCreditor.history.${key}が有限数ではありません。`);
   }
  }
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

const baseBorrowRate=EngineClass.prototype.companyBorrowRate;
EngineClass.prototype.companyBorrowRate=function(){
 const base=clamp(baseBorrowRate.call(this),.005,.18),loans=activeLoans(this.g),total=loans.reduce((sum,loan)=>sum+Math.max(0,finite(loan.outstandingPrincipal)),0);
 if(total<=0)return base;
 const relief=loans.reduce((sum,loan)=>sum+Math.max(0,finite(loan.outstandingPrincipal))*Math.max(0,finite(loan.crisisNegotiatedRateDiscount)),0)/total;
 return clamp(base-relief,.005,.18);
};
EngineClass.prototype.crisisCreditorNegotiationOptions=function(){ensure(this.g);return options(this);};
EngineClass.prototype.executeCrisisCreditorNegotiation=function(type,loanID){return execute(this,type,loanID);};
const baseNormalize=EngineClass.prototype.normalize;
EngineClass.prototype.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
const baseSave=EngineClass.prototype.save;
EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
EngineClass.prototype.__playerCrisisCreditorInstalled=true;
modules.playerCrisisCreditor=Object.freeze({NEGOTIATION_TYPES,ELIGIBLE_STATUSES,HISTORY_LIMIT,COOLDOWN_WEEKS,DEFERRAL_WEEKS,EXTENSION_WEEKS,FAILURE_CREDIT_PENALTY,ensure,activeLoans,approvalChance,options,findCandidate,hashRoll,validate,__installed:true});
})();
