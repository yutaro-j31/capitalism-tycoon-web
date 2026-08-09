'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {ROOT,readIndex}=require('./harness');

const OBSERVER=/new\s+(?:[A-Za-z_$][\w$]*\.)?MutationObserver\s*\(/g;
const UNQUALIFIED=/new\s+MutationObserver\s*\(/g;
const MIGRATED=[
  'real-estate-ui.js',
  'iphone-playtest-fixes.js',
  'physical-iphone-playtest.js',
  'player-turnaround-plan-report.js'
];
const INLINE_IDS=['d-ui-nav-scrub','setup-recovery-bootstrap','game-over-settings-bridge'];
const SKIP_DIRS=new Set(['.git','node_modules','tests','docs']);

function observerMatches(text,pattern=OBSERVER){
  pattern.lastIndex=0;
  return Array.from(String(text||'').matchAll(pattern));
}
function isText(buffer){return !buffer.includes(0);}
function walkProduction(dir=ROOT,relative=''){
  const rows=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const rel=relative?path.join(relative,entry.name):entry.name;
    if(entry.isDirectory()){
      if(SKIP_DIRS.has(entry.name))continue;
      rows.push(...walkProduction(path.join(dir,entry.name),rel));
      continue;
    }
    if(!entry.isFile())continue;
    const buffer=fs.readFileSync(path.join(dir,entry.name));
    if(!isText(buffer))continue;
    const text=buffer.toString('utf8');
    const matches=observerMatches(text);
    if(matches.length)rows.push({path:rel.split(path.sep).join('/'),occurrences:matches.length});
  }
  return rows;
}

for(const name of MIGRATED){
  const code=fs.readFileSync(path.join(ROOT,'js',name),'utf8');
  assert.equal(observerMatches(code).length,0,`${name} must not retain any MutationObserver constructor`);
  assert.match(code,/uiEnhancerRegistry|registerUIEnhancer|runUIEnhancers/,`${name} must use the deterministic enhancer path`);
}
for(const name of ['real-estate-ui.js','iphone-playtest-fixes.js','player-turnaround-plan-report.js']){
  const code=fs.readFileSync(path.join(ROOT,'js',name),'utf8');
  assert.doesNotMatch(code,/queueMicrotask/,`${name} must not retain observer-era microtask scheduling`);
}

// Enhancer registration is not a render event. Each registration must execute
// only its own hook, before or after the first #app render. Replaying all earlier
// hooks during registration caused startup side effects. Actual render boundaries
// must still execute the complete deterministic pipeline in registration order.
{
  const registryCode=fs.readFileSync(path.join(ROOT,'js','ui-enhancer-registry.js'),'utf8');
  let html='';
  const app={};
  Object.defineProperty(app,'innerHTML',{configurable:true,get(){return html;},set(value){html=String(value);}});
  const calls=[];
  const sandbox={
    console:{error(){}},
    document:{getElementById(id){return id==='app'?app:null;}},
    __capitalismTycoonModules:{}
  };
  sandbox.globalThis=sandbox;
  vm.runInNewContext(registryCode,sandbox,{filename:'ui-enhancer-registry.js'});
  const registry=sandbox.__capitalismTycoonModules.uiEnhancerRegistry;
  registry.registerUIEnhancer({id:'stage35a-early-a',enhance(){calls.push('early-a');}});
  calls.length=0;
  registry.registerUIEnhancer({id:'stage35a-early-b',enhance(){calls.push('early-b');}});
  assert.deepEqual(Array.from(calls),['early-b'],'pre-render registration must not replay earlier hooks');
  calls.length=0;
  app.innerHTML='<main>first render</main>';
  assert.deepEqual(Array.from(calls),['early-a','early-b'],'first app render must execute all registered hooks in order');
  calls.length=0;
  registry.registerUIEnhancer({id:'stage35a-late',enhance(){calls.push('late');}});
  assert.deepEqual(Array.from(calls),['late'],'late enhancer registration must not replay earlier hooks');
  calls.length=0;
  app.innerHTML='<main>second render</main>';
  assert.deepEqual(Array.from(calls),['early-a','early-b','late'],'later app renders must execute the complete ordered enhancer pipeline');
}

const index=readIndex();
assert.equal(observerMatches(index).length,0,'index.html must not contain inline MutationObserver constructors after Stage 3-5a');
for(const id of INLINE_IDS){
  assert.match(index,new RegExp(`id:['\"]${id}['\"]`),`${id} must register as a deterministic UI enhancer`);
}

const jsFiles=fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js'));
const comprehensive=jsFiles.filter(name=>observerMatches(fs.readFileSync(path.join(ROOT,'js',name),'utf8')).length>0).sort();
const unqualified=jsFiles.filter(name=>observerMatches(fs.readFileSync(path.join(ROOT,'js',name),'utf8'),UNQUALIFIED).length>0).sort();
const qualifiedOnly=comprehensive.filter(name=>!unqualified.includes(name));
assert.equal(comprehensive.length,33,`expected 33 residual observer-driven JS sources after Stage 3-5a, got ${comprehensive.length}: ${comprehensive.join(', ')}`);
assert.equal(unqualified.length,33,`expected 33 residual unqualified observer-driven JS sources after Stage 3-5a, got ${unqualified.length}`);
assert.deepEqual(qualifiedOnly,[],'Stage 3-5a must remove the last qualified-only env.MutationObserver source');

const productionSources=walkProduction().sort((a,b)=>a.path.localeCompare(b.path));
assert.equal(productionSources.length,33,`repository-wide production scan expected 33 observer sources after Stage 3-5a, got ${productionSources.length}: ${productionSources.map(row=>`${row.path}(${row.occurrences})`).join(', ')}`);
assert.ok(productionSources.every(row=>row.path.startsWith('js/')),`MutationObserver constructors outside js/ are forbidden after Stage 3-5a: ${productionSources.filter(row=>!row.path.startsWith('js/')).map(row=>row.path).join(', ')}`);

console.log(`Stage 3-5a observer stability contract passed: ${productionSources.length} production observer sources remain for later migration batches`);
