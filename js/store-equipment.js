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

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
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

function install(){
  const proto=EngineClass.prototype;
  if(proto.__storeEquipmentInstalled)return true;
  proto.storeEquipmentPlan=function(storeID){
    const store=(this.g.stores||[]).find(row=>String(row.id)===String(storeID));
    return store?plan(this.g,store,this.business(store.businessID)):null;
  };
  proto.upgradeStoreEquipment=function(storeID){return upgrade(this,storeID);};
  Object.defineProperty(proto,'__storeEquipmentInstalled',{value:true});
  return true;
}

install();
modules.storeEquipment=Object.freeze({
  MAX_LEVEL,USEFUL_LIFE_WEEKS,SALVAGE_RATE,CAPACITY_GAIN_PER_LEVEL,
  level,isMaxLevel,capacityMultiplier,upgradeCost,upgradeable,plan,upgrade,install,
  __installed:true
});
})();
