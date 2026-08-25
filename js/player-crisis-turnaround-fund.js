// 事業再生ファンド: the heaviest of the crisis rescue levers, and the one that comes with
// strings attached.
//
// js/player-crisis-actions.js already offers three ways out of a liquidity crisis -- founder
// capital (your own money), a bridge loan (debt), and a sponsor injection (equity at a 40%
// distressed discount, no conditions). All three leave the founder in charge. A turnaround fund
// is what is left when those are not enough: it puts in more money, at a worse price, and in
// exchange it imposes its own recovery targets on the company and takes more equity if those
// targets are missed.
//
// The "conditions" are not a new subsystem -- they are the existing turnaround plan
// (js/player-turnaround-plan.js), which already models exactly this: cash and debt targets, a
// deadline, and completed/failed terminal states evaluated every week. The fund starts that plan
// mandatorily (replacing any voluntary one in flight, since the fund dictates its own terms) and
// watches for its outcome:
//   - plan completed -> the fund exits satisfied, no further dilution
//   - plan failed     -> a ratchet fires and the fund receives additional shares for free
//
// The ratchet is what makes accepting fund money a genuine decision rather than free rescue
// cash. Nothing here draws a random number: the price is a fixed discount off companyValue(),
// the targets come from the existing plan, and the ratchet is a fixed fraction.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-crisis-turnaround-fund.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.playerCrisis?.__installed)throw new Error('player-crisis.js must be loaded before player-crisis-turnaround-fund.js.');
if(!modules.playerCrisisActions?.__installed)throw new Error('player-crisis-actions.js must be loaded before player-crisis-turnaround-fund.js.');
if(!modules.playerTurnaroundPlan?.__installed)throw new Error('player-turnaround-plan.js must be loaded before player-crisis-turnaround-fund.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before player-crisis-turnaround-fund.js.');
if(modules.playerCrisisTurnaroundFund)throw new Error('player crisis turnaround fund is already registered.');

const finance=modules.finance,playerCrisis=modules.playerCrisis,turnaroundPlan=modules.playerTurnaroundPlan;
const EngineClass=modules.engine.TycoonEngine;
const STATUSES=Object.freeze(['none','active','exited','ratcheted']);
// Only the deepest crisis state. A sponsor injection (player-crisis-actions.js) covers
// distressed AND turnaround; the fund is strictly the former, so it never becomes the routine
// choice once a recovery is already under way.
const ELIGIBLE=new Set(['distressed']);
// Steeper than the sponsor's .40 -- a fund rescuing a company nobody else will fund prices that
// risk in, so the same yen buys it materially more of the company.
const FUND_VALUATION_DISCOUNT=.25;
// The fund does not do small rescues: it funds through the crisis rather than to the edge of it,
// so the target is a multiple of the reserve shortfall, floored well above the bridge loan's.
const MIN_INJECTION=5000000,TARGET_MULTIPLE=2,BASE_INJECTION=15000000;
// Missing the fund's targets hands it this much of the company again, for no new money.
const RATCHET_EQUITY=.15;
// A distressed company can be worth so little that the injection would price out at nearly 100%
// of the equity -- a founder who hits a cash crunch early would simply lose the company outright,
// which makes the fund a trap rather than a decision. Real rescue deals negotiate a cap; this one
// is fixed, applies only to the initial injection, and errs in the player's favour: the fund
// still commits the full amount, it just cannot take more than this much for it. The ratchet is
// deliberately left outside the cap, so failing the targets can still push the fund past it.
const MAX_INITIAL_EQUITY=.6;
const HISTORY_LIMIT=26;
const FUND_NAMES=Object.freeze(['再生パートナーズ','日本事業再生機構','ターンアラウンド・キャピタル','産業革新investors']);

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const integer=(v,f=0)=>Math.max(0,Math.floor(finite(v,f)));
const text=v=>String(v??'');
const plain=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));

