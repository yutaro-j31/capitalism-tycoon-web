'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');

const source=fs.readFileSync(path.join(__dirname,'..','js','economic-shadow-journal.js'),'utf8');
for(const [label,pattern] of [
  ['host RNG',/Math\.random\s*\(/],
  ['wall clock',/Date\.now\s*\(/],
  ['simulation RNG',/simulationRng/],
  ['save call',/\.save\s*\(/],
  ['emit call',/\.emit\s*\(/],
  ['finance event',/finance\.event\s*\(/],
  ['company cash writer',/companyCash\s*=/],
  ['personal cash writer',/personalCash\s*=/],
  ['company debt writer',/companyDebt\s*=/],
  ['personal debt writer',/personalDebt\s*=/]
]){
  assert.equal(pattern.test(source),false,`economic shadow journal must not depend on ${label}`);
}

const loaded=loadGame({headless:true});
const journal=loaded.modules.economicShadowJournal;
const opCore=loaded.modules.economicOperation;
assert.ok(journal,'economicShadowJournal must load through production index.html');
assert.equal(journal.JOURNAL_SCHEMA_VERSION,1);
assert.deepEqual({...journal.DEFAULT_LIMITS},{
  liveOperationCap:512,
  livePostingCap:8192,
  receiptCap:4096,
  idempotencyWindowPeriods:260
});

function operation(sequence,amount=sequence*100,overrides={}){
  const operationId=overrides.operationId||`shadow-op-${sequence}`;
  const idempotencyKey=overrides.idempotencyKey||`shadow-key-${sequence}`;
  const period=overrides.period??sequence;
  const status=overrides.status||'committed';
  const row={
    schemaVersion:opCore.SCHEMA_VERSION,
    operationId,
    idempotencyKey,
    operationType:'shadow:test-payment',
    decisionPeriod:period,
    settlementPeriod:period,
    status,
    metadata:{fixture:'p1-3',sequence},
    postings:[
      {
        postingId:`${operationId}:0`,
        operationId,
        postingSequence:0,
        entityId:'entity:company:player',
        accountId:'expense:operating',
        side:'debit',
        amount,
        currency:'JPY',
        metadata:{fixture:'expense'}
      },
      {
        postingId:`${operationId}:1`,
        operationId,
        postingSequence:1,
        entityId:'entity:company:player',
        accountId:'asset:cash',
        side:'credit',
        amount,
        currency:'JPY',
        metadata:{fixture:'cash'}
      }
    ]
  };
  assert.equal(opCore.validateOperation(row).ok,true,JSON.stringify(opCore.validateOperation(row)));
  return row;
}

const engine=new loaded.engineModule.TycoonEngine();
const authoritativeBefore=JSON.stringify(engine.g);

const limits={
  liveOperationCap:2,
  livePostingCap:4,
  receiptCap:4,
  idempotencyWindowPeriods:3
};
let state=journal.createJournal(limits);
assert.equal(Object.isFrozen(state),true);
assert.equal(state.liveOperations.length,0);
assert.equal(state.receipts.length,0);
assert.equal(state.checkpoint.chainDigest,journal.EMPTY_CHAIN_DIGEST);

const first=journal.append(state,operation(1),{currentPeriod:1});
assert.equal(first.status,'accepted');
state=first.journal;
assert.equal(state.liveOperations.length,1);
assert.equal(state.receipts.length,0);
assert.equal(state.nextSequence,2);

state=journal.append(state,operation(2),{currentPeriod:2}).journal;
assert.equal(state.liveOperations.length,2);
assert.equal(state.receipts.length,0);

const third=journal.append(state,operation(3),{currentPeriod:3});
assert.equal(third.status,'accepted');
assert.equal(third.evidence.compacted,true);
state=third.journal;
assert.deepEqual(Array.from(state.liveOperations).map(row=>row.operation.operationId),['shadow-op-2','shadow-op-3']);
assert.deepEqual(Array.from(state.receipts).map(row=>row.operationId),['shadow-op-1']);
assert.equal(state.checkpoint.compactedOperationCount,1);
assert.equal(state.checkpoint.compactedPostingCount,2);
assert.equal(state.checkpoint.compactedThroughSequence,1);
assert.equal(state.checkpoint.compactedThroughPeriod,1);
assert.notEqual(state.checkpoint.chainDigest,journal.EMPTY_CHAIN_DIGEST);

const serialized=journal.serialize(state);
const hydrated=journal.hydrate(serialized);
assert.equal(journal.serialize(hydrated),serialized,'hydrate/serialize must be stable');
assert.equal(journal.evidence(hydrated).bounded,true);
assert.equal(journal.evidence(hydrated).liveOperationCount,2);
assert.equal(journal.evidence(hydrated).livePostingCount,4);
assert.equal(journal.evidence(hydrated).receiptCount,1);

// Compacted receipts belong to the checkpointed sequence range, while live
// operations must remain strictly newer than the checkpoint.
{
  const wrongReceipt=JSON.parse(serialized);
  wrongReceipt.receipts[0].sequence=wrongReceipt.checkpoint.compactedThroughSequence+1;
  assert.throws(
    ()=>journal.hydrate(JSON.stringify(wrongReceipt)),
    /compacted receipts must not be newer/
  );

  const wrongLive=JSON.parse(serialized);
  wrongLive.liveOperations[0].sequence=wrongLive.checkpoint.compactedThroughSequence;
  assert.throws(
    ()=>journal.hydrate(JSON.stringify(wrongLive)),
    /live operation sequences must be newer/
  );

  const impossibleEmpty=journal.createJournal(limits);
  const tamperedEmpty=JSON.parse(journal.serialize(impossibleEmpty));
  tamperedEmpty.checkpoint.compactedPostingCount=1;
  assert.throws(
    ()=>journal.hydrate(JSON.stringify(tamperedEmpty)),
    /empty checkpoint cannot retain compacted counts/
  );
}

const beforeDuplicate=journal.serialize(hydrated);
const duplicate=journal.append(hydrated,operation(1),{currentPeriod:3});
assert.equal(duplicate.status,'duplicate');
assert.equal(journal.serialize(duplicate.journal),beforeDuplicate,'duplicate replay must not change the journal');
assert.equal(duplicate.evidence.sequence,1);

assert.throws(
  ()=>journal.append(hydrated,operation(1,999,{idempotencyKey:'shadow-key-conflict'}),{currentPeriod:3}),
  /identity conflict/
);
assert.throws(
  ()=>journal.append(hydrated,operation(99,999,{idempotencyKey:'shadow-key-1'}),{currentPeriod:3}),
  /identity conflict/
);
assert.throws(
  ()=>journal.append(hydrated,operation(4,400,{status:'pending'}),{currentPeriod:4}),
  /committed EconomicOperations only/
);
assert.throws(
  ()=>journal.append(hydrated,operation(4),{currentPeriod:2}),
  /currentPeriod must be monotonic/
);
assert.throws(()=>journal.hydrate({...hydrated}),/JSON string payload/);

const checkpointBeforeExpiry=hydrated.checkpoint.chainDigest;
const afterExpiry=journal.append(hydrated,operation(4,400,{period:10}),{currentPeriod:10}).journal;
assert.equal(afterExpiry.receipts.length,0,'expired exact receipts may be retired');
assert.equal(afterExpiry.checkpoint.compactedOperationCount,2);
assert.equal(afterExpiry.checkpoint.compactedPostingCount,4);
assert.notEqual(afterExpiry.checkpoint.chainDigest,checkpointBeforeExpiry,'checkpoint chain must retain compacted history evidence');
assert.equal(journal.evidence(afterExpiry).bounded,true);

// Same input sequence produces byte-identical shadow evidence.
let left=journal.createJournal(limits);
let right=journal.createJournal(limits);
for(let i=1;i<=6;i++){
  left=journal.append(left,operation(i),{currentPeriod:i}).journal;
  right=journal.append(right,operation(i),{currentPeriod:i}).journal;
}
assert.equal(journal.serialize(left),journal.serialize(right));
assert.deepEqual(journal.evidence(left),journal.evidence(right));

// Exact idempotency evidence is bounded and fails closed while receipts are still live.
const tightLimits={
  liveOperationCap:1,
  livePostingCap:2,
  receiptCap:1,
  idempotencyWindowPeriods:100
};
let tight=journal.createJournal(tightLimits);
tight=journal.append(tight,operation(21,2100,{period:1}),{currentPeriod:1}).journal;
tight=journal.append(tight,operation(22,2200,{period:2}),{currentPeriod:2}).journal;
assert.equal(tight.receipts.length,1);
const tightBefore=journal.serialize(tight);
assert.throws(
  ()=>journal.append(tight,operation(23,2300,{period:3}),{currentPeriod:3}),
  /receipt capacity exhausted/
);
assert.equal(journal.serialize(tight),tightBefore,'failed capacity append must leave caller journal unchanged');

// One operation cannot exceed the entire live posting envelope.
const fourLeg=operation(30,3000);
fourLeg.postings=[
  {...fourLeg.postings[0],postingId:'shadow-op-30:0',postingSequence:0,amount:1500},
  {...fourLeg.postings[0],postingId:'shadow-op-30:1',postingSequence:1,amount:1500},
  {...fourLeg.postings[1],postingId:'shadow-op-30:2',postingSequence:2,amount:1500},
  {...fourLeg.postings[1],postingId:'shadow-op-30:3',postingSequence:3,amount:1500}
];
assert.equal(opCore.validateOperation(fourLeg).ok,true,JSON.stringify(opCore.validateOperation(fourLeg)));
assert.throws(
  ()=>journal.append(journal.createJournal({liveOperationCap:2,livePostingCap:2,receiptCap:2,idempotencyWindowPeriods:2}),fourLeg,{currentPeriod:30}),
  /posting count exceeds livePostingCap/
);

assert.equal(JSON.stringify(engine.g),authoritativeBefore,'shadow journal must not mutate authoritative game state');

console.log('economic shadow journal tests passed');
