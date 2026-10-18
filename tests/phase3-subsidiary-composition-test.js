'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let draws=0;
const api=loadGame({headless:true,random:()=>{draws++;return .25;}}).modules.economicReadModel;
const plain=x=>JSON.parse(JSON.stringify(x));
const fixture=()=>({saveVersion:9,ticker:'OWN',week:20,currentCompanySerial:1,isCompanySold:false,
  companyName:'Company',playerName:'Founder',publicCompany:true,sharesOut:1000,treasuryBuybackShares:100,founderShares:600,
  companyCash:123,personalCash:456,simulationRng:{seed:42},market:[{id:'OWN'},{id:'X'}],
  personalStocks:{OWN:{qty:10,avg:2},X:{qty:20,avg:4}},companyStocks:{X:{qty:30,avg:5}},
  subsidiaries:[{id:'mirror',peDealID:'deal',ownership:.7,status:'active',source:'pe'}],
  peDeals:[{id:'deal',ownerAccount:'company',status:'active',subsidiaryID:'mirror',ownershipRatio:.7}],
  startups:[],maSubsidiaries:[],overseasSubsidiaries:[],maDealRooms:[],acquisitionTargets:[],internalVentures:[]});
const project=api.projectSubsidiaryOwnershipSnapshot;
assert.equal(typeof project,'function');
const raw=fixture(),before=JSON.stringify(raw),rngBefore=draws;
const index=api.buildOwnershipIdentityIndex(raw,'player-listed-and-subsidiary-ownership-v1');
const result=project(raw,index),listed=api.projectOwnershipSnapshot(raw,index),pe=api.projectPEOwnership(raw,index);
assert.equal(result.sourceSnapshotToken,index.sourceSnapshotToken);
assert.equal(result.positions.length,listed.positions.length+pe.positions.length,'relationship is not a second PE asset');
assert.deepEqual(plain(result.positions.slice(0,listed.positions.length)),plain(listed.positions),'founder and listed quantities unchanged');
const edge=result.relationships.find(r=>r.canonicalPositionId===pe.positions[0].positionId);
assert(edge);assert.equal(edge.childEntityId,pe.positions[0].issuer.entityId);
assert.equal(edge.parentEntityId,api.PLAYER_COMPANY_ENTITY_ID);assert.equal(edge.economicFraction.value,.7);
assert.equal(edge.votingFraction,null);assert.equal(edge.securityClassId,null);assert.equal(edge.ownershipKey,null);
assert.equal(result.relationships.filter(r=>r.sourceRefs.some(s=>s.path==='subsidiaries[0]')).length,1,'mirror is replaced once');
assert.equal(result.relationshipReplacements.filter(r=>r.sourcePath==='subsidiaries[0]').length,1);
assert.equal(result.complete,false);assert.equal(result.commandEligible,false);assert.equal(result.wealthComplete,false);
assert(result.coverage.some(r=>r.family==='vc'&&r.status==='not-implemented'));
assert.equal(JSON.stringify(raw),before);assert.equal(draws,rngBefore);assert(!Object.isFrozen(raw));
function frozen(x){if(x&&typeof x==='object'){assert(Object.isFrozen(x));for(const y of Object.values(x))frozen(y);}}
frozen(result);assert.throws(()=>{edge.economicFraction.value=1;},TypeError);
assert.deepEqual(plain(project(raw)),plain(result));assert.deepEqual(plain(project(plain(raw))),plain(result),'v9 reload');
const locked=fixture();(function lock(x){if(x&&typeof x==='object'){for(const y of Object.values(x))lock(y);Object.freeze(x);}})(locked);
assert.deepEqual(plain(project(locked)),plain(result),'already frozen input accepted without mutation');
const reordered=fixture();reordered.subsidiaries.push({id:'mirror2',peDealID:'deal2',ownership:.3,status:'active',source:'pe'});
reordered.peDeals.push({id:'deal2',ownerAccount:'company',status:'active',subsidiaryID:'mirror2',ownershipRatio:.3});
const semantic=model=>({positions:model.positions.map(p=>[p.positionId,p.accountKind,p.economicFraction.value]),
  relationships:model.relationships.map(r=>[r.edgeId,r.childEntityId,r.canonicalPositionId,r.economicFraction.value])});
