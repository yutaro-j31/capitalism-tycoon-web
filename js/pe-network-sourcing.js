// Script boundary: js/pe-network-sourcing.js (classic JavaScript)
//
// PE mode T19 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §6.5): 人脈ノードの生成結線。
// js/pe-network.js (T13) は addNode()/trust/減衰/独占ソーシングの機械だけを持っていて、実際の
// ゲーム行動からノードが生まれる経路が無かった（Codex監査 PE-AUDIT-008B）。このファイルが
// 設計書§6.5の供給源の表を、既存のアクションへのフックとして実装する:
//
//   店舗の仕入先     → 食品卸のオーナー   (業種・地域)   contractSupplier
//   テナント契約     → ビルオーナー       (不動産・地域) openStore
//   銀行借入         → 支店長             (金融・地域)   borrow
//   雇ったCXO        → 元大企業役員       (前職の業種)   hireExecutive
//   Exit先の経営陣   → 買収した会社の社長 (その事業)     exitPEPortfolioCompany
//   IPO時の証券会社  → 主幹事担当         (買い手紹介)   executeIPO
//
// 「人脈は金で買えない。通貨は時間」（設計書§6）なので、ノードは行動の副産物としてのみ増え、
// 育てるには週次アクション枠（2回）を使う。ここではその枠を消費する唯一のプレイヤー操作
// （contactPENetworkNode）も engine のメソッドとして生やす。
//
// 決定論: ノードの初期trustは供給源ごとの安定キー（sourceKey）由来のハッシュだけで決まる。
// シミュレーションRNGは一切消費しない。同一seedの進行なら生成されるノードは完全に一致する。
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine module must load before pe-network-sourcing.js.');
if(!modules?.peNetwork)throw new Error('Capitalism Tycoon peNetwork module must load before pe-network-sourcing.js.');
if(modules.peNetworkSourcing)throw new Error('Capitalism Tycoon peNetworkSourcing module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const pn=modules.peNetwork;

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const arr=v=>Array.isArray(v)?v:[];

// Same deterministic FNV-1a hash as the other PE modules.
function hash(parts){let h=2166136261;String(parts.join('|')).split('').forEach(c=>{h^=c.charCodeAt(0);h=Math.imul(h,16777619);});return h>>>0;}
function unit(...p){return hash(p)/4294967295;}
function between(a,b,...p){return a+(b-a)*unit(...p);}

// 出会ったばかりの相手の信頼度。設計書は具体値を与えていないため、trust効果の最初の段
// （20+で限定入札に呼ばれる）にすぐには届かない水準に較正する。証券会社の主幹事担当だけは
// 仕事上の付き合いとして始まるので高めから入る。
const INITIAL_TRUST_MIN=8,INITIAL_TRUST_MAX=18;
const UNDERWRITER_TRUST_MIN=25,UNDERWRITER_TRUST_MAX=35;
// CXO候補のモデルには前職の業種が無いため、候補IDから決定論的に割り当てる。
const EXECUTIVE_BACKGROUND_INDUSTRIES=Object.freeze(['製造','商社','小売','金融','IT','外食']);

const SOURCE_TYPES=Object.freeze({
  supplier:'食品卸のオーナー',
  buildingOwner:'ビルオーナー',
  bankBranchManager:'支店長',
  formerExecutive:'元大企業役員',
  portfolioManagement:'買収した会社の社長',
  ipoUnderwriter:'主幹事担当'
});

// 同じ相手を二重に人脈へ入れない（同じ銀行支店から何度借りても支店長は1人）。
function hasSource(state,sourceKey){return arr(state?.peNetwork?.nodes).some(n=>n?.sourceKey===sourceKey);}
// 供給源からノードを1つ作る。既に同じ相手が居れば何もしない。
function addSourcedNode(state,{sourceKey,sourceType,pathType,industryTag=null,regionTag=null,week,trustRange}={}){
  if(!state||!sourceKey)return null;
  pn.ensure(state);
  if(hasSource(state,sourceKey))return null;
  const [lo,hi]=trustRange||[INITIAL_TRUST_MIN,INITIAL_TRUST_MAX];
  const node=pn.addNode(state,{
    sourceType,pathType,industryTag,regionTag,
    week:Math.max(0,Math.floor(finite(week,finite(state.week,0)))),
    trust:between(lo,hi,'pe-node-trust',sourceKey)
  });
  if(node)node.sourceKey=sourceKey;
  return node;
}

// 設計書§6.5の表の6行。呼び出し側（下のフック）が引数だけを渡す。
function onSupplierContract(state,{offerID,businessID,week}={}){
  return addSourcedNode(state,{sourceKey:`supplier:${offerID}:${businessID}`,sourceType:SOURCE_TYPES.supplier,pathType:'longTermCultivation',industryTag:businessID||null,regionTag:state?.selectedPref||null,week});
}
function onTenantContract(state,{tenantID,prefID,week}={}){
  return addSourcedNode(state,{sourceKey:`tenant:${tenantID}`,sourceType:SOURCE_TYPES.buildingOwner,pathType:'longTermCultivation',industryTag:'realEstate',regionTag:prefID||state?.selectedPref||null,week});
}
function onBankLoan(state,{account='company',prefID,week}={}){
  const region=prefID||state?.selectedPref||'unknown';
  return addSourcedNode(state,{sourceKey:`bank:${account}:${region}`,sourceType:SOURCE_TYPES.bankBranchManager,pathType:'referrer',industryTag:'finance',regionTag:region,week});
}
function onExecutiveHire(state,{candidateID,role,week}={}){
  const industry=EXECUTIVE_BACKGROUND_INDUSTRIES[hash(['pe-exec-background',String(candidateID||role||'')])%EXECUTIVE_BACKGROUND_INDUSTRIES.length];
  return addSourcedNode(state,{sourceKey:`executive:${candidateID}`,sourceType:SOURCE_TYPES.formerExecutive,pathType:'referrer',industryTag:industry,regionTag:state?.selectedPref||null,week});
}
function onPortfolioExit(state,{dealID,industryTag,week}={}){
  return addSourcedNode(state,{sourceKey:`portfolio:${dealID}`,sourceType:SOURCE_TYPES.portfolioManagement,pathType:'portfolioReferral',industryTag:industryTag||null,regionTag:state?.selectedPref||null,week});
}
function onIPO(state,{market,week}={}){
  return addSourcedNode(state,{sourceKey:`ipo:${market}`,sourceType:SOURCE_TYPES.ipoUnderwriter,pathType:'referrer',industryTag:'finance',regionTag:state?.selectedPref||null,week,trustRange:[UNDERWRITER_TRUST_MIN,UNDERWRITER_TRUST_MAX]});
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__peNetworkSourcingInstalled)return true;
  // contractSupplier は js/expansion.js が installExpansion 経由で生やすので、js/app.js が
  // それを呼ぶまで存在しない（js/pe-fund.js の completion 依存フックと同じ事情）。
  if(typeof proto.contractSupplier!=='function')return false;

  const baseContractSupplier=proto.contractSupplier;
  proto.contractSupplier=function(offerID,businessID){
    const r=baseContractSupplier.call(this,offerID,businessID);
    if(r===true)onSupplierContract(this.g,{offerID,businessID,week:this.g.week});
    return r;
  };

  const baseOpenStore=proto.openStore;
  proto.openStore=function(options={}){
    const tenant=arr(this.g.tenants).find(t=>t?.id===options?.tenantID);
    const r=baseOpenStore.call(this,options);
    if(r!==false)onTenantContract(this.g,{tenantID:options?.tenantID,prefID:tenant?.prefID,week:this.g.week});
    return r;
  };

  const baseBorrow=proto.borrow;
  proto.borrow=function(amount,account='company'){
    const r=baseBorrow.call(this,amount,account);
    if(r!==false)onBankLoan(this.g,{account,prefID:this.g.selectedPref,week:this.g.week});
    return r;
  };

  const baseHireExecutive=proto.hireExecutive;
  proto.hireExecutive=function(candidateID,salary=null,so=null){
    const candidate=arr(this.g.executiveMarket).find(x=>x?.id===candidateID);
    const r=baseHireExecutive.call(this,candidateID,salary,so);
    // 交渉不成立(false)では出会いにならない。採用できたときだけ人脈になる。
    if(r!==false&&this.g.executives?.[candidate?.role]?.id===candidateID)onExecutiveHire(this.g,{candidateID,role:candidate?.role,week:this.g.week});
    return r;
  };

  const baseExecuteIPO=proto.executeIPO;
  proto.executeIPO=function(market='東証グロース',sellShares=0){
    const r=baseExecuteIPO.call(this,market,sellShares);
    if(r===true)onIPO(this.g,{market,week:this.g.week});
    return r;
  };

  // Exit先の経営陣。T17の exitPEPortfolioCompany が唯一のExit実行経路。
  if(typeof proto.exitPEPortfolioCompany==='function'){
    const ops=modules.pePortfolioOperations;
    const baseExit=proto.exitPEPortfolioCompany;
    proto.exitPEPortfolioCompany=function(fundID,dealID,options={}){
      const r=baseExit.call(this,fundID,dealID,options);
      if(r===true){
        const found=ops?.findFundAndDeal(this.g,fundID,dealID);
        if(found?.deal)onPortfolioExit(this.g,{dealID,industryTag:ops.industryTagOf(found.deal),week:this.g.week});
      }
      return r;
    };
  }

  // 週次アクション枠（2回）を消費する唯一のプレイヤー操作。枠が尽きていれば失敗する。
  proto.contactPENetworkNode=function(nodeID){
    pn.ensure(this.g);
    if(pn.weeklyActionsRemaining(this.g,this.g.week)<=0)return this.fail('今週の人脈アクションを使い切りました。');
    if(!pn.contactNode(this.g,nodeID,this.g.week))return this.fail('この相手には接触できません。');
    this.save();
    this.emit();
    return true;
  };

  Object.defineProperty(proto,'__peNetworkSourcingInstalled',{value:true});
  return true;
}
if(!install()&&typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  document.addEventListener('DOMContentLoaded',install,{once:true});
}

modules.peNetworkSourcing=Object.freeze({
  INITIAL_TRUST_MIN,INITIAL_TRUST_MAX,UNDERWRITER_TRUST_MIN,UNDERWRITER_TRUST_MAX,
  SOURCE_TYPES,EXECUTIVE_BACKGROUND_INDUSTRIES,
  hasSource,addSourcedNode,onSupplierContract,onTenantContract,onBankLoan,onExecutiveHire,onPortfolioExit,onIPO,install,
  __installed:true
});
})();
