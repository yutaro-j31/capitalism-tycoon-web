'use strict';
// P3-9: read-only Control Ladder eligibility over the P3-2 player common-class reconciliation.
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let seed=9,hostDraws=0;
const loaded=loadGame({headless:true,random:()=>{hostDraws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;}});
const readModel=loaded.modules.economicReadModel,control=loaded.modules.phase3ControlEligibility;
assert.equal(typeof control?.projectControlEligibility,'function','projector must load through production module wiring');
const project=control.projectControlEligibility,PLAYER=readModel.PLAYER_COMPANY_ENTITY_ID,FOUNDER=readModel.FOUNDER_ENTITY_ID;
const scope={issuerEntityId:PLAYER,actingEntityId:FOUNDER};
const ORDER=['informationRequest','managementProposal','blockSpecialResolution','ordinaryResolution','specialResolution','squeezeOutEligibility'];
assert.deepEqual(Array.from(control.LADDER,row=>row.commandId),ORDER);
const statuses=out=>Object.fromEntries(Array.from(out.capabilities,row=>[row.commandId,row.status]));
const plain=x=>JSON.parse(JSON.stringify(x));

// Synthetic snapshot in the exact P3-2 reconciliation shape. Independent expected outcomes below are
// written out by hand from the approved catalog, not computed with the projector's comparator.
function snapshot({issued,treasury,held,ok=true,aliases=[]}){
  return {reconciliationVersion:1,authority:'read-only',scope:'player-company-common-founder-and-unallocated-residual',ok,checks:[{id:'ECO-010',ok:true},{id:'ECO-011',ok:true}],issues:[],
    securityClasses:[{securityClassId:'security:player-company:common',issuerEntityId:PLAYER,classType:'common',issuedQuantity:issued,treasuryQuantity:treasury,
      outstandingQuantity:issued-treasury,unallocatedOutstandingQuantity:issued-treasury-held,votingRightsPerUnit:1,economicRightsPerUnit:1,rightsEvidence:'legacy-player-single-common-class'}],
    beneficialHoldings:[{beneficialHoldingId:'beneficial:player-company:founder',issuerEntityId:PLAYER,securityClassId:'security:player-company:common',beneficialOwnerEntityId:FOUNDER,quantity:held,
      sourceHoldingIds:['holding:player-company:founder-legacy','holding:player-company:founder-personal-stock']}],
    sourceHoldings:[
      {holdingId:'holding:player-company:founder-legacy',securityClassId:'security:player-company:common',registeredHolderEntityId:FOUNDER,beneficialOwnerEntityId:FOUNDER,beneficialFraction:1,quantity:held,sourceLot:'legacy-founderShares-bucket',sourcePath:'founderShares'},
      {holdingId:'holding:player-company:founder-personal-stock',securityClassId:'security:player-company:common',registeredHolderEntityId:FOUNDER,beneficialOwnerEntityId:FOUNDER,beneficialFraction:1,quantity:0,sourceLot:'legacy-personal-own-stock-bucket',sourcePath:null,sourceMapPath:'personalStocks',sourceInstrumentId:'OWN'}],
    generationEvidence:{currentCompanySerial:1,isCompanySold:false},
    entities:[{entityId:PLAYER,status:'active'},{entityId:FOUNDER,status:'active'}],
    unresolvedAliases:aliases};
}
const E='ELIGIBLE',I='INELIGIBLE';
// d=300 boundary fixture from PHASE_3_P3_9_CONTRACT §7: three cases per stage.
const cases=[
  ['informationRequest',2,I],['informationRequest',3,E],['informationRequest',4,E],
  ['managementProposal',8,I],['managementProposal',9,E],['managementProposal',10,E],
  ['blockSpecialResolution',99,I],['blockSpecialResolution',100,I],['blockSpecialResolution',101,E],
  ['ordinaryResolution',149,I],['ordinaryResolution',150,I],['ordinaryResolution',151,E],
  ['specialResolution',199,I],['specialResolution',200,E],['specialResolution',201,E],
  ['squeezeOutEligibility',269,I],['squeezeOutEligibility',270,E],['squeezeOutEligibility',271,E]
];
assert.equal(cases.length,18);
for(const [commandId,n,expected] of cases){
  const out=project(snapshot({issued:300,treasury:0,held:n}),scope);
  assert.equal(out.status,'EVALUATED');
  assert.equal(statuses(out)[commandId],expected,`${commandId} at ${n}/300`);
}

