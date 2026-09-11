// Script boundary: js/pe-industry-tiers.js (classic JavaScript)
//
// PE mode T11 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §15): the 4 industry tiers PE
// deals are generated from, and the deterministic annual deal-supply generator. Deal count is
// fixed at 4/year always (設計書 課題3: 数は固定、市況は質を変える) -- market conditions
// (state.economy) shift each deal's price level and distress, never the count.
//
// This file provides pure calculation + generation functions only, exactly like js/pe-fund.js's
// T9/T10 additions did before any real financed-deal flow existed. It does not wire into
// js/ma-deal-room.js's bidding UI or state.acquisitionTargets -- associating a generated deal
// with an actual biddable target, and tying a fund to it via fundID, is deferred to whichever
// later task actually spends a fund's cash on one (T11's own stated completion criteria is
// "帯ごとの案件生成、規模による絞り込み、供給数の下限", not full bidding integration).
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine module must load before pe-industry-tiers.js.');
if(!modules?.peFund)throw new Error('Capitalism Tycoon peFund module must load before pe-industry-tiers.js.');
if(modules.peIndustryTiers)throw new Error('Capitalism Tycoon peIndustryTiers module is already registered.');

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,finite(v,min)));

// Same deterministic FNV-1a hash as js/ma-deal-room.js / js/pe-rivals.js (CLAUDE.md: reuse the
// existing hash pattern instead of the simulation-RNG call, and never change its consumption
// order).
function hash(parts){let h=2166136261;String(parts.join('|')).split('').forEach(c=>{h^=c.charCodeAt(0);h=Math.imul(h,16777619);});return h>>>0;}
function unit(...p){return hash(p)/4294967295;}

// 設計書§15の表。sizeMin/sizeMaxは企業価値(EV)、leverageは取得時の負債活用倍率。
const TIERS=Object.freeze({
  pillar:Object.freeze({id:'pillar',name:'5本柱系',sizeMin:2_000_000_000,sizeMax:150_000_000_000,acquisitionMultiple:8.0,leverage:3.5,skillMultiplier:.28,exitOptions:Object.freeze(['sale','ipo','selfManage']),businessIDs:Object.freeze(['ramen','conveni','gym','realEstateAgency','productVentures'])}),
  smallSuccession:Object.freeze({id:'smallSuccession',name:'小型承継',sizeMin:300_000_000,sizeMax:4_000_000_000,acquisitionMultiple:5.5,leverage:4.5,skillMultiplier:.04,exitOptions:Object.freeze(['sale']),businessIDs:Object.freeze([])}),
  midCap:Object.freeze({id:'midCap',name:'中型',sizeMin:3_000_000_000,sizeMax:40_000_000_000,acquisitionMultiple:7.0,leverage:4.0,skillMultiplier:.12,exitOptions:Object.freeze(['sale','ipo']),businessIDs:Object.freeze([])}),
  largeCap:Object.freeze({id:'largeCap',name:'大型',sizeMin:30_000_000_000,sizeMax:400_000_000_000,acquisitionMultiple:8.5,leverage:3.5,skillMultiplier:.10,exitOptions:Object.freeze(['sale','ipo']),businessIDs:Object.freeze([])})
});
const TIER_IDS=Object.freeze(Object.keys(TIERS));

// ファンド規模に応じて打てる帯が変わる（設計書§15完了条件）。取得倍率のレバレッジを使い、
// 帯の企業価値(EV)を自己資金(エクイティ)換算した上で、ファンドの1件あたり上限
// (js/pe-fund.js の maxSingleDealSize、LPの分散義務25%)と比較する:
//   - 下限: 帯の最小EVをレバで割った額が、ファンドの1件上限以下であること
//     （＝最小規模の案件なら自己資金だけで届く）
//   - 上限: 帯の最大EVをレバで割った額が、ファンドの平均チケットサイズ
//     （fund.size ÷ slotCapacity）の半分以上であること（＝小さすぎて割に合わない帯を除外）
// この2条件は設計書§15の例示表（Fund I=小型承継/5本柱系、132億=中型/5本柱系、
// 810億=中型/大型/5本柱系）と一致するよう較正した、このファイル独自の実装。
const TIER_FIT_LOWER_THRESHOLD=1;
const TIER_FIT_UPPER_THRESHOLD=.5;
// 1件あたりに必要な自己資金（帯の下限・上限を、その帯の標準的なレバレッジで割った額）。
// 設計書§15の帯の表（Fund I 28億で pillar/smallSuccession が打てる、など）はこのLBO前提の
// 数字なので、判定はレバレッジを効かせたままにする。
// なお実際の取得（js/pe-acquisition.js）は買収価格の全額をファンドの現金で払う（借入は資金の
// 出どころとしてはまだモデル化していない）ため、1件あたりの消化額は判定上の自己資金より
// 大きい。この差はT22の「市場が吸収できる規模」の見積り（js/pe-fund.js）で扱う。
function tierEquityRange(id){const t=TIERS[id];return {min:t.sizeMin/t.leverage,max:t.sizeMax/t.leverage};}
function eligibleTiers(fund){
  const pf=modules.peFund;
  if(!fund||finite(fund.size)<=0)return [];
  const maxTicket=pf.maxSingleDealSize(fund);
  const slots=Math.max(1,pf.slotCapacity(fund));
  const avgTicket=finite(fund.size)/slots;
  const fitted=TIER_IDS.filter(id=>{
    const {min:equityMin,max:equityMax}=tierEquityRange(id);
    return equityMin<=maxTicket*TIER_FIT_LOWER_THRESHOLD&&equityMax>=avgTicket*TIER_FIT_UPPER_THRESHOLD;
  });
  if(fitted.length)return fitted;
  // T22: ここが空になると案件が1件も供給されず、資金消化率が上がらないため次号ゲート
  // （消化80%以上）を二度と満たせなくなり、ファンドの梯子が恒久的に止まる（T20検証で
  // 実際に年20前後で停止した）。帯が「小さすぎる」ために弾かれただけなら、現実には
  // 大型ファンドでも一番大きい会社は買える — 1件あたりの効率が落ちるだけである。
  // そこで、どの帯も適合しない場合は「買える中で最大の帯」へフォールバックする。
  // 逆に資金が小さすぎてどの帯も買えない場合は、従来どおり空を返す（打つ手が無い）。
  const affordable=TIER_IDS.filter(id=>tierEquityRange(id).min<=maxTicket*TIER_FIT_LOWER_THRESHOLD);
  if(!affordable.length)return [];
  return [affordable.reduce((best,id)=>tierEquityRange(id).max>tierEquityRange(best).max?id:best,affordable[0])];
}

