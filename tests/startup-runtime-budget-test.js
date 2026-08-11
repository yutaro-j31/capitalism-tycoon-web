'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {loadGame,readIndex,extractScripts}=require('./harness');

// Ratchets are ceilings, not targets. Lower values are always acceptable.
// Raise a ceiling only after deliberately reviewing a new physical-startup baseline.
// After deterministic-economic-foundation moved to the enhancer registry, the reviewed startup baseline is 100
// registry-level hook invocations: 50 registration hooks + one 50-hook final pass.
// The ceiling is intentionally tight; any return toward the old cascade must fail CI.
const LIMITS=Object.freeze({
  mutationObserverConstructed:32,
  observeCalls:32,
  subtreeObserveCalls:32,
  externalEnhancerRegistrations:47,
  enhancerExecutions:100
});

// Startup collapsing relies on ui-enhancer-registry.js executing synchronously
// while document.readyState is still 'loading'. Freeze the index contract so a
// future defer/async or load-order change cannot silently re-enable the N^2 path.
const indexScripts=extractScripts(readIndex());
const externalScripts=indexScripts.filter(script=>script.file);
const registryIndex=externalScripts.findIndex(script=>path.basename(script.file)==='ui-enhancer-registry.js');
assert.ok(registryIndex>=0,'index.html must load ui-enhancer-registry.js');
const registryScript=externalScripts[registryIndex];
assert.equal(Object.prototype.hasOwnProperty.call(registryScript.parsedAttrs,'defer'),false,'ui-enhancer-registry.js must remain synchronous: defer is forbidden');
assert.equal(Object.prototype.hasOwnProperty.call(registryScript.parsedAttrs,'async'),false,'ui-enhancer-registry.js must remain synchronous: async is forbidden');
const enhancerModules=externalScripts
  .map((script,index)=>({script,index}))
  .filter(row=>/registerUIEnhancer|__capitalismTycoonPendingUIEnhancers/.test(row.script.code));
assert.ok(enhancerModules.length>0,'index.html must contain at least one UI enhancer registration module');
const preRegistryEnhancers=enhancerModules.filter(row=>row.index<registryIndex);
for(const row of preRegistryEnhancers){
  assert.match(row.script.code,/__capitalismTycoonPendingUIEnhancers/,
    `${row.script.src} loads before the registry and therefore must use the pending-enhancer queue`);
}
const firstLiveRegistryEnhancer=enhancerModules.find(row=>row.index>registryIndex&&!/__capitalismTycoonPendingUIEnhancers/.test(row.script.code));
if(firstLiveRegistryEnhancer){
  assert.ok(registryIndex<firstLiveRegistryEnhancer.index,
    `ui-enhancer-registry.js must load before the first enhancer module that requires a live registry (${firstLiveRegistryEnhancer.script.src})`);
}
const appIndex=externalScripts.findIndex(script=>path.basename(script.file)==='app.js');
assert.ok(appIndex>registryIndex,'ui-enhancer-registry.js must load synchronously before app.js and its first render boundary');

const INLINE_ENHANCERS=new Set([
  'd-ui-nav-scrub',
  'setup-recovery-bootstrap',
  'game-over-settings-bridge'
]);

const {ctx,modules}=loadGame({measureStartup:true,random:()=>0.421337});
const metrics=ctx.__startupMetrics;
const registeredIDs=Array.from(modules.uiEnhancerRegistry?.registeredIDs?.()||[]);
const externalRegisteredIDs=registeredIDs.filter(id=>!INLINE_ENHANCERS.has(id));
const startupWrites=ctx.__localStorageHistory.setItem;

assert.ok(metrics.mutationObserverConstructed<=LIMITS.mutationObserverConstructed,
  `startup MutationObserver constructions regressed: ${metrics.mutationObserverConstructed} > ${LIMITS.mutationObserverConstructed}`);
assert.ok(metrics.observeCalls<=LIMITS.observeCalls,
  `startup MutationObserver.observe() calls regressed: ${metrics.observeCalls} > ${LIMITS.observeCalls}`);
assert.ok(metrics.subtreeObserveCalls<=LIMITS.subtreeObserveCalls,
  `startup subtree:true observe() calls regressed: ${metrics.subtreeObserveCalls} > ${LIMITS.subtreeObserveCalls}`);
assert.ok(metrics.subtreeObserveCalls<=metrics.observeCalls,
  `subtree observe count cannot exceed total observe count: ${metrics.subtreeObserveCalls} > ${metrics.observeCalls}`);
assert.ok(externalRegisteredIDs.length<=LIMITS.externalEnhancerRegistrations,
  `startup external enhancer registrations regressed: ${externalRegisteredIDs.length} > ${LIMITS.externalEnhancerRegistrations}`);
assert.ok(metrics.enhancerExecutions<=LIMITS.enhancerExecutions,
  `startup enhancer executions regressed: ${metrics.enhancerExecutions} > ${LIMITS.enhancerExecutions}`);
assert.equal(startupWrites.length,0,
  `startup must not write localStorage before user action; got ${startupWrites.length}: ${startupWrites.map(row=>row.key).join(', ')}`);

console.log('startup runtime budget:',JSON.stringify({
  mutationObserverConstructed:metrics.mutationObserverConstructed,
  observeCalls:metrics.observeCalls,
  subtreeObserveCalls:metrics.subtreeObserveCalls,
  enhancerRegistrations:{external:externalRegisteredIDs.length,total:registeredIDs.length,inline:registeredIDs.filter(id=>INLINE_ENHANCERS.has(id)).length},
  enhancerExecutions:metrics.enhancerExecutions,
  localStorageSetItem:startupWrites.length,
  limits:LIMITS
}));
console.log('startup runtime budget contract passed');
