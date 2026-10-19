// Script boundary: js/economic-settlement.js (classic JavaScript)
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before economic-settlement.js.');
if(!modules.economicOperation)throw new Error('economic-operation.js must be loaded before economic-settlement.js.');
if(!modules.economicReadModel)throw new Error('economic-read-model.js must be loaded before economic-settlement.js.');
if(modules.economicSettlement)throw new Error('Capitalism Tycoon economicSettlement module is already registered.');

const STORE_RENOVATION_OPERATION_TYPE='company:store-renovation';
const PLAYER_COMPANY_ENTITY_ID=modules.economicReadModel.PLAYER_COMPANY_ENTITY_ID;
const CURRENCY='JPY';

function finite(value,path){
  const number=Number(value);
  if(!Number.isFinite(number))throw new TypeError(`${path} must be a finite number.`);
  return number;
}
function nonNegativePeriod(value,path){
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<0)throw new TypeError(`${path} must be a non-negative safe integer.`);
  return number;
}
function nonEmpty(value,path){
  if(typeof value!=='string'||!value.trim())throw new TypeError(`${path} must be a non-empty string.`);
  return value;
}
function encodeId(value){return encodeURIComponent(String(value));}
function validateCost(value){
  const cost=modules.economicOperation.roundMoney(finite(value,'cost'));
  if(cost<=0)throw new RangeError('cost must be greater than zero.');
  return cost;
}
function buildStoreRenovationOperation(state,store,costInput){
  if(!state||typeof state!=='object'||Array.isArray(state))throw new TypeError('state must be an object.');
  if(!store||typeof store!=='object'||Array.isArray(store))throw new TypeError('store must be an object.');
  const week=nonNegativePeriod(state.week,'state.week');
  const storeID=nonEmpty(String(store.id??''),'store.id');
  const businessID=nonEmpty(String(store.businessID??''),'store.businessID');
  const conditionBefore=finite(store.condition??100,'store.condition');
  const cost=validateCost(costInput);
  const operationId=`store-renovation:${encodeId(storeID)}:w${week}:cost-${String(cost)}`;
  const operation={
    schemaVersion:modules.economicOperation.SCHEMA_VERSION,
    operationId,
    idempotencyKey:operationId,
    operationType:STORE_RENOVATION_OPERATION_TYPE,
    decisionPeriod:week,
    recognitionPeriod:week,
    settlementPeriod:week,
    effectivePeriod:week,
    status:'committed',
    metadata:{
      sourceType:'storeRenovation',
      storeID,
      businessID,
      conditionBefore
    },
    postings:[
      {
        postingId:`${operationId}:0`,
        operationId,
        postingSequence:0,
        entityId:PLAYER_COMPANY_ENTITY_ID,
        accountId:'expense:operating',
        side:'debit',
        amount:cost,
        currency:CURRENCY,
        metadata:{storeID,businessID}
      },
      {
        postingId:`${operationId}:1`,
        operationId,
        postingSequence:1,
        entityId:PLAYER_COMPANY_ENTITY_ID,
        accountId:'asset:cash',
        side:'credit',
        amount:cost,
        currency:CURRENCY,
        metadata:{storeID,businessID}
      }
    ]
  };
  const validation=modules.economicOperation.validateOperation(operation);
  if(!validation.ok)throw new TypeError(`Generated store renovation EconomicOperation is invalid: ${validation.errors.map(row=>row.code).join(', ')}`);
  return Object.freeze({
    ...operation,
    metadata:Object.freeze({...operation.metadata}),
    postings:Object.freeze(operation.postings.map(row=>Object.freeze({...row,metadata:Object.freeze({...row.metadata})})))
  });
}
function validateStoreRenovationOperation(operation){
  const validation=modules.economicOperation.validateOperation(operation);
  if(!validation.ok)throw new TypeError(`Invalid store renovation EconomicOperation: ${validation.errors.map(row=>row.code).join(', ')}`);
  if(operation.status!=='committed')throw new TypeError('Store renovation settlement requires a committed operation.');
  if(operation.operationType!==STORE_RENOVATION_OPERATION_TYPE)throw new TypeError('Unsupported EconomicOperation type for store renovation settlement.');
  if(operation.postings.length!==2)throw new TypeError('Store renovation settlement requires exactly two postings.');
  const debit=operation.postings[0],credit=operation.postings[1];
  const common=row=>row.entityId===PLAYER_COMPANY_ENTITY_ID&&row.currency===CURRENCY;
  if(!common(debit)||debit.accountId!=='expense:operating'||debit.side!=='debit'){
    throw new TypeError('Store renovation debit posting shape is invalid.');
  }
  if(!common(credit)||credit.accountId!=='asset:cash'||credit.side!=='credit'){
    throw new TypeError('Store renovation cash posting shape is invalid.');
  }
  if(debit.amount!==credit.amount)throw new TypeError('Store renovation posting amounts must match.');
  return Object.freeze({amount:validateCost(credit.amount),debit,credit});
}
function settleStoreRenovation(state,operation){
  if(!state||typeof state!=='object'||Array.isArray(state))throw new TypeError('state must be an object.');
  const shape=validateStoreRenovationOperation(operation);
  const before=finite(state.companyCash,'state.companyCash');
  if(before<shape.amount)throw new RangeError('Insufficient company cash for store renovation settlement.');
  const after=before-shape.amount;
  if(!Number.isFinite(after))throw new RangeError('Store renovation settlement produced non-finite company cash.');
  state.companyCash=after;
  return Object.freeze({
    applied:true,
    operationId:operation.operationId,
    idempotencyKey:operation.idempotencyKey,
    amount:shape.amount,
    companyCashBefore:before,
    companyCashAfter:after
  });
}

