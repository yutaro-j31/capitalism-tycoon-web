// P3-9 Control Ladder eligibility projection. Read-only and non-executable: an ELIGIBLE row never
// authorizes or wires a management command. Initial scope is the player company's single common
// class as reconciled by P3-2; every other issuer, actor or unproven evidence is UNKNOWN.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw Error('runtime.js must precede phase3-control-eligibility.js');
if(!modules.economicReadModel)throw Error('economic-read-model.js must precede phase3-control-eligibility.js');
if(modules.phase3ControlEligibility)throw Error('control eligibility already registered');
const readModel=modules.economicReadModel;
const PLAYER=readModel.PLAYER_COMPANY_ENTITY_ID,FOUNDER=readModel.FOUNDER_ENTITY_ID;
const PLAYER_RIGHTS_EVIDENCE='legacy-player-single-common-class';
const RECONCILIATION_SCOPE='player-company-common-founder-and-unallocated-residual';
// Six approved stages with exact crossing semantics over safe-integer voting units (n of d).
const LADDER=Object.freeze([
 Object.freeze({commandId:'informationRequest',threshold:'>=1/100',crosses:(n,d)=>100n*n>=d}),
 Object.freeze({commandId:'managementProposal',threshold:'>=3/100',crosses:(n,d)=>100n*n>=3n*d}),
 Object.freeze({commandId:'blockSpecialResolution',threshold:'>1/3',crosses:(n,d)=>3n*n>d}),
 Object.freeze({commandId:'ordinaryResolution',threshold:'>1/2',crosses:(n,d)=>2n*n>d}),
 Object.freeze({commandId:'specialResolution',threshold:'>=2/3',crosses:(n,d)=>3n*n>=2n*d}),
 Object.freeze({commandId:'squeezeOutEligibility',threshold:'>=9/10',crosses:(n,d)=>10n*n>=9n*d})
]);
const own=Object.prototype.hasOwnProperty;
class Unknown extends Error{constructor(code,path,message){super(message);this.code=code;this.path=path;}}
// Accept plain records/arrays from any realm (JSON, structured clone) but never exotic prototypes.
function intrinsic(proto,type){
 const c=proto&&Object.getOwnPropertyDescriptor(proto,'constructor');
 const p=c&&own.call(c,'value')&&typeof c.value==='function'&&Object.getOwnPropertyDescriptor(c.value,'prototype');
 return !!p&&p.value===proto&&Function.prototype.toString.call(c.value)===Function.prototype.toString.call(type);
}
function plainRecord(x){
 if(!x||typeof x!=='object'||Array.isArray(x))return false;
 const proto=Object.getPrototypeOf(x);return proto===null||(Object.getPrototypeOf(proto)===null&&intrinsic(proto,Object));
}
// Own enumerable data fields only; accessors are never executed.
function field(x,key,path){
 const d=Object.getOwnPropertyDescriptor(x,key);
 if(!d)return undefined;
 if(!own.call(d,'value')||!d.enumerable)throw new Unknown('INPUT_INVALID',`${path}.${key}`,'Evidence must be an own enumerable data property.');
 return d.value;
}
function record(x,path){if(!plainRecord(x))throw new Unknown('INPUT_INVALID',path,'Evidence must be a plain record.');return x;}
function rows(x,path){
 if(!Array.isArray(x)||!intrinsic(Object.getPrototypeOf(x),Array)||x.length>4096)throw new Unknown('INPUT_INVALID',path,'Evidence must be a bounded array.');
 const out=[];for(let i=0;i<x.length;i++)out.push(record(field(x,String(i),path),`${path}[${i}]`));return out;
}
function units(x,path){
 if(typeof x!=='number'||!Number.isFinite(x)||x<0)throw new Unknown('INPUT_INVALID',path,'Voting units must be a finite non-negative number.');
 if(!Number.isSafeInteger(x))throw new Unknown('NUMERIC_DOMAIN_UNSUPPORTED',path,'Fractional or unsafe voting units are not evaluated.');
 return x;
}
function reason(code,path,message,evidenceRefs=[]){return {code,path,message,evidenceRefs:[...evidenceRefs]};}
function deepFreeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(deepFreeze);Object.freeze(x);}return x;}