function normalizeHistory(value){
 return (Array.isArray(value)?value:[]).filter(plain).slice(-HISTORY_LIMIT).map(row=>({
  fundID:text(row.fundID),week:integer(row.week),type:text(row.type),
  amount:Math.max(0,finite(row.amount)),shares:Math.max(0,integer(row.shares)),
  equity:Math.max(0,finite(row.equity)),detail:text(row.detail)
 }));
}
function ensure(state){
 if(!plain(state))throw new Error('player crisis turnaround fund state root must be an object.');
 const current=plain(state.playerTurnaroundFund)?state.playerTurnaroundFund:{};
 current.status=STATUSES.includes(current.status)?current.status:'none';
 current.fundID=text(current.fundID);
 current.fundName=text(current.fundName);
 current.planID=text(current.planID);
 current.investedWeek=current.investedWeek==null?null:integer(current.investedWeek);
 current.investedAmount=Math.max(0,finite(current.investedAmount));
 current.shares=Math.max(0,integer(current.shares));
 current.ratchetShares=Math.max(0,integer(current.ratchetShares));
 current.history=normalizeHistory(current.history);
 state.playerTurnaroundFund=current;
 return current;
}
function fundNameFor(state){return FUND_NAMES[integer(state.week)%FUND_NAMES.length];}
// Sized off the same reserve shortfall the rest of the crisis system uses, so a deeper hole
// genuinely costs more of the company at the fixed discount.
function injectionFor(instance){
 const state=instance.g,crisis=playerCrisis.ensure(state);
 const gap=Math.max(0,finite(crisis.reserveThreshold)-finite(state.companyCash));
 return Math.max(0,Math.round(Math.max(BASE_INJECTION,gap*TARGET_MULTIPLE)));
}
function quoteFor(instance){
 const state=instance.g,amount=injectionFor(instance);
 const preMoneyValuation=Math.max(1000000,Math.round(finite(instance.companyValue())*FUND_VALUATION_DISCOUNT));
 const sharesOut=Math.max(1,finite(state.sharesOut,1));
 const priced=amount>=MIN_INJECTION?Math.max(1,Math.round(sharesOut*amount/preMoneyValuation)):0;
 const capped=Math.max(1,Math.round(sharesOut*MAX_INITIAL_EQUITY/(1-MAX_INITIAL_EQUITY)));
 const shares=priced>0?Math.min(priced,capped):0;
 const equity=shares>0?shares/(sharesOut+shares):0;
 return Object.freeze({amount,preMoneyValuation,shares,equity,ratchetEquity:RATCHET_EQUITY,termWeeks:turnaroundPlan.TERM_WEEKS});
}
function options(instance){
 const state=instance.g,fund=ensure(state),crisis=playerCrisis.ensure(state),quote=quoteFor(instance);
 return Object.freeze({
  status:fund.status,fundName:fund.fundName||fundNameFor(state),
  // amount / equity / shares / targetCash all describe the OFFER on the table; investedAmount /
  // heldShares / ratchetShares describe the position the fund already holds.
  amount:quote.amount,equity:quote.equity,shares:quote.shares,preMoneyValuation:quote.preMoneyValuation,
  ratchetEquity:quote.ratchetEquity,termWeeks:quote.termWeeks,
  targetCash:Math.max(0,finite(playerCrisis.reserveThreshold(state))+quote.amount),
  investedAmount:fund.investedAmount,heldShares:fund.shares,ratchetShares:fund.ratchetShares,
  canAccept:!state.gameOver&&!state.isCompanySold&&!state.publicCompany
   &&fund.status!=='active'&&ELIGIBLE.has(crisis.status)&&quote.amount>=MIN_INJECTION&&quote.shares>0
 });
}
function record(state,fund,type,values){
 fund.history.push({fundID:fund.fundID,week:integer(state.week),type,
  amount:Math.max(0,finite(values.amount)),shares:Math.max(0,integer(values.shares)),
  equity:Math.max(0,finite(values.equity)),detail:text(values.detail)});
 fund.history=fund.history.slice(-HISTORY_LIMIT);
 if(Array.isArray(state.news)){state.news.unshift(`第${integer(state.week)}週：${text(values.detail)}`);state.news=state.news.slice(0,300);}
 return fund.history.at(-1);
}
function accept(instance){
 const state=instance.g,crisis=playerCrisis.ensure(state),fund=ensure(state);
 if(state.gameOver||state.isCompanySold)return instance.fail('支払不能または会社売却後は事業再生ファンドを利用できません。');
 if(state.publicCompany)return instance.fail('上場後は事業再生ファンドを利用できません。');
 if(fund.status==='active')return instance.fail('すでに事業再生ファンドの再建期間中です。');
 if(!ELIGIBLE.has(crisis.status))return instance.fail('事業再生ファンドは資金繰り危機時のみ利用できます。');
 const quote=quoteFor(instance);
 if(quote.amount<MIN_INJECTION||quote.shares<=0)return instance.fail('事業再生ファンドの出資条件を満たしていません。');
 return instance.runTransaction(()=>{
  const week=integer(state.week),fundID=`turnaround-fund-${week}`,fundName=fundNameFor(state);
  state.sharesOut=finite(state.sharesOut)+quote.shares;
  state.companyCash=finite(state.companyCash)+quote.amount;
  finance.event(state,'equityFinancing',quote.amount,{cashEffect:quote.amount,equityEffect:quote.amount,
   sourceType:'playerCrisisTurnaroundFund',sourceID:fundID,operationID:fundID,idempotencyKey:fundID,
   description:`${fundName} 事業再生ファンド出資`});
  const ledger=finance.ensureFinance(state);
  ledger.balances.capitalSurplus=finite(ledger.balances.capitalSurplus)+quote.amount;
  instance.updateOwnershipRatios();
  // The injection lifts cash, so re-run the crisis evaluation before starting the plan: the
  // plan's own targets are computed from the post-injection position.
  crisis.lastEvaluationWeek=Math.max(0,week-1);
  playerCrisis.evaluate(state);
  // The fund dictates its own terms, so any voluntary plan already in flight is replaced.
  const existing=turnaroundPlan.ensure(state);
  if(existing.status==='active')turnaroundPlan.cancel(state);
  if(!turnaroundPlan.start(state))throw new Error('turnaround fund could not start its recovery plan.');
  const plan=turnaroundPlan.ensure(state);
  // The plan's default cash target is the reserve threshold, which the fund's own injection has
  // just cleared on its own -- leaving the conditions satisfied before the company has recovered
  // anything, and the ratchet unreachable. The fund therefore raises the bar to "hold the reserve
  // WITHOUT relying on our money", i.e. earn back the injection on top of the reserve. The
  // remaining distance is exactly the liquidity gap the company was short by, so the target is
  // demanding without being arbitrary.
  plan.targetCash=Math.max(plan.targetCash,finite(plan.targetCash)+quote.amount);
  Object.assign(fund,{status:'active',fundID,fundName,planID:plan.planID,investedWeek:week,
   investedAmount:quote.amount,shares:quote.shares,ratchetShares:0});
  record(state,fund,'accepted',{amount:quote.amount,shares:quote.shares,equity:quote.equity,
   detail:`${fundName}から${Math.round(quote.amount).toLocaleString('ja-JP')}円の出資を受け入れ、再建目標（${quote.termWeeks}週）を受諾しました。`});
  instance.notify(`${fundName}の出資を受け入れました。${quote.termWeeks}週以内に再建目標を達成できないと、追加で持分${(RATCHET_EQUITY*100).toFixed(0)}%を譲渡します。`,'warning');
  validate(state);
  return true;
 });
}
// Free shares to the fund, sized so it ends up holding RATCHET_EQUITY of the enlarged company on
// top of what it already owns. No cash moves, so this never touches the finance ledger -- the
// balance sheet is built from live state and carries no share-count line.
function ratchetSharesFor(state){
 const sharesOut=Math.max(1,finite(state.sharesOut,1));
 return Math.max(1,Math.round(sharesOut*RATCHET_EQUITY/(1-RATCHET_EQUITY)));
}
function settle(instance){
 const state=instance.g,fund=ensure(state);
 if(fund.status!=='active')return null;
 const plan=turnaroundPlan.ensure(state);
 if(plan.planID!==fund.planID||plan.status==='active')return null;
 if(plan.status==='completed'){
  fund.status='exited';
  record(state,fund,'exited',{amount:0,shares:0,equity:0,
   detail:`${fund.fundName}の再建目標を達成し、追加の持分譲渡を回避しました。`});
  instance.notify?.(`${fund.fundName}の再建目標を達成しました。追加の持分譲渡はありません。`,'success');
  return fund;
 }
 const shares=ratchetSharesFor(state);
 state.sharesOut=finite(state.sharesOut)+shares;
 fund.ratchetShares=integer(fund.ratchetShares)+shares;
 fund.shares=integer(fund.shares)+shares;
 fund.status='ratcheted';
 instance.updateOwnershipRatios();
 record(state,fund,'ratcheted',{amount:0,shares,equity:RATCHET_EQUITY,
  detail:`${fund.fundName}の再建目標を達成できず、追加で${shares.toLocaleString('ja-JP')}株（持分${(RATCHET_EQUITY*100).toFixed(0)}%）を譲渡しました。`});
 instance.notify?.(`${fund.fundName}の再建目標未達により、追加の持分${(RATCHET_EQUITY*100).toFixed(0)}%を譲渡しました。`,'error');
 return fund;
}
function snapshot(state){
 const fund=ensure(state);
 return Object.freeze({status:fund.status,fundName:fund.fundName,planID:fund.planID,
  investedWeek:fund.investedWeek,investedAmount:fund.investedAmount,
  shares:fund.shares,ratchetShares:fund.ratchetShares});
}
function validate(state){
 const fund=state?.playerTurnaroundFund,errors=[];
 if(!plain(fund))errors.push('playerTurnaroundFundがオブジェクトではありません。');
 else{
  if(!STATUSES.includes(fund.status))errors.push('playerTurnaroundFund.statusが不正です。');
  for(const key of ['investedAmount','shares','ratchetShares'])if(!Number.isFinite(Number(fund[key])))errors.push(`playerTurnaroundFund.${key}が有限数ではありません。`);
  if(fund.investedWeek!=null&&!Number.isFinite(Number(fund.investedWeek)))errors.push('playerTurnaroundFund.investedWeekが有限数ではありません。');
  if(!Array.isArray(fund.history))errors.push('playerTurnaroundFund.historyが配列ではありません。');
  else if(fund.history.length>HISTORY_LIMIT)errors.push('playerTurnaroundFund.historyが上限を超えています。');
  if(fund.status==='active'&&!fund.planID)errors.push('再建期間中はplanIDが必要です。');
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

EngineClass.prototype.turnaroundFundOptions=function(){return options(this);};
EngineClass.prototype.turnaroundFundSnapshot=function(){return snapshot(this.g);};
EngineClass.prototype.acceptTurnaroundFund=function(){return accept(this);};
const baseNormalize=EngineClass.prototype.normalize;EngineClass.prototype.normalize=function(){const r=baseNormalize.call(this);ensure(this.g);return r;};
const baseSave=EngineClass.prototype.save;EngineClass.prototype.save=function(slot=null){ensure(this.g);return baseSave.call(this,slot);};
// Runs after the base chain, which includes player-turnaround-plan.js's own advanceWeek wrapper,
// so the plan has already reached its terminal state for this week by the time we settle.
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
EngineClass.prototype.advanceWeek=function(showSummary=true){const result=baseAdvanceWeek.call(this,showSummary);if(result!==false)settle(this);return result;};
EngineClass.prototype.__playerCrisisTurnaroundFundInstalled=true;

modules.playerCrisisTurnaroundFund=Object.freeze({STATUSES,ELIGIBLE_STATUSES:Object.freeze([...ELIGIBLE]),
 FUND_VALUATION_DISCOUNT,MIN_INJECTION,TARGET_MULTIPLE,BASE_INJECTION,RATCHET_EQUITY,MAX_INITIAL_EQUITY,HISTORY_LIMIT,FUND_NAMES,
 ensure,options,quoteFor,injectionFor,accept,settle,snapshot,validate,ratchetSharesFor,__installed:true});
})();