// Treasury is excluded from the denominator: issued1000, treasury100 → d=900, actor450 is exactly 1/2.
{
  const out=project(snapshot({issued:1000,treasury:100,held:450}),scope);
  assert.deepEqual(statuses(out),{informationRequest:E,managementProposal:E,blockSpecialResolution:E,ordinaryResolution:I,specialResolution:I,squeezeOutEligibility:I});
  assert.equal(out.votingEvidence.eligibleVotingUnits,900);
  assert.equal(out.votingEvidence.holderVotingUnits,450);
  assert.equal(out.votingEvidence.treasuryUnitsExcluded,100);
  assert.equal(out.authority,'read-only');assert.equal(out.executable,false);
  assert.ok(out.capabilities.every(row=>row.executionStatus==='NOT_AUTHORIZED'),'eligibility never authorizes execution');
}
// Coprime denominator d=7: 1 vote is 1/7 (>=1%, >=3%, not >1/3); 3 votes >1/3 not >1/2; 5 votes >=2/3 not >=9/10; 7 is everything.
assert.deepEqual(statuses(project(snapshot({issued:7,treasury:0,held:1}),scope)),{informationRequest:E,managementProposal:E,blockSpecialResolution:I,ordinaryResolution:I,specialResolution:I,squeezeOutEligibility:I});
assert.deepEqual(statuses(project(snapshot({issued:7,treasury:0,held:3}),scope)),{informationRequest:E,managementProposal:E,blockSpecialResolution:E,ordinaryResolution:I,specialResolution:I,squeezeOutEligibility:I});
assert.deepEqual(statuses(project(snapshot({issued:7,treasury:0,held:5}),scope)),{informationRequest:E,managementProposal:E,blockSpecialResolution:E,ordinaryResolution:E,specialResolution:E,squeezeOutEligibility:I});
assert.ok(Object.values(statuses(project(snapshot({issued:7,treasury:0,held:7}),scope))).every(x=>x===E));
assert.ok(Object.values(statuses(project(snapshot({issued:300,treasury:0,held:0}),scope))).every(x=>x===I),'zero known votes is INELIGIBLE, not UNKNOWN');
// Safe-integer maximum: exact cross products where a floating ratio would round to the boundary.
{
  const d=Number.MAX_SAFE_INTEGER,half=(d-1)/2;
  assert.equal(statuses(project(snapshot({issued:d,treasury:0,held:half}),scope)).ordinaryResolution,I,'(d-1)/2 of odd d is not more than half');
  assert.equal(statuses(project(snapshot({issued:d,treasury:0,held:half+1}),scope)).ordinaryResolution,E);
  const third=(d-1)/3;// d ≡ 1 (mod 3)
  assert.equal(statuses(project(snapshot({issued:d,treasury:0,held:third}),scope)).blockSpecialResolution,I);
  assert.equal(statuses(project(snapshot({issued:d,treasury:0,held:third+1}),scope)).blockSpecialResolution,E);
}

