'use strict';
const assert=require('node:assert/strict');
const {loadGame}=require('./harness');
let draws=0;
const loaded=loadGame({headless:true,random:()=>{draws++;return 0.25;}});
const api=loaded.modules.economicReadModel;
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){return {saveVersion:9,ticker:'OWN',week:7,currentCompanySerial:1,isCompanySold:false,
  companyName:'Company',playerName:'Founder',publicCompany:true,sharesOut:1000,treasuryBuybackShares:100,founderShares:600,
  market:[{id:'OWN'},{id:'X'}],startups:[],personalStocks:{OWN:{qty:10,avg:2},X:{qty:20,avg:4}},companyStocks:{X:{qty:30,avg:5}}};}
const state=fixture(),before=JSON.stringify(state),drawBefore=draws;
const index=api.buildOwnershipIdentityIndex(state),model=api.projectOwnershipSnapshot(state,index);
assert.equal(model.positions.length,3);
assert.equal(model.positions[0].quantity.value,610);
assert.equal(model.classes[0].outstandingQuantity,900);
assert.equal(model.positions[0].assetRole,'founder-equity');
assert.equal(model.positions[1].accountKind,'company');assert.equal(model.positions[1].quantity.value,30);
assert.equal(model.positions[2].accountKind,'personal');assert.equal(model.positions[2].quantity.value,20);
assert.equal(model.sourceReplacements.length,4);
assert.equal(new Set(model.sourceReplacements.map(row=>row.sourcePath)).size,4);
assert(!Object.hasOwn(model,'unresolvedAliases'),'legacy aliases are replaced rather than appended');
assert.equal(model.sourceSnapshotToken,index.sourceSnapshotToken);
assert.equal(api.projectExternalListedHoldings(state,index).sourceSnapshotToken,index.sourceSnapshotToken);
assert.equal(model.complete,false);assert.equal(model.commandEligible,false);assert.equal(model.wealthComplete,false);
assert(model.coverage.some(row=>row.family==='vc'&&row.status==='not-implemented'));
assert.equal(JSON.stringify(state),before);assert.equal(draws,drawBefore);assert(!Object.isFrozen(state));
function frozen(value){if(value&&typeof value==='object'){assert(Object.isFrozen(value));for(const child of Object.values(value))frozen(child);}}
frozen(model);frozen(index);
assert.throws(()=>{model.positions[0].quantity.value=0;},TypeError);
assert.deepEqual(plain(api.projectOwnershipSnapshot(state)),plain(model));
assert.deepEqual(plain(api.projectOwnershipSnapshot(plain(state))),plain(model),'v9 JSON reload retains evidence');
for(const mutate of [s=>s.sharesOut++,s=>s.founderShares++,s=>s.personalStocks.X.qty++,s=>s.personalStocks.X.avg++,s=>s.week++,s=>s.currentCompanySerial++,s=>s.market.push({id:'X'})]){
  const raw=fixture(),handle=api.buildOwnershipIdentityIndex(raw);mutate(raw);
  for(const result of [api.projectOwnershipSnapshot(raw,handle),api.projectExternalListedHoldings(raw,handle)]){
    assert(result.issues.some(row=>row.code==='STALE_EVIDENCE'));assert.equal(result.positions.length,0);
  }
}
for(const handle of [{},api.buildListedHoldingsIdentityIndex(state),api.buildOwnershipIdentityIndex(plain(state))])assert(api.projectOwnershipSnapshot(state,handle).issues.some(row=>row.code==='STALE_EVIDENCE'));
for(const serial of [undefined,2,3]){
  const raw=fixture();raw.currentCompanySerial=serial;
  const view=api.projectOwnershipSnapshot(raw);
  assert.equal(view.positions.length,4);assert.equal(view.positions[0].quantity.value,600);
  assert.equal(view.positions[0].assetRole,'unresolved');assert.equal(view.classes.length,0);
  const retained=view.positions.find(row=>row.instrumentAlias==='OWN');assert.equal(retained.quantity.value,10);
  assert.equal(retained.securityClassId,null);assert.equal(retained.votingUnits.value,null);
  assert.equal(view.sourceReplacements.filter(row=>row.sourcePath==='personalStocks["OWN"]').length,1);
}
for(const startups of [[{id:'s',ipoStockID:'OWN',ownedPersonal:0,ownedCompany:0}]]){
  const raw=fixture();raw.startups=startups;
  const view=api.projectOwnershipSnapshot(raw);assert.equal(view.positions[0].quantity.value,600);
  assert(view.issues.some(row=>row.code==='ALIAS_CONFLICT'));assert.equal(view.positions.length,4);
}
// The adapter retains malformed-ID alias evidence, but composition rejects the
// whole invalid inventory rather than claiming a bound player class.
const badId=fixture();badId.startups=[{id:null,ipoStockID:'OWN'}];
assert(api.projectExternalListedHoldings(badId).positions.some(row=>row.instrumentAlias==='OWN'&&row.quantity.value===10));
const badIdView=api.projectOwnershipSnapshot(badId);
assert.equal(badIdView.positions.length,0);assert.equal(badIdView.classes.length,0);
assert(badIdView.issues.some(row=>row.code==='ALIAS_CONFLICT'));
const sold=fixture();sold.isCompanySold=true;assert.equal(api.projectOwnershipSnapshot(sold).positions[0].quantity.value,600);
for(const value of [-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'600',null]){
  const raw=fixture();raw.founderShares=value;
  const view=api.projectOwnershipSnapshot(raw);assert.equal(view.positions[0].quantity.value,null);assert.equal(view.classes.length,0);
}
let getters=0;
const accessor=fixture();Object.defineProperty(accessor,'founderShares',{enumerable:true,get(){getters++;throw Error('must not execute');}});
assert(api.projectOwnershipSnapshot(accessor).issues.some(row=>row.code==='INPUT_INVALID'));assert.equal(getters,0);
for(const raw of [null,[],new Date(),{...fixture(),companyName:{}},{...fixture(),publicCompany:1},
  {...fixture(),startups:{}},{...fixture(),market:null},{...fixture(),startups:[{ipoStockID:'OWN'}]},
  {...fixture(),ticker:' ',personalStocks:{' ':{qty:10}}},{...fixture(),ticker:'\t',personalStocks:{'\t':{qty:10}}}]){
  const view=api.projectOwnershipSnapshot(raw);assert.equal(view.positions.length,0);assert(view.issues.some(row=>row.code==='INPUT_INVALID'));
}
// Financial fields are outside this ownership token; never label it financial/wealth complete.
const cash=fixture(),cashIndex=api.buildOwnershipIdentityIndex(cash);cash.companyCash=123;
assert.equal(api.projectOwnershipSnapshot(cash,cashIndex).wealthComplete,false);
// No production consumer, transaction or save format is changed by this opt-in reader.
assert.equal(state.saveVersion,9);
// PE fund source scope binds the existing P3-7 evidence to the common token.
// It does not create fund units, portfolio equity, NAV or founder wealth.
{
 const scope='player-listed-and-pe-fund-source-v1',pe=require('../js/phase3-pe-fund-interests');
 const raw=fixture();raw.peFirm={funds:[{id:'F',size:100,gpCommit:10,lpContributed:90,status:'investing',cash:50,
  terms:{fee:.02,carry:.2,hurdle:.08},gpDistributed:1,lpDistributed:2,gpCarryPaid:3,managementFeesPaid:4,
  deals:[{id:'D',status:'active',settlement:null,fundPortion:60,coinvestPortion:40,investedAmount:100}],displayName:'ignored'}]};
 assert.equal(typeof api.projectPEFundSourceSnapshot,'function');
 const before=JSON.stringify(raw),n=draws,handle=api.buildOwnershipIdentityIndex(raw,scope),r=api.projectPEFundSourceSnapshot(raw,handle);
 const direct=pe.projectPEFundInterests(raw),common=api.projectOwnershipSnapshot(raw,handle);
 assert.equal(handle.issues.length,0);assert.equal(r.sourceSnapshotToken,handle.sourceSnapshotToken);assert.equal(r.sourceScope,scope);
 assert.equal(common.sourceSnapshotToken,handle.sourceSnapshotToken);assert.equal(common.sourceScope,scope);
 assert.equal(common.peFundSourceEvidence.sourceSnapshotToken,handle.sourceSnapshotToken,'explicit scope composes the same source revision');
 for(const key of ['fundInterests','portfolioParticipations','managementRelationships','distributionEvidence','waterfallTerms','sourceCoverage'])
  assert.deepEqual(plain(r[key]),plain(direct[key]));
 assert.equal(r.fundInterests[0].contributionRatio,.1);assert.equal(r.portfolioParticipations[0].fundProceedsFraction,.6);
 assert.equal(r.fundInterests[0].legalTargetShares,null);assert.equal(r.fundInterests[0].votingFraction,null);assert.equal(r.fundInterests[0].wealthValue,null);
 assert.equal(r.complete,false);assert.equal(r.commandEligible,false);assert.equal(r.wealthComplete,false);
 assert.equal(JSON.stringify(raw),before);assert.equal(draws,n);frozen(r);assert(!Object.isFrozen(raw));
 assert.deepEqual(plain(api.projectPEFundSourceSnapshot(plain(raw))),plain(r),'v9 JSON replay retains bound source evidence');
 for(const change of [x=>x.peFirm.funds[0].gpCommit++,x=>x.peFirm.funds[0].terms.carry=.25,
  x=>x.peFirm.funds[0].deals[0].investedAmount++,x=>x.peFirm.funds[0].deals[0].settlement={week:2},x=>x.peFirm.funds[0].cash++]){
  const x=plain(raw),h=api.buildOwnershipIdentityIndex(x,scope);change(x);
  const stale=api.projectPEFundSourceSnapshot(x,h);assert(stale.issues.some(i=>i.code==='STALE_EVIDENCE'));
  assert.equal(stale.fundInterests.length,0);assert.equal(stale.portfolioParticipations.length,0);
  assert(api.projectOwnershipSnapshot(x,h).issues.some(i=>i.code==='STALE_EVIDENCE'));
 }
 for(const h of [{},api.buildOwnershipIdentityIndex(raw),api.buildOwnershipIdentityIndex(plain(raw),scope)])
  assert(api.projectPEFundSourceSnapshot(raw,h).issues.some(i=>i.code==='STALE_EVIDENCE'));
 const ignored=plain(raw),ignoredHandle=api.buildOwnershipIdentityIndex(ignored,scope);ignored.peFirm.funds[0].displayName='changed';
 assert.equal(api.projectPEFundSourceSnapshot(ignored,ignoredHandle).sourceSnapshotToken,ignoredHandle.sourceSnapshotToken,'presentation data is outside PE fund source scope');
 let reads=0;const bad=plain(raw);Object.defineProperty(bad.peFirm.funds[0],'gpCommit',{enumerable:true,get(){reads++;throw Error('getter');}});
 assert.equal(api.projectPEFundSourceSnapshot(bad).fundInterests.length,0);assert.equal(reads,0);
 const hidden=plain(raw);Object.defineProperty(hidden.peFirm.funds[0].terms,'carry',{value:.2,enumerable:false});
 assert(api.projectPEFundSourceSnapshot(hidden).issues.some(i=>i.code==='INPUT_INVALID'));
}
// Parent-company conversion source links share the PE-fund token only when the
// fund deal and subsidiary metadata are reciprocal and unambiguous.
{
 const scope='player-listed-and-pe-fund-source-v1',pe=require('../js/phase3-pe-fund-interests'),raw=fixture();
 raw.peFirm={funds:[{id:'F',size:100,gpCommit:10,lpContributed:90,status:'harvesting',cash:50,
  terms:{fee:.02,carry:.2,hurdle:.08},deals:[{id:'D',status:'exited',settlement:{week:8},fundPortion:60,coinvestPortion:40,
   investedAmount:100,convertedToSubsidiaryID:'SUB',exitMethod:'parent-company-acquisition'}]}]};
 raw.subsidiaries=[{id:'SUB',status:'active',source:'pe-fund-portfolio',sourceType:'peFundPortfolioAcquisition',sourcePEFundID:'F',sourcePEDealID:'D',ownership:.6}];
 const before=JSON.stringify(raw),n=draws,index=api.buildOwnershipIdentityIndex(raw,scope),r=api.projectPEFundSourceSnapshot(raw,index);
 const direct=pe.projectFundParentConversions(raw),snapshot=api.projectOwnershipSnapshot(raw,index),narrow=api.projectOwnershipSnapshot(raw);
 assert.equal(r.sourceSnapshotToken,index.sourceSnapshotToken);assert.deepEqual(plain(r.parentConversions),plain(direct.conversions));
 assert.equal(r.parentConversions.length,1);assert.equal(r.parentConversions[0].status,'source-observed');
 for(const key of ['legalEquityFraction','votingFraction','wealthValue'])assert.equal(r.parentConversions[0][key],null);
 assert.deepEqual(plain(snapshot.peFundSourceEvidence.parentConversions),plain(r.parentConversions));
 for(const key of ['positions','classes','sourceReplacements'])assert.deepEqual(plain(snapshot[key]),plain(narrow[key]));
 assert.equal(JSON.stringify(raw),before);assert.equal(draws,n);frozen(snapshot);assert(!Object.isFrozen(raw));
 for(const change of [x=>x.peFirm.funds[0].deals[0].convertedToSubsidiaryID='OTHER',x=>x.peFirm.funds[0].deals[0].exitMethod='sale',
  x=>x.subsidiaries[0].sourcePEDealID='OTHER',x=>x.subsidiaries[0].sourceType='other',x=>x.subsidiaries[0].startupID='VC']){
  const x=plain(raw),h=api.buildOwnershipIdentityIndex(x,scope);change(x);
  const stale=api.projectPEFundSourceSnapshot(x,h);assert(stale.issues.some(i=>i.code==='STALE_EVIDENCE'));assert.equal(stale.parentConversions.length,0);
 }
 const presentation=plain(raw),presentationHandle=api.buildOwnershipIdentityIndex(presentation,scope);presentation.subsidiaries[0].ownership=.1;
 assert.equal(api.projectPEFundSourceSnapshot(presentation,presentationHandle).sourceSnapshotToken,presentationHandle.sourceSnapshotToken,'ownership is outside source-link scope');
 const competing=plain(raw);competing.subsidiaries[0].startupID='VC';
 const unresolved=api.projectOwnershipSnapshot(competing,api.buildOwnershipIdentityIndex(competing,scope));
 assert.equal(unresolved.peFundSourceEvidence.parentConversions[0].status,'unresolved');
 assert(unresolved.issues.some(i=>i.code==='CONVERSION_UNPROVEN'));
 assert.deepEqual(plain(unresolved.positions),plain(api.projectOwnershipSnapshot(competing).positions),'unproven lifecycle link cannot mint positions');
}
// Compose PE fund source evidence into the explicit-scope snapshot without
// minting canonical positions, classes, replacements, NAV or wealth.
{
 const scope='player-listed-and-pe-fund-source-v1',raw=fixture();
 raw.peFirm={funds:[{id:'F',size:100,gpCommit:10,lpContributed:90,status:'investing',cash:50,
  terms:{fee:.02,carry:.2,hurdle:.08},deals:[{id:'D',status:'active',settlement:null,fundPortion:60,coinvestPortion:40,investedAmount:100}]}]};
 const before=JSON.stringify(raw),n=draws,index=api.buildOwnershipIdentityIndex(raw,scope);
 const r=api.projectOwnershipSnapshot(raw,index),pe=api.projectPEFundSourceSnapshot(raw,index),narrow=api.projectOwnershipSnapshot(raw);
 assert(r.peFundSourceEvidence);assert.equal(r.peFundSourceEvidence.sourceSnapshotToken,r.sourceSnapshotToken);
 assert.deepEqual(plain(r.peFundSourceEvidence),plain(pe));
 for(const key of ['positions','classes','sourceReplacements'])assert.deepEqual(plain(r[key]),plain(narrow[key]));
 assert.equal(r.coverage.find(x=>x.family==='pe').status,'not-implemented','source evidence is not canonical PE completion');
 assert.equal(r.coverage.find(x=>x.family==='pe-fund-source').status,'observed');
 assert.equal(r.peFundSourceEvidence.fundInterests[0].legalTargetShares,null);
 assert.equal(r.peFundSourceEvidence.fundInterests[0].votingFraction,null);
 assert.equal(r.peFundSourceEvidence.fundInterests[0].wealthValue,null);
 assert.equal(r.peFundSourceEvidence.valuationStatus,'unknown');
 assert.equal(Object.hasOwn(narrow,'peFundSourceEvidence'),false,'default snapshot contract stays unchanged');
 assert.equal(JSON.stringify(raw),before);assert.equal(draws,n);frozen(r);assert(!Object.isFrozen(raw));
 const reloaded=plain(raw);assert.deepEqual(plain(api.projectOwnershipSnapshot(reloaded,api.buildOwnershipIdentityIndex(reloaded,scope))),plain(r));
 const conflict=plain(raw);conflict.peFirm.funds.push(plain(conflict.peFirm.funds[0]));
 const conflicted=api.projectOwnershipSnapshot(conflict,api.buildOwnershipIdentityIndex(conflict,scope));
 assert(conflicted.peFundSourceEvidence.issues.some(x=>x.code==='IDENTITY_COLLISION'));
 assert.equal(conflicted.coverage.find(x=>x.family==='pe-fund-source').status,'partial');
 assert.deepEqual(plain(conflicted.positions),plain(api.projectOwnershipSnapshot(conflict).positions),'source conflict cannot mint positions');
 const old=api.buildOwnershipIdentityIndex(raw,scope);raw.peFirm.funds[0].gpCommit++;
 const stale=api.projectOwnershipSnapshot(raw,old);assert.equal(stale.positions.length,0);assert.equal(stale.peFundSourceEvidence,undefined);
}
// VC source scope reuses the common index/token and binds lifecycle/pending capital.
{
 const scope='player-listed-and-vc-source-v1',vc=loaded.modules.phase3VCSourceInterests;
 const raw=fixture();raw.startups=[{id:'S',alive:true,subsidiary:false,ownedCompany:.6,ownedPersonal:.1,
  activeFundingRound:{id:'R',status:'open',round:'A',openedWeek:5,closesWeek:10,preMoneyValuation:100,targetRaise:20,postMoneyValuation:120,
   preRoundOwnedCompany:.6,preRoundOwnedPersonal:.1,contributedCompany:5,contributedPersonal:2}}];raw.subsidiaries=[];
 assert.equal(typeof api.projectVCSourceSnapshot,'function');
 const before=JSON.stringify(raw),n=draws,handle=api.buildOwnershipIdentityIndex(raw,scope),r=api.projectVCSourceSnapshot(raw,handle);
 assert.equal(handle.issues.length,0);assert.equal(r.sourceSnapshotToken,handle.sourceSnapshotToken);assert.equal(r.sourceScope,scope);
 assert.equal(api.projectOwnershipSnapshot(raw,handle).sourceSnapshotToken,handle.sourceSnapshotToken);
 assert.equal(api.projectExternalListedHoldings(raw,handle).sourceSnapshotToken,handle.sourceSnapshotToken);
 assert.deepEqual(plain(r.roundObservations),plain(vc.projectVCSourceInterests(raw).roundObservations));
 assert.equal(r.roundObservations.find(x=>x.account==='personal').reportedContributionJPY,2);
 assert.equal(r.complete,false);assert.equal(r.commandEligible,false);assert.equal(r.wealthComplete,false);
 assert.equal(r.roundObservations[0].quantity,null);assert.equal(r.roundObservations[0].wealthValue,null);
 assert.equal(JSON.stringify(raw),before);assert.equal(draws,n);frozen(r);assert(!Object.isFrozen(raw));
 assert.deepEqual(plain(api.projectVCSourceSnapshot(plain(raw))),plain(r));
 for(const change of [x=>x.startups[0].alive=false,x=>x.startups[0].activeFundingRound.contributedPersonal++,x=>x.startups[0].ddNegotiatedOwnedCompany=.1,x=>x.subsidiaries.push({id:'sub',startupID:'S',ownership:.6,status:'active'}),x=>x.currentCompanySerial++]){
  const x=plain(raw),h=api.buildOwnershipIdentityIndex(x,scope);change(x);
  const stale=api.projectVCSourceSnapshot(x,h);assert(stale.issues.some(i=>i.code==='STALE_EVIDENCE'));assert.equal(stale.observations.length,0);assert.equal(stale.roundObservations.length,0);
  assert(api.projectOwnershipSnapshot(x,h).issues.some(i=>i.code==='STALE_EVIDENCE'));
 }
 for(const h of [{},api.buildOwnershipIdentityIndex(raw),api.buildOwnershipIdentityIndex(plain(raw),scope)])assert(api.projectVCSourceSnapshot(raw,h).issues.some(i=>i.code==='STALE_EVIDENCE'));
 const ignored=plain(raw),h=api.buildOwnershipIdentityIndex(ignored,scope);ignored.startups[0].weeklyRevenue=999;
 assert.equal(api.projectVCSourceSnapshot(ignored,h).sourceSnapshotToken,h.sourceSnapshotToken,'operating data is outside VC source scope');
 let reads=0;const bad=plain(raw);Object.defineProperty(bad.startups[0],'alive',{enumerable:true,get(){reads++;throw Error('getter');}});
 assert.equal(api.projectVCSourceSnapshot(bad).observations.length,0);assert.equal(reads,0);
 const hidden=plain(raw);Object.defineProperty(hidden.startups[0].activeFundingRound,'contributedPersonal',{value:2,enumerable:false});
 assert(api.projectVCSourceSnapshot(hidden).issues.some(i=>i.code==='INPUT_INVALID'));
}
// Compose bound VC source/alias explanations without appending duplicate economic positions.
{
 const scope='player-listed-and-vc-source-v1',raw=fixture();
 raw.startups=[{id:'VC',alive:true,subsidiary:true,ownedCompany:.6,ownedPersonal:.1}];
 raw.subsidiaries=[{id:'vc-sub',startupID:'VC',status:'active',ownership:.6}];
 const before=JSON.stringify(raw),n=draws,index=api.buildOwnershipIdentityIndex(raw,scope);
 const r=api.projectOwnershipSnapshot(raw,index),vc=api.projectVCSourceSnapshot(raw,index),narrow=api.projectOwnershipSnapshot(raw);
 assert(r.vcSourceEvidence);assert.equal(r.vcSourceEvidence.sourceSnapshotToken,r.sourceSnapshotToken);
 assert.deepEqual(plain(r.vcSourceEvidence),plain(vc));assert.deepEqual(plain(r.positions),plain(narrow.positions));
 assert.equal(r.vcAliasLinks.length,1);const link=r.vcAliasLinks[0];
 assert.equal(link.startupSourceId,'VC');assert.equal(link.aliasSourcePath,'subsidiaries[0]');assert.equal(link.sourcePath,'startups[0].ownedCompany');
 assert.equal(link.linkRole,'source-alias-reference');assert.equal(link.account,'company');
 for(const key of ['canonicalPositionId','issuerEntityId','quantity','votingFraction','wealthValue'])assert.equal(link[key],null);
 assert.equal(r.vcSourceEvidence.observations.find(x=>x.account==='personal').assetRole,'economic-interest');
 assert.equal(r.coverage.find(x=>x.family==='vc').status,'not-implemented','source linkage is not canonical VC completion');
 assert.equal(narrow.vcSourceEvidence,undefined);assert.equal(narrow.vcAliasLinks,undefined,'narrow contract stays unchanged');
 assert.equal(JSON.stringify(raw),before);assert.equal(draws,n);frozen(r);assert(!Object.isFrozen(raw));
 assert.deepEqual(plain(api.projectOwnershipSnapshot(plain(raw),api.buildOwnershipIdentityIndex(plain(raw),scope))).positions,[],'different raw roots reject evidence');
 const reloaded=plain(raw);assert.deepEqual(plain(api.projectOwnershipSnapshot(reloaded,api.buildOwnershipIdentityIndex(reloaded,scope))),plain(r));
 for(const change of [x=>x.subsidiaries[0].ownership=.5,x=>x.subsidiaries[0].peDealID='PE',x=>x.subsidiaries.push(plain(x.subsidiaries[0]))]){
  const bad=plain(raw);change(bad);const result=api.projectOwnershipSnapshot(bad,api.buildOwnershipIdentityIndex(bad,scope));
  assert.equal(result.vcAliasLinks.length,0);assert(result.issues.some(x=>x.code==='ALIAS_CONFLICT'));
  assert.deepEqual(plain(result.positions),plain(api.projectOwnershipSnapshot(bad).positions),'conflicts do not mint positions');
 }
 const old=api.buildOwnershipIdentityIndex(raw,scope);raw.subsidiaries[0].status='sold';
 const stale=api.projectOwnershipSnapshot(raw,old);assert.equal(stale.positions.length,0);assert.equal(stale.vcSourceEvidence,undefined);
}
console.log('PASS phase3 ownership snapshot: composition, dedup, generation quarantine, scoped tokens, purity and v9 reload');

