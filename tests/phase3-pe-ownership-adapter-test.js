'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let draws=0;const loaded=loadGame({headless:true,random:()=>{draws++;return .25;}});
const api=loaded.modules.economicReadModel,project=api.projectPEOwnership;
const plain=x=>JSON.parse(JSON.stringify(x));
const fixture=()=>({ticker:'OWN',currentCompanySerial:1,isCompanySold:false,
 peDeals:[{id:'p:/%',status:'active',ownerAccount:'personal',ownershipRatio:.7},
 {id:'company',status:'active',ownerAccount:'company',ownershipRatio:.6,subsidiaryID:'sub'}],
 subsidiaries:[{id:'sub',status:'active',peDealID:'company',ownership:.6}],maSubsidiaries:[],overseasSubsidiaries:[]});
const raw=fixture(),before=JSON.stringify(raw),drawBefore=draws;
const index=api.buildOwnershipIdentityIndex(raw,'player-listed-and-subsidiary-ownership-v1'),view=project(raw,index);
assert.equal(view.positions.length,2);assert.equal(view.complete,false);assert.equal(view.commandEligible,false);assert.equal(view.wealthComplete,false);
assert.equal(view.sourceSnapshotToken,index.sourceSnapshotToken);assert.equal(view.aliasReplacements.length,1);
const company=view.positions.find(p=>p.accountKind==='company'),personal=view.positions.find(p=>p.accountKind==='personal');
assert.equal(company.economicFraction.value,.6);assert.equal(personal.economicFraction.value,.7);
assert.notEqual(company.registeredHolder.entityId,personal.registeredHolder.entityId);
assert.equal(personal.issuer.entityId,'entity:company:pe-direct:p%3A%2F%25');
assert.equal(view.aliasReplacements[0].sourcePath,'subsidiaries[0]');assert.equal(view.aliasReplacements[0].positionId,company.positionId);
for(const p of view.positions){assert.equal(p.ownershipKey,null);assert.equal(p.securityClassId,null);assert.equal(p.quantity.value,null);assert.equal(p.votingUnits.value,null);assert.equal(p.issuer.identityStatus,'source-scoped');}
assert.equal(JSON.stringify(raw),before);assert.equal(draws,drawBefore);assert(!Object.isFrozen(raw));
(function frozen(v){if(v&&typeof v==='object'){assert(Object.isFrozen(v));for(const c of Object.values(v))frozen(c);}})(view);
assert.deepEqual(plain(project(raw)),plain(view));assert.deepEqual(plain(project(plain(raw))),plain(view));
for(const mutate of [s=>s.peDeals[0].ownershipRatio=.8,s=>s.subsidiaries[0].ownership=.7,s=>s.peDeals[0].ownerAccount='company']){
 const state=fixture(),handle=api.buildOwnershipIdentityIndex(state,'player-listed-and-subsidiary-ownership-v1');mutate(state);
 assert(project(state,handle).issues.some(i=>i.code==='STALE_EVIDENCE'));
}
for(const handle of [{},api.buildOwnershipIdentityIndex(raw),api.buildOwnershipIdentityIndex(plain(raw),'player-listed-and-subsidiary-ownership-v1')])assert(project(raw,handle).issues.some(i=>i.code==='STALE_EVIDENCE'));
for(const value of [-1,1.1,NaN,Infinity,'0.7',null]){const s=fixture();s.peDeals[0].ownershipRatio=value;const p=project(s).positions.find(p=>p.accountKind==='personal');assert.equal(p.economicFraction.value,null);assert(p.reasons.some(i=>i.code==='FRACTION_INVALID'));}
for(const value of [0,1,.5]){const s=fixture();s.peDeals[0].ownershipRatio=value;assert.equal(project(s).positions.find(p=>p.accountKind==='personal').economicFraction.value,value);}
for(const value of [undefined,'fund','',null]){const s=fixture();s.peDeals[0].ownerAccount=value;const p=project(s).positions.find(p=>p.sourceDealID==='p:/%');assert.equal(p.accountKind,'unknown');assert.equal(p.economicFraction.value,null);}
for(const mutate of [s=>s.subsidiaries[0].ownership=.5,s=>s.subsidiaries[0].status='sold',s=>s.subsidiaries[0].peDealID='other',s=>s.subsidiaries.push({...s.subsidiaries[0]}),s=>s.subsidiaries.push({id:null,peDealID:'company'}),s=>s.maSubsidiaries.push({id:'sub'}),s=>s.overseasSubsidiaries.push({id:'sub'}),s=>s.subsidiaries[0].startupID='s',s=>s.subsidiaries[0].restructuredFrom=['old'],s=>s.peDeals.push({id:null,subsidiaryID:'sub'}),s=>s.maSubsidiaries.push({id:'another',peDealID:'company'}),s=>s.overseasSubsidiaries.push({id:'another',peDealID:'company'})]){
 const s=fixture();mutate(s);const v=project(s),p=v.positions.find(p=>p.accountKind==='company');assert.equal(p.economicFraction.value,null);assert.equal(v.aliasReplacements.length,0);
}
for(const serial of [undefined,2,3]){const s=fixture();s.currentCompanySerial=serial;assert.equal(project(s).positions.find(p=>p.accountKind==='company').economicFraction.value,null);}
for(const sold of [undefined,null,true]){const s=fixture();s.isCompanySold=sold;const p=project(s).positions.find(p=>p.accountKind==='company');assert.equal(p.economicFraction.value,null);assert.equal(p.registeredHolder.identityStatus,'unresolved');}
for(const first of [false,true]){const s=fixture(),duplicate={...s.peDeals[0],ownerAccount:'company'};if(first)s.peDeals.unshift(duplicate);else s.peDeals.push(duplicate);const v=project(s);assert(v.positions.filter(p=>p.sourceDealID==='p:/%').every(p=>p.issuer.entityId===null&&p.economicFraction.value===null));}
const exited=fixture();exited.peDeals[0].status='exited';assert(!project(exited).positions.some(p=>p.sourceDealID==='p:/%'));
let getters=0;const getter=fixture();Object.defineProperty(getter.peDeals[0],'ownershipRatio',{get(){getters++;throw Error('getter');},enumerable:true});assert(project(getter).issues.some(i=>i.code==='INPUT_INVALID'));assert.equal(getters,0);
for(const s of [null,[],{...fixture(),peDeals:{}},{...fixture(),subsidiaries:null}])assert(project(s).issues.some(i=>i.code==='INPUT_INVALID'));
// Use installed current writers only to produce observations; the reader does not call them.
const engine=new loaded.engineModule.TycoonEngine();engine.g.personalCash=100000000;engine.g.companyCash=100000000;engine.g.departments.investment=true;
engine.g.finance=loaded.modules.finance.defaultFinanceState(engine.g);
assert.equal(engine.createPEDeal('テック',10000000,'personal'),true);let deal=engine.g.peDeals.at(-1);
assert.equal(project(engine.g).positions.find(p=>p.sourceDealID===deal.id).accountKind,'personal');
assert.equal(engine.transferPEDealToCompany(deal.id),true);deal=engine.g.peDeals.find(d=>d.id===deal.id);
const committed=JSON.stringify(engine.g),after=project(engine.g);assert.equal(JSON.stringify(engine.g),committed);
assert.equal(after.aliasReplacements.length,1);assert.equal(after.positions[0].economicFraction.value,deal.ownershipRatio);
assert.equal(engine.exitPEDeal(deal.id),true);assert.equal(project(engine.g).positions.length,0);
assert.equal(engine.g.saveVersion,9);assert.equal(loaded.engineModule.SAVE_KEY,'capitalism_tycoon_web_v1');
console.log('PASS P3-7 legacy direct PE ownership: accounts, reciprocal aliases, quarantine, scoped tokens, purity and installed lifecycle');
