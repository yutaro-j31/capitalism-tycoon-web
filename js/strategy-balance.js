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
 bakery:{from:360,to:760},
 bento:{from:430,to:650},
 drugstore:{from:650,to:800},
 bookstore:{from:220,to:600},
 electronicsMini:{from:80,to:170},
 coworking:{from:260,to:340},
 cleaning:{from:210,to:560},
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
// Formal digital products pay the marketing department once at portfolio level. The funnel
// engine already gives that shared capability a 0.40 coefficient; scaling only the department
// effect while formal product funnels are updating makes the effective coefficient 0.55
// (0.40 * 1.375) without changing store marketing, payroll, HQ cost, or legacy founder-home
// products. This is a runtime calibration only, so it needs no persisted balance version.
const DIGITAL_PRODUCT_MARKETING_EFFECT_SCALE=1.375;
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
 const result=baseNormalize.call(this);
 apply(this.g);
 return result;
};
const baseConfigure=EngineClass.prototype.configure;
if(typeof baseConfigure!=='function')throw new Error('engine configure API is missing.');
EngineClass.prototype.configure=function(options={}){
 return this.runTransaction(()=>{
  const result=baseConfigure.call(this,options);
  apply(this.g);
  return result;
 });
};
const baseReset=EngineClass.prototype.reset;
if(typeof baseReset==='function')EngineClass.prototype.reset=function(){
 const result=baseReset.call(this);
 if(apply(this.g)){this.save();this.emit();}
 return result;
};
const baseProductFunnels=EngineClass.prototype.updateProductFunnelsWeekly;
if(typeof baseProductFunnels==='function')EngineClass.prototype.updateProductFunnelsWeekly=function(){
 const hadOwnDepartmentEffect=Object.prototype.hasOwnProperty.call(this,'departmentEffect');
 const baseDepartmentEffect=this.departmentEffect;
 if(typeof baseDepartmentEffect!=='function')return baseProductFunnels.apply(this,arguments);
 this.departmentEffect=function(id){
  const effect=baseDepartmentEffect.call(this,id);
  return id==='marketing'?effect*DIGITAL_PRODUCT_MARKETING_EFFECT_SCALE:effect;
 };
 try{return baseProductFunnels.apply(this,arguments);}
 finally{
  if(hadOwnDepartmentEffect)this.departmentEffect=baseDepartmentEffect;
  else delete this.departmentEffect;
 }
};
EngineClass.prototype.__strategyBalanceInstalled=true;
const activeEngine=modules.playerEngineBridge?.getEngine?.();
if(activeEngine)apply(activeEngine.g);
modules.strategyBalance=Object.freeze({VERSION,DEMAND_CALIBRATIONS,DIGITAL_PRODUCT_MARKETING_EFFECT_SCALE,apply,__installed:true});
})();
