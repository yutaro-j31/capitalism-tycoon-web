// Phase 8B-1: deterministic macroeconomic cycle and industry climate.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before macro-cycle.js.');
if(modules.macroCycle)throw new Error('macro cycle is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const VERSION=1,HISTORY_LIMIT=104;
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const REGIMES=Object.freeze([
  Object.freeze({id:'recovery',name:'回復局面',economy:.006,inflation:.002,rate:.0002,property:.004,fx:.001,demand:1.03}),
  Object.freeze({id:'expansion',name:'拡大局面',economy:.009,inflation:.004,rate:.0005,property:.007,fx:.002,demand:1.06}),
  Object.freeze({id:'overheat',name:'過熱局面',economy:.003,inflation:.008,rate:.0012,property:.004,fx:.004,demand:1.03}),
  Object.freeze({id:'slowdown',name:'減速局面',economy:-.006,inflation:-.002,rate:-.0002,property:-.006,fx:-.001,demand:.96}),
  Object.freeze({id:'recession',name:'後退局面',economy:-.010,inflation:-.004,rate:-.0008,property:-.009,fx:-.003,demand:.91})
]);
function regimeForWeek(week){const cycle=((Math.max(1,integer(week,1))-1)%130)+1;if(cycle<=20)return REGIMES[0];if(cycle<=58)return REGIMES[1];if(cycle<=76)return REGIMES[2];if(cycle<=102)return REGIMES[3];return REGIMES[4];}
function ensure(state){if(!state||typeof state!=='object')return state;state.macroCycleVersion=Math.max(VERSION,integer(state.macroCycleVersion));state.macroHistory=Array.isArray(state.macroHistory)?state.macroHistory.filter(Boolean).slice(0,HISTORY_LIMIT):[];state.lastMacroCycleWeek=Math.max(0,integer(state.lastMacroCycleWeek));state.macroRegime=REGIMES.some(x=>x.id===state.macroRegime)?state.macroRegime:regimeForWeek(state.week).id;state.industryClimate=state.industryClimate&&typeof state.industryClimate==='object'?state.industryClimate:{};return state;}
function pushHistory(state,row){state.macroHistory.unshift(row);state.macroHistory=state.macroHistory.slice(0,HISTORY_LIMIT);state.history=Array.isArray(state.history)?state.history:[];state.history.unshift(row);state.history=state.history.slice(0,400);}
function industryMultipliers(regime){return {consumer:regime.demand,discretionary:clamp(regime.demand+(regime.id==='overheat'?.02:regime.id==='recession'?-0.05:0),.75,1.2),enterprise:clamp(1+(regime.demand-1)*.7,.8,1.15),realEstate:clamp(1+regime.property*5,.78,1.22),capitalCost:clamp(1+regime.rate*20,.8,1.3)};}
function update(state){ensure(state);const week=Math.max(1,integer(state.week,1));if(state.lastMacroCycleWeek===week)return null;const previous=state.macroRegime,regime=regimeForWeek(week);state.lastMacroCycleWeek=week;state.macroRegime=regime.id;state.economy=clamp(finite(state.economy,1)+regime.economy,.72,1.32);state.inflation=clamp(finite(state.inflation,1)+regime.inflation,.82,1.28);state.policyRate=clamp(finite(state.policyRate,.005)+regime.rate,0,.08);state.realEstateCycle=clamp(finite(state.realEstateCycle,1)+regime.property,.68,1.4);state.exchangeRate=clamp(finite(state.exchangeRate,1)+regime.fx,.72,1.35);state.industryClimate=industryMultipliers(regime);const row={week,type:'macroCycle',regime:regime.id,regimeName:regime.name,economy:state.economy,inflation:state.inflation,policyRate:state.policyRate,realEstateCycle:state.realEstateCycle,exchangeRate:state.exchangeRate};pushHistory(state,row);if(previous!==regime.id){state.news=Array.isArray(state.news)?state.news:[];state.news.unshift(`第${week}週：景気局面が「${regime.name}」へ移行しました。需要、金利、不動産市況が変化します。`);state.news=state.news.slice(0,300);}return row;}
function validate(state){ensure(state);const errors=[];if(!REGIMES.some(x=>x.id===state.macroRegime))errors.push('invalid macro regime');for(const key of ['economy','inflation','policyRate','realEstateCycle','exchangeRate'])if(!Number.isFinite(Number(state[key])))errors.push(`non-finite ${key}`);if(state.macroHistory.length>HISTORY_LIMIT)errors.push('macro history overflow');return{ok:errors.length===0,errors};}
const proto=EngineClass.prototype;
if(!proto.__macroCycleInstalled){const baseNormalize=proto.normalize;proto.normalize=function(){baseNormalize.call(this);ensure(this.g);};proto.ensureMacroCycleDefaults=function(){return ensure(this.g);};proto.updateMacroCycleWeekly=function(){return update(this.g);};const baseWeekly=proto.updateProductInnovationWeekly;if(typeof baseWeekly==='function')proto.updateProductInnovationWeekly=function(){const result=baseWeekly.call(this);this.updateMacroCycleWeekly();return result;};else{const baseAdvance=proto.advanceWeek;proto.advanceWeek=function(){const result=baseAdvance.apply(this,arguments);this.updateMacroCycleWeekly();return result;};}Object.defineProperty(proto,'__macroCycleInstalled',{value:true});}
modules.macroCycle=Object.freeze({VERSION,REGIMES,ensure,update,validate,regimeForWeek,industryMultipliers,__installed:true});
})();
