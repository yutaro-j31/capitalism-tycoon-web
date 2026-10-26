'use strict';
// Shared transaction fault harness (#922, design in docs/FAULT_HARNESS_AND_STOCK_SPLIT_ANALYSIS.md).
// Node-only: it drives the installed engine command against the deterministic fake IndexedDB.
// It never implies WebKit coverage; real WebKit / IndexedDB stays a separate per-family test.
const assert=require('node:assert/strict');
const {loadGame}=require('../harness');
const {indexedDBFor,inject}=require('../fixtures/pe-fund-acquisition-faults');

const FAULT_KINDS=Object.freeze(['save-false','save-before-throw','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify']);
// Soft failures return false from the command; every other kind surfaces as a thrown error.
const SOFT_FAILURES=Object.freeze(['save-false','mirror','enqueue-false','enqueue-throw']);
// saveSequence (#726) decides which stored copy boots; it lives only in the stored payload.
const sequenceOf=raw=>Number(/"saveSequence":(\d+)/.exec(String(raw||''))?.[1]);

function injectFault(ctx,kind){
 if(!FAULT_KINDS.includes(kind))throw new Error(`unknown fault kind ${kind}`);
 if(kind!=='save-before-throw')return inject(ctx.game,ctx.modules,ctx.ctx.localStorage,ctx.key,kind);
 const save=ctx.game.save;let hits=0;ctx.game.save=()=>{hits++;throw new Error('save before admission threw');};
 return {hits:()=>hits,restore(){ctx.game.save=save;}};
}

/**
 * fixture:       async (variant) => loadGame() context plus {game, backend, key, durable, control, host}
 * command:       (ctx) => result of the INSTALLED engine method
 * snapshot:      (game) => full normalized state (live rollback oracle)
 * economic:      (state) => state minus save metadata (reload / fresh hydration oracle)
 * expectSuccess: (before, after, ctx) => void (retry / normal-path oracle)
 * name:          noun used in failure messages (e.g. 'split')
 * label:         (variant, kind, options) => log line (without the trailing PASS)
 */
function makeTransactionFaultCase({name,fixture,command,snapshot,economic,expectSuccess,label}){
 for(const [key,value] of Object.entries({name,fixture,command,snapshot,economic,expectSuccess}))
  if(value==null)throw new Error(`makeTransactionFaultCase requires ${key}`);
 async function loaded(ctx,expected){
  const wanted=economic(new ctx.engineModule.TycoonEngine(JSON.parse(JSON.stringify(expected))).g);
  assert.deepEqual(economic(ctx.engineModule.TycoonEngine.load().g),wanted,'production reload');
  const fresh=loadGame({headless:true,indexedDB:indexedDBFor(ctx.durable,{attempts:[]})});await fresh.modules.saveStorageIDB.hydrate();
  assert.deepEqual(economic(fresh.engineModule.TycoonEngine.load().g),wanted,'fresh durable-only hydration');await fresh.modules.saveStorageIDB.flush();
 }
 async function rejected(variant,kind,{pending=false,nested=false}={}){
  const ctx=await fixture(variant);
  if(pending){ctx.control.holdPut=true;assert.equal(ctx.game.save(),true);for(let i=0;i<100&&!ctx.control.release;i++)await new Promise(r=>setImmediate(r));assert.equal(typeof ctx.control.release,'function');}
  const before=snapshot(ctx.game),bytes=ctx.backend.readSync(ctx.key),durable=ctx.durable.get(ctx.key),puts=ctx.control.attempts.length,draws=ctx.host.draws;
  // Observe allocation before rollback restores the predecessor's payload. Reading the
  // restored bytes alone cannot reveal the sequence consumed by a failed admitted save.
  const storageModule=ctx.modules.saveStorageIDB,allocated=[];
  assert.equal(typeof storageModule.nextSequence,'function','installed sequence allocator');
  ctx.modules.saveStorageIDB={...storageModule,nextSequence(...args){const sequence=storageModule.nextSequence(...args);allocated.push(sequence);return sequence;}};
  let injection,result,error;
  try{injection=injectFault(ctx,kind);}catch(ex){ctx.modules.saveStorageIDB=storageModule;throw ex;}
  try{result=nested?ctx.game.runTransaction(()=>command(ctx)):command(ctx);}catch(ex){error=ex;}finally{injection.restore();ctx.modules.saveStorageIDB=storageModule;}
  assert.ok(injection.hits()>0,'fault reaches installed writer');
  if(SOFT_FAILURES.includes(kind)){assert.equal(result,false,`failed ${name} must return false`);assert.equal(error,undefined);}else assert.match(error?.message||'',/threw/);
  assert.deepEqual(snapshot(ctx.game),before,'full live rollback including quantities/history/finance/news/RNG');assert.equal(ctx.host.draws,draws);
  assert.equal(ctx.ctx.__localStorageData.get(ctx.key),bytes);assert.equal(ctx.backend.readSync(ctx.key),bytes);assert.equal(ctx.durable.get(ctx.key),durable);
  ctx.control.release?.();await ctx.backend.flush();assert.equal(ctx.durable.get(ctx.key),bytes,`predecessor preserved, failed ${name} never durable`);assert.equal(ctx.control.attempts.length,puts,'cancel failed pending put');
  const predecessorSequence=sequenceOf(bytes);assert.ok(Number.isSafeInteger(predecessorSequence),'predecessor carries a saveSequence');
  assert.ok(allocated.every(Number.isSafeInteger),'observed allocations are valid sequences');
  if(['save-throw','saved','change','mirror','enqueue-false','enqueue-throw'].includes(kind))assert.ok(allocated.length>0,'admitted-save fault observed an allocation');
  const failedSequence=Math.max(predecessorSequence,...allocated);
  await loaded(ctx,before);assert.equal(ctx.game.save(),true);await ctx.backend.flush();await loaded(ctx,before);
  const recoverySequence=sequenceOf(ctx.backend.readSync(ctx.key));assert.ok(recoverySequence>failedSequence,'recovery save exceeds the allocated failed saveSequence');
  assert.equal(command(ctx),true,`failed ${name} can retry`);expectSuccess(before,snapshot(ctx.game),ctx);await ctx.backend.flush();await loaded(ctx,ctx.game.g);
  assert.ok(sequenceOf(ctx.backend.readSync(ctx.key))>recoverySequence,'retry saveSequence is monotonic');assert.equal(sequenceOf(ctx.durable.get(ctx.key)),sequenceOf(ctx.backend.readSync(ctx.key)),'durable copy carries the latest saveSequence');
  console.log(`${label?label(variant,kind,{pending,nested}):`${name} ${variant}/${kind}/pending=${pending}/nested=${nested}`} PASS`);
 }
 return Object.freeze({name,rejected,loaded,faultKinds:FAULT_KINDS,softFailures:SOFT_FAILURES});
}

module.exports={makeTransactionFaultCase,injectFault,FAULT_KINDS,SOFT_FAILURES};
