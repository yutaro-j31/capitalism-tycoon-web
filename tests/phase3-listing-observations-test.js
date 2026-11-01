'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let draws=0;
const api=loadGame({headless:true,random:()=>{draws++;return .25;}}).modules.economicReadModel;
const fixture=()=>({saveVersion:9,ticker:'OWN',currentCompanySerial:1,sharesOut:1000,founderShares:600,
  market:[{id:'X',price:2.5,issuedShares:1000},{id:'ORPHAN',price:3,issuedShares:2000},{id:'IPO',price:4,issuedShares:500}],
  startups:[{id:'s1',ipoStockID:'IPO',ownedPersonal:0,ownedCompany:0}],
  personalStocks:{X:{qty:20},IPO:{qty:5}},companyStocks:{X:{qty:30}}});
const raw=fixture(),before=JSON.stringify(raw),drawBefore=draws;
const index=api.buildOwnershipIdentityIndex(raw),model=api.projectOwnershipSnapshot(raw,index);
assert.equal(model.snapshotVersion,2);assert.equal(model.sourceScope,'player-and-listed-ownership-v2');
assert.equal(model.listingObservations.length,3);
assert.deepEqual(Array.from(model.listingObservations,row=>row.instrumentAlias),['IPO','ORPHAN','X']);
const x=model.listingObservations.find(row=>row.instrumentAlias==='X');
assert.equal(x.issued.value,1000);assert.equal(x.price.value,2.5);
assert.equal(x.issuerEntityId,null);assert.equal(x.securityClassId,null);
assert.equal(x.treasury.value,null);assert.equal(x.outstanding.value,null);assert.equal(x.rightsStatus,'unknown');
assert.equal(model.listingObservations[0].issuerEntityId,'entity:company:startup:s1','reuse existing source-scoped IPO evidence only');
assert.equal(model.listingObservations[1].issuerEntityId,null,'unheld market row must not invent a legal issuer');
assert.equal(model.positions.filter(row=>row.instrumentAlias==='X').length,2,'observations never pool personal/company positions');
assert.equal(model.complete,false);assert.equal(model.wealthComplete,false);assert.equal(model.commandEligible,false);
assert.equal(JSON.stringify(raw),before);assert.equal(draws,drawBefore);assert(!Object.isFrozen(raw));
assert(Object.isFrozen(x.price));assert.throws(()=>{x.price.value=8;},TypeError);
for(const field of ['price','issuedShares']){
  const state=fixture(),handle=api.buildOwnershipIdentityIndex(state);state.market[0][field]++;
  for(const view of [api.projectOwnershipSnapshot(state,handle),api.projectExternalListedHoldings(state,handle)])assert(view.issues.some(row=>row.code==='STALE_EVIDENCE'));
  for(const value of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'3',{},true]){
    const state=fixture();state.market[0][field]=value;
    const obs=api.projectOwnershipSnapshot(state).listingObservations.find(row=>row.instrumentAlias==='X');
    const result=field==='price'?obs.price:obs.issued;
    assert.equal(result.status,'invalid');assert.equal(result.value,null);assert(result.reasons.some(row=>row.code==='OBSERVATION_OUT_OF_ENVELOPE'));
  }
  for(const value of [undefined,null]){
    const state=fixture();state.market[0][field]=value;
    const obs=api.projectOwnershipSnapshot(state).listingObservations.find(row=>row.instrumentAlias==='X');
    assert.equal((field==='price'?obs.price:obs.issued).status,'unknown');
  }
  for(const value of [0,.5,Number.MAX_SAFE_INTEGER]){
    const state=fixture();state.market[0][field]=value;
    const obs=api.projectOwnershipSnapshot(state).listingObservations.find(row=>row.instrumentAlias==='X');
    assert.equal((field==='price'?obs.price:obs.issued).value,value);assert.equal(obs.outstanding.value,null);
  }
}
const duplicate=fixture();duplicate.market.push({id:'X',issuedShares:9999,price:999});
const dup=api.projectOwnershipSnapshot(duplicate).listingObservations.find(row=>row.instrumentAlias==='X');
assert.equal(dup.sourceRefs.length,2);assert.equal(dup.issued.value,null);assert.equal(dup.price.value,null);
assert.equal(dup.issuerEntityId,null);assert.equal(dup.listingStatus,'unknown');assert(dup.reasons.some(row=>row.code==='ALIAS_CONFLICT'));
for(const flag of ['privateCompany','suspended']){
  const state=fixture();state.market[0][flag]=true;
  assert.equal(api.projectOwnershipSnapshot(state).listingObservations.find(row=>row.instrumentAlias==='X').listingStatus,flag==='privateCompany'?'private':'suspended');
  assert.equal(api.projectOwnershipSnapshot(state).positions.filter(row=>row.instrumentAlias==='X').length,2);
  state.market[0][flag]='false';assert.equal(api.projectOwnershipSnapshot(state).listingObservations.find(row=>row.instrumentAlias==='X').listingStatus,'unknown');
}
let getters=0;const accessor=fixture();Object.defineProperty(accessor.market[0],'price',{get(){getters++;throw Error('no');},enumerable:true});
assert(api.projectOwnershipSnapshot(accessor).issues.some(row=>row.code==='INPUT_INVALID'));assert.equal(getters,0);
const source=fixture(),roundtrip=JSON.parse(JSON.stringify(source));
assert.deepEqual(JSON.parse(JSON.stringify(api.projectOwnershipSnapshot(source))),JSON.parse(JSON.stringify(api.projectOwnershipSnapshot(roundtrip))));
const reorder=fixture();reorder.personalStocks={IPO:{qty:5},X:{qty:20}};
assert.deepEqual(JSON.parse(JSON.stringify(api.projectOwnershipSnapshot(source))),JSON.parse(JSON.stringify(api.projectOwnershipSnapshot(reorder))));
// P3-8: IPO source links explain existing listed positions, never mint a second lot.
{
 const s=fixture(),before=JSON.stringify(s),n=draws,view=api.projectOwnershipSnapshot(s),link=view.conversionLinks[0];
 assert.equal(link.startupSourceId,'s1');assert.equal(link.instrumentAlias,'IPO');assert.equal(link.status,'source-linked');
 assert.equal(link.issuerEntityId,'entity:company:startup:s1');assert.equal(link.conversionQuantity,null);assert.equal(link.roundingResidual,null);
 const personal=link.currentPositions.find(x=>x.account==='personal'),company=link.currentPositions.find(x=>x.account==='company');
 assert.equal(personal.quantity.value,5);assert.equal(personal.matchedToStartup,true);
 assert.equal(company.quantity.value,null,'absent lot is not zero or a fabricated original conversion');
 assert.equal(company.parentGenerationStatus,'unproven');assert(company.reasons.some(x=>x.code==='SOURCE_UNKNOWN'));
 assert.equal(company.matchedToStartup,false);assert.equal(link.securityClassId,null);assert.equal(link.votingFraction,null);assert.equal(link.wealthValue,null);
 assert.equal(JSON.stringify(s),before);assert.equal(draws,n);assert(!Object.isFrozen(s));assert(Object.isFrozen(personal.quantity));
 assert.equal(view.positions.filter(x=>x.instrumentAlias==='IPO').length,1,'links create no extra position');
 assert.equal(view.sourceReplacements.filter(x=>x.sourcePath==='personalStocks["IPO"]').length,1);
 for(const mutate of [t=>t.startups[0].ownedPersonal=.1,t=>t.startups.push({...t.startups[0]}),
  t=>t.market.push({...t.market[2]}),t=>t.ticker='IPO']){
  const t=fixture();mutate(t);const v=api.projectOwnershipSnapshot(t);
  assert(v.conversionLinks.every(x=>x.status==='unresolved'&&x.issuerEntityId===null));
  assert(v.conversionLinks.every(x=>x.conversionQuantity===null&&x.roundingResidual===null));
 }
 const missing=fixture();delete missing.personalStocks.IPO;
 assert(api.projectOwnershipSnapshot(missing).conversionLinks[0].currentPositions.every(x=>x.quantity.value===null),'no inferred IPO lot when both maps omit it');
 const noMarket=fixture();noMarket.market=noMarket.market.filter(x=>x.id!=='IPO');
 assert.equal(api.projectOwnershipSnapshot(noMarket).conversionLinks[0].status,'unresolved');
 const badAlias=fixture();badAlias.startups[0].ipoStockID=123;badAlias.personalStocks.null={qty:999};
 assert.equal(api.projectOwnershipSnapshot(badAlias).conversionLinks.length,0,'existing invalid-input quarantine cannot select an unrelated string-null lot');
 const traded=fixture();traded.personalStocks.IPO.qty=9;
 const changed=api.projectOwnershipSnapshot(traded).conversionLinks[0];
 assert.equal(changed.currentPositions.find(x=>x.account==='personal').quantity.value,9);assert.equal(changed.conversionQuantity,null,'current trade quantity is not the IPO allotment');
 const invalid=fixture();invalid.personalStocks.IPO.qty=-1;
 assert.equal(api.projectOwnershipSnapshot(invalid).conversionLinks[0].currentPositions.find(x=>x.account==='personal').quantity.value,null);
 const tokenState=fixture(),token=api.buildOwnershipIdentityIndex(tokenState);tokenState.personalStocks.IPO.qty++;
 const stale=api.projectOwnershipSnapshot(tokenState,token);assert.equal(stale.conversionLinks.length,0);assert(stale.issues.some(x=>x.code==='STALE_EVIDENCE'));
 const handle=api.buildOwnershipIdentityIndex(s);const copy=JSON.parse(JSON.stringify(s));
 assert.equal(api.projectOwnershipSnapshot(copy,handle).conversionLinks.length,0,'replacement root rejects old token');
 assert.deepEqual(JSON.parse(JSON.stringify(api.projectOwnershipSnapshot(copy))),JSON.parse(JSON.stringify(view)));
}
// Installed IPO produces the same source-linked current quantities; reading posts nothing.
{
 let seed=333;const loaded=loadGame({headless:true,random:()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32)});
 const e=new loaded.engineModule.TycoonEngine(),s=e.g.startups[0];
 Object.assign(s,{alive:true,subsidiary:false,ownedCompany:.2,ownedPersonal:.1,totalInvestedCompany:20e6,totalInvestedPersonal:10e6,valuation:100e6,activeFundingRound:null});
 assert.notEqual(e.listStartup(s),false);assert(s.ipoStockID);
 const before=JSON.stringify(e.g),v=loaded.modules.economicReadModel.projectOwnershipSnapshot(e.g);
 const link=v.conversionLinks.find(x=>x.startupSourceId===s.id);assert.equal(link.status,'source-linked');
 assert.equal(link.currentPositions.find(x=>x.account==='company').quantity.value,200000);
 assert.equal(link.currentPositions.find(x=>x.account==='personal').quantity.value,100000);
 assert.equal(link.conversionQuantity,null);assert.equal(link.roundingResidual,null);
 assert.equal(JSON.stringify(e.g),before,'projection never replays the IPO or writes a receipt');
}
const oldShape=api.projectExternalListedHoldings(source);assert(!Object.hasOwn(oldShape,'listingObservations'),'legacy opt-in API shape preserved');
console.log('PASS phase3 listing observations: strict observations, unknown rights/denominator, duplicate quarantine, token invalidation and purity');
