'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/phase3-indirect-economic-paths.js'), 'utf8');
function load() {
  const context = {__capitalismTycoonModules: {}};
  vm.runInNewContext(source, context, {filename:'phase3-indirect-economic-paths.js'});
  return context.__capitalismTycoonModules.phase3IndirectEconomicPaths.traceIndirectEconomicInterest;
}
const trace = load();
const plain = x => JSON.parse(JSON.stringify(x));
const edge = (edgeId, parentEntityId, childEntityId, value, extra={}) => ({
  edgeId,parentEntityId,childEntityId,status:'observed',isCurrent:true,
  assetRole:'relationship-only',economicFraction:{status:'known',value},...extra
});
const known = (rows, root='A', target='C') => trace({relationships:rows,saveVersion:9},root,target);
const chain = [edge('e1','A','B',.8),edge('e2','B','C',.5)];
const input = {relationships:chain,saveVersion:9,companyCash:123,personalCash:456,simulationRng:{seed:17}};
const before = JSON.stringify(input);
const result = trace(input,'A','C');
assert.equal(result.status,'known');
assert.equal(result.economicFraction,.4);
assert.equal(result.votingFraction,null);
assert.equal(result.authority,'read-only');
assert.equal(result.complete,false);
assert.equal(result.commandEligible,false);
assert.deepEqual(plain(result.paths[0].edgeIds),['e1','e2']);
assert.equal(JSON.stringify(input),before,'source must remain unchanged');
assert.equal(Object.isFrozen(result),true);
assert.equal(Object.isFrozen(result.paths[0].edgeIds),true);
assert.deepEqual(plain(trace(plain(input),'A','C')),plain(result),'v9 JSON reload');
assert.deepEqual(plain(known(chain.slice().reverse())),plain(result),'input order must not change output');
function lock(x){if(x&&typeof x==='object'){Object.values(x).forEach(lock);Object.freeze(x);}}
const locked=plain(input);lock(locked);
assert.deepEqual(plain(trace(locked,'A','C')),plain(result),'frozen input');
assert.equal(known([edge('old','A','B',.3,{status:'historical',isCurrent:false}),...chain]).economicFraction,.4);
assert.equal(known([...chain,edge('dup','A','B',.2)]).issues[0].code,'ALIAS_CONFLICT');
assert.equal(known([...chain,edge('e1','X','Y',.2)]).issues[0].code,'ALIAS_CONFLICT');
assert.equal(known([edge('x','A','B',.8),edge('y','B','A',.5),edge('z','B','C',.3)]).issues[0].code,'CYCLE_UNSUPPORTED');
const diamond=[edge('a','A','B',.8),edge('b','B','C',.5),edge('c','A','D',.7),edge('d','D','C',.4)];
assert.equal(known(diamond).issues[0].code,'MULTIPATH_AGGREGATION_UNSUPPORTED');
assert.equal(known([edge('a','A','B',.8)]).issues[0].code,'PATH_UNPROVEN');
assert.equal(known([edge('a','A','B',.8),edge('b','B','C',.5,{assetRole:'alias'})]).issues[0].code,'SOURCE_INCOMPLETE');
assert.equal(known([edge('a','A','B',.8),edge('b','B','C',.5,{assetRole:'unresolved'})]).issues[0].code,'SOURCE_INCOMPLETE');
assert.equal(known([edge('a','A','B',.8),edge('b','B','C',.5,{isCurrent:null})]).issues[0].code,'SOURCE_INCOMPLETE');
assert.equal(known([edge('a','A','B',.8),edge('b','B','C',2)]).issues[0].code,'SOURCE_INCOMPLETE');
assert.equal(known([edge('a','A','B',.8),edge('b','B','C',NaN)]).issues[0].code,'INPUT_INVALID');
assert.equal(trace({},'A','C').issues[0].code,'INPUT_INVALID');
assert.equal(trace({relationships:chain},'A','A').issues[0].code,'INPUT_INVALID');
let getterCount=0;
const malicious=edge('m','A','B',.5);
Object.defineProperty(malicious,'economicFraction',{enumerable:true,get(){getterCount++;throw Error('must not run');}});
assert.equal(known([malicious]).issues[0].code,'INPUT_INVALID');
assert.equal(getterCount,0,'source accessor must not execute');
const colliding=[edge('left','A|B','C',.5),edge('right','A','B|C',.5)];
assert.notEqual(known(colliding,'A|B','C').issues[0]?.code,'ALIAS_CONFLICT','distinct parent/child pairs must not alias');
assert.equal(typeof load(),'function');
{
let seed=0x19781016;function rnd(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2**32;}
for(let n=2;n<80;n++){
  const nodes=Array.from({length:n},(_,i)=>'entity:'+i+'|'+i%7), rows=[];let expected=1;
  for(let i=0;i<n-1;i++){const v=Math.floor(rnd()*1000)/1000;rows.push(edge('edge:'+i,nodes[i],nodes[i+1],v));expected*=v;}
  const out=trace({relationships:rows},nodes[0],nodes[n-1]);
  if(n-1>64){assert.equal(out.status,'unknown');assert.equal(out.issues[0].code,'GRAPH_LIMIT');continue;}
  if(expected===0){assert.equal(out.status,'known');assert.equal(out.economicFraction,0);}else{
    assert.equal(out.status,'known','n='+n+' '+out.issues[0]?.code);
    assert.equal(out.economicFraction,expected);
  }
  const reversed=trace({relationships:rows.slice().reverse()},nodes[0],nodes[n-1]);
  assert.equal(JSON.stringify(out),JSON.stringify(reversed));
}
const rows=[edge('start','root','hub',1)];
for(let i=0;i<256;i++){
  rows.push(edge('left'+i,'hub','mid'+i,1));
  rows.push(edge('right'+i,'mid'+i,'target',.5));
}
const multi=trace({relationships:rows},'root','target');
assert.equal(multi.status,'unknown');
assert(['GRAPH_LIMIT','MULTIPATH_AGGREGATION_UNSUPPORTED'].includes(multi.issues[0].code));
assert.equal(trace({relationships:[edge('one','root','target',.5),edge('two','x','y',.3),edge('three','y','x',.3)]},'root','target').status,'known');
assert.equal(trace({relationships:[edge('one','root','target',.5),edge('two','root','x',.3),edge('three','x','x',.3)]},'root','target').issues[0].code,'CYCLE_UNSUPPORTED');
let count=0;const arr=[edge('x','root','target',.4)];Object.defineProperty(arr,'0',{get(){count++;throw Error('getter');}});
assert.equal(trace({relationships:arr},'root','target').issues[0].code,'INPUT_INVALID');assert.equal(count,0);
}


