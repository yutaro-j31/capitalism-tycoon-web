// Script boundary: js/gym-membership-model.js (classic JavaScript)
// Deterministic per-store subscription/membership model for the gym business.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before gym-membership-model.js.');
if(modules.gymMembershipModel)throw new Error('Capitalism Tycoon gym membership module is already registered.');
const BUSINESS_ID='gym',SCHEMA_VERSION=2;
const STRATEGY_ORDER=Object.freeze(['standard','offPeak','premium']);
const STRATEGIES=Object.freeze({
  standard:Object.freeze({id:'standard',name:'標準',feeMultiplier:1,signupMultiplier:1,capacityMultiplier:1,variableCostRatio:.22}),
  offPeak:Object.freeze({id:'offPeak',name:'オフピーク',feeMultiplier:.9,signupMultiplier:1.08,capacityMultiplier:1.15,variableCostRatio:.22}),
  premium:Object.freeze({id:'premium',name:'プレミアム',feeMultiplier:1.18,signupMultiplier:.74,capacityMultiplier:1,variableCostRatio:.30})
});
// 点売りの飲食・小売と違い、会員はいったん入会すると解約するまで毎週会費（business.price、
// 月額として扱う）を払い続ける。品質・設備投資が離脱率を下げ、設備強化（既存のstoreEquipment
// capacityMultiplier）が定員を上げる、という既存ボタンだけで完結するトレードオフにする。
const VARIABLE_COST_RATIO=.22; // 消耗品・光熱費など会員1人あたりの限界費用は会費の一部として扱う（business.unitCostは
// 「客単価×来店数」の旧式向けの値であり、サブスク会費とは単位が異なるため使わない。不動産仲介パイプラインが
// business.unitCostを使わず案件額の一定割合をvariableとするのと同じ考え方）。
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
const clamp=(value,min,max)=>Math.min(max,Math.max(min,finite(value,min)));
function capacityFor(store,business){
  const base=450+finite(business?.efficiency,0)*4;
  const mult=modules.storeEquipment?.capacityMultiplier?.(store)??1;
  return Math.max(150,Math.round(base*finite(mult,1)));
}
function strategyFor(store){const id=store?.gymMembership?.membershipStrategy;return STRATEGIES[id]||STRATEGIES.standard;}
function effectiveCapacityFor(store,business){return Math.max(150,Math.round(capacityFor(store,business)*strategyFor(store).capacityMultiplier));}
function effectiveMonthlyFeeFor(store,business){return Math.max(1,finite(business?.price,1))*strategyFor(store).feeMultiplier;}
const CHURN_BASE=.018;
const CROWDING_THRESHOLD=.8,CROWDING_MAX_CHURN=.018,MAX_TOTAL_CHURN=.13,CROWDING_SIGNUP_SLOPE=1.35,MIN_SIGNUP_CONVERSION=.05;
function legacyChurnRateFor(business,store){
  const quality=finite(business?.quality,0),condition=finite(store?.condition,100);
  return clamp(.055-quality*.0003-(condition-70)*.0006,.018,.11);
}
function occupancyFor(store,business){
  const capacity=effectiveCapacityFor(store,business),members=integer(store?.gymMembership?.members);
  return capacity>0?clamp(members/capacity,0,1):0;
}
function crowdingFor(store,business){
  const occupancy=occupancyFor(store,business),pressure=clamp((occupancy-CROWDING_THRESHOLD)/(1-CROWDING_THRESHOLD),0,1);
  return Object.freeze({occupancy,pressure,extraChurnRate:pressure*CROWDING_MAX_CHURN,stage:occupancy<.8?'快適':occupancy<.95?'混雑':'過密'});
}
function signupConversionFor(store,business){
  const pressure=crowdingFor(store,business).pressure;
  const crowdingConversion=pressure<=0?1:clamp(1-pressure*CROWDING_SIGNUP_SLOPE,MIN_SIGNUP_CONVERSION,1);
  return crowdingConversion*strategyFor(store).signupMultiplier;
}
// 理由別成分は既存の総退会率を説明する attribution。競合圧力は内訳の配分だけを
// 変え、総退会率自体は変えない。
function churnBreakdownFor(business,store,localCompetition){
  const quality=finite(business?.quality,0),condition=finite(store?.condition,100),competition=clamp(localCompetition,0,1);
  const legacyTotal=legacyChurnRateFor(business,store),base=Math.min(CHURN_BASE,legacyTotal),remaining=Math.max(0,legacyTotal-base);
  const qualityWeight=Math.max(0,(100-quality)*.0003),conditionWeight=Math.max(0,(100-condition)*.0006),competitionWeight=competition*.02;
  const weightSum=qualityWeight+conditionWeight+competitionWeight;
  const premiumQuality=strategyFor(store).id==='premium'?Math.max(0,(70-quality)*.0008):0;
  const crowding=Math.max(0,Math.min(crowdingFor(store,business).extraChurnRate,MAX_TOTAL_CHURN-legacyTotal-premiumQuality)),total=Math.min(MAX_TOTAL_CHURN,legacyTotal+premiumQuality+crowding);
  if(remaining===0||weightSum===0)return {total,base:legacyTotal,quality:premiumQuality,condition:0,competition:0,crowding};
  const qualityComponent=remaining*qualityWeight/weightSum,conditionComponent=remaining*conditionWeight/weightSum;
  const competitionComponent=Math.max(0,remaining-qualityComponent-conditionComponent);
  return {total,base,quality:qualityComponent+premiumQuality,condition:conditionComponent,competition:competitionComponent,crowding};
}
function churnRateFor(business,store,localCompetition){return churnBreakdownFor(business,store,localCompetition).total;}
function allocateChurnedByReason(churned,breakdown){
  const keys=['quality','condition','competition','crowding','base'],result={quality:0,condition:0,competition:0,crowding:0,base:0};
  if(churned<=0||breakdown.total<=0)return result;
  const rows=keys.map((key,index)=>{const raw=churned*breakdown[key]/breakdown.total,floor=Math.floor(raw);result[key]=floor;return {key,index,remainder:raw-floor};});
  let left=churned-keys.reduce((sum,key)=>sum+result[key],0);
  rows.sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
  for(let i=0;i<left;i++)result[rows[i%rows.length].key]++;
  return result;
}
function eligibleStores(stores){return (Array.isArray(stores)?stores:[]).filter(store=>store?.businessID===BUSINESS_ID&&store.status==='open');}
function ensureStore(store){
  const raw=store.gymMembership&&typeof store.gymMembership==='object'?store.gymMembership:{};
  const totals=raw.totals&&typeof raw.totals==='object'?raw.totals:{};
  const churnedByReason=totals.churnedByReason&&typeof totals.churnedByReason==='object'?totals.churnedByReason:{};
  store.gymMembership={schemaVersion:SCHEMA_VERSION,membershipStrategy:STRATEGIES[raw.membershipStrategy]?raw.membershipStrategy:'standard',members:integer(raw.members),lastWeek:raw.lastWeek&&typeof raw.lastWeek==='object'?raw.lastWeek:null,totals:{revenue:integer(totals.revenue),newMembers:integer(totals.newMembers),churnedMembers:integer(totals.churnedMembers),churnedByReason:{quality:integer(churnedByReason.quality),condition:integer(churnedByReason.condition),competition:integer(churnedByReason.competition),crowding:integer(churnedByReason.crowding),base:integer(churnedByReason.base)}}};
  return store.gymMembership;
}
function normalize(g){for(const store of Array.isArray(g?.stores)?g.stores:[])if(store?.businessID===BUSINESS_ID&&store.gymMembership&&typeof store.gymMembership==='object')ensureStore(store);}
// demandとinflationは呼び出し側（engine.js）が既存の環境要因（客足・景気・季節・品質/ブランド/DXの
// 投資効果・営業時間・競合圧力）から算出した値をそのまま渡す。新たに乱数は消費しない。
function processStore(g,store,business,demand,inflation,localCompetition){
  if(!store||store.businessID!==BUSINESS_ID)return null;
  const week=Math.max(1,integer(g?.week,1)),state=ensureStore(store);
  const strategy=strategyFor(store),physicalCapacity=capacityFor(store,business),capacity=effectiveCapacityFor(store,business),crowding=crowdingFor(store,business),breakdown=churnBreakdownFor(business,store,localCompetition);
  const churned=Math.round(state.members*breakdown.total);
  // largest-remainder方式で決定論的に配分し、合計を必ず総退会数と一致させる。
  const churnedByReason=allocateChurnedByReason(churned,breakdown);
  const signups=Math.max(0,Math.round(finite(demand)*1.7*signupConversionFor(store,business)));
  const beforeCap=Math.max(0,state.members-churned+signups);
  const members=Math.min(capacity,beforeCap);
  const lostSignups=Math.max(0,beforeCap-capacity);
  const arpu=effectiveMonthlyFeeFor(store,business)/4.33;
  const sales=Math.max(0,members*arpu*finite(inflation,1));
  const variable=Math.max(0,sales*strategy.variableCostRatio);
  state.members=members;
  const occupancyAfter=capacity>0?clamp(members/capacity,0,1):0;
  const row={week,members,capacity,physicalCapacity,membershipStrategy:strategy.id,effectiveMonthlyFee:Math.round(effectiveMonthlyFeeFor(store,business)),variableCostRatio:strategy.variableCostRatio,signups,churned,churnedByReason,lostSignups,sales:Math.round(sales),occupancyBefore:crowding.occupancy,occupancyAfter,crowdingStage:occupancyAfter<.8?'快適':occupancyAfter<.95?'混雑':'過密',crowdingChurnRate:breakdown.crowding};
  state.lastWeek=row;state.totals.newMembers+=signups;state.totals.churnedMembers+=churned;state.totals.revenue+=row.sales;
  for(const key of ['quality','condition','competition','crowding','base'])state.totals.churnedByReason[key]+=churnedByReason[key];
  return {sales:row.sales,variable:Math.round(variable)};
}
Object.assign(modules,{gymMembershipModel:Object.freeze({BUSINESS_ID,SCHEMA_VERSION,STRATEGY_ORDER,STRATEGIES,CROWDING_THRESHOLD,CROWDING_MAX_CHURN,MAX_TOTAL_CHURN,CROWDING_SIGNUP_SLOPE,MIN_SIGNUP_CONVERSION,capacityFor,effectiveCapacityFor,effectiveMonthlyFeeFor,strategyFor,occupancyFor,crowdingFor,signupConversionFor,legacyChurnRateFor,churnRateFor,churnBreakdownFor,allocateChurnedByReason,eligibleStores,ensureStore,normalize,processStore})});
})();
