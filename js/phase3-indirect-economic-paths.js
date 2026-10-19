// P3-6 diagnostic only. No ownership writer, settlement, voting or wealth authority.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('runtime.js must precede phase3-indirect-economic-paths.js');
if(modules.phase3IndirectEconomicPaths)throw new Error('Phase 3 indirect path module already registered');
const MAX_EDGES=4096,MAX_DEPTH=64,MAX_PATHS=256,MAX_VISITS=16384;
const cmp=(a,b)=>a<b?-1:a>b?1:0;
// Accept ordinary records across browser/VM realms without invoking constructors/getters.
function intrinsicPrototype(proto,constructor){
  if(!proto)return false;
  const d=Object.getOwnPropertyDescriptor(proto,'constructor');
  if(!d||!Object.prototype.hasOwnProperty.call(d,'value')||typeof d.value!=='function')return false;
  const p=Object.getOwnPropertyDescriptor(d.value,'prototype');
  return !!p&&p.value===proto&&Function.prototype.toString.call(d.value)===Function.prototype.toString.call(constructor);
}
function jsonContainer(value){
  if(value===null||typeof value!=='object')return false;
  const proto=Object.getPrototypeOf(value);
  if(Array.isArray(value))return intrinsicPrototype(proto,Array);
  return proto===null||(Object.getPrototypeOf(proto)===null&&intrinsicPrototype(proto,Object));
}
function data(object,key){
  if(!jsonContainer(object))throw new TypeError('Expected an ordinary JSON source container');
  const descriptor=Object.getOwnPropertyDescriptor(object,key);
  if(!descriptor)return undefined;
  if(!Object.prototype.hasOwnProperty.call(descriptor,'value'))throw new TypeError('Accessor evidence is unsupported');
  return descriptor.value;
}
function frozen(value){
  if(Array.isArray(value)){for(const row of value)frozen(row);}
  else if(value&&typeof value==='object'){for(const key of Object.keys(value))frozen(value[key]);}
  return Object.freeze(value);
}
function reason(code,path){return {code,path,message:code,evidenceRefs:[path]};}
// Validate own data descriptors without invoking accessors or walking cycles.
// Memoization allows shared acyclic metadata without exponential repeated work.
function validateEvidence(value){
  const active=new Set(),done=new Set();let visits=0;
  function invalid(message,path){throw Object.assign(new TypeError(message),{evidencePath:path});}
  function visit(item,depth,path){
    if(++visits>65536||depth>128)invalid('Evidence limit',path);
    if(typeof item==='number'&&!Number.isFinite(item))invalid('Non-finite evidence',path);
    if(item===null||['undefined','string','number','boolean'].includes(typeof item))return;
    if(typeof item!=='object'||!jsonContainer(item)||active.has(item))invalid('Invalid evidence container',path);
    if(done.has(item))return;
    active.add(item);
    for(const key of Reflect.ownKeys(item)){
      if(typeof key!=='string')invalid('Symbol evidence',path);
      const childPath=Array.isArray(item)&&/^(0|[1-9]\d*)$/.test(key)?`${path}[${key}]`
        :/^[A-Za-z_$][\w$]*$/.test(key)?`${path==='$'?'':path+'.'}${key}`:`${path}[${JSON.stringify(key)}]`;
      const descriptor=Object.getOwnPropertyDescriptor(item,key);
      if(!descriptor||!Object.prototype.hasOwnProperty.call(descriptor,'value'))invalid('Accessor evidence',childPath);
      if(!descriptor.enumerable&&!(Array.isArray(item)&&key==='length'))invalid('Non-enumerable evidence',childPath);
      visit(descriptor.value,depth+1,childPath);
    }
    active.delete(item);done.add(item);
  }
  visit(value,0,Array.isArray(value)?'relationships':'$');
}
function traceIndirectEconomicInterest(source,rootEntityId,targetEntityId){
  const output={authority:'read-only',adapterVersion:1,complete:false,commandEligible:false,
    rootEntityId:null,targetEntityId:null,status:'unknown',economicFraction:null,votingFraction:null,
    paths:[],issues:[]};
  function reject(code,path){output.issues.push(reason(code,path));return frozen(output);}
  const validId=id=>typeof id==='string'&&id.trim().length>0;
  if(!validId(rootEntityId)||!validId(targetEntityId)||rootEntityId===targetEntityId)return reject('INPUT_INVALID','$root-target');
  output.rootEntityId=rootEntityId;output.targetEntityId=targetEntityId;
  try{
    const rows=Array.isArray(source)?source:data(source,'relationships');
    if(!Array.isArray(rows)||!jsonContainer(rows)||rows.length>MAX_EDGES)return reject('INPUT_INVALID','relationships');
    validateEvidence(source);
    const edges=[],edgeIds=new Set(),pairs=new Set();
    for(let i=0;i<rows.length;i++){
      const row=data(rows,String(i)),path='relationships['+i+']';
      if(!row||typeof row!=='object'||Array.isArray(row))return reject('INPUT_INVALID',path);
      const id=data(row,'edgeId'),parent=data(row,'parentEntityId'),child=data(row,'childEntityId');
      const current=data(row,'isCurrent'),status=data(row,'status');
      if(current===false&&status==='historical')continue;
      if(!validId(id)||!validId(parent)||!validId(child))return reject('IDENTITY_UNPROVEN',path);
      const pairKey=JSON.stringify([parent,child]);
      if(edgeIds.has(id)||pairs.has(pairKey))return reject('ALIAS_CONFLICT',path);
      edgeIds.add(id);pairs.add(pairKey);
      const fraction=data(row,'economicFraction'),assetRole=data(row,'assetRole');
      let value=null;
      if(fraction!==undefined&&fraction!==null){
        if(typeof fraction!=='object'||Array.isArray(fraction))return reject('INPUT_INVALID',path+'.economicFraction');
        if(data(fraction,'status')==='known')value=data(fraction,'value');
      }
      const known=current===true&&status==='observed'&&assetRole==='relationship-only'
        &&typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
      edges.push({id,parent,child,path,value:known?(value===0?0:value):null,known});
    }
    const adjacency=new Map();
    for(const edge of edges){
      if(!adjacency.has(edge.parent))adjacency.set(edge.parent,[]);
      adjacency.get(edge.parent).push(edge);
    }
    for(const list of adjacency.values())list.sort((a,b)=>cmp(a.id,b.id)||cmp(a.child,b.child));
    const color=new Map();
    function validate(node,depth){
      if(depth>MAX_DEPTH)throw new Error('GRAPH_LIMIT');
      if(color.get(node)===1)throw new Error('CYCLE_UNSUPPORTED');
      if(color.get(node)===2)return;
      color.set(node,1);
      for(const edge of adjacency.get(node)||[]){
        if(!edge.known)throw Object.assign(new Error('SOURCE_INCOMPLETE'),{evidencePath:edge.path});
        validate(edge.child,depth+1);
      }
      color.set(node,2);
    }
    try{validate(rootEntityId,0);}
    catch(error){return reject(['CYCLE_UNSUPPORTED','SOURCE_INCOMPLETE','GRAPH_LIMIT'].includes(error.message)?error.message:'INPUT_INVALID',typeof error.evidencePath==='string'?error.evidencePath:'relationships');}
    let visits=0;
    function walk(node,entities,ids,fraction,depth){
      if(++visits>MAX_VISITS||depth>MAX_DEPTH||output.paths.length>=MAX_PATHS)throw new Error('GRAPH_LIMIT');
      if(node===targetEntityId){
        output.paths.push({edgeIds:ids.slice(),entityIds:entities.slice(),economicFraction:fraction});return;
      }
      for(const edge of adjacency.get(node)||[]){
        const next=fraction*edge.value;
        if(next===0&&fraction>0&&edge.value>0)throw new Error('PRECISION_UNSUPPORTED');
        walk(edge.child,entities.concat(edge.child),ids.concat(edge.id),next,depth+1);
      }
    }
    try{walk(rootEntityId,[rootEntityId],[],1,0);}
    catch(error){output.paths=[];return reject(error.message==='PRECISION_UNSUPPORTED'?'PRECISION_UNSUPPORTED':'GRAPH_LIMIT','relationships');}
    if(output.paths.length===0)return reject('PATH_UNPROVEN','$target');
    output.paths.sort((a,b)=>cmp(a.edgeIds.join('|'),b.edgeIds.join('|')));
    if(output.paths.length!==1)return reject('MULTIPATH_AGGREGATION_UNSUPPORTED','relationships');
    output.status='known';output.economicFraction=output.paths[0].economicFraction;
    return frozen(output);
  }catch(error){output.paths=[];return reject('INPUT_INVALID',typeof error.evidencePath==='string'?error.evidencePath:'relationships');}
}
modules.phase3IndirectEconomicPaths=Object.freeze({traceIndirectEconomicInterest});
})();
