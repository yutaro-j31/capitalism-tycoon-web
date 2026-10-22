'use strict';
// P3-7 opt-in pure raw-save projection. No PE settlement, issuer shares, or wealth authority.
// Recovered source; opt-in diagnostics only, not canonical ownership or wealth.
(function register(root){
  const has=Object.prototype.hasOwnProperty;
  const textOrder=(a,b)=>a<b?-1:a>b?1:0;
  const issue=(code,path)=>({code,path,message:code,evidenceRefs:[path]});
  const finiteNonnegative=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x*100<=Number.MAX_SAFE_INTEGER;
  const validId=x=>typeof x==='string'&&x.trim()!=='';
  const plain=x=>x!==null&&typeof x==='object'&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
  const isArray=Array.isArray;
  function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  function safeField(obj,key,path,errors){
    if(!plain(obj)){errors.push(issue('INPUT_INVALID',path));return {ok:false,present:false};}
    const descriptor=Object.getOwnPropertyDescriptor(obj,key);
    if(!descriptor)return {ok:true,present:false};
    if(!has.call(descriptor,'value')||!descriptor.enumerable){errors.push(issue('INPUT_INVALID',`${path}.${key}`));return {ok:false,present:true};}
    return {ok:true,present:true,value:descriptor.value};
  }
  // JSON-representable data only: plain records and dense arrays of own enumerable data fields,
  // finite numbers, strings, booleans and null. Iterative (no recursion), at most 64 levels and
  // 4,096 object visits. A shared (DAG) reference is data that JSON duplicates, so it is accepted
  // and counted on every visit; only an object already on the active path is a cycle.
  function jsonData(rootValue){
    const EXIT={},stack=[[rootValue,0]],path=new Set();let visits=0;
    while(stack.length){
      const [value,depth]=stack.pop();
      if(depth===EXIT){path.delete(value);continue;}
      if(value===null||typeof value==='string'||typeof value==='boolean')continue;
      if(typeof value==='number'){if(!Number.isFinite(value))return false;continue;}
      if(typeof value!=='object'||path.has(value)||depth>64||++visits>4096)return false;
      const isList=isArray(value);if(isList?Object.getPrototypeOf(value)!==Array.prototype:!plain(value))return false;
      const descriptors=Object.getOwnPropertyDescriptors(value),keys=Object.keys(descriptors);
      if(Reflect.ownKeys(descriptors).some(key=>typeof key==='symbol'))return false;
      // Arrays must be dense with no extra keys: exactly the indices 0..length-1 plus length.
      if(isList&&keys.length!==value.length+1)return false;
      path.add(value);stack.push([value,EXIT]);
      for(const key of isList?Array.from({length:value.length},(_,i)=>String(i)):keys){
        const d=descriptors[key];if(!d||!has.call(d,'value')||!d.enumerable)return false;
        stack.push([d.value,depth+1]);
      }
    }
    return true;
  }
  function read(obj,key,path,errors){const r=safeField(obj,key,path,errors);return r.ok&&r.present?r.value:undefined;}
  function requireNumber(obj,key,path,errors){const r=safeField(obj,key,path,errors);if(!r.ok)return null;if(!r.present||!finiteNonnegative(r.value)){errors.push(issue('AMOUNT_UNKNOWN',`${path}.${key}`));return null;}return r.value+0;}
  function requireId(obj,key,path,errors){const r=safeField(obj,key,path,errors);if(!r.ok)return null;if(!r.present||!validId(r.value)){errors.push(issue('IDENTITY_UNKNOWN',`${path}.${key}`));return null;}return r.value;}
  function inspectArray(value,path,errors,maxLength){
    if(!isArray(value)||Object.getPrototypeOf(value)!==Array.prototype){errors.push(issue('INPUT_INVALID',path));return null;}
    if(value.length>maxLength){errors.push(issue('INPUT_LIMIT_EXCEEDED',path));return null;}
    const descriptors=Object.getOwnPropertyDescriptors(value);
    if(Reflect.ownKeys(descriptors).some(key=>typeof key==='symbol')||Object.keys(descriptors).some(key=>key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||!has.call(descriptors[key],'value')||!descriptors[key].enumerable))){
      errors.push(issue('INPUT_INVALID',path));return null;
    }
    if(Object.keys(descriptors).filter(k=>k!=='length').length!==value.length){errors.push(issue('INPUT_INVALID',path));return null;}
    return Array.from({length:value.length},(_,i)=>descriptors[String(i)].value);
  }
  function unique(rows,selector,errors,path){
    const counts=new Map();for(const row of rows){const key=selector(row);if(key!==null)counts.set(key,(counts.get(key)||0)+1);}
    for(const [key,n] of counts){if(n>1)errors.push(issue('IDENTITY_COLLISION',`${path}:${key}`));}
    return counts;
  }
  function projectPEFundInterests(rawState){
    const result={authority:'read-only',adapterVersion:1,complete:false,commandEligible:false,wealthComplete:false,
      fundInterests:[],portfolioParticipations:[],managementRelationships:[],distributionEvidence:[],
      issues:[],sourceCoverage:[],valuationStatus:'unknown'};
    const errors=result.issues;
    if(!plain(rawState)){errors.push(issue('INPUT_INVALID','$'));return freeze(result);}
    const firm=safeField(rawState,'peFirm','$',errors);
    if(!firm.ok)return freeze(result);
    if(!firm.present){result.sourceCoverage.push({path:'peFirm',status:'absent-optional'});return freeze(result);}
    if(!plain(firm.value)){errors.push(issue('INPUT_INVALID','peFirm'));return freeze(result);}
    const fundsField=safeField(firm.value,'funds','peFirm',errors);
    if(!fundsField.ok)return freeze(result);
    if(!fundsField.present){errors.push(issue('SOURCE_UNKNOWN','peFirm.funds'));return freeze(result);}
    const funds=inspectArray(fundsField.value,'peFirm.funds',errors,20);
    if(!funds)return freeze(result);
    result.sourceCoverage.push({path:'peFirm.funds',status:'observed'});
    const ids=funds.map((fund,i)=>plain(fund)?requireId(fund,'id',`peFirm.funds[${i}]`,errors):null);
    const fundCounts=unique(ids.map(id=>({id})),r=>r.id,errors,'peFirm.funds');
    for(let i=0;i<funds.length;i++){
      const fund=funds[i],path=`peFirm.funds[${i}]`,id=ids[i];
      if(!plain(fund)){errors.push(issue('INPUT_INVALID',path));continue;}
      const collision=id!==null&&fundCounts.get(id)!==1;
      const size=requireNumber(fund,'size',path,errors),gp=requireNumber(fund,'gpCommit',path,errors),lp=requireNumber(fund,'lpContributed',path,errors);
      const status=read(fund,'status',path,errors);
      if(!['investing','harvesting','closed'].includes(status))errors.push(issue('LIFECYCLE_UNKNOWN',`${path}.status`));
      const totalsValid=size!==null&&size>0&&gp!==null&&lp!==null&&gp<=size&&lp<=size&&size-gp===lp;
      if(!totalsValid)errors.push(issue('CONTRIBUTION_MISMATCH',path));
      // Capital ratios, lifecycle and portfolio financing are independent source facts.
      const lifecycleSupported=id!==null&&!collision&&['investing','harvesting','closed'].includes(status);
      const capitalSupported=lifecycleSupported&&totalsValid;
      const interest={fundId:id,sourcePath:path,holder:'founder-personal-gp',fundStatus:typeof status==='string'?status:null,
        contributionRatio:capitalSupported?gp/size:null,current:lifecycleSupported&&status!=='closed',gpContributed:gp,lpContributed:lp,
        votingFraction:null,legalTargetShares:null,managementAuthority:false,wealthValue:null,
        status:capitalSupported?'observed':'unresolved'};
      result.fundInterests.push(interest);
      const manager=id!==null&&!collision?{fundId:id,sourcePath:path,relationship:'gp-manager',assetRole:'management-only',current:lifecycleSupported&&status!=='closed'}:null;
      if(manager)result.managementRelationships.push(manager);
      const paidKeys=['gpDistributed','lpDistributed','gpCarryPaid','managementFeesPaid'];
      const paid={fundId:id,sourcePath:path,kind:'historical-paid-cash',isReceivable:false};
      for(const key of paidKeys){const r=safeField(fund,key,path,errors);paid[key]=r.ok&&r.present&&finiteNonnegative(r.value)?r.value+0:null;
        if(r.ok&&r.present&&!finiteNonnegative(r.value))errors.push(issue('AMOUNT_UNKNOWN',`${path}.${key}`));}
      result.distributionEvidence.push(paid);
      const dealsField=safeField(fund,'deals',path,errors);
      if(dealsField.ok&&!dealsField.present)errors.push(issue('SOURCE_UNKNOWN',`${path}.deals`));
      const deals=dealsField.ok&&dealsField.present?inspectArray(dealsField.value,`${path}.deals`,errors,500):null;
      // A closed fund is still reconciled when its deal collection is unavailable: validated cash can
      // prove a live claim, while the missing collection keeps the interest unresolved.
      let liveDeal=false;
      if(deals){
      const dealIds=deals.map((deal,j)=>plain(deal)?requireId(deal,'id',`${path}.deals[${j}]`,errors):null);
      const counts=unique(dealIds.map(id=>({id})),r=>r.id,errors,`${path}.deals`);
      for(let j=0;j<deals.length;j++){
        const deal=deals[j],dealPath=`${path}.deals[${j}]`,dealId=dealIds[j];
        if(!plain(deal)){errors.push(issue('INPUT_INVALID',dealPath));continue;}
        const dealStatus=read(deal,'status',dealPath,errors);
        const settled=safeField(deal,'settlement',dealPath,errors);
        // Only a plain settlement record is lifecycle evidence; a malformed marker stays unresolved.
        const settlementMalformed=settled.ok&&settled.present&&settled.value!==null&&(!plain(settled.value)||!jsonData(settled.value));
        if(settlementMalformed)errors.push(issue('INPUT_INVALID',`${dealPath}.settlement`));
        const historical=dealStatus==='exited'||dealStatus==='sold'||dealStatus==='closed'||(settled.ok&&settled.present&&settled.value!==null&&!settlementMalformed);
        if(!['active','exited','sold','closed'].includes(dealStatus))errors.push(issue('LIFECYCLE_UNKNOWN',`${dealPath}.status`));
        const fundPortion=requireNumber(deal,'fundPortion',dealPath,errors),coinvestPortion=requireNumber(deal,'coinvestPortion',dealPath,errors),invested=requireNumber(deal,'investedAmount',dealPath,errors);
        const splitValid=invested!==null&&invested>0&&fundPortion!==null&&coinvestPortion!==null&&fundPortion+coinvestPortion===invested;
        if(!splitValid)errors.push(issue('FINANCING_MISMATCH',dealPath));
        const active=dealStatus==='active'&&!historical;
        const known=lifecycleSupported&&dealId!==null&&counts.get(dealId)===1&&active&&splitValid&&settled.ok&&!settlementMalformed;
        result.portfolioParticipations.push({fundId:id,dealId,sourcePath:dealPath,
          assetRole:known?'proceeds-participation':'unresolved',current:known,
          fundProceedsFraction:known?fundPortion/invested:null,externalCoinvestProceedsFraction:known?coinvestPortion/invested:null,
          legalEquityFraction:null,votingFraction:null,issuerId:null,founderBeneficialFraction:null,
          wealthValue:null,sourceStatus:typeof dealStatus==='string'?dealStatus:null});
        // Currentness needs only a validated unsettled lifecycle; allocation and identity gaps leave the
        // participation row unresolved but still prove that an asset is outstanding.
        if(active&&settled.ok&&!settlementMalformed)liveDeal=true;
      }
      }
      if(lifecycleSupported&&status==='closed'){
        const cash=requireNumber(fund,'cash',path,errors);
        const outstanding=liveDeal||(cash!==null&&cash>0);
        interest.current=outstanding;if(manager)manager.current=outstanding;
        if(cash===null||!deals){interest.status='unresolved';if(manager)manager.status='unresolved';}
      }
    }
    result.fundInterests.sort((a,b)=>textOrder(a.fundId||'',b.fundId||'')||textOrder(a.sourcePath,b.sourcePath));
    result.portfolioParticipations.sort((a,b)=>textOrder(a.fundId||'',b.fundId||'')||textOrder(a.dealId||'',b.dealId||'')||textOrder(a.sourcePath,b.sourcePath));
    result.managementRelationships.sort((a,b)=>textOrder(a.fundId,b.fundId));
    result.distributionEvidence.sort((a,b)=>textOrder(a.fundId||'',b.fundId||'')||textOrder(a.sourcePath,b.sourcePath));
    errors.sort((a,b)=>textOrder(a.path,b.path)||textOrder(a.code,b.code));
    return freeze(result);
  }
  // LP type labels and commitments are source metadata, never named legal LPs,
  // proof of paid-in capital, fund units, a receivable or founder wealth.
  function projectLPCommitments(rawState){
    const out={authority:'read-only',adapterVersion:1,complete:false,wealthComplete:false,commandEligible:false,
      funds:[],commitments:[],issues:[]},errors=out.issues;
    if(!plain(rawState)){errors.push(issue('INPUT_INVALID','$'));return freeze(out);}
    const firm=safeField(rawState,'peFirm','$',errors);
    if(!firm.ok||!firm.present)return freeze(out);
    const fundRows=inspectArray(read(firm.value,'funds','peFirm',errors),'peFirm.funds',errors,20);
    if(!fundRows)return freeze(out);
    const ids=fundRows.map((f,i)=>requireId(f,'id',`peFirm.funds[${i}]`,errors));
    const fundCounts=unique(ids.map(id=>({id})),r=>r.id,errors,'peFirm.funds');
    for(let i=0;i<fundRows.length;i++){
      const f=fundRows[i],path=`peFirm.funds[${i}]`,fundId=ids[i];
      const size=requireNumber(f,'size',path,errors),gp=requireNumber(f,'gpCommit',path,errors),lp=requireNumber(f,'lpContributed',path,errors);
      const status=read(f,'status',path,errors);
      const valid=fundId!==null&&fundCounts.get(fundId)===1&&size!==null&&size>0&&gp!==null&&gp<=size&&lp!==null&&size-gp===lp&&['investing','harvesting','closed'].includes(status);
      if(!valid)errors.push(issue('FUND_SOURCE_UNPROVEN',path));
      const observation={fundId,sourcePath:path,fundStatus:typeof status==='string'?status:null,declaredLPContributed:lp,
        observedCommitmentTotal:null,commitmentTotalMatchesDeclaredLP:null,paidCapitalAllocated:false};
      out.funds.push(observation);
      const source=safeField(f,'lps',path,errors);
      if(!source.ok)continue;
      if(!source.present){errors.push(issue('SOURCE_UNKNOWN',`${path}.lps`));continue;}
      const rows=inspectArray(source.value,`${path}.lps`,errors,100);
      if(!rows)continue;
      const keys=rows.map((r,j)=>requireId(r,'lpTypeID',`${path}.lps[${j}]`,errors));
      const counts=unique(keys.map(id=>({id})),r=>r.id,errors,`${path}.lps`);
      // Rows are identity-keyed and output is canonically sorted, so the sum is too: floating-point
      // addition is order-sensitive, and reordering the same rows must not change the reconciliation.
      let total=0,allValid=valid;const addends=[];
      for(let j=0;j<rows.length;j++){
        const rowPath=`${path}.lps[${j}]`,amount=requireNumber(rows[j],'committedAmount',rowPath,errors),lpTypeID=keys[j];
        const rowValid=valid&&lpTypeID!==null&&counts.get(lpTypeID)===1&&amount!==null;
        allValid=allValid&&rowValid;
        if(amount!==null)addends.push({lpTypeID,rowPath,amount});
        out.commitments.push({fundId,lpTypeID,sourcePath:rowPath,kind:'commitment-only',status:rowValid?'observed':'unresolved',
          committedAmount:amount,paidCapital:null,legalLPId:null,beneficialOwnerId:null,economicFraction:null,votingFraction:null,wealthValue:null});
      }
      addends.sort((a,b)=>textOrder(a.lpTypeID||'',b.lpTypeID||'')||textOrder(a.rowPath,b.rowPath));
      for(const x of addends)total+=x.amount;
      if(!finiteNonnegative(total)){allValid=false;errors.push(issue('AMOUNT_UNKNOWN',`${path}.lps`));}
      if(allValid){
        observation.observedCommitmentTotal=total;
        observation.commitmentTotalMatchesDeclaredLP=total===lp;
        if(total!==lp)errors.push(issue('COMMITMENT_TOTAL_MISMATCH',`${path}.lps`));
      }
    }
    out.funds.sort((a,b)=>textOrder(a.fundId||'',b.fundId||'')||textOrder(a.sourcePath,b.sourcePath));
    out.commitments.sort((a,b)=>textOrder(a.fundId||'',b.fundId||'')||textOrder(a.lpTypeID||'',b.lpTypeID||'')||textOrder(a.sourcePath,b.sourcePath));
    errors.sort((a,b)=>textOrder(a.path,b.path)||textOrder(a.code,b.code));return freeze(out);
  }
  if(typeof module==='object'&&module.exports)module.exports={projectPEFundInterests,projectLPCommitments};
  else if(root){const registry=root.__capitalismTycoonModules;if(!registry)throw new Error('runtime.js must precede phase3-pe-fund-interests.js');if(registry.phase3PeFundInterests)throw new Error('PE fund interests already registered');registry.phase3PeFundInterests=Object.freeze({projectPEFundInterests,projectLPCommitments});}
})(typeof globalThis==='object'?globalThis:null);
