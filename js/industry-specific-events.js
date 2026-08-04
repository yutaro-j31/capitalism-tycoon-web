// Phase 8C.2: deterministic business-specific demand, cost, regulation, technology, and supply modifiers.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before industry-specific-events.js.');
if(!modules?.macroCycle?.EVENTS)throw new Error('macro-cycle.js must load before industry-specific-events.js.');
if(modules.industrySpecificEvents)throw new Error('industry-specific events module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const VERSION=1,HISTORY_LIMIT=52;
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
const PROFILES=Object.freeze({
  ramen:{sector:'food',demand:.85,cost:1.2,regulation:.6,technology:.25,supply:1.05},cafe:{sector:'food',demand:1,cost:1.05,regulation:.55,technology:.3,supply:.9},conveni:{sector:'retail',demand:.55,cost:.8,regulation:.45,technology:.65,supply:.7},apparel:{sector:'retail',demand:1.15,cost:.7,regulation:.35,technology:.45,supply:.85},gym:{sector:'service',demand:1,cost:.35,regulation:.65,technology:.5,supply:.2},appStudio:{sector:'digital',demand:1.15,cost:.15,regulation:.5,technology:1.3,supply:.1}
});
const EVENT_EFFECTS=Object.freeze({
  energySpike:{demand:-.03,cost:.12,regulation:.01,technology:0,supply:-.10},
  digitalBoom:{demand:.08,cost:-.01,regulation:.01,technology:.14,supply:.02},
  creditTightening:{demand:-.08,cost:.025,regulation:.03,technology:-.02,supply:-.03},
  inboundBoom:{demand:.12,cost:.025,regulation:0,technology:.01,supply:.04}
});
function profileFor(id){return PROFILES[id]||{sector:'general',demand:.7,cost:.6,regulation:.5,technology:.5,supply:.5};}
function ensure(state){if(!state||typeof state!=='object')return state;state.industrySpecificEventVersion=Math.max(VERSION,Math.floor(finite(state.industrySpecificEventVersion)));state.industrySpecificModifiers=state.industrySpecificModifiers&&typeof state.industrySpecificModifiers==='object'&&!Array.isArray(state.industrySpecificModifiers)?state.industrySpecificModifiers:{};state.industrySpecificEventHistory=Array.isArray(state.industrySpecificEventHistory)?state.industrySpecificEventHistory.filter(Boolean).slice(0,HISTORY_LIMIT):[];return state;}
function modifiersFor(eventId,businessId){const p=profileFor(businessId),e=EVENT_EFFECTS[eventId];if(!e)return{demand:1,unitCost:1,regulation:1,technology:1,supply:1};return{
 demand:clamp(1+e.demand*p.demand,.72,1.3),unitCost:clamp(1+e.cost*p.cost,.78,1.35),regulation:clamp(1+e.regulation*p.regulation,.9,1.2),technology:clamp(1+e.technology*p.technology,.85,1.35),supply:clamp(1+e.supply*p.supply,.72,1.25)
};}
function refresh(instance){const state=ensure(instance.g),eventId=state.activeIndustryEvent?.id||null,businesses=Array.isArray(state.businesses)?state.businesses:[];const next={};for(const business of businesses){if(!business?.id)continue;next[business.id]=modifiersFor(eventId,business.id);}const previousEvent=state.industrySpecificActiveEventId||null;state.industrySpecificModifiers=next;state.industrySpecificActiveEventId=eventId;if(previousEvent!==eventId){state.industrySpecificEventHistory.unshift({week:Math.max(1,Math.floor(finite(state.week,1))),eventId,modifiers:Object.keys(next).length});state.industrySpecificEventHistory=state.industrySpecificEventHistory.slice(0,HISTORY_LIMIT);}return next;}
function withAppliedModifiers(instance,callback){const state=ensure(instance.g),map=refresh(instance),businesses=Array.isArray(state.businesses)?state.businesses:[],snapshots=[];for(const business of businesses){const m=map[business.id];if(!m)continue;snapshots.push([business,business.demand,business.unitCost]);business.demand=Math.max(0,finite(business.demand,1)*m.demand);business.unitCost=Math.max(0,finite(business.unitCost)*m.unitCost/m.supply);}try{return callback();}finally{for(const [business,demand,unitCost] of snapshots){business.demand=demand;business.unitCost=unitCost;}}}
function validate(state){ensure(state);const errors=[];if(state.industrySpecificEventHistory.length>HISTORY_LIMIT)errors.push('industry-specific event history overflow');for(const [id,m] of Object.entries(state.industrySpecificModifiers)){if(!m||['demand','unitCost','regulation','technology','supply'].some(k=>!Number.isFinite(Number(m[k]))))errors.push(`invalid industry modifier: ${id}`);}return{ok:errors.length===0,errors};}
const proto=EngineClass.prototype;
const baseNormalize=proto.normalize;proto.normalize=function(){baseNormalize.call(this);ensure(this.g);refresh(this);};
const baseAdvance=proto.advanceWeek;proto.advanceWeek=function(){return withAppliedModifiers(this,()=>baseAdvance.apply(this,arguments));};
proto.getIndustrySpecificModifiers=function(businessId){ensure(this.g);return this.g.industrySpecificModifiers[businessId]||modifiersFor(this.g.activeIndustryEvent?.id||null,businessId);};
Object.defineProperty(proto,'__industrySpecificEventsInstalled',{value:true});
modules.industrySpecificEvents=Object.freeze({VERSION,HISTORY_LIMIT,PROFILES,EVENT_EFFECTS,profileFor,ensure,modifiersFor,refresh,withAppliedModifiers,validate,__installed:true});
})();
