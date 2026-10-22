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
    // Raw issuer-generation facts, passed through unjudged: consumers that attribute control decide
    // whether this company generation is proven (a sold or refounded company keeps its old buckets).
    generationEvidence:Object.freeze({
      currentCompanySerial:Number.isSafeInteger(state.currentCompanySerial)?state.currentCompanySerial:null,
      isCompanySold:typeof state.isCompanySold==='boolean'?state.isCompanySold:null
    }),
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
const commonOwnershipIndexes=new WeakMap();
const subsidiaryOwnershipScope='player-listed-and-subsidiary-ownership-v1';
const subsidiaryOwnershipRoots=['subsidiaries','maSubsidiaries','overseasSubsidiaries','maDealRooms','acquisitionTargets','internalVentures','peDeals','startups'];
const commonOwnershipFields=['companyName','playerName','publicCompany','sharesOut','treasuryBuybackShares','founderShares','week'];
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
function inspectListedSources(raw,includePlayer=false,includeSubsidiaries=false){
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
      let fields=/^market\["[0-9]+"\]$/.test(path)?['id','privateCompany','suspended',...(includePlayer?['price','issuedShares']:[])]
        :/^startups\["[0-9]+"\]$/.test(path)?['id','ipoStockID','ownedCompany','ownedPersonal']:null;
      if(includeSubsidiaries){
        const familyFields={
          subsidiaries:['id','startupID','peDealID','sourcePEFundID','sourcePEDealID','internalVentureID','sourceCompetitorID','restructuredFrom','restructuredWeek','ownership','status','source'],
          maSubsidiaries:['peDealID','startupID','id','maStableKey','acquisitionDealID','acquisitionMethod','acquiredWeek','ownership','status'],
          overseasSubsidiaries:['peDealID','startupID','id','status'],
          maDealRooms:['id','targetID','targetStableKey','status','closedWeek','acceptedTerms'],
          acquisitionTargets:['id','maStableKey'],internalVentures:['id','status','spunOffSubsidiaryID'],
          peDeals:['id','ownerAccount','status','subsidiaryID','ownershipRatio']
        };
        const family=/^([A-Za-z]+)\["[0-9]+"\]$/.exec(path)?.[1];
        if(familyFields[family])fields=familyFields[family];
        if(/^maDealRooms\["[0-9]+"\]\["acceptedTerms"\]$/.test(path))fields=['method'];
      }
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
  for(const key of ['ticker','currentCompanySerial','isCompanySold','market','startups','personalStocks','companyStocks',...(includePlayer?commonOwnershipFields:[]),...(includeSubsidiaries?subsidiaryOwnershipRoots:[])]){
    if(Object.hasOwn(descriptors,key)&&Object.hasOwn(descriptors[key],'value'))source[key]=copy(descriptors[key].value,key);
  }
  return {source,issues};
}
function captureListedSources(raw,includePlayer=false,includeSubsidiaries=false){
  try{return inspectListedSources(raw,includePlayer,includeSubsidiaries);}
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
  if(commonOwnershipIndexes.has(identityIndex)){
    const indexed=commonOwnershipIndexes.get(identityIndex),current=captureListedSources(rawState,true,indexed?.includeSubsidiaries);
    if(indexed.rawState===rawState&&!current.issues.length&&!identityIndex.issues.length&&sameListedSources(indexed.source,current.source))return indexed.listed;
    return freezeOwned({authority:'read-only',adapterVersion:1,complete:false,entities:[],classes:[],positions:[],relationships:[],unresolved:[],sourceCoverage:[],issues:[ownershipReason('STALE_EVIDENCE','$')]});
  }
  const captured=captureListedSources(rawState),issues=captured.issues;
  const result={authority:'read-only',adapterVersion:1,complete:false,entities:[],classes:[],positions:[],relationships:[],unresolved:[],issues,sourceCoverage:[]};
  if(identityIndex!==undefined){
    const indexed=ownershipIndexes.get(identityIndex);
    if(!indexed||indexed.rawState!==rawState||!sameListedSources(indexed.source,captured.source))issues.push(ownershipReason('STALE_EVIDENCE','$'));
    else if(identityIndex.issues.length&&!issues.length)issues.push(ownershipReason('INPUT_INVALID','$'));
  }
  if(issues.length||!captured.source)return freezeOwned(result);
  const state=captured.source,market=new Map(),startups=new Map(),startupIds=new Map();
  const validId=value=>typeof value==='string'&&value.trim().length>0;
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
  const soldStatusValid=state.isCompanySold===undefined||state.isCompanySold===null||typeof state.isCompanySold==='boolean';
  if(!soldStatusValid)issues.push(ownershipReason('INPUT_INVALID','isCompanySold'));
  // A malformed inventory may hide an IPO claimant; absence is not proven.
  const aliasInventoryValid=!issues.some(issue=>issue.code==='INPUT_INVALID');
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
      const ownGenerationKnown=state.currentCompanySerial===1&&soldStatusValid&&state.isCompanySold!==true;
      if(own&&accountKind==='personal'&&ownGenerationKnown&&aliasInventoryValid
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

// Incremental common index: binds the immutable player/listed OWNERSHIP inputs.
// It deliberately certifies neither financial balances nor unsupported families.
function buildOwnershipIdentityIndex(rawState,sourceScope='player-and-listed-ownership-v2'){
  const includeSubsidiaries=sourceScope===subsidiaryOwnershipScope;
  const scopeValid=includeSubsidiaries||sourceScope==='player-and-listed-ownership-v2';
  const captured=captureListedSources(rawState,true,includeSubsidiaries),source=captured.source;
  if(!scopeValid)captured.issues.push(ownershipReason('INPUT_INVALID','$scope'));
  if(source){
    if(typeof source.ticker!=='string'||!source.ticker.trim())captured.issues.push(ownershipReason('INPUT_INVALID','ticker'));
    for(const key of ['companyName','playerName'])if(source[key]!=null&&typeof source[key]!=='string')captured.issues.push(ownershipReason('INPUT_INVALID',key));
    for(const key of ['publicCompany','isCompanySold'])if(source[key]!=null&&typeof source[key]!=='boolean')captured.issues.push(ownershipReason('INPUT_INVALID',key));
  }
  const sourceSnapshotToken=Object.freeze({});
  const index=freezeOwned({authority:'read-only',indexVersion:2,sourceScope:scopeValid?sourceScope:null,sourceSnapshotToken,issues:captured.issues});
  const listed=freezeOwned({...projectExternalListedHoldings(source),sourceSnapshotToken});
  commonOwnershipIndexes.set(index,{rawState,source:freezeOwned(source),listed,includeSubsidiaries});
  return index;
}
function projectOwnershipSnapshot(rawState,identityIndex){
  const index=identityIndex===undefined?buildOwnershipIdentityIndex(rawState):identityIndex;
  const indexed=commonOwnershipIndexes.get(index),current=captureListedSources(rawState,true,indexed?.includeSubsidiaries);
  const result={authority:'read-only',snapshotVersion:2,sourceScope:'player-and-listed-ownership-v2',sourceSnapshotToken:null,
    complete:false,commandEligible:false,wealthComplete:false,entities:[],classes:[],positions:[],listingObservations:[],sourceReplacements:[],issues:[],
    coverage:[{family:'player-and-listed',status:'invalid'},...['subsidiary-ma','pe','vc','control-ladder','founder-wealth'].map(family=>({family,status:'not-implemented'}))]};
  if(!indexed||indexed.rawState!==rawState||current.issues.length||!sameListedSources(indexed.source,current.source)){
    result.issues.push(...current.issues,ownershipReason('STALE_EVIDENCE','$'));return freezeOwned(result);
  }
  result.sourceSnapshotToken=index.sourceSnapshotToken;
  result.sourceScope=index.sourceScope;
  if(index.issues.length){result.issues.push(...index.issues);return freezeOwned(result);}
  const state=indexed.source,listed=indexed.listed;
  if(listed.issues.some(row=>row.code==='INPUT_INVALID')){
    result.issues.push(...listed.issues);return freezeOwned(result);
  }
  result.listingObservations=observeOwnershipListings(state,listed);
  // Only a source explicitly delegated by P3-5 may enter the legacy own bucket.
  // A reused ticker or conflicting IPO alias stays a separate unresolved asset.
  const ownPath=`personalStocks[${JSON.stringify(state.ticker)}]`;
  const delegated=listed.sourceCoverage.some(row=>row.path===ownPath&&row.status==='delegated');
  const ownRetained=listed.positions.some(row=>row.accountKind==='personal'&&row.instrumentAlias===state.ticker);
  const playerState={...state};
  if(ownRetained){playerState.personalStocks={...state.personalStocks};delete playerState.personalStocks[state.ticker];}
  const player=ownershipReconciliation(playerState);
  const generationProven=state.currentCompanySerial===1&&state.isCompanySold!==true;
  const bound=player.ok&&generationProven&&!ownRetained;
  const positionId='position:player-company:founder';
  const founderSources=player.sourceHoldings.filter(row=>row.sourcePath!==null);
  const sourceRefs=founderSources.map(row=>({path:row.sourceLot==='legacy-founderShares-bucket'?'founderShares':ownPath,durableId:null,family:'player',role:'current'}));
  const reasons=[];
  if(!generationProven)reasons.push(ownershipReason('GENERATION_UNPROVEN','currentCompanySerial'));
  if(ownRetained)reasons.push(ownershipReason('ALIAS_BINDING_UNPROVEN',ownPath));
  if(!player.ok)reasons.push(ownershipReason('PLAYER_RECONCILIATION_FAILED','founderShares'));
  const holder={entityId:FOUNDER_ENTITY_ID,generation:null,identityStatus:'proven',sourceRefs};
  const issuer={entityId:PLAYER_COMPANY_ENTITY_ID,generation:null,identityStatus:bound?'source-scoped':'unresolved',sourceRefs};
  result.positions=[{positionId,ownershipKey:null,issuer,securityClassId:bound?PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID:null,
    registeredHolder:holder,beneficialOwner:holder,accountKind:'personal',assetRole:bound?'founder-equity':'unresolved',
    quantity:{status:player.beneficialHoldings[0].quantity===null?'invalid':'known',value:player.beneficialHoldings[0].quantity,sourceRefs,reasons},
    // This slice supplies evidence only, including for the proven player class.
    economicFraction:{status:'unknown',value:null,sourceRefs,reasons:[]},votingUnits:{status:'unknown',value:null,sourceRefs,reasons:[]},sourceRefs,reasons},...listed.positions];
  result.entities=[holder,issuer,...listed.entities.filter(row=>![FOUNDER_ENTITY_ID,PLAYER_COMPANY_ENTITY_ID].includes(row.entityId))];
  if(bound)result.classes=player.securityClasses;
  for(const ref of sourceRefs)result.sourceReplacements.push({sourcePath:ref.path,positionId,resolvedByAdapter:'ownershipReconciliation'});
  for(const position of listed.positions)result.sourceReplacements.push({sourcePath:position.sourceRefs[0].path,positionId:position.positionId,resolvedByAdapter:'projectExternalListedHoldings'});
  result.issues=[...listed.issues,...reasons,...player.issues.map(row=>ownershipReason(row.reason,row.sourcePath)),...result.listingObservations.flatMap(row=>row.reasons)];
  result.coverage[0]={family:'player-and-listed',status:result.issues.length?'partial':'observed',personalOwnLot:delegated?'delegated':ownRetained?'retained-unresolved':'absent'};
  return freezeOwned(result);
}

// P3-7 first slice: legacy direct economic interests, never fund assets or votes.
function projectPEOwnership(rawState,identityIndex){
  const index=identityIndex===undefined?buildOwnershipIdentityIndex(rawState,subsidiaryOwnershipScope):identityIndex;
  const indexed=commonOwnershipIndexes.get(index),captured=captureListedSources(rawState,true,true);
  const result={authority:'read-only',adapterVersion:1,complete:false,commandEligible:false,wealthComplete:false,
    sourceScope:subsidiaryOwnershipScope,sourceSnapshotToken:null,entities:[],classes:[],positions:[],relationships:[],
    aliasReplacements:[],unresolved:[],issues:[],fundInterests:[],portfolioParticipations:[],managementRelationships:[],distributionEvidence:[],
    sourceCoverage:[{path:'peFirm',status:'not-implemented'},{path:'fund-parent-conversions',status:'not-implemented'},{path:'valuation',status:'not-implemented'}]};
  if(!indexed||indexed.rawState!==rawState||!indexed.includeSubsidiaries||!sameListedSources(indexed.source,captured.source)){
    result.issues.push(ownershipReason('STALE_EVIDENCE','$'));return freezeOwned(result);
  }
  result.sourceSnapshotToken=index.sourceSnapshotToken;
  if(index.issues.length||captured.issues.length){result.issues.push(...index.issues,...captured.issues);return freezeOwned(result);}
  const state=indexed.source,validId=x=>typeof x==='string'&&x.trim().length>0;
  const validFraction=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
  const encode=x=>encodeURIComponent(x).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const ref=(path,id,family,role='current')=>({path,durableId:validId(id)?id:null,family,role});
  const rows=new Map(),dealIds=new Map(),dealMirrorClaims=new Map(),subIds=new Map(),subClaims=new Map(),entities=new Map();
  const add=(map,key,item)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(item);};
  for(const family of ['peDeals','subsidiaries','maSubsidiaries','overseasSubsidiaries']){
    const source=state[family];rows.set(family,[]);
    if(source===undefined){result.sourceCoverage.push({path:family,status:'absent-optional'});continue;}
    if(!Array.isArray(source)){result.issues.push(ownershipReason('INPUT_INVALID',family));continue;}
    result.sourceCoverage.push({path:family,status:'observed'});
    source.forEach((row,i)=>{
      const item={row,path:`${family}[${i}]`,family};
      if(!plainOwnershipObject(row)){result.issues.push(ownershipReason('INPUT_INVALID',item.path));return;}
      rows.get(family).push(item);
      if(family==='peDeals'){
        if(validId(row.id))add(dealIds,row.id,item);
        if(validId(row.subsidiaryID))add(dealMirrorClaims,row.subsidiaryID,item);
      }
      else {
        if(validId(row.id))add(subIds,row.id,item);
        // A malformed subsidiary ID must still contradict its claimed PE link.
        if(Object.hasOwn(row,'peDealID'))add(subClaims,row.peDealID,item);
      }
    });
  }
  if(result.issues.length)return freezeOwned(result);
  const entity=(id,status,sourceRefs)=>({entityId:id,generation:null,identityStatus:status,sourceRefs});
  for(const item of rows.get('peDeals')){
    const {row,path}=item,reasons=[],sourceRefs=[ref(path,row.id,'pe-direct')];
    const reason=(code,p=path)=>reasons.push(ownershipReason(code,p));
    const idValid=validId(row.id),idUnique=idValid&&dealIds.get(row.id).length===1;
    if(!idValid)reason('IDENTITY_UNPROVEN');else if(!idUnique)reason('ID_COLLISION');
    const claims=idValid?(subClaims.get(row.id)||[]):[];
    if(row.status==='exited'){
      result.sourceCoverage.push({path,status:'historical'});
      if(claims.length){reason('ALIAS_CONFLICT');result.unresolved.push({sourceRefs,reasons});result.issues.push(...reasons);}
      continue;
    }
    if(row.status!=='active')reason('LIFECYCLE_UNPROVEN');
    const ownerKnown=row.ownerAccount==='personal'||row.ownerAccount==='company';
    if(!ownerKnown)reason('OWNER_UNKNOWN',`${path}.ownerAccount`);
    if(!validFraction(row.ownershipRatio))reason('FRACTION_INVALID',`${path}.ownershipRatio`);
    const company=row.ownerAccount==='company';
    const companyGenerationProven=state.currentCompanySerial===1&&state.isCompanySold===false;
    if(company&&!companyGenerationProven)reason('GENERATION_UNPROVEN','currentCompanySerial');
    let mirror=null;
    if(company){
      const matches=validId(row.subsidiaryID)?subIds.get(row.subsidiaryID)||[]:[];
      mirror=claims.length===1&&matches.length===1&&claims[0]===matches[0]?matches[0]:null;
      const m=mirror?.row;
      if((dealMirrorClaims.get(row.subsidiaryID)||[]).length!==1||!mirror||mirror.family!=='subsidiaries'||m.status!=='active'||m.peDealID!==row.id||m.ownership!==row.ownershipRatio
        ||(Object.hasOwn(m,'source')&&m.source!=='pe')
        ||['startupID','internalVentureID','sourceCompetitorID','sourcePEFundID','sourcePEDealID','restructuredFrom','restructuredWeek'].some(key=>Object.hasOwn(m,key)))reason('ALIAS_CONFLICT');
    }else if(claims.length||Object.hasOwn(row,'subsidiaryID'))reason('ALIAS_CONFLICT');
    const accepted=reasons.length===0;
    if(accepted&&mirror)sourceRefs.push(ref(mirror.path,mirror.row.id,'subsidiary','alias'));
    const issuer=entity(idUnique?`entity:company:pe-direct:${encode(row.id)}`:null,idUnique?'source-scoped':'unresolved',sourceRefs);
    const accountKind=ownerKnown?row.ownerAccount:'unknown';
    const holder=entity(ownerKnown?(company?PLAYER_COMPANY_ENTITY_ID:FOUNDER_ENTITY_ID):null,ownerKnown?(company?(companyGenerationProven?'source-scoped':'unresolved'):'proven'):'unresolved',[sourceRefs[0]]);
    const unknown=code=>({status:'unknown',value:null,sourceRefs,reasons:[ownershipReason(code,path)]});
    const positionId=idUnique?`position:pe-direct:${encode(row.id)}`:null;
    const position={positionId,ownershipKey:null,issuer,securityClassId:null,registeredHolder:holder,beneficialOwner:holder,accountKind,
      assetRole:accepted?'economic-interest':'unresolved',quantity:unknown('QUANTITY_UNKNOWN'),votingUnits:unknown('RIGHTS_UNKNOWN'),
      economicFraction:{status:accepted?'known':'unknown',value:accepted?row.ownershipRatio:null,sourceRefs,reasons},
      sourceRefs,reasons,sourceDealID:idValid?row.id:null};
    result.positions.push(position);
    if(!accepted)result.unresolved.push({positionId,sourceRefs,reasons});
    else if(mirror)result.aliasReplacements.push({sourcePath:mirror.path,positionId,sourceDealID:row.id,resolvedByAdapter:'projectPEOwnership'});
    for(const e of [issuer,holder])if(e.entityId!==null)entities.set(e.entityId,e);
    result.issues.push(...reasons);
  }
  result.positions.sort((a,b)=>compareText(a.sourceDealID,b.sourceDealID)||compareText(a.accountKind,b.accountKind));
  result.entities=Array.from(entities.values()).sort((a,b)=>compareText(a.entityId,b.entityId));
  result.issues.sort((a,b)=>compareText(a.path,b.path)||compareText(a.code,b.code));
  return freezeOwned(result);
}

// P3-6 first slice: direct source evidence only; no canonical asset composition.
function projectSubsidiaryRelationships(rawState,identityIndex){
  const index=identityIndex===undefined?buildOwnershipIdentityIndex(rawState,subsidiaryOwnershipScope):identityIndex;
  const indexed=commonOwnershipIndexes.get(index),captured=captureListedSources(rawState,true,true);
  const result={authority:'read-only',adapterVersion:1,complete:false,commandEligible:false,sourceSnapshotToken:null,
    sourceScope:subsidiaryOwnershipScope,entities:[],classes:[],positions:[],relationships:[],unresolved:[],issues:[],sourceCoverage:[{path:'canonical-pe-vc-composition',status:'not-implemented'},{path:'indirect-economic-paths',status:'not-implemented'}]};
  if(!indexed||indexed.rawState!==rawState||!indexed.includeSubsidiaries||!sameListedSources(indexed.source,captured.source)){
    result.issues.push(ownershipReason('STALE_EVIDENCE','$'));return freezeOwned(result);
  }
  result.sourceSnapshotToken=index.sourceSnapshotToken;
  if(index.issues.length||captured.issues.length){result.issues.push(...index.issues,...captured.issues);return freezeOwned(result);}
  const state=indexed.source,validId=value=>typeof value==='string'&&value.trim().length>0;
  const validFraction=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
  const validWeek=value=>Number.isSafeInteger(value)&&value>0;
  const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const roots=new Map(),ids=new Map(),claims=new Map(),stableKeys=new Map(),blocked=new Set();
  const add=(map,key,value)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(value);};
  const ref=(path,id,family,role='current')=>({path,durableId:validId(id)?id:null,family,role});
  for(const family of subsidiaryOwnershipRoots){
    const rows=[],map=new Map();
    if(!Object.hasOwn(state,family)){result.sourceCoverage.push({path:family,status:'absent-optional'});roots.set(family,{rows,map});continue;}
    if(!Array.isArray(state[family])){result.issues.push(ownershipReason('INPUT_INVALID',family));result.sourceCoverage.push({path:family,status:'invalid'});roots.set(family,{rows,map});continue;}
    result.sourceCoverage.push({path:family,status:'observed'});
    state[family].forEach((row,i)=>{
      const path=`${family}[${i}]`;
      if(!plainOwnershipObject(row)){result.issues.push(ownershipReason('INPUT_INVALID',path));return;}
      const item={row,path,family};rows.push(item);
      const stableKey=family==='maDealRooms'?row.targetStableKey:row.maStableKey;
      if(validId(stableKey))add(stableKeys,`${family}:${JSON.stringify(stableKey)}`,item);
      if(validId(row.id))add(map,row.id,item);else result.issues.push(ownershipReason('INPUT_INVALID',`${path}.id`));
      if(['subsidiaries','maSubsidiaries','overseasSubsidiaries'].includes(family)){
        if(validId(row.id))add(ids,row.id,item);
        // A restructuring replacement inherits old alias fields; never follow them.
        if(Object.hasOwn(row,'restructuredFrom'))return;
        for(const key of ['startupID','peDealID','internalVentureID','sourceCompetitorID','acquisitionDealID','sourcePEDealID']){
          if(Object.hasOwn(row,key))add(claims,`${key}:${JSON.stringify(row[key])}`,item);
        }
      }
    });roots.set(family,{rows,map});
  }
  // An invalid source inventory may hide another claimant. Do not repair it.
  if(result.issues.some(row=>row.code==='INPUT_INVALID'))return freezeOwned(result);
  const activeIds=new Set(),blockedSourceIds=new Set();
  for(const family of ['subsidiaries','maSubsidiaries','overseasSubsidiaries'])for(const item of roots.get(family).rows){
    if(item.row.status==='active')activeIds.add(item.row.id);
  }
  for(const family of ['subsidiaries','maSubsidiaries','overseasSubsidiaries'])for(const item of roots.get(family).rows){
    if(Object.hasOwn(item.row,'restructuredFrom')&&Array.isArray(item.row.restructuredFrom)){
      for(const id of item.row.restructuredFrom)if(activeIds.has(id)){blocked.add(item);blockedSourceIds.add(id);}
    }
  }
  for(const family of ['subsidiaries','maSubsidiaries','overseasSubsidiaries'])for(const item of roots.get(family).rows){
    if(blockedSourceIds.has(item.row.id))blocked.add(item);
  }
  const generationKnown=state.currentCompanySerial===1&&state.isCompanySold===false;
  const entityMap=new Map();
  const entity=(entityId,status,sourceRefs)=>({entityId,generation:null,identityStatus:status,sourceRefs});
  for(const family of ['subsidiaries','maSubsidiaries','overseasSubsidiaries']){
    for(const item of roots.get(family).rows){
      const {row,path}=item,reasons=[],sourceRefs=[ref(path,row.id,family)];
      const reason=(code,where=path)=>reasons.push(ownershipReason(code,where));
      const historical=['sold','liquidated','exited','inactive','written-off'].includes(row.status);
      const active=row.status==='active';
      const observed=validFraction(row.ownership)?row.ownership:null;
      let sound=(ids.get(row.id)||[]).length===1&&!blocked.has(item),fraction=observed;
      let childId=`entity:company:${family==='subsidiaries'?'subsidiary':family==='maSubsidiaries'?'ma':'overseas'}:${encode(row.id)}`;
      let aliasOf=null,canonicalFamily=null;
      if(!sound)reason('ALIAS_CONFLICT');
      if(!generationKnown)reason('GENERATION_UNPROVEN','currentCompanySerial');
      if(!active&&!historical)reason('RELATIONSHIP_STATUS_UNKNOWN',`${path}.status`);
      if(family==='overseasSubsidiaries'){
        sound=false;reason('ISSUER_FAMILY_UNSUPPORTED');
      }else if(Object.hasOwn(row,'restructuredFrom')){
        sound=false;reason('ISSUER_FAMILY_UNSUPPORTED');
        if(!Array.isArray(row.restructuredFrom)||row.restructuredFrom.length<2||row.restructuredFrom.some(id=>!validId(id))||new Set(row.restructuredFrom).size!==row.restructuredFrom.length)reason('ALIAS_CONFLICT');
      }else if(family==='maSubsidiaries'){
        const matches=roots.get('maDealRooms').map.get(row.acquisitionDealID)||[],deal=matches[0]?.row;
        const unique=(claims.get(`acquisitionDealID:${JSON.stringify(row.acquisitionDealID)}`)||[]).length===1;
        const stableUnique=(stableKeys.get(`maSubsidiaries:${JSON.stringify(row.maStableKey)}`)||[]).length===1
          &&(stableKeys.get(`maDealRooms:${JSON.stringify(row.maStableKey)}`)||[]).length===1
          &&!(stableKeys.get(`acquisitionTargets:${JSON.stringify(row.maStableKey)}`)||[]).length;
        const whole=matches.length===1&&unique&&stableUnique&&deal.status==='acquired'&&deal.targetID===row.id
          &&validId(deal.targetStableKey)&&deal.targetStableKey===row.maStableKey&&validWeek(deal.closedWeek)&&deal.closedWeek===row.acquiredWeek
          &&plainOwnershipObject(deal.acceptedTerms)&&['friendly','shareSwap','hostile'].includes(deal.acceptedTerms.method)
          &&deal.acceptedTerms.method===row.acquisitionMethod&&(row.ownership==null||row.ownership===1)&&!roots.get('acquisitionTargets').map.has(row.id);
        if(whole){sourceRefs.push(ref(matches[0].path,deal.id,'ma','historical'));fraction=1;}
        else {sound=false;reason(matches.length>1||!unique||!stableUnique?'ALIAS_CONFLICT':'IDENTITY_UNPROVEN');}
      }else{
        const aliasKeys=['startupID','peDealID','internalVentureID','sourceCompetitorID','sourcePEDealID'].filter(key=>Object.hasOwn(row,key));
        if(aliasKeys.length>1){sound=false;reason('ALIAS_CONFLICT');}
        for(const key of aliasKeys){
          const id=row[key];
          if(!validId(id)||(claims.get(`${key}:${JSON.stringify(id)}`)||[]).length!==1){sound=false;reason('ALIAS_CONFLICT',`${path}.${key}`);continue;}
          if(key==='internalVentureID'){
            const links=roots.get('internalVentures').map.get(id)||[],venture=links[0]?.row;
            if(links.length!==1||venture.status!=='spun-off'||venture.spunOffSubsidiaryID!==row.id){sound=false;reason('ALIAS_CONFLICT');}
            else {sourceRefs.push(ref(links[0].path,id,'internal-venture','historical'));}
          }else if(key==='sourceCompetitorID'){
            sourceRefs.push(ref(`${path}.sourceCompetitorID`,id,'competitor','historical'));
          }else{
            // Canonical PE/VC source adapters are separate prerequisites, not guessed here.
            canonicalFamily=key==='startupID'?'vc':'pe';aliasOf={family:canonicalFamily,sourceId:id};
            if(key==='startupID'||key==='peDealID'){
              const links=roots.get(key==='startupID'?'startups':'peDeals').map.get(id)||[],underlying=links[0]?.row;
              const agrees=links.length===1&&(key==='startupID'
                ?validFraction(underlying.ownedCompany)&&underlying.ownedCompany===fraction
                :underlying.ownerAccount==='company'&&underlying.status==='active'&&underlying.subsidiaryID===row.id&&validFraction(underlying.ownershipRatio)&&underlying.ownershipRatio===fraction);
              if(!agrees)reason('ALIAS_CONFLICT');else sourceRefs.push(ref(links[0].path,id,canonicalFamily,'alias'));
            }
            sound=false;reason('ISSUER_FAMILY_UNSUPPORTED',`${path}.${key}`);
          }
        }
        if(Object.hasOwn(row,'sourcePEFundID')){sound=false;canonicalFamily='pe';reason('ISSUER_FAMILY_UNSUPPORTED',`${path}.sourcePEFundID`);}
        if((row.source==='pe'&&!Object.hasOwn(row,'peDealID'))||(row.source==='internalVenture'&&!Object.hasOwn(row,'internalVentureID'))){sound=false;reason('IDENTITY_UNPROVEN');}
      }
      const observedStatus=observed!==null?'known':row.ownership==null?'unknown':'invalid';
      if(fraction===null)reason(observedStatus==='invalid'?'ECONOMIC_FRACTION_INVALID':'ECONOMIC_FRACTION_UNKNOWN',`${path}.ownership`);
      if(!sound)childId=null;
      reason('CLASS_UNKNOWN');reason('RIGHTS_UNKNOWN');
      const parent=entity(PLAYER_COMPANY_ENTITY_ID,generationKnown?'source-scoped':'unresolved',sourceRefs);
      const child=entity(childId,childId===null?'unresolved':'source-scoped',sourceRefs);
      const known=sound&&generationKnown&&active&&fraction!==null;
      const status=historical?'historical':known?'observed':'unresolved';
      if(historical)for(const source of sourceRefs)source.role='historical';
      const relationship={edgeId:(ids.get(row.id)||[]).length===1?`relationship:${family}:${encode(row.id)}`:null,
        parentEntityId:parent.entityId,childEntityId:child.entityId,beneficialOwnerEntityId:parent.entityId,parent,child,
        kind:'direct',status,isCurrent:known,sourceStatus:typeof row.status==='string'?row.status:null,aliasOf,canonicalFamily,
        economicFraction:{status:known?'known':'unknown',value:known?fraction:null,sourceRefs,reasons:known?[]:reasons},
        observedFraction:{status:observedStatus,value:observed,sourceRefs,reasons:observedStatus==='known'?[]:[ownershipReason(observedStatus==='invalid'?'ECONOMIC_FRACTION_INVALID':'ECONOMIC_FRACTION_UNKNOWN',`${path}.ownership`)]},
        votingFraction:null,securityClassId:null,ownershipKey:null,assetRole:historical?'historical':aliasOf?'alias':known?'relationship-only':'unresolved',
        sourceRefs,reasons};
      result.relationships.push(relationship);result.issues.push(...reasons);
      if(!known)result.unresolved.push({edgeId:relationship.edgeId,sourceRefs,reasons});
      entityMap.set(PLAYER_COMPANY_ENTITY_ID,parent);if(childId!==null)entityMap.set(childId,child);
    }
  }
  result.entities=Array.from(entityMap.values()).sort((a,b)=>compareText(a.entityId,b.entityId));
  result.relationships.sort((a,b)=>compareText(a.edgeId||'',b.edgeId||'')||compareText(a.sourceRefs[0].path,b.sourceRefs[0].path));
  result.issues.sort((a,b)=>compareText(a.path,b.path)||compareText(a.code,b.code));
  return freezeOwned(result);
}

