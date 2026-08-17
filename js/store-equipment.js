// Store equipment capex: raise a store's weekly throughput so demand that is currently
// lost to capacity limits can be served. market.js already multiplies effective capacity
// by store.level, so nothing in the market model changes here; saves without a level
// keep resolving to 1 and therefore keep their exact historical results.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before store-equipment.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before store-equipment.js.');
if(modules.storeEquipment)throw new Error('store equipment is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const finance=modules.finance;

const MAX_LEVEL=5;
const USEFUL_LIFE_WEEKS=260;
const SALVAGE_RATE=.1;
// Keep this in sync with effectiveCapacity() in market.js.
const CAPACITY_GAIN_PER_LEVEL=.08;
const FULL_CONDITION=100;
// engine.js charges (100-condition)*650 in upkeep every week, so a full renovation
// is priced at ten weeks of the upkeep it removes.
const RENOVATION_COST_PER_POINT=6500;
// Operating hours already drive capacity (market.js), fixed cost and legacy demand
// (engine.js) and required workload (workforce.js). Only slots 1-4 are meaningful;
// anything else falls back to the standard multiplier of 1 in those lookups.
const MIN_OPERATING_HOURS=1;
const MAX_OPERATING_HOURS=4;
const DEFAULT_OPERATING_HOURS=3;
const OPERATING_HOUR_OPTIONS=Object.freeze([
  Object.freeze({value:1,name:'昼のみ',demandFactor:.45,costFactor:.55}),
  Object.freeze({value:2,name:'昼・夕',demandFactor:.75,costFactor:.8}),
  Object.freeze({value:3,name:'昼〜夜（標準）',demandFactor:1,costFactor:1}),
  Object.freeze({value:4,name:'昼〜深夜',demandFactor:1.17,costFactor:1.24})
]);
const MENU_CATALOG=Object.freeze([
  Object.freeze({id:'classic',name:'定番ラーメン',priceMultiplier:1,qualityDelta:0,noveltyDelta:0,segmentFit:Object.freeze({}),recipeMultipliers:Object.freeze({}),strategyLabel:'基準メニュー'}),
  Object.freeze({id:'value',name:'お手頃ラーメン',priceMultiplier:.82,qualityDelta:-3,noveltyDelta:0,segmentFit:Object.freeze({price:.55,standard:.12}),recipeMultipliers:Object.freeze({ramen_toppings:.72,ramen_vegetables:.85}),strategyLabel:'価格重視向け'}),
  Object.freeze({id:'chashu',name:'特製チャーシューメン',priceMultiplier:1.35,qualityDelta:8,noveltyDelta:2,segmentFit:Object.freeze({quality:.55,brand:.18}),recipeMultipliers:Object.freeze({ramen_toppings:1.65}),strategyLabel:'品質重視向け'}),
  Object.freeze({id:'vegetable',name:'野菜たっぷりラーメン',priceMultiplier:1.18,qualityDelta:5,noveltyDelta:5,segmentFit:Object.freeze({standard:.18,quality:.22,brand:.12}),recipeMultipliers:Object.freeze({ramen_toppings:.65,ramen_vegetables:1.8}),strategyLabel:'日常・品質向け'}),
  Object.freeze({id:'spicy',name:'旨辛限定麺',priceMultiplier:1.22,qualityDelta:3,noveltyDelta:12,segmentFit:Object.freeze({brand:.62,quality:.12}),recipeMultipliers:Object.freeze({ramen_soup:1.22}),strategyLabel:'流行向け'})
]);
const STORE_CONCEPT_CHANGE_COST=300000, STORE_CONCEPT_TRANSITION_WEEKS=2, DEFAULT_STORE_CONCEPT='balanced';
const STORE_CONCEPTS=Object.freeze([
  Object.freeze({id:'balanced',name:'地域の定番',description:'偏りのない標準運営',capacityMultiplier:1,qualityDelta:0,serviceDelta:0,noveltyDelta:0,repeatRateDelta:0,segmentFit:Object.freeze({}),recipeMultipliers:Object.freeze({})}),
  Object.freeze({id:'turnover',name:'回転率重視',description:'販売能力 +18% / 品質・接客 -6 / 包装 +15%',capacityMultiplier:1.18,qualityDelta:-6,serviceDelta:-6,noveltyDelta:0,repeatRateDelta:-.04,segmentFit:Object.freeze({price:.08,convenience:.16}),recipeMultipliers:Object.freeze({ramen_packaging:1.15})}),
  Object.freeze({id:'craft',name:'品質重視',description:'品質 +10 / 販売能力 -14% / スープ・具材 +20%',capacityMultiplier:.86,qualityDelta:10,serviceDelta:2,noveltyDelta:4,repeatRateDelta:.04,segmentFit:Object.freeze({quality:.18,brand:.08}),recipeMultipliers:Object.freeze({ramen_soup:1.2,ramen_toppings:1.2})}),
  Object.freeze({id:'community',name:'常連重視',description:'リピート +8pt / 日常需要に強い / 販売能力 -6%・流行性 -8',capacityMultiplier:.94,qualityDelta:2,serviceDelta:5,noveltyDelta:-8,repeatRateDelta:.08,segmentFit:Object.freeze({standard:.18,convenience:.08}),recipeMultipliers:Object.freeze({ramen_vegetables:1.08})})
]);

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const yen=value=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`;

function level(store){return Math.min(MAX_LEVEL,Math.max(1,Math.floor(finite(store?.level,1))));}
function isMaxLevel(store){return level(store)>=MAX_LEVEL;}
function capacityMultiplier(store){return 1+(level(store)-1)*CAPACITY_GAIN_PER_LEVEL;}

// Deterministic by construction: cost depends only on the business and the target level.
function upgradeCost(business,store){
  const base=Math.max(0,finite(business?.storeCost));
  const nextLevel=level(store)+1;
  return Math.round(base*(.25+nextLevel*.1));
}

function upgradeable(state,store){
  if(!store)return {ok:false,reason:'店舗が見つかりません。'};
  if(store.status==='closed')return {ok:false,reason:'閉店した店舗の設備は強化できません。'};
  if(isMaxLevel(store))return {ok:false,reason:'設備はすでに最大レベルです。'};
  return {ok:true,reason:''};
}

function plan(state,store,business){
  const current=level(store);
  const gate=upgradeable(state,store);
  const cost=gate.ok?upgradeCost(business,store):0;
  return Object.freeze({
    storeID:store?String(store.id):'',
    currentLevel:current,
    nextLevel:Math.min(MAX_LEVEL,current+1),
    maxLevel:MAX_LEVEL,
    atMaxLevel:isMaxLevel(store),
    cost,
    affordable:gate.ok&&finite(state?.companyCash)>=cost,
    capacityMultiplier:capacityMultiplier(store),
    nextCapacityMultiplier:1+(Math.min(MAX_LEVEL,current+1)-1)*CAPACITY_GAIN_PER_LEVEL,
    blockedReason:gate.ok?'':gate.reason
  });
}

function upgrade(engine,storeID){
  const state=engine.g;
  const store=(state.stores||[]).find(row=>String(row.id)===String(storeID));
  const gate=upgradeable(state,store);
  if(!gate.ok)return engine.fail(gate.reason);
  const business=engine.business(store.businessID);
  const cost=upgradeCost(business,store);
  if(finite(state.companyCash)<cost)return engine.fail(`設備強化には${yen(cost)}が必要です。`);
  const nextLevel=level(store)+1;
  state.companyCash-=cost;
  store.level=nextLevel;
  finance.addFixedAsset(state,{
    assetID:`store-equipment-${store.id}-L${nextLevel}`,
    assetType:'storeEquipment',
    acquisitionCost:cost,
    usefulLifeWeeks:USEFUL_LIFE_WEEKS,
    salvageValue:Math.round(cost*SALVAGE_RATE),
    businessID:store.businessID,
    storeID:store.id
  });
  finance.event(state,'capitalExpenditure',cost,{
    cashEffect:-cost,
    assetEffect:cost,
    businessID:store.businessID,
    storeID:store.id,
    sourceType:'storeEquipmentUpgrade',
    sourceID:store.id,
    description:`${store.name} 設備強化 Lv${nextLevel}`
  });
  engine.notify(`${store.name}の設備をLv${nextLevel}へ強化しました。`,'success');
  engine.save();
  engine.emit('change');
  return true;
}

function conditionOf(store){return clamp(finite(store?.condition,FULL_CONDITION),0,FULL_CONDITION);}

// Restoring wear is an expense, not an upgrade: it returns the store to its original
// state rather than adding capability, so it is charged to profit instead of capitalised.
function renovationCost(store){
  return Math.round(Math.max(0,FULL_CONDITION-conditionOf(store))*RENOVATION_COST_PER_POINT);
}

function renovatable(state,store){
  if(!store)return {ok:false,reason:'店舗が見つかりません。'};
  if(store.status==='closed')return {ok:false,reason:'閉店した店舗は改装できません。'};
  if(renovationCost(store)<=0)return {ok:false,reason:'この店舗は改装の必要がありません。'};
  return {ok:true,reason:''};
}

function renovationPlan(state,store){
  const condition=conditionOf(store);
  const gate=renovatable(state,store);
  const cost=gate.ok?renovationCost(store):0;
  return Object.freeze({
    storeID:store?String(store.id):'',
    condition,
    fullCondition:FULL_CONDITION,
    cost,
    weeklyUpkeepSaved:Math.round(Math.max(0,FULL_CONDITION-condition)*650),
    needed:gate.ok,
    affordable:gate.ok&&finite(state?.companyCash)>=cost,
    blockedReason:gate.ok?'':gate.reason
  });
}

function renovate(engine,storeID){
  const state=engine.g;
  const store=(state.stores||[]).find(row=>String(row.id)===String(storeID));
  const gate=renovatable(state,store);
  if(!gate.ok)return engine.fail(gate.reason);
  const cost=renovationCost(store);
  if(finite(state.companyCash)<cost)return engine.fail(`改装には${yen(cost)}が必要です。`);
  state.companyCash-=cost;
  store.condition=FULL_CONDITION;
  finance.event(state,'otherOperating',cost,{
    cashEffect:-cost,
    profitEffect:-cost,
    businessID:store.businessID,
    storeID:store.id,
    sourceType:'storeRenovation',
    sourceID:store.id,
    description:`${store.name} 改装`
  });
  engine.notify(`${store.name}を改装し、店舗状態を回復しました。`,'success');
  engine.save();
  engine.emit('change');
  return true;
}

function operatingHoursOf(store){
  const raw=Math.floor(finite(store?.operatingHours,DEFAULT_OPERATING_HOURS));
  return Number.isFinite(raw)&&raw>=MIN_OPERATING_HOURS&&raw<=MAX_OPERATING_HOURS?raw:DEFAULT_OPERATING_HOURS;
}

function operatingHoursOption(hours){
  return OPERATING_HOUR_OPTIONS.find(row=>row.value===hours)||OPERATING_HOUR_OPTIONS.find(row=>row.value===DEFAULT_OPERATING_HOURS);
}

function operatingHoursPlan(state,store){
  const current=operatingHoursOf(store);
  const closed=store?.status==='closed';
  return Object.freeze({
    storeID:store?String(store.id):'',
    current,
    currentName:operatingHoursOption(current).name,
    changeable:!closed,
    blockedReason:closed?'閉店した店舗の営業時間は変更できません。':'',
    options:OPERATING_HOUR_OPTIONS
  });
}

// Changing hours costs nothing up front; the trade-off is that demand and cost move
// by different amounts, so the choice is paid for through the weekly result instead.
function setOperatingHours(engine,storeID,hours){
  const state=engine.g;
  const store=(state.stores||[]).find(row=>String(row.id)===String(storeID));
  if(!store)return engine.fail('店舗が見つかりません。');
  if(store.status==='closed')return engine.fail('閉店した店舗の営業時間は変更できません。');
  const requested=Math.floor(finite(hours,NaN));
  if(!Number.isFinite(requested)||requested<MIN_OPERATING_HOURS||requested>MAX_OPERATING_HOURS){
    return engine.fail('その営業時間は選べません。');
  }
  if(operatingHoursOf(store)===requested)return false;
  store.operatingHours=requested;
  engine.notify(`${store.name}の営業時間を「${operatingHoursOption(requested).name}」に変更しました。`,'success');
  engine.save();
  engine.emit('change');
  return true;
}

function validPrice(value){return typeof value==='number'&&Number.isFinite(value)&&value>0;}
function pricingPlan(state,store,business){
  const businessPrice=Math.max(1,finite(business?.price,1));
  const isOverridden=validPrice(store?.priceOverride);
  return Object.freeze({storeID:store?String(store.id):'',businessPrice,
    overridePrice:isOverridden?store.priceOverride:null,effectivePrice:isOverridden?store.priceOverride:businessPrice,
    isOverridden,changeable:store?.status==='open',
    blockedReason:store?.status==='open'?'':'閉店した店舗の価格は変更できません。'});
}
function setStorePrice(engine,storeID,price){
  const store=(engine.g.stores||[]).find(row=>String(row.id)===String(storeID));
  if(!store)return engine.fail('店舗が見つかりません。');
  if(store.status!=='open')return engine.fail('営業中の店舗だけ価格を変更できます。');
  if(!validPrice(price))return engine.fail('価格は0より大きい有限の数値で指定してください。');
  if(store.priceOverride===price)return false;
  store.priceOverride=price;
  engine.notify(`${store.name}の店舗価格を${yen(price)}に変更しました。`,'success');
  engine.save();engine.emit('change');return true;
}
function resetStorePrice(engine,storeID){
  const store=(engine.g.stores||[]).find(row=>String(row.id)===String(storeID));
  if(!store)return engine.fail('店舗が見つかりません。');
  if(store.status!=='open')return engine.fail('営業中の店舗だけ価格を変更できます。');
  if(!Object.prototype.hasOwnProperty.call(store,'priceOverride'))return false;
  delete store.priceOverride;
  engine.notify(`${store.name}の価格を全社価格に戻しました。`,'success');
  engine.save();engine.emit('change');return true;
}

function menuDefinition(id){return MENU_CATALOG.find(row=>row.id===id)||null;}
function menuPlan(state,store,business){
  if(!store||store.businessID!=='ramen')return null;
  const base=pricingPlan(state,store,business).effectivePrice, seen=new Set(['classic']);
  const source=Array.isArray(store.menuItems)?store.menuItems:[];
  const valid=[{menuID:'classic'}];
  for(const item of source){if(!item||typeof item!=='object'||item.menuID==='classic'||seen.has(item.menuID)||!menuDefinition(item.menuID))continue;seen.add(item.menuID);valid.push({menuID:item.menuID,...(validPrice(item.priceOverride)?{priceOverride:item.priceOverride}:{})});}
  const items=valid.map(item=>{const def=menuDefinition(item.menuID), overridden=item.menuID!=='classic'&&validPrice(item.priceOverride);return Object.freeze({...def,active:true,isClassic:item.menuID==='classic',isOverridden:overridden,priceOverride:overridden?item.priceOverride:null,effectivePrice:item.menuID==='classic'?base:(overridden?item.priceOverride:Math.round(base*def.priceMultiplier))});});
  return Object.freeze({storeID:String(store.id),basePrice:base,changeable:store.status==='open',items:Object.freeze(items),inactive:Object.freeze(MENU_CATALOG.filter(def=>!seen.has(def.id)))});
}
function menuGate(engine,storeID,menuID,allowClassic=false){const store=(engine.g.stores||[]).find(row=>String(row.id)===String(storeID));if(!store)return {error:'店舗が見つかりません。'};if(store.businessID!=='ramen')return {error:'ラーメン店舗だけメニューを変更できます。'};if(store.status!=='open')return {error:'営業中の店舗だけメニューを変更できます。'};const def=menuDefinition(menuID);if(!def)return {error:'そのメニューは選べません。'};if(!allowClassic&&menuID==='classic')return {error:'定番ラーメンは外せません。'};return {store,def};}
function persistMenu(engine,store,message){engine.notify(message,'success');engine.save();engine.emit('change');return true;}
function addMenu(engine,storeID,menuID){const gate=menuGate(engine,storeID,menuID);if(gate.error)return engine.fail(gate.error);const plan=menuPlan(engine.g,gate.store,engine.business(gate.store.businessID));if(plan.items.some(x=>x.id===menuID))return engine.fail('そのメニューは追加済みです。');gate.store.menuItems=plan.items.map(x=>({menuID:x.id,...(x.isOverridden?{priceOverride:x.priceOverride}:{})})).concat({menuID});return persistMenu(engine,gate.store,`${gate.def.name}をメニューに追加しました。`);}
function removeMenu(engine,storeID,menuID){const gate=menuGate(engine,storeID,menuID);if(gate.error)return engine.fail(gate.error);const plan=menuPlan(engine.g,gate.store,engine.business(gate.store.businessID));if(!plan.items.some(x=>x.id===menuID))return engine.fail('そのメニューは追加されていません。');gate.store.menuItems=plan.items.filter(x=>x.id!==menuID).map(x=>({menuID:x.id,...(x.isOverridden?{priceOverride:x.priceOverride}:{})}));return persistMenu(engine,gate.store,`${gate.def.name}をメニューから外しました。`);}
function setMenuPrice(engine,storeID,menuID,price){const gate=menuGate(engine,storeID,menuID);if(gate.error)return engine.fail(gate.error);if(!validPrice(price))return engine.fail('価格は0より大きい有限の数値で指定してください。');const plan=menuPlan(engine.g,gate.store,engine.business(gate.store.businessID));if(!plan.items.some(x=>x.id===menuID))return engine.fail('そのメニューは追加されていません。');gate.store.menuItems=plan.items.map(x=>({menuID:x.id,...(x.id===menuID?{priceOverride:price}:(x.isOverridden?{priceOverride:x.priceOverride}:{}))}));return persistMenu(engine,gate.store,`${gate.def.name}の価格を${yen(price)}に変更しました。`);}
function resetMenuPrice(engine,storeID,menuID){const gate=menuGate(engine,storeID,menuID);if(gate.error)return engine.fail(gate.error);const plan=menuPlan(engine.g,gate.store,engine.business(gate.store.businessID)), item=plan.items.find(x=>x.id===menuID);if(!item)return engine.fail('そのメニューは追加されていません。');if(!item.isOverridden)return false;gate.store.menuItems=plan.items.map(x=>({menuID:x.id,...(x.id!==menuID&&x.isOverridden?{priceOverride:x.priceOverride}:{})}));return persistMenu(engine,gate.store,`${gate.def.name}の価格を標準価格に戻しました。`);}

function conceptDefinition(id){return STORE_CONCEPTS.find(row=>row.id===id)||STORE_CONCEPTS[0];}
function conceptOf(store){return conceptDefinition(typeof store?.conceptID==='string'?store.conceptID:DEFAULT_STORE_CONCEPT);}
function conceptPlan(state,store){if(!store||store.businessID!=='ramen')return null;const current=conceptOf(store),transitionUntilWeek=Math.max(0,Math.floor(finite(store.conceptTransitionUntilWeek,0)));return Object.freeze({storeID:String(store.id),current,currentID:current.id,options:STORE_CONCEPTS,cost:STORE_CONCEPT_CHANGE_COST,changeable:store.status==='open'&&finite(state?.week)>=transitionUntilWeek,transitionActive:finite(state?.week)<transitionUntilWeek,transitionUntilWeek,blockedReason:store.status==='open'?'':'営業中のラーメン店舗だけコンセプトを変更できます。'});}
function setConcept(engine,storeID,conceptID){const state=engine.g,store=(state.stores||[]).find(row=>String(row.id)===String(storeID));if(!store)return engine.fail('店舗が見つかりません。');if(store.businessID!=='ramen'||store.status!=='open')return engine.fail('営業中のラーメン店舗だけコンセプトを変更できます。');if(finite(state.week)<finite(store.conceptTransitionUntilWeek))return engine.fail('コンセプト移行中は再変更できません。');const requested=STORE_CONCEPTS.find(row=>row.id===conceptID);if(!requested)return engine.fail('その店舗コンセプトは選べません。');if(conceptOf(store).id===requested.id)return false;if(finite(state.companyCash)<STORE_CONCEPT_CHANGE_COST)return engine.fail(`コンセプト変更には${yen(STORE_CONCEPT_CHANGE_COST)}が必要です。`);state.companyCash-=STORE_CONCEPT_CHANGE_COST;store.conceptID=requested.id;store.conceptTransitionUntilWeek=Math.floor(finite(state.week))+STORE_CONCEPT_TRANSITION_WEEKS;finance.event(state,'otherOperating',STORE_CONCEPT_CHANGE_COST,{cashEffect:-STORE_CONCEPT_CHANGE_COST,profitEffect:-STORE_CONCEPT_CHANGE_COST,businessID:store.businessID,storeID:store.id,sourceType:'storeConceptChange',sourceID:store.id,operationID:`store-concept-${store.id}-w${Math.floor(finite(state.week))}`,description:`${store.name} コンセプト変更（${requested.name}）`});engine.notify(`${store.name}を「${requested.name}」へ変更しました。移行期間は販売能力が低下します。`,'success');engine.save();engine.emit('change');return true;}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__storeEquipmentInstalled)return true;
  proto.storeEquipmentPlan=function(storeID){
    const store=(this.g.stores||[]).find(row=>String(row.id)===String(storeID));
    return store?plan(this.g,store,this.business(store.businessID)):null;
  };
  proto.upgradeStoreEquipment=function(storeID){return upgrade(this,storeID);};
  proto.storeRenovationPlan=function(storeID){
    const store=(this.g.stores||[]).find(row=>String(row.id)===String(storeID));
    return store?renovationPlan(this.g,store):null;
  };
  proto.renovateStore=function(storeID){return renovate(this,storeID);};
  proto.storeOperatingHoursPlan=function(storeID){
    const store=(this.g.stores||[]).find(row=>String(row.id)===String(storeID));
    return store?operatingHoursPlan(this.g,store):null;
  };
  proto.setStoreOperatingHours=function(storeID,hours){return setOperatingHours(this,storeID,hours);};
  proto.getStorePricingPlan=function(storeID){const store=(this.g.stores||[]).find(row=>String(row.id)===String(storeID));return store?pricingPlan(this.g,store,this.business(store.businessID)):null;};
  proto.setStorePrice=function(storeID,price){return setStorePrice(this,storeID,price);};
  proto.resetStorePrice=function(storeID){return resetStorePrice(this,storeID);};
  proto.getStoreMenuPlan=function(storeID){const store=(this.g.stores||[]).find(row=>String(row.id)===String(storeID));return store?menuPlan(this.g,store,this.business(store.businessID)):null;};
  proto.addStoreMenuItem=function(storeID,menuID){return addMenu(this,storeID,menuID);};
  proto.removeStoreMenuItem=function(storeID,menuID){return removeMenu(this,storeID,menuID);};
  proto.setStoreMenuItemPrice=function(storeID,menuID,price){return setMenuPrice(this,storeID,menuID,price);};
  proto.resetStoreMenuItemPrice=function(storeID,menuID){return resetMenuPrice(this,storeID,menuID);};
  proto.getStoreConceptPlan=function(storeID){const store=(this.g.stores||[]).find(row=>String(row.id)===String(storeID));return conceptPlan(this.g,store);};
  proto.setStoreConcept=function(storeID,conceptID){return setConcept(this,storeID,conceptID);};
  Object.defineProperty(proto,'__storeEquipmentInstalled',{value:true});
  return true;
}

install();
modules.storeEquipment=Object.freeze({
  MAX_LEVEL,USEFUL_LIFE_WEEKS,SALVAGE_RATE,CAPACITY_GAIN_PER_LEVEL,
  FULL_CONDITION,RENOVATION_COST_PER_POINT,
  MIN_OPERATING_HOURS,MAX_OPERATING_HOURS,DEFAULT_OPERATING_HOURS,OPERATING_HOUR_OPTIONS,
  level,isMaxLevel,capacityMultiplier,upgradeCost,upgradeable,plan,upgrade,
  conditionOf,renovationCost,renovatable,renovationPlan,renovate,
  operatingHoursOf,operatingHoursOption,operatingHoursPlan,setOperatingHours,
  validPrice,pricingPlan,setStorePrice,resetStorePrice,
  MENU_CATALOG,menuDefinition,menuPlan,addMenu,removeMenu,setMenuPrice,resetMenuPrice,
  STORE_CONCEPT_CHANGE_COST,STORE_CONCEPT_TRANSITION_WEEKS,DEFAULT_STORE_CONCEPT,STORE_CONCEPTS,conceptDefinition,conceptOf,conceptPlan,setConcept,
  install,
  __installed:true
});
})();