// Fail closed: every unproven case is UNKNOWN for all six stages, with one explicit reason.
function unknown(out,code){
  assert.equal(out.status,'UNKNOWN');assert.equal(out.votingEvidence,null);
  assert.ok(out.capabilities.every(row=>row.status==='UNKNOWN'&&row.reasons[0].code===code),code);
  assert.equal(out.issues[0].code,code);assert.equal(out.capabilities.length,6);
}
unknown(project(snapshot({issued:0,treasury:0,held:0}),scope),'DENOMINATOR_ZERO');
unknown(project(snapshot({issued:300,treasury:0,held:150.5}),scope),'NUMERIC_DOMAIN_UNSUPPORTED');
unknown(project(snapshot({issued:300,treasury:0,held:NaN}),scope),'INPUT_INVALID');
unknown(project(snapshot({issued:300,treasury:0,held:-1}),scope),'INPUT_INVALID');
unknown(project(snapshot({issued:300,treasury:0,held:301}),scope),'RECONCILIATION_FAILED');
unknown(project(snapshot({issued:300,treasury:0,held:10,ok:false}),scope),'RECONCILIATION_FAILED');
unknown(project(snapshot({issued:300,treasury:0,held:10,aliases:[{reason:'company-own-share-alias-not-adopted'}]}),scope),'OWN_SHARE_ALIAS_UNRESOLVED');
assert.equal(project(snapshot({issued:300,treasury:0,held:10,aliases:[{reason:'issuer-family-alias-not-adopted',issuerEntityId:null,securityClassId:null}]}),scope).status,'EVALUATED','other issuers do not affect the player denominator');
unknown(project(snapshot({issued:300,treasury:0,held:10}),{issuerEntityId:'entity:company:other',actingEntityId:FOUNDER}),'ISSUER_FAMILY_UNSUPPORTED');
unknown(project(snapshot({issued:300,treasury:0,held:10}),{issuerEntityId:PLAYER,actingEntityId:PLAYER}),'ACTOR_UNSUPPORTED');
unknown(project(snapshot({issued:300,treasury:0,held:10}),{issuerEntityId:PLAYER,actingEntityId:'entity:person:other'}),'ACTOR_UNSUPPORTED');
unknown(project(snapshot({issued:300,treasury:0,held:10})),'ISSUER_FAMILY_UNSUPPORTED');
{
  const s=snapshot({issued:300,treasury:0,held:10});s.securityClasses[0].votingRightsPerUnit=2;unknown(project(s,scope),'CLASS_RULES_UNKNOWN');
  const t=snapshot({issued:300,treasury:0,held:10});t.securityClasses.push({...t.securityClasses[0],securityClassId:'security:player-company:preferred'});unknown(project(t,scope),'CLASS_RULES_UNKNOWN');
  const u=snapshot({issued:300,treasury:0,held:10});u.securityClasses[0].outstandingQuantity=299;unknown(project(u,scope),'RECONCILIATION_FAILED');
  const v=snapshot({issued:300,treasury:0,held:10});v.beneficialHoldings.push({...v.beneficialHoldings[0]});unknown(project(v,scope),'ACTOR_UNSUPPORTED');
  const w=snapshot({issued:300,treasury:0,held:10});w.reconciliationVersion=2;unknown(project(w,scope),'INPUT_INVALID');
}
for(const bad of [null,[],'x',42,new Map()])unknown(project(bad,scope),'INPUT_INVALID');
// A snapshot that claims ok but whose own evidence disagrees is not trusted.
{
  const residual=snapshot({issued:300,treasury:0,held:200});residual.securityClasses[0].unallocatedOutstandingQuantity=200;unknown(project(residual,scope),'RECONCILIATION_FAILED');
  const check=snapshot({issued:300,treasury:0,held:200});check.checks[1].ok=false;unknown(project(check,scope),'RECONCILIATION_FAILED');
  const issue=snapshot({issued:300,treasury:0,held:200});issue.issues.push({sourcePath:'x',reason:'y'});unknown(project(issue,scope),'RECONCILIATION_FAILED');
  const scopeChanged=snapshot({issued:300,treasury:0,held:200});scopeChanged.scope='all-holders';unknown(project(scopeChanged,scope),'INPUT_INVALID');
  const missing=snapshot({issued:300,treasury:0,held:200});delete missing.securityClasses[0].unallocatedOutstandingQuantity;unknown(project(missing,scope),'INPUT_INVALID');
}
// Options are read without executing accessors.
{
  let calls=0;const opts={actingEntityId:FOUNDER};Object.defineProperty(opts,'issuerEntityId',{enumerable:true,get(){calls++;return PLAYER;}});
  unknown(project(snapshot({issued:300,treasury:0,held:10}),opts),'INPUT_INVALID');assert.equal(calls,0,'option getter must not run');
  unknown(project(snapshot({issued:300,treasury:0,held:10}),null),'INPUT_INVALID');
  unknown(project(snapshot({issued:300,treasury:0,held:10}),Object.create({issuerEntityId:PLAYER,actingEntityId:FOUNDER})),'INPUT_INVALID');
}
// Accessors are never executed and non-enumerable evidence is rejected.
{
  let called=0;const s=snapshot({issued:300,treasury:0,held:10});
  Object.defineProperty(s.beneficialHoldings[0],'quantity',{enumerable:true,get(){called++;return 10;}});
  unknown(project(s,scope),'INPUT_INVALID');assert.equal(called,0,'getter must not run');
  const h=snapshot({issued:300,treasury:0,held:10});Object.defineProperty(h.securityClasses[0],'treasuryQuantity',{value:0,enumerable:false});
  unknown(project(h,scope),'INPUT_INVALID');
  const p=snapshot({issued:300,treasury:0,held:10});unknown(project(Object.assign(Object.create({inherited:true}),p),scope),'INPUT_INVALID');
}

