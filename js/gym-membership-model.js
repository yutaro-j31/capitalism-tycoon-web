// Script boundary: js/gym-membership-model.js (classic JavaScript)
// Deterministic per-store subscription/membership model for the gym business.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before gym-membership-model.js.');
if(modules.gymMembershipModel)throw new Error('Capitalism Tycoon gym membership module is already registered.');
const BUSINESS_ID='gym',SCHEMA_VERSION=1;
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
function churnRateFor(business,store){
  const quality=finite(business?.quality,0),condition=finite(store?.condition,100);
  return clamp(.055-quality*.0003-(condition-70)*.0006,.018,.11);
}
function eligibleStores(stores){return (Array.isArray(stores)?stores:[]).filter(store=>store?.businessID===BUSINESS_ID&&store.status==='open');}
function ensureStore(store){
  const raw=store.gymMembership&&typeof store.gymMembership==='object'?store.gymMembership:{};
  const totals=raw.totals&&typeof raw.totals==='object'?raw.totals:{};
  store.gymMembership={schemaVersion:SCHEMA_VERSION,members:integer(raw.members),lastWeek:raw.lastWeek&&typeof raw.lastWeek==='object'?raw.lastWeek:null,totals:{revenue:integer(totals.revenue),newMembers:integer(totals.newMembers),churnedMembers:integer(totals.churnedMembers)}};
  return store.gymMembership;
}
function normalize(g){for(const store of Array.isArray(g?.stores)?g.stores:[])if(store?.businessID===BUSINESS_ID&&store.gymMembership&&typeof store.gymMembership==='object')ensureStore(store);}
// demandとinflationは呼び出し側（engine.js）が既存の環境要因（客足・景気・季節・品質/ブランド/DXの
// 投資効果・営業時間・競合圧力）から算出した値をそのまま渡す。新たに乱数は消費しない。
function processStore(g,store,business,demand,inflation){
  if(!store||store.businessID!==BUSINESS_ID)return null;
  const week=Math.max(1,integer(g?.week,1)),state=ensureStore(store);
  const capacity=capacityFor(store,business),churnRate=churnRateFor(business,store);
  const churned=Math.round(state.members*churnRate);
  const signups=Math.max(0,Math.round(finite(demand)*1.7));
  const beforeCap=Math.max(0,state.members-churned+signups);
  const members=Math.min(capacity,beforeCap);
  const lostSignups=Math.max(0,beforeCap-capacity);
  const arpu=Math.max(1,finite(business?.price,1))/4.33;
  const sales=Math.max(0,members*arpu*finite(inflation,1));
  const variable=Math.max(0,sales*VARIABLE_COST_RATIO);
  state.members=members;
  const row={week,members,capacity,signups,churned,lostSignups,sales:Math.round(sales)};
  state.lastWeek=row;state.totals.newMembers+=signups;state.totals.churnedMembers+=churned;state.totals.revenue+=row.sales;
  return {sales:row.sales,variable:Math.round(variable)};
}
Object.assign(modules,{gymMembershipModel:Object.freeze({BUSINESS_ID,SCHEMA_VERSION,capacityFor,churnRateFor,eligibleStores,ensureStore,normalize,processStore})});
})();
