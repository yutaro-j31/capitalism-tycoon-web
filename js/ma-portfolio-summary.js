// Script boundary: js/ma-portfolio-summary.js (classic JavaScript)
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('Capitalism Tycoon runtime.js must be loaded before ma-portfolio-summary.js.');
var __modules=globalThis.__capitalismTycoonModules;
if(__modules.maPortfolioSummary)throw new Error('Capitalism Tycoon maPortfolioSummary module is already registered.');
(function(exports){
const arr=v=>Array.isArray(v)?v:[];
const nf=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const ACTIVE_DEALS=new Set(['screening','diligence','ready','offer_pending','countered','accepted']);
const TERMINAL_DEALS=new Set(['acquired','withdrawn','expired','lost','rejected']);
const PMI_ACTIVE=new Set(['planning','integrating','stalled']);
function riskFor(sub){const health=nf(sub?.pmiHealth,100),friction=nf(sub?.pmiFriction),status=sub?.pmiStatus||'completed';if(status==='stalled'||health<35||friction>=75)return 'critical';if(PMI_ACTIVE.has(status)&&(health<60||friction>=50))return 'watch';return 'stable';}
function nextAction(model){if(model.criticalSubsidiaries>0)return Object.freeze({id:'stabilize-pmi',label:'PMI立て直し',targetTab:'ma',priority:0});if(model.acceptedDeals>0)return Object.freeze({id:'close-deal',label:'最終契約',targetTab:'ma',priority:1});if(model.diligenceDeals>0)return Object.freeze({id:'complete-dd',label:'DD完了待ち',targetTab:'ma',priority:2});if(model.negotiatingDeals>0)return Object.freeze({id:'review-offer',label:'交渉条件確認',targetTab:'ma',priority:3});if(model.planningSubsidiaries>0)return Object.freeze({id:'start-pmi',label:'PMI戦略決定',targetTab:'ma',priority:4});if(model.activeDeals>0)return Object.freeze({id:'review-deals',label:'案件確認',targetTab:'ma',priority:5});return Object.freeze({id:'source-deals',label:'買収候補探索',targetTab:'ma',priority:6});}
function build(g){const deals=arr(g?.maDealRooms),subs=arr(g?.maSubsidiaries);const active=deals.filter(d=>ACTIVE_DEALS.has(d?.status)),terminal=deals.filter(d=>TERMINAL_DEALS.has(d?.status));const risks=subs.map(s=>riskFor(s));const model={activeDeals:active.length,terminalDeals:terminal.length,diligenceDeals:active.filter(d=>d.status==='diligence').length,negotiatingDeals:active.filter(d=>d.status==='offer_pending'||d.status==='countered').length,acceptedDeals:active.filter(d=>d.status==='accepted').length,subsidiaries:subs.length,planningSubsidiaries:subs.filter(s=>(s?.pmiStatus||'completed')==='planning').length,integratingSubsidiaries:subs.filter(s=>PMI_ACTIVE.has(s?.pmiStatus)&&s?.pmiStatus!=='planning').length,completedSubsidiaries:subs.filter(s=>(s?.pmiStatus||'completed')==='completed').length,criticalSubsidiaries:risks.filter(r=>r==='critical').length,watchSubsidiaries:risks.filter(r=>r==='watch').length,totalAcquisitionPrice:subs.reduce((a,s)=>a+nf(s?.acquisitionPrice),0),goodwillBookValue:subs.reduce((a,s)=>a+nf(s?.goodwillBookValue),0),weeklyRealizedSynergy:subs.reduce((a,s)=>a+nf(s?.weeklyRealizedSynergy,nf(s?.realizedWeeklySynergy)),0),portfolioHealth:subs.length?Math.round(subs.reduce((a,s)=>a+nf(s?.pmiHealth,100),0)/subs.length):100};model.nextAction=nextAction(model);return Object.freeze(model);}
exports.build=build;exports.riskFor=riskFor;exports.ACTIVE_DEALS=ACTIVE_DEALS;exports.TERMINAL_DEALS=TERMINAL_DEALS;
})(__modules.maPortfolioSummary={});
})();
