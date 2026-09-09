// Script boundary: js/pe-rivals.js (classic JavaScript)
//
// PE mode T1 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §5): a fixed roster of five
// competing PE firms, plus a deterministic function that decides which of them show
// interest in a given acquisitionTarget for a given week. This module intentionally does
// not touch js/ma-deal-room.js's existing single-competitor bidding flow (deal.competingBid)
// -- it only exposes the roster and the participation judgement so a later task can wire
// them into deal.competingBids.
//
// Determinism: uses the same FNV-1a hash()/unit()/between() style as js/ma-deal-room.js
// (state.week and target attributes go in, a stable pseudo-random unit interval comes
// out) instead of drawing from the engine's shared RNG, so re-evaluating the same target
// + week always returns the same participants, including across save/reload.
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine module must load before pe-rivals.js.');
if(modules.peRivals)throw new Error('Capitalism Tycoon peRivals module is already registered.');
const EngineClass=modules.engine.TycoonEngine;

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
function hash(parts){let h=2166136261;String(parts.join('|')).split('').forEach(c=>{h^=c.charCodeAt(0);h=Math.imul(h,16777619);});return h>>>0;}
function unit(...p){return hash(p)/4294967295;}

// js/engine.js generateMATargets() draws valuation from 40,000,000-1,800,000,000. There is
// no region field on acquisitionTarget yet, so "大型案件" / "地元案件" are read off that
// existing size scale rather than an attribute the target does not carry.
const LARGE_DEAL_VALUATION=700_000_000;
const LOCAL_DEAL_VALUATION=300_000_000;
const DAMAGED_RISK=.25;
const SYNERGY_THRESHOLD=.12;
const EARLY_GAME_WEEK_LIMIT=260; // ~5 years; 新興ファンドは序盤のみ出現する
const APPEARANCE_CHANCE=.7;

function isLargeDeal(t){return finite(t?.valuation)>=LARGE_DEAL_VALUATION;}
function isLocalDeal(t){const v=finite(t?.valuation);return v>0&&v<=LOCAL_DEAL_VALUATION;}
function isDamagedCompany(t){return finite(t?.operatingProfit)<=0||finite(t?.risk)>=DAMAGED_RISK;}
function hasSynergy(t){return finite(t?.synergy)>=SYNERGY_THRESHOLD;}
function isEarlyGame(week){return finite(week,0)<=EARLY_GAME_WEEK_LIMIT;}

// 設計書 §5「競合PEの性格」。5社は固定なので aggressiveness まで含めて state.peRivals に
// 保存し、あとの入札強度計算(T2以降)がそこから直接読めるようにする。判定ロジック自体は
// このモジュールだけが持つ。
const ROSTER=Object.freeze([
  Object.freeze({id:'foreign-major',name:'外資系大手',conditionID:'largeDealOnly',conditionLabel:'大型案件のみ',aggressiveness:1.06}),
  Object.freeze({id:'local-firm',name:'地場系',conditionID:'localDealOnly',conditionLabel:'地元案件',aggressiveness:1.02}),
  Object.freeze({id:'turnaround-specialist',name:'再生特化',conditionID:'damagedCompanyOnly',conditionLabel:'傷んだ会社',aggressiveness:.95}),
  Object.freeze({id:'strategic-buyer',name:'事業会社',conditionID:'synergyOnly',conditionLabel:'シナジーあり',aggressiveness:1.12}),
  Object.freeze({id:'emerging-fund',name:'新興ファンド',conditionID:'earlyGameOnly',conditionLabel:'序盤のみ',aggressiveness:1.04})
]);

const CONDITIONS=Object.freeze({
  largeDealOnly:(t)=>isLargeDeal(t),
  localDealOnly:(t)=>isLocalDeal(t),
  damagedCompanyOnly:(t)=>isDamagedCompany(t),
  synergyOnly:(t)=>hasSynergy(t),
  earlyGameOnly:(t,week)=>isEarlyGame(week)
});

function rosterMatchesState(list){return Array.isArray(list)&&list.length===ROSTER.length&&ROSTER.every((firm,i)=>list[i]&&list[i].id===firm.id);}

// 旧セーブは peRivals を持たないため mergeDefaults 経由で [] になる (js/engine.js
// createInitialState)。ここではその空配列、あるいは形が壊れた値を、常に同じ5社の
// ロースターへ正規化する。呼び出すたびに同じ結果になるので何度呼んでも安全。
function ensure(state){
  if(!state)return state;
  if(!rosterMatchesState(state.peRivals))state.peRivals=ROSTER.map(firm=>({...firm}));
  return state;
}

function isEligible(firm,target,week){
  const condition=firm&&CONDITIONS[firm.conditionID];
  return typeof condition==='function'?Boolean(condition(target,week)):false;
}

function targetKey(target){return (target&&(target.maStableKey||target.id||target.name))||'unknown-target';}

// 出現条件を満たしていても毎回必ず現れるわけではない。ハッシュ判定なので同じ対象・同じ
// 週なら常に同じ結果になる (乱数エンジンは呼ばない)。
function willParticipate(firm,target,week){
  if(!isEligible(firm,target,week))return false;
  return unit('pe-rival-participation',targetKey(target),Math.floor(finite(week,0)),firm.id)<APPEARANCE_CHANCE;
}

function participatingRivals(state,target,week){
  ensure(state);
  if(!target)return [];
  const w=Math.floor(finite(week,finite(state?.week,1)));
  return state.peRivals.filter(firm=>willParticipate(firm,target,w));
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__peRivalsInstalled)return true;
  const baseNormalize=proto.normalize;
  proto.normalize=function(){const result=baseNormalize.call(this);ensure(this.g);return result;};
  Object.defineProperty(proto,'__peRivalsInstalled',{value:true});
  return true;
}
install();

modules.peRivals=Object.freeze({
  ROSTER,LARGE_DEAL_VALUATION,LOCAL_DEAL_VALUATION,DAMAGED_RISK,SYNERGY_THRESHOLD,EARLY_GAME_WEEK_LIMIT,APPEARANCE_CHANCE,
  ensure,isEligible,participatingRivals,install,
  __installed:true
});
})();
