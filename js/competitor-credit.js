// Phase 5B-3B extension: deterministic competitor credit, borrowing limits, and principal repayment.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-credit.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor)throw new Error('competitor.js must be loaded before competitor-credit.js.');
if(!modules.competitor.__projectsInstalled)throw new Error('competitor-projects.js must be loaded before competitor-credit.js.');
if(!modules.competitor.__entryInstalled)throw new Error('competitor-entry.js must be loaded before competitor-credit.js.');
if(modules.competitor.__creditInstalled)throw new Error('competitor credit lifecycle is already installed.');

const competitor=modules.competitor;
const MAX_CREDIT_HISTORY=104;
const CREDIT_STATUSES=Object.freeze(['prime','standard','watch','restricted']);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const roundMoney=value=>Math.max(0,Math.round(finite(value)));

function strategy(company){return competitor.STRATEGIES[company.strategyID]||competitor.STRATEGIES.balanced;}
function operatingCost(company){return Math.max(1,finite(company.weeklyFixedCost)+finite(company.weeklyMarketingCost)+finite(company.weeklyRDCost)+finite(company.weeklyInterestCost)+finite(company.weeklyCapacityCost));}
function creditStatus(score){return score>=75?'prime':score>=55?'standard':score>=35?'watch':'restricted';}
function historyRows(state,company){return (state.competitorPerformanceHistoryByID?.[company.competitorID]||[]).slice(-13);}
function trailingAverage(state,company,key,fallback){const rows=historyRows(state,company);return rows.length?rows.reduce((sum,row)=>sum+finite(row[key]),0)/rows.length:finite(fallback);}
function calculateCreditLimit(state,company){
 const s=strategy(company),score=clamp(company.creditScore,0,100),avgRevenue=Math.max(0,trailingAverage(state,company,'revenue',company.weeklyRevenue)),avgProfit=trailingAverage(state,company,'profit',company.weeklyProfit);
 const active=(company.marketPresence||[]).filter(presence=>presence.active),capacity=active.reduce((sum,presence)=>sum+finite(presence.totalCapacity),0),stores=active.reduce((sum,presence)=>sum+finite(presence.storeCount),0);
 const assetProxy=capacity*900+stores*500000+Math.max(0,finite(company.cash))*.15;
 const earningsCapacity=avgRevenue*6+Math.max(0,avgProfit)*10;
 const base=Math.max(2000000,operatingCost(company)*26+assetProxy*.35+earningsCapacity);
 const scoreFactor=.35+score/100*.9,strategyFactor=.75+s.debtTolerance*.6,distressFactor=company.status==='distressed'?.55:company.status==='turnaround'?.65:company.status==='defending'?.85:1;
 return roundMoney(Math.max(1000000,base*scoreFactor*strategyFactor*distressFactor));
}
function normalizeCreditHistory(rows){
 const byWeek=new Map();
 for(const raw of Array.isArray(rows)?rows:[]){if(!raw||!Number.isFinite(Number(raw.week)))continue;const row={week:Math.max(0,Math.floor(finite(raw.week))),creditScore:clamp(raw.creditScore,0,100),creditLimit:roundMoney(raw.creditLimit),availableCredit:roundMoney(raw.availableCredit),debt:roundMoney(raw.debt),cash:roundMoney(raw.cash),cashRunwayWeeks:Math.max(0,finite(raw.cashRunwayWeeks)),scheduledPrincipalPayment:roundMoney(raw.scheduledPrincipalPayment),missedDebtPayments:Math.max(0,Math.floor(finite(raw.missedDebtPayments))),status:CREDIT_STATUSES.includes(raw.status)?raw.status:'standard'};byWeek.set(row.week,row);}
 return [...byWeek.values()].sort((a,b)=>a.week-b.week).slice(-MAX_CREDIT_HISTORY);
}
function refreshCreditMetrics(state,company){
 company.creditScore=clamp(company.creditScore,0,100);
 company.creditLimit=calculateCreditLimit(state,company);
 company.availableCredit=roundMoney(Math.max(0,company.creditLimit-finite(company.debt)));
 company.overCreditLimit=roundMoney(Math.max(0,finite(company.debt)-company.creditLimit));
 company.cashRunwayWeeks=Math.max(0,finite(company.cash)/operatingCost(company));
 company.scheduledPrincipalPayment=roundMoney(Math.min(finite(company.debt),Math.max(finite(company.debt)>0?100000:0,finite(company.debt)*.025)));
 company.creditStatus=creditStatus(company.creditScore);
 return company;
}
function ensureCreditState(state){
 for(const company of state.competitorStates||[]){
  company.lastCreditReviewWeek=Math.max(0,Math.floor(finite(company.lastCreditReviewWeek)));
  company.lastPrincipalPaymentWeek=Math.max(0,Math.floor(finite(company.lastPrincipalPaymentWeek)));
  company.lastBorrowAttemptWeek=Math.max(0,Math.floor(finite(company.lastBorrowAttemptWeek)));
  company.missedDebtPayments=Math.max(0,Math.floor(finite(company.missedDebtPayments)));
  company.creditHistory=normalizeCreditHistory(company.creditHistory);
  company.lastCreditReason=String(company.lastCreditReason||'');
  refreshCreditMetrics(state,company);
 }
 return state;
}
function pushCreditEvent(state,company,type,text,operationID){
 if(!Array.isArray(state.competitorEvents))state.competitorEvents=[];
 if(state.competitorEvents.some(event=>event.operationID===operationID))return;
 state.competitorEvents.push({week:Math.max(0,Math.floor(finite(state.week))),competitorID:company.competitorID,type,text,operationID});
 state.competitorEvents=state.competitorEvents.slice(-160);
}
function denyBorrow(state,company,action,reason){
 action.requestedValue=roundMoney(action.requestedValue??action.newValue);
 action.approvedValue=0;action.newValue=0;action.creditDecision='denied';action.creditReason=reason;action.status='skipped';action.applied=true;action.appliedWeek=state.week;
 company.lastBorrowAttemptWeek=Math.max(0,Math.floor(finite(state.week)));company.lastCreditReason=reason;
 pushCreditEvent(state,company,'borrowDenied',`${company.name}の借入申請を否決：${reason}`,`credit-borrow-${action.actionID}`);
}
function preflightBorrowActions(state){
 ensureCreditState(state);
 for(const action of state.competitorActions||[]){
  if(action.actionType!=='borrow'||action.applied||finite(action.effectiveWeek)>finite(state.week))continue;
  const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID);if(!company)continue;
  refreshCreditMetrics(state,company);
  const requested=roundMoney(action.requestedValue??action.newValue);action.requestedValue=requested;action.creditLimitAtApproval=company.creditLimit;action.availableCreditAtApproval=company.availableCredit;
  if(!company.active||['bankrupt','inactive','withdrawing'].includes(company.status)){denyBorrow(state,company,action,'事業継続条件を満たしていません');continue;}
  if(company.creditStatus==='restricted'){denyBorrow(state,company,action,'信用区分が制限状態です');continue;}
  const approved=roundMoney(Math.min(requested,company.availableCredit));
  if(requested<=0||approved<100000){denyBorrow(state,company,action,'利用可能な与信枠が不足しています');continue;}
  action.approvedValue=approved;action.newValue=approved;action.creditDecision=approved<requested?'partial':'approved';action.creditReason=approved<requested?'与信枠内へ減額承認':'承認';company.lastBorrowAttemptWeek=Math.max(0,Math.floor(finite(state.week)));company.lastCreditReason=action.creditReason;
  pushCreditEvent(state,company,'borrowApproved',`${company.name}が${approved.toLocaleString('ja-JP')}円を借入${approved<requested?'（減額承認）':''}`,`credit-borrow-${action.actionID}`);
 }
}
function annotatePendingBorrowActions(state){
 for(const action of state.competitorActions||[]){if(action.actionType!=='borrow'||action.applied)continue;const company=(state.competitorStates||[]).find(row=>row.competitorID===action.competitorID);if(!company)continue;action.requestedValue=roundMoney(action.requestedValue??action.newValue);action.creditLimitAtDecision=company.creditLimit;action.availableCreditAtDecision=company.availableCredit;}
}
function upsertCreditHistory(state,company){
 const week=Math.max(0,Math.floor(finite(state.week))),row={week,creditScore:company.creditScore,creditLimit:company.creditLimit,availableCredit:company.availableCredit,debt:roundMoney(company.debt),cash:roundMoney(company.cash),cashRunwayWeeks:company.cashRunwayWeeks,scheduledPrincipalPayment:company.scheduledPrincipalPayment,missedDebtPayments:company.missedDebtPayments,status:company.creditStatus};
 company.creditHistory=normalizeCreditHistory((company.creditHistory||[]).filter(item=>finite(item.week,-1)!==week).concat([row]));
 const performance=(state.competitorPerformanceHistoryByID?.[company.competitorID]||[]).find(item=>finite(item.week,-1)===week);if(performance)Object.assign(performance,{cash:finite(company.cash),debt:finite(company.debt),creditScore:company.creditScore,cashRunwayWeeks:company.cashRunwayWeeks});
}
function reviewCompanyCredit(state,company){
 const week=Math.max(0,Math.floor(finite(state.week)));if(company.lastCreditReviewWeek===week){refreshCreditMetrics(state,company);return company;}
 refreshCreditMetrics(state,company);
 let repayment=0,required=0,missed=false;
 if(week>0&&week%13===0&&finite(company.debt)>0&&company.lastPrincipalPaymentWeek!==week){
  required=company.scheduledPrincipalPayment;const buffer=Math.max(300000,operatingCost(company)*strategy(company).cashBufferWeeks),excess=Math.max(0,finite(company.cash)-buffer);repayment=roundMoney(Math.min(finite(company.debt),required,excess));
  if(repayment>0){company.cash=Math.max(0,finite(company.cash)-repayment);company.debt=Math.max(0,finite(company.debt)-repayment);}
  missed=required>0&&repayment<required*.5;company.missedDebtPayments=missed?company.missedDebtPayments+1:Math.max(0,company.missedDebtPayments-(repayment>=required?1:0));company.lastPrincipalPaymentWeek=week;
  pushCreditEvent(state,company,missed?'debtPaymentMissed':'principalPayment',missed?`${company.name}が元本返済条件を未達`:`${company.name}が元本${repayment.toLocaleString('ja-JP')}円を返済`,`credit-payment-${company.competitorID}-${week}`);
 }
 refreshCreditMetrics(state,company);
 const leverage=finite(company.debt)/Math.max(1,company.creditLimit);let delta=finite(company.weeklyProfit)>=0?.2:-.3;if(leverage>.85)delta-=.4;else if(leverage<.35)delta+=.1;if(company.status==='distressed')delta-=.5;if(company.status==='turnaround')delta-=.25;if(missed)delta-=2;else if(required>0&&repayment>=required)delta+=.7;
 company.creditScore=clamp(company.creditScore+delta,10,95);company.lastCreditReason=missed?'返済条件未達':finite(company.weeklyProfit)>=0?'収益・返済実績を反映':'赤字とレバレッジを反映';company.lastCreditReviewWeek=week;
 refreshCreditMetrics(state,company);upsertCreditHistory(state,company);return company;
}
function processCreditWeek(state){ensureCreditState(state);for(const company of state.competitorStates||[])reviewCompanyCredit(state,company);annotatePendingBorrowActions(state);return state;}
function validateCredit(state){
 const errors=[];
 for(const company of state.competitorStates||[]){
  for(const key of ['creditScore','creditLimit','availableCredit','overCreditLimit','cashRunwayWeeks','scheduledPrincipalPayment','missedDebtPayments','lastCreditReviewWeek','lastPrincipalPaymentWeek','lastBorrowAttemptWeek'])if(!Number.isFinite(Number(company[key])))errors.push(`credit.${key}非有限`);
  if(company.creditScore<0||company.creditScore>100)errors.push('creditScore範囲外');if(company.creditLimit<0||company.availableCredit<0||company.overCreditLimit<0||company.cashRunwayWeeks<0||company.scheduledPrincipalPayment<0||company.missedDebtPayments<0)errors.push('credit負数');if(!CREDIT_STATUSES.includes(company.creditStatus))errors.push('creditStatus不正');if(Math.abs(company.availableCredit-Math.max(0,company.creditLimit-finite(company.debt)))>1)errors.push('availableCredit不一致');
  const history=company.creditHistory;if(!Array.isArray(history))errors.push('creditHistory配列不正');else{if(history.length>MAX_CREDIT_HISTORY)errors.push('creditHistory上限超過');const weeks=new Set();for(const row of history){if(weeks.has(row.week))errors.push('creditHistory週重複');weeks.add(row.week);for(const [key,value] of Object.entries(row))if(typeof value==='number'&&!Number.isFinite(value))errors.push(`creditHistory.${key}非有限`);}}
 }
 if(errors.length)throw new Error(errors.join(' / '));return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseValidate=competitor.validate;
competitor.ensure=function(state){baseEnsure(state);ensureCreditState(state);return state;};
competitor.processWeek=function(state){ensureCreditState(state);preflightBorrowActions(state);const result=baseProcessWeek(state);processCreditWeek(state);return result;};
competitor.validate=function(state){baseValidate(state);validateCredit(state);return true;};
Object.assign(competitor,{MAX_CREDIT_HISTORY,CREDIT_STATUSES,calculateCreditLimit,refreshCreditMetrics,ensureCreditState,preflightBorrowActions,reviewCompanyCredit,processCreditWeek,validateCredit,__creditInstalled:true});
})();