// Opt-in composition. Hierarchy links reference economic positions, never add assets.
function projectSubsidiaryOwnershipSnapshot(rawState,identityIndex){
  const index=identityIndex===undefined?buildOwnershipIdentityIndex(rawState,subsidiaryOwnershipScope):identityIndex;
  const indexed=commonOwnershipIndexes.get(index),captured=captureListedSources(rawState,true,true);
  const empty={authority:'read-only',snapshotVersion:3,sourceScope:subsidiaryOwnershipScope,sourceSnapshotToken:null,
    complete:false,commandEligible:false,wealthComplete:false,entities:[],classes:[],positions:[],listingObservations:[],
    relationships:[],sourceReplacements:[],relationshipReplacements:[],unresolved:[],issues:[],
    coverage:[{family:'subsidiary-ma',status:'invalid'},{family:'vc',status:'not-implemented'},{family:'pe-fund',status:'not-implemented'}]};
  if(!indexed||indexed.rawState!==rawState||!indexed.includeSubsidiaries||!sameListedSources(indexed.source,captured.source)){
    empty.issues.push(ownershipReason('STALE_EVIDENCE','$'));return freezeOwned(empty);
  }
  empty.sourceSnapshotToken=index.sourceSnapshotToken;
  if(index.issues.length||captured.issues.length){empty.issues.push(...index.issues,...captured.issues);return freezeOwned(empty);}
  const listed=projectOwnershipSnapshot(rawState,index),subs=projectSubsidiaryRelationships(rawState,index),pe=projectPEOwnership(rawState,index);
  const result={...listed,snapshotVersion:3,relationships:[],relationshipReplacements:[],unresolved:[],
    positions:[...listed.positions],sourceReplacements:[...listed.sourceReplacements],issues:[...listed.issues,...pe.issues],
    adapterCoverage:[{adapter:'projectSubsidiaryRelationships',sourceCoverage:subs.sourceCoverage},{adapter:'projectPEOwnership',sourceCoverage:pe.sourceCoverage}],
    coverage:[...listed.coverage.filter(row=>!['subsidiary-ma','pe'].includes(row.family)),
      {family:'subsidiary-ma',status:'partial'},{family:'pe-direct',status:'partial'},
      {family:'pe-fund',status:'not-implemented'},{family:'indirect-economic-paths',status:'not-implemented'}]};
  const bySource=new Map(subs.relationships.map(row=>[row.sourceRefs[0].path,row]));
  const positions=new Map(pe.positions.filter(row=>row.positionId!==null).map(row=>[row.positionId,row]));
  const accepted=new Map(),blocked=new Map();
  const allowed=new Set(['CLASS_UNKNOWN','RIGHTS_UNKNOWN','ISSUER_FAMILY_UNSUPPORTED']);
  for(const alias of pe.aliasReplacements){
    const row=bySource.get(alias.sourcePath),position=positions.get(alias.positionId);
    const sound=row&&position&&row.aliasOf?.family==='pe'&&row.aliasOf.sourceId===alias.sourceDealID
      &&position.sourceDealID===alias.sourceDealID&&position.accountKind==='company'
      &&position.assetRole==='economic-interest'&&position.economicFraction.status==='known'
      &&row.observedFraction.status==='known'&&row.observedFraction.value===position.economicFraction.value
      &&row.sourceStatus==='active'&&!row.reasons.some(reason=>!allowed.has(reason.code));
    if(sound)accepted.set(alias.sourcePath,position);
    else blocked.set(alias.positionId,row?.reasons.filter(reason=>!allowed.has(reason.code))||[ownershipReason('ALIAS_CONFLICT',alias.sourcePath)]);
  }
  for(const position of pe.positions){
    if(position.positionId!==null)result.sourceReplacements.push({sourcePath:position.sourceRefs[0].path,positionId:position.positionId,resolvedByAdapter:'projectPEOwnership'});
    if(!blocked.has(position.positionId)){result.positions.push(position);continue;}
    const reasons=[...position.reasons,...blocked.get(position.positionId),ownershipReason('ALIAS_CONFLICT',position.sourceRefs[0].path)];
    result.positions.push({...position,assetRole:'unresolved',economicFraction:{...position.economicFraction,status:'unknown',value:null,reasons},reasons});
    result.issues.push(...reasons);
  }
  for(const row of subs.relationships){
    const sourcePath=row.sourceRefs[0].path,position=accepted.get(sourcePath);
    if(!position||blocked.has(position.positionId)){
      result.relationships.push(row);result.issues.push(...row.reasons);continue;
    }
    const sourceRefs=position.sourceRefs;
    const edge={...row,edgeId:`relationship:${position.positionId}`,parentEntityId:position.registeredHolder.entityId,
      childEntityId:position.issuer.entityId,beneficialOwnerEntityId:position.beneficialOwner.entityId,
      parent:position.registeredHolder,child:position.issuer,aliasOf:null,canonicalFamily:'pe-direct',
      canonicalPositionId:position.positionId,status:'observed',isCurrent:true,assetRole:'relationship-only',
      economicFraction:{...position.economicFraction,sourceRefs},sourceRefs,
      reasons:row.reasons.filter(reason=>reason.code==='CLASS_UNKNOWN'||reason.code==='RIGHTS_UNKNOWN')};
    result.relationships.push(edge);result.issues.push(...edge.reasons);
    result.relationshipReplacements.push({sourcePath,edgeId:edge.edgeId,canonicalPositionId:position.positionId,resolvedByAdapter:'projectPEOwnership'});
  }
  // Retain errors not associated with a relationship, such as malformed inventories.
  const rowReasons=new Set(subs.relationships.flatMap(row=>row.reasons));
  result.issues.push(...subs.issues.filter(reason=>!rowReasons.has(reason)));
  const entities=new Map(),rank={unresolved:0,'source-scoped':1,proven:2};
  for(const entity of [...listed.entities,...subs.entities,...pe.entities]){
    if(entity.entityId===null)continue;
    const old=entities.get(entity.entityId);
    if(!old){entities.set(entity.entityId,entity);continue;}
    const refs=new Map([...old.sourceRefs,...entity.sourceRefs].map(ref=>[JSON.stringify(ref),ref]));
    entities.set(entity.entityId,{...old,identityStatus:rank[old.identityStatus]<=rank[entity.identityStatus]?old.identityStatus:entity.identityStatus,
      sourceRefs:Array.from(refs.values()).sort((a,b)=>compareText(a.path,b.path)||compareText(a.role,b.role))});
  }
  result.entities=Array.from(entities.values()).sort((a,b)=>compareText(a.entityId,b.entityId));
  result.relationships.sort((a,b)=>compareText(a.edgeId||'',b.edgeId||'')||compareText(a.sourceRefs[0].path,b.sourceRefs[0].path));
  result.relationshipReplacements.sort((a,b)=>compareText(a.sourcePath,b.sourcePath));
  const unresolved=[...pe.unresolved,...result.relationships.filter(row=>!row.isCurrent).map(row=>({edgeId:row.edgeId,sourceRefs:row.sourceRefs,reasons:row.reasons})),
    ...result.positions.filter(row=>row.assetRole==='unresolved').map(row=>({positionId:row.positionId,sourceRefs:row.sourceRefs,reasons:row.reasons}))];
  result.unresolved=Array.from(new Map(unresolved.map(row=>[JSON.stringify([row.positionId,row.edgeId,row.sourceRefs[0]?.path]),row])).values());
  result.issues.sort((a,b)=>compareText(a.path,b.path)||compareText(a.code,b.code));
  return freezeOwned(result);
}

