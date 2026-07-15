// Phase 5B-5B-1: pure competitor dashboard view model.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before competitor-dashboard.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.competitor?.__parityCompatibilityRegistered)throw new Error('competitor-parity.js must be loaded before competitor-dashboard.js.');
if(modules.competitor.dashboard)throw new Error('competitor dashboard is already registered.');

const competitor=modules.competitor;
const HISTORY_WINDOWS=Object.freeze([4,13]);
const TERMINAL_PROJECTS=new Set(['completed','cancelled','failed']);
const TERMINAL_ACTIONS=new Set(['completed','cancelled','failed','skipped','applied']);
const STATUS_META=Object.freeze({
 active:{label:'通常運営',severity:'normal',rank:1},
 growing:{label:'成長投資',severity:'good',rank:0},
 defending:{label:'防衛対応',severity:'warning',rank:3},
 distressed:{label:'経営危機',severity:'danger',rank:7},
 turnaround:{label:'再建中',severity:'danger',rank:8},
 recovered:{label:'回復監視',severity:'warning',rank:4},
 withdrawing:{label:'市場撤退中',severity:'warning',rank:5},
 inactive:{label:'事業停止',severity:'muted',rank:9},
 bankrupt:{label:'倒産',severity:'danger',rank:10}
});
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const list=value=>Array.isArray(value)?value:[];
const text=value=>String(value??'');
const round=(value,digits=2)=>{const scale=10**digits;return Math.round(finite(value)*scale)/scale;};
const ratio=(value,denominator)=>denominator?finite(value)/finite(denominator):0;
const statusOf=company=>STATUS_META[company?.lifecycleStatus]||STATUS_META[company?.status]||STATUS_META.active;
const counterMap=state=>new Map(list(state?.competitorCounterStates).map(row=>[text(row?.competitorID),row]));