const ordered=semantic(project(reordered));reordered.subsidiaries.reverse();reordered.peDeals.reverse();
assert.deepEqual(semantic(project(reordered)),ordered,'source order changes paths, not economic identity or fractions');
const standalone=fixture();standalone.subsidiaries.push({id:'standalone',ownership:.4,status:'active'});
const sv=project(standalone);assert.equal(sv.relationships.find(r=>r.edgeId==='relationship:subsidiaries:standalone').economicFraction.value,.4);
assert.equal(sv.positions.length,result.positions.length,'standalone hierarchy does not fabricate another asset');
for(const mutate of [s=>s.peDeals[0].ownershipRatio=.6,s=>s.subsidiaries[0].ownership=.6,s=>s.peDeals[0].status='exited',s=>s.peDeals[0].ownerAccount='personal',s=>s.subsidiaries.push({...s.subsidiaries[0],id:'other'}),s=>s.peDeals.push({...s.peDeals[0]})]){
  const state=fixture();mutate(state);const model=project(state);
  assert(!model.relationships.some(r=>r.canonicalPositionId&&r.isCurrent),'conflicting/historical mirror cannot be promoted');
}
for(const serial of [undefined,2,'1']){const s=fixture();s.currentCompanySerial=serial;assert(!project(s).relationships.some(r=>r.isCurrent));}
for(const sold of [undefined,null,true,'false']){const s=fixture();s.isCompanySold=sold;assert(!project(s).relationships.some(r=>r.isCurrent));}
// The separate personal PE owner is not another company interest or look-through founder asset.
const two=fixture();two.peDeals.push({id:'personal',ownerAccount:'personal',status:'active',ownershipRatio:.2});
const pv=project(two);assert.equal(pv.positions.filter(p=>p.accountKind==='personal'&&p.sourceDealID==='personal').length,1);
assert(!pv.relationships.some(r=>r.canonicalPositionId&&r.parentEntityId===api.FOUNDER_ENTITY_ID));
// A second restructuring claim can be invalid in the hierarchy despite valid local PE reciprocity.
const overlap=fixture();overlap.subsidiaries.push({id:'replacement',restructuredFrom:['mirror','old'],ownership:.7,status:'active'});
const ov=project(overlap);assert(!ov.relationships.some(r=>r.canonicalPositionId&&r.isCurrent));
assert.equal(ov.positions.find(p=>p.sourceDealID==='deal').economicFraction.value,null,'composition quarantines the conflicting economic claim too');
assert(ov.positions.find(p=>p.sourceDealID==='deal').reasons.some(r=>r.code==='ALIAS_CONFLICT'));
const vc=fixture();vc.subsidiaries=[{id:'vc',startupID:'startup',ownership:.6,status:'active'}];vc.peDeals=[];vc.startups=[{id:'startup',ownedCompany:.6,ownedPersonal:.1}];
const vv=project(vc);assert.equal(vv.relationships[0].assetRole,'alias');assert.equal(vv.relationships[0].economicFraction.value,null,'VC canonical prerequisite stays unsupported');
for(const handle of [{},api.buildOwnershipIdentityIndex(raw),api.buildOwnershipIdentityIndex(plain(raw),'player-listed-and-subsidiary-ownership-v1')]){
  const bad=project(raw,handle);assert.equal(bad.positions.length,0);assert.equal(bad.relationships.length,0);assert(bad.issues.some(r=>r.code==='STALE_EVIDENCE'));
}
for(const mutate of [s=>s.peDeals[0].ownershipRatio=.5,s=>s.subsidiaries[0].ownership=.5,s=>s.personalStocks.X.qty++,s=>s.currentCompanySerial++]){
  const state=fixture(),handle=api.buildOwnershipIdentityIndex(state,'player-listed-and-subsidiary-ownership-v1');mutate(state);
  const bad=project(state,handle);assert.equal(bad.positions.length,0);assert.equal(bad.relationships.length,0);assert(bad.issues.some(r=>r.code==='STALE_EVIDENCE'));
}
let getters=0;const accessor=fixture();Object.defineProperty(accessor.peDeals[0],'ownershipRatio',{get(){getters++;throw Error('getter');},enumerable:true});
assert(project(accessor).issues.some(r=>r.code==='INPUT_INVALID'));assert.equal(getters,0);
console.log('PASS subsidiary composition: canonical PE mirror replacement, separate owners, unknown rights, token binding, v9 and purity');
