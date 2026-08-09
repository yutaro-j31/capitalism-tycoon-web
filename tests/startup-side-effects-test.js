'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {ROOT,readIndex,extractScripts,createBrowserContext,loadGame}=require('./harness');

const strategy=fs.readFileSync(path.join(ROOT,'js','strategy-balance.js'),'utf8');
const difficulty=fs.readFileSync(path.join(ROOT,'js','difficulty-scenario-balance.js'),'utf8');
const registryCode=fs.readFileSync(path.join(ROOT,'js','ui-enhancer-registry.js'),'utf8');

// Startup calibration/backfill is allowed to normalize in-memory state, but it
// must never persist merely because index.html was loaded. Persistence remains
// owned by explicit user actions and the engine's established save boundaries.
assert.match(strategy,/const activeEngine=modules\.playerEngineBridge\?\.getEngine\?\.\(\);\s*if\(activeEngine\)apply\(activeEngine\.g\);/,'strategy startup backfill must remain in-memory');
assert.doesNotMatch(strategy,/activeEngine&&apply\(activeEngine\.g\)[\s\S]{0,120}activeEngine\.save/,'strategy startup backfill must not auto-save');
const difficultyStartup=difficulty.match(/const activeEngine=modules\.playerEngineBridge\.getEngine\(\);if\(activeEngine\)\{([^}]*)\}/)?.[1]||'';
assert.ok(difficultyStartup,'difficulty startup backfill block must remain present');
assert.match(difficultyStartup,/reconcileOpeningFinance\(activeEngine\.g\)/,'difficulty startup finance backfill must remain in-memory');
assert.match(difficultyStartup,/applyEasyDemand\(activeEngine\.g\)/,'difficulty startup demand backfill must remain in-memory');
assert.doesNotMatch(difficultyStartup,/\.save\s*\(/,'difficulty startup backfill must not auto-save');

// Existing non-browser harness must also stay startup-pure. This catches any new
// load-time persistence call anywhere in the production script graph, not only
// the two calibration modules identified by the repository-wide audit.
{
  const {ctx,engineModule}=loadGame({random:()=>0.42});
  assert.equal(engineModule.SAVE_KEY,'capitalism_tycoon_web_v1','SAVE_KEY must remain unchanged');
  assert.equal(engineModule.SAVE_VERSION,9,'saveVersion contract must remain unchanged');
  assert.equal(ctx.__localStorageHistory.setItem.length,0,'loading production scripts must not write localStorage before user action');
}

// Exercise the real index script graph with a browser-like loading phase. During
// parsing, registration may run each new hook once, while full-pipeline requests
// from initial renders/modules must collapse until DOMContentLoaded. This guards
// against the synchronous N^2 startup cascade that previously produced 385 hook
// executions on physical-startup instrumentation.
{
  const scripts=extractScripts(readIndex());
  let source=scripts.map(row=>row.code).join('\n');
  source=source.replace('const engine = TycoonEngine.load();','const engine = globalThis.__ct_engine = TycoonEngine.load();');
  source=source.replace('const ui = {','const ui = globalThis.__ct_ui = {');
  const ctx=createBrowserContext({headless:true,random:()=>0.42});
  ctx.document.readyState='loading';
  const ready=[];
  const existingAdd=ctx.document.addEventListener.bind(ctx.document);
  ctx.document.addEventListener=(type,callback,options)=>{if(type==='DOMContentLoaded'&&typeof callback==='function')ready.push(callback);return existingAdd(type,callback,options);};
  new vm.Script(source,{filename:'index.html'}).runInContext(ctx);
  const registry=ctx.__capitalismTycoonModules.uiEnhancerRegistry;
  const before=registry.stats();
  assert.equal(before.bootComplete,false,'registry must recognize parser-time startup');
  assert.ok(before.registered>0,'production startup must register enhancers');
  assert.equal(before.registrationRuns,before.registered,'each enhancer must run only its own registration hook during startup');
  assert.equal(before.hookExecutions,before.registered,'startup parsing must not replay older enhancers');
  assert.equal(before.pipelineRuns,0,'full enhancer pipeline must be deferred while document is loading');
  assert.ok(before.deferredRunRequests>0,'startup render/refresh requests must be recorded for collapse');
  assert.equal(ctx.__localStorageHistory.setItem.length,0,'browser-like startup must remain storage-pure before DOMContentLoaded');
  ctx.document.readyState='interactive';
  for(const callback of ready)callback({type:'DOMContentLoaded'});
  const after=registry.stats();
  assert.equal(after.bootComplete,true,'DOMContentLoaded must complete the registry boot phase');
  assert.equal(after.pipelineRuns,1,'all startup full-pipeline requests must collapse into one reconciliation pass');
  assert.equal(after.hookExecutions,after.registered*2,'startup work must be one registration run plus one final full pass per enhancer');
  assert.equal(ctx.__localStorageHistory.setItem.length,0,'DOMContentLoaded reconciliation must not auto-save');
  console.log(`startup enhancer audit: registered=${after.registered} deferred=${after.deferredRunRequests} hookExecutions=${after.hookExecutions} pipelineRuns=${after.pipelineRuns}`);
}

// Preserve the central registry semantics: no observer/microtask replacement and
// no timer-based boot flushing. The DOM parse boundary itself is the boot signal.
assert.doesNotMatch(registryCode,/MutationObserver|queueMicrotask|requestAnimationFrame|setTimeout/,'registry boot collapse must remain synchronous and observer-free');
assert.match(registryCode,/document\.addEventListener\('DOMContentLoaded',completeBoot,\{once:true\}\)/,'DOMContentLoaded must be the single startup flush boundary');
assert.match(registryCode,/runRegistrationHook\(hook\)/,'registration must execute only the newly registered hook');
console.log('startup side-effects regression contract passed');
