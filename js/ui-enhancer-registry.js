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
function runUIEnhancers(){
  if(running)return false;
  running=true;
  const current=context();
  try{
    for(const hook of enhancers){
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
  runUIEnhancers();
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
modules.uiEnhancerRegistry=Object.freeze({registerUIEnhancer,runUIEnhancers,registeredIDs:()=>enhancers.map(hook=>hook.id),isRunning:()=>running,generation:()=>generation,__installed:true});
const pending=Array.isArray(globalThis[PENDING_KEY])?globalThis[PENDING_KEY].splice(0):[];
for(const definition of pending)registerUIEnhancer(definition);
})();
