// Script boundary: js/pe-portfolio-operations.js (classic JavaScript)
//
// PE mode T14 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §11 課題1・C案): operating an
// acquired 5-pillar-tier company. This is deliberately a SELF-CONTAINED simplified operating
// model (its own cash, price/quality levers, store count, weekly P&L) rather than a refactor of
// the existing store/business engine (js/engine.js's stores/businesses) into a multi-tenant
// system -- doing the latter would mean touching nearly every method of the core simulation to
// be context-aware (self vs. N portfolio companies), which is far riskier than this task's
// actual completion criteria require ("経営結果が改善スコアになる" / accounting separation /
// a minimal verification UI). The design doc's own §8 states this task list covers "状態設計と
// 計算のみ"; this file follows that scope, faithfully to T14's specific numbers where the design
// doc gives them (改善スコア65超で評判接続) and documented, testable calibration where it does
// not (this file's own weekly P&L curve).
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine module must load before pe-portfolio-operations.js.');
if(!modules?.peFund)throw new Error('Capitalism Tycoon peFund module must load before pe-portfolio-operations.js.');
if(!modules?.peIndustryTiers)throw new Error('Capitalism Tycoon peIndustryTiers module must load before pe-portfolio-operations.js.');
if(modules.pePortfolioOperations)throw new Error('Capitalism Tycoon pePortfolioOperations module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const pf=modules.peFund,tiers=modules.peIndustryTiers;

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,finite(v,min)));
const arr=v=>Array.isArray(v)?v:[];

// Same deterministic FNV-1a hash as js/ma-deal-room.js / js/pe-rivals.js / js/pe-industry-tiers.js.
function hash(parts){let h=2166136261;String(parts.join('|')).split('').forEach(c=>{h^=c.charCodeAt(0);h=Math.imul(h,16777619);});return h>>>0;}
function unit(...p){return hash(p)/4294967295;}
function between(a,b,...p){return a+(b-a)*unit(...p);}

const PROFIT_HISTORY_LIMIT=260; // 5年分の週次履歴
const QUALITY_UPKEEP_RATE=.02; // qualityInvestment 1ポイントあたり週次維持費（額はEV比ではなく素点なので小さく効く程度に較正）
const QUALITY_INVESTMENT_COST_PER_POINT=1_000_000; // 100万円の追加投資でqualityInvestmentが1点上がる
const EXPANSION_COST_FRACTION=.05; // 出店1件あたりの費用: 企業価値の5%
const BASELINE_SCORE=50,PROFIT_SCORE_WEIGHT=35,QUALITY_SCORE_WEIGHT=15,PROFIT_SCORE_EV_FRACTION=.10;
// 経路3接続（設計書§6.5・§11）: 改善スコアが65を超えると業界での評判が上がり、次の独占案件に
// つながる。失敗（従業員を切って売り抜け）は逆に評判を下げる。
const REPUTATION_THRESHOLD=65;
const REPUTATION_BONUS=8;
const REPUTATION_PENALTY_FOR_CUTS=15;

function defaultPortfolioCompany(week){return {cash:0,priceMultiplier:1,qualityInvestment:0,storeCount:1,weeklyRevenue:0,weeklyProfit:0,profitHistory:[],improvementScore:BASELINE_SCORE,lastProcessedWeek:Math.max(0,Math.floor(finite(week,0)))};}
function normalizePortfolioCompany(pc,week){
  if(!pc)return pc;
  pc.cash=finite(pc.cash,0);
  pc.priceMultiplier=clamp(finite(pc.priceMultiplier,1),.5,2);
  pc.qualityInvestment=clamp(finite(pc.qualityInvestment,0),0,100);
  pc.storeCount=Math.max(1,Math.floor(finite(pc.storeCount,1)));
  pc.weeklyRevenue=finite(pc.weeklyRevenue,0);
  pc.weeklyProfit=finite(pc.weeklyProfit,0);
  pc.profitHistory=arr(pc.profitHistory).slice(-PROFIT_HISTORY_LIMIT);
  pc.improvementScore=clamp(finite(pc.improvementScore,BASELINE_SCORE),0,100);
  pc.lastProcessedWeek=Math.max(0,Math.floor(finite(pc.lastProcessedWeek,week)));
  return pc;
}
function ensureDeal(deal,week){
  if(!deal)return deal;
  deal.status=deal.status==='exited'?'exited':'active';
  if(deal.status==='active'&&deal.portfolioCompany)normalizePortfolioCompany(deal.portfolioCompany,week);
  return deal;
}
// 全ファンドの案件を正規化する（peFirm.funds[].deals[] のうち businessID を持つ = 5本柱系）。
function ensure(state){
  pf.ensure(state);
  const week=Math.max(0,Math.floor(finite(state.week,0)));
  for(const fund of state.peFirm.funds)for(const deal of arr(fund.deals))if(deal&&deal.businessID)ensureDeal(deal,week);
  return state;
}

