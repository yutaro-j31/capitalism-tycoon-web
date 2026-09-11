// Script boundary: js/pe-acquisition.js (classic JavaScript)
//
// PE mode T17 (docs/PE_MODE_TASKS.md): the second half of the production path. T16 supplies PE
// deals into the ordinary M&A board and consumes DD slots; this file makes the money move:
//
//   案件供給 → DD → indication → final_bid → submitMAOffer → 落札 → ファンドの現金で取得
//   → 保有（js/pe-portfolio-operations.js）→ Exit（js/pe-fund.js settleExitProceeds）
//
// Until now the only way a fund could own anything was pePortfolioOperations.acquirePillarCompany(),
// a test/helper entry point that skipped bidding and DD entirely (Codex監査 PE-AUDIT-005). The
// closing of a PE deal is therefore taken over here in full rather than delegated to
// js/ma-deal-room.js's completeTargetAcquisition, because a fund acquisition differs from a
// corporate acquisition in every material way:
//
//   - 買い手はファンドであって会社ではない: fund.cash から出る。companyCash は一切動かない。
//   - 連結子会社にはならない: maSubsidiaries にも goodwillRecords にも入らない。ファンドの
//     ポートフォリオ企業（fund.deals[]）として保有し、Exitで売る。
//   - 分散義務(25%)・共同投資枠・同時案件数(slotCapacity)という、会社の買収には無い制約に従う。
//
// 会計分離（絶対条件）: この経路が触るのは fund.cash / fund.deals / fund.coinvestCommitted と、
// Exit時のGPキャリーとしての state.personalCash だけ。取得価格が companyCash から出ることは
// 無く、ポートフォリオ企業の損益が会社のP/Lに乗ることも無い。DD費用・アドバイザリー費用だけは
// 既存のディールルームの通り会社（＝GP法人）が負担する（T16と同じ扱い）。
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine module must load before pe-acquisition.js.');
if(!modules?.peFund)throw new Error('Capitalism Tycoon peFund module must load before pe-acquisition.js.');
if(!modules?.peDealSupply)throw new Error('Capitalism Tycoon peDealSupply module must load before pe-acquisition.js.');
if(!modules?.pePortfolioOperations)throw new Error('Capitalism Tycoon pePortfolioOperations module must load before pe-acquisition.js.');
if(modules.peAcquisition)throw new Error('Capitalism Tycoon peAcquisition module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const pf=modules.peFund,ds=modules.peDealSupply,ops=modules.pePortfolioOperations;

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const arr=v=>Array.isArray(v)?v:[];

// 保有案件の上限（CLAUDE.md の配列上限方針）。ファンドあたりの同時保有数は slotCapacity(最大8)
// で縛られるが、Exit済みの記録も同じ配列に残るため、履歴側の上限も明示しておく。
const MAX_DEALS_PER_FUND=500;

function peTargetFor(state,deal){
  if(!deal)return null;
  const t=arr(state?.acquisitionTargets).find(x=>x?.id===deal.targetID);
  return ds.isPETarget(t)?t:null;
}

// 取得の可否をひとところで判定する（オファー提出時と最終契約時の両方が同じ判定を通る）。
// ok:false のときは message に理由が入る。state は一切変更しない純粋な判定。
function evaluateFundPurchase(state,deal,price){
  const fund=deal?.fundID?ds.investingFundByID(state,deal.fundID):null;
  if(!deal?.fundID)return {ok:false,message:'PE案件の取得にはファンドの指定が必要です。'};
  if(!fund)return {ok:false,message:'投資期間中のファンドでのみ取得できます。'};
  // 同時に抱えられる案件数（T9 slotCapacity）。ここが「スロット満杯なら取得できない」の実体。
  if(pf.activeDealCount(fund)>=pf.slotCapacity(fund))return {ok:false,message:'同時に抱えられる案件数の上限に達しています。'};
  const amount=Math.max(0,finite(price));
  const plan=pf.planDealFinancing(fund,amount,Boolean(deal.useCoinvest));
  if(plan.rejectedAmount>0)return {ok:false,fund,plan,message:'分散義務（1件あたりファンドの25%）と共同投資枠では取得額に届きません。'};
  if(finite(fund.cash)<plan.fundPortion)return {ok:false,fund,plan,message:'ファンドの手元資金が不足しています。'};
  return {ok:true,fund,plan};
}

// js/ma-deal-room.js の submitMAOffer から呼ばれるフック。PE案件のときだけ handled:true を返し、
// 会社の現金・調達可能額による判定を置き換える（買い手はファンドなので会社の資金力は無関係）。
// PE案件でなければ null を返し、既存の判定がそのまま使われる。
function validateOfferFunding(state,target,deal,price,method){
  if(!ds.isPETarget(target))return null;
  if(method==='shareSwap')return {handled:true,ok:false,message:'ファンドによる取得に株式交換は使えません。'};
  const check=evaluateFundPurchase(state,deal,price);
  return {handled:true,ok:check.ok,message:check.message};
}

// ディールルームの履歴・ニュースへの記録（js/ma-deal-room.js の内部 hist と同じ形）。
function peHist(state,deal,type,message){
  const id=`ma-history-${deal.id}-${type}-base-${state.week}`;
  deal.history=arr(deal.history);
  if(deal.history.some(x=>x?.id===id))return;
  const row={id,week:state.week,type,message};
  deal.history.push(row);
  deal.history=deal.history.slice(-100);
  state.maDealHistory=arr(state.maDealHistory);
  state.maDealHistory.unshift(row);
  state.maDealHistory=state.maDealHistory.slice(0,200);
  state.news=arr(state.news);
  const line=`第${state.week}週：${message}`;
  if(!state.news.includes(line))state.news.unshift(line);
}

// 落札したPE案件をファンドの現金で取得し、ポートフォリオ企業として保有に入れる。
function closeFundAcquisition(engine,{deal,target,targetIndex,price,week}){
  const state=engine.g;
  const check=evaluateFundPurchase(state,deal,price);
  if(!check.ok)return engine.fail(check.message);
  const {fund,plan}=check;
  const w=Math.max(0,Math.floor(finite(week,state.week)));
  fund.cash=finite(fund.cash)-plan.fundPortion;
  // T26-1: 共同投資家の資本は「呼び込む(record)→売り手へ払う(spend)」の2段で通す。
  // record だけで取得できると、枠を使ったメモだけで原価が生まれてしまう。
  const coinvestUsed=pf.recordCoinvestment(state,fund,plan.coinvestPortion);
  const coinvestPaid=pf.spendCoinvestment(fund,coinvestUsed);
  if(coinvestPaid!==coinvestUsed)throw new Error('共同投資poolの拠出額と取得支払額が一致しません。');
  // T4の売り手条件（雇用・社名の維持）は、ここでポートフォリオ企業へ引き継がれる。
  // T18の人員削減・閉店レバーがこのフラグを見て禁止判定を行う（入札時の判断が数年後に返る）。
  const employmentPromise=Boolean(deal.acceptedTerms?.acceptedSellerTerm&&deal.acceptedTerms?.sellerTermID==='employmentContinuity');
  fund.deals=arr(fund.deals);
  const portfolioDeal={
    id:`pe-deal-${fund.id}-${fund.deals.length+1}-${w}`,
    businessID:target.peBusinessID||null,
    tierID:target.peTierID,
    sourceTargetID:target.id,
    sourceDealRoomID:deal.id,
    companyName:target.name,
    // 企業価値は「その会社が本来持っている価値」(T11の生成値)であって、入札で払った金額では
    // ない。保有中のEBITDAもExit時の売却価値もこのenterpriseValueから導くので、高く買えば
    // 買うほどMOICが下がる — 入札で無理をした判断が3〜4年後に返ってくる、という因果を
    // ここで成立させる。払った金額は acquisitionPrice / investedAmount 側が持つ。
    enterpriseValue:Math.max(0,finite(target.peEnterpriseValue,price)),
    acquisitionPrice:Math.max(0,finite(price)),
    acquisitionMultiple:Math.max(1,finite(target.peAcquisitionMultiple,8)),
    investedAmount:plan.fundPortion+coinvestUsed,
    fundPortion:plan.fundPortion,
    coinvestPortion:coinvestUsed,
    blendedCarryRate:plan.blendedCarryRate,
    employmentPromise,
    acquiredWeek:w,
    status:'active',
    portfolioCompany:ops.defaultPortfolioCompany(w)
  };
  fund.deals.push(portfolioDeal);
  fund.deals=fund.deals.slice(-MAX_DEALS_PER_FUND);
  state.acquisitionTargets.splice(targetIndex,1);
  deal.status='acquired';
  deal.closedWeek=w;
  deal.peDealID=portfolioDeal.id;
  peHist(state,deal,'closed',`${target.name}をファンド（${fund.id}）で取得しました。`);
  engine.notify?.(`${target.name}をファンドで取得しました。`,'success');
  engine.save();
  engine.emit();
  return true;
}

// 案件ごとの共同投資の使用可否（設計書§14「規模を取るか報酬率を取るかの交換」）。
// 取得の前であればいつでも切り替えられる。
function setDealCoinvest(state,dealRoomID,useCoinvest){
  const deal=arr(state?.maDealRooms).find(d=>d?.id===dealRoomID);
  if(!deal)return null;
  deal.useCoinvest=Boolean(useCoinvest);
  return deal;
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__peAcquisitionInstalled)return true;
  if(typeof proto.completeTargetAcquisition!=='function')return false;

  const baseComplete=proto.completeTargetAcquisition;
  proto.completeTargetAcquisition=function(args={}){
    // PE案件だと分かるまで正規化しない。ds.ensure は state に既定値を書き込むため、
    // 通常のM&Aが失敗しただけの呼び出しで state が変化してしまい、「失敗した操作は
    // 状態を変えない」というアトミシティ契約（tests/ma-acquisition-financing-atomicity-test.js）
    // を壊す。判定に必要なのは対象候補だけで、正規化は要らない。
    const deal=arr(this.g.maDealRooms).find(x=>x?.id===args.dealID);
    const targetIndex=arr(this.g.acquisitionTargets).findIndex(x=>x?.id===args.targetID);
    const target=targetIndex>=0?this.g.acquisitionTargets[targetIndex]:null;
    if(!ds.isPETarget(target))return baseComplete.call(this,args);
    ds.ensure(this.g);
    const price=finite(args.approvedPrice);
    // 最終契約の前提条件は既存の経路とまったく同じものを課す（受諾済み・条件一致・期限内・未クローズ）。
    if(!deal||deal.status!=='accepted'||!deal.acceptedTerms||target.activeDealID!==deal.id||deal.targetID!==args.targetID||deal.acceptedTerms.method!==args.method||finite(deal.acceptedTerms.finalPrice)!==price||this.g.week>deal.acceptedTerms.closingDeadlineWeek||deal.closedWeek)return this.fail('最終契約を実行できません。');
    if(args.method==='shareSwap')return this.fail('ファンドによる取得に株式交換は使えません。');
    return closeFundAcquisition(this,{deal,target,targetIndex,price,week:this.g.week});
  };

  // 共同投資を使うかどうかの案件単位の選択。
  proto.setPEDealCoinvest=function(dealRoomID,useCoinvest){
    ds.ensure(this.g);
    if(!setDealCoinvest(this.g,dealRoomID,useCoinvest))return this.fail('案件が見つかりません。');
    this.save();
    this.emit();
    return true;
  };
  // 保有中のポートフォリオ企業のExit（決済はjs/pe-fund.jsのウォーターフォールを通る）。
  proto.exitPEPortfolioCompany=function(fundID,dealID,options={}){
    ds.ensure(this.g);
    const deal=ops.exitPortfolioCompany(this.g,fundID,dealID,{...options,week:this.g.week});
    if(!deal)return this.fail('この案件はExitできません。');
    this.save();
    this.emit();
    return true;
  };

  Object.defineProperty(proto,'__peAcquisitionInstalled',{value:true});
  return true;
}
if(!install()&&typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  document.addEventListener('DOMContentLoaded',install,{once:true});
}

modules.peAcquisition=Object.freeze({
  MAX_DEALS_PER_FUND,
  peTargetFor,evaluateFundPurchase,validateOfferFunding,setDealCoinvest,install,
  __installed:true
});
})();
