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

const ISSUES=Object.freeze([
  Object.freeze({id:'cost',name:'高コスト体質',detail:'固定費が重く、利益が出にくい状態です。',initiativeID:'cost-cut'}),
  Object.freeze({id:'talent',name:'人材流出',detail:'中核人材が抜け、現場が回らなくなっています。',initiativeID:'talent'}),
  Object.freeze({id:'facility',name:'設備老朽',detail:'設備が古く、生産性と品質が落ちています。',initiativeID:'capex'}),
  Object.freeze({id:'sales',name:'販路縮小',detail:'取引先が減り、売上の土台が細っています。',initiativeID:'sales'})
]);

const INITIATIVES=Object.freeze([
  Object.freeze({id:'cost-cut',name:'コスト削減',detail:'固定費を見直して損益分岐点を下げます。'}),
  Object.freeze({id:'talent',name:'人材強化',detail:'中核人材を採用・引き留めします。'}),
  Object.freeze({id:'capex',name:'設備投資',detail:'老朽設備を入れ替えて生産性を上げます。'}),
  Object.freeze({id:'sales',name:'販路拡大',detail:'新規取引先を開拓して売上の土台を広げます。'})
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

function matches(deal,initiativeID){
  const issue=issueOf(deal);
  return Boolean(issue&&issue.initiativeID===initiativeID);
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

function applicable(state,deal){
  if(!deal)return {ok:false,reason:'対象のPE案件が見つかりません。'};
  if(isResolved(deal))return {ok:false,reason:'この案件の再建は完了しています。'};
  return {ok:true,reason:''};
}

function plan(state,deal){
  const gate=applicable(state,deal);
  const issue=issueOf(deal);
  const cost=initiativeCost(deal);
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
    affordable:gate.ok&&finite(state?.personalCash)>=cost,
    blockedReason:gate.ok?'':gate.reason,
    initiatives:Object.freeze(INITIATIVES.map(row=>Object.freeze({
      ...row,
      recommended:Boolean(issue&&issue.initiativeID===row.id),
      scoreGain:issue&&issue.initiativeID===row.id?MATCHED_SCORE_GAIN:MISMATCHED_SCORE_GAIN,
      valuationGain:issue&&issue.initiativeID===row.id?MATCHED_VALUATION_GAIN:MISMATCHED_VALUATION_GAIN
    })))
  });
}

// Personal money only: PE holdings sit on the personal side of the ledger, so this never
// touches company cash or the company's financial statements.
function applyInitiative(engine,dealID,initiativeID){
  const state=engine.g;
  const deal=findDeal(state,dealID);
  const gate=applicable(state,deal);
  if(!gate.ok)return engine.fail(gate.reason);
  const initiative=INITIATIVES.find(row=>row.id===initiativeID);
  if(!initiative)return engine.fail('その施策は選べません。');
  const cost=initiativeCost(deal);
  if(finite(state.personalCash)<cost)return engine.fail(`施策の実行には${yen(cost)}が必要です。`);

  const matched=matches(deal,initiativeID);
  state.personalCash-=cost;
  deal.improvementScore=clamp(scoreOf(deal)+(matched?MATCHED_SCORE_GAIN:MISMATCHED_SCORE_GAIN),0,MAX_SCORE);
  deal.currentValuation=finite(deal.currentValuation)*(1+(matched?MATCHED_VALUATION_GAIN:MISMATCHED_VALUATION_GAIN));

  engine.notify(
    matched
      ?`${deal.targetName}で「${initiative.name}」が課題に的中し、企業価値が大きく伸びました。`
      :`${deal.targetName}で「${initiative.name}」を実行しましたが、いまの課題には噛み合いませんでした。`,
    matched?'success':'warning'
  );
  engine.save();
  engine.emit('change');
  return true;
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__peValueCreationInstalled)return true;
  proto.peValueCreationPlan=function(dealID){
    const deal=findDeal(this.g,dealID);
    return deal?plan(this.g,deal):null;
  };
  proto.applyPEInitiative=function(dealID,initiativeID){return applyInitiative(this,dealID,initiativeID);};

  // Wrap the existing exit so the turnaround premium is paid without duplicating the
  // cash, realised P&L, status and notification handling that already lives there.
  const baseExit=proto.exitPEDeal;
  if(typeof baseExit==='function'){
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
  }

  Object.defineProperty(proto,'__peValueCreationInstalled',{value:true});
  return true;
}

install();
modules.peValueCreation=Object.freeze({
  MAX_SCORE,STAGE_SIZE,MATCHED_SCORE_GAIN,MISMATCHED_SCORE_GAIN,
  MATCHED_VALUATION_GAIN,MISMATCHED_VALUATION_GAIN,
  MIN_INITIATIVE_COST,INITIATIVE_COST_RATE,ISSUES,INITIATIVES,
  EXIT_BASELINE_SCORE,EXIT_PREMIUM_AT_FULL,exitMultiplier,exitValue,
  scoreOf,stageOf,isResolved,issueOf,initiativeCost,matches,applicable,plan,applyInitiative,install,
  __installed:true
});
})();