// Every beneficial holding must lie inside the reconciled founder-and-residual scope (Codex 4329489015).
{
  const other=snapshot({issued:300,treasury:0,held:200});
  other.beneficialHoldings.push({beneficialHoldingId:'beneficial:player-company:other',issuerEntityId:PLAYER,securityClassId:'security:player-company:common',beneficialOwnerEntityId:'entity:person:other',quantity:100});
  unknown(project(other,scope),'INPUT_INVALID');
  const otherClass=snapshot({issued:300,treasury:0,held:200});
  otherClass.beneficialHoldings.push({...otherClass.beneficialHoldings[0],securityClassId:'security:player-company:preferred'});
  unknown(project(otherClass,scope),'INPUT_INVALID');
  const otherIssuer=snapshot({issued:300,treasury:0,held:200});
  otherIssuer.beneficialHoldings.push({...otherIssuer.beneficialHoldings[0],issuerEntityId:'entity:company:other'});
  unknown(project(otherIssuer,scope),'INPUT_INVALID');
  const companyRow=snapshot({issued:300,treasury:0,held:200});
  companyRow.beneficialHoldings.unshift({...companyRow.beneficialHoldings[0],beneficialOwnerEntityId:PLAYER});
  unknown(project(companyRow,scope),'INPUT_INVALID');
}
// A holding without its durable evidence ID fails closed instead of citing an array position (Codex 4332153047).
{
  for(const id of [undefined,null,7,'','bogus']){
    const s=snapshot({issued:300,treasury:0,held:10});
    if(id===undefined)delete s.beneficialHoldings[0].beneficialHoldingId;else s.beneficialHoldings[0].beneficialHoldingId=id;
    unknown(project(s,scope),'INPUT_INVALID');
  }
}
// Only the canonical player common class is accepted, even when class and holding agree (Codex 4332651508).
{
  const s=snapshot({issued:300,treasury:0,held:10});
  s.securityClasses[0].securityClassId='security:invented';s.beneficialHoldings[0].securityClassId='security:invented';
  unknown(project(s,scope),'CLASS_RULES_UNKNOWN');
}
// Unrecognized unresolved-alias records fail closed; the known issuer-family alias stays harmless (Codex 4332651514).
{
  for(const alias of [{},{reason:'unknown'},{reason:null}]){
    const s=snapshot({issued:300,treasury:0,held:10});s.unresolvedAliases=[alias];
    unknown(project(s,scope),'INPUT_INVALID');
  }
}
// A recognized issuer-family alias that claims the player issuer or class contradicts its reason (Codex 4333230848).
{
  const base={reason:'issuer-family-alias-not-adopted',registeredHolderEntityId:PLAYER,issuerEntityId:null,securityClassId:null,quantity:100};
  for(const alias of [{...base,issuerEntityId:PLAYER,securityClassId:'security:player-company:common'},{...base,issuerEntityId:PLAYER},{...base,securityClassId:'security:player-company:common'},{reason:'issuer-family-alias-not-adopted'}]){
    const s=snapshot({issued:300,treasury:0,held:10});s.unresolvedAliases=[alias];
    unknown(project(s,scope),'INPUT_INVALID');
  }
  const ok=snapshot({issued:300,treasury:0,held:10});ok.unresolvedAliases=[base];
  assert.equal(project(ok,scope).status,'EVALUATED');
}
// The canonical ECO-010/ECO-011 attestations are required exactly once each (Codex 4334161225).
{
  for(const checks of [[],[{id:'ECO-010',ok:true}],[{id:'ECO-010',ok:true},{id:'ECO-010',ok:true}],[{id:'ECO-010',ok:true},{id:'ECO-999',ok:true}],[{id:'ECO-010',ok:true},{id:'ECO-011',ok:true},{id:'ECO-012',ok:true}],[{ok:true},{ok:true}]]){
    const s=snapshot({issued:300,treasury:0,held:10});s.checks=checks;
    unknown(project(s,scope),'RECONCILIATION_FAILED');
  }
  const swapped=snapshot({issued:300,treasury:0,held:10});swapped.checks.reverse();
  assert.equal(project(swapped,scope).status,'EVALUATED','order of the canonical checks does not matter');
}
// A missing unresolvedAliases collection is not proven-empty (Codex 4329489006).
{
  const missing=snapshot({issued:300,treasury:0,held:10});delete missing.unresolvedAliases;
  unknown(project(missing,scope),'INPUT_INVALID');
  const nulled=snapshot({issued:300,treasury:0,held:10});nulled.unresolvedAliases=null;
  unknown(project(nulled,scope),'INPUT_INVALID');
}

// The whole snapshot graph is validated, including fields the projection never reads.
{
  const ok=snapshot({issued:300,treasury:0,held:10});
  const bad=[
    s=>{s.beneficialHoldings[0].self=s.beneficialHoldings[0];},
    s=>{s.checks[0].note={};s.checks[0].note.back=s.checks[0];},
    s=>{let called=0;Object.defineProperty(s.securityClasses[0],'memo',{enumerable:true,get(){called++;return 1;}});return ()=>assert.equal(called,0,'unread getter must not run');},
    s=>{Object.defineProperty(s.checks[1],'hidden',{value:1,enumerable:false});},
    s=>{s.beneficialHoldings[0].extra=NaN;},
    s=>{s.beneficialHoldings[0].extra=Infinity;},
    s=>{s.securityClasses[0].note=()=>1;},
    s=>{s.securityClasses[0].note=1n;},
    s=>{s.securityClasses[0].note=new Date(0);},
    s=>{s.securityClasses[0][Symbol('x')]=1;},
    s=>{s.checks.length=3;},
    s=>{s.checks.extra=1;},
    s=>{s.issuesNote=[undefined];},
    s=>{let x={};for(let i=0;i<70;i++)x={x};s.deep=x;},
  ];
  for(const [i,mutate] of bad.entries()){
    const s=snapshot({issued:300,treasury:0,held:10});const after=mutate(s);
    const out=project(s,scope);assert.equal(out.status,'UNKNOWN',`unread malformed field ${i} must not evaluate`);
    assert.equal(out.issues[0].code,'INPUT_INVALID',`unread malformed field ${i}: ${out.issues[0].code}`);
    if(after)after();
  }
  // Shared acyclic subtrees serialize by duplication, so they evaluate like their JSON reload.
  const shared=snapshot({issued:300,treasury:0,held:10}),note={source:'audit'};
  shared.checks[0].note=note;shared.checks[1].note=note;shared.securityClasses[0].memo=undefined;
  assert.equal(project(shared,scope).status,'EVALUATED');
  assert.deepEqual(plain(project(shared,scope)),plain(project(plain(shared),scope)));
  assert.deepEqual(plain(project(shared,scope)),plain(project(ok,scope)));
}

