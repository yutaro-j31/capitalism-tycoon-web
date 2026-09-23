// Script boundary: js/pe-deal-supply.js (classic JavaScript)
//
// PE mode T16 (docs/PE_MODE_TASKS.md): the first half of the production path. Until now T11's
// generateAnnualDeals() and T10's consumeDDSlot() were callable functions that nothing in the
// running game ever reached (Codex audit PE-AUDIT-002/004). This file wires both into the real
// weekly engine:
//
//   1. 案件供給: every 13th week (4 per year, 設計書 課題3「案件数は年4件で固定」) one of that
//      year's four generated deals is materialised into state.acquisitionTargets, so the whole
//      existing ma-deal-room machinery (openMADealRoom / DD / indication / final_bid /
//      submitMAOffer / DEAL_DEADLINE_STATUSES) operates on it unchanged. Deals are filtered by
//      T11's eligibleTiers() against the fund actually investing right now, so fund scale
//      decides which 帯 shows up.
//   2. DD枠: startMADueDiligence gains an optional third argument (fundID). For a PE-supplied
//      target it is REQUIRED, the fund must be in its investment period, and a yearly DD slot
//      (T10) is consumed -- consumed if and only if the underlying DD actually started.
//
// PE targets are marked with peTierID and are preserved across generateMATargets() (which
// replaces the ordinary candidate list wholesale), so the two supplies never clobber each other.
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine module must load before pe-deal-supply.js.');
if(!modules?.peFund)throw new Error('Capitalism Tycoon peFund module must load before pe-deal-supply.js.');
if(!modules?.peIndustryTiers)throw new Error('Capitalism Tycoon peIndustryTiers module must load before pe-deal-supply.js.');
if(!modules?.maDealRoom)throw new Error('Capitalism Tycoon maDealRoom module must load before pe-deal-supply.js.');
if(modules.peDealSupply)throw new Error('Capitalism Tycoon peDealSupply module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const pf=modules.peFund,tiers=modules.peIndustryTiers,dealRoom=modules.maDealRoom;

const network=modules.peNetwork;

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,finite(v,min)));
const arr=v=>Array.isArray(v)?v:[];

// Same deterministic FNV-1a hash as js/ma-deal-room.js / js/pe-industry-tiers.js.
function hash(parts){let h=2166136261;String(parts.join('|')).split('').forEach(c=>{h^=c.charCodeAt(0);h=Math.imul(h,16777619);});return h>>>0;}
function unit(...p){return hash(p)/4294967295;}
function between(a,b,...p){return a+(b-a)*unit(...p);}

// 年4件（52週 ÷ 13週）。四半期ごとに1件ずつ出すことで、DD枠(年3件〜)と同時進行案件数の
// 両方が実際に効く供給ペースになる。
const SUPPLY_INTERVAL_WEEKS=13;
// 供給から失効までの検討期間。openMADealRoom は deadlineWeek を week+16 で頭打ちにするので、
// 「案件が板に載っている期間」としてはこれで十分な余裕がある。
const TARGET_LIFETIME_WEEKS=26;
// 同時に板へ載るPE案件の上限（CLAUDE.md の配列上限方針）。
const MAX_PE_TARGETS=8;
const NETWORK_REFERRAL_TRUST_THRESHOLD=80;
const NETWORK_REFERRAL_SEARCH_ATTEMPTS=8;
const NETWORK_REFERRAL_SEED_OFFSET=1000;
const NETWORK_REFERRAL_MIN_COMPETITION_MULTIPLIER=.25;
// Proprietary sourcing: player-initiated outreach to a company that is not currently for sale.
// It consumes one of the canonical weekly network actions, then takes a full quarter to resolve.
// Trust improves success probability, but even the best long-term relationship is capped below
// 50% so this never becomes a deterministic extra-deal button.
const PROPRIETARY_TRUST_THRESHOLD=20;
const PROPRIETARY_OUTREACH_WEEKS=13;
const PROPRIETARY_READY_GRACE_WEEKS=13;
const PROPRIETARY_MAX_ACTIVE=3;
const PROPRIETARY_HISTORY_LIMIT=24;
const PROPRIETARY_SEARCH_ATTEMPTS=12;
const PROPRIETARY_SEED_OFFSET=4000;
const PROPRIETARY_BASE_SUCCESS=.10;
const PROPRIETARY_TRUST_SUCCESS_SPAN=.25;
const PROPRIETARY_LONG_TERM_BONUS=.10;
const PROPRIETARY_MAX_SUCCESS=.45;
// T19: 独占案件（設計書§5「3つの入り口」の3つ目）。人脈ノードが持ち込んだ案件は競争入札に
// ならないぶん安く買える。割引はこのファイル独自の較正（設計書は「独占＝競らずに買える」と
// しか書いていない）。独占が発生する確率そのものは js/pe-network.js の monopolyProbability()
// が持ち、1案件あたり MAX_MONOPOLY_SHARE(40%) を超えない。
const MONOPOLY_PRICE_DISCOUNT=.12;

