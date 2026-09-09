// Script boundary: js/pe-network.js (classic JavaScript)
//
// PE mode T13 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §6, §6.5): the 4-path
// sourcing network. state.peNetwork is a new top-level field (old saves get it backfilled by
// ensure(), unlocked-or-not is irrelevant here -- an empty network is simply inert).
// Connecting node CREATION to the 5-pillar business flows (仕入先/テナント/銀行/CXO/Exit先/
// 証券会社, per 設計書§6の表) is deferred to whichever later task actually calls addNode() from
// those real actions; this file provides the node/trust/decay/monopoly-sourcing machinery only,
// exactly like js/pe-fund.js's T9/T10 additions and js/pe-industry-tiers.js's T11 did before any
// real integration existed.
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine module must load before pe-network.js.');
if(modules.peNetwork)throw new Error('Capitalism Tycoon peNetwork module is already registered.');
const EngineClass=modules.engine.TycoonEngine;

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,finite(v,min)));
const arr=v=>Array.isArray(v)?v:[];

const MAX_NODES=100;
const WEEKLY_ACTIONS=2;
// 減衰（設計書§6.5末尾）: 接触しないと週0.15低下（放置1年で約8ポイント）。紹介者経路は
// それに加えて年5ポイントの追加減衰を持つ（無いと最も安直な経路が44〜57%を占めてしまう、
// と検証済み）。
const GENERIC_DECAY_PER_WEEK=.15;
const REFERRER_EXTRA_DECAY_PER_WEEK=5/52;
const CONTACT_TRUST_GAIN=4;
// 独占案件の持ち込み（設計書§6）: trust60以上で使え、使うと大きく下がる（60→35の例）。
const MONOPOLY_TRUST_THRESHOLD=60;
const MONOPOLY_TRUST_COST=25;
// 独占比率の上限（設計書§6.5検証・採用値）。直近MONOPOLY_WINDOW件のソーシング実績のうち
// 独占が占める割合がこれを超える要求は、公開入札扱い（monopoly:false）に強制変換する。
// サンプルが少ないうちは長期比率を判定できないため、MONOPOLY_MIN_SAMPLE件に達するまでは
// 素通しする（ブートストラップ期間）。
const MAX_MONOPOLY_SHARE=.40;
const MONOPOLY_WINDOW=30;
const MONOPOLY_MIN_SAMPLE=5;

// 4経路（設計書§6.5）。upperContributionShareは「上手・上限40%」時の経路別寄与の目安
// （情報表示用。ソーシングの実際の経路選択ロジックはこのファイルでは扱わない）。
const PATH_TYPES=Object.freeze({
  referrer:Object.freeze({id:'referrer',name:'紹介者（銀行・会計士）',currencyLabel:'取引関係',upperContributionShare:.22}),
  longTermCultivation:Object.freeze({id:'longTermCultivation',name:'長期の仕込み',currencyLabel:'時間',upperContributionShare:.55}),
  reputation:Object.freeze({id:'reputation',name:'業界での評判',currencyLabel:'経営実績',upperContributionShare:.32}),
  portfolioReferral:Object.freeze({id:'portfolioReferral',name:'既存投資先からの紹介',currencyLabel:'改善スコア',upperContributionShare:.30})
});
const PATH_TYPE_IDS=Object.freeze(Object.keys(PATH_TYPES));

function defaultPeNetwork(){return {nodes:[],weeklyActionsUsed:0,weeklyActionsWeek:0,favorsOwed:[],dealSourcingLog:[]};}
function normalizeNode(n,week){
  if(!n)return n;
  n.pathType=PATH_TYPES[n.pathType]?n.pathType:'referrer';
  n.sourceType=String(n.sourceType||'');
  n.trust=clamp(finite(n.trust,10),0,100);
  n.createdWeek=Math.max(0,Math.floor(finite(n.createdWeek,week)));
  n.lastContactWeek=Math.max(0,Math.floor(finite(n.lastContactWeek,n.createdWeek)));
  return n;
}
function ensure(state){
  if(!state)return state;
  if(!state.peNetwork||typeof state.peNetwork!=='object')state.peNetwork=defaultPeNetwork();
  const pn=state.peNetwork;
  const week=Math.max(0,Math.floor(finite(state.week,0)));
  pn.nodes=arr(pn.nodes).slice(-MAX_NODES).map(n=>normalizeNode(n,week));
  pn.weeklyActionsUsed=Math.max(0,Math.floor(finite(pn.weeklyActionsUsed,0)));
  pn.weeklyActionsWeek=Math.max(0,Math.floor(finite(pn.weeklyActionsWeek,0)));
  pn.favorsOwed=arr(pn.favorsOwed).slice(-50);
  pn.dealSourcingLog=arr(pn.dealSourcingLog).slice(-MONOPOLY_WINDOW);
  return state;
}

