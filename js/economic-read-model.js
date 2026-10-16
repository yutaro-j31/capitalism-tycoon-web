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
function ownCompanyPersonalHolding(state){
  const instrumentId=state.ticker==null?'':String(state.ticker);
  if(!instrumentId)return Object.freeze({instrumentId:null,quantity:0,averageCost:0,sourcePath:null});
  const source=state.personalStocks;
  if(source===undefined||source===null)return Object.freeze({instrumentId,quantity:0,averageCost:0,sourcePath:null});
  if(!source||typeof source!=='object'||Array.isArray(source))throw new TypeError('personalStocks must be an object map.');
  const holding=source[instrumentId];
  if(holding===undefined||holding===null)return Object.freeze({instrumentId,quantity:0,averageCost:0,sourcePath:null});
  if(!holding||typeof holding!=='object'||Array.isArray(holding))throw new TypeError(`personalStocks.${instrumentId} must be an object.`);
  return Object.freeze({
    instrumentId,
    quantity:finiteOr(holding.qty,0,`personalStocks.${instrumentId}.qty`),
    averageCost:finiteOr(holding.avg,0,`personalStocks.${instrumentId}.avg`),
    sourcePath:`personalStocks.${instrumentId}`
  });
}
function marketHoldings(source,entityId,sourcePath,excludedInstrumentId=null){
  if(source===undefined||source===null)return Object.freeze([]);
  if(!source||typeof source!=='object'||Array.isArray(source))throw new TypeError(`${sourcePath} must be an object map.`);
  const rows=[];
  for(const instrumentId of Object.keys(source).sort(compareText)){
    if(excludedInstrumentId!==null&&instrumentId===excludedInstrumentId)continue;
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
  const rows=[],seenDebtInstrumentIds=new Set();
  for(let index=0;index<loans.length;index++){
    const loan=loans[index];
    if(!loan||typeof loan!=='object'||Array.isArray(loan))throw new TypeError(`finance.loans[${index}] must be an object.`);
    if(String(loan.status||'active')==='repaid')continue;
    if(typeof loan.loanID!=='string'||!loan.loanID.trim())throw new TypeError(`finance.loans[${index}].loanID must be a non-empty string.`);
    if(seenDebtInstrumentIds.has(loan.loanID))throw new TypeError(`finance.loans contains duplicate active loanID: ${loan.loanID}`);
    seenDebtInstrumentIds.add(loan.loanID);
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
  const issuedShares=finiteOr(state.sharesOut,0,'sharesOut');
  const treasuryShares=finiteOr(state.treasuryBuybackShares,0,'treasuryBuybackShares');
  const outstandingShares=issuedShares-treasuryShares;
  const legacyFounderShares=finiteOr(state.founderShares,0,'founderShares');
  const personalOwnCompany=ownCompanyPersonalHolding(state);
  const personallyAcquiredOwnShares=personalOwnCompany.quantity;
  const founderBeneficialShares=legacyFounderShares+personallyAcquiredOwnShares;
  const nonFounderBeneficialShares=outstandingShares-founderBeneficialShares;
  const founderBeneficialRatio=outstandingShares>0?founderBeneficialShares/outstandingShares:0;
  const nonFounderBeneficialRatio=outstandingShares>0?nonFounderBeneficialShares/outstandingShares:0;
  return Object.freeze({
    securityClassId:PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID,
    issuerEntityId:PLAYER_COMPANY_ENTITY_ID,
    founderEntityId:FOUNDER_ENTITY_ID,
    issuedShares,
    treasuryShares,
    outstandingShares,
    legacyFounderShares,
    personallyAcquiredOwnShares,
    personallyAcquiredOwnSharesAverageCost:personalOwnCompany.averageCost,
    founderBeneficialShares,
    founderBeneficialRatio,
    nonFounderBeneficialShares,
    nonFounderBeneficialRatio,
    legacyExternalShareholderRatio:finiteOr(state.externalShareholderRatio,0,'externalShareholderRatio'),
    publicCompany:Boolean(state.publicCompany),
    sourcePaths:Object.freeze({
      issuedShares:'sharesOut',
      treasuryShares:'treasuryBuybackShares',
      legacyFounderShares:'founderShares',
      personallyAcquiredOwnShares:personalOwnCompany.sourcePath,
      legacyExternalShareholderRatio:'externalShareholderRatio'
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
    marketHoldings:marketHoldings(state.personalStocks,FOUNDER_ENTITY_ID,'personalStocks',state.ticker==null?null:String(state.ticker))
  });
  return Object.freeze({
    readModelVersion:READ_MODEL_VERSION,
    source:'legacy-authoritative-state',
    period:Object.freeze({week:finiteOr(state.week,1,'week')}),
    entities:Object.freeze([company,founder]),
    ownership:ownershipSummary(state)
  });
}
// P3-1 is source evidence only: no registry adoption, reconciliation or rights grant.
function ownershipProjection(state){
  if(!state||typeof state!=='object'||Array.isArray(state))throw new TypeError('economicReadModel.ownershipProjection requires a state object.');
  const issues=[],unresolvedAliases=[];
  function quantity(value,sourcePath,optional=false){
    if(optional&&(value===undefined||value===null))return 0;
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER){
      issues.push({sourcePath,reason:'quantity-missing-invalid-or-out-of-envelope'});
      return null;
    }
    return value;
  }
  function holdingMap(source,sourcePath){
    if(source===undefined||source===null)return {};
    if(typeof source!=='object'||Object.prototype.toString.call(source)!=='[object Object]'){
      issues.push({sourcePath,reason:'holding-map-invalid'});
      return null;
    }
    return source;
  }
  const issuedQuantity=quantity(state.sharesOut,'sharesOut');
  const treasuryQuantity=quantity(state.treasuryBuybackShares,'treasuryBuybackShares',true);
  const founderQuantity=quantity(state.founderShares,'founderShares');
  const instrumentId=typeof state.ticker==='string'&&state.ticker.trim()?state.ticker:null;
  if(instrumentId===null)issues.push({sourcePath:'ticker',reason:'player-instrument-binding-missing'});
  const personal=holdingMap(state.personalStocks,'personalStocks');
  const company=holdingMap(state.companyStocks,'companyStocks');
  const ownPath=instrumentId===null?null:`personalStocks.${instrumentId}`;
  const hasOwnHolding=personal!==null&&instrumentId!==null&&Object.prototype.hasOwnProperty.call(personal,instrumentId);
  let personalQuantity=personal===null||instrumentId===null?null:0;
  if(hasOwnHolding){
    const row=personal[instrumentId];
    if(!row||typeof row!=='object'||Object.prototype.toString.call(row)!=='[object Object]'){
      issues.push({sourcePath:ownPath,reason:'holding-record-invalid'});
      personalQuantity=null;
    }else personalQuantity=quantity(row.qty,`${ownPath}.qty`);
  }
  for(const [map,path,holderId] of [[company,'companyStocks',PLAYER_COMPANY_ENTITY_ID],[personal,'personalStocks',FOUNDER_ENTITY_ID]]){
    if(map===null)continue;
    for(const alias of Object.keys(map).sort(compareText)){
      if(path==='personalStocks'&&alias===instrumentId)continue;
      const sourcePath=`${path}.${alias}`,row=map[alias];
      let aliasQuantity=null;
      if(!row||typeof row!=='object'||Object.prototype.toString.call(row)!=='[object Object]'){
        issues.push({sourcePath,reason:'holding-record-invalid'});
      }else aliasQuantity=quantity(row.qty,`${sourcePath}.qty`);
      unresolvedAliases.push({
        instrumentId:alias,
        registeredHolderEntityId:holderId,
        issuerEntityId:null,
        securityClassId:null,
        quantity:aliasQuantity,
        sourcePath,
        reason:path==='companyStocks'&&alias===instrumentId?'company-own-share-alias-not-adopted':'issuer-family-alias-not-adopted'
      });
    }
  }
  const sourcePaths=Object.freeze({issuedQuantity:'sharesOut',treasuryQuantity:'treasuryBuybackShares'});
  const securityClass=Object.freeze({
    securityClassId:PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID,
    issuerEntityId:PLAYER_COMPANY_ENTITY_ID,
    classType:'common',
    issuedQuantity,
    treasuryQuantity,
    votingRightsPerUnit:1,
    economicRightsPerUnit:1,
    rightsEvidence:'legacy-player-single-common-class',
    treasuryQuantityDefaulted:state.treasuryBuybackShares===undefined||state.treasuryBuybackShares===null,
    sourcePaths
  });
  const holdings=freezeRows([
    {
      holdingId:'holding:player-company:founder-legacy',
      securityClassId:PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID,
      registeredHolderEntityId:FOUNDER_ENTITY_ID,
      beneficialOwnerEntityId:FOUNDER_ENTITY_ID,
      beneficialFraction:1,
      quantity:founderQuantity,
      sourceLot:'legacy-founderShares-bucket',
      sourcePath:'founderShares'
    },
    {
      holdingId:'holding:player-company:founder-personal-stock',
      securityClassId:PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID,
      registeredHolderEntityId:FOUNDER_ENTITY_ID,
      beneficialOwnerEntityId:FOUNDER_ENTITY_ID,
      beneficialFraction:1,
      quantity:personalQuantity,
      sourceLot:'legacy-personal-own-stock-bucket',
      sourcePath:hasOwnHolding?`${ownPath}.qty`:null,
      sourceMapPath:'personalStocks',
      sourceInstrumentId:instrumentId
    }
  ]);
  issues.sort((a,b)=>compareText(a.sourcePath,b.sourcePath)||compareText(a.reason,b.reason));
  unresolvedAliases.sort((a,b)=>compareText(a.sourcePath,b.sourcePath));
  return Object.freeze({
    projectionVersion:1,
    source:'legacy-authoritative-state',
    authority:'read-only',
    reconciliationStatus:'not-evaluated',
    entities:Object.freeze([entityRecord(state,'company'),entityRecord(state,'founder')]),
    securityClasses:Object.freeze([securityClass]),
    holdings,
    unresolvedAliases:freezeRows(unresolvedAliases),
    issues:freezeRows(issues)
  });
}
// P3-2 reconciles known source buckets without adopting any ownership writer.
function ownershipReconciliation(state){
  const projection=ownershipProjection(state),security=projection.securityClasses[0];
  const issues=projection.issues.map(row=>({...row}));
  function derivedQuantity(left,right,direction,sourcePath){
    if(left===null||right===null)return null;
    const operand=direction*right,value=left+operand;
    if(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER){
      issues.push({sourcePath,reason:'derived-quantity-negative-invalid-or-out-of-envelope'});
      return null;
    }
    // Error-free TwoSum residual: fail instead of dropping a small legacy fraction.
    const virtualRight=value-left,error=(left-(value-virtualRight))+(operand-virtualRight);
    if(error!==0){
      issues.push({sourcePath,reason:'derived-quantity-precision-loss'});
      return null;
    }
    return value;
  }
  const issued=security.issuedQuantity,treasury=security.treasuryQuantity;
  const quantities=projection.holdings.map(row=>row.quantity);
  const outstanding=derivedQuantity(issued,treasury,-1,'outstandingQuantity');
  const founder=derivedQuantity(quantities[0],quantities[1],1,'founderBeneficialQuantity');
  const unallocated=derivedQuantity(outstanding,founder,-1,'unallocatedOutstandingQuantity');
  const holdingIds=projection.holdings.map(row=>row.holdingId);
  const sourcePaths=projection.holdings.filter(row=>row.sourcePath!==null).map(row=>row.sourcePath);
  const sourceBindings=projection.holdings.every(row=>row.securityClassId===security.securityClassId
    &&row.registeredHolderEntityId===FOUNDER_ENTITY_ID&&row.beneficialOwnerEntityId===FOUNDER_ENTITY_ID
    &&row.beneficialFraction===1)
    &&new Set(holdingIds).size===holdingIds.length&&new Set(sourcePaths).size===sourcePaths.length;
  const checks=freezeRows([
    {id:'ECO-010',ok:issued!==null&&treasury!==null&&outstanding!==null&&issued===treasury+outstanding},
    {id:'ECO-011',ok:sourceBindings&&founder!==null&&unallocated!==null&&outstanding!==null
      &&founder<=outstanding&&founder+unallocated===outstanding}
  ]);
  for(const check of checks)if(!check.ok)issues.push({sourcePath:security.securityClassId,reason:`${check.id}-conservation-or-dedup-failed`});
  issues.sort((a,b)=>compareText(a.sourcePath,b.sourcePath)||compareText(a.reason,b.reason));
  const beneficialHolding=Object.freeze({
    beneficialHoldingId:'beneficial:player-company:founder',
    issuerEntityId:PLAYER_COMPANY_ENTITY_ID,
    securityClassId:security.securityClassId,
    beneficialOwnerEntityId:FOUNDER_ENTITY_ID,
    quantity:founder,
    sourceHoldingIds:Object.freeze(holdingIds)
  });
  return Object.freeze({
    reconciliationVersion:1,
    source:projection.source,
    authority:'read-only',
    scope:'player-company-common-founder-and-unallocated-residual',
    ok:issues.length===0&&checks.every(row=>row.ok),
    entities:projection.entities,
    securityClasses:Object.freeze([Object.freeze({...security,outstandingQuantity:outstanding,unallocatedOutstandingQuantity:unallocated})]),
    beneficialHoldings:Object.freeze([beneficialHolding]),
    sourceHoldings:projection.holdings,
    unresolvedAliases:projection.unresolvedAliases,
    checks,
    issues:freezeRows(issues)
  });
}
function entityById(readModel,entityId){
  return readModel.entities.find(row=>row?.entity?.entityId===entityId)||null;
}
function sameOrderedStrings(actual,expected){
  return Array.isArray(actual)&&actual.length===expected.length&&actual.every((value,index)=>value===expected[index]);
}
function compareEntityRecord(state,entity,kind){
  const row=entity?.entity;
  if(!row)return false;
  if(kind==='company'){
    const expectedRoles=state.publicCompany?['operatingCompany','listedIssuer']:['operatingCompany'];
    return row.entityId===PLAYER_COMPANY_ENTITY_ID
      &&row.legalEntityKind==='company'
      &&row.legalName===String(state.companyName||'Player Company')
      &&row.status===(state.isCompanySold?'sold':'active')
      &&sameOrderedStrings(row.roles,expectedRoles)
      &&row.listingStatus===(state.publicCompany?'listed':'private')
      &&row.jurisdiction==='JP'
      &&row.metadata?.source==='legacy-authoritative-state';
  }
  return row.entityId===FOUNDER_ENTITY_ID
    &&row.legalEntityKind==='person'
    &&row.legalName===String(state.playerName||'Founder')
    &&row.status==='active'
    &&sameOrderedStrings(row.roles,['founder','shareholder'])
    &&row.listingStatus==='not-applicable'
    &&row.jurisdiction==='JP'
    &&row.metadata?.source==='legacy-authoritative-state';
}
function compareAccountRows(state,entity,kind){
  const rows=entity?.accountBalances;
  if(!Array.isArray(rows)||rows.length!==2)return false;
  const company=kind==='company';
  const entityId=company?PLAYER_COMPANY_ENTITY_ID:FOUNDER_ENTITY_ID;
  const specs=[
    {accountId:'asset:cash',sourcePath:company?'companyCash':'personalCash'},
    {accountId:'liability:debt-principal',sourcePath:company?'companyDebt':'personalDebt'}
  ];
  for(const spec of specs){
    const matches=rows.filter(row=>row?.accountId===spec.accountId);
    if(matches.length!==1)return false;
    const row=matches[0];
    if(row.entityId!==entityId)return false;
    if(row.currency!==CURRENCY)return false;
    if(row.amount!==finite(state[spec.sourcePath],spec.sourcePath))return false;
    if(row.sourcePath!==spec.sourcePath)return false;
    if(row.numericDomain!=='legacy-number')return false;
  }
  return true;
}
function balanceRowByAccount(entity,accountId,expectedEntityId){
  const row=entity?.accountBalances?.find(candidate=>candidate.accountId===accountId);
  return row&&row.entityId===expectedEntityId?row:null;
}
function compareHoldings(source,rows,expectedEntityId,excludedInstrumentId=null){
  const keys=Object.keys(source||{}).filter(key=>excludedInstrumentId===null||key!==excludedInstrumentId).sort(compareText);
  if(keys.length!==(rows?.length||0))return false;
  for(let index=0;index<keys.length;index++){
    const key=keys[index],holding=source[key]||{},row=rows[index];
    if(row.entityId!==expectedEntityId)return false;
    if(row.instrumentId!==key)return false;
    if(row.quantity!==finiteOr(holding.qty,0,`holding.${key}.qty`))return false;
    if(row.averageCost!==finiteOr(holding.avg,0,`holding.${key}.avg`))return false;
    if(row.currency!==CURRENCY)return false;
    if(row.sourcePath!==`${expectedEntityId===PLAYER_COMPANY_ENTITY_ID?'companyStocks':'personalStocks'}.${key}`)return false;
  }
  return true;
}
function compareDebtInstruments(sourceLoans,rows){
  if(!Array.isArray(sourceLoans)||!Array.isArray(rows))return false;
  const expected=sourceLoans
    .map((loan,sourceIndex)=>({loan,sourceIndex}))
    .filter(entry=>entry.loan&&String(entry.loan.status||'active')!=='repaid')
    .sort((a,b)=>compareText(a.loan.loanID,b.loan.loanID));
  if(expected.length!==rows.length)return false;
  for(let index=0;index<expected.length;index++){
    const {loan,sourceIndex}=expected[index],row=rows[index];
    if(row.entityId!==PLAYER_COMPANY_ENTITY_ID)return false;
    if(row.debtInstrumentId!==String(loan.loanID))return false;
    if(row.outstandingPrincipal!==finiteOr(loan.outstandingPrincipal,0,`finance.loans[${index}].outstandingPrincipal`))return false;
    if(row.principal!==finiteOr(loan.principal,0,`finance.loans[${index}].principal`))return false;
    if(row.interestRate!==finiteOr(loan.interestRate,0,`finance.loans[${index}].interestRate`))return false;
    if(row.status!==String(loan.status||'active'))return false;
    if(row.sourceType!==String(loan.sourceType||'legacyFinance'))return false;
    if(row.sourceID!==(loan.sourceID==null?null:String(loan.sourceID)))return false;
    if(row.currency!==CURRENCY)return false;
    if(row.sourcePath!==`finance.loans[${sourceIndex}]`)return false;
  }
  return true;
}
function compareFounderReceivables(companyDebtRows,rows){
  if(!Array.isArray(companyDebtRows)||!Array.isArray(rows))return false;
  const expected=companyDebtRows
    .filter(row=>row?.sourceType===modules.finance.FOUNDER_LOAN_SOURCE)
    .slice()
    .sort((a,b)=>compareText(a.debtInstrumentId,b.debtInstrumentId));
  const actual=rows.slice().sort((a,b)=>compareText(a?.debtInstrumentId,b?.debtInstrumentId));
  if(expected.length!==actual.length)return false;
  for(let index=0;index<expected.length;index++){
    const debt=expected[index],receivable=actual[index];
    if(receivable?.entityId!==FOUNDER_ENTITY_ID)return false;
    if(receivable?.counterpartyEntityId!==PLAYER_COMPANY_ENTITY_ID)return false;
    if(receivable?.debtInstrumentId!==debt.debtInstrumentId)return false;
    if(receivable?.outstandingPrincipal!==debt.outstandingPrincipal)return false;
    if(receivable?.currency!==CURRENCY)return false;
    if(receivable?.sourcePath!==debt.sourcePath)return false;
  }
  return true;
}
function compareLegacyParity(state,readModel=snapshot(state)){
  if(!readModel||readModel.readModelVersion!==READ_MODEL_VERSION)throw new TypeError('Unsupported economic read-model version.');
  const company=entityById(readModel,PLAYER_COMPANY_ENTITY_ID);
  const founder=entityById(readModel,FOUNDER_ENTITY_ID);
  if(!company||!founder)throw new TypeError('Economic read model must contain company and founder entities.');
  const rootMetadataParity=readModel.readModelVersion===READ_MODEL_VERSION
    &&readModel.source==='legacy-authoritative-state'
    &&readModel.period?.week===finiteOr(state.week,1,'week');
  const entityIds=Array.isArray(readModel.entities)
    ? readModel.entities.map(row=>row?.entity?.entityId).sort(compareText)
    : [];
  const entitySetParity=entityIds.length===2
    &&entityIds[0]===PLAYER_COMPANY_ENTITY_ID
    &&entityIds[1]===FOUNDER_ENTITY_ID;
  const companyEntityParity=compareEntityRecord(state,company,'company');
  const founderEntityParity=compareEntityRecord(state,founder,'founder');
  const companyAccountParity=compareAccountRows(state,company,'company');
  const founderAccountParity=compareAccountRows(state,founder,'founder');
  const companyCashRow=balanceRowByAccount(company,'asset:cash',PLAYER_COMPANY_ENTITY_ID);
  const companyDebtRow=balanceRowByAccount(company,'liability:debt-principal',PLAYER_COMPANY_ENTITY_ID);
  const personalCashRow=balanceRowByAccount(founder,'asset:cash',FOUNDER_ENTITY_ID);
  const personalDebtRow=balanceRowByAccount(founder,'liability:debt-principal',FOUNDER_ENTITY_ID);
  const companyAccountBindings=(company.accountBalances||[]).every(row=>row?.entityId===PLAYER_COMPANY_ENTITY_ID);
  const founderAccountBindings=(founder.accountBalances||[]).every(row=>row?.entityId===FOUNDER_ENTITY_ID);
  const companyDebtBindings=(company.debtInstruments||[]).every(row=>row?.entityId===PLAYER_COMPANY_ENTITY_ID);
  const founderDebtBindings=(founder.debtReceivables||[]).every(row=>row?.entityId===FOUNDER_ENTITY_ID&&row?.counterpartyEntityId===PLAYER_COMPANY_ENTITY_ID);
  const companyDebtInstrumentParity=compareDebtInstruments(state.finance?.loans||[],company.debtInstruments||[]);
  const founderReceivableInstrumentParity=compareFounderReceivables(company.debtInstruments||[],founder.debtReceivables||[]);
  const ownershipBindings=readModel.ownership?.issuerEntityId===PLAYER_COMPANY_ENTITY_ID
    &&readModel.ownership?.founderEntityId===FOUNDER_ENTITY_ID
    &&readModel.ownership?.securityClassId===PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID;
  const personalOwnCompany=ownCompanyPersonalHolding(state);
  const expectedIssuedShares=finiteOr(state.sharesOut,0,'sharesOut');
  const expectedTreasuryShares=finiteOr(state.treasuryBuybackShares,0,'treasuryBuybackShares');
  const expectedOutstandingShares=expectedIssuedShares-expectedTreasuryShares;
  const expectedLegacyFounderShares=finiteOr(state.founderShares,0,'founderShares');
  const expectedFounderBeneficialShares=expectedLegacyFounderShares+personalOwnCompany.quantity;
  const expectedNonFounderBeneficialShares=expectedOutstandingShares-expectedFounderBeneficialShares;
  const expectedFounderBeneficialRatio=expectedOutstandingShares>0?expectedFounderBeneficialShares/expectedOutstandingShares:0;
  const expectedNonFounderBeneficialRatio=expectedOutstandingShares>0?expectedNonFounderBeneficialShares/expectedOutstandingShares:0;
  const ownershipSourcePaths=readModel.ownership?.sourcePaths?.issuedShares==='sharesOut'
    &&readModel.ownership?.sourcePaths?.treasuryShares==='treasuryBuybackShares'
    &&readModel.ownership?.sourcePaths?.legacyFounderShares==='founderShares'
    &&readModel.ownership?.sourcePaths?.personallyAcquiredOwnShares===personalOwnCompany.sourcePath
    &&readModel.ownership?.sourcePaths?.legacyExternalShareholderRatio==='externalShareholderRatio';
  const loanPrincipal=(company.debtInstruments||[]).reduce((sum,row)=>sum+finite(row.outstandingPrincipal,'debtInstruments.outstandingPrincipal'),0);
  const founderReceivable=(founder.debtReceivables||[]).reduce((sum,row)=>sum+finite(row.outstandingPrincipal,'debtReceivables.outstandingPrincipal'),0);
  const expectedFounderReceivable=(state.finance?.loans||[])
    .filter(row=>row&&String(row.status||'active')!=='repaid'&&row.sourceType===modules.finance.FOUNDER_LOAN_SOURCE)
    .reduce((sum,row)=>sum+finiteOr(row.outstandingPrincipal,0,'finance.loans.outstandingPrincipal'),0);
  const checks=[
    {id:'entity-read-root-metadata',ok:rootMetadataParity},
    {id:'entity-read-entity-set',ok:entitySetParity},
    {id:'entity-read-company-entity',ok:companyEntityParity},
    {id:'entity-read-founder-entity',ok:founderEntityParity},
    {id:'entity-read-company-account-bindings',ok:companyAccountBindings},
    {id:'entity-read-founder-account-bindings',ok:founderAccountBindings},
    {id:'entity-read-company-account-rows',ok:companyAccountParity},
    {id:'entity-read-founder-account-rows',ok:founderAccountParity},
    {id:'entity-read-company-cash',ok:companyAccountParity&&companyCashRow?.amount===finite(state.companyCash,'companyCash')},
    {id:'entity-read-personal-cash',ok:founderAccountParity&&personalCashRow?.amount===finite(state.personalCash,'personalCash')},
    {id:'entity-read-company-debt',ok:companyAccountParity&&companyDebtRow?.amount===finite(state.companyDebt,'companyDebt')},
    {id:'entity-read-personal-debt',ok:founderAccountParity&&personalDebtRow?.amount===finite(state.personalDebt,'personalDebt')},
    {id:'entity-read-company-debt-instrument-bindings',ok:companyDebtBindings},
    {id:'entity-read-company-debt-instruments',ok:companyDebtInstrumentParity},
    {id:'entity-read-company-loan-principal',ok:companyDebtBindings&&companyDebtInstrumentParity&&Math.abs(loanPrincipal-finite(state.companyDebt,'companyDebt'))<=LEGACY_DEBT_TOLERANCE,authoritative:finite(state.companyDebt,'companyDebt'),adapter:loanPrincipal},
    {id:'entity-read-founder-debt-receivable-bindings',ok:founderDebtBindings},
    {id:'entity-read-founder-debt-receivable-instruments',ok:founderReceivableInstrumentParity},
    {id:'entity-read-founder-loan-receivable',ok:founderDebtBindings&&founderReceivableInstrumentParity&&founderReceivable===expectedFounderReceivable,authoritative:expectedFounderReceivable,adapter:founderReceivable},
    {id:'entity-read-ownership-bindings',ok:ownershipBindings},
    {id:'entity-read-ownership-source-paths',ok:ownershipSourcePaths},
    {id:'entity-read-public-company-status',ok:ownershipBindings&&companyEntityParity&&readModel.ownership.publicCompany===Boolean(state.publicCompany)},
    {id:'entity-read-issued-shares',ok:ownershipBindings&&readModel.ownership.issuedShares===expectedIssuedShares},
    {id:'entity-read-treasury-shares',ok:ownershipBindings&&readModel.ownership.treasuryShares===expectedTreasuryShares},
    {id:'entity-read-outstanding-shares',ok:ownershipBindings&&readModel.ownership.outstandingShares===expectedOutstandingShares},
    {id:'entity-read-legacy-founder-shares',ok:ownershipBindings&&readModel.ownership.legacyFounderShares===expectedLegacyFounderShares},
    {id:'entity-read-personally-acquired-own-shares',ok:ownershipBindings&&readModel.ownership.personallyAcquiredOwnShares===personalOwnCompany.quantity&&readModel.ownership.personallyAcquiredOwnSharesAverageCost===personalOwnCompany.averageCost},
    {id:'entity-read-founder-beneficial-shares',ok:ownershipBindings&&readModel.ownership.founderBeneficialShares===expectedFounderBeneficialShares&&readModel.ownership.founderBeneficialRatio===expectedFounderBeneficialRatio},
    {id:'entity-read-ownership-conservation',ok:ownershipBindings&&expectedIssuedShares>=0&&expectedTreasuryShares>=0&&expectedOutstandingShares>=0&&expectedFounderBeneficialShares>=0&&expectedNonFounderBeneficialShares>=0&&readModel.ownership.nonFounderBeneficialShares===expectedNonFounderBeneficialShares&&readModel.ownership.nonFounderBeneficialRatio===expectedNonFounderBeneficialRatio&&readModel.ownership.founderBeneficialShares+readModel.ownership.nonFounderBeneficialShares===readModel.ownership.outstandingShares},
    {id:'entity-read-legacy-external-shareholder-ratio',ok:ownershipBindings&&readModel.ownership.legacyExternalShareholderRatio===finiteOr(state.externalShareholderRatio,0,'externalShareholderRatio')},
    {id:'entity-read-company-market-holdings',ok:compareHoldings(state.companyStocks,company.marketHoldings,PLAYER_COMPANY_ENTITY_ID)},
    {id:'entity-read-personal-own-share-dedup',ok:!String(state.ticker||'')||!(founder.marketHoldings||[]).some(row=>row?.instrumentId===String(state.ticker))},
    {id:'entity-read-personal-market-holdings',ok:compareHoldings(state.personalStocks,founder.marketHoldings,FOUNDER_ENTITY_ID,state.ticker==null?null:String(state.ticker))}
  ].map(row=>Object.freeze(row));
  return Object.freeze({
    ok:checks.every(row=>row.ok),
    readModelVersion:READ_MODEL_VERSION,
    checks:Object.freeze(checks)
  });
}

// P3-5: opt-in evidence only. No settlement or voting authority is adopted.
const ownershipIndexes=new WeakMap();
function freezeOwned(value){
  if(value&&typeof value==='object'){
    for(const child of Object.values(value))freezeOwned(child);
    Object.freeze(value);
  }
  return value;
}
function ownershipReason(code,path){return {code,path,message:code,evidenceRefs:[path]};}
function plainOwnershipObject(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const proto=Object.getPrototypeOf(value);
  return proto===null||Object.getPrototypeOf(proto)===null;
}
// Inspect descriptors before reading values; never invoke source getters or helpers.
// Only this adapter's source branches are copied, never the entire game state.
function inspectListedSources(raw){
  const issues=[],ancestors=new Set();
  function copy(value,path){
    if(typeof value==='string'){
      try{encodeURIComponent(value);}catch(_){issues.push(ownershipReason('INPUT_INVALID',path));return null;}
    }
    if(value===null||['string','number','boolean','undefined'].includes(typeof value))return value;
    if(typeof value!=='object'||(!Array.isArray(value)&&!plainOwnershipObject(value))||ancestors.has(value)){
      issues.push(ownershipReason('INPUT_INVALID',path));return null;
    }
    ancestors.add(value);
    const out=Array.isArray(value)?[]:Object.create(null);
    const descriptors=Object.getOwnPropertyDescriptors(value);
    if(Array.isArray(value)&&Object.keys(value).filter(key=>/^(0|[1-9][0-9]*)$/.test(key)).length!==value.length)issues.push(ownershipReason('INPUT_INVALID',path));
    for(const key of Reflect.ownKeys(descriptors)){
      if(Array.isArray(value)&&key==='length')continue;
      const descriptor=descriptors[key];
      // Histories and unrelated startup operating data are not identity inputs.
      const fields=/^market\["[0-9]+"\]$/.test(path)?['id','privateCompany','suspended']
        :/^startups\["[0-9]+"\]$/.test(path)?['id','ipoStockID','ownedCompany','ownedPersonal']:null;
      if(fields&&!fields.includes(key))continue;
      if(typeof key==='string'){try{encodeURIComponent(key);}catch(_){issues.push(ownershipReason('INPUT_INVALID',path));continue;}}
      if(typeof key!=='string'||!Object.hasOwn(descriptor,'value')){
        issues.push(ownershipReason('INPUT_INVALID',path));continue;
      }
      Object.defineProperty(out,key,{value:copy(descriptor.value,`${path}[${JSON.stringify(key)}]`),enumerable:true,writable:true,configurable:true});
    }
    ancestors.delete(value);return out;
  }
  if(!plainOwnershipObject(raw))return {source:null,issues:[ownershipReason('INPUT_INVALID','$')]};
  const descriptors=Object.getOwnPropertyDescriptors(raw),source=Object.create(null);
  for(const key of Reflect.ownKeys(descriptors)){
    if(typeof key!=='string'||!Object.hasOwn(descriptors[key],'value'))issues.push(ownershipReason('INPUT_INVALID','$'));
  }
  for(const key of ['ticker','currentCompanySerial','isCompanySold','market','startups','personalStocks','companyStocks']){
    if(Object.hasOwn(descriptors,key)&&Object.hasOwn(descriptors[key],'value'))source[key]=copy(descriptors[key].value,key);
  }
  return {source,issues};
}
function captureListedSources(raw){
  try{return inspectListedSources(raw);}
  catch(_){return {source:null,issues:[ownershipReason('INPUT_INVALID','$')]};}
}
function sameListedSources(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a).sort(compareText),other=Object.keys(b).sort(compareText);
  return keys.length===other.length&&keys.every((key,i)=>key===other[i]&&sameListedSources(a[key],b[key]));
}
function buildListedHoldingsIdentityIndex(rawState){
  const captured=captureListedSources(rawState);
  const index=freezeOwned({authority:'read-only',indexVersion:1,issues:captured.issues});
  ownershipIndexes.set(index,{rawState,source:captured.source});
  return index;
}
function projectExternalListedHoldings(rawState,identityIndex){
  const captured=captureListedSources(rawState),issues=captured.issues;
  const result={authority:'read-only',adapterVersion:1,complete:false,entities:[],classes:[],positions:[],relationships:[],unresolved:[],issues,sourceCoverage:[]};
  if(identityIndex!==undefined){
    const indexed=ownershipIndexes.get(identityIndex);
    if(!indexed||indexed.rawState!==rawState||!sameListedSources(indexed.source,captured.source))issues.push(ownershipReason('STALE_EVIDENCE','$'));
    else if(identityIndex.issues.length&&!issues.length)issues.push(ownershipReason('INPUT_INVALID','$'));
  }
  if(issues.length||!captured.source)return freezeOwned(result);
  const state=captured.source,market=new Map(),startups=new Map(),startupIds=new Map();
  const validId=value=>typeof value==='string'&&value.length>0;
  const add=(map,key,row)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(row);};
  const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  function rows(key){
    if(!Object.hasOwn(state,key))return [];
    if(!Array.isArray(state[key])){issues.push(ownershipReason('INPUT_INVALID',key));return [];}
    return state[key];
  }
  rows('market').forEach((row,i)=>{
    const path=`market[${i}]`;
    if(!plainOwnershipObject(row)||!validId(row.id)){issues.push(ownershipReason('INPUT_INVALID',path));return;}
    add(market,row.id,{row,path});
  });
  rows('startups').forEach((row,i)=>{
    const path=`startups[${i}]`;
    if(!plainOwnershipObject(row)){issues.push(ownershipReason('INPUT_INVALID',path));return;}
    // Even an invalid issuer ID can contradict an alias claimed by another row.
    if(row.ipoStockID!==undefined&&row.ipoStockID!==null){
      if(validId(row.ipoStockID))add(startups,row.ipoStockID,{row,path});
      else issues.push(ownershipReason('INPUT_INVALID',`${path}.ipoStockID`));
    }
    if(!validId(row.id)){issues.push(ownershipReason('INPUT_INVALID',path));return;}
    add(startupIds,row.id,{row,path});
  });
  const ref=(path,durableId,family,role='current')=>({path,durableId,family,role});
  const entity=(entityId,identityStatus,sourceRefs,generation=null)=>({entityId,generation,identityStatus,sourceRefs});
  const evidence=(status,value,sourceRefs,reasons)=>({status,value,sourceRefs,reasons});
  const entityMap=new Map();
  for(const [mapKey,accountKind,holderId] of [['companyStocks','company',PLAYER_COMPANY_ENTITY_ID],['personalStocks','personal',FOUNDER_ENTITY_ID]]){
    if(!Object.hasOwn(state,mapKey)){result.sourceCoverage.push({path:mapKey,status:'absent-optional'});continue;}
    const holdings=state[mapKey];
    if(!plainOwnershipObject(holdings)){issues.push(ownershipReason('INPUT_INVALID',mapKey));result.sourceCoverage.push({path:mapKey,status:'invalid'});continue;}
    result.sourceCoverage.push({path:mapKey,status:'observed'});
    for(const alias of Object.keys(holdings).sort(compareText)){
      const path=`${mapKey}[${JSON.stringify(alias)}]`,sourceRef=ref(path,alias,'listed');
      const own=validId(state.ticker)&&alias===state.ticker;
      const ownGenerationKnown=state.currentCompanySerial===1&&state.isCompanySold!==true;
      if(own&&accountKind==='personal'&&ownGenerationKnown
        &&!(startups.get(alias)||[]).length&&(market.get(alias)||[]).length<=1){
        result.sourceCoverage.push({path,status:'delegated',resolvedByAdapter:'ownershipReconciliation'});continue;
      }
      const reasons=[],row=holdings[alias],matches=market.get(alias)||[],links=startups.get(alias)||[];
      const quantity=plainOwnershipObject(row)&&typeof row.qty==='number'&&Number.isFinite(row.qty)&&row.qty>=0&&row.qty<=Number.MAX_SAFE_INTEGER?row.qty:null;
      if(quantity===null)reasons.push(ownershipReason('QUANTITY_OUT_OF_ENVELOPE',`${path}.qty`));
      let issuerId=null,issuerStatus='unresolved';
      const listingRefs=matches.map(item=>ref(item.path,item.row.id,'listed'));
      const linkRefs=links.map(item=>ref(item.path,validId(item.row.id)?item.row.id:null,'vc','historical'));
      const conflict=matches.length>1||links.length>1||links.some(item=>(startupIds.get(item.row.id)||[]).length!==1)||(own&&links.length>0);
      if(conflict)reasons.push(ownershipReason('ALIAS_CONFLICT',path));
      else if(!own&&matches.length===1&&links.length===1){
        const startup=links[0].row;
        // Nonzero/missing legacy stakes cannot prove that IPO conversion is complete.
        if(startup.ownedCompany!==0||startup.ownedPersonal!==0)reasons.push(ownershipReason('ALIAS_CONFLICT',path));
        else {issuerId=`entity:company:startup:${encode(startup.id)}`;issuerStatus='source-scoped';}
      }
      if(!validId(state.ticker)){issuerId=null;issuerStatus='unresolved';}
      if(!issuerId)reasons.push(ownershipReason('IDENTITY_UNPROVEN',path));
      reasons.push(ownershipReason('CLASS_UNKNOWN',path),ownershipReason('RIGHTS_UNKNOWN',path),ownershipReason('DENOMINATOR_UNKNOWN',path));
      if(!validId(state.ticker))reasons.push(ownershipReason('IDENTITY_UNPROVEN','ticker'));
      if(accountKind==='company'||(own&&!ownGenerationKnown))reasons.push(ownershipReason('GENERATION_UNPROVEN',path));
      const holder=entity(holderId,accountKind==='personal'?'proven':'source-scoped',[sourceRef]);
      const issuer=entity(issuerId,issuerStatus,[...listingRefs,...linkRefs]);
      const unknown=code=>evidence('unknown',null,[sourceRef],reasons.filter(reason=>reason.code===code));
      const position={positionId:`position:listed:${accountKind}:${encode(alias)}`,ownershipKey:null,issuer,securityClassId:null,
        registeredHolder:holder,beneficialOwner:holder,accountKind,
        quantity:evidence(quantity===null?'invalid':'known',quantity,[sourceRef],reasons.filter(reason=>reason.code==='QUANTITY_OUT_OF_ENVELOPE')),
        economicFraction:unknown('DENOMINATOR_UNKNOWN'),votingUnits:unknown('RIGHTS_UNKNOWN'),
        sourceRefs:[sourceRef,...listingRefs,...linkRefs],assetRole:'unresolved',
        instrumentAlias:alias,listingStatus:matches.length===1?(matches[0].row.privateCompany?'private':matches[0].row.suspended?'suspended':'observed'):'unknown',
        resolvedByAdapter:{adapter:'projectExternalListedHoldings',sourcePath:`${mapKey}.${alias}`},reasons};
      result.positions.push(position);
      result.unresolved.push({positionId:position.positionId,sourceRefs:[sourceRef],reasons});
      issues.push(...reasons);
      entityMap.set(holderId,holder);
      if(issuerId)entityMap.set(issuerId,issuer);
    }
  }
  result.entities=Array.from(entityMap.values()).sort((a,b)=>compareText(a.entityId,b.entityId));
  issues.sort((a,b)=>compareText(a.path,b.path)||compareText(a.code,b.code));
  result.complete=issues.length===0;
  return freezeOwned(result);
}

modules.economicReadModel=Object.freeze({
  READ_MODEL_VERSION,
  PLAYER_COMPANY_ENTITY_ID,
  FOUNDER_ENTITY_ID,
  PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID,
  CURRENCY,
  LEGACY_DEBT_TOLERANCE,
  snapshot,
  buildListedHoldingsIdentityIndex,
  projectExternalListedHoldings,
  ownershipProjection,
  ownershipReconciliation,
  compareLegacyParity
});
})();
