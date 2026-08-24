// Script boundary: js/convenience-merchandising.js (classic JavaScript)
// Deterministic company-wide merchandising mix model for the conveni business.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before convenience-merchandising.js.');
if(modules.convenienceMerchandising)throw new Error('Capitalism Tycoon convenience merchandising module is already registered.');
const BUSINESS_ID='conveni',SCHEMA_VERSION=2;
const PRIVATE_BRAND_DEVELOPMENT_COST=1_200_000,PRIVATE_BRAND_DEVELOPMENT_WEEKS=4;
const PRIVATE_BRAND_SHARES=Object.freeze([0,.15,.30,.45]);
const PRIVATE_BRAND_OPTIONS=Object.freeze({
  0:Object.freeze({share:0,demandMultiplier:1,unitCostMultiplier:1}),
  .15:Object.freeze({share:.15,demandMultiplier:1,unitCostMultiplier:.97}),
  .3:Object.freeze({share:.30,demandMultiplier:.985,unitCostMultiplier:.94}),
  .45:Object.freeze({share:.45,demandMultiplier:.96,unitCostMultiplier:.91})
});
// 惣菜・弁当を強化すると客数・客単価は伸びるが、日配品は賞味期限が短く廃棄ロスが増える。
// 定番・日用品重視は逆に伸びは鈍いが廃棄ロスをほぼゼロに抑えられる。全店舗共通の方針。
const POLICIES=Object.freeze({
  standard:Object.freeze({id:'standard',name:'標準構成',demandMultiplier:1,wasteRate:.018,marginMultiplier:1}),
  freshFocus:Object.freeze({id:'freshFocus',name:'惣菜・弁当強化',demandMultiplier:1.10,wasteRate:.06,marginMultiplier:1.05}),
  staples:Object.freeze({id:'staples',name:'定番・日用品重視',demandMultiplier:.93,wasteRate:.007,marginMultiplier:.97})
});
const POLICY_ORDER=Object.freeze(['standard','freshFocus','staples']);
// ドミナント戦略: 同一都道府県に自社コンビニを集中出店すると、共同配送・巡回効率化により
// 需要が伸び廃棄ロス率が下がる。実際のコンビニチェーンの立地戦略を模した、店舗数に応じた
// シナジー（上限あり）。新規の乱数消費は無い（既存店舗数を数えるだけの決定論的な導出）。
const CLUSTER_DEMAND_BONUS_PER_STORE=.02,CLUSTER_DEMAND_BONUS_MAX=.10;
const CLUSTER_WASTE_REDUCTION_PER_STORE=.10,CLUSTER_WASTE_REDUCTION_MAX=.45;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(finite(value,fallback)));
function policyFor(id){return POLICIES[id]||POLICIES.standard;}
function privateBrandOption(share){return PRIVATE_BRAND_OPTIONS[share]||PRIVATE_BRAND_OPTIONS[0];}
function clusterCountFor(g,store){
  if(!store)return 0;
  return (Array.isArray(g?.stores)?g.stores:[]).filter(s=>s&&s.id!==store.id&&s.businessID===BUSINESS_ID&&s.status==='open'&&s.prefID===store.prefID).length;
}
function ensure(g){
  if(!g||typeof g!=='object')return {schemaVersion:SCHEMA_VERSION,policyID:'standard',privateBrand:{unlocked:false,pending:null,share:0},lastWeekByStoreID:{},totals:{revenue:0,wasteCost:0,privateBrandSavings:0}};
  const raw=g.conveniMerchandising&&typeof g.conveniMerchandising==='object'?g.conveniMerchandising:{};
  const policyID=POLICIES[raw.policyID]?raw.policyID:'standard';
  const totals=raw.totals&&typeof raw.totals==='object'?raw.totals:{};
  const existingStoreIDs=new Set((Array.isArray(g.stores)?g.stores:[]).map(s=>s?.id));
  const prevByStore=raw.lastWeekByStoreID&&typeof raw.lastWeekByStoreID==='object'?raw.lastWeekByStoreID:{};
  const lastWeekByStoreID={};
  for(const [id,row] of Object.entries(prevByStore))if(existingStoreIDs.has(id)&&row&&typeof row==='object')lastWeekByStoreID[id]=row;
  const sourcePB=raw.privateBrand&&typeof raw.privateBrand==='object'&&!Array.isArray(raw.privateBrand)?raw.privateBrand:{};
  const unlocked=sourcePB.unlocked===true;
  const share=unlocked&&PRIVATE_BRAND_SHARES.includes(Number(sourcePB.share))?Number(sourcePB.share):0;
  const candidate=sourcePB.pending&&typeof sourcePB.pending==='object'?sourcePB.pending:null;
  const committedWeek=Number(candidate?.committedWeek),resolveWeek=Number(candidate?.resolveWeek),currentWeek=Number(g.week);
  const pending=!unlocked&&Number.isFinite(committedWeek)&&Number.isFinite(resolveWeek)&&Number.isFinite(currentWeek)&&committedWeek>=0&&committedWeek<=currentWeek&&resolveWeek===committedWeek+PRIVATE_BRAND_DEVELOPMENT_WEEKS&&resolveWeek>=currentWeek?{committedWeek:Math.floor(committedWeek),resolveWeek:Math.floor(resolveWeek)}:null;
  g.conveniMerchandising={schemaVersion:SCHEMA_VERSION,policyID,privateBrand:{unlocked,pending,share},lastWeekByStoreID,totals:{revenue:integer(totals.revenue),wasteCost:integer(totals.wasteCost),privateBrandSavings:integer(totals.privateBrandSavings)}};
  return g.conveniMerchandising;
}
function normalize(g){if(g&&typeof g==='object'&&g.conveniMerchandising)ensure(g);}
function setPolicy(g,policyID){if(!g||!POLICIES[policyID])return false;ensure(g).policyID=policyID;return true;}
function setPrivateBrandShare(g,share){const mix=ensure(g),value=Number(share);if(!mix.privateBrand.unlocked||!PRIVATE_BRAND_SHARES.includes(value)||mix.privateBrand.share===value)return false;mix.privateBrand.share=value;return true;}
function resolvePrivateBrandPending(engine){const mix=ensure(engine?.g),pending=mix.privateBrand.pending;if(!pending||Number(engine.g.week)<pending.resolveWeek)return false;mix.privateBrand.unlocked=true;mix.privateBrand.pending=null;mix.privateBrand.share=0;engine.notify('PB商品の開発が完了しました。売場へ導入するPB比率を選択できます。','success');return true;}
function eligibleStores(stores){return (Array.isArray(stores)?stores:[]).filter(store=>store?.businessID===BUSINESS_ID&&store.status==='open');}
// demandとinflationは呼び出し側（engine.js）が既存の環境要因（客足・景気・季節・品質/ブランド/DX・
// 営業時間・競合圧力）から算出した値をそのまま渡す。ここでは新たに乱数を消費せず、
// 構成方針の倍率・廃棄ロス率を掛けるだけの決定論的な導出にとどめる。
function processStore(g,store,business,demand,inflation){
  if(!store||store.businessID!==BUSINESS_ID)return null;
  const week=Math.max(1,integer(g?.week,1)),mix=ensure(g),policy=policyFor(mix.policyID),pb=privateBrandOption(mix.privateBrand.share);
  const clusterCount=clusterCountFor(g,store);
  const clusterDemandBonus=Math.min(CLUSTER_DEMAND_BONUS_MAX,clusterCount*CLUSTER_DEMAND_BONUS_PER_STORE);
  const clusterWasteReduction=Math.min(CLUSTER_WASTE_REDUCTION_MAX,clusterCount*CLUSTER_WASTE_REDUCTION_PER_STORE);
  const legacyDemand=Math.max(0,finite(demand)*policy.demandMultiplier*(1+clusterDemandBonus));
  const adjustedDemand=pb.share===0?legacyDemand:legacyDemand*pb.demandMultiplier;
  const effectiveWasteRate=policy.wasteRate*(1-clusterWasteReduction);
  const price=Math.max(1,finite(business?.price,1));
  const sales=Math.max(0,adjustedDemand*price*finite(inflation,1));
  const wasteCost=Math.round(sales*effectiveWasteRate);
  const merchandiseCost=Math.max(0,adjustedDemand*finite(business?.unitCost,1)*finite(inflation,1)*policy.marginMultiplier);
  const privateBrandCost=pb.share===0?merchandiseCost:merchandiseCost*pb.unitCostMultiplier;
  const privateBrandSavings=Math.max(0,Math.round(merchandiseCost-privateBrandCost));
  const variable=Math.max(0,privateBrandCost+wasteCost);
  const row={week,policyID:policy.id,demand:Math.round(adjustedDemand),sales:Math.round(sales),wasteCost,clusterCount,clusterDemandBonus,clusterWasteReduction,privateBrandShare:pb.share,privateBrandDemandMultiplier:pb.demandMultiplier,privateBrandUnitCostMultiplier:pb.unitCostMultiplier,privateBrandSavings};
  mix.lastWeekByStoreID[store.id]=row;
  mix.totals.revenue+=row.sales;mix.totals.wasteCost+=row.wasteCost;mix.totals.privateBrandSavings+=row.privateBrandSavings;
  return {sales:row.sales,variable:Math.round(variable)};
}
Object.assign(modules,{convenienceMerchandising:Object.freeze({BUSINESS_ID,SCHEMA_VERSION,POLICIES,POLICY_ORDER,PRIVATE_BRAND_DEVELOPMENT_COST,PRIVATE_BRAND_DEVELOPMENT_WEEKS,PRIVATE_BRAND_SHARES,PRIVATE_BRAND_OPTIONS,policyFor,privateBrandOption,clusterCountFor,ensure,normalize,setPolicy,setPrivateBrandShare,resolvePrivateBrandPending,eligibleStores,processStore})});
})();
