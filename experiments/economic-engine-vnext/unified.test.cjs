'use strict';
const assert=require('node:assert/strict');
const core=require('./core.cjs');
const u=require('./unified.cjs');
const store=require('./store.cjs');
const seed=()=>u.createUnifiedState(core.createInitialState({company:10000,founder:50000,investor:50000,customer:30000,supplier:0,employee:0}),[
{issuer:'company',classId:'ordinary',authorizedShares:1000,votesPerShare:1},
{issuer:'company',classId:'super',authorizedShares:100,votesPerShare:10}
]);
const issue={type:'issue-shares',id:'issue-1',issuer:'company',subscriber:'founder',classId:'ordinary',shares:10,priceMinor:100};
const week={type:'settle-store-week',company:'company',customer:'customer',supplier:'supplier',employee:'employee',storeId:'ramen',week:1,salesMinor:5000,materialsMinor:2000,wagesMinor:1000};
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
function rejected(original,action,reason,fn=u.admitIssue,persist=()=>true){
 const before=JSON.stringify(original),r=fn(original,action,persist);
 assert.equal(r.ok,false,reason+': '+r.reason);
 assert.equal(r.reason,reason);
 assert.strictEqual(r.state,original);
 assert.equal(JSON.stringify(original),before);
}
function startIssued(){const r=u.admitIssue(seed(),issue,()=>true);assert.equal(r.ok,true,r.reason);return r.state;}
function startWeek(s){const r=u.admitWeek(s,week,()=>true);assert.equal(r.ok,true,r.reason);return r.state;}
test('empty cap table accepts genesis',()=>assert.equal(u.validateUnifiedState(seed()),true));
test('issuer and founder have one canonical paid-in journal',()=>{
 const a=startIssued(),j=a.core.journal[0];
 assert.equal(j.type,'journal');assert.equal(j.postings.length,4);
 assert.equal(a.core.balances['company:cash'],11000);
 assert.equal(a.core.balances['founder:cash'],49000);
 assert.equal(a.core.balances['company:paid-in:company-ordinary'],-1000);
 assert.equal(a.core.balances['founder:investment:company-ordinary'],1000);
 assert.equal(a.classes['company:ordinary'].issuedShares,10);
 assert.equal(a.core.receipts['issue-1'],1);
 assert.equal(u.validateUnifiedState(a),true);
});
test('each entity stays individually balanced',()=>{
 const a=startIssued(),totals=Object.fromEntries(a.core.entities.map(e=>[e,0n]));
 for(const [k,v] of Object.entries(a.core.balances))totals[k.split(':')[0]]+=BigInt(v);
 for(const total of Object.values(totals))assert.equal(total,0n);
});
test('one issue followed by store in SAME balances and receipts',()=>{
 const a=startWeek(startIssued()),b=a.core.balances;
 assert.equal(a.core.journal.length,2);assert.equal(a.core.receipts['issue-1'],1);
 assert.equal(a.core.receipts['store-company-ramen-w1'],2);
 assert.equal(b['company:cash'],13000);
 assert.equal(b['company:paid-in:company-ordinary'],-1000);
 assert.equal(b['company:revenue:ramen'],-5000);
 assert.equal(b['company:expense:ramen-materials'],2000);
 assert.equal(b['company:expense:ramen-wages'],1000);
 assert.equal(b['founder:investment:company-ordinary'],1000);
 assert.equal(store.storeSnapshot(a.core,'company','ramen').profitMinor,2000);
 assert.equal(u.validateUnifiedState(a),true);
});
test('store then issuance yields same economic closing balances',()=>{
 const x=startWeek(startIssued()).core.balances;
 const base=startWeek(seed());
 const r=u.admitIssue(base,{...issue},()=>true);
 assert.equal(r.ok,true,r.reason);
 assert.deepEqual(r.state.core.balances,x);
});
test('two investors preserve separate beneficial ownership',()=>{
 const a=startIssued();
 const r=u.admitIssue(a,{...issue,id:'issue-2',subscriber:'investor',shares:20,priceMinor:200},()=>true);
 assert.equal(r.ok,true,r.reason);
 assert.equal(r.state.classes['company:ordinary'].issuedShares,30);
 assert.equal(r.state.core.balances['company:paid-in:company-ordinary'],-5000);
 assert.equal(r.state.core.balances['investor:investment:company-ordinary'],4000);
 assert.equal(u.validateUnifiedState(r.state),true);
});
test('multiple classes use exact weighted voting ratios',()=>{
 const a=startIssued();
 const r=u.admitIssue(a,{...issue,id:'issue-2',subscriber:'investor',classId:'super',shares:10,priceMinor:100},()=>true);
 assert.equal(r.ok,true,r.reason);
 const view=u.snapshot(r.state,'company');
 assert.equal(view.totalShares,'20');assert.equal(view.totalVotes,'110');
 assert.deepEqual(view.holders.find(h=>h.holder==='investor').voteRatio,{numerator:'100',denominator:'110'});
});
test('duplicate issue id cannot mint shares',()=>rejected(startIssued(),issue,'duplicate-operation'));
test('no founder sufficient cash blocks issue',()=>rejected(seed(),{...issue,shares:900,priceMinor:100},'negative-cash'));
test('authorized cap blocks issue',()=>rejected(seed(),{...issue,shares:1001},'exceeds-authorized'));
test('issuer cannot be subscriber',()=>rejected(seed(),{...issue,subscriber:'company'},'invalid-issuer-subscriber'));
test('nonexistent issuer class refused',()=>rejected(seed(),{...issue,classId:'phantom'},'invalid-issuer-subscriber'));
test('zero shares refused',()=>rejected(seed(),{...issue,shares:0},'invalid-shares'));
test('fractional shares refused',()=>rejected(seed(),{...issue,shares:1.5},'invalid-shares'));
test('nonfinite price refused',()=>rejected(seed(),{...issue,priceMinor:Infinity},'invalid-price'));
test('integer overflow subscription refused',()=>rejected(seed(),{...issue,priceMinor:Number.MAX_SAFE_INTEGER},'overflow-subscription'));
test('save false prevents both share mint and money movement',()=>rejected(seed(),issue,'persistence-rejected',u.admitIssue,()=>false));
test('save throws prevents both share mint and money movement',()=>rejected(seed(),issue,'persistence-threw',u.admitIssue,()=>{throw Error('storage');}));
test('missing persistence fails closed',()=>{const s=seed(),r=u.admitIssue(s,issue);assert.equal(r.ok,false);assert.equal(r.reason,'persistence-required');assert.strictEqual(r.state,s);});
test('store save-false preserves existing equity',()=>rejected(startIssued(),week,'persistence-rejected',u.admitWeek,()=>false));
test('store save-throw preserves existing equity',()=>rejected(startIssued(),week,'persistence-threw',u.admitWeek,()=>{throw Error('fault');}));
test('duplicate store week cannot double-book revenue',()=>rejected(startWeek(startIssued()),week,'duplicate-operation',u.admitWeek));
test('persist callback receives immutable copy',()=>{const a=u.admitIssue(seed(),issue,s=>{s.core.balances['company:cash']=99;s.classes['company:ordinary'].issuedShares=999;return true;});assert.equal(a.ok,true);assert.equal(a.state.classes['company:ordinary'].issuedShares,10);assert.equal(a.state.core.balances['company:cash'],11000);});
test('no hidden second equity balance map',()=>{const a=startIssued();assert.equal(Object.prototype.hasOwnProperty.call(a,'equityBalances'),false);assert.equal(Object.keys(a).sort().join(','),'classes,core,issues,schemaVersion');});
test('tamper cash without journal causes failure',()=>{const s=startIssued();s.core.balances['company:cash']++;assert.throws(()=>u.validateUnifiedState(s),/unbalanced-state|balance-journal-mismatch/);});
test('tamper issued shares without receipt causes failure',()=>{const s=startIssued();s.classes['company:ordinary'].issuedShares++;assert.throws(()=>u.validateUnifiedState(s),/share-conservation/);});
test('tamper subscriber cost basis without receipt causes failure',()=>{const s=startIssued();s.classes['company:ordinary'].holders.founder.costMinor+=100;assert.throws(()=>u.validateUnifiedState(s),/holder-position-mismatch/);});
test('tamper core paid-in account without issue causes failure',()=>{const s=startIssued();s.core.balances['company:paid-in:company-ordinary']++;assert.throws(()=>u.validateUnifiedState(s),/unbalanced-state|balance-journal-mismatch/);});
test('tamper receipt-to-journal share count causes failure',()=>{const s=startIssued();s.issues[0].shares++;assert.throws(()=>u.validateUnifiedState(s),/subscription-price-mismatch/);});
test('unverified extra capital writer rejected despite per-entity balance',()=>{
 const s=startIssued();
 const forged=core.planOperation(s.core,{id:'forge-capital',type:'journal',postings:[{account:'company:paid-in:company-ordinary',deltaMinor:-1},{account:'company:investment:company-ordinary',deltaMinor:1}]});
 assert.equal(forged.ok,true,forged.reason);
 s.core=forged.state;
 assert.throws(()=>u.validateUnifiedState(s),/capital-account-keys|capital-ledger-mismatch|unverified-capital-writer/);
});
test('raw transfer intentionally forbidden in unified ledger',()=>{
 const s=seed(),r=core.planOperation(s.core,{id:'raw-transfer',type:'transfer',from:'founder',to:'company',amountMinor:100});
 assert.equal(r.ok,true,r.reason);
 s.core=r.state;
 assert.throws(()=>u.validateUnifiedState(s),/entity-journal-imbalance|raw-transfer-forbidden/);
});
test('borrow remains a balanced supported core journal',()=>{
 const s=startIssued(),r=core.planOperation(s.core,{id:'loan-1',type:'borrow',borrower:'company',lender:'founder',loanId:'bank-loan',amountMinor:1000});
 assert.equal(r.ok,true,r.reason);s.core=r.state;
 assert.equal(u.validateUnifiedState(s),true);
});
test('bad issuer class definition refused',()=>{
 assert.throws(()=>u.createUnifiedState(core.createInitialState({company:1000,founder:1000}),[{issuer:'company',classId:'ordinary',authorizedShares:0,votesPerShare:1}]),/invalid-authorized/);
});
test('nonempty core not a permissible genesis',()=>{
 const c=core.createInitialState({company:1000,founder:1000});
 const r=core.planOperation(c,{id:'loan-1',type:'borrow',borrower:'company',lender:'founder',loanId:'loan',amountMinor:100});
 assert.equal(r.ok,true);
 assert.throws(()=>u.createUnifiedState(r.state,[{issuer:'company',classId:'ordinary',authorizedShares:10,votesPerShare:1}]),/nonempty-genesis/);
});
test('different runs with same input produce identical states',()=>{const a=startWeek(startIssued()),b=startWeek(startIssued());assert.deepEqual(a,b);});
test('snapshot is pure and cannot mutate source',()=>{
 const a=startIssued(),before=JSON.stringify(a),s=u.snapshot(a,'company');
 assert.equal(s.holders[0].holder,'founder');
 assert.equal(JSON.stringify(a),before);
});
console.log('SPIKE-3 '+passed+' unified journal tests PASS; no IDB/WebKit/v9 claim.');
