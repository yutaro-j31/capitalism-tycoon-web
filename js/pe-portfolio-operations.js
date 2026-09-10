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
// T20（通し検証）で判明した較正の修正: 品質投資・出店・維持費はいずれも「会社の規模に対して」
// 効くべきなのに、旧実装は素点や絶対額で扱っていた。100億円規模の会社でも1億円で品質を上限
// まで買え（＝売上+50%が事実上タダ）、1店舗増やすと会社まるごと1社ぶんEBITDAが増える（＝EVの
// 5%で100%増）という価格付けになっていたため、100年通すと資産が京のオーダーまで指数爆発した。
// 3つとも企業価値・EBITDA比に置き換える。既定値（品質0・1店舗）では従来と完全に同じ挙動。
const QUALITY_UPKEEP_RATE_OF_EBITDA=.10; // 品質を上限まで維持すると週次EBITDAの10%が維持費に消える
const QUALITY_COST_FRACTION_PER_POINT=.003; // 品質1点＝企業価値の0.3%（上限100点で30%、回収に約4年）
const EXPANSION_COST_FRACTION=.05; // 出店1件あたりの費用: 企業価値の5%
const STORE_MARGINAL_EBITDA_SHARE=.05; // T23: 1店舗の増分は元の会社のEBITDAの5%（EVの5%の回収に約7年。Exitまでに回収しきらない）
const BASELINE_SCORE=50,PROFIT_SCORE_WEIGHT=35,QUALITY_SCORE_WEIGHT=15;
// T23（再較正）: 改善スコアの「利益」側の物差し。T20実測では全案件がスコア100に張り付き、
// Exit倍率の拡大が常に最大になっていた。保有中に企業価値の何割を現金で稼いだかを問う
// 水準を上げ、満点は簡単には出ないようにする（下振れは増やさない。下限は据え置き）。
const PROFIT_SCORE_EV_FRACTION=.50;
// T23: 品質投資による売上増の上限。旧値は+50%で、しかも払える額なら誰でも上限まで買えた。
// 上振れを抑えるため効果の天井だけを下げる（費用と維持費はT20の較正のまま）。
const QUALITY_MAX_REVENUE_GAIN=.13;
// 経路3接続（設計書§6.5・§11）: 改善スコアが65を超えると業界での評判が上がり、次の独占案件に
// つながる。失敗（従業員を切って売り抜け）は逆に評判を下げる。
const REPUTATION_THRESHOLD=65;
const REPUTATION_BONUS=8;
const REPUTATION_PENALTY_FOR_CUTS=15;
// T23: Exit倍率＝取得倍率×(EXIT_MULTIPLE_FLOOR + スコア/100×EXIT_MULTIPLE_SCORE_SPAN)。
// 下限(FLOOR)は据え置き、上側の幅(SPAN)だけを詰める＝最悪ケースを悪化させずに上振れを抑える。
// T26較正: 管理報酬を実際にファンドの現金から払うようにした結果（T26-2）、Fund I DPI中央値が
// 1.35→1.27、Fund II到達率が86.1%→69.4%まで下がった（費用が増えたのだから下がること自体は
// 正しい。§16.5矛盾4）。ただし下がり幅が設計range（DPI 1.3〜1.7・到達80〜90%）を割った。
// T23の逆（下限は動かさず上限の幅だけを少し戻す）で補正する。半減率0.0%とスコアが低い側の
// 挙動（FLOORそのもの）は不変。
const EXIT_MULTIPLE_FLOOR=.80;
const EXIT_MULTIPLE_SCORE_SPAN=.25;

