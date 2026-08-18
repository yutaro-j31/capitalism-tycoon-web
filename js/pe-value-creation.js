// Value creation for PE deals: give an acquired company a concrete problem to fix and
// several initiatives to fix it with, so improving a holding becomes a decision instead
// of pressing one button repeatedly.
//
// The problem is derived from fields the deal already has, using the same FNV-1a hash
// style the rest of the codebase uses for deterministic derivation. Nothing is stored
// on the deal and no random numbers are drawn, so existing saves resolve to the same
// problem they would have had and the deterministic fingerprint is untouched.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before pe-value-creation.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before pe-value-creation.js.');
if(modules.peValueCreation)throw new Error('PE value creation is already registered.');
const EngineClass=modules.engine.TycoonEngine;

const MAX_SCORE=100;
const STAGE_SIZE=34;          // 0-33 / 34-67 / 68-100 の3段階で課題が移る
const MATCHED_SCORE_GAIN=10;
const MISMATCHED_SCORE_GAIN=3;
const MATCHED_VALUATION_GAIN=.09;
const MISMATCHED_VALUATION_GAIN=.03;
const MIN_INITIATIVE_COST=500000;
const INITIATIVE_COST_RATE=.02;
// createPEDeal starts every holding at improvementScore 20, so that is the point where
// the exit premium is zero. Anything below it never discounts the exit; only progress
// beyond the starting condition pays out. This keeps untouched deals worth exactly what
// they were worth before this premium existed.
const EXIT_BASELINE_SCORE=20;
const EXIT_PREMIUM_AT_FULL=.5;

// R2 remaining item "再建中の企業の週次業績を改善度と連動させる": before this, a peDeal
// carried no weekly P&L at all -- only currentValuation drifted (mostly noise, with a
// token improvementScore/50000 nudge). Turning a company around never showed up as an
// actual cash consequence. Revenue is fixed at acquisition (a share of investedAmount, so
// it doesn't drift with market noise) and margin is derived from improvementScore around
// the same EXIT_BASELINE_SCORE=20 baseline the exit premium already uses: an untouched
// deal loses money every week (a real distressed business), and only sustained progress
// past the acquisition condition turns it into a cash generator.
const WEEKLY_REVENUE_RATE=.03;      // weekly revenue as a fraction of investedAmount
const BASELINE_MARGIN=-.03;         // margin at improvementScore===EXIT_BASELINE_SCORE
const MARGIN_SWING=.15;             // margin gained moving from baseline to MAX_SCORE
const MARGIN_FLOOR=-.10;
const MARGIN_CEILING=.15;

// R2 remaining items "施策の効果が数週かけて現れる遅延" and "複数案件を同時に抱えたとき
// の経営資源の取り合い": before this, applyInitiative was instant (pay -> know the result
// -> score/valuation already moved, all in the same call) and every deal was fully
// independent of every other deal the player held. Both gaps share one piece of state: a
// deal can now have at most one initiative "in flight" (pendingInitiative), and only a
// limited number of deals *of the same owner account* may have one in flight at the same
// time -- modeling limited management attention as a real, shared, contested resource
// instead of an unlimited one. The pay/succeed/match decision is still made (and locked
// in) the moment the initiative is committed, using the exact same deterministic
// outcomeRoll as before; only the reveal and the score/valuation effect are delayed, so
// save/reload still cannot re-roll a result once it has been committed to.
const INITIATIVE_DELAY_WEEKS=2;
const MAX_CONCURRENT_INITIATIVES=Object.freeze({company:2,personal:1});

const ISSUES=Object.freeze([
  Object.freeze({id:'cost',name:'高コスト体質',detail:'固定費が重く、利益が出にくい状態です。',initiativeID:'cost-cut'}),
  Object.freeze({id:'talent',name:'人材流出',detail:'中核人材が抜け、現場が回らなくなっています。',initiativeID:'talent'}),
  Object.freeze({id:'facility',name:'設備老朽',detail:'設備が古く、生産性と品質が落ちています。',initiativeID:'capex'}),
  Object.freeze({id:'sales',name:'販路縮小',detail:'取引先が減り、売上の土台が細っています。',initiativeID:'sales'})
]);

