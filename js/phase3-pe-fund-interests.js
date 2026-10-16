'use strict';
// P3-7 opt-in pure raw-save projection. No PE settlement, issuer shares, or wealth authority.
// Candidate source file; integration into the dependency stack is intentionally pending.
(function register(root){
  const has=Object.prototype.hasOwnProperty;
  const textOrder=(a,b)=>a<b?-1:a>b?1:0;
  const issue=(code,path)=>({code,path});
  const finiteNonnegative=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
  const validId=x=>typeof x==='string'&&x.trim()!=='';
  const plain=x=>x!==null&&typeof x==='object'&&(Object.getPrototypeOf(x)===Object.prototype||Object.getPrototypeOf(x)===null);
  const isArray=Array.isArray;
  function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  function safeField(obj,key,path,errors){
    if(!plain(obj)){errors.push(issue('INPUT_INVALID',path));return {ok:false,present:false};}
    const descriptor=Object.getOwnPropertyDescriptor(obj,key);
    if(!descriptor)return {ok:true,present:false};
    if(!has.call(descriptor,'value')){errors.push(issue('INPUT_INVALID',`${path}.${key}`));return {ok:false,present:true};}
    return {ok:true,present:true,value:descriptor.value};
  }
  function read(obj,key,path,errors){const r=safeField(obj,key,path,errors);return r.ok&&r.present?r.value:undefined;}
  function requireNumber(obj,key,path,errors){const r=safeField(obj,key,path,errors);if(!r.ok)return null;if(!r.present||!finiteNonnegative(r.value)){errors.push(issue('AMOUNT_UNKNOWN',`${path}.${key}`));return null;}return r.value;}
  function requireId(obj,key,path,errors){const r=safeField(obj,key,path,errors);if(!r.ok)return null;if(!r.present||!validId(r.value)){errors.push(issue('IDENTITY_UNKNOWN',`${path}.${key}`));return null;}return r.value;}
  function inspectArray(value,path,errors,maxLength){
    if(!isArray(value)||Object.getPrototypeOf(value)!==Array.prototype){errors.push(issue('INPUT_INVALID',path));return null;}
    if(value.length>maxLength){errors.push(issue('INPUT_LIMIT_EXCEEDED',path));return null;}
    const descriptors=Object.getOwnPropertyDescriptors(value);
    if(Reflect.ownKeys(descriptors).some(key=>typeof key==='symbol')||Object.keys(descriptors).some(key=>key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||!has.call(descriptors[key],'value')))){
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
      const supported=id!==null&&!collision&&totalsValid&&['investing','harvesting','closed'].includes(status);
      const interest={fundId:id,sourcePath:path,holder:'founder-personal-gp',fundStatus:typeof status==='string'?status:null,
        contributionRatio:supported?gp/size:null,current:supported&&status!=='closed',gpContributed:gp,lpContributed:lp,
        votingFraction:null,legalTargetShares:null,managementAuthority:false,wealthValue:null,
        status:supported?'observed':'unresolved'};
      result.fundInterests.push(interest);
      if(id!==null&&!collision)result.managementRelationships.push({fundId:id,sourcePath:path,relationship:'gp-manager',assetRole:'management-only',current:supported&&status!=='closed'});
      const paidKeys=['gpDistributed','lpDistributed','gpCarryPaid','managementFeesPaid'];
      const paid={fundId:id,sourcePath:path,kind:'historical-paid-cash',isReceivable:false};
      for(const key of paidKeys){const r=safeField(fund,key,path,errors);paid[key]=r.ok&&r.present&&finiteNonnegative(r.value)?r.value:null;
        if(r.ok&&r.present&&!finiteNonnegative(r.value))errors.push(issue('AMOUNT_UNKNOWN',`${path}.${key}`));}
      result.distributionEvidence.push(paid);
      const dealsField=safeField(fund,'deals',path,errors);
      if(!dealsField.ok)continue;
      if(!dealsField.present){errors.push(issue('SOURCE_UNKNOWN',`${path}.deals`));continue;}
      const deals=inspectArray(dealsField.value,`${path}.deals`,errors,500);
      if(!deals)continue;
      const dealIds=deals.map((deal,j)=>plain(deal)?requireId(deal,'id',`${path}.deals[${j}]`,errors):null);
      const counts=unique(dealIds.map(id=>({id})),r=>r.id,errors,`${path}.deals`);
      for(let j=0;j<deals.length;j++){
        const deal=deals[j],dealPath=`${path}.deals[${j}]`,dealId=dealIds[j];
        if(!plain(deal)){errors.push(issue('INPUT_INVALID',dealPath));continue;}
        const dealStatus=read(deal,'status',dealPath,errors);
        const settled=safeField(deal,'settlement',dealPath,errors);
        const historical=dealStatus==='exited'||dealStatus==='sold'||dealStatus==='closed'||(settled.ok&&settled.present&&settled.value!==null);
        if(!['active','exited','sold','closed'].includes(dealStatus))errors.push(issue('LIFECYCLE_UNKNOWN',`${dealPath}.status`));
        const fundPortion=requireNumber(deal,'fundPortion',dealPath,errors),coinvestPortion=requireNumber(deal,'coinvestPortion',dealPath,errors),invested=requireNumber(deal,'investedAmount',dealPath,errors);
        const splitValid=invested!==null&&invested>0&&fundPortion!==null&&coinvestPortion!==null&&fundPortion+coinvestPortion===invested;
        if(!splitValid)errors.push(issue('FINANCING_MISMATCH',dealPath));
        const active=dealStatus==='active'&&!historical;
        const known=supported&&status!=='closed'&&dealId!==null&&counts.get(dealId)===1&&active&&splitValid&&settled.ok;
        result.portfolioParticipations.push({fundId:id,dealId,sourcePath:dealPath,
          assetRole:known?'proceeds-participation':'unresolved',current:known,
          fundProceedsFraction:known?fundPortion/invested:null,externalCoinvestProceedsFraction:known?coinvestPortion/invested:null,
          legalEquityFraction:null,votingFraction:null,issuerId:null,founderBeneficialFraction:null,
          wealthValue:null,sourceStatus:typeof dealStatus==='string'?dealStatus:null});
      }
    }
    result.fundInterests.sort((a,b)=>textOrder(a.fundId||'',b.fundId||'')||textOrder(a.sourcePath,b.sourcePath));
    result.portfolioParticipations.sort((a,b)=>textOrder(a.fundId||'',b.fundId||'')||textOrder(a.dealId||'',b.dealId||'')||textOrder(a.sourcePath,b.sourcePath));
    result.managementRelationships.sort((a,b)=>textOrder(a.fundId,b.fundId));
    result.distributionEvidence.sort((a,b)=>textOrder(a.fundId||'',b.fundId||'')||textOrder(a.sourcePath,b.sourcePath));
    errors.sort((a,b)=>textOrder(a.path,b.path)||textOrder(a.code,b.code));
    return freeze(result);
  }
  if(typeof module==='object'&&module.exports)module.exports={projectPEFundInterests};
  else if(root){const registry=root.__capitalismTycoonModules||(root.__capitalismTycoonModules={});registry.phase3PeFundInterests=Object.freeze({projectPEFundInterests});}
})(typeof globalThis==='object'?globalThis:null);
