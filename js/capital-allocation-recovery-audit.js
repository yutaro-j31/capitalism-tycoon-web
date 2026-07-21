// Phase 8D-11/12: deterministic, read-only audit and milestone frontier of resilience recovery progress.
(function install(attempt){
'use strict';
attempt=Number.isFinite(Number(attempt))?Number(attempt):0;
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-recovery-audit.js.');
if(!modules.capitalAllocationResilienceMemo?.recoveryPlan){
 if(typeof document!=='undefined'&&attempt<50){setTimeout(()=>install(attempt+1),0);return;}
 throw new Error('capital allocation resilience memo must load before capital-allocation-recovery-audit.js.');
}
if(modules.capitalAllocationRecoveryAudit)throw new Error('capital allocation recovery audit module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const resilience=modules.capitalAllocationResilienceMemo;
const DEFAULT_AUDIT_TARGETS=Object.freeze([50,60,70,80]);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const compactYen=modules.engine.compactYen||modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
function renderKey(value){let hash=2166136261;const text=String(value||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function wholeCash(value){return Number.isFinite(Number(value))?Math.max(0,Math.ceil(Number(value))):null;}
function normalizeTargets(targets=DEFAULT_AUDIT_TARGETS){
 if(typeof resilience.normalizeRecoveryTargets==='function')return resilience.normalizeRecoveryTargets(targets);
 const source=Array.isArray(targets)?targets:DEFAULT_AUDIT_TARGETS;
 const values=[...new Set(source.map(value=>Math.round(clamp(value,0,100))))].sort((a,b)=>a-b).slice(0,8);
 return values.length?values:[...DEFAULT_AUDIT_TARGETS];
}
function auditFromPlan(plan){
 const source=plan&&typeof plan==='object'?plan:{};
 const targetScore=Math.round(clamp(source.targetScore,0,100));
 const currentPolicy=String(source.currentPolicy||'balanced');
 const rows=Array.isArray(source.rows)?source.rows:[];
 const current=rows.find(row=>row?.id===currentPolicy)||null;
 const eventual=source.eventual&&typeof source.eventual==='object'?source.eventual:null;
 const currentScore=Math.round(clamp(current?.baseScore,0,100));
 const projectedScore=Math.round(clamp(current?.projectedScore,currentScore,100));
 const scoreGap=Math.max(0,targetScore-currentScore);
 const currentReachable=Boolean(current?.reachable);
 const currentRequiredCash=currentReachable?wholeCash(current?.requiredAdditionalCash):null;
 const eventualRequiredCash=eventual?.reachable?wholeCash(eventual.requiredAdditionalCash):null;
 const policyAligned=Boolean(eventual&&eventual.id===currentPolicy);
 const cashSavings=Number.isFinite(currentRequiredCash)&&Number.isFinite(eventualRequiredCash)?Math.max(0,currentRequiredCash-eventualRequiredCash):null;
 let id='monitor',tone='warn',statusLabel='要監視',nextAction='四半期ごとに複合悪化スコアを再確認します。';
 if(!current){id='unavailable';tone='bad';statusLabel='監査不能';nextAction='現行方針の評価行を再生成します。';}
 else if(currentScore>=targetScore){id='achieved';tone='good';statusLabel='目標達成';nextAction='現在の耐性を維持します。';}
 else if(eventual&&eventual.id!==currentPolicy){
  if(eventual.switchAllowed){id='switchReady';tone='warn';statusLabel='方針変更可能';nextAction=`最少現金の回復方針「${eventual.name||eventual.id}」へ変更します。`;}
  else{id='waitCooldown';tone='warn';statusLabel='変更待機';nextAction=`あと${Math.max(0,Math.floor(finite(eventual.weeksUntilSwitch)))}週後に「${eventual.name||eventual.id}」へ変更します。`;}
 }
 else if(!currentReachable){id='structuralRepair';tone='bad';statusLabel='構造改善が必要';nextAction='売上基盤、負債、投資配分を改善します。';}
 else if((currentRequiredCash??0)>0){id='buildLiquidity';tone='warn';statusLabel='現金積み増し';nextAction=`追加現金${compactYen(currentRequiredCash)}を確保します。`;}
 return{
  targetScore,
  currentPolicy,
  currentPolicyName:String(source.currentPolicyName||current?.name||''),
  currentScore,
  projectedScore,
  scoreGap,
  currentReachable,
  currentRequiredCash,
  eventualPolicy:eventual?.id??null,
  eventualPolicyName:eventual?.name??'',
  eventualRequiredCash,
  policyAligned,
  cashSavings,
  weeksUntilSwitch:eventual?.weeksUntilSwitch??0,
  earliestExecutionWeek:eventual?.earliestExecutionWeek??source.week??null,
  id,tone,statusLabel,nextAction
 };
}
function audit(instance,targetScore=70){
 const plan=resilience.recoveryPlan(instance,targetScore);
 const result=auditFromPlan(plan);
 const state=instance?.g||instance||{};
 const week=Math.max(1,Math.floor(finite(state.week,plan.week)));
 const changed=finite(state.finance?.capitalAllocationPolicy?.lastChangedWeek,NaN);
 const lastPolicyChangeWeek=Number.isFinite(changed)&&changed>=1?Math.floor(changed):null;
 return{...result,week,lastPolicyChangeWeek,weeksSincePolicyChange:lastPolicyChangeWeek===null?null:Math.max(0,week-lastPolicyChangeWeek)};
}
function frontierFromAudits(audits,targets){
 const normalized=normalizeTargets(targets);
 const source=Array.isArray(audits)?audits:[];
 const rows=normalized.map((targetScore,index)=>{
  const value=source[index]&&typeof source[index]==='object'?source[index]:{targetScore,currentScore:0,currentReachable:false,currentRequiredCash:null,id:'unavailable',statusLabel:'監査不能'};
  return{...value,targetScore,marginalAdditionalCash:null};
 });
 let previousRequired=0;
 for(const row of rows){
  if(Number.isFinite(row.currentRequiredCash)){
   row.marginalAdditionalCash=Math.max(0,row.currentRequiredCash-previousRequired);
   previousRequired=row.currentRequiredCash;
  }
 }
 const currentScore=rows[0]?.currentScore??0;
 const highestAchieved=rows.filter(row=>row.currentScore>=row.targetScore).at(-1)||null;
 const nextTarget=rows.find(row=>row.targetScore>currentScore&&row.currentReachable)||null;
 const maximumReachable=rows.filter(row=>row.currentReachable).at(-1)||null;
 return{
  week:rows[0]?.week??null,
  currentPolicy:rows[0]?.currentPolicy??'balanced',
  currentPolicyName:rows[0]?.currentPolicyName??'',
  currentScore,
  targets:normalized,
  highestAchievedTarget:highestAchieved?.targetScore??null,
  nextTarget,
  maximumReachableTarget:maximumReachable?.targetScore??null,
  rows
 };
}
function frontier(instance,targets=DEFAULT_AUDIT_TARGETS){
 const normalized=normalizeTargets(targets);
 return frontierFromAudits(normalized.map(target=>audit(instance,target)),normalized);
}
function frontierSummary(value){
 const source=value&&typeof value==='object'?value:{};
 const topTarget=Array.isArray(source.targets)&&source.targets.length?source.targets.at(-1):null;
 if(source.nextTarget)return `${source.nextTarget.targetScore}点・必要現金 ${compactYen(source.nextTarget.currentRequiredCash??0)}`;
 if(topTarget!==null&&finite(source.currentScore)>=topTarget)return `${topTarget}点以上を達成`;
 if(source.maximumReachableTarget!==null&&finite(source.currentScore)>=source.maximumReachableTarget)return `${source.maximumReachableTarget}点まで達成・上位目標は構造改善が必要`;
 return '現行方針の現金積み増しだけでは上位目標へ到達不能';
}
EngineClass.prototype.capitalAllocationRecoveryAudit=function(targetScore=70){return audit(this,targetScore);};
EngineClass.prototype.capitalAllocationRecoveryAuditFrontier=function(targets=DEFAULT_AUDIT_TARGETS){return frontier(this,targets);};
function render(instance=modules.playerEngineBridge?.getEngine?.()){
 if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';
 const value=audit(instance,70),milestones=frontier(instance);
 const cashText=value.currentRequiredCash===null?'現金のみでは到達不能':value.currentRequiredCash>0?compactYen(value.currentRequiredCash):'追加現金0円';
 const savingText=value.cashSavings===null?'比較不能':value.cashSavings>0?compactYen(value.cashSavings):'差額なし';
 const changedText=value.weeksSincePolicyChange===null?'記録なし':`${value.weeksSincePolicyChange}週経過`;
 const milestoneRows=milestones.rows.map(row=>{
  const amount=row.currentScore>=row.targetScore?'達成済み':row.currentRequiredCash===null?'到達不能':row.currentRequiredCash>0?compactYen(row.currentRequiredCash):'追加現金0円';
  const marginal=row.currentScore>=row.targetScore?'現在の耐性内':row.marginalAdditionalCash===null?'構造改善が必要':row.marginalAdditionalCash>0?`前段階から +${compactYen(row.marginalAdditionalCash)}`:'前段階と同額';
  return `<div class="stat"><span>目標 ${row.targetScore}点</span><strong>${esc(amount)}</strong><small>${esc(marginal)}</small></div>`;
 }).join('');
 const nextText=frontierSummary(milestones);
 const key=renderKey(`${value.week}|${value.targetScore}|${value.currentPolicy}|${value.currentScore}|${value.projectedScore}|${value.currentRequiredCash}|${value.eventualPolicy}|${value.cashSavings}|${value.id}|${value.weeksUntilSwitch}|${milestones.rows.map(row=>`${row.targetScore}:${row.currentRequiredCash}:${row.marginalAdditionalCash}:${row.id}`).join('|')}`);
 return `<section class="card" data-capital-allocation-recovery-audit="1" data-capital-allocation-recovery-audit-render-key="${key}"><div class="card-head"><div><h2>取締役会・回復進捗監査</h2><p>現行方針が複合悪化後の耐性目標へどこまで近づいているかを確認します。</p></div><span class="badge ${value.tone}">Phase 8D-12 · ${esc(value.statusLabel)}</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>現在スコア</span><strong>${value.currentScore}点</strong><small>目標 ${value.targetScore}点・差 ${value.scoreGap}点</small></div><div class="stat"><span>現行方針</span><strong>${esc(value.currentPolicyName||value.currentPolicy)}</strong><small>${value.policyAligned?'最少現金方針と一致':'最少現金方針と不一致'}</small></div><div class="stat"><span>必要追加現金</span><strong>${esc(cashText)}</strong><small>確保後 ${value.projectedScore}点</small></div><div class="stat"><span>最終案との差</span><strong>${esc(savingText)}</strong></div><div class="stat"><span>前回方針変更</span><strong>${esc(changedText)}</strong></div></div><p><strong>次の行動：</strong>${esc(value.nextAction)}</p><div data-capital-allocation-recovery-audit-frontier="1"><h3>現行方針の回復マイルストーン</h3><div class="kpi-grid mini">${milestoneRows}</div><p><strong>次の到達目標：</strong>${esc(nextText)}</p></div></div></section>`;
}
let observer=null,scheduled=false;
function enhance(){
 if(typeof document==='undefined')return false;
 const screen=document.getElementById('screen');if(!screen)return false;
 const old=screen.querySelector?.('[data-capital-allocation-recovery-audit]'),html=render();
 if(!html){old?.remove?.();return false;}
 const desired=(html.match(/data-capital-allocation-recovery-audit-render-key="([^"]+)"/)||[])[1]||'';
 const current=String(old?.getAttribute?.('data-capital-allocation-recovery-audit-render-key')||'');
 if(old&&current===desired)return false;
 if(old){old.outerHTML=html;return true;}
 const memo=screen.querySelector?.('[data-capital-allocation-resilience-memo]');
 if(memo){memo.insertAdjacentHTML?.('afterend',html);return true;}
 screen.insertAdjacentHTML?.('beforeend',html);return true;
}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
modules.capitalAllocationRecoveryAudit=Object.freeze({DEFAULT_AUDIT_TARGETS,wholeCash,normalizeTargets,auditFromPlan,audit,frontierFromAudits,frontier,frontierSummary,renderKey,render,enhance,installUI,__installed:true});
installUI();
})(0);
