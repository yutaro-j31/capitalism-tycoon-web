// R6 remaining item "メニューR&D": before this, every non-classic entry in
// js/store-equipment.js's MENU_CATALOG could be added to any open ramen store instantly and
// for free -- addMenu() charged nothing and gated on nothing but the store being open. This
// ties new menu unlocks to 商品開発部門 (the department whose own description already reads
// "商品開発を解放" -- it already gates RD_PROJECTS, PRODUCT_BLUEPRINTS and internal venture
// proposals in js/expansion.js and js/engine.js, so reusing it here is the existing model,
// not a new one) and to a real cost + delay, following the exact commit-now/reveal-later
// idiom js/pe-value-creation.js established for PE initiatives: at most one menu item in
// research at a time (bandwidth), and the unlock lands automatically once the delay elapses.
//
// Menus a save already added before this feature existed keep working -- the lock only
// blocks a future call to addMenu(), it does not retroactively strip anything already on
// store.menuItems.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before menu-research.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before menu-research.js.');
if(!modules.storeEquipment)throw new Error('store-equipment.js must be loaded before menu-research.js.');
if(modules.menuResearch)throw new Error('menu research is already registered.');
const EngineClass=modules.engine.TycoonEngine,finance=modules.finance;
const MENU_CATALOG=modules.storeEquipment.MENU_CATALOG;