function historyRows(state,company){
 const direct=list(company?.lifecycleHistory);
 const performance=list(state?.competitorPerformanceHistoryByID?.[company?.competitorID]);
 const rows=direct.length?direct:performance;
 return rows.filter(row=>row&&Number.isFinite(Number(row.week))).slice().sort((a,b)=>finite(a.week)-finite(b.week));
}
function windowSummary(rows,weeks){
 const selected=rows.slice(-Math.max(1,Math.floor(finite(weeks,1))));
 const sum=key=>selected.reduce((total,row)=>total+finite(row?.[key]),0);
 const average=key=>selected.length?sum(key)/selected.length:0;
 const profit=sum('weeklyProfit')||sum('profit');
 const revenue=sum('revenue');
 const first=selected[0]||{},last=selected[selected.length-1]||{};
 return Object.freeze({
  weeks:selected.length,
  fromWeek:selected.length?Math.floor(finite(first.week)):null,
  toWeek:selected.length?Math.floor(finite(last.week)):null,
  revenue:round(revenue),
  profit:round(profit),
  profitMargin:round(ratio(profit,revenue),4),
  averageCashRunwayWeeks:round(average('cashRunwayWeeks')),
  averageLeverage:round(average('leverage'),4),
  averageMarketShare:round(average('marketShare')||average('averageShare'),4),
  endingCash:round(finite(last.cash)),
  endingDebt:round(finite(last.debt)),
  profitChange:round(finite(last.weeklyProfit,last.profit)-finite(first.weeklyProfit,first.profit))
 });
}
function marketView(state,company,presence){
 const result=state?.competitorMarketResultsByPresenceID?.[presence?.presenceID]||{};
 const revenue=finite(result.revenue,presence?.revenue);
 const variableCost=finite(result.variableCost,presence?.variableCost);
 const contribution=finite(result.contributionMargin,revenue-variableCost);
 const capacity=Math.max(0,finite(presence?.totalCapacity));
 const fulfilled=Math.max(0,finite(result.fulfilledUnits,presence?.fulfilledUnits));
 return Object.freeze({
  presenceID:text(presence?.presenceID),
  businessID:text(presence?.businessID||company?.businessID),
  prefID:text(presence?.prefID),
  areaID:text(presence?.areaID),
  active:Boolean(presence?.active),
  entryStatus:text(presence?.entryStatus||presence?.active?'active':'inactive'),
  entryWeek:presence?.entryWeek==null?null:Math.floor(finite(presence.entryWeek)),
  openingWeek:presence?.openingWeek==null?null:Math.floor(finite(presence.openingWeek)),
  exitWeek:presence?.exitWeek==null?null:Math.floor(finite(presence.exitWeek)),
  price:round(finite(presence?.price)),
  storeCount:Math.max(0,Math.floor(finite(presence?.storeCount))),
  capacity:round(capacity),
  fulfilledUnits:round(fulfilled),
  utilization:round(clamp(ratio(fulfilled,capacity),0,4),4),
  marketShare:round(clamp(finite(result.marketShare,presence?.currentWeekShare),0,1),4),
  demandMarketShare:round(clamp(finite(result.demandMarketShare),0,1),4),
  customerSatisfaction:round(clamp(finite(result.customerSatisfaction),0,100)),
  revenue:round(revenue),
  contributionMargin:round(contribution),
  contributionMarginRate:round(ratio(contribution,revenue),4),
  lostDemand:round(Math.max(0,finite(result.lostDemand,presence?.lostDemand)))
 });
}
function riskScore(company,counter,markets,credit){
 const status=statusOf(company);
 const active=markets.filter(row=>row.active);
 const negativeProfit=Math.max(0,-finite(company?.weeklyProfit));
 const operatingBase=Math.max(1,Math.abs(finite(company?.weeklyRevenue))+Math.abs(finite(company?.weeklyFixedCost)));
 return round(
  status.rank*12+
  clamp(finite(company?.lastDistressScore),0,12)*6+
  clamp(ratio(negativeProfit,operatingBase),0,2)*20+
  clamp(credit.leverage-0.8,0,2)*25+
  clamp(3-credit.cashRunwayWeeks,0,3)*8+
  clamp(finite(counter?.pricePressure),0,8)*2+
  (active.length?0:15),2
 );
}
function companyView(state,company,counters){
 const companyID=text(company?.competitorID||company?.id);
 const counter=counters.get(companyID)||{};
 const markets=list(company?.marketPresence).map(presence=>marketView(state,company,presence)).sort((a,b)=>a.prefID.localeCompare(b.prefID)||a.presenceID.localeCompare(b.presenceID));
 const activeMarkets=markets.filter(row=>row.active);
 const openingMarkets=markets.filter(row=>['planned','opening'].includes(row.entryStatus));
 const projects=list(state?.competitorProjects).filter(row=>row?.competitorID===companyID&&!TERMINAL_PROJECTS.has(row?.status));
 const actions=list(state?.competitorActions).filter(row=>row?.competitorID===companyID&&!row?.applied&&!TERMINAL_ACTIONS.has(row?.status));
 const rows=historyRows(state,company);
 const revenue=finite(company?.weeklyRevenue);
 const profit=finite(company?.weeklyProfit);
 const creditLimit=Math.max(0,finite(company?.creditLimit));
 const debt=Math.max(0,finite(company?.debt));
 const operatingCost=Math.max(1,finite(company?.weeklyFixedCost)+finite(company?.weeklyMarketingCost)+finite(company?.weeklyRDCost)+finite(company?.weeklyInterestCost)+finite(company?.weeklyCapacityCost));
 const credit=Object.freeze({
  score:round(clamp(finite(company?.creditScore),0,100)),
  status:text(company?.creditStatus||'normal'),
  limit:round(creditLimit),
  debt:round(debt),
  available:round(Math.max(0,creditLimit-debt)),
  leverage:round(ratio(debt,Math.max(1,creditLimit)),4),
  cashRunwayWeeks:round(Math.max(0,finite(company?.cashRunwayWeeks,finite(company?.cash)/operatingCost))),
  missedPayments:Math.max(0,Math.floor(finite(company?.missedDebtPayments))),
  nextRepaymentWeek:company?.nextDebtRepaymentWeek==null?null:Math.floor(finite(company.nextDebtRepaymentWeek))
 });
 const status=statusOf(company);
 const view={
  competitorID:companyID,
  name:text(company?.name||'競合企業'),
  businessID:text(company?.businessID),
  strategyID:text(company?.strategyID||'balanced'),
  strategyName:text(competitor.STRATEGIES?.[company?.strategyID]?.name||company?.strategyID||'バランス型'),
  active:Boolean(company?.active),
  acquiredByPlayer:Boolean(company?.acquiredByPlayer),
  status:text(company?.lifecycleStatus||company?.status||'active'),
  statusLabel:status.label,
  severity:status.severity,
  statusReason:text(company?.lastLifecycleReason||company?.statusReason),
  financial:Object.freeze({
   cash:round(Math.max(0,finite(company?.cash))),
   debt:round(debt),
   revenue:round(revenue),
   profit:round(profit),
   profitMargin:round(ratio(profit,revenue),4),
   fixedCost:round(Math.max(0,finite(company?.weeklyFixedCost))),
   marketingCost:round(Math.max(0,finite(company?.weeklyMarketingCost))),
   rdCost:round(Math.max(0,finite(company?.weeklyRDCost))),
   interestCost:round(Math.max(0,finite(company?.weeklyInterestCost)))
  }),
  credit,
  markets:Object.freeze(markets),
  marketSummary:Object.freeze({
   total:markets.length,
   active:activeMarkets.length,
   opening:openingMarkets.length,
   inactive:markets.length-activeMarkets.length-openingMarkets.length,
   stores:activeMarkets.reduce((sum,row)=>sum+row.storeCount,0),
   capacity:round(activeMarkets.reduce((sum,row)=>sum+row.capacity,0)),
   fulfilledUnits:round(activeMarkets.reduce((sum,row)=>sum+row.fulfilledUnits,0)),
   averageShare:round(activeMarkets.length?activeMarkets.reduce((sum,row)=>sum+row.marketShare,0)/activeMarkets.length:0,4),
   lostDemand:round(activeMarkets.reduce((sum,row)=>sum+row.lostDemand,0))
  }),
  operations:Object.freeze({
   pendingProjects:projects.length,
   pendingActions:actions.length,
   projectTypes:Object.freeze(projects.map(row=>text(row.actionType||row.projectType||row.type))),
   actionTypes:Object.freeze(actions.map(row=>text(row.actionType))),
   turnaroundStatus:text(company?.turnaroundPlan?.status||''),
   turnaroundTargetWeek:company?.turnaroundPlan?.targetEndWeek==null?null:Math.floor(finite(company.turnaroundPlan.targetEndWeek))
  }),
  counter:Object.freeze({
   strength:round(clamp(finite(counter?.strength,company?.strength),0,140)),
   aggression:round(clamp(finite(counter?.aggression,company?.aggression),0,1),4),
   brandPower:round(clamp(finite(counter?.brandPower,company?.brandPower),0,140)),
   pricePressure:round(clamp(finite(counter?.pricePressure,company?.pricePressure),0,8)),
   lastActionWeek:Math.max(0,Math.floor(finite(counter?.lastActionWeek,company?.lastActionWeek)))
  }),
  history:Object.freeze(Object.fromEntries(HISTORY_WINDOWS.map(weeks=>[String(weeks),windowSummary(rows,weeks)]))),
  latestEvent:text(list(state?.competitorEvents).filter(row=>row?.competitorID===companyID).slice(-1)[0]?.text||''),
  riskScore:0
 };
 view.riskScore=riskScore(company,counter,markets,credit);
 return Object.freeze(view);
}
function buildDashboard(state,options={}){
 const counters=counterMap(state);
 const businessID=options.businessID?text(options.businessID):'';
 const statuses=new Set(list(options.statuses).map(text));
 const rows=list(state?.competitorStates)
  .filter(company=>company&&company.competitorID&&company.businessID)
  .filter(company=>!businessID||company.businessID===businessID)
  .filter(company=>!statuses.size||statuses.has(text(company.lifecycleStatus||company.status)))
  .map(company=>companyView(state,company,counters));
 rows.sort((a,b)=>b.riskScore-a.riskScore||b.marketSummary.averageShare-a.marketSummary.averageShare||a.name.localeCompare(b.name)||a.competitorID.localeCompare(b.competitorID));
 return Object.freeze({
  generatedWeek:Math.max(0,Math.floor(finite(state?.week))),
  total:rows.length,
  highRisk:rows.filter(row=>row.riskScore>=60).length,
  distressed:rows.filter(row=>['distressed','turnaround','bankrupt'].includes(row.status)).length,
  activeMarkets:rows.reduce((sum,row)=>sum+row.marketSummary.active,0),
  rows:Object.freeze(rows)
 });
}
function buildDetail(state,competitorID){return buildDashboard(state).rows.find(row=>row.competitorID===text(competitorID))||null;}

competitor.dashboard=Object.freeze({HISTORY_WINDOWS,STATUS_META,windowSummary,buildDashboard,buildDetail});
})();