// 5本柱系（T11 pillar帯）の businessID → 表示名・ドメイン。
const PILLAR_LABELS=Object.freeze({
  ramen:Object.freeze({name:'ラーメンチェーン',domain:'外食'}),
  conveni:Object.freeze({name:'コンビニチェーン',domain:'小売'}),
  gym:Object.freeze({name:'フィットネスチェーン',domain:'ヘルスケア'}),
  realEstateAgency:Object.freeze({name:'不動産仲介',domain:'不動産'}),
  productVentures:Object.freeze({name:'受託開発・SaaS',domain:'IT'})
});
// 非5本柱帯の業種プール（設計書§15 の各帯の説明そのまま）。
const TIER_INDUSTRIES=Object.freeze({
  smallSuccession:Object.freeze([['食品加工','製造'],['金属精密加工','製造'],['包装資材','製造'],['専門商社','商社'],['ビルメンテナンス','サービス'],['地場物流','物流']]),
  midCap:Object.freeze([['地域スーパー','小売'],['調剤薬局チェーン','ヘルスケア'],['介護・保育','ヘルスケア'],['人材派遣','サービス'],['ITサポート','IT'],['住宅設備','製造']]),
  largeCap:Object.freeze([['素材メーカー','製造'],['化学プラント','製造'],['機械部品','製造'],['通信インフラ','通信'],['エネルギー関連','エネルギー']])
});
const NAME_PREFIXES=Object.freeze(['第一','中央','日本','東洋','新和','大成','あけぼの','光洋']);

function isPETarget(t){return Boolean(t&&t.peTierID);}
// 投資期間中のファンド（新規取得ができるのはこれだけ）。複数あれば最新のものを使う。
function activeInvestingFunds(state){return arr(state?.peFirm?.funds).filter(f=>f?.status==='investing');}
function activeInvestingFund(state){
  const funds=activeInvestingFunds(state);
  return funds.length?funds[funds.length-1]:null;
}
function eligibleTierSetForFunds(funds){
  const eligible=new Set();
  for(const fund of arr(funds))for(const id of tiers.eligibleTiers(fund))eligible.add(id);
  return eligible;
}
function eligibleInvestingFundsForTarget(state,target){
  if(!isPETarget(target))return [];
  return activeInvestingFunds(state).filter(fund=>tiers.eligibleTiers(fund).includes(target.peTierID));
}

function ensure(state){
  if(!state)return state;
  pf.ensure(state);
  state.acquisitionTargets=arr(state.acquisitionTargets);
  state.peFirm.lastDealSupplyWeek=Math.max(0,Math.floor(finite(state.peFirm.lastDealSupplyWeek,0)));
  state.peFirm.proprietarySourcing=arr(state.peFirm.proprietarySourcing).slice(-PROPRIETARY_HISTORY_LIMIT).map(row=>({
    id:String(row?.id||''),nodeID:String(row?.nodeID||''),sourceType:String(row?.sourceType||'人脈'),
    sourcePathType:String(row?.sourcePathType||'referrer'),sourceTrust:clamp(finite(row?.sourceTrust),0,100),
    startedWeek:Math.max(0,Math.floor(finite(row?.startedWeek))),responseWeek:Math.max(0,Math.floor(finite(row?.responseWeek))),
    readyDeadlineWeek:Math.max(0,Math.floor(finite(row?.readyDeadlineWeek,row?.responseWeek))),
    dealYear:Math.max(0,Math.floor(finite(row?.dealYear))),dealIndex:Math.max(0,Math.floor(finite(row?.dealIndex))),
    tierID:String(row?.tierID||''),status:['pending','ready','success','declined'].includes(row?.status)?row.status:'pending',
    successProbability:clamp(finite(row?.successProbability),0,PROPRIETARY_MAX_SUCCESS),outcomeRoll:clamp(finite(row?.outcomeRoll),0,1),
    resolvedWeek:row?.resolvedWeek===null||row?.resolvedWeek===undefined?null:Math.max(0,Math.floor(finite(row.resolvedWeek))),
    targetID:row?.targetID?String(row.targetID):null,reason:row?.reason?String(row.reason):null
  }));
  const d=state.peFirm.lastSourcingCycle;
  state.peFirm.lastSourcingCycle=d&&typeof d==='object'?{
    week:Math.max(0,Math.floor(finite(d.week))),outcome:String(d.outcome||'unknown'),
    investingFundCount:Math.max(0,Math.floor(finite(d.investingFundCount))),eligibleTierCount:Math.max(0,Math.floor(finite(d.eligibleTierCount))),
    boardCountBefore:Math.max(0,Math.floor(finite(d.boardCountBefore))),boardCountAfter:Math.max(0,Math.floor(finite(d.boardCountAfter))),
    generatedDealID:d.generatedDealID?String(d.generatedDealID):null,tierID:d.tierID?String(d.tierID):null,primaryEligible:Boolean(d.primaryEligible),
    monopolyCandidateCount:Math.max(0,Math.floor(finite(d.monopolyCandidateCount))),highestMonopolyProbability:clamp(finite(d.highestMonopolyProbability),0,1),
    highestMonopolyNodeID:d.highestMonopolyNodeID?String(d.highestMonopolyNodeID):null,highestMonopolySourceType:d.highestMonopolySourceType?String(d.highestMonopolySourceType):null,
    winningMonopolyNodeID:d.winningMonopolyNodeID?String(d.winningMonopolyNodeID):null,
    primaryTargetID:d.primaryTargetID?String(d.primaryTargetID):null,primaryChannel:d.primaryChannel?String(d.primaryChannel):null,
    referralTargetID:d.referralTargetID?String(d.referralTargetID):null,referralChannel:d.referralChannel?String(d.referralChannel):null
  }:null;
  return state;
}

