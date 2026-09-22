// Phase 8F.3: one bounded, deterministic company recall crisis.
(function(){'use strict';
const m=globalThis.__capitalismTycoonModules;
if(!m?.engine?.TycoonEngine)throw new Error('engine.js must load before company-recall-crisis.js');
if(!m?.finance?.event)throw new Error('finance.js must load before company-recall-crisis.js');
if(m.companyRecallCrisis)throw new Error('companyRecallCrisis already registered');
const E=m.engine.TycoonEngine,f=m.finance;
const VERSION=1,HISTORY_LIMIT=20;
const ELIGIBLE_BUSINESSES=Object.freeze(['ramen','conveni']);
const TRIGGER_WEEK_MIN=104,TRIGGER_INTERVAL_WEEKS=13,CONDITION_THRESHOLD=45;
const BASE_DURATION_WEEKS=8,RESPONSE_DURATION_WEEKS=3;
const UNTREATED_SALES_MULTIPLIER=.60,RESPONDED_SALES_MULTIPLIER=.85;
const START_REPUTATION_HIT=4,WEEKLY_REPUTATION_HIT=.8,RESPONDED_WEEKLY_REPUTATION_HIT=.2,RESOLUTION_REPUTATION_RECOVERY=1;
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const i=(v,d=0)=>Math.max(0,Math.floor(n(v,d)));
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,n(v,min)));
const arr=v=>Array.isArray(v)?v:[];
const textCompare=(a,b)=>{a=String(a);b=String(b);return a===b?0:a<b?-1:1;};

