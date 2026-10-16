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
assert.equal(known([edge('a','A','B',.8),edge('b','B','C',NaN)]).issues[0].code,'SOURCE_INCOMPLETE');
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
console.log('PASS P3-6 indirect economic paths: strict evidence, graph ambiguity, purity, frozen output, v9 reload');