// ノードの供給源は5本柱の経営（設計書§6の表）: 呼び出し側が実際の出会い方（sourceType）と
// 経路（pathType）を渡す。
function addNode(state,{sourceType='',pathType='referrer',industryTag=null,regionTag=null,week=0,trust=10}={}){
  ensure(state);
  const pn=state.peNetwork;
  const w=Math.max(0,Math.floor(finite(week,state.week)));
  const node={id:`pe-node-${pn.nodes.length+1}-${w}`,sourceType:String(sourceType||''),pathType:PATH_TYPES[pathType]?pathType:'referrer',industryTag,regionTag,trust:clamp(finite(trust,10),0,100),createdWeek:w,lastContactWeek:w};
  pn.nodes.push(node);
  pn.nodes=pn.nodes.slice(-MAX_NODES);
  return node;
}
function decayRateForPath(pathType){return pathType==='referrer'?GENERIC_DECAY_PER_WEEK+REFERRER_EXTRA_DECAY_PER_WEEK:GENERIC_DECAY_PER_WEEK;}
// 週次減衰を1週分だけ適用する。advanceWeekのフックから経過週ごとに1回呼ばれる。
function decayWeek(state){
  ensure(state);
  for(const node of state.peNetwork.nodes)node.trust=clamp(node.trust-decayRateForPath(node.pathType),0,100);
  return state;
}
// 人脈は金で買えない。通貨は時間（週次アクション枠2回、設計書§6）。
function weeklyActionsRemaining(state,week){
  ensure(state);
  const pn=state.peNetwork;
  const w=Math.max(0,Math.floor(finite(week,state.week)));
  if(pn.weeklyActionsWeek!==w){pn.weeklyActionsWeek=w;pn.weeklyActionsUsed=0;}
  return Math.max(0,WEEKLY_ACTIONS-pn.weeklyActionsUsed);
}
// 接触（面談・支援依頼への対応）。枠を1つ消費し、trustを上げ、減衰時計をリセットする。
// 枠が無い/ノードが存在しなければ何もせずfalseを返す。
function contactNode(state,nodeID,week){
  ensure(state);
  if(weeklyActionsRemaining(state,week)<=0)return false;
  const node=state.peNetwork.nodes.find(n=>n.id===nodeID);
  if(!node)return false;
  state.peNetwork.weeklyActionsUsed+=1;
  node.trust=clamp(node.trust+CONTACT_TRUST_GAIN,0,100);
  node.lastContactWeek=Math.max(0,Math.floor(finite(week,state.week)));
  return true;
}
// trust効果（設計書§6）: 20+限定入札招待 / 40+DD内部情報（誤差1段階縮む・枠を消費しない）/
// 60+独占案件の持ち込み / 80+Exit時買い手紹介。
function trustTier(node){
  const t=finite(node?.trust,0);
  return {limitedAuctionInvite:t>=20,ddInsiderInfo:t>=40,monopolyDeal:t>=60,exitBuyerIntroduction:t>=80};
}
// 独占案件の持ち込みはtrustを消費する（設計書: 60→35など）。trust不足ならnullを返す。
function bringMonopolyDeal(state,nodeID){
  ensure(state);
  const node=state.peNetwork.nodes.find(n=>n.id===nodeID);
  if(!node||node.trust<MONOPOLY_TRUST_THRESHOLD)return null;
  node.trust=clamp(node.trust-MONOPOLY_TRUST_COST,0,100);
  return node;
}
// 直近MONOPOLY_WINDOW件に占める独占ソーシングの比率。
function monopolyShare(state){
  ensure(state);
  const log=state.peNetwork.dealSourcingLog;
  return log.length?log.filter(x=>x.monopoly).length/log.length:0;
}
// 案件のソーシング実績を記録する（完了条件: 独占比率が40%を超えない）。独占として記録する
// ことで直近ウィンドウの比率が上限を超えてしまう場合は、公開入札扱い（monopoly:false）に
// 強制変換する。比率の分母はMONOPOLY_MIN_SAMPLE未満に縮めない（サンプルが少ないうちから
// 履歴を非独占で薄めて判定するため、立ち上がり数件だけ許可が連続して直後に比率超過する、
// という急激な乱れを避けられる）。
function recordDealSourced(state,{week=0,monopoly=false}={}){
  ensure(state);
  const pn=state.peNetwork;
  let allowMonopoly=false;
  if(monopoly){
    const candidate=[...pn.dealSourcingLog,{monopoly:true}].slice(-MONOPOLY_WINDOW);
    const denom=Math.max(MONOPOLY_MIN_SAMPLE,candidate.length);
    allowMonopoly=(candidate.filter(x=>x.monopoly).length/denom)<=MAX_MONOPOLY_SHARE;
  }
  const entry={week:Math.max(0,Math.floor(finite(week,state.week))),monopoly:allowMonopoly};
  pn.dealSourcingLog=[...pn.dealSourcingLog,entry].slice(-MONOPOLY_WINDOW);
  return entry;
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__peNetworkInstalled)return true;
  const baseNormalize=proto.normalize;
  proto.normalize=function(){const r=baseNormalize.call(this);ensure(this.g);return r;};
  const baseAdvanceWeek=proto.advanceWeek;
  proto.advanceWeek=function(...args){
    const before=finite(this.g.week);
    const r=baseAdvanceWeek.apply(this,args);
    if(r!==false){
      ensure(this.g);
      for(let w=before+1;w<=finite(this.g.week);w++)decayWeek(this.g);
    }
    return r;
  };
  Object.defineProperty(proto,'__peNetworkInstalled',{value:true});
  return true;
}
install();

modules.peNetwork=Object.freeze({
  MAX_NODES,WEEKLY_ACTIONS,GENERIC_DECAY_PER_WEEK,REFERRER_EXTRA_DECAY_PER_WEEK,CONTACT_TRUST_GAIN,
  MONOPOLY_TRUST_THRESHOLD,MONOPOLY_TRUST_COST,MAX_MONOPOLY_SHARE,MONOPOLY_WINDOW,MONOPOLY_MIN_SAMPLE,
  PATH_TYPES,PATH_TYPE_IDS,
  ensure,addNode,decayRateForPath,decayWeek,weeklyActionsRemaining,contactNode,trustTier,bringMonopolyDeal,monopolyShare,recordDealSourced,install,
  __installed:true
});
})();