function evidence(snapshot,issuerEntityId,actingEntityId){
 const root=record(snapshot,'snapshot');
 if(field(root,'reconciliationVersion','snapshot')!==1||field(root,'authority','snapshot')!=='read-only')throw new Unknown('INPUT_INVALID','snapshot','Unsupported ownership reconciliation snapshot.');
 if(issuerEntityId!==PLAYER)throw new Unknown('ISSUER_FAMILY_UNSUPPORTED','issuerEntityId','Only the player company common class is evaluated.');
 if(actingEntityId!==FOUNDER)throw new Unknown('ACTOR_UNSUPPORTED','actingEntityId','No voting evidence is modeled for this actor.');
 if(field(root,'ok','snapshot')!==true)throw new Unknown('RECONCILIATION_FAILED','snapshot.ok','Ownership reconciliation did not pass conservation.');
 // Do not trust ok alone: a serialized snapshot can claim ok while its own evidence disagrees.
 if(field(root,'scope','snapshot')!==RECONCILIATION_SCOPE)throw new Unknown('INPUT_INVALID','snapshot.scope','Unsupported reconciliation scope.');
 rows(field(root,'checks','snapshot'),'snapshot.checks').forEach((check,i)=>{if(field(check,'ok',`snapshot.checks[${i}]`)!==true)throw new Unknown('RECONCILIATION_FAILED',`snapshot.checks[${i}]`,'A reconciliation check did not pass.');});
 if(rows(field(root,'issues','snapshot'),'snapshot.issues').length)throw new Unknown('RECONCILIATION_FAILED','snapshot.issues','Reconciliation reported issues.');
 for(const [i,alias] of rows(field(root,'unresolvedAliases','snapshot')??[],'snapshot.unresolvedAliases').entries()){
  if(field(alias,'reason',`snapshot.unresolvedAliases[${i}]`)==='company-own-share-alias-not-adopted')throw new Unknown('OWN_SHARE_ALIAS_UNRESOLVED',`snapshot.unresolvedAliases[${i}]`,'Company-held own shares outside treasury leave the voting denominator unproven.');
 }
 const classes=rows(field(root,'securityClasses','snapshot'),'snapshot.securityClasses');
 if(classes.length!==1)throw new Unknown('CLASS_RULES_UNKNOWN','snapshot.securityClasses','Exactly one modeled class is required.');
 const c=classes[0],cp='snapshot.securityClasses[0]';
 const securityClassId=field(c,'securityClassId',cp);
 if(field(c,'issuerEntityId',cp)!==PLAYER||field(c,'classType',cp)!=='common'||field(c,'votingRightsPerUnit',cp)!==1||field(c,'rightsEvidence',cp)!==PLAYER_RIGHTS_EVIDENCE||typeof securityClassId!=='string'||!securityClassId)
  throw new Unknown('CLASS_RULES_UNKNOWN',cp,'Class voting rules are not evidenced.');
 const issued=units(field(c,'issuedQuantity',cp),`${cp}.issuedQuantity`),treasury=units(field(c,'treasuryQuantity',cp),`${cp}.treasuryQuantity`);
 const outstanding=units(field(c,'outstandingQuantity',cp),`${cp}.outstandingQuantity`);
 if(BigInt(issued)!==BigInt(treasury)+BigInt(outstanding))throw new Unknown('RECONCILIATION_FAILED',cp,'Issued units do not equal treasury plus outstanding units.');
 const holdings=rows(field(root,'beneficialHoldings','snapshot'),'snapshot.beneficialHoldings').map((row,i)=>({row,path:`snapshot.beneficialHoldings[${i}]`}))
  .filter(({row,path})=>field(row,'beneficialOwnerEntityId',path)===actingEntityId&&field(row,'securityClassId',path)===securityClassId);
 if(holdings.length!==1)throw new Unknown('ACTOR_UNSUPPORTED','snapshot.beneficialHoldings','The actor needs exactly one beneficial holding in the class.');
 const {row,path}=holdings[0];
 if(field(row,'issuerEntityId',path)!==PLAYER)throw new Unknown('INPUT_INVALID',path,'Beneficial holding issuer does not match.');
 const held=units(field(row,'quantity',path),`${path}.quantity`);
 if(held>outstanding)throw new Unknown('RECONCILIATION_FAILED',path,'Holder units exceed eligible outstanding units.');
 const unallocated=units(field(c,'unallocatedOutstandingQuantity',cp),`${cp}.unallocatedOutstandingQuantity`);
 if(BigInt(held)+BigInt(unallocated)!==BigInt(outstanding))throw new Unknown('RECONCILIATION_FAILED',cp,'Founder and unallocated units do not equal outstanding units.');
 if(outstanding===0)throw new Unknown('DENOMINATOR_ZERO',`${cp}.outstandingQuantity`,'No eligible outstanding voting units.');
 const holdingId=field(row,'beneficialHoldingId',path);
 return {securityClassId,eligibleVotingUnits:outstanding,holderVotingUnits:held,treasuryUnitsExcluded:treasury,
  rightsBasis:PLAYER_RIGHTS_EVIDENCE,sourceRefs:[securityClassId,typeof holdingId==='string'?holdingId:path]};
}

function projectControlEligibility(snapshot,options){
 const out={authority:'read-only',executable:false,projectionVersion:1,issuerEntityId:null,actingEntityId:null,status:'UNKNOWN',votingEvidence:null,capabilities:[],issues:[]};
 try{
  // Options are read like evidence: own data fields only, accessors never executed.
  const opts=options===undefined?{}:record(options,'options');
  const issuerEntityId=field(opts,'issuerEntityId','options'),actingEntityId=field(opts,'actingEntityId','options');
  out.issuerEntityId=typeof issuerEntityId==='string'?issuerEntityId:null;
  out.actingEntityId=typeof actingEntityId==='string'?actingEntityId:null;
  const votes=evidence(snapshot,out.issuerEntityId,out.actingEntityId),n=BigInt(votes.holderVotingUnits),d=BigInt(votes.eligibleVotingUnits);
  out.status='EVALUATED';out.votingEvidence=votes;
  out.capabilities=LADDER.map(stage=>({commandId:stage.commandId,status:stage.crosses(n,d)?'ELIGIBLE':'INELIGIBLE',threshold:stage.threshold,
   executionStatus:'NOT_AUTHORIZED',reasons:[],evidenceRefs:[...votes.sourceRefs]}));
 }catch(error){
  if(!(error instanceof Unknown))throw error;
  const why=reason(error.code,error.path,error.message);
  out.issues=[why];
  out.capabilities=LADDER.map(stage=>({commandId:stage.commandId,status:'UNKNOWN',threshold:stage.threshold,executionStatus:'NOT_AUTHORIZED',reasons:[reason(why.code,why.path,why.message)],evidenceRefs:[]}));
 }
 return deepFreeze(out);
}

modules.phase3ControlEligibility=Object.freeze({
 LADDER:Object.freeze(LADDER.map(stage=>Object.freeze({commandId:stage.commandId,threshold:stage.threshold}))),
 projectControlEligibility
});
})();