// T11の案件（企業価値・取得倍率・市況）を、既存のM&A候補（acquisitionTarget）の形へ
// 決定論的に写像する。売上・利益率・成長率・リスク・シナジーはこのファイル独自の較正だが、
// すべて deal.id 由来のハッシュなので同一seedなら完全に一致する。
function buildTargetFromDeal(deal,week){
  const seed=String(deal?.id||'');
  const label=deal.businessID
    ?(PILLAR_LABELS[deal.businessID]||{name:'事業会社',domain:'その他'})
    :(()=>{const pool=TIER_INDUSTRIES[deal.tierID]||TIER_INDUSTRIES.midCap;const [name,domain]=pool[hash(['pe-target-industry',seed])%pool.length];return {name,domain};})();
  const prefix=NAME_PREFIXES[hash(['pe-target-prefix',seed])%NAME_PREFIXES.length];
  const distressed=Boolean(deal.distressed);
  const annualEBITDA=finite(deal.enterpriseValue)/Math.max(1,finite(deal.acquisitionMultiple,8));
  // 不況期は「傷んだ案件が安く出る」（設計書 課題3）: 利益も利益率も落ちる。
  const operatingProfit=annualEBITDA*(distressed?between(.30,.70,'pe-target-profit',seed):between(.90,1.15,'pe-target-profit',seed));
  const margin=distressed?between(.01,.05,'pe-target-margin',seed):between(.05,.14,'pe-target-margin',seed);
  const sales=Math.max(operatingProfit/Math.max(margin,.005),finite(deal.enterpriseValue)*.2);
  return {
    id:`pe-target-${seed}`,
    name:`${prefix}${label.name}`,
    domain:label.domain,
    // 市況は価格に出る（T11の priceLevel）。表面評価額＝企業価値×価格水準。
    valuation:finite(deal.enterpriseValue)*clamp(finite(deal.priceLevel,1),.5,2),
    sales,
    operatingProfit,
    growth:distressed?between(-.05,.06,'pe-target-growth',seed):between(.04,.22,'pe-target-growth',seed),
    risk:distressed?between(.22,.38,'pe-target-risk',seed):between(.06,.22,'pe-target-risk',seed),
    // 5本柱系は買収後に自分で経営できる分シナジーが高い（設計書§15 Tier1）。
    synergy:deal.businessID?between(.10,.20,'pe-target-synergy',seed):between(.02,.12,'pe-target-synergy',seed),
    friendly:unit('pe-target-friendly',seed)>.25,
    expiresWeek:week+TARGET_LIFETIME_WEEKS,
    // 設計書§5の3つの入り口。T16では全件が広域オークション。限定入札・独占案件はT19で
    // 人脈（js/pe-network.js）から供給される。
    dealChannel:'auction',
    // ここから下がPE案件の目印。peTierID の有無が isPETarget の判定そのもの。
    peTierID:deal.tierID,
    peDealID:deal.id,
    peBusinessID:deal.businessID||null,
    peEnterpriseValue:finite(deal.enterpriseValue),
    peAcquisitionMultiple:finite(deal.acquisitionMultiple,8),
    peLeverage:finite(deal.leverage,1),
    peSkillMultiplier:finite(deal.skillMultiplier),
    peSuppliedWeek:week
  };
}

// 失効したPE案件を板から下ろす。進行中のディールが紐づいているものは、
// ma-deal-room 側の processDealWeek が対象を引けなくなって案件が宙に浮くため、絶対に消さない
// （期限切れの終端化は既存の DEAL_DEADLINE_STATUSES に任せる）。
function prunePETargets(state,week){
  const before=state.acquisitionTargets.length;
  state.acquisitionTargets=state.acquisitionTargets.filter(t=>!isPETarget(t)||t.activeDealID||finite(t.expiresWeek,Infinity)>=week);
  const live=state.acquisitionTargets.filter(isPETarget);
  if(live.length>MAX_PE_TARGETS){
    const drop=new Set(live.filter(t=>!t.activeDealID).slice(0,live.length-MAX_PE_TARGETS));
    if(drop.size)state.acquisitionTargets=state.acquisitionTargets.filter(t=>!drop.has(t));
  }
  return before-state.acquisitionTargets.length;
}

