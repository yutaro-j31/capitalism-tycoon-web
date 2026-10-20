'use strict';
// SPIKE-3: ONE canonical core journal for investor capital + store activity.
// Isolated experiment. Never imported from the production game.
const core=require('./core.cjs');
const store=require('./store.cjs');
const MAX=BigInt(Number.MAX_SAFE_INTEGER);
const has=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const copy=v=>JSON.parse(JSON.stringify(v));
function ident(v,label) {
  if(typeof v!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(v))throw Error('invalid-'+label);
  return v;
}
function pos(v,label) {
  if(!Number.isSafeInteger(v)||v<=0)throw Error('invalid-'+label);
  return v;
}
function safe(v,label) {
  if(v<0n||v>MAX)throw Error('overflow-'+label);
  return Number(v);
}
function classKey(issuer,classId){return ident(issuer,'issuer')+':'+ident(classId,'class');}
function accountTag(issuer,classId){return ident(ident(issuer,'issuer')+'-'+ident(classId,'class'),'account-tag');}
function investment(holder,tag){return holder+':investment:'+tag;}
function capital(issuer,tag){return issuer+':paid-in:'+tag;}
function accountParts(postings,allowed) {
  const totals=Object.fromEntries(allowed.map(x=>[x,0n]));
  for(const p of postings){
    const owner=p.account.split(':')[0];
    if(!has(totals,owner))throw Error('invalid-journal-owner');
    totals[owner]+=BigInt(p.deltaMinor);
  }
  if(Object.values(totals).some(v=>v!==0n))throw Error('entity-journal-imbalance');
}
function createUnifiedState(coreState,definitions) {
  core.validateState(coreState);
  if(coreState.journal.length!==0)throw Error('nonempty-genesis');
  if(!Array.isArray(definitions)||definitions.length===0||definitions.length>50)throw Error('invalid-classes');
  const classes=Object.create(null);
  for(const def of definitions){
    if(!def||!coreState.entities.includes(def.issuer))throw Error('unknown-issuer');
    const key=classKey(def.issuer,def.classId);
    accountTag(def.issuer,def.classId);
    if(has(classes,key))throw Error('duplicate-class');
    classes[key]={issuer:def.issuer,classId:def.classId,authorizedShares:pos(def.authorizedShares,'authorized'),votesPerShare:pos(def.votesPerShare,'votes'),issuedShares:0,holders:{}};
  }
  const state={schemaVersion:1,core:copy(coreState),classes,issues:[]};
  validateUnifiedState(state);
  return state;
}
function expectedLegs(issue) {
  const tag=accountTag(issue.issuer,issue.classId);
  return [
    {account:issue.subscriber+':cash',deltaMinor:-issue.amountMinor},
    {account:investment(issue.subscriber,tag),deltaMinor:issue.amountMinor},
    {account:issue.issuer+':cash',deltaMinor:issue.amountMinor},
    {account:capital(issue.issuer,tag),deltaMinor:-issue.amountMinor}
  ];
}
function validateUnifiedState(state) {
  if(!state||state.schemaVersion!==1||!state.classes||typeof state.classes!=='object'||Array.isArray(state.classes)||!Array.isArray(state.issues))throw Error('invalid-unified-state');
  core.validateState(state.core);
  const entities=state.core.entities;
  const expectedClasses=Object.create(null);
  for(const [key,c] of Object.entries(state.classes)){
    if(!c||!entities.includes(c.issuer)||classKey(c.issuer,c.classId)!==key)throw Error('class-authority');
    accountTag(c.issuer,c.classId);
    pos(c.authorizedShares,'authorized');pos(c.votesPerShare,'votes');
    if(!Number.isSafeInteger(c.issuedShares)||c.issuedShares<0||c.issuedShares>c.authorizedShares||!c.holders||typeof c.holders!=='object'||Array.isArray(c.holders))throw Error('invalid-issued-shares');
    expectedClasses[key]={issued:0n,holders:Object.create(null)};
  }
  const expectedBooks=Object.create(null),issueIds=new Set();
  for(const item of state.issues){
    if(!item||typeof item.operationId!=='string'||issueIds.has(item.operationId))throw Error('invalid-issue-id');
    ident(item.operationId,'operation-id');issueIds.add(item.operationId);
    const key=classKey(item.issuer,item.classId);
    if(!has(expectedClasses,key)||!entities.includes(item.subscriber)||item.issuer===item.subscriber)throw Error('invalid-issue-party');
    pos(item.shares,'shares');pos(item.priceMinor,'price');pos(item.amountMinor,'amount');
    if(BigInt(item.shares)*BigInt(item.priceMinor)!==BigInt(item.amountMinor))throw Error('subscription-price-mismatch');
    if(!Number.isSafeInteger(item.sequence)||item.sequence<1||state.core.receipts[item.operationId]!==item.sequence)throw Error('missing-issue-receipt');
    const j=state.core.journal[item.sequence-1],legs=expectedLegs(item);
    if(!j||j.operationId!==item.operationId||j.type!=='journal'||JSON.stringify(j.postings)!==JSON.stringify(legs))throw Error('issue-journal-mismatch');
    const cl=expectedClasses[key];cl.issued+=BigInt(item.shares);
    if(cl.issued>MAX)throw Error('issued-overflow');
    if(!has(cl.holders,item.subscriber))cl.holders[item.subscriber]={shares:0n,costMinor:0n};
    cl.holders[item.subscriber].shares+=BigInt(item.shares);
    cl.holders[item.subscriber].costMinor+=BigInt(item.amountMinor);
    const tag=accountTag(item.issuer,item.classId);
    const inv=investment(item.subscriber,tag),cap=capital(item.issuer,tag);
    expectedBooks[inv]=(expectedBooks[inv]||0n)+BigInt(item.amountMinor);
    expectedBooks[cap]=(expectedBooks[cap]||0n)-BigInt(item.amountMinor);
  }
  for(const [key,c] of Object.entries(state.classes)){
    const expected=expectedClasses[key];
    if(BigInt(c.issuedShares)!==expected.issued||expected.issued>BigInt(c.authorizedShares))throw Error('share-conservation');
    const current=Object.keys(c.holders).sort(),needed=Object.keys(expected.holders).sort();
    if(JSON.stringify(current)!==JSON.stringify(needed))throw Error('holder-conservation');
    for(const holder of current){
      if(!entities.includes(holder)||holder===c.issuer)throw Error('invalid-holder');
      const p=c.holders[holder],want=expected.holders[holder];
      if(!p||!Number.isSafeInteger(p.shares)||!Number.isSafeInteger(p.costMinor)||BigInt(p.shares)!==want.shares||BigInt(p.costMinor)!==want.costMinor)throw Error('holder-position-mismatch');
    }
  }
  const canonicalBooks=Object.entries(state.core.balances).filter(([k])=>k.includes(':investment:')||k.includes(':paid-in:'));
  if(JSON.stringify(canonicalBooks.map(([k])=>k).sort())!==JSON.stringify(Object.keys(expectedBooks).sort()))throw Error('capital-account-keys');
  for(const [account,value] of canonicalBooks)if(BigInt(value)!==expectedBooks[account])throw Error('capital-ledger-mismatch');
  for(const j of state.core.journal) {
    accountParts(j.postings,entities);
    if(j.postings.some(p=>p.account.includes(':investment:')||p.account.includes(':paid-in:'))&&!issueIds.has(j.operationId))throw Error('unverified-capital-writer');
    if(j.type==='transfer')throw Error('raw-transfer-forbidden');
  }
  return true;
}
function planIssue(state,op){
  try{
    validateUnifiedState(state);
    if(!op||op.type!=='issue-shares')throw Error('unsupported-operation');
    const issuer=ident(op.issuer,'issuer'),subscriber=ident(op.subscriber,'subscriber'),classId=ident(op.classId,'class');
    const key=classKey(issuer,classId);
    if(!has(state.classes,key)||!state.core.entities.includes(subscriber)||issuer===subscriber)throw Error('invalid-issuer-subscriber');
    const shares=pos(op.shares,'shares'),price=pos(op.priceMinor,'price');
    const amount=safe(BigInt(shares)*BigInt(price),'subscription');
    if(BigInt(state.classes[key].issuedShares)+BigInt(shares)>BigInt(state.classes[key].authorizedShares))throw Error('exceeds-authorized');
    const operationId=ident(op.id,'operation-id');
    const issue={operationId,sequence:state.core.nextSequence,issuer,subscriber,classId,shares,priceMinor:price,amountMinor:amount};
    const planned=core.planOperation(state.core,{type:'journal',id:operationId,postings:expectedLegs(issue)});
    if(!planned.ok)throw Error(planned.reason);
    const next=copy(state),c=next.classes[key];
    c.issuedShares=safe(BigInt(c.issuedShares)+BigInt(shares),'issued');
    const p=has(c.holders,subscriber)?c.holders[subscriber]:{shares:0,costMinor:0};
    p.shares=safe(BigInt(p.shares)+BigInt(shares),'holder-shares');
    p.costMinor=safe(BigInt(p.costMinor)+BigInt(amount),'holder-cost');
    c.holders[subscriber]=p;
    next.issues.push(issue);
    next.core=planned.state;
    validateUnifiedState(next);
    return {ok:true,state:next,receipt:planned.receipt};
  }catch(err){return {ok:false,state,reason:err.message||'issue-error'};}
}
function planWeek(state,op){
  try{
    validateUnifiedState(state);
    const planned=store.planStoreWeek(state.core,op);
    if(!planned.ok)throw Error(planned.reason);
    const next=copy(state);
    next.core=planned.state;
    validateUnifiedState(next);
    return {ok:true,state:next,receipt:planned.receipt,weekly:planned.weekly};
  }catch(err){return {ok:false,state,reason:err.message||'week-error'};}
}
function admit(proposal,persist){
  if(!proposal.ok)return proposal;
  if(typeof persist!=='function')return {ok:false,state:proposal.before,reason:'persistence-required'};
  try{
    if(persist(copy(proposal.state))!==true)return {ok:false,state:proposal.before,reason:'persistence-rejected'};
    return {ok:true,state:proposal.state,receipt:proposal.receipt,weekly:proposal.weekly};
  }catch(_err){return {ok:false,state:proposal.before,reason:'persistence-threw'};}
}
function admitIssue(state,op,persist){return admit({...planIssue(state,op),before:state},persist);}
function admitWeek(state,op,persist){return admit({...planWeek(state,op),before:state},persist);}
function snapshot(state,issuer){
  validateUnifiedState(state);
  ident(issuer,'issuer');
  const positions=Object.create(null);
  let totalShares=0n,totalVotes=0n;
  for(const c of Object.values(state.classes)){
    if(c.issuer!==issuer)continue;
    totalShares+=BigInt(c.issuedShares);totalVotes+=BigInt(c.issuedShares)*BigInt(c.votesPerShare);
    for(const [holder,p] of Object.entries(c.holders)){
      if(!has(positions,holder))positions[holder]={shares:0n,votes:0n};
      positions[holder].shares+=BigInt(p.shares);
      positions[holder].votes+=BigInt(p.shares)*BigInt(c.votesPerShare);
    }
  }
  return {issuer,totalShares:totalShares.toString(),totalVotes:totalVotes.toString(),holders:Object.keys(positions).sort().map(holder=>({holder,shares:positions[holder].shares.toString(),shareRatio:{numerator:positions[holder].shares.toString(),denominator:totalShares.toString()},voteRatio:{numerator:positions[holder].votes.toString(),denominator:totalVotes.toString()}}))};
}
module.exports={createUnifiedState,validateUnifiedState,planIssue,planWeek,admitIssue,admitWeek,snapshot};
