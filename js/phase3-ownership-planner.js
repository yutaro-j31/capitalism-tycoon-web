// P3-4 pure, opt-in quantity inspection/planning. No apply, writer routing or activation.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.economicReadModel)throw Error('economic-read-model.js must precede phase3-ownership-planner.js');
if(modules.phase3OwnershipPlanner)throw Error('ownership planner already registered');
const {PLAYER_COMPANY_ENTITY_ID:PLAYER,FOUNDER_ENTITY_ID:FOUNDER,PLAYER_COMPANY_COMMON_SECURITY_CLASS_ID:COMMON}=modules.economicReadModel;
const BUCKETS=Object.freeze(['sharesOut','treasuryBuybackShares','founderShares','personalOwnShares']);
// These describe admissible *fact legs*, not installed callable routes or whole-command safety.
const supported={
 'W-BUY':['personal-buy'],'W-SELL':['personal-sell'],'W-MARGIN-LIQ':['personal-sell'],
 'W-SPLIT':['split'],'W-FOUNDER-SALE':['founder-sale'],'W-INVESTOR':['external-issue'],
 'W-IPO-CHAIN':['ipo'],'W-SHARE-SWAP':['external-issue'],'W-MA-EQUITY/SH':['external-issue'],
 'W-BUYBACK':['buyback'],'W-SPONSOR':['external-issue'],'W-TURNAROUND-ACCEPT':['external-issue'],
 'W-TURNAROUND-RATCHET':['external-issue']
};
const groups={
 INTERNAL_ENTRY:['W-MARGIN-RAW','W-IPO-BASE','W-ISSUE-RAW','W-ACQUIRE-COMPAT','W-BUYBACK-BASE'],
 REPLACEMENT_UNSUPPORTED:['W-INIT','W-NEW-COMPANY','W-LOAD-NORMALIZE','W-LOAD-IMPORT','W-COMPACTION','W-RESTORE/SH-REPLACE'],
 NO_COMMON_QUANTITY_CHANGE:['W-INVESTOR-AUX','W-RATIOS','W-DECLINE','W-DIV-SET','W-DIV-PAY','W-WEEK-MARKET','W-WEEK-EXPANDED','W-EARNINGS','W-CAPALLOC-PRICE'],
 HOLDER_UNPROVEN:['W-DEFENSE','W-WEEK-COMPETITOR'],
 ORCHESTRATION_ONLY:['W-ACTIVISM','W-MA-ACQUIRE'],
 ISSUER_FAMILY_UNSUPPORTED:['W-MBO','W-VC-INITIAL','W-VC-FOLLOW','W-VC-CLOSE','W-VC-WRITEOFF','W-VC-LIST','W-VC-SECONDARY','W-MAKE-SUB','W-SUB-IPO','W-SUB-SECONDARY','W-SUB-MARKET','W-SUB-CONTROL','W-SUB-FOLLOWON','W-SUB-RELIST','W-GROUP-DISPOSAL','W-GROUP-NEGOTIATED','W-INTERNAL-VENTURE','W-COMMERCIAL-SPINOUT','W-MA-SALE','W-PE-FORM','W-PE-FUND-ACQ','W-PE-FUND-EXIT','W-PE-PARENT','W-PE-LEGACY-CREATE','W-PE-LEGACY-EXIT','W-PE-TRANSFER','W-PE-SYNC','W-ANGEL','W-WEEK-STARTUPS','W-WEEK-PE']
};
const policies={};
for(const [id,kinds] of Object.entries(supported))policies[id]={kinds:[...kinds],rejection:null};
for(const [code,ids] of Object.entries(groups))for(const id of ids)policies[id]={kinds:[],rejection:code};
const own=Object.prototype.hasOwnProperty;
class Refusal extends Error{constructor(code,path,message){super(message);this.code=code;this.path=path;}}
function fail(code,path,message){throw new Refusal(code,path,message);}
function intrinsic(proto,type){
 const c=proto&&Object.getOwnPropertyDescriptor(proto,'constructor');
 const p=c&&own.call(c,'value')&&typeof c.value==='function'&&Object.getOwnPropertyDescriptor(c.value,'prototype');
 return !!p&&p.value===proto&&Function.prototype.toString.call(c.value)===Function.prototype.toString.call(type);
}
function record(x,path){
 if(!x||typeof x!=='object'||Array.isArray(x))fail('INPUT_INVALID',path,'Expected a plain record.');
 const p=Object.getPrototypeOf(x);
 if(p!==null&&!(Object.getPrototypeOf(p)===null&&intrinsic(p,Object)))fail('INPUT_INVALID',path,'Exotic or inherited evidence is unsupported.');
 return x;
}
function field(x,key,path){
 const d=Object.getOwnPropertyDescriptor(x,key);
 if(!d)return undefined;
 if(!own.call(d,'value')||!d.enumerable)fail('INPUT_INVALID',`${path}.${key}`,'Expected an own enumerable data field; getters are not evaluated.');
 return d.value;
}
function exact(x,keys,path){
 record(x,path);const actual=Reflect.ownKeys(x);
 if(actual.length!==keys.length||actual.some(k=>!keys.includes(k)))fail('INPUT_INVALID',path,'Unexpected or missing fields.');
 for(const k of keys)field(x,k,path);
 return x;
}
function array(x,path){
 if(!Array.isArray(x)||!intrinsic(Object.getPrototypeOf(x),Array))fail('INPUT_INVALID',path,'Expected a dense array.');
 const n=Object.getOwnPropertyDescriptor(x,'length').value;
 if(n>4096||Reflect.ownKeys(x).length!==n+1)fail('INPUT_INVALID',path,'Array is sparse, extended or too large.');
 const out=[];for(let i=0;i<n;i++){if(!own.call(x,String(i)))fail('INPUT_INVALID',path,'Sparse array.');out.push(field(x,String(i),path));}return out;
}
function text(x,path){if(typeof x!=='string'||!x.length||x.length>256||x.trim()!==x||/[\u0000-\u001f\u007f]/.test(x))fail('INPUT_INVALID',path,'Expected a bounded nonempty identifier without control characters.');return x;}
function quantity(x,path,integer=false){
 if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>Number.MAX_SAFE_INTEGER)fail('QUANTITY_INVALID',path,'Quantity must be finite, nonnegative and within the safe envelope.');
 if(integer&&!Number.isSafeInteger(x))fail('NUMERIC_DOMAIN_UNSUPPORTED',path,'Planning requires exact safe-integer units; fractions are never rounded.');
 return x+0;
}
function sum(a,b,path){
 const value=a+b,vb=value-a,error=(a-(value-vb))+(b-vb);
 if(!Number.isFinite(value)||error!==0||value<0||value>Number.MAX_SAFE_INTEGER)fail('CONSERVATION_FAILED',path,'Quantity conservation or exact representation failed.');
 return value+0;
}
function reconcile(q){
 const outstanding=sum(q.sharesOut,-q.treasuryBuybackShares,'outstanding');
 const founderBeneficial=sum(q.founderShares,q.personalOwnShares,'founderBeneficial');
 const unallocated=sum(outstanding,-founderBeneficial,'unallocated');
 return {...q,outstanding,founderBeneficial,unallocated};
}
function freeze(x){if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;}
function rejected(e){return freeze({status:'REJECTED',authority:'read-only',executable:false,reasons:[{code:e instanceof Refusal?e.code:'INPUT_INVALID',path:e instanceof Refusal?e.path:'$',message:e instanceof Refusal?e.message:'Input cannot be inspected as plain data.'}]});}
function scopeOf(scope){
 exact(scope,['family','issuerEntityId','securityClassId','currentCompanySerial'],'scope');
 if(field(scope,'family','scope')!=='player-common'||field(scope,'issuerEntityId','scope')!==PLAYER)fail('ISSUER_FAMILY_UNSUPPORTED','scope','Only player-company common facts are modeled.');
 if(field(scope,'securityClassId','scope')!==COMMON)fail('CLASS_UNSUPPORTED','scope.securityClassId','Only the existing single common class is modeled.');
 if(field(scope,'currentCompanySerial','scope')!==1)fail('GENERATION_UNPROVEN','scope.currentCompanySerial','Only the unsold first generation has a proven binding.');
 return {family:'player-common',issuerEntityId:PLAYER,securityClassId:COMMON,currentCompanySerial:1};
}
function inspect(state,scope){
 const scoped=scopeOf(scope);record(state,'state');
 if(field(state,'currentCompanySerial','state')!==1||field(state,'isCompanySold','state')!==false)fail('GENERATION_UNPROVEN','state.currentCompanySerial','Sold, refounded or missing generation evidence is unsupported.');
 const ticker=text(field(state,'ticker','state'),'state.ticker'),listed=field(state,'publicCompany','state');
 if(['__proto__','constructor','prototype'].includes(ticker))fail('INPUT_INVALID','state.ticker','Reserved map keys cannot identify the player listing.');
 if(typeof listed!=='boolean')fail('INPUT_INVALID','state.publicCompany','Listing status must be explicit.');
 const q={};for(const k of BUCKETS.slice(0,3))q[k]=quantity(field(state,k,'state'),`state.${k}`);
 const personal=record(field(state,'personalStocks','state'),'state.personalStocks');
 const company=record(field(state,'companyStocks','state'),'state.companyStocks');
 const lotPresent=own.call(personal,ticker),companyLotPresent=own.call(company,ticker);
 const lot=field(personal,ticker,'state.personalStocks'),companyLot=field(company,ticker,'state.companyStocks');
 q.personalOwnShares=lotPresent?quantity(field(record(lot,'personalLot'),'qty','personalLot'),'personalLot.qty'):0;
 if(companyLotPresent&&quantity(field(record(companyLot,'companyLot'),'qty','companyLot'),'companyLot.qty')!==0)fail('OWN_SHARE_ALIAS_UNRESOLVED','state.companyStocks','Company-owned alias is not treasury evidence.');
 const matches=[];
 for(const [i,row] of array(field(state,'market','state'),'state.market').entries()){
  const path=`state.market[${i}]`;record(row,path);
  if(text(field(row,'id',path),`${path}.id`)===ticker){
   if(!listed)fail('ALIAS_BINDING_UNPROVEN',path,'A private company cannot claim an existing market row by ticker.');
   matches.push({i,issuedShares:quantity(field(row,'issuedShares',path),`${path}.issuedShares`)});
  }
 }
 if(matches.length>1)fail('ALIAS_BINDING_UNPROVEN','state.market','Repeated player ticker.');
 if((listed&&!matches.length)||(matches.length&&matches[0].issuedShares!==q.sharesOut))fail('MIRROR_MISMATCH','state.market','Player listing must agree with issued quantity.');
 for(const [i,row] of array(field(state,'startups','state'),'state.startups').entries()){
  const path=`state.startups[${i}]`;record(row,path);
  const alias=field(row,'ipoStockID',path);
  if(alias!==undefined&&alias!==null&&alias!=='')text(alias,`${path}.ipoStockID`);
  if(alias===ticker)fail('ALIAS_BINDING_UNPROVEN',`${path}.ipoStockID`,'Startup IPO alias cannot be attributed to player common.');
 }
 const quantities=reconcile(q),personalPath=`personalStocks[${JSON.stringify(ticker)}].qty`;
 const sourcePaths={sharesOut:'sharesOut',treasuryBuybackShares:'treasuryBuybackShares',founderShares:'founderShares',personalOwnShares:personalPath};
 // Canonical ownership-only fingerprint, not a money revision, permission or cryptographic receipt.
 const sourceFingerprint=JSON.stringify([1,scoped,ticker,listed,lotPresent,companyLotPresent,matches,quantities]);
 return {status:'OBSERVED',authority:'read-only',executable:false,scope:scoped,ticker,publicCompany:listed,sourcePaths,sourceFingerprint,quantities,
  mirror:matches.length?{index:matches[0].i,issuedShares:matches[0].issuedShares}:null,
  knownFounderHolder:{registeredHolderEntityId:FOUNDER,beneficialOwnerEntityId:FOUNDER},checks:[{id:'ECO-010',ok:true},{id:'ECO-011',ok:true}],reasons:[]};
}
function inspectOwnershipAuthority(state,scope){try{return freeze(inspect(state,scope));}catch(e){return rejected(e);}}
function planOwnershipChange(state,intent){try{
 exact(intent,['scope','writerId','kind','operationId','account','sourceLots','expected','change'],'intent');
 const writerId=text(field(intent,'writerId','intent'),'intent.writerId'),policy=policies[writerId];
 if(!own.call(policies,writerId))fail('WRITER_UNSUPPORTED','intent.writerId','Writer is not in the inspected inventory.');
 if(policy.rejection)fail(policy.rejection,'intent.writerId','This route cannot plan player-common quantity changes.');
 const kind=field(intent,'kind','intent');
 if(!policy.kinds.includes(kind))fail('COMMAND_UNSUPPORTED','intent.kind','Writer and quantity command do not match.');
 const evidence=inspect(state,field(intent,'scope','intent'));
 const operationId=text(field(intent,'operationId','intent'),'intent.operationId');
 const account=field(intent,'account','intent'),wantedAccount=['personal-buy','personal-sell','founder-sale'].includes(kind)?'personal':kind==='ipo'?'company-and-personal':'company';
 if(account!==wantedAccount)fail('ACCOUNT_UNSUPPORTED','intent.account','Legal account does not match the fact leg.');
 const expected=exact(field(intent,'expected','intent'),['sourceState','sourceFingerprint','quantities'],'intent.expected');
 // Ephemeral caller binding detects equal-but-replaced roots without hidden mutable token/cache state.
 if(field(expected,'sourceState','intent.expected')!==state||field(expected,'sourceFingerprint','intent.expected')!==evidence.sourceFingerprint)fail('STALE_SOURCE','intent.expected','Expected source root or ownership fingerprint differs.');
 const before=evidence.quantities,pre=exact(field(expected,'quantities','intent.expected'),BUCKETS,'intent.expected.quantities');
 for(const k of BUCKETS){quantity(before[k],`before.${k}`,true);if(quantity(field(pre,k,'intent.expected.quantities'),`expected.${k}`,true)!==before[k])fail('STALE_SOURCE',`intent.expected.quantities.${k}`,'Expected quantity differs.');}
 if(before.outstanding===0)fail('DENOMINATOR_UNSUPPORTED','before.outstanding','Planning requires a positive existing outstanding quantity.');
 const publicOnly=kind!=='external-issue'||['W-SHARE-SWAP','W-MA-EQUITY/SH'].includes(writerId);
 if(kind==='ipo'?evidence.publicCompany:publicOnly&&!evidence.publicCompany)fail('LIFECYCLE_UNSUPPORTED','state.publicCompany','Listing lifecycle does not match the command.');
 const change=field(intent,'change','intent'),after=Object.fromEntries(BUCKETS.map(k=>[k,before[k]]));
 const changed=kind==='split'?BUCKETS:kind.startsWith('personal-')?['personalOwnShares']:kind==='founder-sale'?['founderShares']:kind==='buyback'?['treasuryBuybackShares']:kind==='ipo'?['sharesOut','founderShares']:['sharesOut'];
 const lots=array(field(intent,'sourceLots','intent'),'intent.sourceLots'),wantedLots=changed.map(k=>evidence.sourcePaths[k]);
 if(lots.length!==wantedLots.length||lots.some((x,i)=>x!==wantedLots[i]))fail('SOURCE_LOT_UNSUPPORTED','intent.sourceLots','Expected exact canonical source lots in bucket order.');
 if(kind==='split'){
  exact(change,['factor'],'intent.change');const factor=quantity(field(change,'factor','intent.change'),'intent.change.factor',true);
  if(factor<2)fail('COMMAND_DOMAIN','intent.change.factor','Split factor must be an integer of at least two.');
  for(const k of BUCKETS)after[k]=quantity(before[k]*factor,`after.${k}`,true);
 }else if(kind==='ipo'){
  exact(change,['issuedQuantity','founderSecondaryQuantity'],'intent.change');
  const issued=quantity(field(change,'issuedQuantity','intent.change'),'intent.change.issuedQuantity',true),secondary=quantity(field(change,'founderSecondaryQuantity','intent.change'),'intent.change.founderSecondaryQuantity',true);
  if(issued===0&&secondary===0)fail('COMMAND_DOMAIN','intent.change','IPO must change a quantity.');
  after.sharesOut=sum(before.sharesOut,issued,'after.sharesOut');after.founderShares=sum(before.founderShares,-secondary,'after.founderShares');
 }else{
  exact(change,['quantity'],'intent.change');const n=quantity(field(change,'quantity','intent.change'),'intent.change.quantity',true);
  if(n===0)fail('COMMAND_DOMAIN','intent.change.quantity','Quantity must be positive.');
  const k=changed[0],sign=['personal-sell','founder-sale'].includes(kind)?-1:1;
  after[k]=sum(before[k],sign*n,`after.${k}`);
 }
 for(const k of BUCKETS)quantity(after[k],`after.${k}`,true);
 const prospective=reconcile(after),updates=BUCKETS.filter(k=>before[k]!==after[k]).map(k=>({bucket:k,sourcePath:evidence.sourcePaths[k],before:before[k],after:after[k],
  attribution:k==='sharesOut'?{role:'issuer-total',entityId:PLAYER}:k==='treasuryBuybackShares'?{role:'treasury',entityId:PLAYER}:{role:'known-founder',entityId:FOUNDER}}));
 const mirrors=evidence.mirror&&before.sharesOut!==after.sharesOut?[{sourcePath:`market[${evidence.mirror.index}].issuedShares`,before:before.sharesOut,after:after.sharesOut}]:[];
 return freeze({status:'PLANNED',authority:'read-only',executable:false,wholeCommandValidated:false,writerId,kind,operationId,account,scope:evidence.scope,sourceFingerprint:evidence.sourceFingerprint,
  before,after:prospective,updates,mirrors,knownFounderHolder:evidence.knownFounderHolder,unallocatedIsIdentifiedHolder:false,
  listingRequirement:kind==='ipo'?{ticker:evidence.ticker,issuedShares:after.sharesOut,requiresExistingWriter:true}:null,
  checks:[{id:'ECO-010',ok:true},{id:'ECO-011',ok:true}],reasons:[]});
 }catch(e){return rejected(e);}}
modules.phase3OwnershipPlanner=freeze({VERSION:1,BUCKETS,WRITER_POLICIES:policies,inspectOwnershipAuthority,planOwnershipChange});
})();