// 週次の案件供給。SUPPLY_INTERVAL_WEEKS ごとに、その年の4件のうち1件を板へ載せる。
// 投資期間中のファンドが無い、帯が今のファンド規模に合わない、板が上限に達している場合は
// 何も供給しない（いずれも設計書の「ファンド規模に応じて打てる帯が変わる」に沿う）。
function strongestReferralSource(state){
  if(!network)return null;
  network.ensure(state);
  return [...state.peNetwork.nodes]
    .filter(node=>finite(node?.trust)>=NETWORK_REFERRAL_TRUST_THRESHOLD)
    .sort((a,b)=>finite(b.trust)-finite(a.trust)||String(a.id).localeCompare(String(b.id)))[0]||null;
}
function referralTrustProgress(source){
  return clamp((finite(source?.trust)-NETWORK_REFERRAL_TRUST_THRESHOLD)/(100-NETWORK_REFERRAL_TRUST_THRESHOLD),0,1);
}
function referralInspectionCount(source){
  return 1+Math.floor(referralTrustProgress(source)*(NETWORK_REFERRAL_SEARCH_ATTEMPTS-1)+1e-9);
}
function referralCompetitionMultiplier(trust){
  const p=clamp((finite(trust)-NETWORK_REFERRAL_TRUST_THRESHOLD)/(100-NETWORK_REFERRAL_TRUST_THRESHOLD),0,1);
  return 1-p*(1-NETWORK_REFERRAL_MIN_COMPETITION_MULTIPLIER);
}
function referralQualityScore(deal,week){
  if(!deal)return -Infinity;
  const target=buildTargetFromDeal(deal,week);
  return finite(target.growth)*2+finite(target.synergy)-finite(target.risk)*1.25;
}
function referralCandidates(state,fundOrFunds,week){
  const funds=Array.isArray(fundOrFunds)?fundOrFunds:[fundOrFunds].filter(Boolean);
  const year=Math.floor(week/52),quarter=Math.floor((week%52)/SUPPLY_INTERVAL_WEEKS),eligible=eligibleTierSetForFunds(funds);
  const priceLevel=tiers.marketPriceLevel(finite(state?.economy,1)),distressed=finite(state?.economy,1)<1,out=[];
  for(let attempt=0;attempt<NETWORK_REFERRAL_SEARCH_ATTEMPTS;attempt++){
    const index=NETWORK_REFERRAL_SEED_OFFSET+quarter*NETWORK_REFERRAL_SEARCH_ATTEMPTS+attempt;
    const deal={...tiers.generateDeal(year,index),priceLevel,distressed};
    if(eligible.has(deal.tierID))out.push(deal);
  }
  return out;
}
function buildReferralDeal(state,fund,week,source){
  if(!source)return null;
  const candidates=referralCandidates(state,fund,week);
  if(!candidates.length)return null;
  const baseline=candidates[0],limit=Math.min(candidates.length,referralInspectionCount(source));
  if(limit<=1)return baseline;
  // High Trust means access to more introductions, not a hidden numerical buff to the company.
  // From the expanded deterministic pool choose only candidates that are at least as large as
  // the old baseline, then maximize the existing growth/synergy/risk fundamentals. Because the
  // baseline itself remains in the set, higher Trust can never make the referral smaller or lower
  // quality than the Trust-80 behavior.
  const pool=candidates.slice(0,limit).filter(deal=>finite(deal.enterpriseValue)>=finite(baseline.enterpriseValue));
  return pool.reduce((best,deal)=>{
    const q=referralQualityScore(deal,week),bq=referralQualityScore(best,week);
    if(q!==bq)return q>bq?deal:best;
    if(finite(deal.enterpriseValue)!==finite(best.enterpriseValue))return finite(deal.enterpriseValue)>finite(best.enterpriseValue)?deal:best;
    return String(deal.id).localeCompare(String(best.id))<0?deal:best;
  },baseline);
}
function proprietarySuccessProbability(source){
  const trust=clamp(finite(source?.trust),0,100);
  if(trust<PROPRIETARY_TRUST_THRESHOLD)return 0;
  const progress=clamp((trust-PROPRIETARY_TRUST_THRESHOLD)/(100-PROPRIETARY_TRUST_THRESHOLD),0,1);
  const pathBonus=source?.pathType==='longTermCultivation'?PROPRIETARY_LONG_TERM_BONUS:0;
  return Math.min(PROPRIETARY_MAX_SUCCESS,PROPRIETARY_BASE_SUCCESS+PROPRIETARY_TRUST_SUCCESS_SPAN*progress+pathBonus);
}
function proprietaryCandidate(state,funds,week,source){
  const eligible=eligibleTierSetForFunds(funds);
  if(!eligible.size)return null;
  const year=Math.floor(Math.max(0,finite(week))/52);
  const base=PROPRIETARY_SEED_OFFSET+(hash(['pe-proprietary-candidate',source?.id||'',Math.floor(finite(week))])%10000)*PROPRIETARY_SEARCH_ATTEMPTS;
  for(let attempt=0;attempt<PROPRIETARY_SEARCH_ATTEMPTS;attempt++){
    const index=base+attempt,deal=tiers.generateDeal(year,index);
    if(eligible.has(deal.tierID))return {dealYear:year,dealIndex:index,tierID:deal.tierID};
  }
  return null;
}
function activeProprietarySourcing(state){
  return arr(state?.peFirm?.proprietarySourcing).filter(row=>row?.status==='pending'||row?.status==='ready');
}
function startProprietarySourcing(state,nodeID,week){
  if(!state||!network)return {ok:false,reason:'network-unavailable',message:'人脈機能を利用できません。'};
  const w=Math.max(0,Math.floor(finite(week,state.week))),rawNodes=arr(state?.peNetwork?.nodes).slice(-Math.max(1,Math.floor(finite(network.MAX_NODES,100)))),node=rawNodes.find(row=>row?.id===nodeID);
  if(!node)return {ok:false,reason:'node-not-found',message:'人脈が見つかりません。'};
  if(finite(node.trust)<PROPRIETARY_TRUST_THRESHOLD)return {ok:false,reason:'trust',message:`非売却企業への打診にはTrust ${PROPRIETARY_TRUST_THRESHOLD}以上が必要です。`};
  const funds=activeInvestingFunds(state);
  if(!funds.length)return {ok:false,reason:'fund',message:'投資期間中のファンドがありません。'};
  const active=arr(state?.peFirm?.proprietarySourcing).filter(row=>row?.status==='pending'||row?.status==='ready');
  if(active.length>=PROPRIETARY_MAX_ACTIVE)return {ok:false,reason:'capacity',message:'同時に進められるProprietary Sourcingは3件までです。'};
  if(active.some(row=>row.nodeID===nodeID))return {ok:false,reason:'duplicate',message:'この人脈からはすでに案件化を進めています。'};
  const candidate=proprietaryCandidate(state,funds,w,node);
  if(!candidate)return {ok:false,reason:'tier',message:'現在のファンド規模で打診できる企業候補がありません。'};
  const used=finite(state?.peNetwork?.weeklyActionsWeek)===w?Math.max(0,Math.floor(finite(state?.peNetwork?.weeklyActionsUsed))):0;
  if(used>=finite(network.WEEKLY_ACTIONS,2))return {ok:false,reason:'actions',message:'今週の人脈アクションを使い切りました。'};
  // All failure conditions above are read-only. Normalize/consume only after the action is known
  // to be executable, preserving the repository's failed-action atomicity convention.
  ensure(state);network.ensure(state);
  const liveNode=state.peNetwork.nodes.find(row=>row?.id===nodeID);
  if(!liveNode||!network.consumeWeeklyAction?.(state,w))return {ok:false,reason:'actions',message:'今週の人脈アクションを使い切りました。'};
  liveNode.lastContactWeek=w;
  const sourceNode=liveNode;
  const successProbability=proprietarySuccessProbability(sourceNode);
  const id=`pe-proprietary-${sourceNode.id}-w${w}-i${candidate.dealIndex}`;
  const campaign={
    id,nodeID:sourceNode.id,sourceType:String(sourceNode.sourceType||'人脈'),sourcePathType:String(sourceNode.pathType||'referrer'),
    sourceTrust:finite(sourceNode.trust),startedWeek:w,responseWeek:w+PROPRIETARY_OUTREACH_WEEKS,
    readyDeadlineWeek:w+PROPRIETARY_OUTREACH_WEEKS+PROPRIETARY_READY_GRACE_WEEKS,
    dealYear:candidate.dealYear,dealIndex:candidate.dealIndex,tierID:candidate.tierID,status:'pending',
    successProbability,outcomeRoll:unit('pe-proprietary-outcome',id),resolvedWeek:null,targetID:null,reason:null
  };
  state.peFirm.proprietarySourcing.push(campaign);
  state.peFirm.proprietarySourcing=state.peFirm.proprietarySourcing.slice(-PROPRIETARY_HISTORY_LIMIT);
  return {ok:true,campaign};
}
function proprietaryDealForCampaign(state,campaign){
  const raw=tiers.generateDeal(campaign.dealYear,campaign.dealIndex);
  return {...raw,priceLevel:tiers.marketPriceLevel(finite(state?.economy,1)),distressed:finite(state?.economy,1)<1};
}
function processProprietarySourcingWeek(state,week){
  ensure(state);
  const w=Math.max(0,Math.floor(finite(week,state.week))),resolved=[];
  for(const campaign of state.peFirm.proprietarySourcing){
    if(campaign.status==='pending'&&w>=campaign.responseWeek){
      if(campaign.outcomeRoll>=campaign.successProbability){
        campaign.status='declined';campaign.resolvedWeek=w;campaign.reason='owner-declined';resolved.push(campaign);continue;
      }
      campaign.status='ready';campaign.reason=null;
    }
    if(campaign.status!=='ready')continue;
    if(w>campaign.readyDeadlineWeek){
      campaign.status='declined';campaign.resolvedWeek=w;campaign.reason='window-expired';resolved.push(campaign);continue;
    }
    const deal=proprietaryDealForCampaign(state,campaign);
    const eligibleFunds=activeInvestingFunds(state).filter(fund=>tiers.eligibleTiers(fund).includes(deal.tierID));
    if(!eligibleFunds.length||state.acquisitionTargets.filter(isPETarget).length>=MAX_PE_TARGETS)continue;
    const source={id:campaign.nodeID,pathType:campaign.sourcePathType,trust:campaign.sourceTrust};
    const target=addSuppliedTarget(state,deal,w,{channel:'proprietary',source,sourceTrust:campaign.sourceTrust,proprietaryID:campaign.id});
    if(!target)continue;
    campaign.status='success';campaign.resolvedWeek=w;campaign.targetID=target.id;campaign.reason=null;resolved.push(campaign);
  }
  return resolved;
}

