'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let draws=0;
const api=loadGame({headless:true,random:()=>{draws++;return .25;}}).modules.economicReadModel;
const plain=x=>JSON.parse(JSON.stringify(x));
const base=()=>({saveVersion:9,ticker:'OWN',week:20,currentCompanySerial:1,isCompanySold:false,
  companyCash:123,personalCash:456,simulationRng:{seed:42},
  subsidiaries:[{id:'plain:/%',ownership:.6,status:'active'}],maSubsidiaries:[],overseasSubsidiaries:[],maDealRooms:[],acquisitionTargets:[],internalVentures:[],peDeals:[],startups:[]});
const project=api.projectSubsidiaryRelationships;
const state=base(),before=JSON.stringify(state),drawBefore=draws;
const index=api.buildOwnershipIdentityIndex(state,'player-listed-and-subsidiary-ownership-v1'),view=project(state,index);
assert.equal(view.sourceSnapshotToken,index.sourceSnapshotToken);
const r=view.relationships[0];assert.equal(r.economicFraction.value,.6);assert.equal(r.status,'observed');
assert.equal(r.childEntityId,'entity:company:subsidiary:plain%3A%2F%25');
assert.equal(r.parentEntityId,api.PLAYER_COMPANY_ENTITY_ID);assert.equal(r.beneficialOwnerEntityId,api.PLAYER_COMPANY_ENTITY_ID);
assert.equal(r.votingFraction,null);assert.equal(r.securityClassId,null);assert.equal(r.ownershipKey,null);
assert.equal(view.positions.length,0,'hierarchy is not another beneficial asset');assert.equal(view.complete,false);assert.equal(view.commandEligible,false);
assert.equal(JSON.stringify(state),before);assert.equal(draws,drawBefore);assert(!Object.isFrozen(state));
function frozen(v){if(v&&typeof v==='object'){assert(Object.isFrozen(v));for(const child of Object.values(v))frozen(child);}}
frozen(view);assert.throws(()=>{r.sourceRefs[0].path='bad';},TypeError);
const frozenInput=base();(function lock(value){if(value&&typeof value==='object'){for(const child of Object.values(value))lock(child);Object.freeze(value);}})(frozenInput);
assert.deepEqual(plain(project(frozenInput)),plain(view),'already immutable input is supported');
assert.deepEqual(plain(project(state)),plain(view));assert.deepEqual(plain(project(plain(state))),plain(view),'v9 JSON reload');
for(const status of ['sold','liquidated','exited','inactive','written-off']){
  const raw=base();raw.subsidiaries[0].status=status;const row=project(raw).relationships[0];
  assert.equal(row.status,'historical');assert.equal(row.isCurrent,false);assert.equal(row.economicFraction.value,null);assert.equal(row.assetRole,'historical');
}
for(const status of [undefined,'mystery',null,{},1]){
  const raw=base();raw.subsidiaries[0].status=status;assert.equal(project(raw).relationships[0].status,'unresolved');
}
for(const sold of [undefined,null,true]){const raw=base();raw.isCompanySold=sold;assert.equal(project(raw).relationships[0].economicFraction.value,null,'current parent needs explicit nonsold evidence');}
for(const serial of [undefined,2,'1']){
  const raw=base();raw.currentCompanySerial=serial;const row=project(raw).relationships[0];
  assert.equal(row.economicFraction.value,null);assert.equal(row.observedFraction.value,.6);assert(row.reasons.some(x=>x.code==='GENERATION_UNPROVEN'));
}
for(const value of [-1,NaN,Infinity,1.1,'0.6',null,true]){
  const raw=base();raw.subsidiaries[0].ownership=value;assert.equal(project(raw).relationships[0].economicFraction.value,null);
}
// An installed whole-target close has durable reciprocal deal/target provenance.
function ma(){const raw=base();raw.maSubsidiaries=[{id:'target',maStableKey:'stable',acquisitionDealID:'deal',acquisitionMethod:'friendly',acquiredWeek:10,status:'active'}];raw.maDealRooms=[{id:'deal',targetID:'target',targetStableKey:'stable',status:'acquired',closedWeek:10,acceptedTerms:{method:'friendly'}}];return raw;}
let raw=ma();let row=project(raw).relationships.find(x=>x.childEntityId==='entity:company:ma:target');assert.equal(row.economicFraction.value,1);assert(row.sourceRefs.some(x=>x.family==='ma'&&x.role==='historical'));
for(const mutate of [s=>s.maSubsidiaries[0].ownership=.6,s=>s.maDealRooms[0].status='accepted',s=>s.maDealRooms[0].targetID='other',s=>s.maDealRooms[0].closedWeek=0,s=>s.maSubsidiaries[0].maStableKey='other',s=>s.maDealRooms[0].acceptedTerms.method='unknown',s=>s.acquisitionTargets.push({id:'target'}),s=>s.maDealRooms.push({...s.maDealRooms[0]})]){
  raw=ma();mutate(raw);row=project(raw).relationships.find(x=>x.edgeId==='relationship:maSubsidiaries:target');assert.equal(row.economicFraction.value,null);assert.equal(row.childEntityId,null);
}
raw=base();raw.maSubsidiaries=[{id:'spinout-research',status:'active',ownership:1,valuation:1000000}];assert.equal(project(raw).relationships.find(x=>x.edgeId==='relationship:maSubsidiaries:spinout-research').economicFraction.value,null,'membership/value never proves whole acquisition');
// Stable issuer keys cannot identify two distinct completed targets/deals.
for(const reverse of [false,true]){
  raw=ma();raw.maSubsidiaries.push({...raw.maSubsidiaries[0],id:'other',acquisitionDealID:'deal2'});
  raw.maDealRooms.push({...raw.maDealRooms[0],id:'deal2',targetID:'other'});
  if(reverse){raw.maSubsidiaries.reverse();raw.maDealRooms.reverse();}
  assert(project(raw).relationships.filter(x=>x.edgeId?.startsWith('relationship:maSubsidiaries:')).every(x=>x.childEntityId===null&&x.economicFraction.value===null));
}
raw=ma();raw.acquisitionTargets=[{id:'other',maStableKey:'stable'}];assert.equal(project(raw).relationships.find(x=>x.edgeId==='relationship:maSubsidiaries:target').economicFraction.value,null);
const invalidScope={nested:{value:1}},scopeBefore=JSON.stringify(invalidScope);
const badScope=api.buildOwnershipIdentityIndex(base(),invalidScope);
assert.equal(badScope.sourceScope,null);assert(!Object.isFrozen(invalidScope));assert(!Object.isFrozen(invalidScope.nested));assert.equal(JSON.stringify(invalidScope),scopeBefore);
assert(badScope.issues.some(x=>x.code==='INPUT_INVALID'));
// Venture provenance is reciprocal; operational source is not a second asset.
raw=base();Object.assign(raw.subsidiaries[0],{internalVentureID:'v'});raw.internalVentures=[{id:'v',status:'spun-off',spunOffSubsidiaryID:'plain:/%'}];assert.equal(project(raw).relationships[0].economicFraction.value,.6);
raw.internalVentures[0].spunOffSubsidiaryID='other';assert.equal(project(raw).relationships[0].childEntityId,null);
// PE/VC claims remain explicit aliases pending their canonical family adapters.
for(const [field,root,record]of [['startupID','startups',{id:'s',ownedCompany:.6,ownedPersonal:.1}],['peDealID','peDeals',{id:'s',ownerAccount:'company',status:'active',subsidiaryID:'plain:/%',ownershipRatio:.6}]]){
  raw=base();raw.subsidiaries[0][field]='s';raw[root]=[record];row=project(raw).relationships[0];
  assert.equal(row.assetRole,'alias');assert.equal(row.economicFraction.value,null);assert.equal(row.observedFraction.value,.6);assert.equal(project(raw).positions.length,0);
  raw[root].push({...record});assert(project(raw).issues.some(x=>x.code==='ALIAS_CONFLICT'));
}
raw=base();raw.subsidiaries[0].sourcePEFundID='fund';assert.equal(project(raw).relationships[0].economicFraction.value,null);
raw=base();raw.subsidiaries[0].sourceCompetitorID='rival';assert.equal(project(raw).relationships[0].economicFraction.value,.6,'explicit source does not require deleted competitor to remain');
// Collisions quarantine every claimant, including different roots and row orders.
for(const reverse of [false,true]){
  raw=base();raw.subsidiaries.push({...raw.subsidiaries[0]});if(reverse)raw.subsidiaries.reverse();
  assert(project(raw).relationships.every(x=>x.economicFraction.value===null&&x.childEntityId===null&&x.edgeId===null));
}
raw=base();raw.maSubsidiaries=[{id:'plain:/%',status:'active'}];assert(project(raw).relationships.every(x=>x.childEntityId===null));
raw=base();raw.subsidiaries=[{id:'a',ownership:.6,status:'active',sourceCompetitorID:'r'},{id:'b',ownership:.4,status:'active',sourceCompetitorID:'r'}];assert(project(raw).relationships.every(x=>x.childEntityId===null));
raw=base();raw.subsidiaries.push({id:'replacement',ownership:1,status:'active',restructuredFrom:['plain:/%','old'],startupID:'copied'});assert(project(raw).relationships.every(x=>x.economicFraction.value===null),'live predecessor overlap quarantines both');
raw=base();raw.subsidiaries=[{id:'replacement',ownership:1,status:'active',restructuredFrom:['a','b'],startupID:'copied'}];assert.equal(project(raw).relationships[0].economicFraction.value,null,'no identity reconstruction from inherited links');
raw=base();raw.overseasSubsidiaries=[{id:'o',status:'preparing'}];row=project(raw).relationships.find(x=>x.edgeId==='relationship:overseasSubsidiaries:o');assert.equal(row.economicFraction.value,null);assert(row.reasons.some(x=>x.code==='ISSUER_FAMILY_UNSUPPORTED'));
for(const mutate of [s=>s.subsidiaries[0].ownership=.7,s=>s.maDealRooms.push({id:'new'}),s=>s.currentCompanySerial=2,s=>s.internalVentures.push({id:'new'})]){
  raw=base();const handle=api.buildOwnershipIdentityIndex(raw,'player-listed-and-subsidiary-ownership-v1');mutate(raw);assert(project(raw,handle).issues.some(x=>x.code==='STALE_EVIDENCE'));
}
for(const handle of [{},api.buildOwnershipIdentityIndex(state),api.buildOwnershipIdentityIndex(plain(state),'player-listed-and-subsidiary-ownership-v1')])assert(project(state,handle).issues.some(x=>x.code==='STALE_EVIDENCE'));
for(const raw of [null,[],{...base(),subsidiaries:{}},{...base(),subsidiaries:[{id:' ',status:'active'}]},{...base(),isCompanySold:'false'}]){assert.equal(project(raw).relationships.length,0);assert(project(raw).issues.some(x=>['INPUT_INVALID','STALE_EVIDENCE'].includes(x.code)));}
let getters=0;raw=base();Object.defineProperty(raw.subsidiaries[0],'ownership',{get(){getters++;throw Error('no getter');},enumerable:true});assert(project(raw).issues.some(x=>x.code==='INPUT_INVALID'));assert.equal(getters,0);
// Descriptor-safe capture ignores operating history, never invokes mutating helpers.
raw=base();Object.defineProperty(raw.subsidiaries[0],'valuation',{get(){getters++;throw Error('not an ownership source');},enumerable:true});assert.equal(project(raw).relationships[0].economicFraction.value,.6);assert.equal(getters,0);
// Exercise installed open/close wrappers; accepted terms are fixture setup, not
// a simulation of seller negotiation. Reader must leave the committed state intact.
const {createScenario,selectAndApprove}=require('./ma-acquisition-financing-fixture');
const installed=createScenario({loadOptions:{headless:true}}),terms={...installed.deal.acceptedTerms};
installed.game.g.maDealRooms=[];installed.target.activeDealID=null;installed.game.g.departments.investment=true;
assert.equal(installed.game.openMADealRoom(installed.target.id),true);
installed.deal=installed.game.g.maDealRooms[0];
Object.assign(installed.deal,{status:'accepted',diligenceLevel:'full',diligenceConfidence:.94,acceptedTerms:terms});
selectAndApprove(installed);assert.equal(installed.game.closeMADeal(installed.deal.id),true);
const committed=JSON.stringify(installed.game.g),closed=installed.modules.economicReadModel.projectSubsidiaryRelationships(installed.game.g);
assert.equal(closed.relationships[0].economicFraction.value,1);assert.equal(closed.relationships[0].votingFraction,null);
assert.equal(JSON.stringify(installed.game.g),committed);
const loaded=installed.engineModule.TycoonEngine.load();assert.equal(loaded.g.saveVersion,9);
assert.deepEqual(plain(installed.modules.economicReadModel.projectSubsidiaryRelationships(loaded.g)),plain(closed),'installed v9 save/load retains relationship evidence');
const legacy=createScenario({loadOptions:{headless:true}});selectAndApprove(legacy);assert.equal(legacy.game.closeMADeal(legacy.deal.id),true);
assert.equal(legacy.modules.economicReadModel.projectSubsidiaryRelationships(legacy.game.g).relationships[0].economicFraction.value,null,'a completed legacy fixture without stable deal linkage remains unknown');
console.log('PASS P3-6 direct source relationships: lifecycle, provenance, quarantine, accounts, scoped index, purity and v9 reload');
