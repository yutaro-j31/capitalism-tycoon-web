'use strict';

// Economic Engine vNext SPIKE-0: independent pure prototype; NOT imported by production.

// Amounts use safe signed integer 0.01 JPY units. Never use binary floating currency here.

function requireId(v,label="id"){if(typeof v!=="string"||!/^[a-z][a-z0-9-]{0,39}$/.test(v))throw Error("invalid-"+label);return v;}

function minor(v,label="minor",positive=false){if(!Number.isSafeInteger(v)||(positive?v<=0:v<0))throw Error("invalid-"+label);return v;}

function clone(v){return JSON.parse(JSON.stringify(v));}

function createInitialState(openingCashMinor){
  if(!openingCashMinor||typeof openingCashMinor!=="object"||Array.isArray(openingCashMinor))throw Error("invalid-opening");
  const entities=Object.keys(openingCashMinor).sort();
  if(entities.length<2||entities.length>30)throw Error("invalid-entity-count");
  const balances={};
  for(const e of entities){requireId(e,"entity");const amount=minor(openingCashMinor[e],"opening-cash");balances[`${e}:cash`]=amount;balances[`${e}:opening-equity`]=-amount;}
  const s={schemaVersion:1,unit:"JPY-0.01",entities,openingCashMinor:clone(openingCashMinor),balances,loans:{},receipts:{},journal:[],nextSequence:1};
  validateState(s);return s;
}

function validateState(s){
  if(!s||s.schemaVersion!==1||s.unit!=="JPY-0.01"||!Array.isArray(s.entities)||!s.balances||!s.loans||!s.receipts||!Array.isArray(s.journal)||!Number.isSafeInteger(s.nextSequence)||s.nextSequence!==s.journal.length+1)throw Error("invalid-state-shape");
  if(s.entities.length<2||new Set(s.entities).size!==s.entities.length||s.entities.some(e=>requireId(e,"entity")!==e))throw Error("invalid-entities");
  let total=0n;
  for(const [account,v] of Object.entries(s.balances)){
    minor(Math.abs(v),"account-balance");if(!Number.isSafeInteger(v))throw Error("invalid-account");
    const parts=account.split(":");
    if(parts.length<2||!s.entities.includes(parts[0])||!["cash","opening-equity","loan","receivable"].includes(parts[1])||(parts.length===3?requireId(parts[2],"loan-id")!==parts[2]:parts.length!==2)||(parts.length===3&&!["loan","receivable"].includes(parts[1])))throw Error("unknown-account");
    if(parts[1]==="cash"&&v<0)throw Error("negative-cash");
    total+=BigInt(v);
  }
  if(total!==0n)throw Error("unbalanced-state");
  for(const [id,loan] of Object.entries(s.loans)){
    requireId(id,"loan-id");
    if(!loan||loan.id!==id||!s.entities.includes(loan.borrower)||!s.entities.includes(loan.lender)||loan.borrower===loan.lender)throw Error("invalid-loan");
    minor(loan.principalMinor,"principal",true);minor(loan.outstandingMinor,"outstanding");
    if(loan.outstandingMinor>loan.principalMinor)throw Error("invalid-outstanding");
    if(s.balances[`${loan.borrower}:loan:${id}`]!==-loan.outstandingMinor||s.balances[`${loan.lender}:receivable:${id}`]!==loan.outstandingMinor)throw Error("loan-ledger-mismatch");
  }
  if(Object.keys(s.receipts).length!==s.journal.length)throw Error("receipt-count-mismatch");
  for(let i=0;i<s.journal.length;i++){
    const j=s.journal[i];if(!j||j.sequence!==i+1||!Array.isArray(j.postings)||s.receipts[j.operationId]!==j.sequence)throw Error("invalid-journal");
    let delta=0n;for(const p of j.postings){if(!p||typeof p.account!=="string"||!Number.isSafeInteger(p.deltaMinor))throw Error("invalid-posting");delta+=BigInt(p.deltaMinor);}
    if(delta!==0n)throw Error("unbalanced-journal");
  }
  return true;
}

function planOperation(previous,op){
  try{
    validateState(previous);
    if(!op||typeof op!=="object")throw Error("invalid-operation");
    const id=requireId(op.id,"operation-id");
    if(Object.prototype.hasOwnProperty.call(previous.receipts,id))throw Error("duplicate-operation");
    const next=clone(previous),p=[];
    const entity=(name)=>{requireId(name,"entity");if(!next.entities.includes(name))throw Error("unknown-entity");return name;};
    const add=(key,delta)=>{if(!Number.isSafeInteger(delta))throw Error("invalid-posting");p.push({account:key,deltaMinor:delta});};
    const money=minor(op.amountMinor,"amount",true);
    if(op.type==="transfer"){
      const from=entity(op.from),to=entity(op.to);if(from===to)throw Error("same-entity");
      add(`${from}:cash`,-money);add(`${to}:cash`,money);
    }else if(op.type==="borrow"){
      const borrower=entity(op.borrower),lender=entity(op.lender),loanId=requireId(op.loanId,"loan-id");
      if(borrower===lender)throw Error("same-entity");
      if(Object.prototype.hasOwnProperty.call(next.loans,loanId))throw Error("duplicate-loan");
      next.loans[loanId]={id:loanId,borrower,lender,principalMinor:money,outstandingMinor:money};
      add(`${lender}:cash`,-money);add(`${borrower}:cash`,money);
      add(`${lender}:receivable:${loanId}`,money);add(`${borrower}:loan:${loanId}`,-money);
    }else if(op.type==="repay"){
      const loanId=requireId(op.loanId,"loan-id"),loan=next.loans[loanId];
      if(!loan)throw Error("unknown-loan");
      if(money>loan.outstandingMinor)throw Error("overpayment");
      loan.outstandingMinor-=money;
      add(`${loan.borrower}:cash`,-money);add(`${loan.lender}:cash`,money);
      add(`${loan.borrower}:loan:${loanId}`,money);add(`${loan.lender}:receivable:${loanId}`,-money);
    }else throw Error("unsupported-operation");
    let delta=0n;
    for(const item of p){
      delta+=BigInt(item.deltaMinor);
      const updated=BigInt(next.balances[item.account]??0)+BigInt(item.deltaMinor);
      if(updated>BigInt(Number.MAX_SAFE_INTEGER)||updated<BigInt(Number.MIN_SAFE_INTEGER))throw Error("balance-overflow");
      next.balances[item.account]=Number(updated);
    }
    if(delta!==0n)throw Error("unbalanced-operation");
    const sequence=next.nextSequence++;
    next.receipts[id]=sequence;
    next.journal.push({sequence,operationId:id,type:op.type,postings:p});
    validateState(next);
    return {ok:true,state:next,receipt:{operationId:id,sequence}};
  }catch(e){return {ok:false,state:previous,reason:e&&typeof e.message==="string"?e.message:"invalid-operation"};}
}

function admitOperation(previous,op,persist){
  const planned=planOperation(previous,op);
  if(!planned.ok)return planned;
  if(typeof persist!=="function")return {ok:false,state:previous,reason:"persistence-required"};
  try{
    // Only an isolated proof of pure staging/admission, not atomic durable IndexedDB persistence.
    const allowed=persist(clone(planned.state));
    if(allowed!==true)return {ok:false,state:previous,reason:"persistence-rejected"};
    return planned;
  }catch(_e){return {ok:false,state:previous,reason:"persistence-threw"};}
}

module.exports={createInitialState,validateState,planOperation,admitOperation};

