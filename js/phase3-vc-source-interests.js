// P3-8 partial source evidence. No canonical registry, valuation or settlement.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw Error('runtime.js must precede phase3-vc-source-interests.js');
if(modules.phase3VCSourceInterests)throw Error('VC source interests already registered');
const own=Object.prototype.hasOwnProperty,order=(a,b)=>a<b?-1:a>b?1:0;
const id=x=>typeof x==='string'&&x.trim().length>0;
const fraction=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
function intrinsic(proto,type){
 const c=proto&&Object.getOwnPropertyDescriptor(proto,'constructor');
 const p=c&&own.call(c,'value')&&typeof c.value==='function'&&Object.getOwnPropertyDescriptor(c.value,'prototype');
 return !!p&&p.value===proto&&Function.prototype.toString.call(c.value)===Function.prototype.toString.call(type);
}
function record(x){if(!x||typeof x!=='object'||Array.isArray(x))return false;const p=Object.getPrototypeOf(x);return p===null||(Object.getPrototypeOf(p)===null&&intrinsic(p,Object));}
function field(x,key){
 if(!record(x)&&!(Array.isArray(x)&&intrinsic(Object.getPrototypeOf(x),Array)))throw Error('INPUT_INVALID');
 const d=Object.getOwnPropertyDescriptor(x,key);if(!d)return undefined;
 if(!own.call(d,'value'))throw Error('INPUT_INVALID');return d.value;
}
function rows(x){
 if(x===undefined)return [];
 if(!Array.isArray(x)||!intrinsic(Object.getPrototypeOf(x),Array)||x.length>4096)throw Error('INPUT_INVALID');
 const result=[];for(let i=0;i<x.length;i++){const row=field(x,String(i));if(!record(row))throw Error('INPUT_INVALID');result.push(row);}return result;
}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function projectVCSourceInterests(raw){
 const out={authority:'read-only',adapterVersion:1,sourceScope:'startup-current-fraction-evidence',sourceSnapshotToken:null,
  complete:false,wealthComplete:false,commandEligible:false,observations:[],issues:[]};
 try{
  if(!record(raw))throw Error('INPUT_INVALID');
  const startups=rows(field(raw,'startups')),subs=rows(field(raw,'subsidiaries')),counts=new Map(),subIDs=new Map(),mirrors=new Map();
  for(const s of startups){const key=field(s,'id');if(id(key))counts.set(key,(counts.get(key)||0)+1);}
  subs.forEach((s,i)=>{const key=field(s,'id'),source=field(s,'startupID');if(id(key))subIDs.set(key,(subIDs.get(key)||0)+1);if(id(source)){if(!mirrors.has(source))mirrors.set(source,[]);mirrors.get(source).push({row:s,path:`subsidiaries[${i}]`});}});
  startups.forEach((s,i)=>{
   const path=`startups[${i}]`,source=field(s,'id'),company=field(s,'ownedCompany'),personal=field(s,'ownedPersonal');
   const ipo=field(s,'ipoStockID'),alive=field(s,'alive'),converted=field(s,'subsidiary'),pending=field(s,'activeFundingRound');
   let error=!id(source)||counts.get(source)!==1?'IDENTITY_UNPROVEN':!fraction(company)||!fraction(personal)||company+personal>1?'OWNERSHIP_CONFLICT':null;
   for(const [key,stake] of [['ddNegotiatedOwnedCompany',company],['ddNegotiatedOwnedPersonal',personal]]){
    const dd=field(s,key);if(!error&&dd!==undefined&&(!fraction(dd)||dd>stake))error='OWNERSHIP_CONFLICT';
   }
   if(!error&&ipo!==undefined&&ipo!==null&&!id(ipo))error='CONVERSION_UNPROVEN';
   if(!error&&id(ipo)&&(company>0||personal>0))error='CONVERSION_CONFLICT';
   if(!error&&pending!==undefined&&pending!==null)error='PENDING_ROUND_UNVERIFIED';
   if(!error&&converted!==undefined&&typeof converted!=='boolean')error='LIFECYCLE_UNKNOWN';
   if(!error&&typeof alive!=='boolean')error='LIFECYCLE_UNKNOWN';
   if(!error&&!alive&&!id(ipo))error='LIFECYCLE_UNKNOWN';
   for(const [account,stake] of [['company',company],['personal',personal]]){
    const row={startupSourceId:id(source)?source:null,account,sourcePath:path+'.owned'+(account==='company'?'Company':'Personal'),
     status:'unresolved',assetRole:'unresolved',economicFraction:null,quantity:null,votingFraction:null,
     issuerEntityId:null,securityClassId:null,ownershipKey:null,parentGenerationStatus:'unproven',aliasSourcePath:null};
    out.observations.push(row);let reason=error;
    const linked=mirrors.get(source)||[];
    // An inherited startupID on a restructuring replacement is not an alias.
    if(!reason&&account==='company'&&(converted===true||linked.length)){
     const mirror=linked[0]?.row,key=mirror&&field(mirror,'id');
     if(converted!==true||linked.length!==1||!id(key)||subIDs.get(key)!==1||field(mirror,'restructuredFrom')!==undefined||field(mirror,'status')!=='active'||!fraction(field(mirror,'ownership'))||field(mirror,'ownership')!==company||id(ipo))reason='ALIAS_CONFLICT';
     else{row.status='source-matched';row.assetRole='relationship-only';row.economicFraction=stake;row.aliasSourcePath=linked[0].path;continue;}
    }
    if(reason){out.issues.push({code:reason,path:row.sourcePath});continue;}
    row.status='source-matched';row.assetRole=id(ipo)?'historical':stake===0?'no-interest':'economic-interest';
    row.economicFraction=stake;
   }
  });
  out.observations.sort((a,b)=>order(a.startupSourceId||'',b.startupSourceId||'')||order(a.account,b.account)||order(a.sourcePath,b.sourcePath));
  out.issues.sort((a,b)=>order(a.path,b.path)||order(a.code,b.code));
 }catch(_){out.observations=[];out.issues=[{code:'INPUT_INVALID',path:'$'}];}
 return freeze(out);
}
modules.phase3VCSourceInterests=Object.freeze({projectVCSourceInterests});
})();
