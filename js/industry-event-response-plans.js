// Phase 8C.2: deterministic response plans for active industry events.
(function(){'use strict';
const m=globalThis.__capitalismTycoonModules;
if(!m?.engine?.TycoonEngine)throw new Error('engine.js must load first');
if(!m?.industrySpecificEvents?.ensure)throw new Error('industry-specific-events.js must load first');
if(!m?.finance?.event)throw new Error('finance.js must load first');
if(m.industryEventResponsePlans)throw new Error('industry response plans already registered');
const E=m.engine.TycoonEngine,f=m.finance,V=1,L=52;
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const i=(v,d=0)=>Math.max(0,Math.floor(n(v,d)));
const P=Object.freeze({demandDefense:{title:'需要防衛',demand:1.08,cost:1.015,base:900000},supplyHedge:{title:'供給・原価ヘッジ',demand:1,cost:.92,base:1250000},technologyInvestment:{title:'技術投資',demand:1.035,cost:.975,base:1800000}});
function ensure(s){if(!s||typeof s!=='object')return s;s.industryEventResponsePlanVersion=Math.max(V,i(s.industryEventResponsePlanVersion));s.activeIndustryEventResponsePlan=s.activeIndustryEventResponsePlan&&typeof s.activeIndustryEventResponsePlan==='object'?s.activeIndustryEventResponsePlan:null;s.industryEventResponsePlanHistory=Array.isArray(s.industryEventResponsePlanHistory)?s.industryEventResponsePlanHistory.filter(Boolean).slice(-L):[];return s;}
const eventId=s=>s?.activeIndustryEvent?.id||null;
function cost(s,t){const count=Math.max(1,Array.isArray(s?.businesses)?s.businesses.length:1),base=P[t]?.base||0;return Math.max(250000,Math.floor(Math.min(base*count,Math.max(base,Math.max(0,n(s?.companyCash))*.06))));}
function record(s,row){s.industryEventResponsePlanHistory.unshift({week:Math.max(1,i(s.week,1)),...row});s.industryEventResponsePlanHistory=s.industryEventResponsePlanHistory.slice(0,L);}
function expire(s){ensure(s);const p=s.activeIndustryEventResponsePlan;if(p&&p.eventId!==eventId(s)){record(s,{type:'expired',planType:p.type,eventId:p.eventId});s.activeIndustryEventResponsePlan=null;return true;}return false;}
function activate(x,t){const s=ensure(x.g),p=P[t],eid=eventId(s);if(!p||!eid)return false;expire(s);if(s.activeIndustryEventResponsePlan?.eventId===eid)return false;const amount=cost(s,t);if(n(s.companyCash)<amount)return false;return x.runTransaction(()=>{const week=Math.max(1,i(s.week,1));s.companyCash=Math.max(0,n(s.companyCash)-amount);f.event(s,'operatingExpense',amount,{cashEffect:-amount,profitEffect:-amount,sourceType:'industryEventResponsePlan',sourceID:`${eid}-${week}-${t}`,idempotencyKey:`industry-response-${eid}-${week}-${t}`,description:`業界イベント対応計画：${p.title}`});s.activeIndustryEventResponsePlan={eventId:eid,type:t,title:p.title,startedWeek:week,status:'active',cost:amount};record(s,{type:'activated',planType:t,eventId:eid,cost:amount});f.rebuildSnapshotForWeek?.(s,week);return true;});}
function withPlan(x,cb){const s=ensure(x.g);expire(s);const p=s.activeIndustryEventResponsePlan&&P[s.activeIndustryEventResponsePlan.type];if(!p||s.activeIndustryEventResponsePlan.eventId!==eventId(s))return cb();const rows=Array.isArray(s.businesses)?s.businesses:[],snap=[];for(const b of rows){if(!b)continue;snap.push([b,b.demand,b.unitCost]);b.demand=Math.max(0,n(b.demand,1)*p.demand);b.unitCost=Math.max(0,n(b.unitCost)*p.cost);}try{return cb();}finally{for(const [b,d,c] of snap){b.demand=d;b.unitCost=c;}}}
function validate(s){ensure(s);const e=[];if(s.industryEventResponsePlanHistory.length>L)e.push('history overflow');const p=s.activeIndustryEventResponsePlan;if(p&&(!P[p.type]||!p.eventId||!Number.isFinite(Number(p.cost))))e.push('invalid active plan');return{ok:e.length===0,errors:e};}
const bn=E.prototype.normalize,ba=E.prototype.advanceWeek;E.prototype.normalize=function(){bn.call(this);ensure(this.g);expire(this.g);};E.prototype.advanceWeek=function(){return withPlan(this,()=>ba.apply(this,arguments));};E.prototype.activateIndustryEventResponsePlan=function(t){return activate(this,t);};E.prototype.getIndustryEventResponsePlanCost=function(t){return cost(this.g,t);};
Object.defineProperty(E.prototype,'__industryEventResponsePlansInstalled',{value:true});
m.industryEventResponsePlans=Object.freeze({VERSION:V,HISTORY_LIMIT:L,PLANS:P,ensure,eventId,cost,expire,activate,withPlan,validate,__installed:true});
})();
