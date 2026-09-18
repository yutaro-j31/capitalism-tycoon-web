// Runtime-only management target selection for self and PE portfolio companies.
// Existing self-company management actions (adjustPrice/investBusiness/etc.) remain disabled for
// PE contexts entirely -- they write to the shared state.businesses[]/state.stores[] records and
// would leak across owners. PE-side management actions are enabled per business only once a
// dedicated detached production bridge exists for it (see resolvePortfolioManagementCapability).
// Ramen, gym and conveni now have such bridges; writes still terminate in deal.portfolioCompany.*.
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must be loaded before management-context.js.');
if(!modules?.peIndustryTiers)throw new Error('pe-industry-tiers.js must be loaded before management-context.js.');
if(!modules?.pePortfolioOperations)throw new Error('pe-portfolio-operations.js must be loaded before management-context.js.');
if(!modules?.storeMarketEnvironment)throw new Error('store-market-environment.js must be loaded before management-context.js.');
if(!modules?.gymMembershipModel)throw new Error('gym-membership-model.js must be loaded before management-context.js.');
if(!modules?.storeEquipment)throw new Error('store-equipment.js must be loaded before management-context.js.');
if(!modules?.convenienceMerchandising)throw new Error('convenience-merchandising.js must be loaded before management-context.js.');
if(!modules?.realEstateAgencyPipeline)throw new Error('real-estate-agency-pipeline.js must be loaded before management-context.js.');
if(!modules?.market?.calculateMarketFromOffers)throw new Error('market.js pure allocation kernel must be loaded before management-context.js.');
if(modules.managementContext)throw new Error('management context module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const SELF=Object.freeze({kind:'self'}),contexts=new WeakMap();
const supportedBusinessIDs=Object.freeze([...modules.peIndustryTiers.TIERS.pillar.businessIDs]);
const RAMEN_BUSINESS_ID='ramen';
const GYM_BUSINESS_ID='gym',GYM_OPERATING_STATE_SCHEMA_VERSION=1;
const CONVENI_BUSINESS_ID='conveni';
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const clone=value=>value===undefined?undefined:value===null?null:JSON.parse(JSON.stringify(value));
function copyContext(context){return context?.kind==='pePortfolio'?{kind:'pePortfolio',fundID:context.fundID,dealID:context.dealID,businessID:context.businessID,pillar:context.pillar}:{kind:'self'};}
function resolvePortfolioManagementCapability(deal){
  const businessID=typeof deal?.businessID==='string'?deal.businessID:'';
  const supported=supportedBusinessIDs.includes(businessID);
  // Player-facing actions are enabled only for pillar businesses whose weekly settlement is wired
  // to a dedicated detached production bridge. Unsupported/incomplete pillars stay disabled so UI
  // inputs can never diverge from the calculator that actually settles the PE company.
  const actionsEnabled=supported&&(businessID===RAMEN_BUSINESS_ID||businessID===GYM_BUSINESS_ID||businessID===CONVENI_BUSINESS_ID);
  return {supported,pillar:supported?businessID:null,businessID:businessID||null,actionsEnabled,reason:supported?null:'unsupported-pillar'};
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

// PE gym bridge foundation. It always works on detached store/business objects and never points
// the gym model at the player's self-company stores or mutable business record. State-level
// helpers are exposed because PE weekly settlement owns raw simulation state rather than an
// engine instance; the engine methods below remain thin compatibility facades for UI callers.
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
function buildPEPortfolioGymOperatingInputForState(state,fundID,dealID,{week,weeklyDemandMultiplier=1,operatingState,priceMultiplierOverride,membershipStrategyOverride}={}){
  const target=portfolioTarget(state,fundID,dealID);
  if(!target.ok)return {ok:false,reason:target.reason,fundID,dealID};
  if(target.deal.businessID!==GYM_BUSINESS_ID)return {ok:false,reason:'not-gym',fundID,dealID};
  if(membershipStrategyOverride!==undefined&&!modules.gymMembershipModel.STRATEGY_ORDER.includes(membershipStrategyOverride))return {ok:false,reason:'invalid-membership-strategy-override',fundID,dealID};
  const site=modules.pePortfolioOperations.getPortfolioProductionSite(state,fundID,dealID);
  if(!site)return {ok:false,reason:'production-site-missing',fundID,dealID};
  const area=(state?.areas||[]).find(row=>row?.id===site.areaID),pref=(state?.prefs||[]).find(row=>row?.id===site.prefID);
  if(!area||!pref||pref.areaID!==area.id)return {ok:false,reason:'production-site-invalid',fundID,dealID};
  // Use the static production business master, not state.businesses: the latter contains the
  // player's self-company price/quality/brand/DX investments and would leak choices across owners.
  const master=(modules.data?.MASTER?.businesses||[]).find(row=>row?.id===GYM_BUSINESS_ID);
  if(!master)return {ok:false,reason:'gym-business-master-not-found',fundID,dealID};
  const normalized=normalizePEPortfolioGymOperatingState(operatingState);
  if(membershipStrategyOverride!==undefined)normalized.gymMembership.membershipStrategy=membershipStrategyOverride;
  const detachedStore={
    id:`pe-gym-${dealID}`,businessID:GYM_BUSINESS_ID,status:'open',
    condition:normalized.condition,level:normalized.level,operatingHours:normalized.operatingHours,
    gymMembership:clone(normalized.gymMembership)
  };
  // The override exists only for a same-state control calculation inside the PE gym weekly
  // calculator. It never writes through to the deal. Normal callers use the production PE lever.
  const priceMultiplier=priceMultiplierOverride===undefined
    ?clamp(finite(target.portfolioCompany.priceMultiplier,1),.5,2)
    :clamp(finite(priceMultiplierOverride,1),.5,2);
  const detachedBusiness={...clone(master),price:Math.max(1,finite(master.price,1)*priceMultiplier)};
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
    store:detachedStore,business:detachedBusiness,operatingState:clone(normalized),
    portfolioLevers:{
      priceMultiplier:finite(target.portfolioCompany.priceMultiplier,1),qualityInvestment:finite(target.portfolioCompany.qualityInvestment),
      storeCount:Math.max(1,Math.floor(finite(target.portfolioCompany.storeCount,1))),procurementReform:finite(target.portfolioCompany.procurementReform),
      wageLevel:finite(target.portfolioCompany.wageLevel,1),headcountRatio:finite(target.portfolioCompany.headcountRatio,1),
      productMixLevel:finite(target.portfolioCompany.productMixLevel),consolidatedRatio:finite(target.portfolioCompany.consolidatedRatio)
    }
  };
}
function buildPEPortfolioGymOperatingInput(engine,fundID,dealID,options={}){return buildPEPortfolioGymOperatingInputForState(engine?.g,fundID,dealID,options);}
function previewPEPortfolioGymWeekForState(state,fundID,dealID,options={}){
  const input=buildPEPortfolioGymOperatingInputForState(state,fundID,dealID,options);
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
function previewPEPortfolioGymWeek(engine,fundID,dealID,options={}){return previewPEPortfolioGymWeekForState(engine?.g,fundID,dealID,options);}

// PE conveni bridge. Same detachment discipline as the gym bridge above: the production
// convenience-merchandising.js model is never called with the real g. It is called with a
// throwaway runtime object that carries only a cloned deal.portfolioCompany.conveniOperatingState
// (as runtime.conveniMerchandising) and a synthetic runtime.stores array standing in for the
// portfolio company's own store count -- never the player's self-company g.conveniMerchandising or
// g.stores. js/convenience-merchandising.js itself is untouched: ensure()/clusterCountFor()/
// chainStoreCountFor() already operate purely on whatever g-shaped object they are given.
// normalizePEPortfolioConveniOperatingState reuses convenienceMerchandising.ensure()'s own
// defaulting/validation (called on a throwaway runtime) instead of duplicating that logic here.
function normalizePEPortfolioConveniOperatingState(raw){
  const runtime={conveniMerchandising:raw&&typeof raw==='object'?clone(raw):undefined,stores:[]};
  return clone(modules.convenienceMerchandising.ensure(runtime));
}
function defaultPEPortfolioConveniOperatingState(){return normalizePEPortfolioConveniOperatingState(null);}
// Synthetic siblings stand in for the portfolio company's own store count wherever
// clusterCountFor/chainStoreCountFor would otherwise scan the real g.stores. Both cluster (same
// prefecture) and chain-wide counts collapse to the same pc.storeCount-derived proxy -- the PE
// abstraction has no real per-store geography, so there is nothing to tell them apart with.
function syntheticConveniSiblingStores(dealID,prefID,storeCount){
  const siblingCount=Math.max(0,Math.floor(finite(storeCount,1))-1);
  return Array.from({length:siblingCount},(_,i)=>({id:`pe-conveni-${dealID}-sibling-${i}`,businessID:CONVENI_BUSINESS_ID,status:'open',prefID}));
}
function buildPEPortfolioConveniOperatingInputForState(state,fundID,dealID,{week,weeklyDemandMultiplier=1,operatingState,priceMultiplierOverride}={}){
  const target=portfolioTarget(state,fundID,dealID);
  if(!target.ok)return {ok:false,reason:target.reason,fundID,dealID};
  if(target.deal.businessID!==CONVENI_BUSINESS_ID)return {ok:false,reason:'not-conveni',fundID,dealID};
  const site=modules.pePortfolioOperations.getPortfolioProductionSite(state,fundID,dealID);
  if(!site)return {ok:false,reason:'production-site-missing',fundID,dealID};
  const area=(state?.areas||[]).find(row=>row?.id===site.areaID),pref=(state?.prefs||[]).find(row=>row?.id===site.prefID);
  if(!area||!pref||pref.areaID!==area.id)return {ok:false,reason:'production-site-invalid',fundID,dealID};
  // Use the static production business master, not state.businesses: the latter contains the
  // player's self-company price/quality/brand/DX investments and would leak choices across owners.
  const master=(modules.data?.MASTER?.businesses||[]).find(row=>row?.id===CONVENI_BUSINESS_ID);
  if(!master)return {ok:false,reason:'conveni-business-master-not-found',fundID,dealID};
  const normalizedOperatingState=normalizePEPortfolioConveniOperatingState(operatingState);
  const detachedStore={id:`pe-conveni-${dealID}`,businessID:CONVENI_BUSINESS_ID,status:'open',prefID:pref.id};
  const priceMultiplier=priceMultiplierOverride===undefined
    ?clamp(finite(target.portfolioCompany.priceMultiplier,1),.5,2)
    :clamp(finite(priceMultiplierOverride,1),.5,2);
  const detachedBusiness={...clone(master),price:Math.max(1,finite(master.price,1)*priceMultiplier)};
  const environment=modules.storeMarketEnvironment;
  const competitorPressure=environment.competitorPressure(state?.competitors,area.id,CONVENI_BUSINESS_ID);
  const localCompetition=environment.localCompetition(area,competitorPressure);
  const resolvedWeek=Math.max(1,Math.floor(finite(week,state?.week||1)));
  const multiplier=Math.max(0,finite(weeklyDemandMultiplier,1));
  const macroSalesFactor=state?.macroCrisis?finite(state.macroCrisis.salesMultiplier,1):1;
  const demand=environment.storeDemand({
    baseDemand:finite(detachedBusiness.demand),prefectureTraffic:finite(pref.traffic,1),areaTraffic:finite(area.traffic,1),
    economy:finite(state?.economy,1),season:finite(state?.season,1),businessAreaFit:environment.businessAreaFit(detachedBusiness,area),
    quality:finite(detachedBusiness.quality),brand:finite(detachedBusiness.brand),dx:finite(detachedBusiness.dx),localCompetition,
    weeklyDemandMultiplier:multiplier,siteSuitabilityFactor:1,dxDepartmentEffect:0,marketingDepartmentEffect:0,macroSalesFactor
  });
  return {
    ok:true,source:'pe-conveni-detached-production-input',fundID,dealID,week:resolvedWeek,
    productionSite:{...site},pref:{id:pref.id,areaID:pref.areaID,name:pref.name,traffic:finite(pref.traffic,1)},
    area:{id:area.id,name:area.name,traffic:finite(area.traffic,1),competition:finite(area.competition)},
    competitorPressure,localCompetition,demand,inflation:finite(state?.inflation,1),weeklyDemandMultiplier:multiplier,
    store:detachedStore,business:detachedBusiness,operatingState:normalizedOperatingState,
    siblingStores:syntheticConveniSiblingStores(dealID,pref.id,target.portfolioCompany.storeCount),
    portfolioLevers:{
      priceMultiplier:finite(target.portfolioCompany.priceMultiplier,1),qualityInvestment:finite(target.portfolioCompany.qualityInvestment),
      storeCount:Math.max(1,Math.floor(finite(target.portfolioCompany.storeCount,1))),procurementReform:finite(target.portfolioCompany.procurementReform),
      wageLevel:finite(target.portfolioCompany.wageLevel,1),headcountRatio:finite(target.portfolioCompany.headcountRatio,1),
      productMixLevel:finite(target.portfolioCompany.productMixLevel),consolidatedRatio:finite(target.portfolioCompany.consolidatedRatio)
    }
  };
}
function buildPEPortfolioConveniOperatingInput(engine,fundID,dealID,options={}){return buildPEPortfolioConveniOperatingInputForState(engine?.g,fundID,dealID,options);}
function previewPEPortfolioConveniWeekForState(state,fundID,dealID,options={}){
  const input=buildPEPortfolioConveniOperatingInputForState(state,fundID,dealID,options);
  if(!input.ok)return input;
  const store=clone(input.store),business=clone(input.business);
  // The detached runtime never aliases the real state: conveniMerchandising is a clone of the PE
  // deal's own operating state (never state.conveniMerchandising), and stores is a synthetic array
  // (never state.stores). convenience-merchandising.js's ensure()/clusterCountFor()/
  // chainStoreCountFor() therefore cannot reach or mutate the player's self-company records.
  const runtime={week:input.week,conveniMerchandising:clone(input.operatingState),stores:input.siblingStores};
  const result=modules.convenienceMerchandising.processStore(runtime,store,business,input.demand,input.inflation);
  if(!result)return {ok:false,reason:'conveni-model-rejected-input',fundID,dealID};
  return {
    ok:true,source:'pe-conveni-detached-preview',fundID,dealID,week:input.week,
    sales:finite(result.sales),variable:finite(result.variable),profitBeforeFixed:finite(result.sales)-finite(result.variable),
    demand:input.demand,productionSite:{...input.productionSite},
    operatingState:clone(input.operatingState),nextOperatingState:clone(runtime.conveniMerchandising),
    storeRecord:clone(runtime.conveniMerchandising?.lastWeekByStoreID?.[store.id])
  };
}
function previewPEPortfolioConveniWeek(engine,fundID,dealID,options={}){return previewPEPortfolioConveniWeekForState(engine?.g,fundID,dealID,options);}

// PE ramen market bridge. Supply/inventory remains intentionally outside this bridge: the
// production market kernel is reused for price elasticity + same-prefecture cannibalization while
// procurement/working-capital stays in the calibrated generic PE model. Every object passed into
// market.calculateMarketFromOffers() is detached from the player's real g/state.
function detachedRamenCompetitorRuntime(state,master){
  return {
    week:finite(state?.week,1),selectedPref:state?.selectedPref||null,selectedArea:state?.selectedArea||null,
    businesses:[clone(master)],prefs:clone(state?.prefs||[]),competitors:clone(state?.competitors||[]),
    competitorStates:clone(state?.competitorStates||[]),competitorActions:clone(state?.competitorActions||[]),
    competitorMarketResultsByPresenceID:clone(state?.competitorMarketResultsByPresenceID||{}),
    competitorMarketResultsByCompetitorID:clone(state?.competitorMarketResultsByCompetitorID||{}),
    competitorPerformanceHistoryByID:clone(state?.competitorPerformanceHistoryByID||{}),
    competitorPresenceHistoryByID:clone(state?.competitorPresenceHistoryByID||{}),
    nextCompetitorStateSeq:finite(state?.nextCompetitorStateSeq,1),nextCompetitorPresenceSeq:finite(state?.nextCompetitorPresenceSeq,1),
    nextCompetitorActionSeq:finite(state?.nextCompetitorActionSeq,1),nextCompetitorInvestmentSeq:finite(state?.nextCompetitorInvestmentSeq,1),
    competitorMigrationV8Applied:Boolean(state?.competitorMigrationV8Applied)
  };
}
function ramenMarketPotentialForState(state,master,pref,area){
  let value=finite(master?.demand,1)*finite(pref?.traffic,1)*finite(area?.traffic,1)*finite(state?.economy,1)*finite(state?.season,1)*finite(area?.ramenFit,1);
  if(state?.macroCrisis)value*=finite(state.macroCrisis.salesMultiplier,1);
  return clamp(value*2.05,0,10_000_000);
}
function ramenSyntheticOffer(master,pref,dealID,index,priceMultiplier){
  const detachedStore={id:`pe-ramen-${dealID}-${index}`,businessID:RAMEN_BUSINESS_ID,status:'open',condition:100,level:1,operatingHours:3,prefID:pref.id};
  const quality=clamp(finite(master?.quality),0,100),brandAwareness=clamp(finite(master?.brand),0,100);
  const brandTrust=clamp(brandAwareness*.65+quality*.25,0,100);
  const convenience=clamp(40+finite(pref?.traffic,1)*32+21,0,100);
  const serviceQuality=clamp(45+50*.30+55*.18,0,100);
  const novelty=clamp(finite(master?.dx)*.65+quality*.2,0,100);
  const customerSatisfaction=clamp(35+quality*.32+serviceQuality*.25+brandTrust*.16,0,100);
  const repeatRate=clamp(.12+customerSatisfaction/180+brandTrust/380,0,.88);
  const variableCostPerUnit=finite(master?.unitCost)*(1+quality/1000)*(1-Math.min(.22,finite(master?.efficiency)/260));
  const capacity=modules.market.effectiveCapacity(detachedStore,master,pref);
  return {
    id:detachedStore.id,kind:'player',price:Math.max(1,finite(master?.price,1)*priceMultiplier),
    quality,brandAwareness,brandTrust,convenience,serviceQuality,novelty,capacity,variableCostPerUnit,
    customerSatisfaction,repeatRate,activeMenuCount:1,menuPlan:null,menuComplexityMultiplier:1,
    concept:{segmentFit:{},recipeMultipliers:{}}
  };
}
function buildPEPortfolioRamenOperatingInputForState(state,fundID,dealID,{week,priceMultiplierOverride}={}){
  const target=portfolioTarget(state,fundID,dealID);
  if(!target.ok)return {ok:false,reason:target.reason,fundID,dealID};
  if(target.deal.businessID!==RAMEN_BUSINESS_ID)return {ok:false,reason:'not-ramen',fundID,dealID};
  const site=modules.pePortfolioOperations.getPortfolioProductionSite(state,fundID,dealID);
  if(!site)return {ok:false,reason:'production-site-missing',fundID,dealID};
  const area=(state?.areas||[]).find(row=>row?.id===site.areaID),pref=(state?.prefs||[]).find(row=>row?.id===site.prefID);
  if(!area||!pref||pref.areaID!==area.id)return {ok:false,reason:'production-site-invalid',fundID,dealID};
  const master=(modules.data?.MASTER?.businesses||[]).find(row=>row?.id===RAMEN_BUSINESS_ID);
  if(!master)return {ok:false,reason:'ramen-business-master-not-found',fundID,dealID};
  const resolvedWeek=Math.max(1,Math.floor(finite(week,state?.week||1)));
  const priceMultiplier=priceMultiplierOverride===undefined
    ?clamp(finite(target.portfolioCompany.priceMultiplier,1),.5,2)
    :clamp(finite(priceMultiplierOverride,1),.5,2);
  const storeCount=Math.max(1,Math.floor(finite(target.portfolioCompany.storeCount,1)));
  const playerOffers=Array.from({length:storeCount},(_,index)=>ramenSyntheticOffer(master,pref,dealID,index,priceMultiplier));
  const competitorRuntime=detachedRamenCompetitorRuntime(state,master);
  const competitors=modules.market.competitorOffers(competitorRuntime,RAMEN_BUSINESS_ID,pref.id)||[];
  return {
    ok:true,source:'pe-ramen-detached-market-input',fundID,dealID,week:resolvedWeek,
    productionSite:{...site},pref:{id:pref.id,areaID:pref.areaID,name:pref.name,traffic:finite(pref.traffic,1)},
    area:{id:area.id,name:area.name,traffic:finite(area.traffic,1),ramenFit:finite(area.ramenFit,1)},
    marketPotential:ramenMarketPotentialForState(state,master,pref,area),inflation:finite(state?.inflation,1),economy:finite(state?.economy,1),
    playerOffers,competitorOffers:clone(competitors),campaignBoosts:{},
    portfolioLevers:{
      priceMultiplier:finite(target.portfolioCompany.priceMultiplier,1),qualityInvestment:finite(target.portfolioCompany.qualityInvestment),
      storeCount,procurementReform:finite(target.portfolioCompany.procurementReform),wageLevel:finite(target.portfolioCompany.wageLevel,1),
      headcountRatio:finite(target.portfolioCompany.headcountRatio,1),productMixLevel:finite(target.portfolioCompany.productMixLevel),
      consolidatedRatio:finite(target.portfolioCompany.consolidatedRatio)
    }
  };
}
function buildPEPortfolioRamenOperatingInput(engine,fundID,dealID,options={}){return buildPEPortfolioRamenOperatingInputForState(engine?.g,fundID,dealID,options);}
function previewPEPortfolioRamenWeekForState(state,fundID,dealID,options={}){
  const input=buildPEPortfolioRamenOperatingInputForState(state,fundID,dealID,options);
  if(!input.ok)return input;
  const marketResult=modules.market.calculateMarketFromOffers({
    businessID:RAMEN_BUSINESS_ID,prefID:input.pref.id,areaID:input.area.id,marketPotential:input.marketPotential,
    inflation:input.inflation,economy:input.economy,playerOffers:clone(input.playerOffers),
    competitorOffers:clone(input.competitorOffers),campaignBoosts:{}
  });
  const rows=Object.values(marketResult.stores||{});
  const sales=rows.reduce((total,row)=>total+finite(row.revenue),0);
  const variable=rows.reduce((total,row)=>total+finite(row.variableCost),0);
  return {
    ok:true,source:'pe-ramen-detached-market-preview',fundID,dealID,week:input.week,
    sales,variable,profitBeforeFixed:sales-variable,marketPotential:input.marketPotential,
    ownMarketShare:finite(marketResult.ownMarketShare),productionSite:{...input.productionSite},
    storeResults:clone(marketResult.stores),competitorResults:clone(marketResult.competitorResults)
  };
}
function previewPEPortfolioRamenWeek(engine,fundID,dealID,options={}){return previewPEPortfolioRamenWeekForState(engine?.g,fundID,dealID,options);}

// PE realEstateAgency bridge (engine layer only -- resolvePortfolioManagementCapability() above
// deliberately does NOT enable actionsEnabled for realEstateAgency yet; UI connection is left for
// a follow-up PR, same as conveni's engine-first/UI-second split across #670/#671). Same
// detachment discipline as gym/conveni: the production real-estate-agency-pipeline.js model is
// never called with the real state. Unlike conveni, no synthetic sibling-store array is needed --
// real-estate-agency-pipeline.js's capacityFor() depends only on business.efficiency and
// siteMultiplier, never on sibling store counts (confirmed by reading the whole file: it has no
// clusterCountFor/chainStoreCountFor-equivalent), so a single detached store is sufficient, same
// as gym's bridge.
const REAL_ESTATE_AGENCY_BUSINESS_ID='realEstateAgency';
// real-estate-agency-pipeline.js's ensureStore() is itself the per-store sanitizer (unlike
// convenience-merchandising.js, there is no separate company-wide ensure() to reuse), so this
// just calls it directly on a throwaway detached store carrying the raw operating state.
function normalizePEPortfolioRealEstateAgencyOperatingState(raw,week){
  const w=Math.max(1,Math.floor(finite(week,1)));
  const master=(modules.data?.MASTER?.businesses||[]).find(row=>row?.id===REAL_ESTATE_AGENCY_BUSINESS_ID)||{};
  const detachedStore={id:'pe-realestate-normalize',businessID:REAL_ESTATE_AGENCY_BUSINESS_ID,status:'open',brokeragePipeline:raw&&typeof raw==='object'?clone(raw):undefined};
  modules.realEstateAgencyPipeline.ensureStore(detachedStore,master,w,1,1);
  return clone(detachedStore.brokeragePipeline);
}
function defaultPEPortfolioRealEstateAgencyOperatingState(){return normalizePEPortfolioRealEstateAgencyOperatingState(null,1);}
function buildPEPortfolioRealEstateAgencyOperatingInputForState(state,fundID,dealID,{week,operatingState,priceMultiplierOverride}={}){
  const target=portfolioTarget(state,fundID,dealID);
  if(!target.ok)return {ok:false,reason:target.reason,fundID,dealID};
  if(target.deal.businessID!==REAL_ESTATE_AGENCY_BUSINESS_ID)return {ok:false,reason:'not-realEstateAgency',fundID,dealID};
  const site=modules.pePortfolioOperations.getPortfolioProductionSite(state,fundID,dealID);
  if(!site)return {ok:false,reason:'production-site-missing',fundID,dealID};
  const area=(state?.areas||[]).find(row=>row?.id===site.areaID),pref=(state?.prefs||[]).find(row=>row?.id===site.prefID);
  if(!area||!pref||pref.areaID!==area.id)return {ok:false,reason:'production-site-invalid',fundID,dealID};
  // Use the static production business master, not state.businesses: the latter contains the
  // player's self-company price/quality/brand/DX investments and would leak choices across owners.
  const master=(modules.data?.MASTER?.businesses||[]).find(row=>row?.id===REAL_ESTATE_AGENCY_BUSINESS_ID);
  if(!master)return {ok:false,reason:'realEstateAgency-business-master-not-found',fundID,dealID};
  const resolvedWeek=Math.max(1,Math.floor(finite(week,state?.week||1)));
  const normalizedOperatingState=normalizePEPortfolioRealEstateAgencyOperatingState(operatingState,resolvedWeek);
  // priceMultiplier is carried through for parity with gym/conveni's portfolioLevers and the same
  // actual-vs-control wiring calculateRealEstateAgencyPortfolioOperatingWeek() uses below, but
  // real-estate-agency-pipeline.js's processStore() never reads business.price -- a full-file grep
  // confirms zero references anywhere in that file. Brokerage commission is a percentage of a
  // randomly negotiated transaction value (hash()-driven, scaled by realEstateCycle and the
  // segment's valueMultiplier), not a price-elastic demand model. So actual vs. control below
  // resolve to byte-identical output regardless of priceMultiplier, and
  // calculateRealEstateAgencyPortfolioOperatingWeek()'s salesFactor/contributionFactor are always
  // exactly 1. This is intentional, not a bug: the price lever is wired for structural consistency
  // with gym/conveni, but has no real effect on this business, because the underlying model has no
  // price-elasticity concept at all. Do not "fix" this without changing the production model.
  const priceMultiplier=priceMultiplierOverride===undefined
    ?clamp(finite(target.portfolioCompany.priceMultiplier,1),.5,2)
    :clamp(finite(priceMultiplierOverride,1),.5,2);
  const detachedBusiness={...clone(master),price:Math.max(1,finite(master.price,1)*priceMultiplier)};
  const detachedStore={id:`pe-realestate-${dealID}`,businessID:REAL_ESTATE_AGENCY_BUSINESS_ID,status:'open',brokeragePipeline:clone(normalizedOperatingState)};
  return {
    ok:true,source:'pe-realestate-detached-production-input',fundID,dealID,week:resolvedWeek,
    productionSite:{...site},pref:{id:pref.id,areaID:pref.areaID,name:pref.name,traffic:finite(pref.traffic,1)},
    area:{id:area.id,name:area.name,traffic:finite(area.traffic,1),competition:finite(area.competition)},
    store:detachedStore,business:detachedBusiness,operatingState:normalizedOperatingState,
    portfolioLevers:{
      priceMultiplier:finite(target.portfolioCompany.priceMultiplier,1),qualityInvestment:finite(target.portfolioCompany.qualityInvestment),
      storeCount:Math.max(1,Math.floor(finite(target.portfolioCompany.storeCount,1))),procurementReform:finite(target.portfolioCompany.procurementReform),
      wageLevel:finite(target.portfolioCompany.wageLevel,1),headcountRatio:finite(target.portfolioCompany.headcountRatio,1),
      productMixLevel:finite(target.portfolioCompany.productMixLevel),consolidatedRatio:finite(target.portfolioCompany.consolidatedRatio)
    }
  };
}
function buildPEPortfolioRealEstateAgencyOperatingInput(engine,fundID,dealID,options={}){return buildPEPortfolioRealEstateAgencyOperatingInputForState(engine?.g,fundID,dealID,options);}
function previewPEPortfolioRealEstateAgencyWeekForState(state,fundID,dealID,options={}){
  const input=buildPEPortfolioRealEstateAgencyOperatingInputForState(state,fundID,dealID,options);
  if(!input.ok)return input;
  const store=clone(input.store),business=clone(input.business);
  // The detached runtime never aliases the real state: week/seed/realEstateCycle are copied
  // primitive values (seed and realEstateCycle are shared macro-level indicators, same as gym/
  // conveni already pulling state?.inflation/state?.macroCrisis -- not self-company-specific data),
  // and store/business are fully detached objects -- never state.stores or state.businesses.
  // real-estate-agency-pipeline.js's processStore() therefore cannot reach or mutate the player's
  // self-company records (confirmed by reading it in full: it references only g.week/g.seed/
  // g.realEstateCycle and writes only store.brokeragePipeline).
  const runtime={week:input.week,seed:finite(state?.seed,1),realEstateCycle:finite(state?.realEstateCycle,1)};
  const result=modules.realEstateAgencyPipeline.processStore(runtime,store,business,input.pref,1);
  if(!result)return {ok:false,reason:'realEstateAgency-model-rejected-input',fundID,dealID};
  return {
    ok:true,source:'pe-realestate-detached-preview',fundID,dealID,week:input.week,
    sales:finite(result.sales),variable:finite(result.variable),profitBeforeFixed:finite(result.sales)-finite(result.variable),
    productionSite:{...input.productionSite},
    operatingState:clone(input.operatingState),nextOperatingState:clone(store.brokeragePipeline),
    kpi:clone(result.kpi)
  };
}
function previewPEPortfolioRealEstateAgencyWeek(engine,fundID,dealID,options={}){return previewPEPortfolioRealEstateAgencyWeekForState(engine?.g,fundID,dealID,options);}

const proto=EngineClass.prototype;
proto.getManagementContext=function(){return getManagementContext(this);};
proto.canOpenPEPortfolioManagement=function(fundID,dealID){return canOpenPEPortfolioManagement(this,fundID,dealID);};
proto.openPEPortfolioManagement=function(fundID,dealID){return openPEPortfolioManagement(this,fundID,dealID);};
proto.closeManagementContext=function(){return closeManagementContext(this);};
proto.resolveManagementContext=function(){return resolveManagementContext(this);};
proto.getPEPortfolioRamenOperatingInput=function(fundID,dealID,options){return buildPEPortfolioRamenOperatingInput(this,fundID,dealID,options);};
proto.previewPEPortfolioRamenWeek=function(fundID,dealID,options){return previewPEPortfolioRamenWeek(this,fundID,dealID,options);};
proto.getPEPortfolioGymOperatingInput=function(fundID,dealID,options){return buildPEPortfolioGymOperatingInput(this,fundID,dealID,options);};
proto.previewPEPortfolioGymWeek=function(fundID,dealID,options){return previewPEPortfolioGymWeek(this,fundID,dealID,options);};
proto.getPEPortfolioConveniOperatingInput=function(fundID,dealID,options){return buildPEPortfolioConveniOperatingInput(this,fundID,dealID,options);};
proto.previewPEPortfolioConveniWeek=function(fundID,dealID,options){return previewPEPortfolioConveniWeek(this,fundID,dealID,options);};
proto.getPEPortfolioRealEstateAgencyOperatingInput=function(fundID,dealID,options){return buildPEPortfolioRealEstateAgencyOperatingInput(this,fundID,dealID,options);};
proto.previewPEPortfolioRealEstateAgencyWeek=function(fundID,dealID,options){return previewPEPortfolioRealEstateAgencyWeek(this,fundID,dealID,options);};
modules.managementContext=Object.freeze({
  supportedBusinessIDs,resolvePortfolioManagementCapability,canOpenPEPortfolioManagement,getManagementContext,openPEPortfolioManagement,closeManagementContext,resolveManagementContext,
  RAMEN_BUSINESS_ID,buildPEPortfolioRamenOperatingInputForState,buildPEPortfolioRamenOperatingInput,previewPEPortfolioRamenWeekForState,previewPEPortfolioRamenWeek,
  GYM_BUSINESS_ID,GYM_OPERATING_STATE_SCHEMA_VERSION,defaultPEPortfolioGymOperatingState,normalizePEPortfolioGymOperatingState,
  buildPEPortfolioGymOperatingInputForState,buildPEPortfolioGymOperatingInput,previewPEPortfolioGymWeekForState,previewPEPortfolioGymWeek,
  CONVENI_BUSINESS_ID,defaultPEPortfolioConveniOperatingState,normalizePEPortfolioConveniOperatingState,
  buildPEPortfolioConveniOperatingInputForState,buildPEPortfolioConveniOperatingInput,previewPEPortfolioConveniWeekForState,previewPEPortfolioConveniWeek,
  REAL_ESTATE_AGENCY_BUSINESS_ID,defaultPEPortfolioRealEstateAgencyOperatingState,normalizePEPortfolioRealEstateAgencyOperatingState,
  buildPEPortfolioRealEstateAgencyOperatingInputForState,buildPEPortfolioRealEstateAgencyOperatingInput,previewPEPortfolioRealEstateAgencyWeekForState,previewPEPortfolioRealEstateAgencyWeek,
  __installed:true
});
})();