function addSuppliedTarget(state,deal,week,{channel='auction',source=null,sourceTrust=null,allowMonopoly=false,proprietaryID=null}={}){
  if(!deal||state.acquisitionTargets.filter(isPETarget).length>=MAX_PE_TARGETS)return null;
  const target=buildTargetFromDeal(deal,week);
  if(state.acquisitionTargets.some(t=>t?.id===target.id))return null;
  if(channel==='proprietary'&&source){
    const trustAtSupply=clamp(sourceTrust===null||sourceTrust===undefined?finite(source.trust):finite(sourceTrust,source.trust),0,100);
    target.dealChannel='proprietary';
    target.peSourceNodeID=source.id;
    target.peSourcePathType=source.pathType;
    target.peSourceTrustAtSupply=trustAtSupply;
    target.peNetworkAccess='exclusive';
    target.peCompetitionMultiplier=0;
    target.peProprietarySourcingID=proprietaryID?String(proprietaryID):null;
    target.friendly=true;
  }else if(channel==='network-referral'&&source){
    const trustAtSupply=clamp(sourceTrust===null||sourceTrust===undefined?finite(source.trust):finite(sourceTrust,source.trust),0,100);
    target.dealChannel='network-referral';
    target.peSourceNodeID=source.id;
    target.peSourcePathType=source.pathType;
    target.peSourceTrustAtSupply=trustAtSupply;
    target.peNetworkQualityScore=referralQualityScore(deal,week);
    target.peCompetitionMultiplier=referralCompetitionMultiplier(trustAtSupply);
    target.peNetworkAccess=trustAtSupply>=90?'limited-auction':'referral';
    target.friendly=true;
    // Reuse the canonical monopoly probability/cost instead of inventing a second exclusivity
    // system. A winning roll turns this referral into true exclusivity (zero rival probability)
    // while keeping dealChannel=network-referral so sourcing attribution remains intact.
    if(network?.monopolyProbability?.(source)>0&&network.rollMonopolySourcing(state,source.id,week,`referral:${deal.id}`)){
      target.peExclusiveReferral=true;
      target.peNetworkAccess='exclusive';
      target.peCompetitionMultiplier=0;
      target.valuation=finite(target.valuation)*(1-MONOPOLY_PRICE_DISCOUNT);
    }
  }else if(allowMonopoly){
    const monopolySource=rollMonopolySource(state,deal,week);
    if(monopolySource){
      target.dealChannel='monopoly';
      target.peSourceNodeID=monopolySource.id;
      target.peSourcePathType=monopolySource.pathType;
      target.peSourceTrustAtSupply=clamp(finite(monopolySource.trust)+finite(network?.MONOPOLY_TRUST_COST),0,100);
      target.peNetworkAccess='exclusive';
      target.peCompetitionMultiplier=0;
      target.valuation=finite(target.valuation)*(1-MONOPOLY_PRICE_DISCOUNT);
      target.friendly=true;
    }
  }
  state.acquisitionTargets.push(target);
  dealRoom.initializeTarget?.(target,state);
  return target;
}

