// P3-4 application of a pure ownership plan inside an existing outer transaction: the dormant applyOwnershipPlan of
// #1080 §3.1, plus the verification legs routed writers use while the authority is not activated.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.phase3OwnershipPlanner)throw Error('phase3-ownership-planner.js must precede phase3-ownership-apply.js');
if(modules.phase3OwnershipApply)throw Error('ownership apply already registered');
const planner=modules.phase3OwnershipPlanner,BUCKETS=planner.BUCKETS,read=modules.economicReadModel;
// IPO is excluded: its listing record and lot rebinding stay with the existing writer (listingRequirement).
const KINDS=Object.freeze(['personal-buy','personal-sell','founder-sale','external-issue','buyback','split']);
const CHANGED={'personal-buy':['personalOwnShares'],'personal-sell':['personalOwnShares'],'founder-sale':['founderShares'],
 'external-issue':['sharesOut'],buyback:['treasuryBuybackShares'],split:BUCKETS};
const PERSONAL=new Set(['personal-buy','personal-sell','founder-sale']);
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
// Verification mode (Owner decision 2026-10-28): a routed writer keeps its own quantity writes. Before writing it
// plans its fact leg; when the planner can plan it, the quantities the writer leaves must equal the plan or the writer
// rejects its command. A leg the planner cannot plan (a later company generation, an unlisted company, ...) keeps the
// existing behaviour, so routing changes no supported or unsupported outcome. Activation later swaps the writes for
// applyOwnershipPlan.
function beginOwnershipLeg(engine,leg){
 try{
  if(!engine||typeof engine.inTransaction!=='function'||engine.inTransaction()!==true||!leg||!KINDS.includes(leg.kind))return null;
  const state=engine.g,scope={family:'player-common',issuerEntityId:read.PLAYER_COMPANY_ENTITY_ID,
   securityClassId:read.PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID,currentCompanySerial:1};
  const evidence=planner.inspectOwnershipAuthority(state,scope);
  if(evidence.status!=='OBSERVED')return null;
  const plan=planner.planOwnershipChange(state,{scope,writerId:leg.writerId,kind:leg.kind,operationId:leg.operationId,
   account:PERSONAL.has(leg.kind)?'personal':'company',sourceLots:CHANGED[leg.kind].map(k=>evidence.sourcePaths[k]),
   expected:{sourceState:state,sourceFingerprint:evidence.sourceFingerprint,quantities:Object.fromEntries(BUCKETS.map(k=>[k,evidence.quantities[k]]))},
   change:leg.change});
  return plan.status==='PLANNED'?freeze({plan}):null;
 }catch(_){return null;}
}
// True when there was no plannable leg, or when the engine's quantities (with a consistent issued mirror) are exactly
// the plan's prospective quantities.
function confirmOwnershipLeg(engine,handle){
 if(handle===null||handle===undefined)return true;
 try{
  const evidence=planner.inspectOwnershipAuthority(engine.g,handle.plan.scope);
  return evidence.status==='OBSERVED'&&BUCKETS.every(k=>evidence.quantities[k]===handle.plan.after[k]);
 }catch(_){return false;}
}
modules.phase3OwnershipApply=freeze({VERSION:1,ACTIVATION:'disabled',KINDS,applyOwnershipPlan,beginOwnershipLeg,confirmOwnershipLeg});
})();
