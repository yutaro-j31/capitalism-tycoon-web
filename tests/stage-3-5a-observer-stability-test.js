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
const SKIP_DIRS=new Set(['.git','node_modules','tests']);
const RUNTIME_EXTENSIONS=new Set(['.html','.htm','.js','.mjs','.cjs']);
// Keep diagnostics explicit. Do not skip docs/: GitHub Pages can be switched to
// publish from /docs, so runtime HTML/JS under docs must remain inside this audit.
const NON_PRODUCTION_DIAGNOSTIC_HTML=Object.freeze([
  'boot-test.html',
  'boot-test-stage-2a.html',
  'boot-test-stage-3a.html',
  'boot-test-stage-3b-heartbeat.html',
  'boot-test-stage-3b-prefix.html',
  'observer-source-diagnostic.html'
]);
const DIAGNOSTIC_SET=new Set(NON_PRODUCTION_DIAGNOSTIC_HTML);

function observerMatches(text,pattern=OBSERVER){
  pattern.lastIndex=0;
  return Array.from(String(text||'').matchAll(pattern));
}
function isText(buffer){return !buffer.includes(0);}
function isRuntimeSource(file){return RUNTIME_EXTENSIONS.has(path.extname(file).toLowerCase());}
function walkAuditedSources(dir=ROOT,relative=''){
  const rows=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const rel=relative?path.join(relative,entry.name):entry.name;
    if(entry.isDirectory()){
      if(SKIP_DIRS.has(entry.name))continue;
      rows.push(...walkAuditedSources(path.join(dir,entry.name),rel));
      continue;
    }
    if(!entry.isFile())continue;
    const buffer=fs.readFileSync(path.join(dir,entry.name));
    if(!isText(buffer))continue;
    rows.push({path:rel.split(path.sep).join('/'),text:buffer.toString('utf8')});
  }
  return rows;
}
function isDiagnosticSource(row){return !row.path.includes('/')&&DIAGNOSTIC_SET.has(row.path);}


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
assert.equal(comprehensive.length,20,`expected 20 residual observer-driven JS sources after deterministic-economic-foundation migration, got ${comprehensive.length}: ${comprehensive.join(', ')}`);
assert.equal(unqualified.length,20,`expected 20 residual unqualified observer-driven JS sources after deterministic-economic-foundation migration, got ${unqualified.length}`);
assert.deepEqual(qualifiedOnly,[],'Stage 3-5a must remove the last qualified-only env.MutationObserver source');

const auditedSources=walkAuditedSources().sort((a,b)=>a.path.localeCompare(b.path));
const runtimeSources=auditedSources.filter(row=>isRuntimeSource(row.path));
const diagnosticRows=NON_PRODUCTION_DIAGNOSTIC_HTML.map(name=>{
  const row=runtimeSources.find(candidate=>candidate.path===name);
  assert.ok(row,`explicit diagnostic exclusion is missing from repository: ${name}`);
  return {path:name,occurrences:observerMatches(row.text).length};
});
const productionObserverSources=runtimeSources
  .filter(row=>!isDiagnosticSource(row))
  .map(row=>({path:row.path,occurrences:observerMatches(row.text).length}))
  .filter(row=>row.occurrences>0);
const productionObserverConstructors=productionObserverSources.reduce((sum,row)=>sum+row.occurrences,0);
const diagnosticObserverConstructors=diagnosticRows.reduce((sum,row)=>sum+row.occurrences,0);

console.log(`Stage 3-5a production observer scan: sources=${productionObserverSources.length}, constructors=${productionObserverConstructors}`);
console.log(`Stage 3-5a diagnostic exclusions: files=${diagnosticRows.length}, constructors=${diagnosticObserverConstructors}`);
for(const row of diagnosticRows)console.log(`  ${row.path}: ${row.occurrences}`);

// An excluded diagnostic must never become reachable from another runtime source.
// This checks every audited text source (including index.html, play.html, js/*.js,
// docs/, and CI/config files) rather than guarding index.html alone.
for(const row of auditedSources.filter(row=>!isDiagnosticSource(row))){
  for(const diagnostic of NON_PRODUCTION_DIAGNOSTIC_HTML){
    assert.equal(row.text.includes(diagnostic),false,`${row.path} must not reference excluded diagnostic page ${diagnostic}`);
  }
}

assert.equal(productionObserverSources.length,20,`repository-wide production scan expected 20 observer sources after deterministic-economic-foundation migration, got ${productionObserverSources.length}: ${productionObserverSources.map(row=>`${row.path}(${row.occurrences})`).join(', ')}`);
assert.ok(productionObserverSources.every(row=>row.path.startsWith('js/')),`MutationObserver constructors outside js/ are forbidden after Stage 3-5a: ${productionObserverSources.filter(row=>!row.path.startsWith('js/')).map(row=>row.path).join(', ')}`);

console.log(`Stage 3-5a observer stability contract passed: ${productionObserverSources.length} production observer sources remain for later migration batches`);
