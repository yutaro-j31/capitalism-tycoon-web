// Script boundary: js/ceo-dashboard.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before ceo-dashboard.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.ceoDashboard)throw new Error('Capitalism Tycoon ceoDashboard module is already registered.');
(function(exports){
const nf=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const arr=v=>Array.isArray(v)?v:[];
const ratio=(v,max)=>max>0?Math.max(0,Math.min(1,nf(v)/max)):0;
const pct=v=>`${Math.round(Math.max(0,Math.min(1,nf(v)))*100)}%`;
const openStores=g=>arr(g?.stores).filter(s=>s&&s.status==='open');
function companyJourney(g,helpers={}){const defs=arr(helpers.missions),done=new Set(arr(g?.completedMissionIDs)),active=new Set(arr(g?.activeMissionIDs));const total=defs.length||Math.max(1,done.size+active.size);const completed=defs.length?defs.filter(m=>done.has(m.id)).length:done.size;const next=defs.find(m=>active.has(m.id)&&!done.has(m.id))||defs.find(m=>!done.has(m.id))||null;return Object.freeze({completed,total,rate:ratio(completed,total),rateLabel:pct(ratio(completed,total)),nextGoal:next?.title||'自由成長フェーズ',remaining:Math.max(0,total-completed)});}
function financialSummary(g,helpers={}){const r=g?.lastReport||{},snap=arr(g?.finance?.weeklySnapshots).slice().sort((a,b)=>nf(b.week)-nf(a.week))[0]||{};const sales=nf(r.sales,nf(snap.revenue)),operatingProfit=nf(r.operatingProfit,nf(r.profit,nf(snap.operatingProfit))),netIncome=nf(r.netIncome,nf(r.profit,nf(snap.netIncome))),cash=nf(g?.companyCash),fcf=nf(snap.freeCashFlow,nf(r.cashFlow,nf(r.profit))),equity=Math.max(1,nf(g?.finance?.balances?.equity,nf(helpers.companyValue)-nf(g?.companyDebt)));const invested=Math.max(1,equity+nf(g?.companyDebt)-cash);return Object.freeze({sales,operatingProfit,netIncome,cash,fcf,roe:netIncome/equity,roic:operatingProfit/invested});}
function capitalAllocation(g,helpers={}){const score=nf(g?.finance?.capitalAllocationPolicy?.executionScore,nf(helpers.capitalScore));return Object.freeze({score,dividend:nf(g?.dividendPerShare)*Math.max(0,nf(g?.sharesOut)-nf(g?.treasuryBuybackShares)),buyback:nf(g?.finance?.balances?.treasuryStock),investment:arr(g?.productVentures).filter(x=>x&&x.status==='developing').length+arr(g?.startups).filter(x=>nf(x?.ownedCompany)>0).length,debtRepayment:arr(g?.finance?.loans).filter(l=>l&&l.status==='active').reduce((a,l)=>a+nf(l.scheduledPrincipalPayment,nf(l.weeklyPrincipalPayment)),0)});}
function risks(g,helpers={}){const week=nf(g?.week,1),cash=nf(g?.companyCash),profit=nf(g?.lastReport?.profit),rows=[];const add=(id,label,detail,sev)=>rows.push({id,label,detail,severity:sev});if(cash<0)add('cash-short','資金ショート','会社現金がマイナスです。',0);else if(cash<Math.max(1000000,Math.abs(profit)*4))add('cash-runway','資金ショート予兆','現金余力が薄い状態です。',1);const loan=arr(g?.finance?.loans).filter(l=>l&&l.status==='active').map(l=>({l,due:nf(l.nextPaymentWeek||l.maturityWeek||l.dueWeek,Infinity)-week})).sort((a,b)=>a.due-b.due)[0];if(loan&&loan.due<=4)add('debt-due','借入期限',`返済・満期まであと${Math.max(0,loan.due)}週です。`,loan.due<=1?0:1);if(profit<0)add('loss','赤字','直近期が赤字です。',1);if(nf(g?.employeeSatisfaction,100)<40||nf(g?.overtimeRisk)>0.65)add('workforce','従業員','満足度または疲労が悪化しています。',2);const stock=openStores(g).find(s=>nf(s.inventory)<Math.max(1,nf(s.weeklyDemand))*0.5||nf(s.stockoutWeeks)>0);if(stock)add('inventory','在庫',`${stock.name||'店舗'}の在庫不足リスクがあります。`,2);return Object.freeze(rows.sort((a,b)=>a.severity-b.severity||a.id.localeCompare(b.id,'en')));}
function growth(g,helpers={}){const rows=[];if(openStores(g).length>=1&&nf(g?.companyCash)>10000000)rows.push({id:'store',label:'新店舗候補',targetTab:'map'});if(!g?.publicCompany&&arr(helpers.ipoMissingReasons).length===0)rows.push({id:'ipo',label:'IPO条件',targetTab:'office'});if(arr(g?.acquisitionTargets).length)rows.push({id:'ma',label:'M&A候補',targetTab:'ma'});if(arr(g?.productVentures).some(p=>p&&p.status!=='released'))rows.push({id:'product',label:'商品開発',targetTab:'business'});if(arr(g?.overseasSubsidiaries).length||g?.departments?.overseas)rows.push({id:'overseas',label:'海外展開',targetTab:'overseas'});return Object.freeze(rows);}

function deltaLabel(v,formatter){const n=nf(v);const sign=n>0?'+':n<0?'−':'';const abs=Math.abs(n);return `${sign}${formatter?formatter(abs):Math.round(abs).toLocaleString('ja-JP')}`;}
function latestTwoReports(g){return arr(g?.reports).filter(r=>r&&Number.isFinite(Number(r.week))).slice().sort((a,b)=>nf(b.week)-nf(a.week)).slice(0,2);}
function weeklyImpact(g,helpers={}){
  const reports=latestTwoReports(g),latest=reports[0]||g?.lastReport||{},previous=reports[1]||{};
  const week=nf(latest.week,nf(g?.week,1));
  const valueHistory=arr(g?.companyValueHistory),cash=nf(g?.companyCash),prevCash=Number.isFinite(Number(previous.companyCash))?nf(previous.companyCash):null;
  const companyValue=Number.isFinite(Number(latest.companyValue))?nf(latest.companyValue):nf(helpers.companyValue);
  const prevValue=Number.isFinite(Number(previous.companyValue))?nf(previous.companyValue):(valueHistory.length>1?nf(valueHistory[valueHistory.length-2]):null);
  const metrics=[
    {id:'sales',label:'売上',value:nf(latest.sales),delta:nf(latest.sales)-nf(previous.sales),tone:nf(latest.sales)-nf(previous.sales)>=0?'good':'warn'},
    {id:'profit',label:'利益',value:nf(latest.profit,nf(latest.netIncome)),delta:nf(latest.profit,nf(latest.netIncome))-nf(previous.profit,nf(previous.netIncome)),tone:nf(latest.profit,nf(latest.netIncome))-nf(previous.profit,nf(previous.netIncome))>=0?'good':'danger'},
    {id:'cash',label:'会社現金',value:cash,delta:prevCash===null?0:cash-prevCash,tone:prevCash===null||cash-prevCash>=0?'good':'warn'},
    {id:'value',label:'企業価値',value:companyValue,delta:prevValue===null?0:companyValue-prevValue,tone:prevValue===null||companyValue-prevValue>=0?'good':'warn'}
  ];
  const highlights=[];
  for(const m of metrics){if(m.delta!==0)highlights.push({id:m.id,label:m.label,delta:m.delta,tone:m.tone});}
  const news=arr(g?.news).slice(0,4);
  return Object.freeze({week,metrics:Object.freeze(metrics.map(Object.freeze)),highlights:Object.freeze(highlights.slice(0,4).map(Object.freeze)),news:Object.freeze(news),hasPrevious:reports.length>1});
}

function build(g,helpers={}){const stores=openStores(g);return Object.freeze({overview:Object.freeze({companyName:g?.companyName||'会社',years:Math.max(0,Math.floor((nf(g?.week,1)-1)/52)),cash:nf(g?.companyCash),companyValue:nf(helpers.companyValue),debt:nf(g?.companyDebt),stores:stores.length,employees:nf(g?.employeeCount,arr(g?.workforceTeams).reduce((a,t)=>a+nf(t?.headcount),0)),credit:nf(g?.companyCredit),ipo:g?.publicCompany?`上場 ${g?.ticker||''}`:'未上場'}),journey:companyJourney(g,helpers),finance:financialSummary(g,helpers),allocation:capitalAllocation(g,helpers),risks:risks(g,helpers),growth:growth(g,helpers)});}
exports.build=build;exports.companyJourney=companyJourney;exports.financialSummary=financialSummary;exports.capitalAllocation=capitalAllocation;exports.risks=risks;exports.growth=growth;exports.weeklyImpact=weeklyImpact;exports.deltaLabel=deltaLabel;
})(__modules.ceoDashboard={});
})();
