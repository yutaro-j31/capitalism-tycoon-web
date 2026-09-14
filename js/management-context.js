// Runtime-only management target selection for self and PE portfolio companies.
// Existing management actions remain disabled for PE contexts until their state/accounting
// boundaries are made context-aware in follow-up work.
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must be loaded before management-context.js.');
if(!modules?.peIndustryTiers)throw new Error('pe-industry-tiers.js must be loaded before management-context.js.');
if(!modules?.pePortfolioOperations)throw new Error('pe-portfolio-operations.js must be loaded before management-context.js.');
if(!modules?.storeMarketEnvironment)throw new Error('store-market-environment.js must be loaded before management-context.js.');
if(!modules?.gymMembershipModel)throw new Error('gym-membership-model.js must be loaded before management-context.js.');
if(!modules?.storeEquipment)throw new Error('store-equipment.js must be loaded before management-context.js.');
if(modules.managementContext)throw new Error('management context module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const SELF=Object.freeze({kind:'self'}),contexts=new WeakMap();
const supportedBusinessIDs=Object.freeze([...modules.peIndustryTiers.TIERS.pillar.businessIDs]);
const GYM_BUSINESS_ID='gym',GYM_OPERATING_STATE_SCHEMA_VERSION=1;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const clone=value=>value===undefined?undefined:value===null?null:JSON.parse(JSON.stringify(value));
function copyContext(context){return context?.kind==='pePortfolio'?{kind:'pePortfolio',fundID:context.fundID,dealID:context.dealID,businessID:context.businessID,pillar:context.pillar}:{kind:'self'};}
function resolvePortfolioManagementCapability(deal){
  const businessID=typeof deal?.businessID==='string'?deal.businessID:'';
  const supported=supportedBusinessIDs.includes(businessID);
  return {supported,pillar:supported?businessID:null,businessID:businessID||null,actionsEnabled:false,reason:supported?null:'unsupported-pillar'};
}
function portfolioTarget(state,fundID,dealID){
  const fund=(state?.peFirm?.funds||[]).find(row=>row?.id===fundID);
  if(!fund)return {ok:false,reason:'fund-not-found'};
  const deal=(fund.deals||[]).find(row=>row?.id===dealID);
  if(!deal)return {ok:false,reason:'deal-not-found'};
  if(deal.status!=='active')return {ok:false,reason:'deal-not-active'};
  if(!deal.portfolioCompany)return {ok:false,reason:'portfolio-company-not-found'};
  const capability=resolvePortfolioManagementCapability(deal);
  if(!capability.supported)return {ok:false,reason:capability.reason,capability};
  return {ok:true,fund,deal,portfolioCompany:deal.portfolioCompany,capability};
}
function getManagementContext(engine){return copyContext(contexts.get(engine)||SELF);}
function canOpenPEPortfolioManagement(engine,fundID,dealID){
  const result=portfolioTarget(engine?.g,fundID,dealID);
  return result.ok?{ok:true,capability:{...result.capability}}:{ok:false,reason:result.reason,capability:result.capability?{...result.capability}:null};
}
function openPEPortfolioManagement(engine,fundID,dealID){
  const target=portfolioTarget(engine?.g,fundID,dealID);
  if(!target.ok)return {ok:false,reason:target.reason,context:getManagementContext(engine)};
  const context=Object.freeze({kind:'pePortfolio',fundID,dealID,businessID:target.deal.businessID,pillar:target.capability.pillar});
  contexts.set(engine,context);
  return {ok:true,context:copyContext(context),capability:{...target.capability}};
}
function closeManagementContext(engine){contexts.delete(engine);return {ok:true,context:{kind:'self'}};}
function resolveManagementContext(engine){
  const context=getManagementContext(engine);
  if(context.kind==='self')return {ok:true,context,capability:{supported:true,pillar:null,businessID:null,actionsEnabled:true,reason:null}};
  const target=portfolioTarget(engine?.g,context.fundID,context.dealID);
  return target.ok?{ok:true,context,capability:{...target.capability}}:{ok:false,reason:target.reason,context,capability:target.capability?{...target.capability}:null};
}

// PE gym bridge foundation. This deliberately creates a DETACHED operating state instead of
// pointing the gym model at engine.g.stores or the self-company business record. The next PE
// pillar calculator can persist/settle this state explicitly; this foundation only proves the
// production route and therefore cannot double-settle portfolio cash or mutate self-company data.
function normalizePEPortfolioGymOperatingState(raw){
  const source=raw&&typeof raw==='object'?raw:{};
  const equipment=modules.storeEquipment;
  const hoursRaw=Math.floor(finite(source.operatingHours,equipment.DEFAULT_OPERATING_HOURS));
  const operatingHours=clamp(hoursRaw,equipment.MIN_OPERATING_HOURS,equipment.MAX_OPERATING_HOURS);
  const level=Math.max(1,Math.min(equipment.MAX_LEVEL,Math.floor(finite(source.level,1))));
  const condition=clamp(finite(source.condition,equipment.FULL_CONDITION),0,equipment.FULL_CONDITION);
  const detachedStore={businessID:GYM_BUSINESS_ID,status:'open',condition,level,operatingHours,gymMembership:clone(source.gymMembership)};
  modules.gymMembershipModel.ensureStore(detachedStore);
  return {schemaVersion:GYM_OPERATING_STATE_SCHEMA_VERSION,condition,level,operatingHours,gymMembership:clone(detachedStore.gymMembership)};
}
function defaultPEPortfolioGymOperatingState(){return normalizePEPortfolioGymOperatingState(null);}
function buildPEPortfolioGymOperatingInput(engine,fundID,dealID,{week,weeklyDemandMultiplier=1,operatingState}={}){
  const state=engine?.g,target=portfolioTarget(state,fundID,dealID);
  if(!target.ok)return {ok:false,reason:target.reason,fundID,dealID};
  if(target.deal.businessID!==GYM_BUSINESS_ID)return {ok:false,reason:'not-gym',fundID,dealID};
  const site=modules.pePortfolioOperations.getPortfolioProductionSite(state,fundID,dealID);
  if(!site)return {ok:false,reason:'production-site-missing',fundID,dealID};
  const area=(state?.areas||[]).find(row=>row?.id===site.areaID),pref=(state?.prefs||[]).find(row=>row?.id===site.prefID);
  if(!area||!pref||pref.areaID!==area.id)return {ok:false,reason:'production-site-invalid',fundID,dealID};
  // Use the static production business master, not engine.g.businesses: the latter contains the
  // player's self-company price/quality/brand/DX investments and would leak self-company choices
  // into a separately owned PE portfolio company.
  const master=(modules.data?.MASTER?.businesses||[]).find(row=>row?.id===GYM_BUSINESS_ID);
  if(!master)return {ok:false,reason:'gym-business-master-not-found',fundID,dealID};
  const normalized=normalizePEPortfolioGymOperatingState(operatingState);
  const detachedStore={
    id:`pe-gym-${dealID}`,businessID:GYM_BUSINESS_ID,status:'open',
    condition:normalized.condition,level:normalized.level,operatingHours:normalized.operatingHours,
    gymMembership:clone(normalized.gymMembership)
  };
  // priceMultiplier already is the production PE price lever. Other PE levers stay explicit in
  // portfolioLevers and are NOT translated into new gym coefficients here; doing so would invent
  // a second economic model before the pillar-specific settlement PR is calibrated.
  const detachedBusiness={...clone(master),price:Math.max(1,finite(master.price,1)*finite(target.portfolioCompany.priceMultiplier,1))};
  const environment=modules.storeMarketEnvironment;
  const competitorPressure=environment.competitorPressure(state?.competitors,area.id,GYM_BUSINESS_ID);
  const localCompetition=environment.localCompetition(area,competitorPressure);
  const hoursFactor=modules.storeEquipment.operatingHoursOption(normalized.operatingHours)?.demandFactor??1;
  const resolvedWeek=Math.max(1,Math.floor(finite(week,state?.week||1)));
  const multiplier=Math.max(0,finite(weeklyDemandMultiplier,1));
  const macroSalesFactor=state?.macroCrisis?finite(state.macroCrisis.salesMultiplier,1):1;
  const demand=environment.storeDemand({
    baseDemand:finite(detachedBusiness.demand),prefectureTraffic:finite(pref.traffic,1),areaTraffic:finite(area.traffic,1),
    economy:finite(state?.economy,1),season:finite(state?.season,1),businessAreaFit:environment.businessAreaFit(detachedBusiness,area),
    quality:finite(detachedBusiness.quality),brand:finite(detachedBusiness.brand),dx:finite(detachedBusiness.dx),localCompetition,
    weeklyDemandMultiplier:multiplier,siteSuitabilityFactor:1,dxDepartmentEffect:0,marketingDepartmentEffect:0,
    operatingHoursFactor:hoursFactor,macroSalesFactor
  });
  return {
    ok:true,source:'pe-gym-detached-production-input',fundID,dealID,week:resolvedWeek,
    productionSite:{...site},pref:{id:pref.id,areaID:pref.areaID,name:pref.name,traffic:finite(pref.traffic,1)},
    area:{id:area.id,name:area.name,traffic:finite(area.traffic,1),competition:finite(area.competition)},
    competitorPressure,localCompetition,demand,inflation:finite(state?.inflation,1),weeklyDemandMultiplier:multiplier,
    store:detachedStore,business:detachedBusiness,operatingState:normalized,
    portfolioLevers:{
      priceMultiplier:finite(target.portfolioCompany.priceMultiplier,1),qualityInvestment:finite(target.portfolioCompany.qualityInvestment),
      storeCount:Math.max(1,Math.floor(finite(target.portfolioCompany.storeCount,1))),procurementReform:finite(target.portfolioCompany.procurementReform),
      wageLevel:finite(target.portfolioCompany.wageLevel,1),headcountRatio:finite(target.portfolioCompany.headcountRatio,1),
      productMixLevel:finite(target.portfolioCompany.productMixLevel),consolidatedRatio:finite(target.portfolioCompany.consolidatedRatio)
    }
  };
}
function previewPEPortfolioGymWeek(engine,fundID,dealID,options={}){
  const input=buildPEPortfolioGymOperatingInput(engine,fundID,dealID,options);
  if(!input.ok)return input;
  const store=clone(input.store),business=clone(input.business),runtime={week:input.week};
  const result=modules.gymMembershipModel.processStore(runtime,store,business,input.demand,input.inflation,input.localCompetition);
  if(!result)return {ok:false,reason:'gym-model-rejected-input',fundID,dealID};
  const nextOperatingState=normalizePEPortfolioGymOperatingState({
    condition:store.condition,level:store.level,operatingHours:store.operatingHours,gymMembership:store.gymMembership
  });
  return {
    ok:true,source:'pe-gym-detached-preview',fundID,dealID,week:input.week,
    sales:finite(result.sales),variable:finite(result.variable),profitBeforeFixed:finite(result.sales)-finite(result.variable),
    demand:input.demand,localCompetition:input.localCompetition,productionSite:{...input.productionSite},
    operatingState:clone(input.operatingState),nextOperatingState,membershipWeek:clone(store.gymMembership?.lastWeek)
  };
}

const proto=EngineClass.prototype;
proto.getManagementContext=function(){return getManagementContext(this);};
proto.canOpenPEPortfolioManagement=function(fundID,dealID){return canOpenPEPortfolioManagement(this,fundID,dealID);};
proto.openPEPortfolioManagement=function(fundID,dealID){return openPEPortfolioManagement(this,fundID,dealID);};
proto.closeManagementContext=function(){return closeManagementContext(this);};
proto.resolveManagementContext=function(){return resolveManagementContext(this);};
proto.getPEPortfolioGymOperatingInput=function(fundID,dealID,options){return buildPEPortfolioGymOperatingInput(this,fundID,dealID,options);};
proto.previewPEPortfolioGymWeek=function(fundID,dealID,options){return previewPEPortfolioGymWeek(this,fundID,dealID,options);};
modules.managementContext=Object.freeze({
  supportedBusinessIDs,resolvePortfolioManagementCapability,canOpenPEPortfolioManagement,getManagementContext,openPEPortfolioManagement,closeManagementContext,resolveManagementContext,
  GYM_BUSINESS_ID,GYM_OPERATING_STATE_SCHEMA_VERSION,defaultPEPortfolioGymOperatingState,normalizePEPortfolioGymOperatingState,buildPEPortfolioGymOperatingInput,previewPEPortfolioGymWeek,
  __installed:true
});
})();