// Track B / B2: one boundary that pairs an authoritative company-cash settlement with its
// finance projection. The caller supplies the family's own settlement and projection steps;
// this function admits the operation once, then proves that the cash delta, the operation
// identity and the projected ledger row agree. Any disagreement throws, so the surrounding
// runTransaction() rolls cash, domain state and finance back together. It never writes cash
// or finance itself, so the cut-over family keeps exactly one company-cash writer.
const COMPANY_CASH_FAMILIES=Object.freeze({
  [STORE_RENOVATION_OPERATION_TYPE]:validateStoreRenovationOperation
});
function priorProjection(state,operation){
  const rows=state.finance?.transactions;
  if(rows!=null&&!Array.isArray(rows))throw new TypeError('Finance projection receipts must be an array.');
  return (rows||[]).find(row=>row?.idempotencyKey===operation.idempotencyKey||row?.operationID===operation.operationId)||null;
}
function signedCashDelta(operation){
  const cash=operation.postings.filter(row=>row.entityId===PLAYER_COMPANY_ENTITY_ID&&row.accountId==='asset:cash');
  if(cash.length!==1)throw new TypeError('Company cash commit requires exactly one player company cash posting.');
  return cash[0].side==='debit'?cash[0].amount:-cash[0].amount;
}
function commitCompanyCashOperation(state,operation,settle,project){
  if(!state||typeof state!=='object'||Array.isArray(state))throw new TypeError('state must be an object.');
  const validateFamily=COMPANY_CASH_FAMILIES[operation?.operationType];
  if(typeof validateFamily!=='function')throw new TypeError('Unsupported EconomicOperation type for company cash commit.');
  if(typeof settle!=='function'||typeof project!=='function')throw new TypeError('Company cash commit requires settlement and projection steps.');
  validateFamily(operation);
  if(priorProjection(state,operation))throw new Error(`EconomicOperation ${operation.operationId} is already projected.`);
  const before=finite(state.companyCash,'state.companyCash');
  const expected=modules.economicOperation.roundMoney(before+signedCashDelta(operation));
  const settlement=settle();
  if(!settlement||settlement.applied!==true||settlement.operationId!==operation.operationId||settlement.idempotencyKey!==operation.idempotencyKey)throw new Error('Company cash settlement receipt does not match the EconomicOperation.');
  if(settlement.companyCashBefore!==before||settlement.companyCashAfter!==state.companyCash||modules.economicOperation.roundMoney(state.companyCash)!==expected)throw new Error('Company cash settlement does not match the EconomicOperation postings.');
  const settled=state.companyCash;
  const row=project(settlement);
  if(state.companyCash!==settled)throw new Error('Finance projection must not change company cash.');
  if(!row||row.operationID!==operation.operationId||row.idempotencyKey!==operation.idempotencyKey)throw new Error('Finance projection did not record the EconomicOperation identity.');
  if(modules.economicOperation.roundMoney(Number(row.cashEffect))!==modules.economicOperation.roundMoney(settled-before))throw new Error('Finance projection cash effect does not match the settled company cash.');
  return Object.freeze({...settlement,transactionID:row.transactionID??row.id??null});
}

modules.economicSettlement=Object.freeze({
  STORE_RENOVATION_OPERATION_TYPE,
  PLAYER_COMPANY_ENTITY_ID,
  CURRENCY,
  buildStoreRenovationOperation,
  validateStoreRenovationOperation,
  settleStoreRenovation,
  commitCompanyCashOperation
});
})();
