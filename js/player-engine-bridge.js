// Phase 6A-5C: capture the app-created engine for post-app player UI extensions.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-engine-bridge.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-engine-bridge.js.');
if(!modules.playerCrisisUI?.__installed)throw new Error('player-crisis-ui.js must be loaded before player-engine-bridge.js.');
if(modules.playerEngineBridge)throw new Error('player engine bridge is already registered.');
const EngineClass=modules.engine.TycoonEngine;
let activeEngine=null;
function bindEngine(instance){activeEngine=instance||null;return instance;}
function getEngine(){return activeEngine;}
const baseLoad=EngineClass.load.bind(EngineClass);
EngineClass.load=function(...args){return bindEngine(baseLoad(...args));};
modules.playerEngineBridge=Object.freeze({bindEngine,getEngine,__installed:true});
})();
