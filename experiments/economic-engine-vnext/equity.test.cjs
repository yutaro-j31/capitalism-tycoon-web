'use strict';
const assert=require('node:assert/strict');
const core=require('./core.cjs');
const equity=require('./equity.cjs');
const start=()=>equity.createEquityState(core.createInitialState({bank:100000,company:10000,founder:40000,partner:35000}),[
  {issuer:'company',classId:'ordinary',authorizedShares:2000,votesPerShare:1},
  {issuer:'company',classId:'super',authorizedShares:100,votesPerShare:10}
]);
const issue={id:'issue-1',type:'issue-shares',issuer:'company',subscriber:'founder',classId:'ordinary',shares:10,priceMinor:100};
let passed=0;
function test(name,fun){fun();passed++;console.log('PASS',name);}
function reject(original,op,reason,persist=()=>true){const snapshot=JSON.stringify(original);const r=equity.admitShareIssue(original,op,persist);assert.equal(r.ok,false);assert.equal(r.reason,reason);assert.strictEqual(r.state,original);assert.equal(JSON.stringify(original),snapshot);return r;}
test('blank source-backed share register balances',()=>assert.equal(equity.validateEquityState(start()),true));
test('paid in capital keeps every entity balanced',()=>{
 const s=start(),r=equity.admitShareIssue(s,issue,()=>true);assert.equal(r.ok,true);
 assert.equal(r.state.core.balances['company:cash'],11000);assert.equal(r.state.core.balances['founder:cash'],39000);
 assert.equal(r.state.equityBalances['company:paid-in:company:ordinary'],-1000);
 assert.equal(r.state.equityBalances['founder:investment:company:ordinary'],1000);
 assert.equal(r.state.classes['company:ordinary'].issuedShares,10);
 assert.equal(equity.validateEquityState(r.state),true);
 assert.equal(s.classes['company:ordinary'].issuedShares,0);
});
test('two subscription operations add positions deterministically',()=>{
 const s=equity.admitShareIssue(start(),issue,()=>true).state;
 const op={...issue,id:'issue-2',shares:5,priceMinor:200};
 const r=equity.admitShareIssue(s,op,()=>true);assert.equal(r.ok,true);
 const pos=r.state.classes['company:ordinary'].holders.founder;
 assert.deepEqual(pos,{shares:15,costMinor:2000});assert.equal(r.state.equityBalances['company:paid-in:company:ordinary'],-2000);
 assert.equal(equity.validateEquityState(r.state),true);
});
test('single class ownership exact fractions',()=>{
 const a=equity.admitShareIssue(start(),issue,()=>true).state;
 const b=equity.admitShareIssue(a,{...issue,id:'partner-1',subscriber:'partner',shares:5},()=>true).state;
 const view=equity.ownershipSnapshot(b,'company');assert.equal(view.totalShares,'15');assert.equal(view.totalVotes,'15');
 assert.deepEqual(view.holders.map(x=>x.holder),['founder','partner']);
 assert.deepEqual(view.holders[0].shareRatio,{numerator:'10',denominator:'15'});
});
test('class voting weights differ from economic share ratio',()=>{
 const a=equity.admitShareIssue(start(),issue,()=>true).state;
 const b=equity.admitShareIssue(a,{...issue,id:'partner-super',classId:'super',subscriber:'partner',shares:10},()=>true).state;
 const view=equity.ownershipSnapshot(b,'company');assert.equal(view.totalShares,'20');assert.equal(view.totalVotes,'110');
 assert.deepEqual(view.holders.find(x=>x.holder==='partner').voteRatio,{numerator:'100',denominator:'110'});
});
test('duplicate receipt cannot mint extra shares',()=>{
 const s=equity.admitShareIssue(start(),issue,()=>true).state;reject(s,issue,'duplicate-operation');
});
test('authorization cap rejects overflow',()=>reject(start(),{...issue,shares:2001},'exceeds-authorized'));
test('unknown issuer rejects',()=>reject(start(),{...issue,issuer:'unknown'},'invalid-issuer-subscriber'));
test('issuer cannot subscribe own shares',()=>reject(start(),{...issue,subscriber:'company'},'invalid-issuer-subscriber'));
test('unknown share class rejects',()=>reject(start(),{...issue,classId:'ghost'},'invalid-issuer-subscriber'));
test('insufficient subscriber funds rejects',()=>reject(start(),{...issue,shares:1000,priceMinor:1000},'negative-cash'));
test('zero and fractional share count rejects',()=>{
 for(const v of [0,-1,0.1,Infinity,NaN])reject(start(),{...issue,shares:v},'invalid-shares');
});
test('negative/noninteger price rejects',()=>{
 for(const v of [0,-1,0.1,Infinity,NaN])reject(start(),{...issue,priceMinor:v},'invalid-price');
});
test('price times shares overflow fails closed',()=>reject(start(),{...issue,priceMinor:Number.MAX_SAFE_INTEGER},'overflow-subscription'));
test('save false rejects capital and shares together',()=>reject(start(),issue,'persistence-rejected',()=>false));
test('save throws rejects capital and shares together',()=>reject(start(),issue,'persistence-threw',()=>{throw Error('write fail');}));
test('persistence callback absent fails closed',()=>{const s=start(),r=equity.admitShareIssue(s,issue);assert.equal(r.ok,false);assert.equal(r.reason,'persistence-required');assert.strictEqual(r.state,s);});
test('callback cannot mutate staged state',()=>{
 const s=start(),r=equity.admitShareIssue(s,issue,v=>{v.core.balances['company:cash']=10;return true;});
 assert.equal(r.ok,true);assert.equal(r.state.core.balances['company:cash'],11000);
});
test('same seed produces identical cap table and ledger',()=>{
 const x=equity.admitShareIssue(start(),issue,()=>true).state;
 const y=equity.admitShareIssue(start(),issue,()=>true).state;assert.deepEqual(x,y);
});
test('tampered share position caught',()=>{
 const s=equity.admitShareIssue(start(),issue,()=>true).state;s.classes['company:ordinary'].holders.founder.shares=100;
 assert.throws(()=>equity.validateEquityState(s),/share-conservation/);
});
test('tampered capital posting caught',()=>{
 const s=equity.admitShareIssue(start(),issue,()=>true).state;s.equityBalances['company:paid-in:company:ordinary']=-999;
 assert.throws(()=>equity.validateEquityState(s),/equity-book-mismatch/);
});
test('missing receipt in core caught',()=>{
 const s=equity.admitShareIssue(start(),issue,()=>true).state;delete s.core.receipts['issue-1'];
 assert.throws(()=>equity.validateEquityState(s),/receipt-count-mismatch/);
});
test('invalid class declaration caught',()=>{
 assert.throws(()=>equity.createEquityState(core.createInitialState({company:100,founder:200}),[{issuer:'company',classId:'ordinary',authorizedShares:100,votesPerShare:0}]),/invalid-votes/);
});
test('prototype-like legal entity ids do not escape holder ledger',()=>{
 const base=core.createInitialState({bank:100000,company:10000,constructor:40000});
 const s=equity.createEquityState(base,[{issuer:'company',classId:'ordinary',authorizedShares:20,votesPerShare:1}]);
 const r=equity.admitShareIssue(s,{id:'constructor-issue',type:'issue-shares',issuer:'company',subscriber:'constructor',classId:'ordinary',shares:5,priceMinor:100},()=>true);
 assert.equal(r.ok,true);assert.equal(r.state.classes['company:ordinary'].holders.constructor.shares,5);
});
test('equity issue is pure planning before admission',()=>{
 const s=start(),r=equity.planShareIssue(s,issue);assert.equal(r.ok,true);assert.equal(s.classes['company:ordinary'].issuedShares,0);assert.equal(r.state.classes['company:ordinary'].issuedShares,10);
});
console.log('VNext SPIKE-1: '+passed+' tests passed. No IDB/WebKit/v9 claim.');
