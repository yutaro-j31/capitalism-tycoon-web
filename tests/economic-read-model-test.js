'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');

const source=fs.readFileSync(path.join(__dirname,'..','js','economic-read-model.js'),'utf8');
for(const [label,pattern] of [
  ['host RNG',/Math\.random\s*\(/],
  ['wall clock',/Date\.now\s*\(/],
  ['simulation RNG',/simulationRng/],
  ['save call',/\.save\s*\(/],
  ['emit call',/\.emit\s*\(/],
  ['finance event',/finance\.event\s*\(/],
  ['finance statement rebuild',/buildStatements\s*\(/],
  ['finance validation',/finance\.validate\s*\(/],
  ['finance state normalization',/ensureFinance\s*\(/],
  ['company cash writer',/companyCash\s*=/],
  ['personal cash writer',/personalCash\s*=/],
  ['company debt writer',/companyDebt\s*=/],
  ['personal debt writer',/personalDebt\s*=/]
]){
  assert.equal(pattern.test(source),false,`economic read model must not depend on ${label}`);
}

const loaded=loadGame({headless:true});
const adapter=loaded.modules.economicReadModel;
assert.ok(adapter,'economicReadModel must load through production index.html');
assert.equal(adapter.READ_MODEL_VERSION,1);
assert.equal(adapter.PLAYER_COMPANY_ENTITY_ID,'entity:company:player');
assert.equal(adapter.FOUNDER_ENTITY_ID,'entity:person:founder');
assert.equal(adapter.CURRENCY,'JPY');

const state=loaded.engineModule.createInitialState({configured:true});
Object.assign(state,{
  week:27,
  companyName:'Entity Adapter Holdings',
  playerName:'Adapter Founder',
  companyCash:12_345_678.91,
  personalCash:2_345_678.12,
  companyDebt:100_000,
  personalDebt:4_000,
  sharesOut:1_000,
  founderShares:600,
  treasuryBuybackShares:100,
  externalShareholderRatio:0.4,
  publicCompany:true,
  companyStocks:{
    ZZZ:{qty:2,avg:30},
    AAA:{qty:1,avg:10}
  },
  personalStocks:{
    ZZZ:{qty:3,avg:35},
    AAA:{qty:4,avg:12}
  }
});
state.finance.loans=[
  {
    loanID:'loan-z-bank',
    principal:60_000,
    outstandingPrincipal:60_000,
    interestRate:0.05,
    status:'active',
    sourceType:'bankLoansCovenants',
    sourceID:'bank-z'
  },
  {
    loanID:'loan-a-founder',
    principal:40_000,
    outstandingPrincipal:40_000,
    interestRate:0.03,
    status:'active',
    sourceType:loaded.modules.finance.FOUNDER_LOAN_SOURCE,
    sourceID:'founder-a'
  },
  {
    loanID:'loan-repaid',
    principal:5_000,
    outstandingPrincipal:0,
    interestRate:0.02,
    status:'repaid',
    sourceType:'bankLoansCovenants',
    sourceID:'old'
  }
];

const before=JSON.stringify(state);
const model=adapter.snapshot(state);
assert.equal(JSON.stringify(state),before,'snapshot must not mutate authoritative state');
assert.equal(model.readModelVersion,1);
assert.equal(model.source,'legacy-authoritative-state');
assert.equal(model.period.week,27);
assert.equal(Object.isFrozen(model),true);
assert.equal(model.entities.length,2);

const company=Array.from(model.entities).find(row=>row.entity.entityId===adapter.PLAYER_COMPANY_ENTITY_ID);
const founder=Array.from(model.entities).find(row=>row.entity.entityId===adapter.FOUNDER_ENTITY_ID);
assert.ok(company);
assert.ok(founder);
assert.equal(loaded.modules.economicOperation.validateEntity(company.entity).ok,true);
assert.equal(loaded.modules.economicOperation.validateEntity(founder.entity).ok,true);
assert.equal(company.entity.listingStatus,'listed');
assert.equal(Array.from(company.entity.roles).includes('listedIssuer'),true);

const companyCash=Array.from(company.accountBalances).find(row=>row.accountId==='asset:cash');
const companyDebt=Array.from(company.accountBalances).find(row=>row.accountId==='liability:debt-principal');
const personalCash=Array.from(founder.accountBalances).find(row=>row.accountId==='asset:cash');
const personalDebt=Array.from(founder.accountBalances).find(row=>row.accountId==='liability:debt-principal');
assert.equal(companyCash.amount,state.companyCash);
assert.equal(companyCash.sourcePath,'companyCash');
assert.equal(companyDebt.amount,state.companyDebt);
assert.equal(personalCash.amount,state.personalCash);
assert.equal(personalDebt.amount,state.personalDebt);
assert.equal(companyCash.numericDomain,'legacy-number','legacy read models must not silently cent-quantize existing saves');
assert(Array.from(company.accountBalances).every(row=>row.entityId===adapter.PLAYER_COMPANY_ENTITY_ID));
assert(Array.from(founder.accountBalances).every(row=>row.entityId===adapter.FOUNDER_ENTITY_ID));

assert.deepEqual(Array.from(company.debtInstruments).map(row=>row.debtInstrumentId),['loan-a-founder','loan-z-bank']);
assert.deepEqual(Array.from(founder.debtReceivables).map(row=>row.debtInstrumentId),['loan-a-founder']);
assert.equal(founder.debtReceivables[0].outstandingPrincipal,40_000);
assert(Array.from(company.debtInstruments).every(row=>row.entityId===adapter.PLAYER_COMPANY_ENTITY_ID));
assert(Array.from(founder.debtReceivables).every(row=>row.entityId===adapter.FOUNDER_ENTITY_ID&&row.counterpartyEntityId===adapter.PLAYER_COMPANY_ENTITY_ID));

assert.deepEqual(Array.from(company.marketHoldings).map(row=>row.instrumentId),['AAA','ZZZ']);
assert.deepEqual(Array.from(founder.marketHoldings).map(row=>row.instrumentId),['AAA','ZZZ']);
assert.deepEqual(Array.from(company.marketHoldings).map(row=>row.quantity),[1,2]);
assert.deepEqual(Array.from(founder.marketHoldings).map(row=>row.quantity),[4,3]);
assert(Array.from(company.marketHoldings).every(row=>row.entityId===adapter.PLAYER_COMPANY_ENTITY_ID));
assert(Array.from(founder.marketHoldings).every(row=>row.entityId===adapter.FOUNDER_ENTITY_ID));

assert.equal(model.ownership.securityClassId,adapter.PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID);
assert.equal(model.ownership.legacySharesOut,1_000);
assert.equal(model.ownership.founderShares,600);
assert.equal(model.ownership.treasuryShares,100);
assert.equal(model.ownership.externalShareholderRatio,0.4);
assert.equal(model.ownership.publicCompany,true);

const parity=adapter.compareLegacyParity(state,model);
assert.equal(parity.ok,true,JSON.stringify(parity));
for(const id of [
  'entity-read-root-metadata',
  'entity-read-company-entity',
  'entity-read-founder-entity',
  'entity-read-company-account-bindings',
  'entity-read-founder-account-bindings',
  'entity-read-company-account-rows',
  'entity-read-founder-account-rows',
  'entity-read-company-cash',
  'entity-read-personal-cash',
  'entity-read-company-debt',
  'entity-read-personal-debt',
  'entity-read-company-debt-instrument-bindings',
  'entity-read-company-debt-instruments',
  'entity-read-company-loan-principal',
  'entity-read-founder-debt-receivable-bindings',
  'entity-read-founder-debt-receivable-instruments',
  'entity-read-founder-loan-receivable',
  'entity-read-ownership-bindings',
  'entity-read-ownership-source-paths',
  'entity-read-public-company-status',
  'entity-read-shares-out',
  'entity-read-founder-shares',
  'entity-read-treasury-shares',
  'entity-read-external-shareholder-ratio',
  'entity-read-company-market-holdings',
  'entity-read-personal-market-holdings'
])assert.equal(Array.from(parity.checks).some(row=>row.id===id&&row.ok),true,`missing passing parity check ${id}`);
assert.equal(JSON.stringify(state),before,'parity diagnostics must not mutate authoritative state');

const wrongRootMetadata=adapter.compareLegacyParity(state,{...model,period:{week:model.period.week+1}});
assert.equal(wrongRootMetadata.ok,false);
assert.equal(Array.from(wrongRootMetadata.checks).find(row=>row.id==='entity-read-root-metadata').ok,false);

const wrongCompanyKind={
  ...company,
  entity:{...company.entity,legalEntityKind:'person'}
};
const wrongCompanyKindParity=adapter.compareLegacyParity(state,{...model,entities:[wrongCompanyKind,founder]});
assert.equal(wrongCompanyKindParity.ok,false);
assert.equal(Array.from(wrongCompanyKindParity.checks).find(row=>row.id==='entity-read-company-entity').ok,false);

const wrongFounderKind={
  ...founder,
  entity:{...founder.entity,legalEntityKind:'company'}
};
const wrongFounderKindParity=adapter.compareLegacyParity(state,{...model,entities:[company,wrongFounderKind]});
assert.equal(wrongFounderKindParity.ok,false);
assert.equal(Array.from(wrongFounderKindParity.checks).find(row=>row.id==='entity-read-founder-entity').ok,false);

const tamperedCompany={
  ...company,
  accountBalances:Array.from(company.accountBalances).map(row=>row.accountId==='asset:cash'?{...row,amount:row.amount+1}:row)
};
const tampered={...model,entities:[tamperedCompany,founder]};
const mismatch=adapter.compareLegacyParity(state,tampered);
assert.equal(mismatch.ok,false);
assert.equal(Array.from(mismatch.checks).find(row=>row.id==='entity-read-company-cash').ok,false);

const wrongCashBindingCompany={
  ...company,
  accountBalances:Array.from(company.accountBalances).map(row=>row.accountId==='asset:cash'?{...row,entityId:adapter.FOUNDER_ENTITY_ID}:row)
};
const wrongCashBinding=adapter.compareLegacyParity(state,{...model,entities:[wrongCashBindingCompany,founder]});
assert.equal(wrongCashBinding.ok,false);
assert.equal(Array.from(wrongCashBinding.checks).find(row=>row.id==='entity-read-company-account-bindings').ok,false);
assert.equal(Array.from(wrongCashBinding.checks).find(row=>row.id==='entity-read-company-cash').ok,false);

const wrongAccountSemanticsCompany={
  ...company,
  accountBalances:Array.from(company.accountBalances).map(row=>row.accountId==='asset:cash'?{...row,currency:'USD',sourcePath:'personalCash',numericDomain:'minor-units'}:row)
};
const wrongAccountSemantics=adapter.compareLegacyParity(state,{...model,entities:[wrongAccountSemanticsCompany,founder]});
assert.equal(wrongAccountSemantics.ok,false);
assert.equal(Array.from(wrongAccountSemantics.checks).find(row=>row.id==='entity-read-company-account-rows').ok,false);
assert.equal(Array.from(wrongAccountSemantics.checks).find(row=>row.id==='entity-read-company-cash').ok,false);

const wrongDebtBindingCompany={
  ...company,
  debtInstruments:Array.from(company.debtInstruments).map((row,index)=>index===0?{...row,entityId:adapter.FOUNDER_ENTITY_ID}:row)
};
const wrongDebtBinding=adapter.compareLegacyParity(state,{...model,entities:[wrongDebtBindingCompany,founder]});
assert.equal(wrongDebtBinding.ok,false);
assert.equal(Array.from(wrongDebtBinding.checks).find(row=>row.id==='entity-read-company-debt-instrument-bindings').ok,false);
assert.equal(Array.from(wrongDebtBinding.checks).find(row=>row.id==='entity-read-company-loan-principal').ok,false);

const wrongReceivableFounder={
  ...founder,
  debtReceivables:Array.from(founder.debtReceivables).map(row=>({...row,counterpartyEntityId:adapter.FOUNDER_ENTITY_ID}))
};
const wrongReceivableBinding=adapter.compareLegacyParity(state,{...model,entities:[company,wrongReceivableFounder]});
assert.equal(wrongReceivableBinding.ok,false);
assert.equal(Array.from(wrongReceivableBinding.checks).find(row=>row.id==='entity-read-founder-debt-receivable-bindings').ok,false);
assert.equal(Array.from(wrongReceivableBinding.checks).find(row=>row.id==='entity-read-founder-loan-receivable').ok,false);

const wrongReceivableInstrumentFounder={
  ...founder,
  debtReceivables:Array.from(founder.debtReceivables).map(row=>({...row,debtInstrumentId:'loan-nonexistent'}))
};
const wrongReceivableInstrument=adapter.compareLegacyParity(state,{...model,entities:[company,wrongReceivableInstrumentFounder]});
assert.equal(wrongReceivableInstrument.ok,false);
assert.equal(Array.from(wrongReceivableInstrument.checks).find(row=>row.id==='entity-read-founder-debt-receivable-instruments').ok,false);
assert.equal(Array.from(wrongReceivableInstrument.checks).find(row=>row.id==='entity-read-founder-loan-receivable').ok,false);

const wrongCompanyInstrumentCompany={
  ...company,
  debtInstruments:Array.from(company.debtInstruments).map((row,index)=>index===0?{...row,debtInstrumentId:'loan-nonexistent'}:row)
};
const wrongCompanyInstrument=adapter.compareLegacyParity(state,{...model,entities:[wrongCompanyInstrumentCompany,founder]});
assert.equal(wrongCompanyInstrument.ok,false);
assert.equal(Array.from(wrongCompanyInstrument.checks).find(row=>row.id==='entity-read-company-debt-instruments').ok,false);
assert.equal(Array.from(wrongCompanyInstrument.checks).find(row=>row.id==='entity-read-company-loan-principal').ok,false);

const wrongDebtProvenanceCompany={
  ...company,
  debtInstruments:Array.from(company.debtInstruments).map((row,index)=>index===0?{...row,sourcePath:'finance.loans[999]'}:row)
};
const wrongDebtProvenance=adapter.compareLegacyParity(state,{...model,entities:[wrongDebtProvenanceCompany,founder]});
assert.equal(wrongDebtProvenance.ok,false);
assert.equal(Array.from(wrongDebtProvenance.checks).find(row=>row.id==='entity-read-company-debt-instruments').ok,false);

const wrongReceivableProvenanceFounder={
  ...founder,
  debtReceivables:Array.from(founder.debtReceivables).map(row=>({...row,sourcePath:'finance.loans[999]'}))
};
const wrongReceivableProvenance=adapter.compareLegacyParity(state,{...model,entities:[company,wrongReceivableProvenanceFounder]});
assert.equal(wrongReceivableProvenance.ok,false);
assert.equal(Array.from(wrongReceivableProvenance.checks).find(row=>row.id==='entity-read-founder-debt-receivable-instruments').ok,false);

const wrongHoldingCompany={
  ...company,
  marketHoldings:Array.from(company.marketHoldings).map((row,index)=>index===0?{...row,entityId:adapter.FOUNDER_ENTITY_ID}:row)
};
const wrongHoldingBinding=adapter.compareLegacyParity(state,{...model,entities:[wrongHoldingCompany,founder]});
assert.equal(wrongHoldingBinding.ok,false);
assert.equal(Array.from(wrongHoldingBinding.checks).find(row=>row.id==='entity-read-company-market-holdings').ok,false);

const wrongHoldingCurrencyCompany={
  ...company,
  marketHoldings:Array.from(company.marketHoldings).map((row,index)=>index===0?{...row,currency:'USD'}:row)
};
const wrongHoldingCurrency=adapter.compareLegacyParity(state,{...model,entities:[wrongHoldingCurrencyCompany,founder]});
assert.equal(wrongHoldingCurrency.ok,false);
assert.equal(Array.from(wrongHoldingCurrency.checks).find(row=>row.id==='entity-read-company-market-holdings').ok,false);

const wrongOwnership=adapter.compareLegacyParity(state,{
  ...model,
  ownership:{...model.ownership,issuerEntityId:adapter.FOUNDER_ENTITY_ID}
});
assert.equal(wrongOwnership.ok,false);
assert.equal(Array.from(wrongOwnership.checks).find(row=>row.id==='entity-read-ownership-bindings').ok,false);
assert.equal(Array.from(wrongOwnership.checks).find(row=>row.id==='entity-read-founder-shares').ok,false);
assert.equal(Array.from(wrongOwnership.checks).find(row=>row.id==='entity-read-treasury-shares').ok,false);

const wrongOwnershipProvenance=adapter.compareLegacyParity(state,{
  ...model,
  ownership:{...model.ownership,sourcePaths:{...model.ownership.sourcePaths,founderShares:'personalStocks'}}
});
assert.equal(wrongOwnershipProvenance.ok,false);
assert.equal(Array.from(wrongOwnershipProvenance.checks).find(row=>row.id==='entity-read-ownership-source-paths').ok,false);

const wrongSharesOut=adapter.compareLegacyParity(state,{
  ...model,
  ownership:{...model.ownership,legacySharesOut:model.ownership.legacySharesOut+1}
});
assert.equal(wrongSharesOut.ok,false);
assert.equal(Array.from(wrongSharesOut.checks).find(row=>row.id==='entity-read-shares-out').ok,false);

const wrongListingStatus=adapter.compareLegacyParity(state,{
  ...model,
  ownership:{...model.ownership,publicCompany:false}
});
assert.equal(wrongListingStatus.ok,false);
assert.equal(Array.from(wrongListingStatus.checks).find(row=>row.id==='entity-read-public-company-status').ok,false);

const duplicateLoanState=JSON.parse(JSON.stringify(state));
duplicateLoanState.finance.loans.push({...duplicateLoanState.finance.loans[0],sourceID:'duplicate-source'});
assert.throws(()=>adapter.snapshot(duplicateLoanState),/duplicate active loanID: loan-z-bank/);

const modelAgain=adapter.snapshot(state);
assert.equal(JSON.stringify(modelAgain),JSON.stringify(model),'same authoritative state must produce identical ordered read model');

assert.throws(()=>adapter.snapshot({...state,companyCash:Number.POSITIVE_INFINITY}),/companyCash must be a finite number/);

console.log('economic read-only legacy adapter tests passed');
