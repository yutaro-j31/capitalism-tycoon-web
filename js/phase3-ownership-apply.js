// P3-4 application of a pure ownership plan inside an existing outer transaction. No writer routes here and the
// authority is not activated: this is the dormant applyOwnershipPlan of #1080 §3.1.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.phase3OwnershipPlanner)throw Error('phase3-ownership-planner.js must precede phase3-ownership-apply.js');
if(modules.phase3OwnershipApply)throw Error('ownership apply already registered');
const planner=modules.phase3OwnershipPlanner,BUCKETS=planner.BUCKETS;
// IPO is excluded: its listing record and lot rebinding stay with the existing writer (listingRequirement).
const KINDS=Object.freeze(['personal-buy','personal-sell','founder-sale','external-issue','buyback','split']);
const CHANGED={'personal-buy':['personalOwnShares'],'personal-sell':['personalOwnShares'],'founder-sale':['founderShares'],
 'external-issue':['sharesOut'],buyback:['treasuryBuybackShares'],split:BUCKETS};
function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
// Rebuild the plan's intent from the plan itself; the caller's plan is never trusted, only compared.
function intentOf(state,plan,evidence){
 const kind=plan.kind,lots=CHANGED[kind].map(k=>evidence.sourcePaths[k]);
 const change=kind==='split'?{factor:plan.after.sharesOut/plan.before.sharesOut}
  :{quantity:Math.abs(plan.after[CHANGED[kind][0]]-plan.before[CHANGED[kind][0]])};
 return {scope:{...plan.scope},writerId:plan.writerId,kind,operationId:plan.operationId,account:plan.account,sourceLots:lots,
  expected:{sourceState:state,sourceFingerprint:evidence.sourceFingerprint,quantities:Object.fromEntries(BUCKETS.map(k=>[k,evidence.quantities[k]]))},change};
}
// Returns false, without any write, unless the plan is exactly what the planner yields for the engine's current state
// inside an active outer transaction. Lot creation/deletion, prices, cash, ledger and save stay with the existing writer.
function applyOwnershipPlan(engine,plan){
 let state,evidence,replanned;
 try{
  if(!engine||typeof engine.inTransaction!=='function'||engine.inTransaction()!==true)return false;
  if(!plan||typeof plan!=='object'||plan.status!=='PLANNED'||!KINDS.includes(plan.kind))return false;
  state=engine.g;evidence=planner.inspectOwnershipAuthority(state,plan.scope);
  if(evidence.status!=='OBSERVED'||evidence.sourceFingerprint!==plan.sourceFingerprint)return false;
  replanned=planner.planOwnershipChange(state,intentOf(state,plan,evidence));
  if(replanned.status!=='PLANNED'||!same(replanned,plan))return false;
  if(replanned.updates.some(u=>u.bucket==='personalOwnShares')&&!Object.hasOwn(state.personalStocks,evidence.ticker))return false;
 }catch(_){return false;}
 // Synchronous writes only; the enclosing transaction commits or restores them with the rest of the command.
 // Named share-quantity fields only: no computed state key, so no cash or other root can be reached.
 for(const u of replanned.updates){
  if(u.bucket==='sharesOut')state.sharesOut=u.after;
  else if(u.bucket==='treasuryBuybackShares')state.treasuryBuybackShares=u.after;
  else if(u.bucket==='founderShares')state.founderShares=u.after;
  else if(u.bucket==='personalOwnShares')state.personalStocks[evidence.ticker].qty=u.after;
 }
 for(const m of replanned.mirrors)state.market[evidence.mirror.index].issuedShares=m.after;
 return freeze({status:'APPLIED',activation:'disabled',writerId:replanned.writerId,kind:replanned.kind,operationId:replanned.operationId,
  sourceFingerprint:replanned.sourceFingerprint,before:replanned.before,after:replanned.after,updates:replanned.updates,mirrors:replanned.mirrors});
}
modules.phase3OwnershipApply=freeze({VERSION:1,ACTIVATION:'disabled',KINDS,applyOwnershipPlan});
})();
