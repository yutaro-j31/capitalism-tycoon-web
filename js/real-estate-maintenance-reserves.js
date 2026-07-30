// Compatibility bridge for the retired maintenance-reserves module.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.realEstatePropertyInsurance)throw new Error('real-estate-property-insurance.js must load before real-estate-maintenance-reserves.js.');
if(modules.realEstateMaintenanceReserves)throw new Error('real-estate-maintenance-reserves.js already registered.');
if(!modules.realEstatePropertyMaintenance?.ensure||!modules.realEstatePropertyMaintenance?.processWeek)throw new Error('real-estate-property-maintenance.js is required as the single maintenance source.');
const source=modules.realEstatePropertyMaintenance;
modules.realEstateMaintenanceReserves=Object.freeze({
  VERSION:0,
  LEGACY_COMPATIBILITY:true,
  HISTORY_LIMIT:source.HISTORY_LIMIT,
  POLICIES:source.POLICIES,
  ensure:source.ensure,
  processWeek(){return[];}
});
if(typeof document!=='undefined'&&!modules.realEstatePropertyTaxes){
  const s=document.createElement('script'),q=String(globalThis.location?.search||'').match(/(?:^|[?&])v=([^&]+)/),v=q?decodeURIComponent(q[1]):globalThis.__capitalismTycoonAssetVersion||'';
  s.src='./js/real-estate-property-taxes.js'+(v?`?v=${encodeURIComponent(v)}`:'');s.async=false;s.dataset.realEstatePropertyTaxes='';
  s.addEventListener?.('error',()=>{globalThis.__capitalismTycoonRealEstatePropertyTaxesFailed=true;});document.head?.appendChild(s);
}
})();