// Production wiring: the real P3-2 reconciliation feeds the projector without mutating state or RNG.
{
  const state=loaded.engineModule.createInitialState({configured:true,seed:0x39000001});
  Object.assign(state,{currentCompanySerial:1,publicCompany:true,sharesOut:1000,treasuryBuybackShares:100,founderShares:400,personalStocks:{[state.ticker]:{qty:51,avg:900},ZZZ:{qty:5,avg:50}}});
  const before=JSON.stringify(state),draws=hostDraws;
  const reconciliation=readModel.ownershipReconciliation(state);
  assert.ok(Array.isArray(reconciliation.unresolvedAliases)&&reconciliation.beneficialHoldings.length===1,'P3-2 output carries the collections the projector requires');
  assert.equal(reconciliation.ok,true,JSON.stringify(reconciliation.issues));
  const out=project(reconciliation,scope);
  assert.equal(JSON.stringify(state),before,'pure read');assert.equal(hostDraws,draws,'no host RNG');
  assert.equal(out.votingEvidence.holderVotingUnits,451,'legacy founder bucket and personally bought own shares join');
  assert.equal(out.votingEvidence.eligibleVotingUnits,900);
  assert.deepEqual(statuses(out),{informationRequest:E,managementProposal:E,blockSpecialResolution:E,ordinaryResolution:E,specialResolution:I,squeezeOutEligibility:I});
  // Same result from a JSON round trip and from key-reordered input; output is deep-frozen and stable.
  const reverse=x=>Array.isArray(x)?x.map(reverse):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).reverse().map(k=>[k,reverse(x[k])])):x;
  const reordered=reverse(plain(reconciliation));
  assert.deepEqual(plain(project(plain(reconciliation),scope)),plain(out));
  assert.deepEqual(plain(project(plain(reordered),scope)),plain(out));
  assert.ok(Object.isFrozen(out)&&Object.isFrozen(out.capabilities[0])&&Object.isFrozen(out.votingEvidence.sourceRefs));
  // Company-held own shares outside treasury make the denominator unproven.
  const aliased=JSON.parse(before);aliased.companyStocks={[aliased.ticker]:{qty:3,avg:10}};
  unknown(project(readModel.ownershipReconciliation(aliased),scope),'OWN_SHARE_ALIAS_UNRESOLVED');
  // A fractional legacy founder bucket is not rounded into votes.
  const fractional=JSON.parse(before);fractional.founderShares=400.5;
  const fr=project(readModel.ownershipReconciliation(fractional),scope);
  assert.equal(fr.status,'UNKNOWN');assert.ok(['NUMERIC_DOMAIN_UNSUPPORTED','RECONCILIATION_FAILED'].includes(fr.issues[0].code),fr.issues[0].code);
}
// A sold or generation-unproven issuer is never attributed to the founder's old buckets (7c900968 review).
{
  for(const [label,mutate,code] of [
    ['sold flag',s=>{s.generationEvidence.isCompanySold=true;},'GENERATION_UNPROVEN'],
    ['sold entity',s=>{s.entities[0].status='sold';},'GENERATION_UNPROVEN'],
    ['refounded serial',s=>{s.generationEvidence.currentCompanySerial=2;},'GENERATION_UNPROVEN'],
    ['unknown serial',s=>{s.generationEvidence.currentCompanySerial=null;},'GENERATION_UNPROVEN'],
    ['unknown sold flag',s=>{s.generationEvidence.isCompanySold=null;},'GENERATION_UNPROVEN'],
    ['missing generation evidence',s=>{delete s.generationEvidence;},'INPUT_INVALID'],
    ['missing issuer entity',s=>{s.entities=s.entities.slice(1);},'INPUT_INVALID'],
    ['repeated issuer entity',s=>{s.entities.push({...s.entities[0]});},'INPUT_INVALID'],
  ]){const s=snapshot({issued:300,treasury:0,held:200});mutate(s);unknown(project(s,scope),code);assert.ok(project(s,scope).status==='UNKNOWN',label);}
  // Production: completeCompanySale's flag and a refounded serial both leave every stage UNKNOWN.
  const state=loaded.engineModule.createInitialState({configured:true,seed:0x39000002});
  Object.assign(state,{currentCompanySerial:1,isCompanySold:false,sharesOut:1000,treasuryBuybackShares:0,founderShares:600});
  assert.equal(project(readModel.ownershipReconciliation(state),scope).status,'EVALUATED');
  for(const change of [{isCompanySold:true},{currentCompanySerial:2}]){
    const r=readModel.ownershipReconciliation({...state,...change});
    unknown(project(r,scope),'GENERATION_UNPROVEN');
  }
}
// ECO-011 is recomputed from the source bindings, not accepted from its label (7c900968 review).
{
  const legacy='holding:player-company:founder-legacy',personal='holding:player-company:founder-personal-stock';
  for(const [label,mutate] of [
    ['duplicate source ID',s=>{s.sourceHoldings[1].holdingId=legacy;}],
    ['altered source ID',s=>{s.sourceHoldings[0].holdingId='holding:bogus';}],
    ['duplicate source path',s=>{s.sourceHoldings[1].sourcePath='founderShares';}],
    ['extra source row',s=>{s.sourceHoldings.push({...s.sourceHoldings[1],holdingId:'holding:extra',quantity:0});}],
    ['missing source row',s=>{s.sourceHoldings.pop();}],
    ['missing source collection',s=>{delete s.sourceHoldings;}],
    ['other holder source',s=>{s.sourceHoldings[1].registeredHolderEntityId=PLAYER;}],
    ['partial beneficial fraction',s=>{s.sourceHoldings[0].beneficialFraction=0.5;}],
    ['other class source',s=>{s.sourceHoldings[0].securityClassId='security:other';}],
    ['bindings deleted',s=>{delete s.beneficialHoldings[0].sourceHoldingIds;}],
    ['bindings disconnected',s=>{s.beneficialHoldings[0].sourceHoldingIds=[legacy,'holding:elsewhere'];}],
    ['bindings repeated',s=>{s.beneficialHoldings[0].sourceHoldingIds=[legacy,legacy];}],
    ['bindings truncated',s=>{s.beneficialHoldings[0].sourceHoldingIds=[personal];}],
    ['sources do not sum',s=>{s.sourceHoldings[1].quantity=5;}],
  ]){
    const s=snapshot({issued:300,treasury:0,held:200});mutate(s);const out=project(s,scope);
    assert.equal(out.status,'UNKNOWN',`${label} must not evaluate`);
    assert.ok(['RECONCILIATION_FAILED','INPUT_INVALID'].includes(out.issues[0].code),`${label}: ${out.issues[0].code}`);
  }
  // Order of the two sources and of the bindings does not matter; split buckets still sum exactly.
  const split=snapshot({issued:300,treasury:0,held:200});split.sourceHoldings[0].quantity=150;split.sourceHoldings[1].quantity=50;
  split.sourceHoldings.reverse();split.beneficialHoldings[0].sourceHoldingIds.reverse();
  assert.equal(project(split,scope).status,'EVALUATED');
}
// Negative zero is a valid quantity but JSON reloads it as 0; the evaluated evidence must be
// identical before and after a round trip (Object.is semantics under deepStrictEqual).
for(const negativeZero of [snapshot({issued:300,treasury:-0,held:150}),snapshot({issued:300,treasury:0,held:-0})]){
  const raw=project(negativeZero,scope),reloaded=project(plain(negativeZero),scope);
  assert.equal(raw.status,'EVALUATED');
  assert.deepStrictEqual(raw,reloaded,'-0 voting units must canonicalize to 0');
}
console.log('P3-9 control eligibility projection tests passed');