function processSupplyWeek(state,week){
  ensure(state);
  const w=Math.max(0,Math.floor(finite(week,state.week)));
  if(state.peFirm.lastDealSupplyWeek>=w)return null;
  state.peFirm.lastDealSupplyWeek=w;
  prunePETargets(state,w);
  if(w%SUPPLY_INTERVAL_WEEKS!==1)return null;

  const boardCountBefore=state.acquisitionTargets.filter(isPETarget).length;
  const funds=activeInvestingFunds(state);
  const monopolySources=arr(state?.peNetwork?.nodes).map(node=>({
    id:String(node?.id||''),sourceType:String(node?.sourceType||'人脈'),probability:Math.max(0,finite(network?.monopolyProbability?.(node)))
  })).filter(row=>row.probability>0).sort((a,b)=>b.probability-a.probability||a.id.localeCompare(b.id));
  const diagnostic={
    week:w,outcome:'unknown',investingFundCount:funds.length,eligibleTierCount:0,
    boardCountBefore,boardCountAfter:boardCountBefore,generatedDealID:null,tierID:null,primaryEligible:false,
    monopolyCandidateCount:monopolySources.length,highestMonopolyProbability:monopolySources[0]?.probability||0,
    highestMonopolyNodeID:monopolySources[0]?.id||null,highestMonopolySourceType:monopolySources[0]?.sourceType||null,
    winningMonopolyNodeID:null,primaryTargetID:null,primaryChannel:null,referralTargetID:null,referralChannel:null
  };
  if(!funds.length){
    diagnostic.outcome='no-fund';
    state.peFirm.lastSourcingCycle=diagnostic;
    return null;
  }

  // Multi-fund desk: deal supply is filtered against the union of every currently investing
  // fund instead of silently using only the newest fund. A later DD action chooses the exact
  // investing vehicle and that fundID stays attached through acquisition.
  const referralSource=strongestReferralSource(state);
  const referralTrustAtCycle=referralSource?finite(referralSource.trust):null;
  const eligible=eligibleTierSetForFunds(funds);
  diagnostic.eligibleTierCount=eligible.size;
  const deals=tiers.generateAnnualDeals(state,Math.floor(w/52));
  const deal=deals[Math.floor((w%52)/SUPPLY_INTERVAL_WEEKS)];
  diagnostic.generatedDealID=deal?.id?String(deal.id):null;
  diagnostic.tierID=deal?.tierID?String(deal.tierID):null;
  diagnostic.primaryEligible=Boolean(deal&&eligible.has(deal.tierID));

  let primary=null;
  if(deal&&eligible.has(deal.tierID))primary=addSuppliedTarget(state,deal,w,{allowMonopoly:true});

  let referral=null;
  if(referralSource&&state.acquisitionTargets.filter(isPETarget).length<MAX_PE_TARGETS){
    // The referral candidate pool is also the union of all investing funds, so a mature Fund I
    // harvesting alongside Fund II/III never suppresses a valid opportunity for another vehicle.
    const referralDeal=buildReferralDeal(state,funds,w,{...referralSource,trust:referralTrustAtCycle});
    referral=addSuppliedTarget(state,referralDeal,w,{channel:'network-referral',source:referralSource,sourceTrust:referralTrustAtCycle});
  }

  diagnostic.primaryTargetID=primary?.id?String(primary.id):null;
  diagnostic.primaryChannel=primary?.dealChannel?String(primary.dealChannel):null;
  diagnostic.referralTargetID=referral?.id?String(referral.id):null;
  diagnostic.referralChannel=referral?.dealChannel?String(referral.dealChannel):null;
  diagnostic.winningMonopolyNodeID=primary?.dealChannel==='monopoly'&&primary?.peSourceNodeID?String(primary.peSourceNodeID):null;
  diagnostic.boardCountAfter=state.acquisitionTargets.filter(isPETarget).length;
  diagnostic.outcome=primary?.dealChannel==='monopoly'?'monopoly-won'
    :referral?.peNetworkAccess==='exclusive'?'referral-exclusive'
    :boardCountBefore>=MAX_PE_TARGETS?'board-full'
    :!diagnostic.primaryEligible?'tier-mismatch'
    :diagnostic.monopolyCandidateCount>0&&primary?'monopoly-missed'
    :primary?'auction'
    :referral?'referral-only'
    :'no-deal';
  state.peFirm.lastSourcingCycle=diagnostic;
  return primary||referral;
}

