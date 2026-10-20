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
    beneficialHoldings:[{beneficialHoldingId:'beneficial:player-company:founder',issuerEntityId:PLAYER,securityClassId:'security:player-company:common',beneficialOwnerEntityId:FOUNDER,quantity:held}],
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
assert.equal(project(snapshot({issued:300,treasury:0,held:10,aliases:[{reason:'issuer-family-alias-not-adopted'}]}),scope).status,'EVALUATED','other issuers do not affect the player denominator');
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
  Object.assign(state,{publicCompany:true,sharesOut:1000,treasuryBuybackShares:100,founderShares:400,personalStocks:{[state.ticker]:{qty:51,avg:900},ZZZ:{qty:5,avg:50}}});
  const before=JSON.stringify(state),draws=hostDraws;
  const reconciliation=readModel.ownershipReconciliation(state);
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
console.log('P3-9 control eligibility projection tests passed');