// P3-10: inspect-only explanation, including 100% voting eligibility, never authorizes a command or its payload.
{
 const explain=control.explainOwnershipCommand;
 assert.equal(typeof explain,'function','inspect-only explanation loads through the existing production module');
 const full=snapshot({issued:300,treasury:0,held:300}),before=JSON.stringify(full);
 const requests=ORDER.map(commandId=>({...scope,commandId,payload:{policy:'sellAssets'}}));
 for(const request of requests){
  const requestBefore=JSON.stringify(request),out=explain(full,request);
  assert.equal(out.status,'EXPLAINED');assert.equal(out.commandId,request.commandId);
  assert.equal(out.eligibility.status,E,'100% proves eligibility only');
  assert.equal(out.authority,'read-only');assert.equal(out.executable,false);assert.equal(out.executionStatus,'NOT_AUTHORIZED');
  assert.deepEqual(Array.from(out.blockers,b=>b.code),['AUTHORITY_NOT_ADOPTED','EFFECT_UNAPPROVED']);
  assert.deepEqual(plain(out.eligibility),plain(project(full,scope).capabilities.find(c=>c.commandId===request.commandId)));
  assert(Object.isFrozen(out)&&Object.isFrozen(out.blockers)&&Object.isFrozen(out.eligibility));
  assert.equal(JSON.stringify(request),requestBefore,'request unchanged');
  assert.deepEqual(plain(explain(JSON.parse(before),JSON.parse(requestBefore))),plain(out),'JSON reload parity');
 }
 assert.equal(JSON.stringify(full),before,'evidence unchanged');
 for(const [commandId,n,status] of cases){
  const out=explain(snapshot({issued:300,treasury:0,held:n}),{...scope,commandId});
  assert.equal(out.status,'EXPLAINED');assert.equal(out.eligibility.status,status,commandId+' exact boundary');
  assert.equal(out.executable,false);
 }
 const unknown=explain(full,{...scope,commandId:'informationRequest',issuerEntityId:'entity:company:unknown'});
 assert.equal(unknown.status,'UNKNOWN');assert.equal(unknown.eligibility.status,'UNKNOWN');
 assert.equal(unknown.issues[0].code,'ISSUER_FAMILY_UNSUPPORTED');assert.equal(unknown.executable,false);
 for(const request of [null,[],{...scope,commandId:'executeIPO'},{...scope,commandId:'informationRequest',execute:true}]){
  const out=explain(full,request);assert.equal(out.status,'UNKNOWN');assert.equal(out.executable,false);assert(out.issues.length);
 }
 let getterHits=0;
 const getter={...scope};Object.defineProperty(getter,'commandId',{enumerable:true,get(){getterHits++;throw Error('getter');}});
 assert.equal(explain(full,getter).issues[0].code,'INPUT_INVALID');assert.equal(getterHits,0);
 const payload={};Object.defineProperty(payload,'policy',{enumerable:true,get(){getterHits++;return 'sellAssets';}});
 assert.equal(explain(full,{...scope,commandId:'managementProposal',payload}).issues[0].code,'INPUT_INVALID');assert.equal(getterHits,0);
 const cyclic={};cyclic.self=cyclic;
 assert.equal(explain(full,{...scope,commandId:'managementProposal',payload:cyclic}).issues[0].code,'INPUT_INVALID');
 const forged=plain(full);forged.beneficialHoldings[0].quantity--;
 assert.equal(explain(forged,{...scope,commandId:'specialResolution'}).eligibility.status,'UNKNOWN','forged reconciliation is revalidated');
 // Production-state read path: preserve the whole state/RNG and make persistence, ledger, clock and host RNG fail.
 const game=new loaded.engineModule.TycoonEngine();
 const g=game.g,prior=JSON.stringify(g),draws=hostDraws;
 const save=game.save,event=loaded.modules.finance.event,clock=loaded.ctx.Date;
 game.save=()=>{throw Error('save');};loaded.modules.finance.event=()=>{throw Error('ledger');};
 loaded.ctx.Date=new Proxy(function(){},{apply(){throw Error('clock');},construct(){throw Error('clock');}});
 try{
  const evidence=readModel.ownershipReconciliation(g),request={...scope,commandId:'informationRequest'};
  const a=explain(evidence,request),b=explain(evidence,request);
  assert.deepEqual(plain(a),plain(b));assert.equal(a.status,'EXPLAINED','valid production evidence is explained');assert.equal(a.executable,false);
  assert.equal(explain(game,request).status,'UNKNOWN','an engine is not a reconciliation snapshot');
  assert.equal(JSON.stringify(g),prior,'full production state unchanged');assert.equal(hostDraws,draws,'zero host RNG');
 }finally{game.save=save;loaded.modules.finance.event=event;loaded.ctx.Date=clock;}
 console.log('P3-10 inspect-only ownership command explanation PASS');
}