// PE案件のDDに使うファンドの妥当性検査（T17の取得もこの判定を再利用できるよう関数に出す）。
// T19: この週の案件を、人脈経由の独占案件として持ち込めるノードを探す。ノードは配列順に
// 決定論的に走査し、最初に抽選へ当たったノードが持ち込む（当たった時点でそのノードの
// trustが消費される）。誰も当たらなければ通常のオークション案件のまま。
function rollMonopolySource(state,deal,week){
  if(!network)return null;
  network.ensure(state);
  for(const node of state.peNetwork.nodes){
    if(network.monopolyProbability(node)<=0)continue;
    if(network.rollMonopolySourcing(state,node.id,week,String(deal?.id||'')))return node;
  }
  return null;
}

// PE案件のDDに使うファンドの妥当性検査（T17の取得もこの判定を再利用する）。
function investingFundByID(state,fundID){
  const fund=arr(state?.peFirm?.funds).find(f=>f?.id===fundID);
  return fund&&fund.status==='investing'?fund:null;
}
// 投資期間中のファンド一覧（UIの選択肢・自動選択の母集合）。
function investingFunds(state){return activeInvestingFunds(state);}
// T21-3（GAME-AUDIT-002）: どのファンドから投資するかの解決。明示指定が最優先で、指定が無い
// 場合は稼働中のファンドが1本だけなら自動選択する。2本以上あるときはプレイヤーが選ぶべきなので
// 自動では決めない。
function resolveInvestingFund(state,fundID,target=null){
  const funds=target?eligibleInvestingFundsForTarget(state,target):investingFunds(state);
  if(fundID)return funds.find(f=>f.id===fundID)||null;
  return funds.length===1?funds[0]:null;
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__peDealSupplyInstalled)return true;
  // js/ma-deal-room.js exports installMADealRoom(TycoonEngine) but js/app.js is what actually
  // calls it, late in the canonical script order -- startMADueDiligence/openMADealRoom do not
  // exist on the prototype until then. Same deferral js/pe-fund.js uses for completion.js.
  if(typeof proto.startMADueDiligence!=='function')return false;

  proto.startPEProprietarySourcing=function(nodeID){
    const result=startProprietarySourcing(this.g,nodeID,this.g.week);
    if(!result.ok)return this.fail(result.message||'Proprietary Sourcingを開始できません。');
    this.save();
    this.emit();
    return true;
  };

  const baseStartDD=proto.startMADueDiligence;
  proto.startMADueDiligence=function(id,scopeID,fundID){
    // 通常のM&A案件では state を一切触らない（ensure は既定値を書き込むので、失敗した
    // 操作が状態を変えないという契約を壊さないよう、PE案件だと分かってから呼ぶ）。
    const deal=arr(this.g.maDealRooms).find(x=>x.id===id);
    const target=deal&&arr(this.g.acquisitionTargets).find(x=>x.id===deal.targetID);
    if(!isPETarget(target))return baseStartDD.call(this,id,scopeID);
    ensure(this.g);
    // 稼働中のファンドが1本ならUIが指定しなくても自動で選ぶ（T21-3）。
    const eligibleFunds=eligibleInvestingFundsForTarget(this.g,target);
    const fund=resolveInvestingFund(this.g,fundID,target);
    if(!fund){
      const funds=investingFunds(this.g);
      if(!funds.length)return this.fail('投資期間中のファンドがありません。');
      if(!eligibleFunds.length)return this.fail('この案件帯へ投資できるファンドがありません。');
      if(!fundID&&eligibleFunds.length>1)return this.fail('どのファンドから投資するかを選んでください。');
      if(fundID)return this.fail('選択したファンドではこの案件帯へ投資できません。');
      return this.fail('投資期間中のファンドでのみ調査できます。');
    }
    // 枠の残りを先に見て、無ければ base を呼ばない（DD費用のキャッシュも動かさない）。
    if(pf.ddSlotsRemaining(this.g,this.g.week)<=0)return this.fail('今年の調査枠を使い切りました。');
    const started=baseStartDD.call(this,id,scopeID);
    // 枠の消費はDDが実際に始まったときだけ。base が落ちた場合は枠も減らない（atomic）。
    if(started!==true)return started;
    pf.consumeDDSlot(this.g,this.g.week);
    // 以降の indication → final_bid → 取得はこの fundID を一貫して使う（T17のクロージング）。
    deal.fundID=fund.id;
    this.save();
    this.emit();
    return true;
  };

  // generateMATargets は通常のM&A候補を丸ごと入れ替える。PE案件を巻き込まないよう、
  // base には通常候補だけを見せ、終わってから戻す（base の「6件以上なら更新しない」判定も
  // PE案件で歪まなくなる）。
  const baseGenerate=proto.generateMATargets;
  proto.generateMATargets=function(force=false){
    ensure(this.g);
    const preserved=this.g.acquisitionTargets.filter(isPETarget);
    this.g.acquisitionTargets=this.g.acquisitionTargets.filter(t=>!isPETarget(t));
    let result;
    try{result=baseGenerate.call(this,force);}
    finally{this.g.acquisitionTargets=arr(this.g.acquisitionTargets).concat(preserved);}
    return result;
  };

  const baseAdvanceWeek=proto.advanceWeek;
  proto.advanceWeek=function(...args){
    const before=finite(this.g.week);
    const r=baseAdvanceWeek.apply(this,args);
    if(r!==false){
      ensure(this.g);
      for(let w=before+1;w<=finite(this.g.week);w++){processSupplyWeek(this.g,w);processProprietarySourcingWeek(this.g,w);}
    }
    return r;
  };

  Object.defineProperty(proto,'__peDealSupplyInstalled',{value:true});
  return true;
}
if(!install()&&typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  document.addEventListener('DOMContentLoaded',install,{once:true});
}