// 年4件固定の案件供給（設計書 課題3・§2）。帯は年・連番から決定論的に選ぶ（一様分布）。
// businessIDは5本柱系の帯にのみ設定される。
// hash()%N (not unit()*N, i.e. not Math.floor of the top-bits-scaled fraction): when the only
// varying input is a small sequential index (0..DEALS_PER_YEAR-1), the FNV prime step
// (16777619) is a small fraction of the full 32-bit range, so unit()'s fractional value barely
// moves between consecutive indices and Math.floor(unit()*N) can collapse onto the same bucket
// for an entire year's deals. Taking the modulo of the raw hash instead uses the low-order bits,
// which this FNV-1a chain spreads well even across a 1-character (2166136261 XOR chain) input
// difference -- verified empirically to never collapse across a 200-year sample.
function pickTierID(year,index){return TIER_IDS[hash(['pe-tier',year,index])%TIER_IDS.length];}
// 帯内の企業価値を対数一様分布で引く。企業規模の分布は現実にも対数正規に近く偏っており、
// 線形一様（between()そのまま）だと各帯の期待値が上限付近に張り付く（例: pillar帯
// 20〜1,500億の線形平均は約760億で、Fund Iの現実的なチケットサイズ（設計書§15の例示
// 「1件あたり9億」）から大きく外れる）。対数軸で引くことで、小型ファンドが帯の下限側の
// 案件に出会える確率を現実的な水準まで引き上げる。
function logBetween(min,max,...seed){const lo=Math.log(Math.max(1,min)),hi=Math.log(Math.max(1,max));return Math.exp(lo+(hi-lo)*unit(...seed));}
function generateDeal(year,index){
  const tierID=pickTierID(year,index);
  const tier=TIERS[tierID];
  const enterpriseValue=logBetween(tier.sizeMin,tier.sizeMax,'pe-ev',year,index);
  const businessID=tier.businessIDs.length?tier.businessIDs[hash(['pe-biz',year,index])%tier.businessIDs.length]:null;
  return {id:`pe-deal-${year}-${index}`,year,index,tierID,tierName:tier.name,enterpriseValue,acquisitionMultiple:tier.acquisitionMultiple,leverage:tier.leverage,skillMultiplier:tier.skillMultiplier,exitOptions:tier.exitOptions,businessID};
}
const DEALS_PER_YEAR=4;
// 市況は数ではなく質を変える（設計書）: economyが高いほど価格水準が上がる代わりに優良、
// 低いほど価格は下がるが傷んだ案件が増える。件数は常にDEALS_PER_YEARで固定。
function marketPriceLevel(economy){return clamp(.7+.6*clamp((finite(economy,1)-.72)/(1.28-.72),0,1),.7,1.3);}
function generateAnnualDeals(state,year){
  const economy=finite(state?.economy,1);
  const priceLevel=marketPriceLevel(economy);
  const distressed=economy<1;
  return Array.from({length:DEALS_PER_YEAR},(_,i)=>({...generateDeal(year,i),priceLevel,distressed}));
}

modules.peIndustryTiers=Object.freeze({
  TIERS,TIER_IDS,TIER_FIT_LOWER_THRESHOLD,TIER_FIT_UPPER_THRESHOLD,DEALS_PER_YEAR,
  tierEquityRange,eligibleTiers,pickTierID,generateDeal,marketPriceLevel,generateAnnualDeals,
  __installed:true
});
})();
