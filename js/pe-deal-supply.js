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
function activeInvestingFund(state){
  const funds=arr(state?.peFirm?.funds);
  for(let i=funds.length-1;i>=0;i--)if(funds[i]?.status==='investing')return funds[i];
  return null;
}

function ensure(state){
  if(!state)return state;
  pf.ensure(state);
  state.acquisitionTargets=arr(state.acquisitionTargets);
  state.peFirm.lastDealSupplyWeek=Math.max(0,Math.floor(finite(state.peFirm.lastDealSupplyWeek,0)));
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
function processSupplyWeek(state,week){
  ensure(state);
  const w=Math.max(0,Math.floor(finite(week,state.week)));
  if(state.peFirm.lastDealSupplyWeek>=w)return null;
  state.peFirm.lastDealSupplyWeek=w;
  prunePETargets(state,w);
  if(w%SUPPLY_INTERVAL_WEEKS!==1)return null;
  const fund=activeInvestingFund(state);
  if(!fund)return null;
  const eligible=new Set(tiers.eligibleTiers(fund));
  const deals=tiers.generateAnnualDeals(state,Math.floor(w/52));
  const deal=deals[Math.floor((w%52)/SUPPLY_INTERVAL_WEEKS)];
  if(!deal||!eligible.has(deal.tierID))return null;
  if(state.acquisitionTargets.filter(isPETarget).length>=MAX_PE_TARGETS)return null;
  const target=buildTargetFromDeal(deal,w);
  if(state.acquisitionTargets.some(t=>t?.id===target.id))return null;
  // T19: 人脈から独占案件として持ち込まれたなら、競らずに買える案件として板に載る。
  const source=rollMonopolySource(state,deal,w);
  if(source){
    target.dealChannel='monopoly';
    target.peSourceNodeID=source.id;
    target.peSourcePathType=source.pathType;
    target.valuation=finite(target.valuation)*(1-MONOPOLY_PRICE_DISCOUNT);
    target.friendly=true;
  }
  state.acquisitionTargets.push(target);
  dealRoom.initializeTarget?.(target,state);
  return target;
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

function investingFundByID(state,fundID){
  const fund=arr(state?.peFirm?.funds).find(f=>f?.id===fundID);
  return fund&&fund.status==='investing'?fund:null;
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__peDealSupplyInstalled)return true;
  // js/ma-deal-room.js exports installMADealRoom(TycoonEngine) but js/app.js is what actually
  // calls it, late in the canonical script order -- startMADueDiligence/openMADealRoom do not
  // exist on the prototype until then. Same deferral js/pe-fund.js uses for completion.js.
  if(typeof proto.startMADueDiligence!=='function')return false;

  const baseStartDD=proto.startMADueDiligence;
  proto.startMADueDiligence=function(id,scopeID,fundID){
    // 通常のM&A案件では state を一切触らない（ensure は既定値を書き込むので、失敗した
    // 操作が状態を変えないという契約を壊さないよう、PE案件だと分かってから呼ぶ）。
    const deal=arr(this.g.maDealRooms).find(x=>x.id===id);
    const target=deal&&arr(this.g.acquisitionTargets).find(x=>x.id===deal.targetID);
    if(!isPETarget(target))return baseStartDD.call(this,id,scopeID);
    ensure(this.g);
    if(!fundID)return this.fail('PE案件の調査にはファンドの指定が必要です。');
    const fund=investingFundByID(this.g,fundID);
    if(!fund)return this.fail('投資期間中のファンドでのみ調査できます。');
    // 枠の残りを先に見て、無ければ base を呼ばない（DD費用のキャッシュも動かさない）。
    if(pf.ddSlotsRemaining(this.g,this.g.week)<=0)return this.fail('今年の調査枠を使い切りました。');
    const started=baseStartDD.call(this,id,scopeID);
    // 枠の消費はDDが実際に始まったときだけ。base が落ちた場合は枠も減らない（atomic）。
    if(started!==true)return started;
    pf.consumeDDSlot(this.g,this.g.week);
    deal.fundID=fundID;
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
      for(let w=before+1;w<=finite(this.g.week);w++)processSupplyWeek(this.g,w);
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
  SUPPLY_INTERVAL_WEEKS,TARGET_LIFETIME_WEEKS,MAX_PE_TARGETS,MONOPOLY_PRICE_DISCOUNT,PILLAR_LABELS,TIER_INDUSTRIES,
  ensure,isPETarget,activeInvestingFund,investingFundByID,buildTargetFromDeal,prunePETargets,processSupplyWeek,rollMonopolySource,install,
  __installed:true
});
})();
