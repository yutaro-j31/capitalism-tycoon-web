// Compatibility bridge for the retired maintenance-reserves module.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.realEstatePropertyInsurance)throw new Error('real-estate-property-insurance.js must load before real-estate-maintenance-reserves.js.');
if(modules.realEstateMaintenanceReserves)throw new Error('real-estate-maintenance-reserves.js already registered.');
function source(){
  const s=modules.realEstatePropertyMaintenance;
  if(!s?.ensure||!s?.processWeek)throw new Error('real-estate-property-maintenance.js is required as the single maintenance source.');
  return s;
}
const bridge={};
Object.defineProperties(bridge,{
  VERSION:{value:0,enumerable:true},
  LEGACY_COMPATIBILITY:{value:true,enumerable:true},
  HISTORY_LIMIT:{get(){return source().HISTORY_LIMIT;},enumerable:true},
  POLICIES:{get(){return source().POLICIES;},enumerable:true},
  ensure:{value:function(g){return modules.realEstatePropertyInsurance.ensure(g);},enumerable:true},
  processWeek:{value:function(){return[];},enumerable:true}
});
modules.realEstateMaintenanceReserves=Object.freeze(bridge);
if(typeof document!=='undefined'&&!modules.realEstatePropertyTaxes){
  const s=document.createElement('script'),q=String(globalThis.location?.search||'').match(/(?:^|[?&])v=([^&]+)/),v=q?decodeURIComponent(q[1]):globalThis.__capitalismTycoonAssetVersion||'';
  s.src='./js/real-estate-property-taxes.js'+(v?`?v=${encodeURIComponent(v)}`:'');s.async=false;s.dataset.realEstatePropertyTaxes='';
  s.addEventListener?.('error',()=>{globalThis.__capitalismTycoonRealEstatePropertyTaxesFailed=true;});document.head?.appendChild(s);
}
})();
