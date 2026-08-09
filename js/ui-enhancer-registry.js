// Stage 3: deterministic one-way UI enhancement pipeline.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before ui-enhancer-registry.js.');
const modules=globalThis.__capitalismTycoonModules;
const PENDING_KEY='__capitalismTycoonPendingUIEnhancers';
if(modules.uiEnhancerRegistry)throw new Error('UI enhancer registry is already registered.');
const app=document.getElementById('app');
if(!app)throw new Error('#app must exist before ui-enhancer-registry.js.');
const enhancers=[];
const enhancerIDs=new Set();
let running=false;
let generation=0;
let bootComplete=document.readyState!=='loading';
let pendingRun=false;
let hookExecutions=0;
let registrationRuns=0;
let pipelineRuns=0;
let deferredRunRequests=0;
function engine(){return modules.playerEngineBridge?.getEngine?.()||null;}
function context(){const activeEngine=engine();return {app,screen:document.getElementById('screen'),engine:activeEngine,state:activeEngine?.g||null,generation};}
function runHook(hook,current){
  hookExecutions+=1;
  try{hook.enhance(current);}
  catch(error){globalThis.console?.error?.(`[UI enhancer failed: ${hook.id}]`,error);}
}
function runRegistrationHook(hook){
  if(running)return false;
  running=true;
  try{registrationRuns+=1;runHook(hook,context());}
  finally{running=false;}
  return true;
}
function runUIEnhancers(){
  if(!bootComplete){pendingRun=true;deferredRunRequests+=1;return false;}
  if(running)return false;
  running=true;
  pendingRun=false;
  pipelineRuns+=1;
  const current=context();
  try{
    for(const hook of enhancers){
      hookExecutions+=1;
      try{hook.enhance(current);}
      catch(error){globalThis.console?.error?.(`[UI enhancer failed: ${hook.id}]`,error);}
    }
  }finally{running=false;}
  return true;
}
function registerUIEnhancer(definition){
  const id=String(definition?.id||'').trim();
  if(!id||typeof definition?.enhance!=='function')throw new TypeError('UI enhancer requires a non-empty id and enhance function.');
  if(enhancerIDs.has(id))throw new Error(`UI enhancer is already registered: ${id}`);
  const hook=Object.freeze({id,enhance:definition.enhance});
  enhancerIDs.add(id);
  enhancers.push(hook);
  // Registration is not a render event. Run only the newly connected hook;
  // startup-wide refresh requests are collapsed separately until DOMContentLoaded.
  runRegistrationHook(hook);
  return hook;
}
function createInnerHTMLAccess(node){
  const own=Object.getOwnPropertyDescriptor(node,'innerHTML');
  if(own?.get&&own?.set)return {enumerable:own.enumerable,get:()=>own.get.call(node),set:value=>own.set.call(node,value)};
  if(own&&Object.prototype.hasOwnProperty.call(own,'value')&&own.writable){
    let value=own.value;
    return {enumerable:own.enumerable,get:()=>value,set:next=>{value=next;}};
  }
  let prototype=node;
  while((prototype=Object.getPrototypeOf(prototype))){
    const descriptor=Object.getOwnPropertyDescriptor(prototype,'innerHTML');
    if(descriptor?.get&&descriptor?.set)return {enumerable:descriptor.enumerable,get:()=>descriptor.get.call(node),set:value=>descriptor.set.call(node,value)};
  }
  return null;
}
const innerHTMLAccess=createInnerHTMLAccess(app);
if(!innerHTMLAccess)throw new Error('Unable to bind the #app render boundary.');
Object.defineProperty(app,'innerHTML',{
  configurable:true,
  enumerable:innerHTMLAccess.enumerable,
  get(){return innerHTMLAccess.get();},
  set(value){
    innerHTMLAccess.set(value);
    generation+=1;
    runUIEnhancers();
  }
});
function completeBoot(){
  if(bootComplete)return false;
  bootComplete=true;
  // All startup render requests, including explicit module refreshes, collapse
  // into this single ordered reconciliation pass.
  pendingRun=false;
  return runUIEnhancers();
}
if(!bootComplete){
  if(typeof document.addEventListener==='function')document.addEventListener('DOMContentLoaded',completeBoot,{once:true});
  else bootComplete=true;
}
function drainPendingUIEnhancers(){
  const queue=Array.isArray(globalThis[PENDING_KEY])?globalThis[PENDING_KEY]:[];
  const pending=queue.splice(0);
  const pendingIDs=new Set();
  for(const definition of pending){
    const id=String(definition?.id||'').trim();
    if(id&&(pendingIDs.has(id)||enhancerIDs.has(id)))continue;
    if(id)pendingIDs.add(id);
    registerUIEnhancer(definition);
  }
  return pending.length;
}
function stats(){return Object.freeze({registered:enhancers.length,hookExecutions,registrationRuns,pipelineRuns,deferredRunRequests,generation,bootComplete,pendingRun});}
modules.uiEnhancerRegistry=Object.freeze({registerUIEnhancer,runUIEnhancers,drainPendingUIEnhancers,completeBoot,registeredIDs:()=>enhancers.map(hook=>hook.id),isRunning:()=>running,isBootComplete:()=>bootComplete,generation:()=>generation,stats,__installed:true});
drainPendingUIEnhancers();
})();