// PE mode T18 (docs/PE_MODE_TASKS.md): 買収先経営の6レバー化。
// 6レバー = 価格 / 品質 / 拠点（出店と再編の両方向）/ 仕入れ・調達 / 人件費と人員 / 商品構成。
// 設計意図（T18に明記）: コスト側（仕入れ・人件費・拠点再編）は即効性があり、トップライン側
// （商品構成）は2〜3年かかる。Exitが3〜4年後なので「どこまで削って、どこに仕込むか」の配分が
// 腕になる。削る側には必ず遅れて副作用が来るので、Exit直前に削って売り抜けることはできても
// 評判（T13経路3）を失う、という交換になっている。
// 数値はいずれも設計書が具体値を与えていない領域なので、このファイル独自の較正である。
// すべてのレバーは既定値で完全に中立（倍率1.0）になっており、T18以前のセーブ・既存の
// 較正値は一切動かない。
const PROCUREMENT_EBITDA_GAIN=.30;      // 仕入れ改革を全力(1.0)でやるとEBITDAが+30%（即効）
const PROCUREMENT_SAFE_LEVEL=.5;        // ここまでは副作用なし。超えた分だけ品質が落ちる
const PROCUREMENT_QUALITY_DRAG=.35;     // 超過分1.0あたり、遅れて客数（トップライン）が最大-35%
const PROCUREMENT_DELAY_WEEKS=52;       // 副作用が出始めるまで1年
const PROCUREMENT_DRAG_RAMP_WEEKS=52;   // そこから1年かけて出きる
const PROCUREMENT_COST_FRACTION=.01;    // 改革の一時費用: 水準1.0あたり企業価値の1%
const LABOR_EBITDA_GAIN=1.0;            // 人件費はEBITDAの最大項目: 削減率がそのまま倍率に乗る
const LABOR_SERVICE_DRAG=.5;            // 人員削減1.0あたり、遅れてトップラインが最大-50%
const LABOR_WAGE_DRAG=.25;              // 賃金カットは人員削減より弱く効く
const LABOR_DELAY_WEEKS=39;             // 3四半期遅れ
const LABOR_DRAG_RAMP_WEEKS=52;
const WAGE_MIN=.7,WAGE_MAX=1.3,HEADCOUNT_MIN=.6,HEADCOUNT_MAX=1.2;
const PRODUCT_MIX_RAMP_WEEKS=130;       // 2.5年かけて効いてくる（設計書「2〜3年かかる」）
const PRODUCT_MIX_MAX_GAIN=.35;         // 効きめ切ればトップライン+35%
const PRODUCT_MIX_COST_FRACTION=.03;    // 刷新の一時費用: 水準1.0あたり企業価値の3%
const CONSOLIDATION_STEP=1/3;           // 1回の再編で不採算拠点の1/3を閉じる
const CONSOLIDATION_EBITDA_GAIN=.8;     // 不採算分を落とした分だけ利益率が上がる
const UNDERPERFORMING_MIN=.05,UNDERPERFORMING_MAX=.30; // 買収時点の不採算拠点比率（案件ごとに決定論的）

