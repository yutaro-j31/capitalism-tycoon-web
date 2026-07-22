// Phase 8D-29: read-only management guide for first-time capital allocation recovery decisions.
(function install(attempt){
'use strict';attempt=Number.isFinite(Number(attempt))?Number(attempt):0;
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-management-guide.js.');
if(!modules.capitalAllocationRecoveryFundingOptions?.matrix||!modules.capitalAllocationRecoveryFundingReconciliation?.reconcile||!modules.capitalAllocationRecoveryFundingOutcome?.report){
 if(typeof document!=='undefined'&&attempt<50){setTimeout(()=>install(attempt+1),0);return;}
 throw new Error('capital allocation recovery funding option, reconciliation, and outcome modules must load before management guide.');
}
if(modules.capitalAllocationManagementGuide)throw new Error('capital allocation management guide module is already registered.');
const EngineClass=modules.engine.TycoonEngine,options=modules.capitalAllocationRecoveryFundingOptions,reconciliation=modules.capitalAllocationRecoveryFundingReconciliation,outcome=modules.capitalAllocationRecoveryFundingOutcome;
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
function action(id,title,reason,check,focus){return Object.freeze({id,title,reason,check,focus});}
function selectedTarget(instance){return reconciliation.targetFor?.(instance)??options.selectedTarget?.(instance)??70;}
function cooldownAction(instance){
 const memo=typeof instance?.capitalAllocationDecisionMemo==='function'?instance.capitalAllocationDecisionMemo():null;
 if(memo&&memo.recommendedPolicy&&memo.recommendedPolicy!==memo.currentPolicy&&finite(memo.weeksUntilSwitch)>0)return action('policyCooldown','方針変更クールダウンの残り週を確認する',`推奨方針は「${memo.recommendedPolicyName||memo.recommendedPolicy}」ですが、変更可能まであと${Math.ceil(finite(memo.weeksUntilSwitch))}週あります。自動方針変更は行いません。`,'「取締役会・資本配分メモ」の方針変更欄と「資本配分方針」カードを確認してください。','[data-capital-allocation-decision-memo]');
 return null;
}
function recommendation(instance){
 if(!instance?.g?.configured||!instance.g.publicCompany)return action('notPublic','上場後に資本配分ガイドを確認する','高度な資本配分・回復資金機能は上場会社向けです。','IPO後、市場画面の資本配分カードを確認してください。','[data-capital-allocation-policy-ui]');
 const fixed=reconciliation.pinned(instance),target=selectedTarget(instance),currentScore=modules.capitalAllocationScore?.scoreMetrics?.(modules.capitalAllocationScore?.metrics?.(instance));
 if(fixed){
  const recon=reconciliation.reconcile(instance,fixed),result=outcome.report(instance,fixed);
  if(result.targetReached&&result.verified)return action('targetReached','回復目標の同期証跡を確認する',`目標${result.targetScore}点に対し現在${result.actualScore}点で、固定計画の会計証跡も検証済みです。`,'「回復資金・結果検証」と「回復資金・実行後照合」の証跡を確認してください。','[data-capital-allocation-recovery-funding-outcome]');
  if(recon.status==='inProgress')return action('partiallyExecuted','残りの手動手順と会計差異を確認する',`固定計画の${recon.completedCount}/${recon.totalSteps}手順が完了または一部進行しています。途中状態のため自動売却・自動借入は行いません。`,'「回復資金・実行後照合」の未完了手順と会計証跡を確認してください。','[data-capital-allocation-recovery-funding-reconciliation]');
  return action('planPinned','固定した計画の最初の手動手順を実行する',`目標${fixed.targetScore}点の「${fixed.optionName||fixed.optionId}」案が固定中です。週を進める前に、計画と現在状態が一致しているか確認してください。`,'「回復資金・実行後照合」の手順一覧を確認してください。','[data-capital-allocation-recovery-funding-reconciliation]');
 }
 const cooldown=cooldownAction(instance);if(cooldown)return cooldown;
 if(Number.isFinite(currentScore)&&currentScore>=target)return action('targetAlreadyReached',`目標${target}点は到達済みのため証跡を固定する`,`現在の資本配分スコアは${Math.round(currentScore)}点で目標以上です。固定計画なしでは会計証跡が残らないため、必要なら到達案を固定して確認してください。`,'「回復資金・実行後照合」で到達案を固定し、「結果検証」を確認してください。','[data-capital-allocation-recovery-funding-reconciliation]');
 const matrix=options.matrix(instance,target),ready=reconciliation.candidates(instance,target).filter(row=>row.ready);
 if(!matrix.reachableCount)return action('noReachablePlan','回復目標を下げるか資本構成を先に改善する',`目標${target}点に到達する資金案がありません。現在の資産売却余力・借入余力では目標に届きません。`,'「回復資金・代替案比較」と「実行準備」で未達理由を確認してください。','[data-capital-allocation-recovery-funding-options]');
 if(ready.length)return action('executablePlan','実行可能案を1つ選び、計画を固定する',`目標${target}点に到達する案が${matrix.reachableCount}件あり、固定可能な案が${ready.length}件あります。固定してから手動で売却・借入を進めると照合できます。`,'「回復資金・実行後照合」の「この案を固定」ボタンを確認してください。','[data-capital-allocation-recovery-funding-reconciliation]');
 return action('selectTarget','回復目標を選び、代替案を比較する','固定可能な案を判断する前に、50/60/70/80点の目標ごとの必要資金を比較してください。','「回復資金・実行後照合」の回復目標ボタンと「代替案比較」を確認してください。','[data-capital-allocation-recovery-funding-reconciliation]');
}
EngineClass.prototype.capitalAllocationManagementGuide=function(){return recommendation(this);};
function render(instance=modules.playerEngineBridge?.getEngine?.()){
 if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';
 const rec=recommendation(instance),key=`${rec.id}:${rec.title}:${rec.reason}:${rec.check}:${rec.focus}`;
 return `<section class="card" data-capital-allocation-management-guide="1" data-capital-allocation-management-guide-key="${esc(key)}" aria-labelledby="capital-allocation-management-guide-title"><div class="card-head"><div><h2 id="capital-allocation-management-guide-title">経営判断ガイド</h2><p>高度な資本配分・回復資金機能で次に確認する1件だけを表示します。読み取り専用で、保存・会計・乱数・ゲーム進行は変更しません。</p></div><span class="badge warn">Phase 8D-29 · Guidance</span></div><div class="card-body"><div class="stat" role="note" aria-label="次の推奨行動"><span>次の推奨行動</span><strong>${esc(rec.title)}</strong><small><strong>理由：</strong>${esc(rec.reason)}</small><small><strong>確認先：</strong>${esc(rec.check)}</small></div><div class="button-row"><button class="btn small" type="button" data-capital-allocation-guide-focus="${esc(rec.focus)}">確認先へ移動</button></div></div></section>`;
}
let observer=null,scheduled=false;
function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-capital-allocation-management-guide]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-capital-allocation-management-guide-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-capital-allocation-management-guide-key')||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}const host=screen.querySelector?.('[data-capital-allocation-policy-ui]')||screen.querySelector?.('[data-shareholder-returns-ui]');if(host){host.insertAdjacentHTML?.('afterend',html);return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
function installUI(){if(typeof document==='undefined')return;document.addEventListener?.('click',event=>{const button=event.target?.closest?.('[data-capital-allocation-guide-focus]');if(!button)return;const selector=button.dataset.capitalAllocationGuideFocus,target=selector&&document.querySelector?.(selector);if(target){target.setAttribute?.('tabindex',target.getAttribute?.('tabindex')||'-1');target.scrollIntoView?.({block:'start',behavior:'smooth'});target.focus?.({preventScroll:true});}});const root=document.getElementById('app');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
modules.capitalAllocationManagementGuide=Object.freeze({selectedTarget,cooldownAction,recommendation,render,enhance,installUI,__installed:true});installUI();
})(0);
