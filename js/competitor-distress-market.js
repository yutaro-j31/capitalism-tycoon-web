// Phase 5B-4 bridge: retire bankrupt detailed competitors from the legacy market fallback.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-distress-market.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor?.__distressInstalled)throw new Error('competitor-distress.js must be loaded before competitor-distress-market.js.');
if(!modules.competitor?.__distressProjectsInstalled)throw new Error('competitor-distress-projects.js must be loaded before competitor-distress-market.js.');
if(modules.competitor.__distressMarketInstalled)throw new Error('competitor distress market bridge is already installed.');

const competitor=modules.competitor;
const integer=(value,fallback=0)=>Math.max(0,Math.floor(Number.isFinite(Number(value))?Number(value):fallback));

function archiveLegacyCompetitor(state,company){
 if(!company||company.status!=='bankrupt'||!company.legacyCompetitorID)return null;
 const legacy=(state.competitors||[]).find(row=>row&&row.id===company.legacyCompetitorID);
 if(!legacy)return null;
 if(legacy.lifecycleStatus!=='bankrupt'){
  legacy.archivedAreaID=legacy.archivedAreaID||legacy.areaID||null;
  legacy.areaID='__bankrupt__';
  legacy.stores=0;
  legacy.lifecycleStatus='bankrupt';
  legacy.bankruptcyWeek=integer(company.bankruptcyWeek,state.week);
 }
 return legacy;
}
function archiveBankruptLegacyCompetitors(state){
 for(const company of state?.competitorStates||[])archiveLegacyCompetitor(state,company);
 return state;
}
function validateBankruptMarketRetirement(state){
 const errors=[];
 for(const company of state?.competitorStates||[]){
  if(company.status!=='bankrupt'||!company.legacyCompetitorID)continue;
  const legacy=(state.competitors||[]).find(row=>row&&row.id===company.legacyCompetitorID);
  if(legacy&&legacy.areaID!=='__bankrupt__')errors.push('bankrupt旧競合が市場フォールバックに残存');
 }
 if(errors.length)throw new Error(errors.join(' / '));
 return true;
}

const baseEnsure=competitor.ensure;
const baseProcessWeek=competitor.processWeek;
const baseReviewCompanyLifecycle=competitor.reviewCompanyLifecycle;
const baseBankruptCompany=competitor.bankruptCompany;
const baseValidate=competitor.validate;
competitor.ensure=function(state){const result=baseEnsure(state);archiveBankruptLegacyCompetitors(state);return result;};
competitor.processWeek=function(state){const result=baseProcessWeek(state);archiveBankruptLegacyCompetitors(state);return result;};
competitor.reviewCompanyLifecycle=function(state,company){const result=baseReviewCompanyLifecycle(state,company);archiveLegacyCompetitor(state,company);return result;};
competitor.bankruptCompany=function(state,company,reason){const result=baseBankruptCompany(state,company,reason);archiveLegacyCompetitor(state,company);return result;};
competitor.validate=function(state){baseValidate(state);validateBankruptMarketRetirement(state);return true;};
Object.assign(competitor,{archiveLegacyCompetitor,archiveBankruptLegacyCompetitors,validateBankruptMarketRetirement,__distressMarketInstalled:true});
})();
