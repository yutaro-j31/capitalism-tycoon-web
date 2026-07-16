// Phase 6A-5B: mobile turnaround-plan controls and progress display.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before player-turnaround-plan-ui.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-turnaround-plan-ui.js.');
if(!modules.playerTurnaroundPlan?.__installed)throw new Error('player-turnaround-plan.js must be loaded before player-turnaround-plan-ui.js.');
if(!modules.playerCrisisCreditorUI?.__installed)throw new Error('player-crisis-creditor-ui.js must be loaded before player-turnaround-plan-ui.js.');
if(modules.playerTurnaroundPlanUI)throw new Error('player turnaround plan UI is already registered.');
const EngineClass=modules.engine.TycoonEngine,compactYen=modules.engine.compactYen||((v)=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`);
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const clamp=v=>Math.max(0,Math.min(1,finite(v)));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const STATUS_LABELS=Object.freeze({inactive:'未開始',active:'進行中',completed:'達成',failed:'未達',cancelled:'中止'});
const RESULT_KINDS=Object.freeze({completed:'good',failed:'warn',cancelled:''});
let activeEngine=null,observer=null,bound=false,scheduled=false;
function progress(label,value,sub){const pct=Math.round(clamp(value)*100);return `<label>${esc(label)} ${pct}%<div class="progress" aria-label="${esc(label)} ${pct}%"><i style="width:${pct}%"></i></div>${sub?`<small>${esc(sub)}</small>`:''}</label>`;}
function latestHistory(state){const rows=Array.isArray(state?.playerTurnaroundPlan?.history)?state.playerTurnaroundPlan.history:[];return rows.length?rows[rows.length-1]:null;}
function startPreview(state){const reserve=Math.max(0,finite(modules.playerCrisis.reserveThreshold(state))),debt=Math.max(0,finite(state.companyDebt));return Object.freeze({targetCash:reserve,targetDebt:debt*0.9});}
function renderSection(instance=activeEngine){
 if(!instance||typeof instance.turnaroundPlanSnapshot!=='function')return '';
 const state=instance.g,snapshot=instance.turnaroundPlanSnapshot(),plan=state?.playerTurnaroundPlan||{},active=snapshot.status==='active';
 const crisisStatus=String(state?.playerCrisis?.status||'stable'),eligible=modules.playerTurnaroundPlan.ELIGIBLE_STATUSES.includes(crisisStatus)&&!state.gameOver&&!state.isCompanySold;
 const latest=latestHistory(state),currentCash=finite(state.companyCash),currentDebt=Math.max(0,finite(state.companyDebt));
 if(active){
  const metrics=modules.playerTurnaroundPlan.metrics(state,plan),overall=Math.round(clamp(metrics.progress)*100);
  return `<details class="learning-card turnaround-plan-card" open data-player-turnaround-ui="1"><summary>再建計画 · 残り${integer(metrics.weeksRemaining)}週 · 総合${overall}%</summary><p>現金準備と有利子負債の両方を期限内に改善します。資産整理や固定費削減などの実行結果を自動追跡します。</p><div class="kpi-grid mini"><div class="stat"><span>現金目標</span><strong>${esc(compactYen(currentCash))}</strong><small>目標 ${esc(compactYen(plan.targetCash))}</small></div><div class="stat"><span>負債目標</span><strong>${esc(compactYen(currentDebt))}</strong><small>目標 ${esc(compactYen(plan.targetDebt))}</small></div></div><div class="meters">${progress('現金改善',metrics.cashProgress,`${compactYen(currentCash)} / ${compactYen(plan.targetCash)}`)}${progress('債務削減',metrics.debtProgress,`${compactYen(currentDebt)} / ${compactYen(plan.targetDebt)}`)}${progress('総合進捗',metrics.progress,`期限 第${integer(plan.deadlineWeek)}週`)}</div><div class="button-row"><button class="btn danger" data-player-turnaround-action="cancel">再建計画を中止</button></div></details>`;
 }
 const preview=startPreview(state),status=latest?.status||snapshot.status||'inactive',label=STATUS_LABELS[status]||status,kind=RESULT_KINDS[status]||'';
 const result=latest?`<div class="news-line">第${integer(latest.startedWeek)}週開始 → 第${integer(latest.endedWeek)}週 ${esc(label)} · 終了時現金 ${esc(compactYen(latest.endingCash))} · 終了時負債 ${esc(compactYen(latest.endingDebt))}</div>`:'<p>8週間で必要現金を確保し、開始時負債の10％削減を目指します。</p>';
 return `<details class="learning-card turnaround-plan-card" open data-player-turnaround-ui="1"><summary>再建計画 ${status!=='inactive'?`· <span class="badge ${kind}">${esc(label)}</span>`:''}</summary>${result}<div class="kpi-grid mini"><div class="stat"><span>次回の現金目標</span><strong>${esc(compactYen(preview.targetCash))}</strong><small>現在 ${esc(compactYen(currentCash))}</small></div><div class="stat"><span>次回の負債目標</span><strong>${esc(compactYen(preview.targetDebt))}</strong><small>現在 ${esc(compactYen(currentDebt))}</small></div></div><button class="btn primary" data-player-turnaround-action="start" ${eligible?'':'disabled'}>8週間の再建計画を開始</button>${eligible?'':`<p class="muted">現在の会社状態では新しい再建計画を開始できません。</p>`}</details>`;
}
function standalone(html){return `<section class="card player-turnaround-standalone" data-player-turnaround-standalone="1" aria-live="polite"><div class="card-head"><div><h2>再建計画</h2><p>危機状態が解除された後も、進行中の財務目標を継続表示します。</p></div><span class="badge good">継続中</span></div><div class="card-body">${html}</div></section>`;}
function enhance(){
 if(typeof document==='undefined'||!activeEngine)return false;
 const screen=document.getElementById('screen'),body=document.querySelector('#player-crisis-panel .card-body');
 screen?.querySelector?.('[data-player-turnaround-standalone]')?.remove?.();
 if(body){body.querySelector?.('[data-player-turnaround-ui]')?.remove?.();const html=renderSection(activeEngine);if(!html)return false;if(typeof body.insertAdjacentHTML==='function')body.insertAdjacentHTML('beforeend',html);else body.innerHTML=`${String(body.innerHTML||'')}${html}`;return true;}
 if(!screen||activeEngine.g?.playerTurnaroundPlan?.status!=='active')return false;
 const html=standalone(renderSection(activeEngine));if(typeof screen.insertAdjacentHTML==='function')screen.insertAdjacentHTML('afterbegin',html);else screen.innerHTML=`${html}${String(screen.innerHTML||'')}`;return true;
}
function schedule(){if(scheduled)return;scheduled=true;const run=()=>{scheduled=false;enhance();};if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);}
function bindEngine(instance){activeEngine=instance;schedule();return instance;}
function handleClick(event){const target=event?.target?.closest?.('[data-player-turnaround-action]');if(!target||target.disabled||!activeEngine)return false;event.preventDefault?.();event.stopPropagation?.();const action=String(target.dataset.playerTurnaroundAction||''),state=activeEngine.g;let result=false;
 if(action==='start'){
  const status=String(state?.playerCrisis?.status||'stable'),eligible=modules.playerTurnaroundPlan.ELIGIBLE_STATUSES.includes(status)&&state?.playerTurnaroundPlan?.status!=='active'&&!state.gameOver&&!state.isCompanySold;
  if(!eligible||typeof activeEngine.startTurnaroundPlan!=='function')return false;
  const preview=startPreview(state),message=`8週間の再建計画を開始します。現金目標は${compactYen(preview.targetCash)}、負債目標は${compactYen(preview.targetDebt)}です。計画は自動で資産売却や借入を実行しません。`;
  if(typeof globalThis.confirm!=='function'||!globalThis.confirm(message))return false;
  result=activeEngine.startTurnaroundPlan();
 }else if(action==='cancel'){
  if(state?.playerTurnaroundPlan?.status!=='active'||typeof activeEngine.cancelTurnaroundPlan!=='function')return false;
  const message='進行中の再建計画を中止します。現在の進捗は中止履歴として保存され、資金や負債は変更されません。';
  if(typeof globalThis.confirm!=='function'||!globalThis.confirm(message))return false;
  result=activeEngine.cancelTurnaroundPlan();
 }
 if(result)schedule();return Boolean(result);
}
function install(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!bound){root.addEventListener('click',handleClick);bound=true;}if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}}
const baseLoad=EngineClass.load.bind(EngineClass);EngineClass.load=function(...args){const instance=bindEngine(baseLoad(...args));install();return instance;};
install();modules.playerTurnaroundPlanUI=Object.freeze({renderSection,standalone,enhance,bindEngine,handleClick,startPreview,latestHistory,STATUS_LABELS,__installed:true});
})();