// Dead-end DAG paths must consume the work budget even without a target match.
{
 const rows=[];let parents=['root'];
 for(let level=0;level<16;level++){
   const children=['L'+level,'R'+level];
   for(const parent of parents)for(const child of children)rows.push(edge(parent+'>'+child,parent,child,.5));
   parents=children;
 }
 const out=trace({relationships:rows},'root','absent');
 assert.equal(out.status,'unknown');assert.equal(out.issues[0].code,'GRAPH_LIMIT');
 assert.equal(out.paths.length,0);assert.equal(out.economicFraction,null);
}

// Only ordinary JSON containers (including null-prototype records) are evidence.
{
 class Exotic{};
 for(const where of ['container','row','fraction','array']){
   const row=edge('e','root','target',.4);let input={relationships:[row]};
   if(where==='container')input=Object.assign(new Exotic(),input);
   if(where==='row')input.relationships[0]=Object.assign(new Exotic(),row);
   if(where==='fraction')row.economicFraction=Object.assign(new Exotic(),row.economicFraction);
   if(where==='array')Object.setPrototypeOf(input.relationships,{});
   assert.equal(trace(input,'root','target').issues[0].code,'INPUT_INVALID',where);
 }
 const row=edge('e','root','target',.4);Object.setPrototypeOf(row,Object.create(null));
 assert.equal(trace({relationships:[row]},'root','target').issues[0].code,'INPUT_INVALID');
 const valid=edge('e','root','target',.4);Object.setPrototypeOf(valid,null);Object.setPrototypeOf(valid.economicFraction,null);
 assert.equal(trace({relationships:[valid]},'root','target').status,'known');
}

