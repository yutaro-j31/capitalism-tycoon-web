// Runtime-only management target selection for self and PE portfolio companies.
// Existing management actions remain disabled for PE contexts until their state/accounting
// boundaries are made context-aware in follow-up work.
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must be loaded before management-context.js.');
if(!modules?.peIndustryTiers)throw new Error('pe-industry-tiers.js must be loaded before management-context.js.');
if(modules.managementContext)throw new Error('management context module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const SELF=Object.freeze({kind:'self'}),contexts=new WeakMap();
const supportedBusinessIDs=Object.freeze([...modules.peIndustryTiers.TIERS.pillar.businessIDs]);
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
const proto=EngineClass.prototype;
proto.getManagementContext=function(){return getManagementContext(this);};
proto.canOpenPEPortfolioManagement=function(fundID,dealID){return canOpenPEPortfolioManagement(this,fundID,dealID);};
proto.openPEPortfolioManagement=function(fundID,dealID){return openPEPortfolioManagement(this,fundID,dealID);};
proto.closeManagementContext=function(){return closeManagementContext(this);};
proto.resolveManagementContext=function(){return resolveManagementContext(this);};
modules.managementContext=Object.freeze({supportedBusinessIDs,resolvePortfolioManagementCapability,canOpenPEPortfolioManagement,getManagementContext,openPEPortfolioManagement,closeManagementContext,resolveManagementContext,__installed:true});
})();
