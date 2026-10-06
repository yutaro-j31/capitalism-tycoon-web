// Script boundary: js/economic-shadow-journal.js (classic JavaScript)
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before economic-shadow-journal.js.');
if(!modules.economicOperation)throw new Error('economic-operation.js must be loaded before economic-shadow-journal.js.');
if(modules.economicShadowJournal)throw new Error('Capitalism Tycoon economicShadowJournal module is already registered.');

const JOURNAL_SCHEMA_VERSION=1;
const DEFAULT_LIMITS=Object.freeze({
  liveOperationCap:512,
  livePostingCap:8192,
  receiptCap:4096,
  idempotencyWindowPeriods:260
});
const PERIOD_FIELDS=Object.freeze(['decisionPeriod','recognitionPeriod','duePeriod','settlementPeriod','effectivePeriod']);
const EMPTY_CHAIN_DIGEST='0000000000000000';

function compareText(a,b){a=String(a);b=String(b);return a<b?-1:a>b?1:0;}
function nonNegativeInteger(value,path){
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<0)throw new TypeError(`${path} must be a non-negative safe integer.`);
  return number;
}
function positiveInteger(value,path){
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<1)throw new TypeError(`${path} must be a positive safe integer.`);
  return number;
}
function plainObject(value){return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function canonicalize(value){
  if(Array.isArray(value))return value.map(canonicalize);
  if(!value||typeof value!=='object')return value;
  const out={};
  for(const key of Object.keys(value).sort(compareText))out[key]=canonicalize(value[key]);
  return out;
}
function canonicalSerialize(value){return JSON.stringify(canonicalize(value));}
function hashText(value){
  const text=String(value);
  let h1=0x811c9dc5|0,h2=0x9e3779b9|0;
  for(let i=0;i<text.length;i++){
    const code=text.charCodeAt(i);
    h1=Math.imul(h1^code,0x01000193);
    h2=Math.imul(h2^(code+i),0x85ebca6b);
  }
  return `${(h1>>>0).toString(16).padStart(8,'0')}${(h2>>>0).toString(16).padStart(8,'0')}`;
}
function digestOperation(operation){return hashText(canonicalSerialize(operation));}
function deepFreeze(value){
  if(!value||typeof value!=='object'||Object.isFrozen(value))return value;
  for(const key of Object.keys(value))deepFreeze(value[key]);
  return Object.freeze(value);
}
function cloneJson(value){return JSON.parse(JSON.stringify(value));}
function normalizeLimits(input={}){
  if(input===undefined||input===null)input={};
  if(!plainObject(input))throw new TypeError('journal limits must be an object.');
  const limits={
    liveOperationCap:positiveInteger(input.liveOperationCap??DEFAULT_LIMITS.liveOperationCap,'limits.liveOperationCap'),
    livePostingCap:positiveInteger(input.livePostingCap??DEFAULT_LIMITS.livePostingCap,'limits.livePostingCap'),
    receiptCap:positiveInteger(input.receiptCap??DEFAULT_LIMITS.receiptCap,'limits.receiptCap'),
    idempotencyWindowPeriods:positiveInteger(input.idempotencyWindowPeriods??DEFAULT_LIMITS.idempotencyWindowPeriods,'limits.idempotencyWindowPeriods')
  };
  return Object.freeze(limits);
}
function emptyCheckpoint(){
  return Object.freeze({
    compactedOperationCount:0,
    compactedPostingCount:0,
    compactedThroughSequence:0,
    compactedThroughPeriod:0,
    chainDigest:EMPTY_CHAIN_DIGEST
  });
}
function createJournal(options={}){
  const limits=normalizeLimits(options.limits||options);
  return deepFreeze({
    journalSchemaVersion:JOURNAL_SCHEMA_VERSION,
    limits:{...limits},
    nextSequence:1,
    latestPeriod:0,
    liveOperations:[],
    receipts:[],
    checkpoint:{...emptyCheckpoint()}
  });
}
function operationPeriod(operation,currentPeriod){
  let period=currentPeriod;
  for(const field of PERIOD_FIELDS){
    if(operation[field]!=null)period=Math.max(period,nonNegativeInteger(operation[field],`operation.${field}`));
  }
  return period;
}
function receiptFromEntry(entry){
  return {
    sequence:entry.sequence,
    operationId:entry.operation.operationId,
    idempotencyKey:entry.operation.idempotencyKey,
    operationDigest:entry.operationDigest,
    operationPeriod:entry.operationPeriod,
    retentionUntilPeriod:entry.retentionUntilPeriod,
    postingCount:entry.postingCount
  };
}
function checkpointAfter(checkpoint,entry){
  const receipt=receiptFromEntry(entry);
  const chainDigest=hashText(`${checkpoint.chainDigest}|${canonicalSerialize(receipt)}`);
  return {
    compactedOperationCount:checkpoint.compactedOperationCount+1,
    compactedPostingCount:checkpoint.compactedPostingCount+entry.postingCount,
    compactedThroughSequence:entry.sequence,
    compactedThroughPeriod:Math.max(checkpoint.compactedThroughPeriod,entry.operationPeriod),
    chainDigest
  };
}
function validateOperationForJournal(operation){
  const validation=modules.economicOperation.validateOperation(operation);
  if(!validation.ok){
    const codes=validation.errors.map(error=>error.code).join(', ');
    throw new TypeError(`Invalid EconomicOperation for shadow journal: ${codes}`);
  }
  if(operation.status!=='committed')throw new TypeError('Shadow journal records committed EconomicOperations only.');
}
function normalizeLiveEntry(value,limits,path){
  if(!plainObject(value))throw new TypeError(`${path} must be an object.`);
  const sequence=positiveInteger(value.sequence,`${path}.sequence`);
  const operation=cloneJson(value.operation);
  validateOperationForJournal(operation);
  const digest=digestOperation(operation);
  if(value.operationDigest!==digest)throw new TypeError(`${path}.operationDigest does not match operation content.`);
  const postingCount=positiveInteger(value.postingCount,`${path}.postingCount`);
  if(postingCount!==operation.postings.length)throw new TypeError(`${path}.postingCount does not match operation postings.`);
  if(postingCount>limits.livePostingCap)throw new RangeError(`${path}.postingCount exceeds livePostingCap.`);
  const operationPeriod=nonNegativeInteger(value.operationPeriod,`${path}.operationPeriod`);
  const retentionUntilPeriod=nonNegativeInteger(value.retentionUntilPeriod,`${path}.retentionUntilPeriod`);
  if(retentionUntilPeriod<operationPeriod)throw new TypeError(`${path}.retentionUntilPeriod precedes operationPeriod.`);
  return {sequence,operation,operationDigest:digest,operationPeriod,retentionUntilPeriod,postingCount};
}
function normalizeReceipt(value,path){
  if(!plainObject(value))throw new TypeError(`${path} must be an object.`);
  const receipt={
    sequence:positiveInteger(value.sequence,`${path}.sequence`),
    operationId:String(value.operationId||''),
    idempotencyKey:String(value.idempotencyKey||''),
    operationDigest:String(value.operationDigest||''),
    operationPeriod:nonNegativeInteger(value.operationPeriod,`${path}.operationPeriod`),
    retentionUntilPeriod:nonNegativeInteger(value.retentionUntilPeriod,`${path}.retentionUntilPeriod`),
    postingCount:positiveInteger(value.postingCount,`${path}.postingCount`)
  };
  if(!receipt.operationId)throw new TypeError(`${path}.operationId must be non-empty.`);
  if(!receipt.idempotencyKey)throw new TypeError(`${path}.idempotencyKey must be non-empty.`);
  if(!/^[0-9a-f]{16}$/.test(receipt.operationDigest))throw new TypeError(`${path}.operationDigest is invalid.`);
  if(receipt.retentionUntilPeriod<receipt.operationPeriod)throw new TypeError(`${path}.retentionUntilPeriod precedes operationPeriod.`);
  return receipt;
}
function normalizeCheckpoint(value){
  if(!plainObject(value))throw new TypeError('journal.checkpoint must be an object.');
  const checkpoint={
    compactedOperationCount:nonNegativeInteger(value.compactedOperationCount,'journal.checkpoint.compactedOperationCount'),
    compactedPostingCount:nonNegativeInteger(value.compactedPostingCount,'journal.checkpoint.compactedPostingCount'),
    compactedThroughSequence:nonNegativeInteger(value.compactedThroughSequence,'journal.checkpoint.compactedThroughSequence'),
    compactedThroughPeriod:nonNegativeInteger(value.compactedThroughPeriod,'journal.checkpoint.compactedThroughPeriod'),
    chainDigest:String(value.chainDigest||'')
  };
  if(!/^[0-9a-f]{16}$/.test(checkpoint.chainDigest))throw new TypeError('journal.checkpoint.chainDigest is invalid.');
  return checkpoint;
}
function assertUniqueIdentity(records){
  const operationIds=new Set(),keys=new Set(),sequences=new Set();
  for(const record of records){
    const operationId=record.operation?.operationId??record.operationId;
    const idempotencyKey=record.operation?.idempotencyKey??record.idempotencyKey;
    if(operationIds.has(operationId))throw new TypeError(`journal contains duplicate operationId: ${operationId}`);
    if(keys.has(idempotencyKey))throw new TypeError(`journal contains duplicate idempotencyKey: ${idempotencyKey}`);
    if(sequences.has(record.sequence))throw new TypeError(`journal contains duplicate sequence: ${record.sequence}`);
    operationIds.add(operationId);keys.add(idempotencyKey);sequences.add(record.sequence);
  }
}
function normalizeJournal(value){
  if(!plainObject(value))throw new TypeError('shadow journal must be an object.');
  if(value.journalSchemaVersion!==JOURNAL_SCHEMA_VERSION)throw new TypeError(`journalSchemaVersion must equal ${JOURNAL_SCHEMA_VERSION}.`);
  const limits=normalizeLimits(value.limits);
  if(!Array.isArray(value.liveOperations))throw new TypeError('journal.liveOperations must be an array.');
  if(!Array.isArray(value.receipts))throw new TypeError('journal.receipts must be an array.');
  if(value.liveOperations.length>limits.liveOperationCap)throw new RangeError('journal.liveOperations exceeds liveOperationCap.');
  if(value.receipts.length>limits.receiptCap)throw new RangeError('journal.receipts exceeds receiptCap.');
  const liveOperations=value.liveOperations.map((row,index)=>normalizeLiveEntry(row,limits,`journal.liveOperations[${index}]`));
  const receipts=value.receipts.map((row,index)=>normalizeReceipt(row,`journal.receipts[${index}]`));
  const livePostingCount=liveOperations.reduce((sum,row)=>sum+row.postingCount,0);
  if(livePostingCount>limits.livePostingCap)throw new RangeError('journal live postings exceed livePostingCap.');
  assertUniqueIdentity([...liveOperations,...receipts]);
  const ordered=[...liveOperations,...receipts].sort((a,b)=>a.sequence-b.sequence);
  for(let i=1;i<ordered.length;i++)if(ordered[i].sequence<=ordered[i-1].sequence)throw new TypeError('journal sequences must be unique and increasing.');
  const checkpoint=normalizeCheckpoint(value.checkpoint);
  const maxSequence=ordered.reduce((max,row)=>Math.max(max,row.sequence),checkpoint.compactedThroughSequence);
  const nextSequence=positiveInteger(value.nextSequence,'journal.nextSequence');
  if(nextSequence<=maxSequence)throw new TypeError('journal.nextSequence must exceed all retained/compacted sequences.');
  const latestPeriod=nonNegativeInteger(value.latestPeriod,'journal.latestPeriod');
  if(checkpoint.compactedOperationCount===0&&checkpoint.chainDigest!==EMPTY_CHAIN_DIGEST)throw new TypeError('empty checkpoint must use the empty chain digest.');
  if(checkpoint.compactedOperationCount>0&&checkpoint.compactedThroughSequence===0)throw new TypeError('non-empty checkpoint requires compactedThroughSequence.');
  if(ordered.some(row=>row.sequence<=checkpoint.compactedThroughSequence))throw new TypeError('retained journal sequences must be newer than compactedThroughSequence.');
  if(latestPeriod<checkpoint.compactedThroughPeriod)throw new TypeError('journal.latestPeriod precedes compactedThroughPeriod.');
  if(ordered.some(row=>row.operationPeriod>latestPeriod))throw new TypeError('journal.latestPeriod precedes a retained operation period.');
  return deepFreeze({
    journalSchemaVersion:JOURNAL_SCHEMA_VERSION,
    limits:{...limits},
    nextSequence,
    latestPeriod,
    liveOperations,
    receipts,
    checkpoint
  });
}
function serialize(journal){return JSON.stringify(normalizeJournal(journal));}
function hydrate(payload){
  if(typeof payload!=='string')throw new TypeError('shadow journal hydrate requires a JSON string payload.');
  return normalizeJournal(JSON.parse(payload));
}
function recordIdentity(record){
  return {
    operationId:record.operation?.operationId??record.operationId,
    idempotencyKey:record.operation?.idempotencyKey??record.idempotencyKey,
    operationDigest:record.operationDigest
  };
}
function findIdentityMatch(journal,operation){
  const records=[...journal.liveOperations,...journal.receipts];
  return records.find(record=>{
    const identity=recordIdentity(record);
    return identity.operationId===operation.operationId||identity.idempotencyKey===operation.idempotencyKey;
  })||null;
}
function append(journalInput,operationInput,options={}){
  const journal=normalizeJournal(journalInput);
  const currentPeriod=nonNegativeInteger(options.currentPeriod,'currentPeriod');
  if(currentPeriod<journal.latestPeriod)throw new RangeError('currentPeriod must be monotonic for the shadow journal.');
  validateOperationForJournal(operationInput);
  const operation=cloneJson(operationInput);
  validateOperationForJournal(operation);
  const operationDigest=digestOperation(operation);
  const existing=findIdentityMatch(journal,operation);
  if(existing){
    const identity=recordIdentity(existing);
    if(identity.operationId===operation.operationId
      &&identity.idempotencyKey===operation.idempotencyKey
      &&identity.operationDigest===operationDigest){
      return deepFreeze({status:'duplicate',journal,evidence:{sequence:existing.sequence,operationDigest}});
    }
    throw new Error(`Shadow journal identity conflict for ${operation.operationId} / ${operation.idempotencyKey}.`);
  }
  const postingCount=operation.postings.length;
  if(postingCount>journal.limits.livePostingCap)throw new RangeError('operation posting count exceeds livePostingCap.');
  const anchorPeriod=operationPeriod(operation,currentPeriod);
  const retentionUntilPeriod=anchorPeriod+journal.limits.idempotencyWindowPeriods;
  if(!Number.isSafeInteger(retentionUntilPeriod))throw new RangeError('idempotency retention period exceeds the safe integer envelope.');
  if(!Number.isSafeInteger(journal.nextSequence+1))throw new RangeError('journal sequence exceeds the safe integer envelope.');
  const entry={
    sequence:journal.nextSequence,
    operation,
    operationDigest,
    operationPeriod:anchorPeriod,
    retentionUntilPeriod,
    postingCount
  };
  let liveOperations=[...journal.liveOperations,entry];
  let receipts=journal.receipts.filter(row=>currentPeriod<=row.retentionUntilPeriod).map(row=>cloneJson(row));
  let checkpoint=cloneJson(journal.checkpoint);
  let livePostingCount=liveOperations.reduce((sum,row)=>sum+row.postingCount,0);
  while(liveOperations.length>journal.limits.liveOperationCap||livePostingCount>journal.limits.livePostingCap){
    const removed=liveOperations.shift();
    livePostingCount-=removed.postingCount;
    checkpoint=checkpointAfter(checkpoint,removed);
    if(currentPeriod<=removed.retentionUntilPeriod)receipts.push(receiptFromEntry(removed));
  }
  receipts.sort((a,b)=>a.sequence-b.sequence);
  if(receipts.length>journal.limits.receiptCap){
    throw new RangeError('Shadow journal exact idempotency receipt capacity exhausted before replay lifetime expiry.');
  }
  const next=normalizeJournal({
    journalSchemaVersion:JOURNAL_SCHEMA_VERSION,
    limits:{...journal.limits},
    nextSequence:journal.nextSequence+1,
    latestPeriod:currentPeriod,
    liveOperations,
    receipts,
    checkpoint
  });
  return deepFreeze({
    status:'accepted',
    journal:next,
    evidence:{
      sequence:entry.sequence,
      operationDigest,
      compacted:next.checkpoint.compactedOperationCount>journal.checkpoint.compactedOperationCount
    }
  });
}
function evidence(journalInput){
  const journal=normalizeJournal(journalInput);
  const livePostingCount=journal.liveOperations.reduce((sum,row)=>sum+row.postingCount,0);
  return deepFreeze({
    journalSchemaVersion:JOURNAL_SCHEMA_VERSION,
    journalDigest:hashText(canonicalSerialize(journal)),
    latestPeriod:journal.latestPeriod,
    nextSequence:journal.nextSequence,
    liveOperationCount:journal.liveOperations.length,
    livePostingCount,
    receiptCount:journal.receipts.length,
    checkpoint:cloneJson(journal.checkpoint),
    bounded:journal.liveOperations.length<=journal.limits.liveOperationCap
      &&livePostingCount<=journal.limits.livePostingCap
      &&journal.receipts.length<=journal.limits.receiptCap
  });
}

modules.economicShadowJournal=Object.freeze({
  JOURNAL_SCHEMA_VERSION,
  DEFAULT_LIMITS,
  EMPTY_CHAIN_DIGEST,
  createJournal,
  append,
  hydrate,
  serialize,
  evidence,
  digestOperation
});
})();