function defaultPortfolioCompany(week){
  const w=Math.max(0,Math.floor(finite(week,0)));
  return {
    cash:0,priceMultiplier:1,qualityInvestment:0,storeCount:1,
    // T18の4レバー。いずれも既定値は完全に中立（効果ゼロ）。
    procurementReform:0,procurementSetWeek:w,
    wageLevel:1,headcountRatio:1,staffingSetWeek:w,
    productMixLevel:0,productMixSetWeek:w,
    consolidatedRatio:0,closedSiteCount:0,
    weeklyRevenue:0,weeklyProfit:0,profitHistory:[],improvementScore:BASELINE_SCORE,
    lastProcessedWeek:w
  };
}
function normalizePortfolioCompany(pc,week){
  if(!pc)return pc;
  pc.cash=finite(pc.cash,0);
  pc.priceMultiplier=clamp(finite(pc.priceMultiplier,1),.5,2);
  pc.qualityInvestment=clamp(finite(pc.qualityInvestment,0),0,100);
  pc.storeCount=Math.max(1,Math.floor(finite(pc.storeCount,1)));
  // T18: 旧セーブ（T18以前の買収先）には新レバーの欄が無いので、中立値を補う。
  pc.procurementReform=clamp(finite(pc.procurementReform,0),0,1);
  pc.procurementSetWeek=Math.max(0,Math.floor(finite(pc.procurementSetWeek,week)));
  pc.wageLevel=clamp(finite(pc.wageLevel,1),WAGE_MIN,WAGE_MAX);
  pc.headcountRatio=clamp(finite(pc.headcountRatio,1),HEADCOUNT_MIN,HEADCOUNT_MAX);
  pc.staffingSetWeek=Math.max(0,Math.floor(finite(pc.staffingSetWeek,week)));
  pc.productMixLevel=clamp(finite(pc.productMixLevel,0),0,1);
  pc.productMixSetWeek=Math.max(0,Math.floor(finite(pc.productMixSetWeek,week)));
  pc.underperformingRatio=clamp(finite(pc.underperformingRatio,0),0,1);
  pc.consolidatedRatio=clamp(finite(pc.consolidatedRatio,0),0,pc.underperformingRatio);
  pc.closedSiteCount=Math.max(0,Math.floor(finite(pc.closedSiteCount,0)));
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
  if(deal.status==='active'&&deal.portfolioCompany){
    // 買収時点で何割の拠点が不採算かは会社ごとの性質。案件IDから決定論的に決まり、
    // 一度決まったら変わらない（拠点再編で閉じられる上限そのものになる）。
    if(!Number.isFinite(Number(deal.portfolioCompany.underperformingRatio)))deal.portfolioCompany.underperformingRatio=between(UNDERPERFORMING_MIN,UNDERPERFORMING_MAX,'pe-underperforming',deal.id);
    normalizePortfolioCompany(deal.portfolioCompany,week);
  }
  return deal;
}
// 全ファンドの案件を正規化する（peFirm.funds[].deals[] のうち portfolioCompany を持つもの）。
// T17でproduction pathから取得される案件は5本柱系(businessID)とは限らないため、判定は
// businessIDではなく portfolioCompany の有無で行う。
function ensure(state){
  pf.ensure(state);
  const week=Math.max(0,Math.floor(finite(state.week,0)));
  for(const fund of state.peFirm.funds)for(const deal of arr(fund.deals))if(deal&&deal.portfolioCompany)ensureDeal(deal,week);
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
  const coinvestUsed=pf.recordCoinvestment(state,fund,plan.coinvestPortion);
  // T26-1: 呼び込んだ共同投資資本は、ここで売り手へ払われる（record だけでは原価にならない）。
  if(pf.spendCoinvestment(fund,coinvestUsed)!==coinvestUsed)throw new Error('共同投資poolの拠出額と取得支払額が一致しません。');
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
// 出店の増分（T20較正）。storeCount=1（買収したままの姿）が基準の1.0で、1店舗増えるごとに
// 元の会社のEBITDAの STORE_MARGINAL_EBITDA_SHARE ぶんだけ上乗せされる。
function storeScaleFactor(pc){return 1+Math.max(0,Math.floor(finite(pc?.storeCount,1))-1)*STORE_MARGINAL_EBITDA_SHARE;}
// レバーの効きが遅れて出てくる度合い（0=まだ出ていない、1=出きった）。
// delayWeeks 経つまでゼロ、その後 rampWeeks かけて線形に立ち上がる。決定論的で状態を持たない。
function delayedProgress(setWeek,week,delayWeeks,rampWeeks){
  const elapsed=finite(week)-finite(setWeek);
  if(elapsed<=delayWeeks)return 0;
  return clamp((elapsed-delayWeeks)/Math.max(1,rampWeeks),0,1);
}
// T18の6レバーが週次P&Lにどう効くかを1箇所にまとめた純関数（テストが個別に検証できるように
// 係数を返す）。attention倍率はここには入らない（processDealWeekのEBITDA計算で1回だけ乗る）。
function leverFactors(pc,week){
  // トップライン側
  const priceFactor=clamp(2-finite(pc.priceMultiplier,1),.3,1.6);
  const qualityFactor=1+clamp(finite(pc.qualityInvestment)/100,0,1)*QUALITY_MAX_REVENUE_GAIN;
  // 商品構成の刷新: 効果が出るまで2〜3年。プレイヤーが着手した週からの経過で立ち上がる。
  const mixProgress=clamp((finite(week)-finite(pc.productMixSetWeek,week))/PRODUCT_MIX_RAMP_WEEKS,0,1);
  const mixFactor=1+PRODUCT_MIX_MAX_GAIN*clamp(finite(pc.productMixLevel),0,1)*mixProgress;
  // 仕入れを削りすぎた副作用（品質低下→遅れて客数減）。安全水準までは副作用ゼロ。
  const procurementExcess=Math.max(0,clamp(finite(pc.procurementReform),0,1)-PROCUREMENT_SAFE_LEVEL)/Math.max(1e-9,1-PROCUREMENT_SAFE_LEVEL);
  const procurementDrag=PROCUREMENT_QUALITY_DRAG*procurementExcess*delayedProgress(pc.procurementSetWeek,week,PROCUREMENT_DELAY_WEEKS,PROCUREMENT_DRAG_RAMP_WEEKS);
  // 人を減らす・賃金を下げた副作用（サービス低下→遅れて客数減）。
  const headcountCut=Math.max(0,1-clamp(finite(pc.headcountRatio,1),HEADCOUNT_MIN,HEADCOUNT_MAX));
  const wageCut=Math.max(0,1-clamp(finite(pc.wageLevel,1),WAGE_MIN,WAGE_MAX));
  const laborDrag=(LABOR_SERVICE_DRAG*headcountCut+LABOR_WAGE_DRAG*wageCut)*delayedProgress(pc.staffingSetWeek,week,LABOR_DELAY_WEEKS,LABOR_DRAG_RAMP_WEEKS);
  const sideEffectFactor=clamp(1-procurementDrag-laborDrag,.2,1);
  // 拠点再編: 閉じた不採算分だけトップラインは落ちる。
  const consolidated=clamp(finite(pc.consolidatedRatio),0,1);
  const revenueFactor=priceFactor*qualityFactor*mixFactor*sideEffectFactor*(1-consolidated);
  // コスト側（即効）
  const procurementFactor=1+PROCUREMENT_EBITDA_GAIN*clamp(finite(pc.procurementReform),0,1);
  const payrollRatio=clamp(finite(pc.wageLevel,1),WAGE_MIN,WAGE_MAX)*clamp(finite(pc.headcountRatio,1),HEADCOUNT_MIN,HEADCOUNT_MAX);
  const laborFactor=Math.max(0,1+LABOR_EBITDA_GAIN*(1-payrollRatio));
  const consolidationFactor=1+CONSOLIDATION_EBITDA_GAIN*consolidated;
  const costFactor=procurementFactor*laborFactor*consolidationFactor;
  return {priceFactor,qualityFactor,mixFactor,mixProgress,procurementDrag,laborDrag,sideEffectFactor,revenueFactor,procurementFactor,laborFactor,consolidationFactor,costFactor};
}
function processDealWeek(fund,deal,week){
  const pc=deal.portfolioCompany;
  if(!pc||pc.lastProcessedWeek>=week)return;
  const annualEBITDA=finite(deal.enterpriseValue)/Math.max(1,finite(deal.acquisitionMultiple,8));
  // T9のattention（チーム人数÷案件数）を、EBITDA成長計算に1回だけ乗算する（Codex独立監査
  // 対応: 以前はteamCapacity/slotCapacityと並ぶT9の一角として計算されるだけで、実際の
  // 経営結果には一切接続されていなかった）。1件に手が回っていれば頭打ち(倍率1.0)、
  // 案件数に対してチームが薄いほど鈍る、という設計書§4の方向性をここで反映する。
  // T18の完了条件「attention倍率は全レバーに一度だけ乗る」: 乗算はこの1行だけで、
  // leverFactors 側には一切入らないため、レバーを増やしても二重適用にならない。
  const weeklyEBITDA=annualEBITDA/52*storeScaleFactor(pc)*pf.attentionMultiplier(fund);
  const lever=leverFactors(pc,week);
  const noise=between(.92,1.08,'pe-portfolio-week',deal.id,week);
  const upkeep=clamp(finite(pc.qualityInvestment)/100,0,1)*QUALITY_UPKEEP_RATE_OF_EBITDA*weeklyEBITDA;
  const weeklyProfit=weeklyEBITDA*lever.revenueFactor*lever.costFactor*noise-upkeep;
  pc.cash=finite(pc.cash)+weeklyProfit;
  pc.weeklyRevenue=weeklyEBITDA*lever.revenueFactor*noise*2;
  pc.weeklyProfit=weeklyProfit;
  pc.profitHistory=[...arr(pc.profitHistory),weeklyProfit].slice(-PROFIT_HISTORY_LIMIT);
  pc.improvementScore=computeImprovementScore(deal);
  pc.lastProcessedWeek=week;
}
function processPortfolioWeek(state,week){
  ensure(state);
  const w=Math.max(0,Math.floor(finite(week,state.week)));
  for(const fund of state.peFirm.funds)for(const deal of arr(fund.deals))if(deal&&deal.portfolioCompany&&deal.status==='active')processDealWeek(fund,deal,w);
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
  // 1点あたりの価格は企業価値に比例する（T20較正）。大きい会社の品質ほど上げるのに金がかかる。
  const costPerPoint=Math.max(1,QUALITY_COST_FRACTION_PER_POINT*Math.max(0,finite(deal.enterpriseValue)));
  pc.qualityInvestment=Math.min(100,pc.qualityInvestment+spend/costPerPoint);
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
// T18: 業界での評判（設計書§6.5 経路3 / js/pe-network.js）への接続。買収先の業種タグに
// 一致する reputation ノードの信頼度を上下させる。5本柱系はbusinessID、それ以外は帯(tierID)を
// 業種タグとして使う。
function industryTagOf(deal){return deal?.businessID||deal?.tierID||null;}
function adjustIndustryReputation(state,deal,delta){
  const network=modules.peNetwork;
  const tag=industryTagOf(deal);
  if(!network||!tag||!delta)return 0;
  network.ensure(state);
  let touched=0;
  for(const node of state.peNetwork.nodes.filter(n=>n.pathType==='reputation'&&n.industryTag===tag)){
    node.trust=clamp(finite(node.trust)+delta,0,100);
    touched++;
  }
  return touched;
}

// ---- T18 レバー3: 仕入れ・調達改革 ----------------------------------------------------------
// 原価率を下げる。即効でEBITDAが増えるが、安全水準を超えて削ると1年遅れて品質・客数に効く。
// 一時費用は買収先自身のcashから出る（会計分離）。水準は下げる方向にも動かせる。
function reformProcurement(state,fundID,dealID,level){
  const {deal}=findFundAndDeal(state,fundID,dealID);
  if(!deal||deal.status!=='active')return null;
  const pc=deal.portfolioCompany;
  const next=clamp(finite(level,pc.procurementReform),0,1);
  const increase=Math.max(0,next-finite(pc.procurementReform));
  const cost=increase*PROCUREMENT_COST_FRACTION*Math.max(0,finite(deal.enterpriseValue));
  if(cost>pc.cash)return null;
  pc.cash-=cost;
  pc.procurementReform=next;
  pc.procurementSetWeek=Math.max(0,Math.floor(finite(state.week,pc.procurementSetWeek)));
  return deal;
}

// ---- T18 レバー4: 人件費と人員 --------------------------------------------------------------
// EBITDAの最大項目。T4で「雇用・社名の維持」を約束した案件では人員削減そのものを禁止する
// （deal.employmentPromise は js/pe-acquisition.js が入札の受諾条件から引き継ぐ）。約束が無くても
// 人を減らせば業界の評判が下がる（経路3）。賃金水準の上下は約束の対象外。
function setStaffing(state,fundID,dealID,{wageLevel,headcountRatio}={}){
  const {deal}=findFundAndDeal(state,fundID,dealID);
  if(!deal||deal.status!=='active')return null;
  const pc=deal.portfolioCompany;
  const nextWage=clamp(finite(wageLevel,pc.wageLevel),WAGE_MIN,WAGE_MAX);
  const nextHeadcount=clamp(finite(headcountRatio,pc.headcountRatio),HEADCOUNT_MIN,HEADCOUNT_MAX);
  const cutsHeadcount=nextHeadcount<finite(pc.headcountRatio,1)-1e-9;
  if(cutsHeadcount&&deal.employmentPromise)return null; // 入札時に飲んだ約束による禁止
  const changed=cutsHeadcount||Math.abs(nextWage-finite(pc.wageLevel,1))>1e-9||Math.abs(nextHeadcount-finite(pc.headcountRatio,1))>1e-9;
  if(!changed)return deal;
  pc.wageLevel=nextWage;
  pc.headcountRatio=nextHeadcount;
  pc.staffingSetWeek=Math.max(0,Math.floor(finite(state.week,pc.staffingSetWeek)));
  if(cutsHeadcount)adjustIndustryReputation(state,deal,-REPUTATION_PENALTY_FOR_CUTS);
  return deal;
}

// ---- T18 レバー5: 商品構成の刷新 -------------------------------------------------------------
// トップライン側の唯一のレバー。効き始めるまで2〜3年（PRODUCT_MIX_RAMP_WEEKS）かかるので、
// Exitの3〜4年前までに仕込まないと間に合わない。着手した週から立ち上がりが始まる。
function renewProductMix(state,fundID,dealID,level){
  const {deal}=findFundAndDeal(state,fundID,dealID);
  if(!deal||deal.status!=='active')return null;
  const pc=deal.portfolioCompany;
  const next=clamp(finite(level,1),0,1);
  const increase=Math.max(0,next-finite(pc.productMixLevel));
  if(increase<=0)return null;
  const cost=increase*PRODUCT_MIX_COST_FRACTION*Math.max(0,finite(deal.enterpriseValue));
  if(cost>pc.cash)return null;
  pc.cash-=cost;
  pc.productMixLevel=next;
  pc.productMixSetWeek=Math.max(0,Math.floor(finite(state.week,pc.productMixSetWeek)));
  return deal;
}

// ---- T18 レバー6: 拠点再編（閉店を含む） -----------------------------------------------------
// 不採算拠点を閉じる。閉じられるのは買収時点の不採算比率(underperformingRatio)までで、
// 1回あたりその1/3。売上は落ちるが利益率は上がる（即効）。雇用維持の約束がある案件では
// 閉店できない。約束が無くても閉店すれば業界の評判が下がる。
function consolidateSites(state,fundID,dealID){
  const {deal}=findFundAndDeal(state,fundID,dealID);
  if(!deal||deal.status!=='active')return null;
  const pc=deal.portfolioCompany;
  if(deal.employmentPromise)return null; // 入札時に飲んだ約束による禁止
  const remaining=Math.max(0,finite(pc.underperformingRatio)-finite(pc.consolidatedRatio));
  if(remaining<=1e-9)return null; // 閉じるべき不採算拠点がもう無い
  const step=Math.min(remaining,finite(pc.underperformingRatio)*CONSOLIDATION_STEP);
  pc.consolidatedRatio=clamp(finite(pc.consolidatedRatio)+step,0,finite(pc.underperformingRatio));
  pc.closedSiteCount=Math.max(0,Math.floor(finite(pc.closedSiteCount)))+1;
  adjustIndustryReputation(state,deal,-REPUTATION_PENALTY_FOR_CUTS);
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
  // T23: Exit時の倍率拡大の幅。旧値は 0.7〜1.3 倍で、スコアが張り付くと常に1.3倍の
  // マルチプル拡大が乗っていた。上限を下げ、下限は上げる（上振れだけを抑え、最悪ケースは
  // 悪化させない ＝ 救済導線の前提を壊さない）。
  const exitMultiple=finite(deal.acquisitionMultiple,8)*(EXIT_MULTIPLE_FLOOR+score/100*EXIT_MULTIPLE_SCORE_SPAN);
  const annualEBITDA=finite(deal.enterpriseValue)/Math.max(1,finite(deal.acquisitionMultiple,8));
  // 買い手が払うのはExit時点の実力（T18の6レバーの結果）に対して。削りすぎて遅れて客数を
  // 失っていれば、その分そのまま売却価値が下がる — 経営の判断がExitで返ってくる。
  const w1=Math.max(0,Math.floor(finite(week,state.week)));
  const lever=leverFactors(pc,w1);
  // T23: 売却価格には売る時点の市況が乗る。買う側（案件の表面評価額）は既に同じ市況
  // （T11 marketPriceLevel）で決まっているので、これで市況が入口と出口の両方に対称に効く。
  // 不況期に買って好況期に売れば伸び、好況期に買って不況期に売れば縮む — 保有期間の判断が
  // そのままリターンの分散になる。分散の源であって、悪い方に平均を寄せるための係数ではない。
  const exitMarket=tiers.marketPriceLevel(finite(state.economy,1));
  const exitEV=annualEBITDA*storeScaleFactor(pc)*lever.revenueFactor*lever.costFactor*exitMultiple*exitMarket;
  const proceeds=Math.max(0,exitEV+pc.cash);
  // T17: 回収額はそのまま fund.distributed に足すのではなく、ウォーターフォール
  // （元本返済 → ハードル → キャリー → 分配）を通す。共同投資分は共同投資家へ返り、
  // GPのキャリーは個人資産に入る（js/pe-fund.js settleExitProceeds）。
  const settlement=pf.settleExitProceeds(state,fund,deal,proceeds,w1);
  deal.status='exited';
  deal.exitedWeek=w1;
  deal.exitMethod=method;
  deal.exitProceeds=proceeds;
  deal.exitScore=score;
  deal.exitMarketLevel=exitMarket;
  deal.exitSettlement=settlement;
  if(cutEmployees)adjustIndustryReputation(state,deal,-REPUTATION_PENALTY_FOR_CUTS);
  else if(score>=REPUTATION_THRESHOLD)adjustIndustryReputation(state,deal,REPUTATION_BONUS);
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
  PROFIT_HISTORY_LIMIT,EXPANSION_COST_FRACTION,
  BASELINE_SCORE,PROFIT_SCORE_WEIGHT,QUALITY_SCORE_WEIGHT,PROFIT_SCORE_EV_FRACTION,QUALITY_MAX_REVENUE_GAIN,EXIT_MULTIPLE_FLOOR,EXIT_MULTIPLE_SCORE_SPAN,
  REPUTATION_THRESHOLD,REPUTATION_BONUS,REPUTATION_PENALTY_FOR_CUTS,
  QUALITY_UPKEEP_RATE_OF_EBITDA,QUALITY_COST_FRACTION_PER_POINT,STORE_MARGINAL_EBITDA_SHARE,storeScaleFactor,
  PROCUREMENT_EBITDA_GAIN,PROCUREMENT_SAFE_LEVEL,PROCUREMENT_QUALITY_DRAG,PROCUREMENT_DELAY_WEEKS,PROCUREMENT_DRAG_RAMP_WEEKS,PROCUREMENT_COST_FRACTION,
  LABOR_EBITDA_GAIN,LABOR_SERVICE_DRAG,LABOR_WAGE_DRAG,LABOR_DELAY_WEEKS,LABOR_DRAG_RAMP_WEEKS,WAGE_MIN,WAGE_MAX,HEADCOUNT_MIN,HEADCOUNT_MAX,
  PRODUCT_MIX_RAMP_WEEKS,PRODUCT_MIX_MAX_GAIN,PRODUCT_MIX_COST_FRACTION,
  CONSOLIDATION_STEP,CONSOLIDATION_EBITDA_GAIN,UNDERPERFORMING_MIN,UNDERPERFORMING_MAX,
  ensure,findFundAndDeal,defaultPortfolioCompany,normalizePortfolioCompany,acquirePillarCompany,computeImprovementScore,processDealWeek,processPortfolioWeek,
  setPriceMultiplier,investQuality,expandPortfolioStore,exitPortfolioCompany,install,
  delayedProgress,leverFactors,industryTagOf,adjustIndustryReputation,
  reformProcurement,setStaffing,renewProductMix,consolidateSites,
  __installed:true
});
})();
