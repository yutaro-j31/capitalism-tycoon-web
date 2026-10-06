// Script boundary: js/economic-read-model.js (classic JavaScript)
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before economic-read-model.js.');
if(!modules.economicOperation)throw new Error('economic-operation.js must be loaded before economic-read-model.js.');
if(!modules.finance)throw new Error('finance.js must be loaded before economic-read-model.js.');
if(modules.economicReadModel)throw new Error('Capitalism Tycoon economicReadModel module is already registered.');

const READ_MODEL_VERSION=1;
const PLAYER_COMPANY_ENTITY_ID='entity:company:player';
const FOUNDER_ENTITY_ID='entity:person:founder';
const PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID='security:player-company:common';
const CURRENCY='JPY';
const LEGACY_DEBT_TOLERANCE=0.1;

function compareText(a,b){a=String(a);b=String(b);return a<b?-1:a>b?1:0;}
function finite(value,path){
  const number=Number(value);
  if(!Number.isFinite(number))throw new TypeError(`${path} must be a finite number.`);
  return number;
}
function finiteOr(value,fallback,path){
  return value===undefined||value===null||value===''?fallback:finite(value,path);
}
function freezeRows(rows){return Object.freeze(rows.map(row=>Object.freeze(row)));}
function freezeEntity(record){
  const validation=modules.economicOperation.validateEntity(record);
  if(!validation.ok)throw new TypeError(`Invalid economic read-model entity: ${validation.errors.map(error=>error.code).join(', ')}`);
  return Object.freeze(record);
}
function entityRecord(state,kind){
  if(kind==='company'){
    const roles=state.publicCompany?['operatingCompany','listedIssuer']:['operatingCompany'];
    return freezeEntity({
      entityId:PLAYER_COMPANY_ENTITY_ID,
      legalEntityKind:'company',
      legalName:String(state.companyName||'Player Company'),
      status:state.isCompanySold?'sold':'active',
      roles:Object.freeze(roles),
      listingStatus:state.publicCompany?'listed':'private',
      jurisdiction:'JP',
      metadata:Object.freeze({source:'legacy-authoritative-state'})
    });
  }
  return freezeEntity({
    entityId:FOUNDER_ENTITY_ID,
    legalEntityKind:'person',
    legalName:String(state.playerName||'Founder'),
    status:'active',
    roles:Object.freeze(['founder','shareholder']),
    listingStatus:'not-applicable',
    jurisdiction:'JP',
    metadata:Object.freeze({source:'legacy-authoritative-state'})
  });
}
function accountBalances(state,kind){
  const company=kind==='company';
  const entityId=company?PLAYER_COMPANY_ENTITY_ID:FOUNDER_ENTITY_ID;
  const cashPath=company?'companyCash':'personalCash';
  const debtPath=company?'companyDebt':'personalDebt';
  return freezeRows([
    {entityId,accountId:'asset:cash',currency:CURRENCY,amount:finite(state[cashPath],cashPath),sourcePath:cashPath,numericDomain:'legacy-number'},
    {entityId,accountId:'liability:debt-principal',currency:CURRENCY,amount:finite(state[debtPath],debtPath),sourcePath:debtPath,numericDomain:'legacy-number'}
  ]);
}
function marketHoldings(source,entityId,sourcePath){
  if(source===undefined||source===null)return Object.freeze([]);
  if(!source||typeof source!=='object'||Array.isArray(source))throw new TypeError(`${sourcePath} must be an object map.`);
  const rows=[];
  for(const instrumentId of Object.keys(source).sort(compareText)){
    const holding=source[instrumentId];
    if(!holding||typeof holding!=='object'||Array.isArray(holding))throw new TypeError(`${sourcePath}.${instrumentId} must be an object.`);
    rows.push({
      entityId,
      instrumentId:String(instrumentId),
      quantity:finiteOr(holding.qty,0,`${sourcePath}.${instrumentId}.qty`),
      averageCost:finiteOr(holding.avg,0,`${sourcePath}.${instrumentId}.avg`),
      currency:CURRENCY,
      sourcePath:`${sourcePath}.${instrumentId}`
    });
  }
  return freezeRows(rows);
}
function companyDebtInstruments(state){
  const loans=state.finance?.loans;
  if(loans===undefined||loans===null)return Object.freeze([]);
  if(!Array.isArray(loans))throw new TypeError('finance.loans must be an array.');
  const rows=[];
  for(let index=0;index<loans.length;index++){
    const loan=loans[index];
    if(!loan||typeof loan!=='object'||Array.isArray(loan))throw new TypeError(`finance.loans[${index}] must be an object.`);
    if(String(loan.status||'active')==='repaid')continue;
    if(typeof loan.loanID!=='string'||!loan.loanID.trim())throw new TypeError(`finance.loans[${index}].loanID must be a non-empty string.`);
    rows.push({
      entityId:PLAYER_COMPANY_ENTITY_ID,
      debtInstrumentId:loan.loanID,
      outstandingPrincipal:finiteOr(loan.outstandingPrincipal,0,`finance.loans[${index}].outstandingPrincipal`),
      principal:finiteOr(loan.principal,0,`finance.loans[${index}].principal`),
      interestRate:finiteOr(loan.interestRate,0,`finance.loans[${index}].interestRate`),
      status:String(loan.status||'active'),
      sourceType:String(loan.sourceType||'legacyFinance'),
      sourceID:loan.sourceID==null?null:String(loan.sourceID),
      currency:CURRENCY,
      sourcePath:`finance.loans[${index}]`
    });
  }
  rows.sort((a,b)=>compareText(a.debtInstrumentId,b.debtInstrumentId));
  return freezeRows(rows);
}
function founderDebtReceivables(debtInstruments){
  return freezeRows(debtInstruments
    .filter(row=>row.sourceType===modules.finance.FOUNDER_LOAN_SOURCE)
    .map(row=>({
      entityId:FOUNDER_ENTITY_ID,
      debtInstrumentId:row.debtInstrumentId,
      counterpartyEntityId:PLAYER_COMPANY_ENTITY_ID,
      outstandingPrincipal:row.outstandingPrincipal,
      currency:CURRENCY,
      sourcePath:row.sourcePath
    })));
}
function ownershipSummary(state){
  return Object.freeze({
    securityClassId:PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID,
    issuerEntityId:PLAYER_COMPANY_ENTITY_ID,
    founderEntityId:FOUNDER_ENTITY_ID,
    legacySharesOut:finiteOr(state.sharesOut,0,'sharesOut'),
    founderShares:finiteOr(state.founderShares,0,'founderShares'),
    treasuryShares:finiteOr(state.treasuryBuybackShares,0,'treasuryBuybackShares'),
    externalShareholderRatio:finiteOr(state.externalShareholderRatio,0,'externalShareholderRatio'),
    publicCompany:Boolean(state.publicCompany),
    sourcePaths:Object.freeze({
      legacySharesOut:'sharesOut',
      founderShares:'founderShares',
      treasuryShares:'treasuryBuybackShares',
      externalShareholderRatio:'externalShareholderRatio'
    })
  });
}
function snapshot(state){
  if(!state||typeof state!=='object'||Array.isArray(state))throw new TypeError('economicReadModel.snapshot requires a state object.');
  const companyDebtRows=companyDebtInstruments(state);
  const company=Object.freeze({
    entity:entityRecord(state,'company'),
    accountBalances:accountBalances(state,'company'),
    debtInstruments:companyDebtRows,
    marketHoldings:marketHoldings(state.companyStocks,PLAYER_COMPANY_ENTITY_ID,'companyStocks')
  });
  const founder=Object.freeze({
    entity:entityRecord(state,'founder'),
    accountBalances:accountBalances(state,'founder'),
    debtReceivables:founderDebtReceivables(companyDebtRows),
    marketHoldings:marketHoldings(state.personalStocks,FOUNDER_ENTITY_ID,'personalStocks')
  });
  return Object.freeze({
    readModelVersion:READ_MODEL_VERSION,
    source:'legacy-authoritative-state',
    period:Object.freeze({week:finiteOr(state.week,1,'week')}),
    entities:Object.freeze([company,founder]),
    ownership:ownershipSummary(state)
  });
}
function entityById(readModel,entityId){
  return readModel.entities.find(row=>row?.entity?.entityId===entityId)||null;
}
function balanceByAccount(entity,accountId){
  return entity?.accountBalances?.find(row=>row.accountId===accountId)?.amount;
}
function compareHoldings(source,rows){
  const keys=Object.keys(source||{}).sort(compareText);
  if(keys.length!==(rows?.length||0))return false;
  for(let index=0;index<keys.length;index++){
    const key=keys[index],holding=source[key]||{},row=rows[index];
    if(row.instrumentId!==key)return false;
    if(row.quantity!==finiteOr(holding.qty,0,`holding.${key}.qty`))return false;
    if(row.averageCost!==finiteOr(holding.avg,0,`holding.${key}.avg`))return false;
  }
  return true;
}
function compareLegacyParity(state,readModel=snapshot(state)){
  if(!readModel||readModel.readModelVersion!==READ_MODEL_VERSION)throw new TypeError('Unsupported economic read-model version.');
  const company=entityById(readModel,PLAYER_COMPANY_ENTITY_ID);
  const founder=entityById(readModel,FOUNDER_ENTITY_ID);
  if(!company||!founder)throw new TypeError('Economic read model must contain company and founder entities.');
  const loanPrincipal=(company.debtInstruments||[]).reduce((sum,row)=>sum+finite(row.outstandingPrincipal,'debtInstruments.outstandingPrincipal'),0);
  const founderReceivable=(founder.debtReceivables||[]).reduce((sum,row)=>sum+finite(row.outstandingPrincipal,'debtReceivables.outstandingPrincipal'),0);
  const expectedFounderReceivable=(state.finance?.loans||[])
    .filter(row=>row&&String(row.status||'active')!=='repaid'&&row.sourceType===modules.finance.FOUNDER_LOAN_SOURCE)
    .reduce((sum,row)=>sum+finiteOr(row.outstandingPrincipal,0,'finance.loans.outstandingPrincipal'),0);
  const checks=[
    {id:'entity-read-company-cash',ok:balanceByAccount(company,'asset:cash')===finite(state.companyCash,'companyCash')},
    {id:'entity-read-personal-cash',ok:balanceByAccount(founder,'asset:cash')===finite(state.personalCash,'personalCash')},
    {id:'entity-read-company-debt',ok:balanceByAccount(company,'liability:debt-principal')===finite(state.companyDebt,'companyDebt')},
    {id:'entity-read-personal-debt',ok:balanceByAccount(founder,'liability:debt-principal')===finite(state.personalDebt,'personalDebt')},
    {id:'entity-read-company-loan-principal',ok:Math.abs(loanPrincipal-finite(state.companyDebt,'companyDebt'))<=LEGACY_DEBT_TOLERANCE,authoritative:finite(state.companyDebt,'companyDebt'),adapter:loanPrincipal},
    {id:'entity-read-founder-loan-receivable',ok:founderReceivable===expectedFounderReceivable,authoritative:expectedFounderReceivable,adapter:founderReceivable},
    {id:'entity-read-founder-shares',ok:readModel.ownership.founderShares===finiteOr(state.founderShares,0,'founderShares')},
    {id:'entity-read-treasury-shares',ok:readModel.ownership.treasuryShares===finiteOr(state.treasuryBuybackShares,0,'treasuryBuybackShares')},
    {id:'entity-read-external-shareholder-ratio',ok:readModel.ownership.externalShareholderRatio===finiteOr(state.externalShareholderRatio,0,'externalShareholderRatio')},
    {id:'entity-read-company-market-holdings',ok:compareHoldings(state.companyStocks,company.marketHoldings)},
    {id:'entity-read-personal-market-holdings',ok:compareHoldings(state.personalStocks,founder.marketHoldings)}
  ].map(row=>Object.freeze(row));
  return Object.freeze({
    ok:checks.every(row=>row.ok),
    readModelVersion:READ_MODEL_VERSION,
    checks:Object.freeze(checks)
  });
}

modules.economicReadModel=Object.freeze({
  READ_MODEL_VERSION,
  PLAYER_COMPANY_ENTITY_ID,
  FOUNDER_ENTITY_ID,
  PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID,
  CURRENCY,
  LEGACY_DEBT_TOLERANCE,
  snapshot,
  compareLegacyParity
});
})();
