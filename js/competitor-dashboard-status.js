// Phase 5B-5B-1 market-status normalization for the dashboard view.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-dashboard-status.js.');
const competitor=globalThis.__capitalismTycoonModules.competitor;
if(!competitor?.dashboard?.buildDashboard)throw new Error('competitor-dashboard.js must be loaded before competitor-dashboard-status.js.');
if(competitor.dashboard.__marketStatusNormalized)throw new Error('competitor dashboard market status is already normalized.');

const base=competitor.dashboard;
const list=value=>Array.isArray(value)?value:[];
const text=value=>String(value??'');
function sourceStatuses(state){
 const map=new Map();
 for(const company of list(state?.competitorStates))for(const presence of list(company?.marketPresence)){
  const id=text(presence?.presenceID);if(!id)continue;
  map.set(id,text(presence?.entryStatus||(presence?.active?'active':'inactive')));
 }
 return map;
}
function normalizeResult(state,result){
 const statuses=sourceStatuses(state);
 const rows=result.rows.map(row=>{
  const markets=row.markets.map(market=>Object.freeze({...market,entryStatus:statuses.get(market.presenceID)||market.entryStatus||(market.active?'active':'inactive')}));
  const active=markets.filter(market=>market.active).length;
  const opening=markets.filter(market=>['planned','opening'].includes(market.entryStatus)).length;
  const marketSummary=Object.freeze({...row.marketSummary,active,opening,inactive:Math.max(0,markets.length-active-opening)});
  return Object.freeze({...row,markets:Object.freeze(markets),marketSummary});
 });
 return Object.freeze({...result,activeMarkets:rows.reduce((sum,row)=>sum+row.marketSummary.active,0),rows:Object.freeze(rows)});
}
function buildDashboard(state,options={}){return normalizeResult(state,base.buildDashboard(state,options));}
function buildDetail(state,competitorID){return buildDashboard(state).rows.find(row=>row.competitorID===text(competitorID))||null;}
competitor.dashboard=Object.freeze({...base,buildDashboard,buildDetail,__marketStatusNormalized:true});
})();

// Phase 8A-2 compatibility: terminal lifecycle outcomes override later strategic project synchronization.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
const competitor=modules?.competitor;
if(!competitor?.__strategicAIInstalled)throw new Error('competitor strategic AI must load before terminal strategy compatibility.');
if(typeof competitor.applyTerminalCompatibility!=='function')throw new Error('competitor terminal compatibility must load before terminal strategy compatibility.');
if(competitor.__strategicTerminalCompatibilityInstalled)throw new Error('strategic terminal compatibility is already installed.');
const baseProcessWeek=competitor.processWeek;
competitor.processWeek=function(state){
 const beforeEvents=Array.isArray(state?.competitorEvents)?state.competitorEvents.slice():[];
 const result=baseProcessWeek(state);
 competitor.applyTerminalCompatibility(state,beforeEvents);
 return result;
};
competitor.__strategicTerminalCompatibilityInstalled=true;
})();
