// Pure, explicit-input market environment calculations shared by store callers.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules)throw new Error('Capitalism Tycoon runtime.js must be loaded before store-market-environment.js.');
if(modules.storeMarketEnvironment)throw new Error('Capitalism Tycoon store market environment module is already registered.');
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
function businessAreaFit(business,area){
  if(business.id==='ramen')return area.ramenFit;
  if(business.id==='cafe')return area.cafeFit;
  if(business.id==='conveni')return area.conveniFit;
  return 1;
}
function competitorPressure(competitors,areaID,businessID){
  const total=(competitors||[]).filter(c=>c.areaID===areaID&&c.businessID===businessID).reduce((a,c)=>a+c.stores*(c.brand+c.quality)/12000,0);
  return clamp(total,0,.35);
}
function localCompetition(area,pressure){return area.competition+pressure;}
function storeDemand({baseDemand,prefectureTraffic,areaTraffic,economy,season,businessAreaFit:fit,quality,brand,dx,localCompetition:competition,weeklyDemandMultiplier=1,siteSuitabilityFactor=1,dxDepartmentEffect=0,marketingDepartmentEffect=0,operatingHoursFactor=1,macroSalesFactor=1}){
  let demand=baseDemand*prefectureTraffic*areaTraffic*economy*season*fit
    *(1+quality/100)*(1+brand/90)*(1+dx/140)*(1-competition*.55)*weeklyDemandMultiplier;
  demand*=siteSuitabilityFactor;
  demand*=1+dxDepartmentEffect*.05+marketingDepartmentEffect*.03;
  demand*=operatingHoursFactor;
  demand*=macroSalesFactor;
  return demand;
}
modules.storeMarketEnvironment=Object.freeze({businessAreaFit,competitorPressure,localCompetition,storeDemand});
})();