// P3-4 partial replacement-boundary evidence: production v9 compaction/import/load and an actual rejected transaction.
// This proves read-model index invalidation/preservation only, not authoritative writer closure or activation.
(async()=>{
 const {boot}=require('./fixtures/subsidiary-quarter-close');
 const s=boot();await s.backend.hydrate();
 const st=s.engineModule.createInitialState({configured:true});
 Object.assign(st,{week:7,companyName:'Source',ticker:'OWN',currentCompanySerial:1,isCompanySold:false,publicCompany:true,
  sharesOut:1000,treasuryBuybackShares:100,founderShares:600,stockPrice:99,startups:[],
  personalStocks:{OWN:{qty:10,avg:2},EXT:{qty:20,avg:4}},companyStocks:{EXT:{qty:30,avg:5}}});
 st.market=st.market.filter(row=>!['OWN','EXT'].includes(row.id));
 for(const [id,price,issuedShares] of [['OWN',99,1000],['EXT',4,2000]])st.market.push({id,name:id,price,previous:price,
  issuedShares,marketCap:price*issuedShares,trend:0,volatility:0,priceHistory:[{week:7,price}]});
 st.finance=s.modules.finance.defaultFinanceState(st);
 const game=new s.engineModule.TycoonEngine(st),read=s.modules.economicReadModel;
 function checked(ctx,engine,index){
  const before=JSON.stringify(engine.g),draws=ctx.host.draws;
  const view=ctx.modules.economicReadModel.projectOwnershipSnapshot(engine.g,index);
  assert.equal(JSON.stringify(engine.g),before,'reader preserves the full current state');assert.equal(ctx.host.draws,draws,'reader draws no RNG');
  assert.equal(view.commandEligible,false);assert.equal(view.wealthComplete,false);return view;
 }
 function quantities(view){
  assert(!view.issues.some(x=>x.code==='STALE_EVIDENCE'));
  assert.equal(view.classes[0].issuedQuantity,1000);assert.equal(view.classes[0].treasuryQuantity,100);
  assert.equal(view.classes[0].outstandingQuantity,900);
  assert.equal(view.positions.find(x=>x.assetRole==='founder-equity').quantity.value,610,'founder legacy600 + personal own10 exactly once');
  assert.equal(view.positions.find(x=>x.instrumentAlias==='EXT'&&x.accountKind==='personal').quantity.value,20);
  assert.equal(view.positions.find(x=>x.instrumentAlias==='EXT'&&x.accountKind==='company').quantity.value,30);
 }
 assert.equal(game.save(),true);await s.backend.flush();quantities(checked(s,game));
 for(const profile of ['normal','emergency','critical']){
  const beforeRoot=game.g,index=read.buildOwnershipIdentityIndex(game.g),cash=[game.g.companyCash,game.g.personalCash];
  const compact=s.modules.saveStorage.compactStateForStorage(game.g,profile).state;
  game.importSave(JSON.stringify(compact));
  assert.notEqual(game.g,beforeRoot,'production import replaces the root');
  assert(checked(s,game,index).issues.some(x=>x.code==='STALE_EVIDENCE'),'pre-import index cannot bind the replacement root');
  quantities(checked(s,game));assert.equal(game.g.saveVersion,9);
  assert.deepEqual([game.g.companyCash,game.g.personalCash],cash,'company/personal cash stay separate across import');
  await s.backend.flush();const bytes=s.backend.readSync(s.key);assert.equal(s.durable.get(s.key),bytes,'imported state is durable');
  const loaded=s.engineModule.TycoonEngine.load();assert(loaded,'production load succeeds');quantities(checked(s,loaded));
  const {loadGame}=require('./harness'),{indexedDBFor}=require('./fixtures/pe-fund-acquisition-faults');
  const fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,{attempts:[]})});
  await fresh.modules.saveStorageIDB.hydrate();const hydrated=fresh.engineModule.TycoonEngine.load();assert(hydrated);
  const before=JSON.stringify(hydrated.g),view=fresh.modules.economicReadModel.projectOwnershipSnapshot(hydrated.g);
  quantities(view);assert.equal(JSON.stringify(hydrated.g),before,'fresh hydration reader is pure');
  assert.deepEqual([hydrated.g.companyCash,hydrated.g.personalCash],cash,'fresh hydration preserves both cash accounts');
  console.log('ownership replacement '+profile+': nonzero quantities / import / reload / fresh fake-IDB PASS');
 }
 const before=JSON.stringify(game.g),bytes=s.backend.readSync(s.key),index=read.buildOwnershipIdentityIndex(game.g);
 let speculative;
 assert.equal(game.runTransaction(()=>{
  game.g.personalStocks=plain(game.g.personalStocks);game.g.personalStocks.OWN.qty++;
  speculative=read.buildOwnershipIdentityIndex(game.g);
  assert(checked(s,game,index).issues.some(x=>x.code==='STALE_EVIDENCE'),'changed backing map invalidates the old index inside the boundary');
  return false;
 }),false);
 assert.equal(JSON.stringify(game.g),before,'rejected real transaction restores every state field and persisted RNG');
 quantities(checked(s,game,index));
 assert(checked(s,game,speculative).issues.some(x=>x.code==='STALE_EVIDENCE'),'speculative index cannot survive rollback');
 assert.equal(s.backend.readSync(s.key),bytes);await s.backend.flush();assert.equal(s.durable.get(s.key),bytes,'rejected replacement cannot become durable');
 // W-SPLIT: exercise the actual installed writer at the same week, not a synthetic quantity edit.
 const root=game.g,splitBefore=plain(game.g),splitIndex=read.buildOwnershipIdentityIndex(game.g);
 function scaled(engine,api,factor){
  const before=JSON.stringify(engine.g),view=api.projectOwnershipSnapshot(engine.g);
  assert.equal(JSON.stringify(engine.g),before,'split observation preserves full state and persisted RNG');
  assert(!view.issues.some(row=>row.code==='STALE_EVIDENCE'));
  assert.equal(view.classes[0].issuedQuantity,1000*factor);assert.equal(view.classes[0].treasuryQuantity,100*factor);
  assert.equal(view.classes[0].outstandingQuantity,900*factor);
  assert.equal(view.positions.find(row=>row.assetRole==='founder-equity').quantity.value,610*factor,'founder + own personal lot scale once');
  for(const account of ['company','personal'])assert.equal(view.positions.find(row=>row.instrumentAlias==='EXT'&&row.accountKind===account).quantity.value,account==='company'?30:20);
  assert.equal(view.commandEligible,false);assert.equal(view.wealthComplete,false);
  assert.equal(engine.g.week,splitBefore.week,'split does not advance time');
  for(const key of ['companyCash','personalCash','companyDebt','personalDebt','simulationRng'])assert.deepEqual(plain(engine.g[key]),splitBefore[key],key+' unchanged by split');
  assert.equal(s.modules.finance.validate(plain(engine.g)).ok,true);
 }
 for(const mode of ['save-false','save-throw']){
  const save=game.save,attempts=s.control.attempts.length,draws=s.host.draws;let speculative,hits=0;
  game.save=function(...args){
   if(this.inTransaction())return save.apply(this,args);
   hits++;speculative=read.buildOwnershipIdentityIndex(this.g);
   if(mode==='save-false')return false;
   const result=save.apply(this,args);assert.equal(result,true,'throw follows actual save admission');throw Error('split save admitted then threw');
  };
  try{if(mode==='save-throw')assert.throws(()=>game.stockSplit('OWN',2),/split save admitted then threw/);else assert.equal(game.stockSplit('OWN',2),false);}finally{game.save=save;}
  assert.equal(hits,1,'fault reaches the actual outer commit');assert.equal(game.g,root,'rollback retains root');
  assert.deepEqual(plain(game.g),splitBefore,'failed split restores all fields');assert.equal(s.host.draws,draws);
  quantities(checked(s,game,splitIndex));
  assert(checked(s,game,speculative).issues.some(row=>row.code==='STALE_EVIDENCE'),'speculative split index rejected after rollback');
  await s.backend.flush();assert.equal(s.backend.readSync(s.key),bytes);assert.equal(s.ctx.localStorage.getItem(s.key),bytes);
  assert.equal(s.durable.get(s.key),bytes);assert.equal(s.control.attempts.length,attempts,'failed split put never starts');
 }
 let predecessor=splitIndex;
 for(const factor of [2,4]){
  const draws=s.host.draws;assert.equal(game.stockSplit('OWN',2),true,'healthy split/retry');assert.equal(game.g,root);
  assert.equal(s.host.draws,draws);assert(checked(s,game,predecessor).issues.some(row=>row.code==='STALE_EVIDENCE'),'same-root/same-week writer invalidates predecessor');
  scaled(game,read,factor);predecessor=read.buildOwnershipIdentityIndex(game.g);
 }
 await s.backend.flush();scaled(s.engineModule.TycoonEngine.load(),read,4);
 const {indexedDBFor}=require('./fixtures/pe-fund-acquisition-faults');
 const freshControl={attempts:[]},fresh=loadGame({headless:true,indexedDB:indexedDBFor(s.durable,freshControl)});await fresh.modules.saveStorageIDB.hydrate();
 const hydrated=fresh.engineModule.TycoonEngine.load(),freshBefore=JSON.stringify(hydrated.g),freshAttempts=freshControl.attempts.length;
 scaled(hydrated,fresh.modules.economicReadModel,4);assert.equal(JSON.stringify(hydrated.g),freshBefore);
 assert.equal(freshControl.attempts.length,freshAttempts,'fresh ownership observation admits no write');
 console.log('P3-4 actual same-week split: old/speculative index invalidation / rollback / retry / repeat / fresh fake-IDB PASS');
 console.log('P3-4 ownership replacement-boundary read-model evidence PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
