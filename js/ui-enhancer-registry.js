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
function engine(){return modules.playerEngineBridge?.getEngine?.()||null;}
function context(){const activeEngine=engine();return {app,screen:document.getElementById('screen'),engine:activeEngine,state:activeEngine?.g||null,generation};}
function runEnhancer(hook,current){
  try{hook.enhance(current);}
  catch(error){globalThis.console?.error?.(`[UI enhancer failed: ${hook.id}]`,error);}
}
function runUIEnhancers(){
  if(running)return false;
  running=true;
  const current=context();
  try{
    for(const hook of enhancers)runEnhancer(hook,current);
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
  // After the first #app render, registration applies only the newly connected
  // enhancer. Re-running every earlier enhancer here can repeat stateful legacy
  // compatibility work during startup. Normal render-boundary updates still run
  // the complete ordered pipeline below.
  if(generation>0&&!running)runEnhancer(hook,context());
  else runUIEnhancers();
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
modules.uiEnhancerRegistry=Object.freeze({registerUIEnhancer,runUIEnhancers,drainPendingUIEnhancers,registeredIDs:()=>enhancers.map(hook=>hook.id),isRunning:()=>running,generation:()=>generation,__installed:true});
drainPendingUIEnhancers();
})();
