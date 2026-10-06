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
const INTEGER_SECURITY_QUANTITY_ACCOUNTS=new Set([
  'asset:security-investment','equity:share-capital','equity:treasury-stock'
]);
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
const ENTITY_FIELD_SET=new Set([
  'entityId','legalEntityKind','legalName','status','roles','listingStatus','jurisdiction','metadata'
]);
const OPERATION_FIELD_SET=new Set([
  'schemaVersion','operationId','idempotencyKey','operationType',
  ...OPTIONAL_PERIOD_FIELDS,'status','reversalOfOperationId','correctionOfOperationId','metadata','postings'
]);
const POSTING_FIELD_SET=new Set([
  'postingId','operationId','postingSequence','entityId','accountId','side','amount','currency','quantityDelta','metadata',
  ...OPTIONAL_ID_FIELDS
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
function isNativeConstructorForPrototype(proto,expectedName){
  if(!proto||!['Object','Array'].includes(expectedName))return false;
  let descriptor;
  try{descriptor=Object.getOwnPropertyDescriptor(proto,'constructor');}
  catch{return false;}
  if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))return false;
  const ctor=descriptor.value;
  if(typeof ctor!=='function')return false;
  let source;
  try{source=Function.prototype.toString.call(ctor);}
  catch{return false;}
  const nativeMatch=source.match(/^function\s+([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{\s*\[native code\]\s*\}$/);
  if(!nativeMatch||nativeMatch[1]!==expectedName)return false;
  let prototypeDescriptor;
  try{prototypeDescriptor=Object.getOwnPropertyDescriptor(ctor,'prototype');}
  catch{return false;}
  return Boolean(prototypeDescriptor&&prototypeDescriptor.value===proto);
}
function isPlainJsonObject(value){
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  let proto;
  try{proto=Object.getPrototypeOf(value);}
  catch{return false;}
  if(proto===null)return true;
  try{return Object.getPrototypeOf(proto)===null&&isNativeConstructorForPrototype(proto,'Object');}
  catch{return false;}
}
function isPlainJsonArray(value){
  if(!Array.isArray(value))return false;
  let proto;
  try{proto=Object.getPrototypeOf(value);}
  catch{return false;}
  return isNativeConstructorForPrototype(proto,'Array');
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
  const isArray=Array.isArray(value);
  if(isArray&&!isPlainJsonArray(value)){
    addError(errors,'METADATA_NOT_PLAIN_JSON',path,'metadata arrays must use the native Array prototype');
    return;
  }
  if(!isArray&&!isPlainJsonObject(value)){
    addError(errors,'METADATA_NOT_PLAIN_JSON',path,'metadata objects must use Object.prototype or a null prototype');
    return;
  }
  seen.add(value);
  if(Object.getOwnPropertySymbols(value).length)addError(errors,'METADATA_SYMBOL_KEY',path,'metadata must not contain symbol-keyed properties');
  const names=Object.getOwnPropertyNames(value);
  for(const key of names){
    if(isArray&&key==='length')continue;
    if(isArray&&!/^(?:0|[1-9]\d*)$/.test(key)){
      addError(errors,'METADATA_ARRAY_EXTRA_PROPERTY',`${path}.${key}`,'metadata arrays must not contain non-index properties');
      continue;
    }
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(!descriptor)continue;
    if(!Object.prototype.hasOwnProperty.call(descriptor,'value')){
      addError(errors,'METADATA_ACCESSOR_PROPERTY',`${path}.${key}`,'metadata properties must be data properties, not accessors');
      continue;
    }
    if(!isArray&&!descriptor.enumerable){
      addError(errors,'METADATA_NON_ENUMERABLE_PROPERTY',`${path}.${key}`,'metadata object properties must be enumerable JSON properties');
      continue;
    }
    validateJsonValue(descriptor.value,isArray?`${path}[${key}]`:`${path}.${key}`,errors,seen);
  }
  seen.delete(value);
}
function validateMetadata(value,path,errors){
  if(value===null||typeof value!=='object'||Array.isArray(value)){
    addError(errors,'METADATA_REQUIRED',path,'metadata must be a JSON object');
    return;
  }
  if(!isPlainJsonObject(value)){
    addError(errors,'METADATA_NOT_PLAIN_JSON',path,'metadata objects must use Object.prototype or a null prototype');
    return;
  }
  validateJsonValue(value,path,errors,new Set());
}
function inspectPlainDataRecord(value,path,kind,errors){
  if(!isPlainJsonObject(value)){
    addError(errors,`${kind}_NOT_PLAIN_RECORD`,path,`${kind.toLowerCase()} must use Object.prototype or a null prototype`);
    return null;
  }
  let symbols;
  try{symbols=Object.getOwnPropertySymbols(value);}
  catch{
    addError(errors,`${kind}_DESCRIPTOR_INSPECTION_FAILED`,path,`${kind.toLowerCase()} descriptors could not be inspected safely`);
    return null;
  }
  if(symbols.length)addError(errors,`${kind}_SYMBOL_KEY`,path,`${kind.toLowerCase()} must not contain symbol-keyed properties`);
  const record=Object.create(null);
  let names;
  try{names=Object.getOwnPropertyNames(value);}
  catch{
    addError(errors,`${kind}_DESCRIPTOR_INSPECTION_FAILED`,path,`${kind.toLowerCase()} descriptors could not be inspected safely`);
    return null;
  }
  for(const key of names){
    let descriptor;
    try{descriptor=Object.getOwnPropertyDescriptor(value,key);}
    catch{
      addError(errors,`${kind}_DESCRIPTOR_INSPECTION_FAILED`,`${path}.${key}`,`${kind.toLowerCase()} property descriptor could not be inspected safely`);
      continue;
    }
    if(!descriptor)continue;
    if(!Object.prototype.hasOwnProperty.call(descriptor,'value')){
      addError(errors,`${kind}_ACCESSOR_PROPERTY`,`${path}.${key}`,`${kind.toLowerCase()} properties must be own data properties, not accessors`);
      continue;
    }
    if(!descriptor.enumerable){
      addError(errors,`${kind}_NON_ENUMERABLE_PROPERTY`,`${path}.${key}`,`${kind.toLowerCase()} properties must be enumerable JSON properties`);
      continue;
    }
    record[key]=descriptor.value;
  }
  return record;
}
function validateAllowedRecordFields(record,path,kind,allowedFields,errors){
  for(const key of Object.keys(record)){
    if(!allowedFields.has(key)){
      addError(errors,`${kind}_FIELD_UNKNOWN`,`${path}.${key}`,`${kind.toLowerCase()} property is not in the approved schema`);
    }
  }
}
function inspectPlainDataArray(value,path,kind,errors){
  if(!isPlainJsonArray(value)){
    addError(errors,`${kind}_NOT_PLAIN_ARRAY`,path,`${kind.toLowerCase()} must use the native Array prototype`);
    return null;
  }
  let symbols,names;
  try{
    symbols=Object.getOwnPropertySymbols(value);
    names=Object.getOwnPropertyNames(value);
  }catch{
    addError(errors,`${kind}_DESCRIPTOR_INSPECTION_FAILED`,path,`${kind.toLowerCase()} descriptors could not be inspected safely`);
    return null;
  }
  if(symbols.length)addError(errors,`${kind}_SYMBOL_KEY`,path,`${kind.toLowerCase()} must not contain symbol-keyed properties`);
  const lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length');
  const length=lengthDescriptor&&Object.prototype.hasOwnProperty.call(lengthDescriptor,'value')?lengthDescriptor.value:0;
  const rows=new Array(length);
  for(let i=0;i<length;i++){
    let descriptor;
    try{descriptor=Object.getOwnPropertyDescriptor(value,String(i));}
    catch{
      addError(errors,`${kind}_DESCRIPTOR_INSPECTION_FAILED`,`${path}[${i}]`,`${kind.toLowerCase()} element descriptor could not be inspected safely`);
      continue;
    }
    if(!descriptor){
      addError(errors,`${kind}_HOLE`,`${path}[${i}]`,`${kind.toLowerCase()} must be a dense array of own data properties`);
      continue;
    }
    if(!Object.prototype.hasOwnProperty.call(descriptor,'value')){
      addError(errors,`${kind}_ACCESSOR_ELEMENT`,`${path}[${i}]`,`${kind.toLowerCase()} elements must be own data properties, not accessors`);
      continue;
    }
    if(!descriptor.enumerable){
      addError(errors,`${kind}_NON_ENUMERABLE_ELEMENT`,`${path}[${i}]`,`${kind.toLowerCase()} elements must be enumerable JSON properties`);
      continue;
    }
    rows[i]=descriptor.value;
  }
  for(const key of names){
    if(key==='length'||/^(?:0|[1-9]\d*)$/.test(key))continue;
    addError(errors,`${kind}_ARRAY_EXTRA_PROPERTY`,`${path}.${key}`,`${kind.toLowerCase()} arrays must not contain non-index properties`);
  }
  return rows;
}
function inspectPostingArray(value,path,errors){
  if(!isPlainJsonArray(value)){
    addError(errors,'OPERATION_POSTINGS_NOT_PLAIN_ARRAY',path,'postings must use the native Array prototype');
    return null;
  }
  let symbols;
  try{symbols=Object.getOwnPropertySymbols(value);}
  catch{
    addError(errors,'OPERATION_POSTINGS_DESCRIPTOR_INSPECTION_FAILED',path,'postings descriptors could not be inspected safely');
    return null;
  }
  if(symbols.length)addError(errors,'OPERATION_POSTINGS_SYMBOL_KEY',path,'postings must not contain symbol-keyed properties');
  let lengthDescriptor;
  try{lengthDescriptor=Object.getOwnPropertyDescriptor(value,'length');}
  catch{
    addError(errors,'OPERATION_POSTINGS_DESCRIPTOR_INSPECTION_FAILED',path,'postings length descriptor could not be inspected safely');
    return null;
  }
  const length=lengthDescriptor&&Object.prototype.hasOwnProperty.call(lengthDescriptor,'value')?lengthDescriptor.value:0;
  const rows=new Array(length);
  for(let i=0;i<length;i++){
    let descriptor;
    try{descriptor=Object.getOwnPropertyDescriptor(value,String(i));}
    catch{
      addError(errors,'OPERATION_POSTINGS_DESCRIPTOR_INSPECTION_FAILED',`${path}[${i}]`,'posting element descriptor could not be inspected safely');
      continue;
    }
    if(!descriptor){
      addError(errors,'OPERATION_POSTINGS_HOLE',`${path}[${i}]`,'postings must be a dense array of own data properties');
      continue;
    }
    if(!Object.prototype.hasOwnProperty.call(descriptor,'value')){
      addError(errors,'OPERATION_POSTINGS_ACCESSOR_ELEMENT',`${path}[${i}]`,'posting elements must be own data properties, not accessors');
      continue;
    }
    rows[i]=descriptor.value;
  }
  for(const key of Object.getOwnPropertyNames(value)){
    if(key==='length'||/^(?:0|[1-9]\d*)$/.test(key))continue;
    addError(errors,'OPERATION_POSTINGS_ARRAY_EXTRA_PROPERTY',`${path}.${key}`,'postings arrays must not contain non-index properties');
  }
  return rows;
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
  const e=inspectPlainDataRecord(entity,'entity','ENTITY',errors);
  if(!e){
    return Object.freeze({ok:false,errors:Object.freeze(errors)});
  }
  validateAllowedRecordFields(e,'entity','ENTITY',ENTITY_FIELD_SET,errors);
  validateEntityReference(e.entityId,'entity.entityId','ENTITY_ID_REQUIRED',errors);
  if(!LEGAL_ENTITY_KINDS.includes(e.legalEntityKind))addError(errors,'ENTITY_KIND_INVALID','entity.legalEntityKind','legalEntityKind is not approved');
  validateRequiredString(e.legalName,'entity.legalName','ENTITY_NAME_REQUIRED',errors);
  validateRequiredString(e.status,'entity.status','ENTITY_STATUS_REQUIRED',errors);
  if(!Array.isArray(e.roles))addError(errors,'ENTITY_ROLES_INVALID','entity.roles','roles must be an array');
  else{
    const roles=inspectPlainDataArray(e.roles,'entity.roles','ENTITY_ROLES',errors);
    if(roles){
      const seen=new Set();
      for(let i=0;i<roles.length;i++){
        const role=roles[i];
        if(!nonEmptyString(role))addError(errors,'ENTITY_ROLE_INVALID',`entity.roles[${i}]`,'role must be a non-empty string');
        else if(seen.has(role))addError(errors,'ENTITY_ROLE_DUPLICATE',`entity.roles[${i}]`,'role must not be duplicated');
        else seen.add(role);
      }
    }
  }
  validateOptionalString(e.listingStatus,'entity.listingStatus','ENTITY_LISTING_STATUS_INVALID',errors);
  validateOptionalString(e.jurisdiction,'entity.jurisdiction','ENTITY_JURISDICTION_INVALID',errors);
  validateMetadata(e.metadata,'entity.metadata',errors);
  return Object.freeze({ok:errors.length===0,errors:Object.freeze(errors)});
}
function validatePosting(posting,index,operationId,errors,balances,postingIds,sequences){
  const path=`operation.postings[${index}]`;
  const p=inspectPlainDataRecord(posting,path,'POSTING',errors);
  if(!p)return null;
  validateAllowedRecordFields(p,path,'POSTING',POSTING_FIELD_SET,errors);
  validateRequiredString(p.postingId,`${path}.postingId`,'POSTING_ID_REQUIRED',errors);
  if(nonEmptyString(p.postingId)){
    if(postingIds.has(p.postingId))addError(errors,'POSTING_ID_DUPLICATE',`${path}.postingId`,'postingId must be unique within an operation');
    postingIds.add(p.postingId);
  }
  if(p.operationId!==operationId)addError(errors,'POSTING_OPERATION_MISMATCH',`${path}.operationId`,'posting operationId must match parent operationId');
  if(!Number.isInteger(p.postingSequence)||p.postingSequence<0)addError(errors,'POSTING_SEQUENCE_INVALID',`${path}.postingSequence`,'postingSequence must be a non-negative integer');
  else{
    if(sequences.has(p.postingSequence))addError(errors,'POSTING_SEQUENCE_DUPLICATE',`${path}.postingSequence`,'postingSequence must be unique within an operation');
    sequences.add(p.postingSequence);
  }
  validateEntityReference(p.entityId,`${path}.entityId`,'POSTING_ENTITY_REQUIRED',errors);
  if(!isKnownAccount(p.accountId))addError(errors,'POSTING_ACCOUNT_UNKNOWN',`${path}.accountId`,'accountId is not in the approved taxonomy');

  const hasAmount=Object.prototype.hasOwnProperty.call(p,'amount');
  const hasQuantity=Object.prototype.hasOwnProperty.call(p,'quantityDelta');
  if(!hasAmount&&!hasQuantity)addError(errors,'POSTING_EFFECT_REQUIRED',path,'posting must contain amount or quantityDelta');

  if(hasAmount){
    if(typeof p.amount!=='number'||!Number.isFinite(p.amount))addError(errors,'POSTING_AMOUNT_NON_FINITE',`${path}.amount`,'amount must be finite');
    else if(p.amount<0)addError(errors,'POSTING_AMOUNT_NEGATIVE',`${path}.amount`,'amount must be non-negative');
    else{
      const scaled=p.amount*MONEY_MINOR_UNITS;
      if(!Number.isFinite(scaled)||Math.abs(scaled)>MAX_SAFE_MONEY_MINOR_UNITS||!Number.isSafeInteger(Math.round(scaled))){
        addError(errors,'POSTING_AMOUNT_OUT_OF_ENVELOPE',`${path}.amount`,'amount exceeds the cent-exact Number envelope');
      }else if(Math.round(scaled)/MONEY_MINOR_UNITS!==p.amount){
        addError(errors,'POSTING_AMOUNT_NOT_QUANTIZED',`${path}.amount`,'amount must be quantized to 0.01');
      }
    }
    if(!SIDE_SET.has(p.side))addError(errors,'POSTING_SIDE_INVALID',`${path}.side`,'monetary posting side must be debit or credit');
    validateRequiredString(p.currency,`${path}.currency`,'POSTING_CURRENCY_REQUIRED',errors);
    const minor=moneyMinorUnits(p.amount);
    if(minor!=null&&SIDE_SET.has(p.side)&&nonEmptyString(p.currency)&&nonEmptyString(p.entityId)){
      let byCurrency=balances.get(p.entityId);
      if(!byCurrency){byCurrency=new Map();balances.set(p.entityId,byCurrency);}
      const row=byCurrency.get(p.currency)||{debit:0,credit:0,overflow:false};
      const next=row[p.side]+minor;
      if(!Number.isSafeInteger(next)){
        row.overflow=true;
        addError(errors,'POSTING_CURRENCY_TOTAL_OUT_OF_ENVELOPE',`${path}.amount`,'entity/currency aggregate exceeds the safe integer envelope');
      }else row[p.side]=next;
      byCurrency.set(p.currency,row);
    }
  }else{
    if(p.side!=null)addError(errors,'POSTING_SIDE_WITHOUT_AMOUNT',`${path}.side`,'side is only valid for monetary postings');
    if(p.currency!=null)addError(errors,'POSTING_CURRENCY_WITHOUT_AMOUNT',`${path}.currency`,'currency is only valid for monetary postings');
  }

  if(hasQuantity&&(!Number.isFinite(p.quantityDelta)))addError(errors,'POSTING_QUANTITY_NON_FINITE',`${path}.quantityDelta`,'quantityDelta must be finite');
  for(const field of OPTIONAL_ID_FIELDS)validateOptionalString(p[field],`${path}.${field}`,'POSTING_REFERENCE_INVALID',errors);
  if(hasQuantity&&Number.isFinite(p.quantityDelta)){
    const requiredReferences=POSITION_REFERENCE_BY_ACCOUNT[p.accountId];
    if(!requiredReferences){
      addError(errors,'POSTING_QUANTITY_ACCOUNT_UNSUPPORTED',`${path}.accountId`,'quantityDelta is only valid for approved position accounts');
    }else{
      if(!requiredReferences.some(field=>nonEmptyString(p[field]))){
        addError(errors,'POSTING_POSITION_REFERENCE_REQUIRED',path,`quantity posting for ${p.accountId} requires ${requiredReferences.join(' or ')}`);
      }
      if(INTEGER_SECURITY_QUANTITY_ACCOUNTS.has(p.accountId)&&!Number.isSafeInteger(p.quantityDelta)){
        addError(errors,'POSTING_SECURITY_QUANTITY_INVALID',`${path}.quantityDelta`,'share/security quantityDelta must be a safe integer until the security class explicitly supports fractions');
      }
    }
  }
  if(nonEmptyString(p.counterpartyEntityId)&&p.counterpartyEntityId.startsWith('external:')&&!EXTERNAL_ENTITY_ID_SET.has(p.counterpartyEntityId)){
    addError(errors,'EXTERNAL_ENTITY_ID_UNKNOWN',`${path}.counterpartyEntityId`,'external counterparty ID is not in the approved aggregate registry');
  }
  validateMetadata(p.metadata,`${path}.metadata`,errors);
  return p;
}
function validateOperation(operation){
  const errors=[],balances=new Map(),postingIds=new Set(),sequences=new Set();
  const o=inspectPlainDataRecord(operation,'operation','OPERATION',errors);
  if(!o){
    return Object.freeze({ok:false,errors:Object.freeze(errors),entityCurrencyBalances:Object.freeze(Object.create(null)),currencyBalances:Object.freeze(Object.create(null))});
  }
  validateAllowedRecordFields(o,'operation','OPERATION',OPERATION_FIELD_SET,errors);
  if(o.schemaVersion!==SCHEMA_VERSION)addError(errors,'OPERATION_SCHEMA_VERSION_INVALID','operation.schemaVersion',`schemaVersion must equal ${SCHEMA_VERSION}`);
  validateRequiredString(o.operationId,'operation.operationId','OPERATION_ID_REQUIRED',errors);
  validateRequiredString(o.idempotencyKey,'operation.idempotencyKey','OPERATION_IDEMPOTENCY_KEY_REQUIRED',errors);
  validateRequiredString(o.operationType,'operation.operationType','OPERATION_TYPE_REQUIRED',errors);
  validateRequiredString(o.status,'operation.status','OPERATION_STATUS_REQUIRED',errors);
  for(const field of OPTIONAL_PERIOD_FIELDS){
    const value=o[field];
    if(value!=null&&(!Number.isInteger(value)||value<0))addError(errors,'OPERATION_PERIOD_INVALID',`operation.${field}`,'period must be a non-negative integer when provided');
  }
  validateOptionalString(o.reversalOfOperationId,'operation.reversalOfOperationId','OPERATION_LINK_INVALID',errors);
  validateOptionalString(o.correctionOfOperationId,'operation.correctionOfOperationId','OPERATION_LINK_INVALID',errors);
  if(o.reversalOfOperationId===o.operationId||o.correctionOfOperationId===o.operationId)addError(errors,'OPERATION_SELF_REFERENCE','operation','operation cannot reverse or correct itself');
  if(o.reversalOfOperationId&&o.correctionOfOperationId)addError(errors,'OPERATION_LINK_AMBIGUOUS','operation','operation cannot be both a reversal and correction');
  validateMetadata(o.metadata,'operation.metadata',errors);

  const postings=inspectPostingArray(o.postings,'operation.postings',errors);
  if(!postings||postings.length===0){
    addError(errors,'OPERATION_POSTINGS_REQUIRED','operation.postings','postings must be a non-empty array');
  }else{
    let previous=-1;
    for(let i=0;i<postings.length;i++){
      const posting=validatePosting(postings[i],i,o.operationId,errors,balances,postingIds,sequences);
      if(posting&&Number.isInteger(posting.postingSequence)){
        if(posting.postingSequence<=previous)addError(errors,'POSTING_ORDER_INVALID',`operation.postings[${i}].postingSequence`,'postings must be supplied in strictly increasing postingSequence order');
        previous=posting.postingSequence;
      }
    }
  }

  const entityCurrencyBalances=Object.create(null);
  const currencyBalances=Object.create(null);
  for(const entityId of [...balances.keys()].sort()){
    const byCurrency=balances.get(entityId);
    const entityRows=Object.create(null);
    entityCurrencyBalances[entityId]=entityRows;
    for(const currency of [...byCurrency.keys()].sort()){
      const row=byCurrency.get(currency);
      entityRows[currency]=Object.freeze({debitMinorUnits:row.debit,creditMinorUnits:row.credit});
      if(!row.overflow&&row.debit!==row.credit){
        addError(errors,'OPERATION_ENTITY_CURRENCY_UNBALANCED','operation.postings',`${entityId} / ${currency} debits and credits must balance exactly in minor units`);
      }
      const total=currencyBalances[currency]||{debitMinorUnits:0,creditMinorUnits:0};
      const nextDebit=total.debitMinorUnits+row.debit;
      const nextCredit=total.creditMinorUnits+row.credit;
      if(!Number.isSafeInteger(nextDebit)||!Number.isSafeInteger(nextCredit)){
        addError(errors,'OPERATION_CURRENCY_TOTAL_OUT_OF_ENVELOPE','operation.postings',`${currency} diagnostic aggregate exceeds the safe integer envelope`);
      }else{
        total.debitMinorUnits=nextDebit;
        total.creditMinorUnits=nextCredit;
        currencyBalances[currency]=total;
      }
    }
    Object.freeze(entityRows);
  }
  for(const currency of Object.keys(currencyBalances))Object.freeze(currencyBalances[currency]);
  return Object.freeze({
    ok:errors.length===0,
    errors:Object.freeze(errors),
    entityCurrencyBalances:Object.freeze(entityCurrencyBalances),
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
