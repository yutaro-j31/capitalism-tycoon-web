'use strict';
// SPIKE-1: isolated, source-backed paid-in share issuance; NOT a production writer.
const core = require('./core.cjs');
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
function id(value, label='id') {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(value)) throw Error('invalid-' + label);
  return value;
}
function positive(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw Error('invalid-' + label);
  return value;
}
function safe(value, label) {
  if (value < 0n || value > MAX) throw Error('overflow-' + label);
  return Number(value);
}
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function classKey(issuer, shareClass) { return `${id(issuer, 'issuer')}:${id(shareClass, 'class')}`; }
function investmentKey(holder, issuer, shareClass) { return `${holder}:investment:${issuer}:${shareClass}`; }
function equityKey(issuer, shareClass) { return `${issuer}:paid-in:${issuer}:${shareClass}`; }
function createEquityState(coreState, definitions) {
  core.validateState(coreState);
  if (!Array.isArray(definitions) || definitions.length < 1 || definitions.length > 50) throw Error('invalid-class-list');
  const classes = Object.create(null);
  for (const c of definitions) {
    if (!c || !coreState.entities.includes(c.issuer)) throw Error('unknown-issuer');
    const k = classKey(c.issuer, c.classId);
    if (Object.prototype.hasOwnProperty.call(classes, k)) throw Error('duplicate-share-class');
    classes[k] = {issuer:c.issuer, classId:c.classId, authorizedShares:positive(c.authorizedShares, 'authorized'), votesPerShare:positive(c.votesPerShare, 'votes'), issuedShares:0, holders:{}};
  }
  const s={schemaVersion:1, core:clone(coreState), classes, equityBalances:{}, issues:[]};
  validateEquityState(s);return s;
}
function validateEquityState(state) {
  if (!state || state.schemaVersion!==1 || !state.core || !state.classes || !state.equityBalances || !Array.isArray(state.issues)) throw Error('invalid-equity-state');
  core.validateState(state.core);
  const sums = Object.fromEntries(state.core.entities.map(e=>[e,0n]));
  for (const [k,v] of Object.entries(state.core.balances)) sums[k.split(':')[0]]+=BigInt(v);
  const expected = Object.create(null);
  for (const [key,c] of Object.entries(state.classes)) {
    if (!c || !state.core.entities.includes(c.issuer) || classKey(c.issuer,c.classId)!==key) throw Error('invalid-class-source');
    positive(c.authorizedShares,'authorized');positive(c.votesPerShare,'votes');
    if (!Number.isSafeInteger(c.issuedShares) || c.issuedShares<0 || c.issuedShares>c.authorizedShares || !c.holders || Array.isArray(c.holders)) throw Error('invalid-shares');
    let shareSum=0n, capitalSum=0n;
    for (const [holder,pos] of Object.entries(c.holders)) {
      if (!state.core.entities.includes(holder) || holder===c.issuer || !pos) throw Error('invalid-holder');
      positive(pos.shares,'holder-shares');positive(pos.costMinor,'cost');
      shareSum+=BigInt(pos.shares);capitalSum+=BigInt(pos.costMinor);
      expected[investmentKey(holder,c.issuer,c.classId)]=pos.costMinor;
    }
    if (shareSum!==BigInt(c.issuedShares)) throw Error('share-conservation');
    if (capitalSum>MAX) throw Error('capital-overflow');
    if (capitalSum>0n) expected[equityKey(c.issuer,c.classId)]=-Number(capitalSum);
  }
  const keys=Object.keys(state.equityBalances).sort(),want=Object.keys(expected).sort();
  if (JSON.stringify(keys)!==JSON.stringify(want)) throw Error('equity-balance-keys');
  for (const key of keys) {
    if (!Number.isSafeInteger(state.equityBalances[key]) || state.equityBalances[key]!==expected[key]) throw Error('equity-book-mismatch');
    const owner=key.split(':')[0];
    if (!(owner in sums)) throw Error('invalid-account-owner');
    sums[owner]+=BigInt(state.equityBalances[key]);
  }
  for (const [owner,total] of Object.entries(sums)) if (total!==0n) throw Error('entity-not-balanced-'+owner);
  const countByClass=Object.create(null),seen=new Set();
  for (const issue of state.issues) {
    if (!issue || typeof issue.operationId!=='string' || seen.has(issue.operationId)) throw Error('invalid-issue-receipt');
    seen.add(issue.operationId);
    if (!Object.prototype.hasOwnProperty.call(state.core.receipts,issue.operationId) || state.core.receipts[issue.operationId]!==issue.sequence) throw Error('missing-core-receipt');
    const journal=state.core.journal[issue.sequence-1];
    if (!journal || journal.type!=='transfer' || journal.operationId!==issue.operationId || journal.postings.length!==2) throw Error('invalid-issue-journal');
    const key=classKey(issue.issuer,issue.classId);
    if (!Object.prototype.hasOwnProperty.call(state.classes,key) || !state.core.entities.includes(issue.subscriber) || issue.subscriber===issue.issuer) throw Error('invalid-issue-owner');
    positive(issue.shares,'issue-shares');positive(issue.priceMinor,'issue-price');positive(issue.amountMinor,'issue-amount');
    if (BigInt(issue.shares)*BigInt(issue.priceMinor)!==BigInt(issue.amountMinor)) throw Error('issue-cash-mismatch');
    if (journal.postings[0].account!==`${issue.subscriber}:cash` || journal.postings[0].deltaMinor!==-issue.amountMinor || journal.postings[1].account!==`${issue.issuer}:cash` || journal.postings[1].deltaMinor!==issue.amountMinor) throw Error('issue-transfer-mismatch');
    if (!countByClass[key])countByClass[key]={shares:0n,cash:0n,holders:{}};
    const t=countByClass[key];t.shares+=BigInt(issue.shares);t.cash+=BigInt(issue.amountMinor);
    const holder=Object.prototype.hasOwnProperty.call(t.holders,issue.subscriber)?t.holders[issue.subscriber]:(t.holders[issue.subscriber]={shares:0n,cash:0n});
    holder.shares+=BigInt(issue.shares);holder.cash+=BigInt(issue.amountMinor);
  }
  for (const [key,c] of Object.entries(state.classes)) {
    const t=countByClass[key];
    if ((t?.shares||0n)!==BigInt(c.issuedShares))throw Error('history-shares-mismatch');
    for (const [holder,p] of Object.entries(c.holders)) {
      const h=t?.holders[holder];if (!h || h.shares!==BigInt(p.shares) || h.cash!==BigInt(p.costMinor)) throw Error('history-holder-mismatch');
    }
  }
  return true;
}
function planShareIssue(previous, op) {
  try {
    validateEquityState(previous);
    if (!op || op.type!=='issue-shares') throw Error('unsupported-equity-operation');
    const issuer=id(op.issuer,'issuer'),subscriber=id(op.subscriber,'subscriber'),shareClass=id(op.classId,'class');
    const k=classKey(issuer,shareClass),c=Object.prototype.hasOwnProperty.call(previous.classes,k)?previous.classes[k]:null;
    if (!c || c.issuer!==issuer || !previous.core.entities.includes(subscriber) || issuer===subscriber) throw Error('invalid-issuer-subscriber');
    const shares=positive(op.shares,'shares'),priceMinor=positive(op.priceMinor,'price'),amount=safe(BigInt(shares)*BigInt(priceMinor),'subscription');
    if (BigInt(c.issuedShares)+BigInt(shares)>BigInt(c.authorizedShares)) throw Error('exceeds-authorized');
    const planned=core.planOperation(previous.core,{id:id(op.id,'operation-id'),type:'transfer',from:subscriber,to:issuer,amountMinor:amount});
    if (!planned.ok) throw Error(planned.reason);
    const next=clone(previous),item=next.classes[k],position=Object.prototype.hasOwnProperty.call(item.holders,subscriber)?item.holders[subscriber]:{shares:0,costMinor:0};
    item.issuedShares=safe(BigInt(item.issuedShares)+BigInt(shares),'issued-shares');
    position.shares=safe(BigInt(position.shares)+BigInt(shares),'holder-shares');
    position.costMinor=safe(BigInt(position.costMinor)+BigInt(amount),'holder-cost');
    item.holders[subscriber]=position;
    next.core=planned.state;
    next.equityBalances[investmentKey(subscriber,issuer,shareClass)]=position.costMinor;
    const capitalKey=equityKey(issuer,shareClass),old=BigInt(next.equityBalances[capitalKey]||0);
    next.equityBalances[capitalKey]=Number(old-BigInt(amount));
    next.issues.push({operationId:op.id,sequence:planned.receipt.sequence,issuer,subscriber,classId:shareClass,shares,priceMinor,amountMinor:amount});
    validateEquityState(next);
    return {ok:true,state:next,receipt:planned.receipt};
  } catch(e){return {ok:false,state:previous,reason:e instanceof Error?e.message:'invalid-share-issue'};}
}
function admitShareIssue(previous,operation,persist) {
  const planned=planShareIssue(previous,operation);
  if (!planned.ok)return planned;
  if (typeof persist!=='function')return {ok:false,state:previous,reason:'persistence-required'};
  try {
    if (persist(clone(planned.state))!==true)return {ok:false,state:previous,reason:'persistence-rejected'};
    return planned;
  } catch(_e){return {ok:false,state:previous,reason:'persistence-threw'};}
}
function ownershipSnapshot(state,issuer) {
  validateEquityState(state);
  id(issuer,'issuer');
  const sharesByHolder=Object.create(null),votesByHolder=Object.create(null);
  let shares=0n,votes=0n;
  for (const c of Object.values(state.classes)) {
    if (c.issuer!==issuer)continue;
    shares+=BigInt(c.issuedShares);votes+=BigInt(c.issuedShares)*BigInt(c.votesPerShare);
    for (const [holder,pos] of Object.entries(c.holders)) {
      sharesByHolder[holder]=(sharesByHolder[holder]||0n)+BigInt(pos.shares);
      votesByHolder[holder]=(votesByHolder[holder]||0n)+BigInt(pos.shares)*BigInt(c.votesPerShare);
    }
  }
  if (shares===0n)throw Error('issuer-not-issued');
  return {issuer,totalShares:shares.toString(),totalVotes:votes.toString(),holders:Object.keys(sharesByHolder).sort().map(holder=>({holder,shares:sharesByHolder[holder].toString(),shareRatio:{numerator:sharesByHolder[holder].toString(),denominator:shares.toString()},voteRatio:{numerator:votesByHolder[holder].toString(),denominator:votes.toString()}}))};
}
module.exports={createEquityState,validateEquityState,planShareIssue,admitShareIssue,ownershipSnapshot};