function findFundAndDeal(state,fundID,dealID){
  ensure(state);
  const fund=state.peFirm.funds.find(f=>f.id===fundID);
  if(!fund)return {fund:null,deal:null};
  const deal=arr(fund.deals).find(d=>d.id===dealID);
  return {fund,deal:deal||null};
}

// 買収（設計書T14「5本柱系の案件を買収すると、既存の店舗経営UIが開く」の状態版）。
// js/pe-industry-tiers.js の pillar 帯の案件のみを想定する。共同投資の要否は呼び出し側が
// useCoinvest で選ぶ（T12のplanDealFinancingをそのまま使う）。分散義務・共同投資枠を
// 満たせない、またはファンドの手元資金が足りない場合はnullを返し何も変更しない。
function acquirePillarCompany(state,fundID,{businessID,enterpriseValue,useCoinvest=false,week}={}){
  ensure(state);
  const fund=state.peFirm.funds.find(f=>f.id===fundID);
  if(!fund||fund.status!=='investing')return null;
  if(!tiers.TIERS.pillar.businessIDs.includes(businessID))return null;
  const ev=Math.max(0,finite(enterpriseValue));
  if(ev<=0)return null;
  const plan=pf.planDealFinancing(fund,ev,useCoinvest);
  if(plan.rejectedAmount>0)return null; // 分散義務・共同投資枠を満たしても賄いきれない
  if(fund.cash<plan.fundPortion)return null; // 手元資金不足
  const w=Math.max(0,Math.floor(finite(week,state.week)));
  fund.cash-=plan.fundPortion;
  const coinvestUsed=pf.recordCoinvestment(fund,plan.coinvestPortion);
  const deal={
    id:`pe-deal-${fund.id}-${arr(fund.deals).length+1}-${w}`,
    businessID,tierID:'pillar',
    enterpriseValue:ev,
    acquisitionMultiple:tiers.TIERS.pillar.acquisitionMultiple,
    investedAmount:plan.fundPortion+coinvestUsed,
    fundPortion:plan.fundPortion,coinvestPortion:coinvestUsed,
    blendedCarryRate:plan.blendedCarryRate,
    acquiredWeek:w,status:'active',
    portfolioCompany:defaultPortfolioCompany(w)
  };
  fund.deals=arr(fund.deals);
  fund.deals.push(deal);
  fund.deals=fund.deals.slice(-500);
  return deal;
}

// 週次の経営結果（設計書T14「価格・メニュー・出店を自分で決められる。その経営結果が
// 改善スコアになる」）。1件分の処理。
function computeImprovementScore(deal){
  const pc=deal.portfolioCompany;
  const denom=Math.max(1,finite(deal.enterpriseValue)*PROFIT_SCORE_EV_FRACTION);
  const profitRatio=clamp(finite(pc.cash)/denom,-1,1);
  const qualityBonus=clamp(finite(pc.qualityInvestment)/100,0,1);
  return Math.round(clamp(BASELINE_SCORE+PROFIT_SCORE_WEIGHT*profitRatio+QUALITY_SCORE_WEIGHT*qualityBonus,0,100));
}
function processDealWeek(fund,deal,week){
  const pc=deal.portfolioCompany;
  if(!pc||pc.lastProcessedWeek>=week)return;
  const annualEBITDA=finite(deal.enterpriseValue)/Math.max(1,finite(deal.acquisitionMultiple,8));
  // T9のattention（チーム人数÷案件数）を、EBITDA成長計算に1回だけ乗算する（Codex独立監査
  // 対応: 以前はteamCapacity/slotCapacityと並ぶT9の一角として計算されるだけで、実際の
  // 経営結果には一切接続されていなかった）。1件に手が回っていれば頭打ち(倍率1.0)、
  // 案件数に対してチームが薄いほど鈍る、という設計書§4の方向性をここで反映する。
  const weeklyEBITDA=annualEBITDA/52*pc.storeCount*pf.attentionMultiplier(fund);
  // 価格を上げるほど数量が落ちる、という単純な弾力性（priceMultiplier=1.0を基準に線形）。
  const priceFactor=clamp(2-pc.priceMultiplier,.3,1.6);
  const qualityFactor=1+clamp(pc.qualityInvestment/200,0,.5);
  const noise=between(.92,1.08,'pe-portfolio-week',deal.id,week);
  const upkeep=pc.qualityInvestment*QUALITY_UPKEEP_RATE*Math.max(1,finite(deal.enterpriseValue)/1_000_000_000);
  const weeklyProfit=weeklyEBITDA*priceFactor*qualityFactor*noise-upkeep;
  pc.cash=finite(pc.cash)+weeklyProfit;
  pc.weeklyRevenue=weeklyEBITDA*priceFactor*noise*2;
  pc.weeklyProfit=weeklyProfit;
  pc.profitHistory=[...arr(pc.profitHistory),weeklyProfit].slice(-PROFIT_HISTORY_LIMIT);
  pc.improvementScore=computeImprovementScore(deal);
  pc.lastProcessedWeek=week;
}
function processPortfolioWeek(state,week){
  ensure(state);
  const w=Math.max(0,Math.floor(finite(week,state.week)));
  for(const fund of state.peFirm.funds)for(const deal of arr(fund.deals))if(deal&&deal.businessID&&deal.status==='active')processDealWeek(fund,deal,w);
  return state;
}

