'use strict';
// Mutation test for tests/helpers/transaction-fault-case.js: a correct command passes, and every
// deliberately broken command / oracle must be rejected by the harness (it must not pass vacuously).
const assert=require('node:assert/strict');
const {scenario,economic,snapshot,assertSplit}=require('./fixtures/stock-split-atomicity');
const {makeTransactionFaultCase,FAULT_KINDS,SOFT_FAILURES}=require('./helpers/transaction-fault-case');
const split=s=>s.game.stockSplit(s.stockID,2);
const make=(overrides={})=>makeTransactionFaultCase({
 name:'split',fixture:family=>scenario(family),command:split,snapshot,economic,
 expectSuccess:(before,after,s)=>assertSplit(before,after,s.stockID,2),
 label:(family,kind,{pending,nested})=>`harness-control ${family}/${kind}/pending=${pending}/nested=${nested}`,
 ...overrides,
});
const MUTANTS=[
 ['mutation outside the transaction is not rolled back','save-false',{command:s=>{s.game.g.companyCash+=1;return split(s);}},/full live rollback/],
 ['non-transactional writer leaves state on save rejection','save-false',{command:s=>{const stock=s.game.stock(s.stockID);stock.price/=2;return s.game.save();}},/full live rollback/],
 ['failed attempt consumes host RNG','save-false',{command:s=>{s.ctx.Math.random();return split(s);}},/Expected values to be strictly equal/],
 ['command bypasses save and writes the mirror directly','save-false',{command:s=>{s.ctx.localStorage.setItem(s.key,'{}');return split(s);}},/Expected values to be strictly equal/],
 ['command writes the durable store directly','save-false',{command:s=>{s.durable.set(s.key,'{}');return split(s);}},/Expected values to be strictly equal/],
 ['fault never reaches an installed writer','save-false',{command:()=>true},/fault reaches installed writer/],
 ['thrown save failure swallowed into a soft false','save-throw',{command:s=>{try{return split(s);}catch{return false;}}},/The input did not match/],
 ['soft failure escalated into a throw','save-false',{command:s=>{const r=split(s);if(r===false)throw new Error('escalated');return r;}},/failed split must return false/],
 ['retry oracle mismatch','save-false',{expectSuccess:(before,after,s)=>assertSplit(before,after,s.stockID,3)},/split oracle/],
];
(async()=>{
 assert.deepEqual([...FAULT_KINDS],['save-false','save-before-throw','mirror','enqueue-false','enqueue-throw','save-throw','saved','change','notify']);
 assert.deepEqual([...SOFT_FAILURES],['save-false','mirror','enqueue-false','enqueue-throw']);
 for(const key of ['name','fixture','command','snapshot','economic','expectSuccess'])assert.throws(()=>make({[key]:undefined}),new RegExp(`requires ${key}`));
 await assert.rejects(make().rejected('external','not-a-fault'),/unknown fault kind/);
 // Positive control: the real installed command passes every soft/throw class, nested and pending.
 const control=make();
 for(const kind of ['save-false','save-throw','save-before-throw'])await control.rejected('external',kind);
 await control.rejected('own','save-false',{nested:true});await control.rejected('own','save-throw',{pending:true});
 for(const [label,kind,overrides,pattern] of MUTANTS){
  await assert.rejects(make(overrides).rejected('external',kind),pattern,`harness must reject mutant: ${label}`);
  console.log(`transaction fault harness rejects mutant: ${label} PASS`);
 }
 console.log('Transaction fault harness mutation PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
