// Phase 6A-5C: turnaround-plan weekly summaries, alerts, and news integration.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-turnaround-plan-report.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-turnaround-plan-report.js.');
if(!modules.playerEngineBridge?.__installed)throw new Error('player-engine-bridge.js must be loaded before player-turnaround-plan-report.js.');
if(!modules.playerTurnaroundPlan?.__installed)throw new Error('player-turnaround-plan.js must be loaded before player-turnaround-plan-report.js.');
if(!modules.playerTurnaroundPlanUI?.__installed)throw new Error('player-turnaround-plan-ui.js must be loaded before player-turnaround-plan-report.js.');
if(modules.playerTurnaroundPlanReport)throw new Error('player turnaround plan report module is already registered.');
const EngineClass=modules.engine.TycoonEngine,compactYen=modules.engine.compactYen||((v)=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const clamp=v=>Math.max(0,Math.min(1,finite(v)));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const REPORT_KINDS=Object.freeze(['progress','deadline','completed','failed']);
const KIND_LABELS=Object.freeze({progress:'進捗',deadline:'期限接近',completed:'達成',failed:'未達'});
let activeEngine=null,enhancerRegistered=false;
function capture(state){const plan=state?.playerTurnaroundPlan||{};return Object.freeze({status:String(plan.status||'inactive'),planID:String(plan.planID||''),week:integer(state?.week),historyLength:Array.isArray(plan.history)?plan.history.length:0});}
function buildReport(state,before){
 if(!state||before?.status!=='active')return null;
 const plan=state.playerTurnaroundPlan||{};
 if(String(plan.planID||'')!==String(before.planID||''))return null;
 const status=String(plan.status||'inactive');
 if(!['active','completed','failed'].includes(status))return null;
 const metrics=modules.playerTurnaroundPlan.metrics(state,plan);
 const kind=status==='completed'?'completed':status==='failed'?'failed':metrics.weeksRemaining<=2?'deadline':'progress';
 const report={reportID:`turnaround-report-${integer(state.week)}-${String(plan.planID||'')}-${kind}`,week:integer(state.week),planID:String(plan.planID||''),kind,status,progress:clamp(metrics.progress),cashProgress:clamp(metrics.cashProgress),debtProgress:clamp(metrics.debtProgress),weeksRemaining:integer(metrics.weeksRemaining),deadlineWeek:integer(plan.deadlineWeek),cash:finite(metrics.cash),debt:Math.max(0,finite(metrics.debt)),targetCash:Math.max(0,finite(plan.targetCash)),targetDebt:Math.max(0,finite(plan.targetDebt))};
 return Object.freeze(report);
}
function message(report){
 const pct=Math.round(clamp(report?.progress)*100),cash=`${compactYen(report?.cash)}／${compactYen(report?.targetCash)}`,debt=`${compactYen(report?.debt)}／${compactYen(report?.targetDebt)}`;
 if(report?.kind==='completed')return `第${integer(report.week)}週：再建計画を達成しました。総合進捗${pct}%、現金${cash}、負債${debt}。`;
 if(report?.kind==='failed')return `第${integer(report.week)}週：再建計画は期限内に目標未達となりました。総合進捗${pct}%、現金${cash}、負債${debt}。`;
 if(report?.kind==='deadline')return `第${integer(report.week)}週：再建計画の期限まで残り${integer(report.weeksRemaining)}週です。総合進捗${pct}%、現金${cash}、負債${debt}。`;
 return `第${integer(report?.week)}週：再建計画は総合進捗${pct}%、残り${integer(report?.weeksRemaining)}週です。現金${cash}、負債${debt}。`;
}
function alertText(report){return message(report).replace(/^第\d+週：/,'');}
function applyReport(state,report){
 if(!state||!report||!REPORT_KINDS.includes(report.kind))return false;
 const summary=state.lastWeeklySummary;
 if(!summary||integer(summary.week)!==integer(report.week))return false;
 if(summary.turnaroundPlanReport?.reportID===report.reportID)return false;
 summary.turnaroundPlanReport={...report};
 const line=message(report),summaryNews=Array.isArray(summary.newNews)?summary.newNews:[];
 summary.newNews=[line,...summaryNews.filter(x=>String(x)!==line)].slice(0,5);
 const historyLine=`第${integer(report.week)}週 再建計画 ${KIND_LABELS[report.kind]} 総合${Math.round(clamp(report.progress)*100)}% 残り${integer(report.weeksRemaining)}週`;
 state.history=[historyLine,...(Array.isArray(state.history)?state.history:[]).filter(x=>String(x)!==historyLine)].slice(0,500);
 if(report.kind!=='progress')state.news=[line,...(Array.isArray(state.news)?state.news:[]).filter(x=>String(x)!==line)].slice(0,300);
 return true;
}
function meter(label,value){const pct=Math.round(clamp(value)*100);return `<label>${esc(label)} ${pct}%<div class="progress"><i style="width:${pct}%"></i></div></label>`;}
function renderSummarySection(report){
 if(!report||!REPORT_KINDS.includes(report.kind))return '';
 const label=KIND_LABELS[report.kind]||report.kind,kind=report.kind==='completed'?'good':report.kind==='failed'||report.kind==='deadline'?'warn':'';
 return `<section class="learning-card turnaround-weekly-report" data-player-turnaround-weekly-report="${esc(report.reportID)}"><div class="card-head"><div><h3>再建計画レポート</h3><p>${esc(message(report))}</p></div><span class="badge ${kind}">${esc(label)}</span></div><div class="kpi-grid mini"><div class="stat"><span>現金</span><strong>${esc(compactYen(report.cash))}</strong><small>目標 ${esc(compactYen(report.targetCash))}</small></div><div class="stat"><span>負債</span><strong>${esc(compactYen(report.debt))}</strong><small>目標 ${esc(compactYen(report.targetDebt))}</small></div></div><div class="meters">${meter('現金改善',report.cashProgress)}${meter('債務削減',report.debtProgress)}${meter('総合進捗',report.progress)}</div><p class="muted">期限 第${integer(report.deadlineWeek)}週 · 残り${integer(report.weeksRemaining)}週</p></section>`;
}
function enhanceSummary(){
 if(typeof document==='undefined'||!activeEngine)return false;
 const modal=document.querySelector('#modal-root .summary-modal');if(!modal)return false;
 const report=activeEngine.g?.lastWeeklySummary?.turnaroundPlanReport;if(!report)return false;
 if(modal.querySelector?.('[data-player-turnaround-weekly-report]'))return false;
 const html=renderSummarySection(report),actions=modal.querySelector?.('.modal-actions');if(!html)return false;
 if(actions&&typeof actions.insertAdjacentHTML==='function')actions.insertAdjacentHTML('beforebegin',html);
 else if(typeof modal.insertAdjacentHTML==='function')modal.insertAdjacentHTML('beforeend',html);
 else modal.innerHTML=`${String(modal.innerHTML||'')}${html}`;
 return true;
}
function schedule(){return enhanceSummary();}
function connect(instance){if(!instance)return null;activeEngine=instance;modules.playerEngineBridge.bindEngine(instance);modules.playerCrisisCreditorUI?.bindEngine?.(instance);modules.playerTurnaroundPlanUI?.bindEngine?.(instance);schedule();return instance;}
function install(){const registry=modules.uiEnhancerRegistry;if(registry?.registerUIEnhancer&&!enhancerRegistered){enhancerRegistered=true;registry.registerUIEnhancer({id:'player-turnaround-plan-report',enhance:enhanceSummary});}return true;}
const baseAdvanceWeek=EngineClass.prototype.advanceWeek;
EngineClass.prototype.advanceWeek=function(showSummary=true){const before=capture(this.g),result=baseAdvanceWeek.call(this,showSummary);if(result===false)return result;const report=buildReport(this.g,before);if(report&&applyReport(this.g,report)){this.save();const severity=report.kind==='deadline'?'warning':report.kind==='completed'?'success':report.kind==='failed'?'error':null;if(severity)this.emit('notify',{message:alertText(report),severity});schedule();}return result;};
const baseLoad=EngineClass.load.bind(EngineClass);
EngineClass.load=function(...args){return connect(baseLoad(...args));};
EngineClass.prototype.__playerTurnaroundPlanReportInstalled=true;
install();connect(modules.playerEngineBridge.getEngine());
modules.playerTurnaroundPlanReport=Object.freeze({REPORT_KINDS,KIND_LABELS,capture,buildReport,message,alertText,applyReport,renderSummarySection,enhanceSummary,connect,__installed:true});
})();