// 価格レバー。既存の店舗経営UIの「価格変更」に相当する簡易版。
function setPriceMultiplier(state,fundID,dealID,value){
  const {deal}=findFundAndDeal(state,fundID,dealID);
  if(!deal||deal.status!=='active')return null;
  deal.portfolioCompany.priceMultiplier=clamp(finite(value,1),.5,2);
  return deal;
}
// 品質投資レバー。ファンド持分ではなく買収先自身のcashから支出する（会計分離）。
function investQuality(state,fundID,dealID,amount){
  const {deal}=findFundAndDeal(state,fundID,dealID);
  if(!deal||deal.status!=='active')return null;
  const pc=deal.portfolioCompany;
  const spend=Math.max(0,Math.min(finite(amount),pc.cash));
  pc.cash-=spend;
  pc.qualityInvestment=Math.min(100,pc.qualityInvestment+spend/QUALITY_INVESTMENT_COST_PER_POINT);
  return deal;
}
// 出店。買収先自身のcashから支出する。
function expandPortfolioStore(state,fundID,dealID){
  const {deal}=findFundAndDeal(state,fundID,dealID);
  if(!deal||deal.status!=='active')return null;
  const pc=deal.portfolioCompany;
  const cost=EXPANSION_COST_FRACTION*finite(deal.enterpriseValue);
  if(pc.cash<cost)return null;
  pc.cash-=cost;
  pc.storeCount+=1;
  return deal;
}
// Exit（売却/IPO/自分で経営のうち、ここでは売却・IPOによる終了を扱う）。
// 回収額はファンドへ即時分配（T5: Exit代金は再投資できない）。改善スコアが65を超えると
// 業界での評判が上がり、従業員を切って売り抜けた場合は逆に評判が下がる（設計書§6.5・§11）。
function exitPortfolioCompany(state,fundID,dealID,{method='sale',week,cutEmployees=false}={}){
  const {fund,deal}=findFundAndDeal(state,fundID,dealID);
  if(!fund||!deal||deal.status!=='active')return null;
  const pc=deal.portfolioCompany;
  const score=pc.improvementScore;
  const exitMultiple=finite(deal.acquisitionMultiple,8)*(.7+score/100*.6);
  const annualEBITDA=finite(deal.enterpriseValue)/Math.max(1,finite(deal.acquisitionMultiple,8));
  const exitEV=annualEBITDA*pc.storeCount*exitMultiple;
  const proceeds=Math.max(0,exitEV+pc.cash);
  fund.distributed=finite(fund.distributed)+proceeds;
  deal.status='exited';
  deal.exitedWeek=Math.max(0,Math.floor(finite(week,state.week)));
  deal.exitMethod=method;
  deal.exitProceeds=proceeds;
  deal.exitScore=score;
  const network=modules.peNetwork;
  if(network){
    network.ensure(state);
    for(const node of state.peNetwork.nodes.filter(n=>n.pathType==='reputation'&&n.industryTag===deal.businessID)){
      if(cutEmployees)node.trust=clamp(node.trust-REPUTATION_PENALTY_FOR_CUTS,0,100);
      else if(score>=REPUTATION_THRESHOLD)node.trust=clamp(node.trust+REPUTATION_BONUS,0,100);
    }
  }
  return deal;
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__pePortfolioOperationsInstalled)return true;
  const baseNormalize=proto.normalize;
  proto.normalize=function(){const r=baseNormalize.call(this);ensure(this.g);return r;};
  const baseAdvanceWeek=proto.advanceWeek;
  proto.advanceWeek=function(...args){
    const before=finite(this.g.week);
    const r=baseAdvanceWeek.apply(this,args);
    if(r!==false){
      ensure(this.g);
      for(let w=before+1;w<=finite(this.g.week);w++)processPortfolioWeek(this.g,w);
    }
    return r;
  };
  Object.defineProperty(proto,'__pePortfolioOperationsInstalled',{value:true});
  return true;
}
install();

modules.pePortfolioOperations=Object.freeze({
  PROFIT_HISTORY_LIMIT,QUALITY_UPKEEP_RATE,QUALITY_INVESTMENT_COST_PER_POINT,EXPANSION_COST_FRACTION,
  BASELINE_SCORE,PROFIT_SCORE_WEIGHT,QUALITY_SCORE_WEIGHT,PROFIT_SCORE_EV_FRACTION,
  REPUTATION_THRESHOLD,REPUTATION_BONUS,REPUTATION_PENALTY_FOR_CUTS,
  ensure,findFundAndDeal,acquirePillarCompany,computeImprovementScore,processDealWeek,processPortfolioWeek,
  setPriceMultiplier,investQuality,expandPortfolioStore,exitPortfolioCompany,install,
  __installed:true
});
})();