// Partial P3-10/P3-12 read-only integration evidence, not command activation or formal acceptance.
(async()=>{
 const {boot}=require('./fixtures/subsidiary-quarter-close'),s=boot();await s.backend.hydrate();
 const st=s.engineModule.createInitialState({configured:true});
 Object.assign(st,{currentCompanySerial:1,isCompanySold:false,publicCompany:true,ticker:'OWN',stockPrice:100,
  sharesOut:300,treasuryBuybackShares:0,founderShares:150,personalStocks:{OWN:{qty:1,avg:80}},companyStocks:{}});
 st.market=st.market.filter(row=>row.id!=='OWN');
 st.market.push({id:'OWN',name:st.companyName,price:100,previous:100,issuedShares:300,marketCap:30000,trend:0,volatility:0,priceHistory:[]});
 st.finance=s.modules.finance.defaultFinanceState(st);
 const game=new s.engineModule.TycoonEngine(st);game.updateOwnershipRatios();
 assert.equal(s.modules.finance.validate(plain(game.g)).ok,true);
 assert.equal(game.save(),true);await s.backend.flush();
 const request={...scope,commandId:'ordinaryResolution',payload:{policy:'sellAssets'}};
 function observe(ctx,engine,expected){
  const before=JSON.stringify(engine.g),bytes=ctx.backend.readSync(ctx.key),durable=ctx.durable.get(ctx.key),
   puts=ctx.control.attempts.length,draws=ctx.host.draws,requestBefore=JSON.stringify(request);
  const save=engine.save,emit=engine.emit,event=ctx.modules.finance.event,clock=require('node:vm').runInContext('Date',ctx.ctx);
  engine.save=()=>{throw Error('explanation tried to save');};engine.emit=()=>{throw Error('explanation tried to emit');};
  ctx.modules.finance.event=()=>{throw Error('explanation tried to post');};
  ctx.ctx.Date=new Proxy(function(){},{apply(){throw Error('explanation read clock');},construct(){throw Error('explanation read clock');}});
  let evidence,out;
  try{
   evidence=ctx.modules.economicReadModel.ownershipReconciliation(engine.g);
   out=ctx.modules.phase3ControlEligibility.explainOwnershipCommand(evidence,request);
   assert.equal(out.status,'EXPLAINED');assert.equal(out.eligibility.status,expected);
   assert.equal(out.executable,false);assert.equal(out.executionStatus,'NOT_AUTHORIZED');
   assert.deepEqual(Array.from(out.blockers,b=>b.code),['AUTHORITY_NOT_ADOPTED','EFFECT_UNAPPROVED']);
   assert.deepEqual(plain(ctx.modules.phase3ControlEligibility.explainOwnershipCommand(plain(evidence),plain(request))),plain(out));
  }finally{engine.save=save;engine.emit=emit;ctx.modules.finance.event=event;ctx.ctx.Date=clock;}
  assert.equal(JSON.stringify(engine.g),before,'read preserves full current state and persisted RNG');
  assert.equal(JSON.stringify(request),requestBefore);assert.equal(ctx.host.draws,draws);
  assert.equal(ctx.backend.readSync(ctx.key),bytes);assert.equal(ctx.ctx.localStorage.getItem(ctx.key),bytes);
  assert.equal(ctx.durable.get(ctx.key),durable);assert.equal(ctx.control.attempts.length,puts,'read admits no put');
  return {evidence,out};
 }
 const historical=observe(s,game,E),root=game.g,cash=[game.g.companyCash,game.g.personalCash];
 // Independently pinned beneficial quantities:150 legacy+1personal=151/300, then149+1=150/300.
 const compact=s.modules.saveStorage.compactStateForStorage(game.g,'critical').state;compact.founderShares=149;
 game.importSave(JSON.stringify(compact));assert.notEqual(game.g,root,'real import replaces the root');
 assert.equal(game.g.founderShares,149);assert.equal(game.g.personalStocks.OWN.qty,1);observe(s,game,I);
 assert.deepEqual([game.g.companyCash,game.g.personalCash],cash);await s.backend.flush();
 // A pure API may still explain a historical snapshot; it is never a live authorization or an executable permit.
 const old=s.modules.phase3ControlEligibility.explainOwnershipCommand(historical.evidence,request);
 assert.deepEqual(plain(old),plain(historical.out));assert.equal(old.executable,false);
 const before=JSON.stringify(game.g),bytes=s.backend.readSync(s.key),puts=s.control.attempts.length;
 assert.equal(game.runTransaction(()=>{game.g.founderShares=150;observe(s,game,E);return false;}),false);
 assert.equal(JSON.stringify(game.g),before,'rejected transaction restores imported quantities and full state');
 observe(s,game,I);await s.backend.flush();assert.equal(s.backend.readSync(s.key),bytes);
 assert.equal(s.durable.get(s.key),bytes);assert.equal(s.control.attempts.length,puts,'rejected speculative explanation has no put');
 observe(s,s.engineModule.TycoonEngine.load(),I);
 const {indexedDBFor}=require('./fixtures/pe-fund-acquisition-faults');
 const freshControl={attempts:[]},fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,freshControl)});await fresh.modules.saveStorageIDB.hydrate();
 let freshDraws=0; // Count host RNG only after this independent VM has booted.
 const math=require('node:vm').runInContext('Math',fresh.ctx),random=math.random;math.random=()=>{freshDraws++;throw Error('explanation drew host RNG');};
 try{
  const hydrated=fresh.engineModule.TycoonEngine.load();
  observe({...fresh,backend:fresh.modules.saveStorageIDB,key:s.key,durable:s.durable,control:freshControl,host:{get draws(){return freshDraws;}}},hydrated,I);
  assert.deepEqual([hydrated.g.companyCash,hydrated.g.personalCash],cash);assert.equal(hydrated.g.saveVersion,9);
 }finally{math.random=random;}
 console.log('P3-10 explanation: real import / speculative rollback / reload / fresh fake-IDB / no authority PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
