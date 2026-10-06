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

assert.deepEqual(Array.from(company.debtInstruments).map(row=>row.debtInstrumentId),['loan-a-founder','loan-z-bank']);
assert.deepEqual(Array.from(founder.debtReceivables).map(row=>row.debtInstrumentId),['loan-a-founder']);
assert.equal(founder.debtReceivables[0].outstandingPrincipal,40_000);

assert.deepEqual(Array.from(company.marketHoldings).map(row=>row.instrumentId),['AAA','ZZZ']);
assert.deepEqual(Array.from(founder.marketHoldings).map(row=>row.instrumentId),['AAA','ZZZ']);
assert.deepEqual(Array.from(company.marketHoldings).map(row=>row.quantity),[1,2]);
assert.deepEqual(Array.from(founder.marketHoldings).map(row=>row.quantity),[4,3]);

assert.equal(model.ownership.securityClassId,adapter.PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID);
assert.equal(model.ownership.legacySharesOut,1_000);
assert.equal(model.ownership.founderShares,600);
assert.equal(model.ownership.treasuryShares,100);
assert.equal(model.ownership.externalShareholderRatio,0.4);
assert.equal(model.ownership.publicCompany,true);

const parity=adapter.compareLegacyParity(state,model);
assert.equal(parity.ok,true,JSON.stringify(parity));
for(const id of [
  'entity-read-company-cash',
  'entity-read-personal-cash',
  'entity-read-company-debt',
  'entity-read-personal-debt',
  'entity-read-company-loan-principal',
  'entity-read-founder-loan-receivable',
  'entity-read-founder-shares',
  'entity-read-treasury-shares',
  'entity-read-external-shareholder-ratio',
  'entity-read-company-market-holdings',
  'entity-read-personal-market-holdings'
])assert.equal(Array.from(parity.checks).some(row=>row.id===id&&row.ok),true,`missing passing parity check ${id}`);
assert.equal(JSON.stringify(state),before,'parity diagnostics must not mutate authoritative state');

const tamperedCompany={
  ...company,
  accountBalances:Array.from(company.accountBalances).map(row=>row.accountId==='asset:cash'?{...row,amount:row.amount+1}:row)
};
const tampered={...model,entities:[tamperedCompany,founder]};
const mismatch=adapter.compareLegacyParity(state,tampered);
assert.equal(mismatch.ok,false);
assert.equal(Array.from(mismatch.checks).find(row=>row.id==='entity-read-company-cash').ok,false);

const modelAgain=adapter.snapshot(state);
assert.equal(JSON.stringify(modelAgain),JSON.stringify(model),'same authoritative state must produce identical ordered read model');

assert.throws(()=>adapter.snapshot({...state,companyCash:Number.POSITIVE_INFINITY}),/companyCash must be a finite number/);

console.log('economic read-only legacy adapter tests passed');
