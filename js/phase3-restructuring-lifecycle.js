// P3-6 source-scoped lifecycle evidence only; never an ownership/valuation writer.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('runtime.js must precede phase3-restructuring-lifecycle.js');
if(modules.phase3RestructuringLifecycle)throw new Error('Restructuring lifecycle already registered');
const own=Object.prototype.hasOwnProperty,order=(a,b)=>a<b?-1:a>b?1:0;
const id=x=>typeof x==='string'&&x.trim().length>0;
const week=x=>Number.isSafeInteger(x)&&x>0;
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
function rows(x,limit=512){
 if(x===undefined)return [];
 if(!Array.isArray(x)||!intrinsic(Object.getPrototypeOf(x),Array)||x.length>limit)throw Error('INPUT_INVALID');
 const out=[];for(let i=0;i<x.length;i++){const v=field(x,String(i));if(!record(v))throw Error('INPUT_INVALID');out.push(v);}return out;
}
function pair(x){if(!Array.isArray(x)||!intrinsic(Object.getPrototypeOf(x),Array)||x.length!==2)return null;const a=field(x,'0'),b=field(x,'1');return id(a)&&id(b)&&a!==b?[a,b].sort(order):null;}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
function projectRestructuringLifecycle(raw){
 const out={authority:'read-only',adapterVersion:1,sourceScope:'subsidiary-restructuring-lifecycle',sourceSnapshotToken:null,
  complete:false,commandEligible:false,wealthComplete:false,observations:[],issues:[]};
 const issue=(code,path)=>out.issues.push({code,path});
 try{
  if(!record(raw))throw Error('INPUT_INVALID');
  const subsidiaries=rows(field(raw,'subsidiaries'),4096),history=rows(field(raw,'groupRestructuringHistory')),projects=rows(field(raw,'integrationProjects'));
  const now=field(raw,'week'),counts=new Map(),subs=new Map(),receipts=new Map(),projectsByID=new Map(),uses=new Map();
  for(const s of subsidiaries){const key=field(s,'id');if(id(key)){counts.set(key,(counts.get(key)||0)+1);if(!subs.has(key))subs.set(key,[]);subs.get(key).push(s);}}
  function addReceipt(replacement,from,at,path,valid,mentioned){
   const receipt={replacement,from,week:at,path,valid:valid&&id(replacement)};
   // Preserve individual uses, including malformed/duplicate receipts. A Set of
   // target IDs would turn contradictory copies into one apparent proof.
   for(const source of new Set(mentioned.filter(id))){if(!uses.has(source))uses.set(source,[]);uses.get(source).push(receipt);}
   if(!id(replacement))return;
   if(!receipts.has(replacement))receipts.set(replacement,[]);
   receipts.get(replacement).push(receipt);
  }
  history.forEach((r,i)=>{
   if(field(r,'type')!=='merge')return;
   const a=field(r,'aID'),b=field(r,'bID'),from=id(a)&&id(b)&&a!==b?[a,b].sort(order):null;
   const replacement=field(r,'mergedID'),at=field(r,'week');
   addReceipt(replacement,from,at,`groupRestructuringHistory[${i}]`,!!from&&week(at)&&!from.includes(replacement),[a,b]);
  });
  for(const p of projects){const key=field(p,'id');if(id(key))projectsByID.set(key,(projectsByID.get(key)||0)+1);}
  projects.forEach((p,i)=>{
   const replacement=field(p,'mergedID');if(!id(replacement))return;
   const a=field(p,'aID'),b=field(p,'bID'),from=id(a)&&id(b)&&a!==b?[a,b].sort(order):null;
   const at=field(p,'completedWeek'),key=field(p,'id');
   addReceipt(replacement,from,at,`integrationProjects[${i}]`,id(key)&&projectsByID.get(key)===1&&field(p,'status')==='completed'&&field(p,'completionApplied')===true&&!!from&&week(at)&&!from.includes(replacement),[a,b]);
  });
  // Both installed writers retain 80 records; a missing ancestor at saturation
  // may have been evicted. Absence is not proof that it was an original leaf.
  const historyMayBeTruncated=history.length>=80||projects.length>=80;
  function lineage(key){
   const stack=[{key,beforeWeek:Infinity,exit:false}],active=new Set();let visits=0,liveConflict=false;
   while(stack.length){
    if(++visits>4*(receipts.size+1)+1)return 'GRAPH_LIMIT';
    const node=stack.pop();if(node.exit){active.delete(node.key);continue;}
    if(active.has(node.key))return 'CYCLE_UNSUPPORTED';
    const list=receipts.get(node.key);
    if(!list){if(historyMayBeTruncated)return 'ANCESTRY_UNPROVEN';continue;}
    if(list.length!==1||!list[0].valid||list[0].week>node.beforeWeek)return 'LIFECYCLE_CONFLICT';
    active.add(node.key);stack.push({key:node.key,exit:true});
    for(const source of list[0].from){
     if((uses.get(source)?.length||0)>1)return 'ALIAS_CONFLICT';
     const retained=subs.get(source)||[];
     if(retained.length>1||retained.some(r=>field(r,'status')!=='integrated'))liveConflict=true;
     stack.push({key:source,beforeWeek:list[0].week,exit:false});
    }
   }
   return liveConflict?'LIVE_PREDECESSOR_CONFLICT':null;
  }
  subsidiaries.forEach((s,i)=>{
   const rawFrom=field(s,'restructuredFrom');if(rawFrom===undefined)return;
   const path=`subsidiaries[${i}]`,replacement=field(s,'id'),from=pair(rawFrom),at=field(s,'restructuredWeek'),status=field(s,'status');
   const observation={replacementSourceId:id(replacement)?replacement:null,predecessorSourceIds:from||[],sourcePath:path,
    assetRole:'lifecycle-only',status:'unresolved',isCurrent:null,historicalPredecessorSourceIds:[],receiptPaths:[],
    parentGenerationStatus:'unproven',economicFraction:null,votingFraction:null,aliasReplacement:null};
   out.observations.push(observation);
   let error=!id(replacement)||counts.get(replacement)!==1?'IDENTITY_UNPROVEN':!from||from.includes(replacement)?'ALIAS_CONFLICT':!week(now)||!week(at)||at>now?'LIFECYCLE_UNKNOWN':!['active','sold','liquidated','integrated'].includes(status)?'LIFECYCLE_UNKNOWN':null;
   const proof=receipts.get(replacement)||[];
   if(!error&&(proof.length!==1||!proof[0].valid||proof[0].week!==at||JSON.stringify(proof[0].from)!==JSON.stringify(from)))error='LIFECYCLE_UNPROVEN';
   if(!error)error=lineage(replacement);
   // A replacement can itself be consumed by a subsequent retained receipt.
   // Only an integrated row may remain as historical evidence of that entity.
   if(!error&&(uses.get(replacement)?.length||0)>1)error='ALIAS_CONFLICT';
   if(!error&&uses.has(replacement)&&status!=='integrated')error='LIVE_PREDECESSOR_CONFLICT';
   if(!error&&uses.has(replacement)){
    const consuming=uses.get(replacement)[0];
    if(!consuming.valid||consuming.week<at||consuming.week>now)error='LIFECYCLE_CONFLICT';
    else error=lineage(consuming.replacement);
   }
   if(!error)for(const source of from){const retained=subs.get(source)||[];if(retained.length>1||retained.some(r=>field(r,'status')!=='integrated')){error='LIVE_PREDECESSOR_CONFLICT';break;}}
   if(error){issue(error,path);return;}
   observation.status='source-matched';observation.isCurrent=status==='active';
   observation.historicalPredecessorSourceIds=from.slice();observation.receiptPaths=[proof[0].path];
  });
  out.observations.sort((a,b)=>order(a.replacementSourceId||'',b.replacementSourceId||'')||order(a.sourcePath,b.sourcePath));
  out.issues.sort((a,b)=>order(a.path,b.path)||order(a.code,b.code));
 }catch(_){out.observations=[];out.issues=[{code:'INPUT_INVALID',path:'$'}];}
 return freeze(out);
}
modules.phase3RestructuringLifecycle=Object.freeze({projectRestructuringLifecycle});
})();
