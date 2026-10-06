// Script boundary: js/economic-operation.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before economic-operation.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.economicOperation)throw new Error('Capitalism Tycoon economicOperation module is already registered.');
(function(exports){
const SCHEMA_VERSION=1;
const ACCOUNT_TAXONOMY_VERSION=1;
const LEGAL_ENTITY_KINDS=Object.freeze(['person','company','fund','propertyVehicle','bank','trustOrEstate']);
const EXTERNAL_ENTITY_IDS=Object.freeze({
  customerMarket:'external:customer-market',
  supplier:'external:supplier',
  employee:'external:employee',
  governmentTax:'external:government-tax',
  shareholder:'external:shareholder',
  lender:'external:lender',
  buyer:'external:buyer',
  seller:'external:seller',
  lpCoinvestor:'external:lp-coinvestor',
  clearingSettlement:'external:clearing-settlement'
});
const ACCOUNT_TAXONOMY=Object.freeze({
  version:ACCOUNT_TAXONOMY_VERSION,
  assets:Object.freeze([
    'asset:cash','asset:restricted-cash','asset:escrow-cash','asset:accounts-receivable',
    'asset:inventory','asset:fixed-assets','asset:intangible-assets','asset:goodwill',
    'asset:security-investment','asset:debt-receivable','asset:property'
  ]),
  liabilities:Object.freeze([
    'liability:accounts-payable','liability:accrued-expense','liability:tax-payable',
    'liability:debt-principal','liability:accrued-interest'
  ]),
  equity:Object.freeze([
    'equity:share-capital','equity:additional-paid-in-capital','equity:retained-earnings',
    'equity:treasury-stock','equity:dividend-distribution'
  ]),
  income:Object.freeze(['income:revenue','income:interest','income:investment','income:other']),
  expenses:Object.freeze(['expense:operating','expense:interest','expense:tax','expense:depreciation']),
  fund:Object.freeze(['fund:capital','fund:return-of-capital','fund:preferred-return','fund:carry']),
  elimination:Object.freeze(['elimination:intercompany'])
});
const ACCOUNT_IDS=Object.freeze(Object.entries(ACCOUNT_TAXONOMY)
  .filter(([key])=>key!=='version')
  .flatMap(([,ids])=>ids));
const ACCOUNT_ID_SET=new Set(ACCOUNT_IDS);
const EXTERNAL_ENTITY_ID_SET=new Set(Object.values(EXTERNAL_ENTITY_IDS));
const POSITION_REFERENCE_BY_ACCOUNT=Object.freeze({
  'asset:security-investment':Object.freeze(['securityClassId']),
  'asset:debt-receivable':Object.freeze(['debtInstrumentId']),
  'liability:debt-principal':Object.freeze(['debtInstrumentId']),
  'asset:property':Object.freeze(['propertyId']),
  'asset:fixed-assets':Object.freeze(['assetId']),
  'asset:intangible-assets':Object.freeze(['assetId']),
  'equity:share-capital':Object.freeze(['securityClassId']),
  'equity:treasury-stock':Object.freeze(['securityClassId'])
});
const MONEY_MINOR_UNITS=100;
const MAX_SAFE_MONEY_MINOR_UNITS=Number.MAX_SAFE_INTEGER;
const SIDE_SET=new Set(['debit','credit']);
const OPTIONAL_ID_FIELDS=Object.freeze([
  'debtInstrumentId','instrumentId','securityClassId','propertyId','assetId',
  'counterpartyEntityId','counterpartyRole','relationshipId','eliminationKey'
]);
const OPTIONAL_PERIOD_FIELDS=Object.freeze([
  'decisionPeriod','recognitionPeriod','duePeriod','settlementPeriod','effectivePeriod'
]);

function addError(errors,code,path,message){errors.push(Object.freeze({code,path,message}));}
function nonEmptyString(value){return typeof value==='string'&&value.trim().length>0;}
function validateRequiredString(value,path,code,errors){
  if(!nonEmptyString(value))addError(errors,code,path,'must be a non-empty string');
}
function validateOptionalString(value,path,code,errors){
  if(value!=null&&!nonEmptyString(value))addError(errors,code,path,'must be a non-empty string when provided');
}
function validateEntityReference(value,path,requiredCode,errors){
  validateRequiredString(value,path,requiredCode,errors);
  if(nonEmptyString(value)&&value.startsWith('external:')&&!EXTERNAL_ENTITY_ID_SET.has(value)){
    addError(errors,'EXTERNAL_ENTITY_ID_UNKNOWN',path,'external entity ID is not in the approved aggregate counterparty registry');
  }
}
function isPlainJsonObject(value){
  if(value==null||Object.prototype.toString.call(value)!=='[object Object]')return false;
  const proto=Object.getPrototypeOf(value);
  if(proto===null)return true;
  if(Object.getPrototypeOf(proto)!==null)return false;
  if(!Object.prototype.hasOwnProperty.call(proto,'constructor'))return false;
  return typeof proto.constructor==='function'&&proto.constructor.name==='Object';
}
function validateJsonValue(value,path,errors,seen){
  const type=typeof value;
  if(value===null||type==='string'||type==='boolean')return;
  if(type==='number'){
    if(!Number.isFinite(value))addError(errors,'METADATA_NON_FINITE',path,'metadata numbers must be finite');
    return;
  }
  if(type==='undefined'||type==='function'||type==='symbol'||type==='bigint'){
    addError(errors,'METADATA_NOT_JSON_SAFE',path,`metadata value of type ${type} is not JSON-safe`);
    return;
  }
  if(type!=='object'){
    addError(errors,'METADATA_NOT_JSON_SAFE',path,'metadata value is not JSON-safe');
    return;
  }
  if(seen.has(value)){
    addError(errors,'METADATA_CIRCULAR',path,'metadata must not contain circular references');
    return;
  }
  seen.add(value);
  if(Array.isArray(value)){
    for(let i=0;i<value.length;i++)validateJsonValue(value[i],`${path}[${i}]`,errors,seen);
  }else if(isPlainJsonObject(value)){
    for(const key of Object.keys(value))validateJsonValue(value[key],`${path}.${key}`,errors,seen);
  }else{
    addError(errors,'METADATA_NOT_PLAIN_JSON',path,'metadata objects must have Object.prototype or null prototype');
  }
  seen.delete(value);
}
function validateMetadata(value,path,errors){
  if(value==null||Array.isArray(value)||Object.prototype.toString.call(value)!=='[object Object]'){
    addError(errors,'METADATA_REQUIRED',path,'metadata must be a JSON object');
    return;
  }
  if(!isPlainJsonObject(value)){
    addError(errors,'METADATA_NOT_PLAIN_JSON',path,'metadata objects must have Object.prototype or null prototype');
    return;
  }
  validateJsonValue(value,path,errors,new Set());
}
function moneyMinorUnits(value){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;
  const scaled=value*MONEY_MINOR_UNITS;
  if(!Number.isFinite(scaled)||Math.abs(scaled)>MAX_SAFE_MONEY_MINOR_UNITS)return null;
  const rounded=Math.round(scaled);
  if(!Number.isSafeInteger(rounded))return null;
  if(rounded/MONEY_MINOR_UNITS!==value)return null;
  return rounded;
}
function roundMoney(value){
  if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('money must be a finite number');
  const scaled=value*MONEY_MINOR_UNITS;
  if(Math.abs(scaled)>MAX_SAFE_MONEY_MINOR_UNITS)throw new RangeError('money exceeds the cent-exact Number envelope');
  return Math.round(scaled)/MONEY_MINOR_UNITS;
}
function isKnownAccount(accountId){return nonEmptyString(accountId)&&ACCOUNT_ID_SET.has(accountId);}
function validateEntity(entity){
  const errors=[];
  if(!entity||typeof entity!=='object'||Array.isArray(entity)){
    addError(errors,'ENTITY_REQUIRED','entity','entity must be an object');
    return Object.freeze({ok:false,errors:Object.freeze(errors)});
  }
  validateRequiredString(entity.entityId,'entity.entityId','ENTITY_ID_REQUIRED',errors);
  if(!LEGAL_ENTITY_KINDS.includes(entity.legalEntityKind))addError(errors,'ENTITY_KIND_INVALID','entity.legalEntityKind','legalEntityKind is not approved');
  validateRequiredString(entity.legalName,'entity.legalName','ENTITY_NAME_REQUIRED',errors);
  validateRequiredString(entity.status,'entity.status','ENTITY_STATUS_REQUIRED',errors);
  if(!Array.isArray(entity.roles))addError(errors,'ENTITY_ROLES_INVALID','entity.roles','roles must be an array');
  else{
    const seen=new Set();
    for(let i=0;i<entity.roles.length;i++){
      const role=entity.roles[i];
      if(!nonEmptyString(role))addError(errors,'ENTITY_ROLE_INVALID',`entity.roles[${i}]`,'role must be a non-empty string');
      else if(seen.has(role))addError(errors,'ENTITY_ROLE_DUPLICATE',`entity.roles[${i}]`,'role must not be duplicated');
      else seen.add(role);
    }
  }
  validateOptionalString(entity.listingStatus,'entity.listingStatus','ENTITY_LISTING_STATUS_INVALID',errors);
  validateOptionalString(entity.jurisdiction,'entity.jurisdiction','ENTITY_JURISDICTION_INVALID',errors);
  validateMetadata(entity.metadata,'entity.metadata',errors);
  return Object.freeze({ok:errors.length===0,errors:Object.freeze(errors)});
}
function validatePosting(posting,index,operationId,errors,balances,postingIds,sequences){
  const path=`operation.postings[${index}]`;
  if(!posting||typeof posting!=='object'||Array.isArray(posting)){
    addError(errors,'POSTING_REQUIRED',path,'posting must be an object');
    return;
  }
  validateRequiredString(posting.postingId,`${path}.postingId`,'POSTING_ID_REQUIRED',errors);
  if(nonEmptyString(posting.postingId)){
    if(postingIds.has(posting.postingId))addError(errors,'POSTING_ID_DUPLICATE',`${path}.postingId`,'postingId must be unique within an operation');
    postingIds.add(posting.postingId);
  }
  if(posting.operationId!==operationId)addError(errors,'POSTING_OPERATION_MISMATCH',`${path}.operationId`,'posting operationId must match parent operationId');
  if(!Number.isInteger(posting.postingSequence)||posting.postingSequence<0)addError(errors,'POSTING_SEQUENCE_INVALID',`${path}.postingSequence`,'postingSequence must be a non-negative integer');
  else{
    if(sequences.has(posting.postingSequence))addError(errors,'POSTING_SEQUENCE_DUPLICATE',`${path}.postingSequence`,'postingSequence must be unique within an operation');
    sequences.add(posting.postingSequence);
  }
  validateEntityReference(posting.entityId,`${path}.entityId`,'POSTING_ENTITY_REQUIRED',errors);
  if(!isKnownAccount(posting.accountId))addError(errors,'POSTING_ACCOUNT_UNKNOWN',`${path}.accountId`,'accountId is not in the approved taxonomy');

  const hasAmount=Object.prototype.hasOwnProperty.call(posting,'amount');
  const hasQuantity=Object.prototype.hasOwnProperty.call(posting,'quantityDelta');
  if(!hasAmount&&!hasQuantity)addError(errors,'POSTING_EFFECT_REQUIRED',path,'posting must contain amount or quantityDelta');

  if(hasAmount){
    if(typeof posting.amount!=='number'||!Number.isFinite(posting.amount))addError(errors,'POSTING_AMOUNT_NON_FINITE',`${path}.amount`,'amount must be finite');
    else if(posting.amount<0)addError(errors,'POSTING_AMOUNT_NEGATIVE',`${path}.amount`,'amount must be non-negative');
    else{
      const scaled=posting.amount*MONEY_MINOR_UNITS;
      if(!Number.isFinite(scaled)||Math.abs(scaled)>MAX_SAFE_MONEY_MINOR_UNITS||!Number.isSafeInteger(Math.round(scaled))){
        addError(errors,'POSTING_AMOUNT_OUT_OF_ENVELOPE',`${path}.amount`,'amount exceeds the cent-exact Number envelope');
      }else if(Math.round(scaled)/MONEY_MINOR_UNITS!==posting.amount){
        addError(errors,'POSTING_AMOUNT_NOT_QUANTIZED',`${path}.amount`,'amount must be quantized to 0.01');
      }
    }
    if(!SIDE_SET.has(posting.side))addError(errors,'POSTING_SIDE_INVALID',`${path}.side`,'monetary posting side must be debit or credit');
    validateRequiredString(posting.currency,`${path}.currency`,'POSTING_CURRENCY_REQUIRED',errors);
    const minor=moneyMinorUnits(posting.amount);
    if(minor!=null&&SIDE_SET.has(posting.side)&&nonEmptyString(posting.currency)){
      const row=balances.get(posting.currency)||{debit:0,credit:0,overflow:false};
      const next=row[posting.side]+minor;
      if(!Number.isSafeInteger(next)){
        row.overflow=true;
        addError(errors,'POSTING_CURRENCY_TOTAL_OUT_OF_ENVELOPE',`${path}.amount`,'currency aggregate exceeds the safe integer envelope');
      }else row[posting.side]=next;
      balances.set(posting.currency,row);
    }
  }else{
    if(posting.side!=null)addError(errors,'POSTING_SIDE_WITHOUT_AMOUNT',`${path}.side`,'side is only valid for monetary postings');
    if(posting.currency!=null)addError(errors,'POSTING_CURRENCY_WITHOUT_AMOUNT',`${path}.currency`,'currency is only valid for monetary postings');
  }

  if(hasQuantity&&(!Number.isFinite(posting.quantityDelta)))addError(errors,'POSTING_QUANTITY_NON_FINITE',`${path}.quantityDelta`,'quantityDelta must be finite');
  for(const field of OPTIONAL_ID_FIELDS)validateOptionalString(posting[field],`${path}.${field}`,'POSTING_REFERENCE_INVALID',errors);
  if(hasQuantity&&Number.isFinite(posting.quantityDelta)){
    const requiredReferences=POSITION_REFERENCE_BY_ACCOUNT[posting.accountId];
    if(requiredReferences&&!requiredReferences.some(field=>nonEmptyString(posting[field]))){
      addError(errors,'POSTING_POSITION_REFERENCE_REQUIRED',path,`quantity posting for ${posting.accountId} requires ${requiredReferences.join(' or ')}`);
    }
  }
  if(nonEmptyString(posting.counterpartyEntityId)&&posting.counterpartyEntityId.startsWith('external:')&&!EXTERNAL_ENTITY_ID_SET.has(posting.counterpartyEntityId)){
    addError(errors,'EXTERNAL_ENTITY_ID_UNKNOWN',`${path}.counterpartyEntityId`,'external counterparty ID is not in the approved aggregate registry');
  }
  validateMetadata(posting.metadata,`${path}.metadata`,errors);
}
function validateOperation(operation){
  const errors=[],balances=new Map(),postingIds=new Set(),sequences=new Set();
  if(!operation||typeof operation!=='object'||Array.isArray(operation)){
    addError(errors,'OPERATION_REQUIRED','operation','operation must be an object');
    return Object.freeze({ok:false,errors:Object.freeze(errors),currencyBalances:Object.freeze({})});
  }
  if(operation.schemaVersion!==SCHEMA_VERSION)addError(errors,'OPERATION_SCHEMA_VERSION_INVALID','operation.schemaVersion',`schemaVersion must equal ${SCHEMA_VERSION}`);
  validateRequiredString(operation.operationId,'operation.operationId','OPERATION_ID_REQUIRED',errors);
  validateRequiredString(operation.idempotencyKey,'operation.idempotencyKey','OPERATION_IDEMPOTENCY_KEY_REQUIRED',errors);
  validateRequiredString(operation.operationType,'operation.operationType','OPERATION_TYPE_REQUIRED',errors);
  validateRequiredString(operation.status,'operation.status','OPERATION_STATUS_REQUIRED',errors);
  for(const field of OPTIONAL_PERIOD_FIELDS){
    const value=operation[field];
    if(value!=null&&(!Number.isInteger(value)||value<0))addError(errors,'OPERATION_PERIOD_INVALID',`operation.${field}`,'period must be a non-negative integer when provided');
  }
  validateOptionalString(operation.reversalOfOperationId,'operation.reversalOfOperationId','OPERATION_LINK_INVALID',errors);
  validateOptionalString(operation.correctionOfOperationId,'operation.correctionOfOperationId','OPERATION_LINK_INVALID',errors);
  if(operation.reversalOfOperationId===operation.operationId||operation.correctionOfOperationId===operation.operationId)addError(errors,'OPERATION_SELF_REFERENCE','operation','operation cannot reverse or correct itself');
  if(operation.reversalOfOperationId&&operation.correctionOfOperationId)addError(errors,'OPERATION_LINK_AMBIGUOUS','operation','operation cannot be both a reversal and correction');
  validateMetadata(operation.metadata,'operation.metadata',errors);

  if(!Array.isArray(operation.postings)||operation.postings.length===0){
    addError(errors,'OPERATION_POSTINGS_REQUIRED','operation.postings','postings must be a non-empty array');
  }else{
    let previous=-1;
    for(let i=0;i<operation.postings.length;i++){
      const posting=operation.postings[i];
      validatePosting(posting,i,operation.operationId,errors,balances,postingIds,sequences);
      if(posting&&Number.isInteger(posting.postingSequence)){
        if(posting.postingSequence<=previous)addError(errors,'POSTING_ORDER_INVALID',`operation.postings[${i}].postingSequence`,'postings must be supplied in strictly increasing postingSequence order');
        previous=posting.postingSequence;
      }
    }
  }

  const currencyBalances={};
  for(const currency of [...balances.keys()].sort()){
    const row=balances.get(currency);
    currencyBalances[currency]=Object.freeze({debitMinorUnits:row.debit,creditMinorUnits:row.credit});
    if(!row.overflow&&row.debit!==row.credit)addError(errors,'OPERATION_CURRENCY_UNBALANCED',`operation.postings`,`${currency} debits and credits must balance exactly in minor units`);
  }
  return Object.freeze({
    ok:errors.length===0,
    errors:Object.freeze(errors),
    currencyBalances:Object.freeze(currencyBalances)
  });
}

Object.assign(exports,{
  SCHEMA_VERSION,
  ACCOUNT_TAXONOMY_VERSION,
  LEGAL_ENTITY_KINDS,
  EXTERNAL_ENTITY_IDS,
  ACCOUNT_TAXONOMY,
  ACCOUNT_IDS,
  MONEY_MINOR_UNITS,
  MAX_SAFE_MONEY_MINOR_UNITS,
  roundMoney,
  isKnownAccount,
  validateEntity,
  validateOperation
});
})(__modules.economicOperation={});
})();