// Every initiative can fail, and each one fails in its own way: the ones that hurt most
// when they go wrong are not the ones that go wrong most often, so picking an initiative
// is a trade between how likely it is to land and how much a miss costs.
const INITIATIVES=Object.freeze([
  Object.freeze({id:'cost-cut',name:'コスト削減',detail:'固定費を見直して損益分岐点を下げます。',
    failureRate:.3,setbackScore:6,setbackValuation:.05,
    risk:'削りすぎると現場が荒れ、改善度と企業価値が大きく後退します。'}),
  Object.freeze({id:'talent',name:'人材強化',detail:'中核人材を採用・引き留めします。',
    failureRate:.2,setbackScore:4,setbackValuation:.03,
    risk:'採用が空振りに終わると、費用だけがかさみます。'}),
  Object.freeze({id:'capex',name:'設備投資',detail:'老朽設備を入れ替えて生産性を上げます。',
    failureRate:.25,setbackScore:5,setbackValuation:.06,
    risk:'入れ替えに失敗すると稼働が止まり、企業価値が最も傷みます。'}),
  Object.freeze({id:'sales',name:'販路拡大',detail:'新規取引先を開拓して売上の土台を広げます。',
    failureRate:.35,setbackScore:3,setbackValuation:.02,
    risk:'空振りは最も多い一方、傷は浅く済みます。'})
]);

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const yen=value=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`;

// Same FNV-1a derivation used elsewhere in the codebase for save-stable pseudo-values.
function deterministicUnit(...parts){
  let hash=2166136261;
  const text=parts.map(value=>String(value??'')).join('|');
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return ((hash>>>0)%10000)/10000;
}

function scoreOf(deal){return clamp(finite(deal?.improvementScore,0),0,MAX_SCORE);}
function stageOf(deal){return Math.min(2,Math.floor(scoreOf(deal)/STAGE_SIZE));}
function isResolved(deal){return scoreOf(deal)>=MAX_SCORE;}

// Derived, never stored: the same deal always yields the same problem for a given stage.
function issueOf(deal){
  if(!deal)return null;
  if(isResolved(deal))return null;
  const key=deterministicUnit(deal.id,deal.industry,deal.acquiredWeek,stageOf(deal));
  return ISSUES[Math.min(ISSUES.length-1,Math.floor(key*ISSUES.length))];
}

function initiativeCost(deal){
  return Math.round(Math.max(MIN_INITIATIVE_COST,finite(deal?.investedAmount)*INITIATIVE_COST_RATE));
}

// Fixed once at acquisition so the weekly headline number moves only because of
// improvementScore, not because of unrelated valuation noise.
function weeklyRevenueFor(deal){
  return Math.round(Math.max(0,finite(deal?.investedAmount))*WEEKLY_REVENUE_RATE);
}

function marginFor(deal){
  const progress=(scoreOf(deal)-EXIT_BASELINE_SCORE)/(MAX_SCORE-EXIT_BASELINE_SCORE);
  return clamp(BASELINE_MARGIN+progress*MARGIN_SWING,MARGIN_FLOOR,MARGIN_CEILING);
}

// Old saves and freshly-migrated deals may not have weeklyRevenue stored yet; derive it
// from investedAmount in that case rather than treating the deal as revenue-less.
function weeklyProfitFor(deal){
  const revenue=finite(deal?.weeklyRevenue)>0?finite(deal.weeklyRevenue):weeklyRevenueFor(deal);
  return Math.round(revenue*marginFor(deal));
}

function matches(deal,initiativeID){
  const issue=issueOf(deal);
  return Boolean(issue&&issue.initiativeID===initiativeID);
}

function initiativeOf(initiativeID){return INITIATIVES.find(row=>row.id===initiativeID)||null;}

// Whether an initiative lands is decided by the same hash style as the problem itself, so
// no random number is drawn and saving and reloading cannot re-roll the outcome. The key
// holds both the improvement score and the week: any attempt that moves the score is
// judged afresh, and when the score is pinned at 0 or 100 letting a week pass is what
// gives a new attempt.
function outcomeRoll(state,deal,initiativeID){
  return deterministicUnit('pe-initiative',deal?.id,initiativeID,scoreOf(deal),finite(state?.week));
}

function succeeds(state,deal,initiativeID){
  const initiative=initiativeOf(initiativeID);
  if(!initiative)return false;
  return outcomeRoll(state,deal,initiativeID)>=initiative.failureRate;
}

function findDeal(state,dealID){
  return (state?.peDeals||[]).find(row=>String(row.id)===String(dealID)&&row.status==='active')||null;
}

// How much the turnaround itself is worth at exit, on top of the valuation the deal
// already carries. Never below 1: a neglected holding sells for what it always did.
function exitMultiplier(deal){
  const progress=clamp((scoreOf(deal)-EXIT_BASELINE_SCORE)/(MAX_SCORE-EXIT_BASELINE_SCORE),0,1);
  return 1+progress*EXIT_PREMIUM_AT_FULL;
}

function exitValue(deal){
  return Math.round(finite(deal?.currentValuation)*exitMultiplier(deal));
}

// How many OTHER active deals of the same owner account currently have an initiative in
// flight. Company and personal bandwidth are tracked separately, matching this codebase's
// unconditional company/personal asset (and now attention) separation.
function activeInitiativeCount(state,ownerAccount,excludeDealID){
  return (state?.peDeals||[]).filter(row=>row.status==='active'&&(row.ownerAccount==='company'?'company':'personal')===ownerAccount&&row.pendingInitiative&&String(row.id)!==String(excludeDealID)).length;
}
function concurrencyCapFor(ownerAccount){
  return MAX_CONCURRENT_INITIATIVES[ownerAccount]||MAX_CONCURRENT_INITIATIVES.personal;
}

function applicable(state,deal){
  if(!deal)return {ok:false,reason:'対象のPE案件が見つかりません。'};
  if(isResolved(deal))return {ok:false,reason:'この案件の再建は完了しています。'};
  if(deal.pendingInitiative)return {ok:false,reason:'既に施策が進行中です。結果判明までお待ちください。'};
  const ownerAccount=deal.ownerAccount==='company'?'company':'personal';
  const used=activeInitiativeCount(state,ownerAccount,deal.id),cap=concurrencyCapFor(ownerAccount);
  if(used>=cap)return {ok:false,reason:`経営資源が他の案件に割かれています（同時進行 ${used}/${cap}）。他の施策の結果が判明するまでお待ちください。`};
  return {ok:true,reason:''};
}

function plan(state,deal){
  const gate=applicable(state,deal);
  const issue=issueOf(deal);
  const cost=initiativeCost(deal);
  const ownerAccount=deal?.ownerAccount==='company'?'company':'personal';
  return Object.freeze({
    dealID:deal?String(deal.id):'',
    score:scoreOf(deal),
    maxScore:MAX_SCORE,
    stage:stageOf(deal),
    resolved:isResolved(deal),
    issue,
    cost,
    exitValue:exitValue(deal),
    exitPremium:exitValue(deal)-Math.round(finite(deal?.currentValuation)),
    exitMultiplier:exitMultiplier(deal),
    affordable:gate.ok&&finite(state?.[ownerAccount==='company'?'companyCash':'personalCash'])>=cost,
    blockedReason:gate.ok?'':gate.reason,
    pending:deal?.pendingInitiative?Object.freeze({
      initiativeID:deal.pendingInitiative.initiativeID,
      initiativeName:initiativeOf(deal.pendingInitiative.initiativeID)?.name||'',
      resolveWeek:deal.pendingInitiative.resolveWeek,
      weeksRemaining:Math.max(0,deal.pendingInitiative.resolveWeek-finite(state?.week))
    }):null,
    concurrencyUsed:activeInitiativeCount(state,ownerAccount,deal?.id)+(deal?.pendingInitiative?1:0),
    concurrencyCap:concurrencyCapFor(ownerAccount),
    initiatives:Object.freeze(INITIATIVES.map(row=>Object.freeze({
      ...row,
      recommended:Boolean(issue&&issue.initiativeID===row.id),
      scoreGain:issue&&issue.initiativeID===row.id?MATCHED_SCORE_GAIN:MISMATCHED_SCORE_GAIN,
      valuationGain:issue&&issue.initiativeID===row.id?MATCHED_VALUATION_GAIN:MISMATCHED_VALUATION_GAIN,
      // The odds are shown, never the outcome: telling the player which attempt is already
      // decided to fail would remove the decision this whole feature exists to create.
      successRate:1-row.failureRate
    })))
  });
}

// Charge the current owner account and lock in the outcome immediately (same deterministic
// outcomeRoll as before, keyed on the committing week and the score at commit time -- once
// committed, save/reload cannot re-roll it). The score/valuation effect itself, and telling
// the player which way it went, are deferred to resolvePendingInitiatives(). Company-owned
// holdings record the expense in company finance immediately; personal holdings remain
// entirely outside the company ledger, exactly as before.
function applyInitiative(engine,dealID,initiativeID){
  const state=engine.g;
  const deal=findDeal(state,dealID);
  const gate=applicable(state,deal);
  if(!gate.ok)return engine.fail(gate.reason);
  const initiative=initiativeOf(initiativeID);
  if(!initiative)return engine.fail('その施策は選べません。');
  const cost=initiativeCost(deal);
  const owner=deal.ownerAccount==='company'?'company':'personal';
  const cashKey=owner==='company'?'companyCash':'personalCash';
  if(finite(state[cashKey])<cost)return engine.fail(`施策の実行には${yen(cost)}が必要です。`);

  // The fee is paid either way — the work was commissioned regardless of how it turns out.
  const succeeded=succeeds(state,deal,initiativeID);
  const matched=matches(deal,initiativeID);
  state[cashKey]-=cost;
  if(owner==='company')modules.finance?.event?.(state,'otherOperating',cost,{cashEffect:-cost,profitEffect:-cost,assetEffect:0,sourceType:'peInitiative',sourceID:deal.id,description:`${deal.targetName} ${initiative.name}`});

  const resolveWeek=finite(state.week)+INITIATIVE_DELAY_WEEKS;
  deal.pendingInitiative={
    initiativeID,matched,succeeded,
    scoreDelta:succeeded?(matched?MATCHED_SCORE_GAIN:MISMATCHED_SCORE_GAIN):-initiative.setbackScore,
    valuationDelta:succeeded?(matched?MATCHED_VALUATION_GAIN:MISMATCHED_VALUATION_GAIN):-initiative.setbackValuation,
    committedWeek:finite(state.week),resolveWeek
  };

  engine.notify(`${deal.targetName}で「${initiative.name}」に着手しました。結果は第${resolveWeek}週に判明します。`,'info');
  engine.save();
  engine.emit('change');
  return true;
}

// Called once per week (js/expansion.js's updatePersonalExpandedWeekly). Applies the
// score/valuation effect and reveals the outcome for every pending initiative whose
// resolveWeek has arrived, then clears the pending slot so the deal (and its owner
// account's concurrency budget) is free again.
function resolvePendingInitiatives(engine){
  const state=engine.g;
  let resolvedAny=false;
  for(const deal of (state?.peDeals||[]).filter(row=>row.status==='active'&&row.pendingInitiative)){
    const pending=deal.pendingInitiative;
    if(finite(state.week)<finite(pending.resolveWeek))continue;
    const initiative=initiativeOf(pending.initiativeID);
    deal.improvementScore=clamp(scoreOf(deal)+finite(pending.scoreDelta),0,MAX_SCORE);
    deal.currentValuation=finite(deal.currentValuation)*(1+finite(pending.valuationDelta));
    deal.pendingInitiative=null;
    engine.syncPESubsidiary?.(deal);
    engine.notify(
      !pending.succeeded
        ?`${deal.targetName}の「${initiative?.name||''}」は失敗に終わり、費用だけがかさんで再建が後退しました。`
        :pending.matched
          ?`${deal.targetName}で「${initiative?.name||''}」が課題に的中し、企業価値が大きく伸びました。`
          :`${deal.targetName}で「${initiative?.name||''}」を実行しましたが、いまの課題には噛み合いませんでした。`,
      !pending.succeeded?'error':pending.matched?'success':'warning'
    );
    resolvedAny=true;
  }
  return resolvedAny;
}

function installExitWrapper(){
  const proto=EngineClass.prototype;
  if(proto.__peExitPremiumInstalled)return true;
  const baseExit=proto.exitPEDeal;
  if(typeof baseExit!=='function')return false;
  proto.exitPEDeal=function(dealID){
    const deal=findDeal(this.g,dealID);
    if(!deal)return baseExit.call(this,dealID);
    // Compare the multiplier rather than rounded amounts: at exactly the baseline the
    // valuation must pass through untouched, and rounding it would shift the payout.
    if(exitMultiplier(deal)<=1)return baseExit.call(this,dealID);
    const original=finite(deal.currentValuation);
    deal.currentValuation=exitValue(deal);
    const result=baseExit.call(this,dealID);
    if(result===false)deal.currentValuation=original;
    return result;
  };
  Object.defineProperty(proto,'__peExitPremiumInstalled',{value:true});
  return true;
}

function install(){
  const proto=EngineClass.prototype;
  if(!proto.__peValueCreationInstalled){
    proto.peValueCreationPlan=function(dealID){
      const deal=findDeal(this.g,dealID);
      return deal?plan(this.g,deal):null;
    };
    proto.applyPEInitiative=function(dealID,initiativeID){return applyInitiative(this,dealID,initiativeID);};
    Object.defineProperty(proto,'__peValueCreationInstalled',{value:true});
  }
  installExitWrapper();
  return true;
}

install();
// expansion.js only defines installExpansion; app.js applies it later. Keep the canonical
// script order and attach the EXIT wrapper once parser startup has installed expansion.
if(!EngineClass.prototype.__peExitPremiumInstalled&&typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  document.addEventListener('DOMContentLoaded',installExitWrapper,{once:true});
}
modules.peValueCreation=Object.freeze({
  MAX_SCORE,STAGE_SIZE,MATCHED_SCORE_GAIN,MISMATCHED_SCORE_GAIN,
  MATCHED_VALUATION_GAIN,MISMATCHED_VALUATION_GAIN,
  MIN_INITIATIVE_COST,INITIATIVE_COST_RATE,ISSUES,INITIATIVES,
  EXIT_BASELINE_SCORE,EXIT_PREMIUM_AT_FULL,exitMultiplier,exitValue,
  WEEKLY_REVENUE_RATE,BASELINE_MARGIN,MARGIN_SWING,MARGIN_FLOOR,MARGIN_CEILING,
  weeklyRevenueFor,marginFor,weeklyProfitFor,
  INITIATIVE_DELAY_WEEKS,MAX_CONCURRENT_INITIATIVES,activeInitiativeCount,concurrencyCapFor,
  resolvePendingInitiatives,
  scoreOf,stageOf,isResolved,issueOf,initiativeCost,initiativeOf,matches,
  outcomeRoll,succeeds,applicable,plan,applyInitiative,installExitWrapper,install,
  __installed:true
});
})();