// Shared Reason shape is required even on early input failures.
for(const out of [trace({},'A','C'),known(diamond),known([])])for(const issue of out.issues){
 assert.equal(typeof issue.message,'string');assert(issue.message.length>0);
 assert.deepEqual(plain(issue.evidenceRefs),[issue.path]);
}
for(const location of ['source','array','row','fraction']){
 const rows=[edge('e','A','C',.4)],input={relationships:rows};
 const cycle=location==='source'?input:location==='array'?rows:location==='row'?rows[0]:rows[0].economicFraction;
 cycle.self=cycle;
 assert.equal(trace(input,'A','C').issues[0]?.code,'INPUT_INVALID',location);
}
for(const bad of [NaN,Infinity,-Infinity]){
 const rows=[edge('e','A','C',.4)];rows[0].metadata={bad};
 assert.equal(known(rows).issues[0]?.code,'INPUT_INVALID');
}
{
 const shared={note:'same data, not a cycle'},rows=[edge('e','A','C',.4)];
 rows[0].left=shared;rows[0].right=shared;assert.equal(known(rows).status,'known');
 let reads=0;Object.defineProperty(shared,'hidden',{get(){reads++;throw Error('must not run');}});
 assert.equal(known(rows).issues[0]?.code,'INPUT_INVALID');assert.equal(reads,0);
}
{
 const rows=[edge('e','A','C',-0)],out=known(rows);
 assert.equal(out.status,'known');assert(Object.is(out.economicFraction,0));
 assert(Object.is(out.paths[0].economicFraction,0));assert.equal(known(plain(rows)).economicFraction,out.economicFraction);
}
{
 const fullEdge=(id,parent,child,value)=>edge(id,parent,child,value,{
  beneficialOwnerEntityId:null,votingFraction:null,kind:'subsidiary',sourceRefs:[],aliasOf:null
 });
 const rows=[fullEdge('e','A','C',.4)];
 for(let i=1;i<4096;i++)rows.push(fullEdge('isolated'+i,'X'+i,'Y'+i,.5));
 const out=known(rows);
 assert.equal(out.economicFraction,.4,'complete supported 4096-edge shape survives descriptor validation');
 assert.deepEqual(plain(known(plain(rows))),plain(out),'full supported shape retains JSON parity');
 assert.equal(trace(rows,'A','C').economicFraction,.4,'array source supports the same full shape');
 assert.equal(known(rows.concat(fullEdge('excess','X4096','Y4096',.5))).issues[0].code,'INPUT_INVALID','edge limit stays enforced');
 const deep=[edge('deep','A','C',.4)];let node=deep[0];
 for(let i=0;i<130;i++){node.child={};node=node.child;}
 assert.equal(known(deep).issues[0]?.code,'INPUT_INVALID','bounded descriptor validation');
}
for(const kind of ['accessor','cycle','nonfinite']){
 const rows=Array.from({length:58},(_,i)=>edge('edge'+i,i?'X'+i:'A',i?'Y'+i:'C',.4));
 const metadata={};rows[57].economicFraction.metadata=metadata;let reads=0;
 if(kind==='accessor')Object.defineProperty(metadata,'bad',{get(){reads++;throw Error('must not run');}});
 if(kind==='cycle')metadata.self=metadata;
 if(kind==='nonfinite')metadata.bad=Infinity;
 for(const input of [{relationships:rows},rows]){
  const out=trace(input,'A','C'),path='relationships[57].economicFraction.metadata.'+(kind==='cycle'?'self':'bad');
  assert.equal(out.issues[0].path,path);assert.deepEqual(plain(out.issues[0].evidenceRefs),[path]);assert.equal(reads,0);
 }
}
for(const key of ['value','status']){
 const rows=[edge('hidden','A','C',.4)];
 Object.defineProperty(rows[0].economicFraction,key,{value:rows[0].economicFraction[key],enumerable:false});
 const out=known(rows);
 assert.equal(out.status,'unknown');assert.equal(out.issues[0].code,'INPUT_INVALID');
 assert.equal(out.issues[0].path,'relationships[0].economicFraction.'+key);
 assert.notEqual(known(plain(rows)).status,'known','JSON reload cannot restore hidden evidence');
}
for(const change of [e=>e.assetRole='unsupported',e=>e.economicFraction.status='unknown',e=>e.isCurrent=false]){
 const rows=Array.from({length:58},(_,i)=>edge('row'+i,'X'+i,'Y'+i,.4));
 rows[57]=edge('bad','A','C',.4);change(rows[57]);
 for(const input of [rows,{relationships:rows}]){
  const out=trace(input,'A','C');assert.equal(out.issues[0].code,'SOURCE_INCOMPLETE');
  assert.equal(out.issues[0].path,'relationships[57]');
  assert.deepEqual(plain(out.issues[0].evidenceRefs),['relationships[57]']);
 }
}
console.log('PASS P3-6 indirect economic paths: strict evidence, graph ambiguity, purity, frozen output, v9 reload');
