// Phase 6B-2: cross-industry strategy balance calibration.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before strategy-balance.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before strategy-balance.js.');
if(modules.strategyBalance)throw new Error('strategy balance module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const VERSION=1;
const DEMAND_CALIBRATIONS=Object.freeze({
 cafe:{from:340,to:650},
 conveni:{from:625,to:1450},
 bakery:{from:360,to:650},
 bento:{from:430,to:650},
 drugstore:{from:650,to:800},
 bookstore:{from:220,to:600},
 electronicsMini:{from:80,to:170},
 coworking:{from:260,to:340},
 cleaning:{from:210,to:480},
 cramSchool:{from:55,to:32},
 realEstateAgency:{from:34,to:7},
 gameStudio:{from:12,to:1.5},
 appStudio:{from:18,to:1.5},
 webAgency:{from:24,to:1.8},
 videoStudio:{from:16,to:1.7},
 esportsFacility:{from:300,to:400},
 vrExperience:{from:180,to:270},
 streamerStudio:{from:70,to:110},
 investmentConsulting:{from:30,to:10},
 insuranceAgency:{from:42,to:12},
 maBroker:{from:5,to:1.8}
});
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
function apply(state){
 if(!state||finite(state.strategyBalanceVersion,0)>=VERSION)return false;
 const businesses=Array.isArray(state.businesses)?state.businesses:[];
 for(const business of businesses){
  const calibration=DEMAND_CALIBRATIONS[business?.id];
  if(!calibration)continue;
  const current=finite(business.demand,calibration.from);
  business.demand=Math.max(.1,current*(calibration.to/calibration.from));
 }
 state.strategyBalanceVersion=VERSION;
 return true;
}
const baseNormalize=EngineClass.prototype.normalize;
if(typeof baseNormalize!=='function')throw new Error('engine normalize API is missing.');
EngineClass.prototype.normalize=function(){
 baseNormalize.call(this);
 apply(this.g);
};
EngineClass.prototype.__strategyBalanceInstalled=true;
modules.strategyBalance=Object.freeze({VERSION,DEMAND_CALIBRATIONS,apply,__installed:true});
})();