modules.peDealSupply=Object.freeze({
  SUPPLY_INTERVAL_WEEKS,TARGET_LIFETIME_WEEKS,MAX_PE_TARGETS,MONOPOLY_PRICE_DISCOUNT,NETWORK_REFERRAL_TRUST_THRESHOLD,NETWORK_REFERRAL_SEARCH_ATTEMPTS,NETWORK_REFERRAL_MIN_COMPETITION_MULTIPLIER,PROPRIETARY_TRUST_THRESHOLD,PROPRIETARY_OUTREACH_WEEKS,PROPRIETARY_READY_GRACE_WEEKS,PROPRIETARY_MAX_ACTIVE,PROPRIETARY_HISTORY_LIMIT,PROPRIETARY_BASE_SUCCESS,PROPRIETARY_TRUST_SUCCESS_SPAN,PROPRIETARY_LONG_TERM_BONUS,PROPRIETARY_MAX_SUCCESS,PILLAR_LABELS,TIER_INDUSTRIES,
  ensure,isPETarget,activeInvestingFund,activeInvestingFunds,eligibleTierSetForFunds,eligibleInvestingFundsForTarget,investingFundByID,investingFunds,resolveInvestingFund,buildTargetFromDeal,prunePETargets,strongestReferralSource,referralTrustProgress,referralInspectionCount,referralCompetitionMultiplier,referralQualityScore,referralCandidates,buildReferralDeal,proprietarySuccessProbability,proprietaryCandidate,activeProprietarySourcing,startProprietarySourcing,proprietaryDealForCampaign,processProprietarySourcingWeek,processSupplyWeek,rollMonopolySource,install,
  __installed:true
});
})();