// Market rows are observations, not a shareholder register or a valuation writer.
function observeOwnershipListings(state,listed){
  const aliases=new Map(),issuerCandidates=new Map();
  for(const position of listed.positions){
    if(position.issuer.entityId===null)continue;
    if(!issuerCandidates.has(position.instrumentAlias))issuerCandidates.set(position.instrumentAlias,new Set());
    issuerCandidates.get(position.instrumentAlias).add(position.issuer.entityId);
  }
  for(const [i,row] of (state.market||[]).entries()){
    if(!aliases.has(row.id))aliases.set(row.id,[]);
    aliases.get(row.id).push({row,path:`market[${i}]`});
  }
  return Array.from(aliases.keys()).sort(compareText).map(alias=>{
    const matches=aliases.get(alias),unique=matches.length===1,refs=matches.map(item=>({path:item.path,durableId:alias,family:'listed',role:'current'}));
    const reasons=[];
    if(!unique)reasons.push(ownershipReason('ALIAS_CONFLICT',refs[0].path));
    const row=matches[0].row;
    function numeric(field){
      const value=row[field],path=`${matches[0].path}.${field}`;
      const valid=typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
      const status=!unique?'unknown':value===undefined||value===null?'unknown':valid?'known':'invalid';
      const code=field==='issuedShares'?'DENOMINATOR_UNKNOWN':'PRICE_UNKNOWN';
      const errors=status==='known'?[]:[ownershipReason(status==='invalid'?'OBSERVATION_OUT_OF_ENVELOPE':code,path)];
      reasons.push(...errors);
      return {status,value:status==='known'?value:null,sourceRefs:refs,reasons:errors};
    }
    const issuerIds=issuerCandidates.get(alias);
    const issuerEntityId=unique&&issuerIds?.size===1?issuerIds.values().next().value:null;
    if(issuerEntityId===null)reasons.push(ownershipReason('IDENTITY_UNPROVEN',refs[0].path));
    const unknown=code=>({status:'unknown',value:null,sourceRefs:refs,reasons:[ownershipReason(code,refs[0].path)]});
    const statusValid=[row.privateCompany,row.suspended].every(value=>value===undefined||value===null||typeof value==='boolean');
    if(!statusValid)reasons.push(ownershipReason('INPUT_INVALID',refs[0].path));
    return {instrumentAlias:alias,issuerEntityId,securityClassId:null,
      listingStatus:unique&&statusValid?(row.privateCompany===true?'private':row.suspended===true?'suspended':'observed'):'unknown',
      issued:numeric('issuedShares'),price:numeric('price'),treasury:unknown('TREASURY_UNKNOWN'),outstanding:unknown('DENOMINATOR_UNKNOWN'),
      rightsStatus:'unknown',sourceRefs:refs,reasons};
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
  buildOwnershipIdentityIndex,
  projectOwnershipSnapshot,
  projectSubsidiaryRelationships,
  projectPEOwnership,
  projectSubsidiaryOwnershipSnapshot,
  buildListedHoldingsIdentityIndex,
  projectExternalListedHoldings,
  ownershipProjection,
  ownershipReconciliation,
  compareLegacyParity
});
})();