const RESEARCH_DELAY_WEEKS=3;
// Cost is derived from how differentiated the item is (|qualityDelta|+|noveltyDelta|) rather
// than hand-picked per item, matching js/pe-value-creation.js's initiativeCost() and this
// codebase's general preference for a formula over a table of magic numbers.
const RESEARCH_BASE_COST=250000;
const RESEARCH_POWER_RATE=15000;
const ALWAYS_UNLOCKED=Object.freeze(['classic']);

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const yen=value=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`;

function researchCost(def){
  const power=Math.abs(finite(def?.qualityDelta))+Math.abs(finite(def?.noveltyDelta));
  return Math.round(RESEARCH_BASE_COST+RESEARCH_POWER_RATE*power);
}

function ensure(state){
  if(!state||typeof state!=='object')return {unlockedIDs:[...ALWAYS_UNLOCKED],pending:null,completedWeekByID:{}};
  if(!state.menuResearch||typeof state.menuResearch!=='object')state.menuResearch={};
  const r=state.menuResearch;
  if(!Array.isArray(r.unlockedIDs))r.unlockedIDs=[];
  for(const id of ALWAYS_UNLOCKED)if(!r.unlockedIDs.includes(id))r.unlockedIDs.push(id);
  r.unlockedIDs=r.unlockedIDs.filter(id=>MENU_CATALOG.some(def=>def.id===id));
  if(!r.pending||typeof r.pending!=='object'||!MENU_CATALOG.some(def=>def.id===r.pending.menuID))r.pending=null;
  const source=r.completedWeekByID;
  const completed={};
  if(source&&typeof source==='object'&&!Array.isArray(source))for(const def of MENU_CATALOG){
    if(ALWAYS_UNLOCKED.includes(def.id)||!Object.prototype.hasOwnProperty.call(source,def.id))continue;
    const week=Number(source[def.id]);
    if(Number.isFinite(week)&&week>=0)completed[def.id]=Math.floor(week);
  }
  r.completedWeekByID=completed;
  return r;
}

function lifecycle(state,menuID){
  const def=MENU_CATALOG.find(row=>row.id===menuID),r=ensure(state),currentWeek=Number(state?.week);
  const completionWeek=r.completedWeekByID[menuID];
  if(!def||!Number.isFinite(currentWeek)||!Number.isFinite(completionWeek)||completionWeek<0||completionWeek>currentWeek){
    return Object.freeze({ageWeeks:null,multiplier:1,stage:null,isLegacy:true});
  }
  const ageWeeks=Math.max(0,Math.floor(currentWeek)-completionWeek);
  if(ageWeeks<=3)return Object.freeze({ageWeeks,multiplier:1,stage:'新作',isLegacy:false});
  if(ageWeeks<=12)return Object.freeze({ageWeeks,multiplier:.75,stage:'話題',isLegacy:false});
  if(ageWeeks<=25)return Object.freeze({ageWeeks,multiplier:.45,stage:'定着',isLegacy:false});
  return Object.freeze({ageWeeks,multiplier:.2,stage:'成熟',isLegacy:false});
}

function isUnlocked(state,menuID){
  if(ALWAYS_UNLOCKED.includes(menuID))return true;
  return ensure(state).unlockedIDs.includes(menuID);
}

function plan(state){
  const r=ensure(state);
  return Object.freeze({
    hasDepartment:Boolean(state?.departments?.product),
    pending:r.pending?Object.freeze({
      menuID:r.pending.menuID,
      name:MENU_CATALOG.find(def=>def.id===r.pending.menuID)?.name||'',
      resolveWeek:r.pending.resolveWeek,
      weeksRemaining:Math.max(0,r.pending.resolveWeek-finite(state?.week))
    }):null,
    items:Object.freeze(MENU_CATALOG.filter(def=>!ALWAYS_UNLOCKED.includes(def.id)).map(def=>Object.freeze({
      id:def.id,name:def.name,strategyLabel:def.strategyLabel,
      unlocked:r.unlockedIDs.includes(def.id),
      cost:researchCost(def)
    })))
  });
}

function startResearch(engine,menuID){
  const state=engine.g,r=ensure(state),def=MENU_CATALOG.find(row=>row.id===menuID);
  if(!def||ALWAYS_UNLOCKED.includes(menuID))return engine.fail('そのメニューは研究できません。');
  if(r.unlockedIDs.includes(menuID))return engine.fail('既に開発済みです。');
  if(!state.departments?.product)return engine.fail('商品開発部門が必要です。');
  if(r.pending)return engine.fail('既に別のメニューを開発中です。開発完了までお待ちください。');
  const cost=researchCost(def);
  if(finite(state.companyCash)<cost)return engine.fail(`メニュー開発には${yen(cost)}が必要です。`);
  state.companyCash-=cost;
  const week=Math.floor(finite(state.week));
  finance.event(state,'otherOperating',cost,{cashEffect:-cost,profitEffect:-cost,sourceType:'menuResearch',sourceID:menuID,operationID:`menu-research-${menuID}-w${week}`,idempotencyKey:`menu-research-${menuID}-w${week}`,description:`メニュー開発（${def.name}）`});
  const resolveWeek=week+RESEARCH_DELAY_WEEKS;
  r.pending={menuID,committedWeek:week,resolveWeek};
  engine.notify(`「${def.name}」の開発に着手しました。完了は第${resolveWeek}週の予定です。`,'info');
  engine.save();engine.emit('change');
  return true;
}

function resolvePending(engine){
  const state=engine.g,r=ensure(state);
  if(!r.pending||finite(state.week)<finite(r.pending.resolveWeek))return false;
  const def=MENU_CATALOG.find(row=>row.id===r.pending.menuID);
  if(def&&!r.unlockedIDs.includes(def.id)){
    r.unlockedIDs.push(def.id);
    if(!Object.prototype.hasOwnProperty.call(r.completedWeekByID,def.id))r.completedWeekByID[def.id]=Math.floor(finite(r.pending.resolveWeek));
    engine.notify(`「${def.name}」の開発が完了し、メニューに追加できるようになりました。`,'success');
  }
  r.pending=null;
  return true;
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__menuResearchInstalled)return true;
  proto.menuResearchPlan=function(){return plan(this.g);};
  proto.startMenuResearch=function(menuID){return startResearch(this,menuID);};
  Object.defineProperty(proto,'__menuResearchInstalled',{value:true});
  return true;
}
install();
modules.menuResearch=Object.freeze({
  RESEARCH_DELAY_WEEKS,RESEARCH_BASE_COST,RESEARCH_POWER_RATE,ALWAYS_UNLOCKED,
  researchCost,ensure,isUnlocked,lifecycle,plan,startResearch,resolvePending,install,
  __installed:true
});
})();
