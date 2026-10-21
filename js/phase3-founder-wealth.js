// P3-11 founder wealth read-only projection. Never a net-worth, credit, progression,
// estate or ending consumer; the installed net-worth method and its callers are untouched.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('runtime.js must precede phase3-founder-wealth.js');
if(!modules.finance||!modules.economicReadModel||!modules.phase3VCSourceInterests||!modules.phase3PeFundInterests)throw new Error('finance, economic-read-model, phase3-vc-source-interests and phase3-pe-fund-interests must precede phase3-founder-wealth.js');
if(modules.phase3FounderWealth)throw new Error('Founder wealth projection already registered');
const readModel=modules.economicReadModel,vcInterests=modules.phase3VCSourceInterests,peFundInterests=modules.phase3PeFundInterests;
const FOUNDER=readModel.FOUNDER_ENTITY_ID,JPY=readModel.CURRENCY,FOUNDER_LOAN=modules.finance.FOUNDER_LOAN_SOURCE;
// Owner-fixed own-company formulas (P3-11 contract §6): listed price × unique founder
// beneficial shares; private evidence-backed Equity Value × economic ownership × 0.70.
const PRIVATE_EQUITY_FACTOR=0.70;
const MAX_ROWS=4096,MAX_DEPTH=32,MAX_NODES=1<<18;
const own=Object.prototype.hasOwnProperty,order=(a,b)=>a<b?-1:a>b?1:0;
const id=x=>typeof x==='string'&&x.trim().length>0;
const money=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x*100)<=Number.MAX_SAFE_INTEGER;
// Codes that only describe legal identity/rights gaps of an ordinary listed lot.
const LISTED_INFORMATIONAL=new Set(['IDENTITY_UNPROVEN','CLASS_UNKNOWN','RIGHTS_UNKNOWN','DENOMINATOR_UNKNOWN']);
function intrinsic(proto,type){
 const c=proto&&Object.getOwnPropertyDescriptor(proto,'constructor');
 const p=c&&own.call(c,'value')&&typeof c.value==='function'&&Object.getOwnPropertyDescriptor(c.value,'prototype');
 return !!p&&p.value===proto&&Function.prototype.toString.call(c.value)===Function.prototype.toString.call(type);
}
function record(x){if(!x||typeof x!=='object'||Array.isArray(x))return false;const p=Object.getPrototypeOf(x);return p===null||(Object.getPrototypeOf(p)===null&&intrinsic(p,Object));}
function list(x){return Array.isArray(x)&&intrinsic(Object.getPrototypeOf(x),Array);}
function freeze(x){if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function reason(code,path,message,evidenceRefs=[path]){return {code,path,message,evidenceRefs:evidenceRefs.slice()};}
function invalid(path){throw Object.assign(new Error('INPUT_INVALID'),{evidencePath:path});}
// Detached, descriptor-validated copy of only the selected source branches. Getters are
// never executed; cycles, symbols, holes, exotic prototypes and oversize input fail closed.
function copier(){
 let nodes=0;const active=new Set();
 function data(x,key,path){
  const d=Object.getOwnPropertyDescriptor(x,key);if(!d)return {present:false};
  if(!own.call(d,'value')||!d.enumerable)invalid(path);return {present:true,value:d.value};
 }
 function deep(v,path,depth){
  if(++nodes>MAX_NODES||depth>MAX_DEPTH)invalid(path);
  if(v===null||['undefined','string','number','boolean'].includes(typeof v))return v;
  if(typeof v!=='object'||active.has(v)||(!record(v)&&!list(v)))invalid(path);
  active.add(v);
  const keys=Reflect.ownKeys(v);let out;
  if(Array.isArray(v)){
   if(v.length>MAX_ROWS||keys.length!==v.length+1)invalid(path);
   out=[];for(let i=0;i<v.length;i++){const f=data(v,String(i),`${path}[${i}]`);if(!f.present)invalid(path);out.push(deep(f.value,`${path}[${i}]`,depth+1));}
  }else{
   out=Object.create(null);
   for(const key of keys){if(typeof key!=='string')invalid(path);const p=`${path}[${JSON.stringify(key)}]`;out[key]=deep(data(v,key,p).value,p,depth+1);}
  }
  active.delete(v);return out;
 }
 // spec: 'deep' | {rows:[fields]} | {fields:{name:spec}}
 function pick(v,spec,path,depth){
  if(spec==='deep')return deep(v,path,depth);
  if(spec.rows){
   if(!list(v)||v.length>MAX_ROWS||Reflect.ownKeys(v).length!==v.length+1)invalid(path);
   const out=[];
   for(let i=0;i<v.length;i++){
    const p=`${path}[${i}]`,f=data(v,String(i),p);if(!f.present||!record(f.value))invalid(p);
    const row=Object.create(null);
    for(const key of spec.rows){const g=data(f.value,key,`${p}.${key}`);if(g.present)row[key]=deep(g.value,`${p}.${key}`,depth+2);}
    out.push(row);
   }
   return out;
  }
  if(!record(v))invalid(path);
  const out=Object.create(null);
  for(const key of Object.keys(spec.fields)){const g=data(v,key,`${path}.${key}`);if(g.present)out[key]=pick(g.value,spec.fields[key],`${path}.${key}`,depth+1);}
  return out;
 }
 return {data,pick};
}
const SOURCE_SPEC={fields:{
 ticker:'deep',currentCompanySerial:'deep',isCompanySold:'deep',publicCompany:'deep',stockPrice:'deep',week:'deep',
 personalCash:'deep',personalDebt:'deep',personalStocks:'deep',
 market:{rows:['id','price','privateCompany','suspended']},
 finance:{fields:{loans:{rows:['loanID','sourceType','status','outstandingPrincipal']}}},
 personalMarginLoan:{fields:{balance:'deep'}},
 realEstate:{fields:{loans:{rows:['loanID','owner','status']}}},
 realEstateMarket:{fields:{loans:{rows:['id','owner','status','accountingTracked']}}},
 peDeals:{rows:['id','ownerAccount','status']},
 peFirm:{fields:{funds:'deep'}},
 angelInvestments:{rows:['id','status']},
 startups:{rows:['id','ownedCompany','ownedPersonal','ddNegotiatedOwnedCompany','ddNegotiatedOwnedPersonal','ipoStockID','alive','subsidiary','activeFundingRound']},
 subsidiaries:{rows:['id','startupID','peDealID','sourcePEFundID','sourcePEDealID','internalVentureID','sourceCompetitorID','acquisitionDealID','restructuredWeek','restructuredFrom','source','status','ownership']}
}};
function captureView(raw){
 if(!record(raw))invalid('$');
 return freeze(copier().pick(raw,SOURCE_SPEC,'$',0));
}
function sameView(a,b){
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const x=Object.keys(a),y=Object.keys(b);
 return x.length===y.length&&x.every((key,i)=>key===y[i]&&sameView(a[key],b[key]));
}
const captures=new WeakMap(),issued=new WeakMap();
function ownershipFingerprint(rawState,index){
 try{return JSON.stringify(readModel.projectOwnershipSnapshot(rawState,index));}catch(_){return null;}
}
// Canonical liability identity: a supplied 'personal-debt' names the captured 'liability:personal-debt'.
function bareLiabilityKey(key){return key.replace(/^liability:/,'').replace(/^supplied:/,'');}
// One unknown ALIAS_CONFLICT entry for a set of rows sharing one identity; sorted refs make it order-independent.
function collapse(members,key,keyField,fields,message){
 const refs=members.flatMap(row=>row.sourceRefs).map(r=>({...r})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const same=f=>members.every(row=>row[f]===members[0][f])?members[0][f]:null;
 return {[keyField]:key,...fields,value:null,currency:same('currency'),sourceMethod:same('sourceMethod'),sourceRefs:refs,status:'unknown',
  reasons:[reason('ALIAS_CONFLICT',refs[0].path,message,refs.map(r=>r.path))]};
}
function ref(path,durableId,family,role='current'){return {path,durableId:durableId===undefined?null:durableId,family,role};}
// Parse issues are reported on the evidence they belong to: valuation rows under
// valuationEvidence, liability rows under liabilityEvidence. A structural failure that
// cannot be attributed to one family is reported on both.
function supplied(view,external,valuationIssues,liabilityIssues){
 const valuations=[],liabilities=[];
 if(external===undefined||external===null)return {valuations,liabilities};
 const sink=path=>path.startsWith('supplied.liabilities')?[liabilityIssues]:path.startsWith('supplied.valuations')?[valuationIssues]:[valuationIssues,liabilityIssues];
 let copy;
 try{copy=copier().pick(external,{fields:{valuations:'deep',liabilities:'deep'}},'supplied',0);}
 catch(error){const path=typeof error.evidencePath==='string'?error.evidencePath:'supplied';for(const issues of sink(path))issues.push(reason('INPUT_INVALID',path,'Supplied evidence is not plain immutable JSON data.'));return {valuations,liabilities};}
 const rows=(key)=>{const v=copy[key];if(v===undefined)return [];if(!Array.isArray(v)){for(const issues of sink(`supplied.${key}`))issues.push(reason('INPUT_INVALID',`supplied.${key}`,'Supplied evidence family must be an array.'));return [];}return v;};
 const issues=valuationIssues;
 rows('valuations').forEach((row,i)=>{
  const path=`supplied.valuations[${i}]`;
  const strings=x=>x===undefined?[]:Array.isArray(x)&&x.every(id)?x.slice():null;
  const coveredAssets=row&&typeof row==='object'?strings(row.coveredAssets):null,coveredLiabilities=row&&typeof row==='object'?strings(row.coveredLiabilities):null;
  if(!row||typeof row!=='object'||Array.isArray(row)||!id(row.assetKey)||!id(row.kind)||typeof row.amount!=='number'||!id(row.sourceMethod)||coveredAssets===null||coveredLiabilities===null){
   issues.push(reason('INPUT_INVALID',path,'Supplied valuation evidence requires assetKey, kind, numeric amount, sourceMethod and string coverage lists.'));return;
  }
  if(row.assetKey!=='own-company'){issues.push(reason('VALUATION_BASIS_UNSUPPORTED',`${path}.assetKey`,'Only own-company Equity Value evidence may be supplied in this slice.'));return;}
  valuations.push({valuationKey:`supplied:${i}`,assetKey:row.assetKey,kind:row.kind,value:row.amount,currency:row.currency===undefined?null:row.currency,
   provenance:'supplied',sourceMethod:row.sourceMethod,sourceVersion:row.sourceVersion===undefined?null:row.sourceVersion,
   asOfWeek:Number.isSafeInteger(row.asOfWeek)?row.asOfWeek:null,coveredAssets,coveredLiabilities,sourceRefs:[ref(path,null,'supplied')],status:'known',reasons:[]});
 });
 rows('liabilities').forEach((row,i)=>{
  const path=`supplied.liabilities[${i}]`;
  if(!row||typeof row!=='object'||Array.isArray(row)||!id(row.liabilityKey)||!money(row.amount)||row.amount<0||!id(row.sourceMethod)){
   liabilityIssues.push(reason('INPUT_INVALID',path,'Supplied liability evidence requires liabilityKey, a finite non-negative amount within the monetary envelope and sourceMethod.'));return;
  }
  liabilities.push({liabilityKey:`liability:supplied:${bareLiabilityKey(row.liabilityKey)}`,identity:bareLiabilityKey(row.liabilityKey),kind:'principal',value:row.amount,currency:row.currency===undefined?null:row.currency,
   provenance:'supplied',sourceMethod:row.sourceMethod,sourceRefs:[ref(path,row.liabilityKey,'supplied')],includesKeys:[],excludedKeys:[],status:'known',reasons:[]});
 });
 return {valuations,liabilities};
}
// Trusted capture: derives ownership, valuation and liability evidence from one immutable
// view and binds all three to one opaque in-memory token. Nothing is persisted.
function captureFounderWealthEvidence(rawState,externalEvidence){
 const bundle={authority:'read-only',captureVersion:1,ownershipSnapshot:null,valuationEvidence:null,liabilityEvidence:null,issues:[]};
 let view;
 try{view=captureView(rawState);}
 catch(error){bundle.issues.push(reason('INPUT_INVALID','rawState','Raw state is not plain immutable JSON data.',[typeof error.evidencePath==='string'?error.evidencePath:'$']));return freeze(bundle);}
 const token=Object.freeze({}),week=Number.isSafeInteger(view.week)?view.week:null;
 const index=readModel.buildOwnershipIdentityIndex(rawState),snapshot=readModel.projectOwnershipSnapshot(rawState,index);
 captures.set(token,{rawState,view,index,ownership:JSON.stringify(snapshot)});
 // Ownership evidence: P3-2 founder beneficial position, P3-5 personal listed lots and P3-8 startup fractions.
 const ownership={authority:'read-only',evidenceKind:'founder-wealth-ownership',sourceSnapshotToken:token,asOfWeek:week,
  publicCompany:typeof view.publicCompany==='boolean'?view.publicCompany:null,ticker:id(view.ticker)?view.ticker:null,
  founder:null,listed:[],listingObservations:[],vc:[],peSources:[],angel:[],exclusions:[],issues:[]};
 const founder=snapshot.positions.find(row=>row.positionId==='position:player-company:founder');
 const outstanding=snapshot.classes[0]?.outstandingQuantity;
 ownership.founder={status:founder&&founder.assetRole==='founder-equity'&&founder.quantity.status==='known'?'bound':'unresolved',
  quantity:founder&&founder.quantity.status==='known'?founder.quantity.value:null,
  outstandingQuantity:typeof outstanding==='number'?outstanding:null,
  sourceRefs:(founder?founder.sourceRefs:[]).map(row=>ref(row.path,row.durableId,row.family,row.role)),
  reasons:(founder?founder.reasons:snapshot.issues).map(row=>reason(row.code,row.path,'Founder beneficial position is unresolved by the ownership snapshot.'))};
 if(!founder&&!snapshot.issues.length)ownership.founder.reasons.push(reason('IDENTITY_UNPROVEN','founderPosition','No founder beneficial position was projected.'));
 for(const position of snapshot.positions){
  if(position.positionId==='position:player-company:founder')continue;
  const path=position.sourceRefs[0]?.path||position.positionId;
  if(position.accountKind==='company'){ownership.exclusions.push({sourcePath:path,basis:'company-owned',includedBy:null});continue;}
  if(position.accountKind!=='personal')continue;
  ownership.listed.push({alias:position.instrumentAlias,sourcePath:path,quantity:position.quantity.status==='known'?position.quantity.value:null,
   reasons:position.reasons.map(row=>({code:row.code,path:row.path}))});
 }
 // The delegated own-ticker personal lot is inside the founder position, never a second asset.
 if(ownership.founder.status==='bound')for(const row of ownership.founder.sourceRefs)if(row.path.startsWith('personalStocks'))ownership.exclusions.push({sourcePath:row.path,basis:'included-in-own-company',includedBy:'asset:own-company'});
 for(const row of snapshot.listingObservations)ownership.listingObservations.push({alias:row.instrumentAlias,listingStatus:row.listingStatus,
  price:row.price.status==='known'?row.price.value:null,priceStatus:row.price.status,codes:row.reasons.map(r=>r.code)});
 const vc=vcInterests.projectVCSourceInterests(view),vcIssues=new Map(vc.issues.map(row=>[row.path,row.code]));
 for(const row of vc.observations){
  if(row.account==='company'){if(row.economicFraction>0)ownership.exclusions.push({sourcePath:row.sourcePath,basis:'company-owned',includedBy:null});continue;}
  if(row.assetRole==='historical'){ownership.exclusions.push({sourcePath:row.sourcePath,basis:'historical',includedBy:null});continue;}
  if(row.assetRole==='no-interest')continue;
  ownership.vc.push({sourcePath:row.sourcePath,startupSourceId:row.startupSourceId,status:row.status,economicFraction:row.economicFraction,code:vcIssues.get(row.sourcePath)||null});
 }
 if(vc.issues.some(row=>row.path==='$'))ownership.issues.push(reason('INPUT_INVALID','vc','Startup source evidence could not be read.'));
 (view.peDeals||[]).forEach((row,i)=>{
  const path=`peDeals[${i}]`;
  if(row.ownerAccount==='company'){if(row.status==='active')ownership.exclusions.push({sourcePath:path,basis:'company-owned',includedBy:null});return;}
  if(row.status==='exited'||row.status==='sold'){ownership.exclusions.push({sourcePath:path,basis:'historical',includedBy:null});return;}
  ownership.peSources.push(ref(path,id(row.id)?row.id:null,'pe'));
 });
 // P3-7 GP fund capital evidence: a contribution ratio is not NAV, carry or title to fund assets.
 const pe=peFundInterests.projectPEFundInterests(view);
 for(const row of pe.fundInterests){
  if(row.current===false&&row.status==='observed'){ownership.exclusions.push({sourcePath:row.sourcePath,basis:'historical',includedBy:null});continue;}
  ownership.peSources.push(ref(row.sourcePath,row.fundId,'pe-fund'));
 }
 for(const row of pe.distributionEvidence)ownership.exclusions.push({sourcePath:row.sourcePath,basis:'historical-paid-cash',includedBy:'asset:personal-cash'});
 ownership.peCodes=Array.from(new Set(pe.issues.map(row=>row.code))).sort(order);
 (view.angelInvestments||[]).forEach((row,i)=>{
  const path=`angelInvestments[${i}]`;
  if(row.status==='exited'){ownership.exclusions.push({sourcePath:path,basis:'historical',includedBy:null});return;}
  ownership.angel.push({sourcePath:path,durableId:id(row.id)?row.id:null,status:typeof row.status==='string'?row.status:null});
 });
 // Valuation evidence: cash coverage, quotes and founder-loan principal, all from the same view.
 const valuation={authority:'read-only',evidenceKind:'founder-wealth-valuation',sourceSnapshotToken:token,asOfWeek:week,entries:[],issues:[]};
 const liability={authority:'read-only',evidenceKind:'founder-wealth-liability',sourceSnapshotToken:token,asOfWeek:week,entries:[],
  coverage:{status:'partial',reasons:[reason('LIABILITY_COVERAGE_UNKNOWN','liabilities','Outside-aggregate personal liabilities (real-estate mortgages, personal real-estate corporation, trust) are not reconciled; Phase 4 debt identity is not adopted.')]},exclusions:[],issues:[]};
 const cashPath='personalCash',cash=view.personalCash;
 valuation.entries.push({valuationKey:'cash:personal',assetKey:'personal-cash',kind:'cash',value:money(cash)?cash:null,currency:JPY,provenance:'captured',
  sourceMethod:'economicReadModel.accountBalances',sourceVersion:readModel.READ_MODEL_VERSION,asOfWeek:week,coveredAssets:[cashPath],coveredLiabilities:[],
  sourceRefs:[ref(cashPath,null,'personal')],status:money(cash)?'known':'unknown',
  reasons:money(cash)?[]:[reason(typeof cash==='number'&&Number.isFinite(cash)?'NUMERIC_DOMAIN_UNSUPPORTED':'INPUT_INVALID',cashPath,'Personal cash is missing, non-finite or outside the monetary envelope.')]});
 if(view.publicCompany===true){
  const rows=(view.market||[]).map((row,i)=>({row,path:`market[${i}]`})).filter(item=>id(view.ticker)&&item.row.id===view.ticker);
  const price=view.stockPrice,valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
  let code=null;
  if(price===undefined||price===null||!rows.length)code='VALUATION_INCOMPLETE';
  else if(rows.length>1||!valid(price)||!valid(rows[0].row.price)||rows[0].row.price!==price)code='VALUATION_SOURCE_CONFLICT';
  else if(rows[0].row.privateCompany===true||rows[0].row.suspended===true)code='VALUATION_INCOMPLETE';
  const refs=[ref('stockPrice',null,'player'),...rows.map(item=>ref(item.path,item.row.id,'listed'))];
  valuation.entries.push({valuationKey:'quote:own-company',assetKey:'own-company',kind:'marketPrice',value:code?null:price,currency:JPY,provenance:'captured',
   sourceMethod:'stockPrice+designated-market-row',sourceVersion:1,asOfWeek:week,coveredAssets:[],coveredLiabilities:[],sourceRefs:refs,status:code?'unknown':'known',
   reasons:code?[reason(code,'stockPrice',code==='VALUATION_SOURCE_CONFLICT'?'Own-company stockPrice and the designated market row disagree, repeat or are invalid; no quote is chosen.':'Own-company quote or its active listing row is missing.',refs.map(r=>r.path))]:[]});
 }
 for(const lot of ownership.listed){
  const observation=ownership.listingObservations.find(row=>row.alias===lot.alias);
  let code=null;
  if(!observation||observation.priceStatus==='unknown'||observation.listingStatus==='private'||observation.listingStatus==='suspended')code='VALUATION_INCOMPLETE';
  if(observation&&(observation.codes.includes('ALIAS_CONFLICT')||observation.priceStatus==='invalid'||observation.listingStatus==='unknown'))code='VALUATION_SOURCE_CONFLICT';
  valuation.entries.push({valuationKey:`quote:listed:${lot.alias}`,assetKey:`listed:${lot.alias}`,kind:'marketPrice',value:code?null:observation.price,currency:JPY,provenance:'captured',
   sourceMethod:'projectOwnershipSnapshot.listingObservations',sourceVersion:2,asOfWeek:week,coveredAssets:[],coveredLiabilities:[],sourceRefs:[ref(lot.sourcePath,lot.alias,'listed')],
   status:code?'unknown':'known',reasons:code?[reason(code,lot.sourcePath,'No unique active market price is observed for this personal listed lot.')]:[]});
 }
 const loans=view.finance&&Array.isArray(view.finance.loans)?view.finance.loans:[],loanCounts=new Map();
 for(const loan of loans)if(id(loan.loanID))loanCounts.set(loan.loanID,(loanCounts.get(loan.loanID)||0)+1);
 loans.forEach((loan,i)=>{
  if(loan.sourceType!==FOUNDER_LOAN)return;
  const path=`finance.loans[${i}]`,principal=loan.outstandingPrincipal;
  if(['repaid','closed','paid'].includes(loan.status)){ownership.exclusions.push({sourcePath:path,basis:'historical',includedBy:null});return;}
  let code=!id(loan.loanID)?'IDENTITY_UNPROVEN':loanCounts.get(loan.loanID)!==1?'ALIAS_CONFLICT':loan.status!=='active'?'VALUATION_INCOMPLETE':!money(principal)||principal<0?'INPUT_INVALID':null;
  valuation.entries.push({valuationKey:`principal:founder-loan:${id(loan.loanID)?loan.loanID:path}`,assetKey:`founder-loan:${id(loan.loanID)?loan.loanID:path}`,kind:'principal',value:code?null:principal,currency:JPY,provenance:'captured',
   sourceMethod:'finance.founderLoanReceivable-semantics',sourceVersion:1,asOfWeek:week,coveredAssets:[],coveredLiabilities:[],sourceRefs:[ref(path,id(loan.loanID)?loan.loanID:null,'finance')],
   status:code?'unknown':'known',reasons:code?[reason(code,path,'Founder loan receivable identity, lifecycle or principal is not proven.')]:[]});
 });
 // Duplicate founder-loan identities collapse to one unknown entry (order-independent).
 const founderLoans=new Map();
 for(const row of valuation.entries.filter(row=>row.kind==='principal')){if(!founderLoans.has(row.valuationKey))founderLoans.set(row.valuationKey,[]);founderLoans.get(row.valuationKey).push(row);}
 valuation.entries=valuation.entries.filter(row=>row.kind!=='principal');
 for(const [key,members] of founderLoans){
  if(members.length===1){valuation.entries.push(members[0]);continue;}
  valuation.entries.push(collapse(members,key,'valuationKey',{assetKey:members[0].assetKey,kind:'principal',provenance:'captured',
   sourceVersion:1,asOfWeek:week,coveredAssets:[],coveredLiabilities:[]},'Founder loan identity repeats; no principal is counted.'));
 }
 const debt=view.personalDebt,mirrors=[],untracked=[];
 for(const [key,field] of [['realEstate','loanID'],['realEstateMarket','id']]){
  const rows=view[key]&&Array.isArray(view[key].loans)?view[key].loans:[];
  rows.forEach((row,i)=>{
   if(row.owner!=='personal'||(row.status!=='active'&&row.status!=='defaulted'))return;
   const path=`${key}.loans[${i}]`;
   // P4-AUD-004: only accountingTracked specialist loans are inside the personal debt aggregate.
   if(key==='realEstate'||row.accountingTracked===true){mirrors.push(path);return;}
   untracked.push({liabilityKey:`liability:untracked-property-loan:${path}`,kind:'principal',value:null,currency:JPY,provenance:'captured',
    sourceMethod:'realEstateMarket.loans',sourceRefs:[ref(path,id(row[field])?row[field]:null,'personal')],includesKeys:[path],excludedKeys:[],status:'unknown',
    reasons:[reason('LIABILITY_COVERAGE_UNKNOWN',path,'Personal specialist loan outside the personal debt aggregate; its principal identity is not reconciled.')]});
  });
 }
 for(const path of mirrors)liability.exclusions.push({sourcePath:path,basis:'included-in-personal-debt',includedBy:'liability:personal-debt'});
 const debtOk=money(debt)&&debt>=0;
 liability.entries.push({liabilityKey:'liability:personal-debt',kind:'principal',value:debtOk?debt:null,currency:JPY,provenance:'captured',
  sourceMethod:'economicReadModel.accountBalances',sourceRefs:[ref('personalDebt',null,'personal')],includesKeys:['personalDebt',...mirrors],excludedKeys:[],
  status:debtOk?'known':'unknown',reasons:debtOk?[]:[reason('INPUT_INVALID','personalDebt','Personal debt is missing, negative, non-finite or outside the monetary envelope.')]});
 liability.entries.push(...untracked);
 if(view.personalMarginLoan!==undefined){
  const balance=view.personalMarginLoan.balance,ok=money(balance)&&balance>=0;
  if(!ok||balance>0)liability.entries.push({liabilityKey:'liability:margin',kind:'principal',value:ok?balance:null,currency:JPY,provenance:'captured',
   sourceMethod:'personalStockMargin.balance',sourceRefs:[ref('personalMarginLoan.balance',null,'personal')],includesKeys:['personalMarginLoan'],excludedKeys:[],
   status:ok?'known':'unknown',reasons:ok?[]:[reason('INPUT_INVALID','personalMarginLoan.balance','Margin loan balance is not a finite non-negative amount.')]});
 }
 const extra=supplied(view,externalEvidence,valuation.issues,liability.issues);
 valuation.entries.push(...extra.valuations);
 // Liabilities are grouped by canonical identity across captured AND supplied rows, so a
 // supplied 'personal-debt' (or 'liability:margin', ...) meets the captured row it names.
 // A repeated identity invalidates every member, independent of input order, and collapses
 // to one unknown entry so component IDs stay unique. A collision with a captured row is
 // fail-closed on the captured row too: the two sources either duplicate one obligation
 // (subtracting both double counts it) or contradict each other, and nothing here can tell
 // which amount is right, so neither contributes. The collapsed entry keeps the captured ID.
 const groups=new Map();
 for(const row of [...liability.entries,...extra.liabilities]){const key=row.identity||bareLiabilityKey(row.liabilityKey);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
 liability.entries=[];
 for(const members of groups.values()){
  if(members.length===1){const {identity,...row}=members[0];liability.entries.push(row);continue;}
  const captured=members.find(row=>row.provenance==='captured');
  liability.entries.push(collapse(members,captured?captured.liabilityKey:members[0].liabilityKey,'liabilityKey',
   {kind:'principal',provenance:captured?'captured+supplied':'supplied',includesKeys:captured?captured.includesKeys.slice():[],excludedKeys:[]},
   'Liability identity is claimed more than once; no representation is counted.'));
 }
 for(const [evidence,kind] of [[ownership,'ownershipSnapshot'],[valuation,'valuationEvidence'],[liability,'liabilityEvidence']]){freeze(evidence);issued.set(evidence,{kind,token});}
 bundle.ownershipSnapshot=ownership;bundle.valuationEvidence=valuation;bundle.liabilityEvidence=liability;
 return freeze(bundle);
}
function component(componentId,side,fields){
 return {componentId,beneficialOwnerEntityId:FOUNDER,side,assetKey:side==='asset'?componentId.slice(6):null,liabilityKey:side==='liability'?componentId:null,
  valuationBasis:null,amountJPY:null,sourceRefs:[],includesKeys:[],excludedKeys:[],completeness:'unknown',reasons:[],...fields};
}
function projectFounderWealth(rawState,ownershipSnapshot,valuationEvidence,liabilityEvidence){
 const result={authority:'read-only',projectionVersion:1,currency:JPY,components:[],knownNetWorth:null,totalNetWorth:null,complete:false,
  unvaluedComponents:[],exclusions:[],reasons:[]};
 const done=()=>{
  result.reasons.sort((a,b)=>order(a.path,b.path)||order(a.code,b.code));
  return freeze(result);
 };
 let view;
 try{view=captureView(rawState);}
 catch(error){result.reasons.push(reason('INPUT_INVALID','rawState','Raw state is not plain immutable JSON data.',[typeof error.evidencePath==='string'?error.evidencePath:'$']));return done();}
 // Every argument must be trusted evidence from one capture of this exact, unchanged view.
 const args=[['ownershipSnapshot',ownershipSnapshot],['valuationEvidence',valuationEvidence],['liabilityEvidence',liabilityEvidence]];
 const fresh=args.map(([name,evidence])=>{
  const entry=evidence&&typeof evidence==='object'?issued.get(evidence):undefined;
  const capture=entry&&entry.kind===name?captures.get(entry.token):undefined;
  return !!capture&&capture.rawState===rawState&&sameView(capture.view,view)&&ownershipFingerprint(rawState,capture.index)===capture.ownership?entry.token:null;
 });
 const tokens=new Set(fresh.filter(Boolean));
 args.forEach(([name],i)=>{if(!fresh[i]||tokens.size!==1)result.reasons.push(reason('STALE_EVIDENCE',`${name}.sourceSnapshotToken`,'Evidence is missing, foreign, forged or bound to another committed state revision.',[name]));});
 if(result.reasons.length)return done();
 const ownership=ownershipSnapshot,valuation=valuationEvidence.entries,liabilities=liabilityEvidence.entries;
 for(const [name,evidence] of args)for(const issue of evidence.issues)result.reasons.push(reason(issue.code,`${name}.${issue.path}`,issue.message,issue.evidenceRefs.map(p=>`${name}.${p}`)));
 // Currency gate precedes any amount arithmetic; rejected nominal amounts never contribute.
 const accepted=new Set();
 valuation.forEach((row,i)=>{if(row.currency===JPY)accepted.add(row);else result.reasons.push(reason('CURRENCY_UNSUPPORTED',`valuationEvidence.entries[${i}].currency`,'Only explicit JPY valuation evidence is supported; no FX conversion is performed.',[`valuationEvidence.entries[${i}]`]));});
 liabilities.forEach((row,i)=>{if(row.currency===JPY)accepted.add(row);else result.reasons.push(reason('CURRENCY_UNSUPPORTED',`liabilityEvidence.entries[${i}].currency`,'Only explicit JPY liability evidence is supported; no FX conversion is performed.',[`liabilityEvidence.entries[${i}]`]));});
 const blocked=path=>[reason('CURRENCY_UNSUPPORTED',path,'Evidence currency is not JPY.')];
 const copied=rows=>rows.map(r=>({...r,evidenceRefs:r.evidenceRefs.slice()}));
 const known=(c,amount,basis)=>{
  if(!money(amount)){c.reasons.push(reason('NUMERIC_DOMAIN_UNSUPPORTED',c.sourceRefs[0]?.path||c.componentId,'Amount is non-finite or outside the monetary envelope.'));return c;}
  c.amountJPY=amount===0?0:amount;c.valuationBasis=basis;c.completeness='known';return c;
 };
 const fromEntry=(c,row,sign,basis)=>{
  c.sourceRefs=row.sourceRefs.map(r=>({...r}));
  if(!accepted.has(row)){c.reasons.push(...blocked(row.sourceRefs[0].path));return c;}
  if(row.status!=='known'){c.reasons.push(...copied(row.reasons));return c;}
  return known(c,sign*row.value,basis);
 };
 // Personal cash.
 const cash=valuation.find(row=>row.valuationKey==='cash:personal');
 result.components.push(fromEntry(component('asset:personal-cash','asset',{includesKeys:cash.coveredAssets.slice()}),cash,1,'cash'));
 // Own company: one row; personally purchased own shares are inside the founder position.
 const founder=ownership.founder,ownCompany=component('asset:own-company','asset',{sourceRefs:founder.sourceRefs.map(r=>({...r})),includesKeys:founder.sourceRefs.map(r=>r.path),
  excludedKeys:['companyStocks','subsidiaries','peDeals(company)','startups.ownedCompany'],valuation:null});
 const ownSupplied=valuation.map((row,i)=>({row,i})).filter(item=>item.row.provenance==='supplied'&&item.row.assetKey==='own-company');
 if(founder.status!=='bound'||founder.quantity===null){
  ownCompany.reasons.push(...copied(founder.reasons.length?founder.reasons:[reason('IDENTITY_UNPROVEN','founderPosition','Founder beneficial position is unresolved.')]));
 }else if(ownership.publicCompany===true){
  for(const {i} of ownSupplied)result.exclusions.push({sourcePath:`valuationEvidence.entries[${i}]`,basis:'listed-company-uses-market-price',includedBy:'asset:own-company'});
  const quote=valuation.find(row=>row.valuationKey==='quote:own-company');
  if(!quote)ownCompany.reasons.push(reason('VALUATION_INCOMPLETE','stockPrice','No own-company quote evidence.'));
  else if(!accepted.has(quote))ownCompany.reasons.push(...blocked('stockPrice'));
  else if(quote.status!=='known')ownCompany.reasons.push(...copied(quote.reasons));
  else{ownCompany.valuation={kind:'marketPrice',price:quote.value,founderBeneficialShares:founder.quantity};known(ownCompany,quote.value*founder.quantity,'marketPrice');}
 }else if(ownership.publicCompany===false){
  const outstanding=founder.outstandingQuantity;
  if(!ownSupplied.length)ownCompany.reasons.push(reason('VALUATION_INCOMPLETE','ownCompanyEquityValue','No approved private Equity Value source exists (OD-04); legacy companyValue is not Equity Value.'));
  else if(ownSupplied.length>1)ownCompany.reasons.push(reason('VALUATION_SOURCE_CONFLICT','ownCompanyEquityValue','Multiple own-company valuation inputs; none is chosen.',ownSupplied.map(item=>`valuationEvidence.entries[${item.i}]`)));
  else{
   const {row,i}=ownSupplied[0],path=`valuationEvidence.entries[${i}]`;
   if(!accepted.has(row))ownCompany.reasons.push(...blocked(path));
   else if(row.kind!=='equityValue')ownCompany.reasons.push(reason('VALUATION_BASIS_UNSUPPORTED',path,row.kind==='enterpriseValue'?'Enterprise Value is not Equity Value; no debt bridge is applied.':'Only semantic equityValue evidence is supported.'));
   else if(!money(row.value)||row.value<0)ownCompany.reasons.push(reason('VALUATION_BASIS_UNSUPPORTED',path,'Equity Value must be a finite non-negative JPY amount.'));
   else if(typeof outstanding!=='number'||!(outstanding>0)||founder.quantity>outstanding)ownCompany.reasons.push(reason('DENOMINATOR_UNKNOWN','outstandingQuantity','Founder economic ownership cannot be derived.'));
   else{
    const economicOwnership=founder.quantity/outstanding;
    ownCompany.valuation={kind:'equityValue',equityValue:row.value,founderEconomicOwnership:economicOwnership,factor:PRIVATE_EQUITY_FACTOR,
     coveredAssets:row.coveredAssets.slice(),coveredLiabilities:row.coveredLiabilities.slice(),sourceMethod:row.sourceMethod,sourceVersion:row.sourceVersion,asOfWeek:row.asOfWeek};
    ownCompany.sourceRefs.push(...row.sourceRefs.map(r=>({...r})));
    known(ownCompany,row.value*economicOwnership*PRIVATE_EQUITY_FACTOR,'equityValue×economicOwnership×0.70');
   }
  }
 }else{
  // Listing status unknown (absent or non-boolean): neither formula applies.
  ownCompany.reasons.push(reason('VALUATION_INCOMPLETE','publicCompany','Listing status is not an explicit boolean; neither own-company formula applies.'));
 }
 result.components.push(ownCompany);
 // Other personal listed lots (P3-5), valued at the unique observed price.
 for(const lot of ownership.listed){
  const c=component(`asset:listed:${lot.alias}`,'asset',{includesKeys:[lot.sourcePath],sourceRefs:[ref(lot.sourcePath,lot.alias,'listed')]});
  const blocking=lot.reasons.filter(r=>!LISTED_INFORMATIONAL.has(r.code));
  const quote=valuation.find(row=>row.valuationKey===`quote:listed:${lot.alias}`);
  if(lot.alias===ownership.ticker)c.reasons.push(reason('ALIAS_BINDING_UNPROVEN',lot.sourcePath,'Own-ticker personal lot is not bound to the founder position; it is not valued separately.'));
  else if(blocking.length||lot.quantity===null)c.reasons.push(...(blocking.length?blocking:[{code:'QUANTITY_OUT_OF_ENVELOPE',path:lot.sourcePath}]).map(r=>reason(r.code,r.path,'Listed lot evidence is unresolved.')));
  else if(!quote)c.reasons.push(reason('VALUATION_INCOMPLETE',lot.sourcePath,'No quote evidence.'));
  else if(!accepted.has(quote))c.reasons.push(...blocked(lot.sourcePath));
  else if(quote.status!=='known')c.reasons.push(...copied(quote.reasons));
  else{c.valuation={kind:'marketPrice',price:quote.value,quantity:lot.quantity};known(c,quote.value*lot.quantity,'marketPrice');}
  result.components.push(c);
 }
 // Founder loan receivables: principal once; the company payable stays inside company equity.
 for(const row of valuation.filter(row=>row.kind==='principal'))result.components.push(fromEntry(component(`asset:${row.assetKey}`,'asset',{includesKeys:[row.sourceRefs[0].path]}),row,1,'principal'));
 // Families without an approved valuation adapter stay explicitly unvalued, never zero.
 for(const row of ownership.vc)result.components.push(component(`asset:vc-personal:${row.sourcePath}`,'asset',{sourceRefs:[ref(row.sourcePath,row.startupSourceId,'vc')],includesKeys:[row.sourcePath],
  reasons:[...(row.code?[reason(row.code,row.sourcePath,'Startup source evidence is unresolved.')]:[]),reason('VALUATION_INCOMPLETE',row.sourcePath,'Personal startup interests have no approved valuation basis (preferred terms, pending rounds).')]}));
 for(const row of ownership.angel)result.components.push(component(`asset:angel:${row.sourcePath}`,'asset',{sourceRefs:[ref(row.sourcePath,row.durableId,'angel')],includesKeys:[row.sourcePath],
  reasons:[reason('VALUATION_INCOMPLETE',row.sourcePath,'Legacy angel investments are a separate unresolved personal claim without an approved valuation basis.')]}));
 result.components.push(component('asset:pe-interests','asset',{sourceRefs:ownership.peSources.map(r=>({...r})),includesKeys:ownership.peSources.map(r=>r.path),
  reasons:[...ownership.peCodes.map(code=>reason(code,'peFirm.funds','PE fund-interest source evidence is unresolved.')),
   reason('VALUATION_INCOMPLETE','peDeals','Personal PE deal stakes and GP fund interests are unvalued: fund NAV, liabilities, waterfall/carry (OD-05) and P3-9 entitlement are not available.')]}));
 result.components.push(component('asset:unadapted-personal-families','asset',{
  reasons:[reason('VALUATION_INCOMPLETE','personalAssets','Personal real estate, investments, luxury assets, sports teams, the personal real-estate corporation and family trust are not adapted in this slice.')]}));
 // Liabilities: union of distinct identities; mirrors are excluded, never re-added.
 for(const row of liabilities)result.components.push(fromEntry(component(row.liabilityKey,'liability',{includesKeys:row.includesKeys.slice()}),row,-1,'principal'));
 result.components.push(component('liability:unreconciled-coverage','liability',{reasons:copied(liabilityEvidence.coverage.reasons)}));
 result.exclusions.push(...ownership.exclusions.map(r=>({...r})),...liabilityEvidence.exclusions.map(r=>({...r})));
 result.components.sort((a,b)=>order(a.componentId,b.componentId));
 result.exclusions.sort((a,b)=>order(a.sourcePath,b.sourcePath)||order(a.basis,b.basis));
 let total=0,any=false;
 for(const c of result.components)if(c.completeness==='known'){total+=c.amountJPY;any=true;}
 if(any&&money(total))result.knownNetWorth=total===0?0:total;
 else if(any)result.reasons.push(reason('NUMERIC_DOMAIN_UNSUPPORTED','knownNetWorth','Known subtotal is outside the monetary envelope.'));
 result.unvaluedComponents=result.components.filter(c=>c.amountJPY===null).map(c=>c.componentId);
 result.complete=result.reasons.length===0&&result.unvaluedComponents.length===0;
 result.totalNetWorth=result.complete?result.knownNetWorth:null;
 return done();
}
modules.phase3FounderWealth=Object.freeze({PRIVATE_EQUITY_FACTOR,captureFounderWealthEvidence,projectFounderWealth});
})();
