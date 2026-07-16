// Phase 6A-5C: capture the app-created engine for post-app player UI extensions.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-engine-bridge.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-engine-bridge.js.');
if(!modules.playerCrisisUI?.__installed)throw new Error('player-crisis-ui.js must be loaded before player-engine-bridge.js.');
if(modules.playerEngineBridge)throw new Error('player engine bridge is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const isWebKit=typeof navigator!=='undefined'&&/AppleWebKit/i.test(String(navigator.userAgent||''));
let activeEngine=null;
function installWebKitWeekYield(instance){
  if(!instance||!isWebKit||instance.__webkitWeekYieldInstalled)return instance;
  const baseEmit=instance.emit.bind(instance);
  let timer=0,pendingDetail=null;
  instance.emit=function(type='change',detail={}){
    if(type!=='week')return baseEmit(type,detail);
    pendingDetail=detail;
    if(timer)return true;
    timer=setTimeout(()=>{
      timer=0;
      const nextDetail=pendingDetail;
      pendingDetail=null;
      baseEmit('week',nextDetail||{});
    },0);
    return true;
  };
  Object.defineProperty(instance,'__webkitWeekYieldInstalled',{value:true});
  return instance;
}
function bindEngine(instance){activeEngine=installWebKitWeekYield(instance||null);return instance;}
function getEngine(){return activeEngine;}
const baseLoad=EngineClass.load.bind(EngineClass);
EngineClass.load=function(...args){return bindEngine(baseLoad(...args));};
modules.playerEngineBridge=Object.freeze({bindEngine,getEngine,installWebKitWeekYield,__installed:true});
})();