function ensure(s){
  if(!s||typeof s!=='object')return s;
  s.companyRecallCrisisVersion=Math.max(VERSION,i(s.companyRecallCrisisVersion));
  s.recallCrisisHistory=arr(s.recallCrisisHistory).filter(Boolean).slice(0,HISTORY_LIMIT);
  const c=s.activeRecallCrisis;
  if(!c||typeof c!=='object'||c.status!=='active'){s.activeRecallCrisis=null;return s;}
  c.id=String(c.id||`recall-${c.businessID||'unknown'}-${i(c.startedWeek,1)}`);
  c.businessID=String(c.businessID||'ramen');
  c.storeID=c.storeID===null||c.storeID===undefined?null:String(c.storeID);
  c.startedWeek=Math.max(1,i(c.startedWeek,1));
  c.baseResolveWeek=Math.max(c.startedWeek,i(c.baseResolveWeek,c.startedWeek+BASE_DURATION_WEEKS-1));
  c.resolveWeek=Math.max(c.startedWeek,i(c.resolveWeek,c.baseResolveWeek));
  c.responded=Boolean(c.responded);
  c.responseWeek=c.responseWeek===null||c.responseWeek===undefined?null:Math.max(c.startedWeek,i(c.responseWeek));
  c.responseCost=Math.max(0,n(c.responseCost));
  c.salesMultiplier=clamp(c.salesMultiplier,c.responded?RESPONDED_SALES_MULTIPLIER:UNTREATED_SALES_MULTIPLIER,1);
  return s;
}
function record(s,row){s.recallCrisisHistory.unshift({week:Math.max(1,i(s.week,1)),...row});s.recallCrisisHistory=s.recallCrisisHistory.slice(0,HISTORY_LIMIT);}
function hasEverStarted(s){ensure(s);return Boolean(s.activeRecallCrisis)||s.recallCrisisHistory.some(row=>row?.type==='started');}
function eligibleStores(s){
  return arr(s?.stores).filter(store=>store&&store.status==='open'&&ELIGIBLE_BUSINESSES.includes(store.businessID)&&n(store.condition,100)<=CONDITION_THRESHOLD)
    .sort((a,b)=>n(a.condition,100)-n(b.condition,100)||textCompare(a.businessID,b.businessID)||textCompare(a.stableKey||a.id,b.stableKey||b.id));
}
function businessName(s,id){return String(arr(s?.businesses).find(b=>String(b?.id)===String(id))?.name||id||'対象事業');}
function start(s,businessID,week,{storeID=null}={}){
  ensure(s);
  if(hasEverStarted(s)||!ELIGIBLE_BUSINESSES.includes(String(businessID)))return null;
  const w=Math.max(1,i(week,s.week));
  const crisis={id:`recall-${String(businessID)}-${w}`,businessID:String(businessID),storeID:storeID===null?null:String(storeID),status:'active',startedWeek:w,baseResolveWeek:w+BASE_DURATION_WEEKS-1,resolveWeek:w+BASE_DURATION_WEEKS-1,responded:false,responseWeek:null,responseCost:0,salesMultiplier:UNTREATED_SALES_MULTIPLIER};
  s.activeRecallCrisis=crisis;
  s.companyReputation=clamp(n(s.companyReputation)-START_REPUTATION_HIT,0,100);
  record(s,{week:w,type:'started',crisisID:crisis.id,businessID:crisis.businessID,storeID:crisis.storeID});
  s.news=arr(s.news);s.news.unshift(`第${w}週：${businessName(s,crisis.businessID)}で重大な品質問題が判明し、自主回収が必要になりました。`);s.news=s.news.slice(0,300);
  return crisis;
}
function maybeTrigger(s,nextWeek){
  ensure(s);const w=Math.max(1,i(nextWeek,n(s?.week,1)+1));
  // A company-wide recall is a mature-company crisis, not a founding-route punishment.
  // Require a head office before automatic incidence so a small restaurant chain can still
  // experience ordinary store-quality deterioration without being hit by a corporate recall.
  if(hasEverStarted(s)||!s.hasHeadOffice||w<TRIGGER_WEEK_MIN||w%TRIGGER_INTERVAL_WEEKS!==0)return null;
  const target=eligibleStores(s)[0];return target?start(s,target.businessID,w,{storeID:target.id}):null;
}
function resolve(s,week){
  ensure(s);const c=s.activeRecallCrisis;if(!c)return false;
  const w=Math.max(c.startedWeek,i(week,s.week));
  record(s,{week:w,type:'resolved',crisisID:c.id,businessID:c.businessID,responded:c.responded,responseCost:c.responseCost,durationWeeks:Math.max(1,w-c.startedWeek)});
  s.companyReputation=clamp(n(s.companyReputation)+(c.responded?RESOLUTION_REPUTATION_RECOVERY:0),0,100);
  s.news=arr(s.news);s.news.unshift(`第${w}週：${businessName(s,c.businessID)}のリコール対応が収束しました。`);s.news=s.news.slice(0,300);
  s.activeRecallCrisis=null;return true;
}
function prepareWeek(s,nextWeek){
  ensure(s);const w=Math.max(1,i(nextWeek,n(s?.week,1)+1));
  if(s.activeRecallCrisis&&w>s.activeRecallCrisis.resolveWeek)resolve(s,w);
  if(!s.activeRecallCrisis)maybeTrigger(s,w);
  const c=s.activeRecallCrisis;
  if(c&&w>=c.startedWeek&&w<=c.resolveWeek)s.companyReputation=clamp(n(s.companyReputation)-(c.responded?RESPONDED_WEEKLY_REPUTATION_HIT:WEEKLY_REPUTATION_HIT),0,100);
  return c;
}
function withSalesPenalty(engine,cb){
  const s=ensure(engine.g),c=s.activeRecallCrisis;if(!c)return cb();
  const b=arr(s.businesses).find(row=>String(row?.id)===c.businessID);if(!b)return cb();
  const original=b.demand;b.demand=Math.max(0,n(original,1)*clamp(c.salesMultiplier,0,1));
  try{return cb();}finally{b.demand=original;}
}
function responseCost(s){
  ensure(s);const c=s.activeRecallCrisis;if(!c)return 0;
  const stores=arr(s.stores).filter(store=>store&&store.status==='open'&&store.businessID===c.businessID);
  const recentSales=stores.reduce((sum,store)=>sum+Math.max(0,n(store.lastSales)),0);
  return Math.floor(Math.max(2_000_000,Math.min(30_000_000,stores.length*1_500_000+recentSales*.2)));
}
function respond(engine){
  const s=ensure(engine.g),c=s.activeRecallCrisis;if(!c||c.responded)return false;
  const cost=responseCost(s);if(n(s.companyCash)<cost)return false;
  return engine.runTransaction(()=>{
    const week=Math.max(c.startedWeek,i(s.week,c.startedWeek));
    s.companyCash=n(s.companyCash)-cost;
    f.event(s,'otherOperating',cost,{cashEffect:-cost,profitEffect:-cost,sourceType:'companyRecallCrisis',sourceID:c.id,idempotencyKey:`recall-response-${c.id}`,description:`${businessName(s,c.businessID)} リコール自主回収・顧客補償`});
    c.responded=true;c.responseWeek=week;c.responseCost=cost;c.salesMultiplier=RESPONDED_SALES_MULTIPLIER;c.resolveWeek=Math.min(c.baseResolveWeek,week+RESPONSE_DURATION_WEEKS);
    record(s,{week,type:'responded',crisisID:c.id,businessID:c.businessID,cost});
    s.news=arr(s.news);s.news.unshift(`第${week}週：${businessName(s,c.businessID)}の自主回収と顧客補償を開始しました。費用${Math.round(cost).toLocaleString('ja-JP')}円。`);s.news=s.news.slice(0,300);
    f.rebuildSnapshotForWeek?.(s,week);return true;
  });
}
function view(s){
  ensure(s);const c=s.activeRecallCrisis;if(!c)return null;const cost=responseCost(s);
  return {id:c.id,businessID:c.businessID,businessName:businessName(s,c.businessID),responded:c.responded,startedWeek:c.startedWeek,resolveWeek:c.resolveWeek,weeksRemaining:Math.max(0,c.resolveWeek-i(s.week,c.startedWeek)),salesMultiplier:c.salesMultiplier,salesImpact:1-c.salesMultiplier,responseCost:cost,canRespond:!c.responded&&n(s.companyCash)>=cost,reputationWeeklyHit:c.responded?RESPONDED_WEEKLY_REPUTATION_HIT:WEEKLY_REPUTATION_HIT};
}
function validate(s){
  ensure(s);const errors=[];if(s.recallCrisisHistory.length>HISTORY_LIMIT)errors.push('history overflow');
  const c=s.activeRecallCrisis;if(c&&(!ELIGIBLE_BUSINESSES.includes(c.businessID)||!Number.isFinite(c.salesMultiplier)||c.salesMultiplier<0||c.salesMultiplier>1||c.resolveWeek<c.startedWeek))errors.push('invalid active recall crisis');
  return {ok:errors.length===0,errors};
}
const baseNormalize=E.prototype.normalize,baseAdvanceWeek=E.prototype.advanceWeek;
E.prototype.normalize=function(){const result=baseNormalize.apply(this,arguments);ensure(this.g);return result;};
E.prototype.advanceWeek=function(){
  if(this.g?.gameOver||this.g?.isCompanySold)return baseAdvanceWeek.apply(this,arguments);
  prepareWeek(this.g,n(this.g?.week,1)+1);
  return withSalesPenalty(this,()=>baseAdvanceWeek.apply(this,arguments));
};
E.prototype.respondRecallCrisis=function(){return respond(this);};
E.prototype.getRecallCrisisView=function(){return view(this.g);};
Object.defineProperty(E.prototype,'__companyRecallCrisisInstalled',{value:true});
m.companyRecallCrisis=Object.freeze({VERSION,HISTORY_LIMIT,ELIGIBLE_BUSINESSES,TRIGGER_WEEK_MIN,TRIGGER_INTERVAL_WEEKS,CONDITION_THRESHOLD,BASE_DURATION_WEEKS,RESPONSE_DURATION_WEEKS,UNTREATED_SALES_MULTIPLIER,RESPONDED_SALES_MULTIPLIER,START_REPUTATION_HIT,WEEKLY_REPUTATION_HIT,RESPONDED_WEEKLY_REPUTATION_HIT,RESOLUTION_REPUTATION_RECOVERY,ensure,eligibleStores,start,maybeTrigger,resolve,prepareWeek,withSalesPenalty,responseCost,respond,view,validate,__installed:true});
})();