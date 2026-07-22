// Phase 8D-19/20/27: read-only post-execution reconciliation and transient recovery target selection.
(function install(attempt){
'use strict';attempt=Number.isFinite(Number(attempt))?Number(attempt):0;
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-recovery-funding-reconciliation.js.');
if(!modules.capitalAllocationRecoveryFundingReadiness?.snapshot||!modules.capitalAllocationPolicy?.readStateFor||!modules.capitalAllocationRecoveryFundingOptions?.OPTION_ORDER){
 if(typeof document!=='undefined'&&attempt<50){setTimeout(()=>install(attempt+1),0);return;}
 throw new Error('funding readiness, funding options, and capital allocation policy must load before reconciliation.');
}
if(modules.capitalAllocationRecoveryFundingReconciliation)throw new Error('capital allocation recovery funding reconciliation module is already registered.');
const EngineClass=modules.engine.TycoonEngine,readiness=modules.capitalAllocationRecoveryFundingReadiness,policy=modules.capitalAllocationPolicy,OPTION_IDS=Object.freeze([...modules.capitalAllocationRecoveryFundingOptions.OPTION_ORDER]),TARGET_SCORES=Object.freeze([50,60,70,80]);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const compactYen=modules.engine.compactYen||modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
const pins=new WeakMap(),targets=new WeakMap();
function normalizeTarget(value){const rounded=Math.round(finite(value,70));return TARGET_SCORES.includes(rounded)?rounded:70;}
function targetFor(instance){return normalizeTarget(targets.get(instance));}
function setTarget(instance,value){const target=normalizeTarget(value);if(!instance||pins.has(instance))return false;targets.set(instance,target);return true;}
function moneyClose(actual,expected){const tolerance=Math.max(.5,Math.abs(finite(expected))*1e-9);return Math.abs(finite(actual)-finite(expected))<=tolerance;}
function statusLabel(status){return({pending:'未着手',partial:'一部完了',complete:'完了',diverged:'要確認',blocked:'実行不可'}[status]||status);}
function toneFor(status){return status==='complete'?'good':status==='diverged'||status==='blocked'?'bad':'warn';}
function currentPolicy(instance){return policy.readStateFor(instance).id;}
function sourceFor(snapshot,sourceId){return(snapshot?.sources||[]).find(row=>row.sourceId===sourceId)||null;}
function transactionId(row){return String(row?.transactionID||row?.id||'');}
function transactionsSince(instance,snapshot){
 const rows=Array.isArray(instance?.g?.finance?.transactions)?instance.g.finance.transactions:[],lastId=String(snapshot?.baselineLastTransactionId||''),count=Math.max(0,Math.floor(finite(snapshot?.baselineTransactionCount)));
 if(lastId){const index=rows.findIndex(row=>transactionId(row)===lastId);return index<0?{rows:[],missingBaseline:true}:{rows:rows.slice(index+1),missingBaseline:false};}
 if(count===0)return{rows:rows.slice(),missingBaseline:false};
 return rows.length<count?{rows:[],missingBaseline:true}:{rows:rows.slice(count),missingBaseline:false};
}
function matchesStep(step,row){
 const sourceType=String(row?.sourceType||''),sourceID=String(row?.sourceID||'');
 if(step.kind==='securities')return sourceType==='sellStock'&&sourceID.startsWith(`${step.sourceId}-`);
 if(step.kind==='properties')return sourceType==='sellProperty'&&sourceID===String(step.sourceId||'');
 if(step.kind==='borrowing')return sourceType==='borrow'&&String(row?.category||'')==='debtBorrowing';
 return false;
}
function evidenceForStep(transactions,step){const rows=(transactions||[]).filter(row=>matchesStep(step,row));return{count:rows.length,cashEffect:rows.reduce((sum,row)=>sum+finite(row.cashEffect),0),assetEffect:rows.reduce((sum,row)=>sum+finite(row.assetEffect),0),liabilityEffect:rows.reduce((sum,row)=>sum+finite(row.liabilityEffect),0),profitEffect:rows.reduce((sum,row)=>sum+finite(row.profitEffect),0),transactionIds:rows.map(transactionId).filter(Boolean)};}
function reconcileStep(instance,snapshot,step,transactions){
 const state=instance?.g||{},evidence=evidenceForStep(transactions,step),base={id:step.id,kind:step.kind,label:step.label,order:step.order,plannedAmount:Math.max(0,finite(step.amount)),evidence};
 if(step.kind==='noAction')return{...base,status:'complete',progress:1,reason:'追加調達は不要です。'};
 if(step.kind==='policy'){
  const actual=currentPolicy(instance),expected=String(snapshot.targetPolicy||''),initial=String(snapshot.currentPolicy||'');
  if(actual===expected)return{...base,status:'complete',progress:1,expected,actual,reason:'目標方針へ変更済みです。'};
  if(actual===initial)return{...base,status:'pending',progress:0,expected,actual,reason:'方針変更はまだ実行されていません。'};
  return{...base,status:'diverged',progress:0,expected,actual,reason:'計画と異なる方針へ変更されています。'};
 }
 if(step.kind==='securities'){
  const source=sourceFor(snapshot,step.sourceId);if(!source)return{...base,status:'diverged',progress:0,actual:null,expected:null,reason:'固定時点の株式情報がありません。'};
  const holding=state.companyStocks?.[step.sourceId],actual=Math.max(0,Math.floor(finite(holding?.qty))),initial=Math.max(0,Math.floor(finite(source.holdingUnits))),planned=Math.max(0,Math.floor(finite(step.units))),expected=Math.max(0,initial-planned),stock=(state.market||[]).find(row=>row.id===step.sourceId),priceChanged=Math.abs(finite(stock?.price)-finite(source.price))>.0001;
  if(actual===expected){if(!evidence.count)return{...base,status:'diverged',progress:1,initial,expected,actual,reason:'保有株数は減っていますが、株式売却の会計記録がありません。'};if(!moneyClose(evidence.cashEffect,base.plannedAmount))return{...base,status:'diverged',progress:1,initial,expected,actual,reason:'株式売却手取額が計画額と一致しません。'};return{...base,status:'complete',progress:1,initial,expected,actual,reason:'予定株数と売却手取額を会計記録で確認しました。'};}
  if(actual===initial){if(evidence.count)return{...base,status:'diverged',progress:0,initial,expected,actual,reason:'売却記録がありますが保有株数が減っていません。'};return{...base,status:priceChanged?'diverged':'pending',progress:0,initial,expected,actual,reason:priceChanged?'未売却のまま市場価格が変化しました。':'株式売却はまだ実行されていません。'};}
  if(actual>expected&&actual<initial){const sold=initial-actual;if(!evidence.count||!moneyClose(evidence.cashEffect,finite(source.price)*sold*.999))return{...base,status:'diverged',progress:sold/Math.max(1,planned),initial,expected,actual,reason:'保有株数の減少と会計上の売却手取額が一致しません。'};return{...base,status:'partial',progress:sold/Math.max(1,planned),initial,expected,actual,reason:'予定株数の一部を売却済みです。'};}
  return{...base,status:'diverged',progress:actual<expected?1:0,initial,expected,actual,reason:actual<expected?'予定株数を超えて売却しています。':'計画固定後に保有株数が増えています。'};
 }
 if(step.kind==='properties'){
  const property=(state.properties||[]).find(row=>row.id===step.sourceId),owner=String(property?.owner||'');
  if(!property)return{...base,status:'diverged',progress:0,expected:'未所有',actual:'missing',reason:'対象不動産が見つかりません。'};
  if(!owner){if(!evidence.count)return{...base,status:'diverged',progress:1,expected:'未所有',actual:owner,reason:'所有状態は売却済みですが、不動産売却の会計記録がありません。'};if(!moneyClose(evidence.cashEffect,base.plannedAmount))return{...base,status:'diverged',progress:1,expected:'未所有',actual:owner,reason:'不動産売却手取額が計画額と一致しません。'};return{...base,status:'complete',progress:1,expected:'未所有',actual:owner,reason:'不動産売却と会計上の手取額を確認しました。'};}
  if(owner==='company'){if(evidence.count)return{...base,status:'diverged',progress:0,expected:'未所有',actual:owner,reason:'売却記録がありますが会社所有のままです。'};return{...base,status:'pending',progress:0,expected:'未所有',actual:owner,reason:'不動産売却はまだ実行されていません。'};}
  return{...base,status:'diverged',progress:0,expected:'未所有',actual:owner,reason:'対象不動産の所有状態が計画外に変化しました。'};
 }
 if(step.kind==='borrowing'){
  const initial=Math.max(0,finite(snapshot.baselineDebt)),planned=Math.max(0,finite(step.amount)),expected=initial+planned,actual=Math.max(0,finite(state.companyDebt)),increase=actual-initial,epsilon=.5;
  if(Math.abs(actual-expected)<=epsilon){if(!evidence.count||!moneyClose(evidence.cashEffect,planned)||!moneyClose(evidence.liabilityEffect,planned))return{...base,status:'diverged',progress:1,initial,expected,actual,reason:'借入残高と会計上の現金・負債増加が一致しません。'};return{...base,status:'complete',progress:1,initial,expected,actual,reason:'予定借入額と現金・負債の同額増加を確認しました。'};}
  if(Math.abs(actual-initial)<=epsilon){if(evidence.count)return{...base,status:'diverged',progress:0,initial,expected,actual,reason:'借入記録がありますが借入残高が増えていません。'};return{...base,status:'pending',progress:0,initial,expected,actual,reason:'会社借入はまだ実行されていません。'};}
  if(actual>initial&&actual<expected){if(!evidence.count||!moneyClose(evidence.cashEffect,increase)||!moneyClose(evidence.liabilityEffect,increase))return{...base,status:'diverged',progress:increase/Math.max(1,planned),initial,expected,actual,reason:'借入残高と会計上の現金・負債増加が一致しません。'};return{...base,status:'partial',progress:increase/Math.max(1,planned),initial,expected,actual,reason:'予定借入額の一部を実行済みです。'};}
  return{...base,status:'diverged',progress:actual>expected?1:0,initial,expected,actual,reason:actual>expected?'予定額を超えて借入しています。':'計画固定後に借入残高が減少しています。'};
 }
 return{...base,status:'diverged',progress:0,reason:'未対応の実行手順です。'};
}
function reconcile(instance,snapshot){
 const source=snapshot&&typeof snapshot==='object'?snapshot:null,state=instance?.g||{},issues=[];
 if(!source?.fingerprint)issues.push({id:'missingSnapshot',message:'固定した資金計画がありません。'});
 if(source&&!Number.isFinite(Number(source.baselineCash)))issues.push({id:'missingBaselineCash',message:'固定時点の会社現金がありません。'});
 if(source&&!Number.isFinite(Number(source.baselineDebt)))issues.push({id:'missingBaselineDebt',message:'固定時点の借入残高がありません。'});
 if(source&&!Number.isFinite(Number(source.baselineTransactionCount)))issues.push({id:'missingFinanceMarker',message:'固定時点の会計取引位置がありません。'});
 if(source&&Math.floor(finite(source.week))!==Math.floor(finite(state.week)))issues.push({id:'weekChanged',message:'計画固定後に週が進行しました。'});
 const transactionWindow=source?transactionsSince(instance,source):{rows:[],missingBaseline:false};if(transactionWindow.missingBaseline)issues.push({id:'transactionBaselineMissing',message:'固定時点の会計取引を履歴内で確認できません。'});
 const steps=source?(source.steps||[]).map(step=>reconcileStep(instance,source,step,transactionWindow.rows)):[],counts={pending:0,partial:0,complete:0,diverged:0,blocked:0};for(const step of steps)counts[step.status]=(counts[step.status]||0)+1;
 const baselineCash=finite(source?.baselineCash),actualCash=finite(state.companyCash),expectedCash=baselineCash+Math.max(0,finite(source?.assetFunding))+Math.max(0,finite(source?.borrowing)),cashVariance=actualCash-expectedCash,baselineDebt=Math.max(0,finite(source?.baselineDebt)),actualDebt=Math.max(0,finite(state.companyDebt)),expectedDebt=baselineDebt+Math.max(0,finite(source?.borrowing)),debtVariance=actualDebt-expectedDebt,allComplete=steps.length>0&&counts.complete===steps.length;
 const usedIds=new Set(steps.flatMap(step=>step.evidence?.transactionIds||[])),relevantTransactions=transactionWindow.rows.filter(row=>['sellStock','sellProperty','borrow'].includes(String(row?.sourceType||''))),unexpectedTransactions=relevantTransactions.filter(row=>!usedIds.has(transactionId(row)));
 if(unexpectedTransactions.length)issues.push({id:'unexpectedFundingTransaction',message:`計画外の資金取引が${unexpectedTransactions.length}件あります。`});
 if(allComplete&&!moneyClose(cashVariance,0))issues.push({id:'cashVariance',message:'全手順完了後の会社現金が計画値と一致しません。'});
 if(allComplete&&!moneyClose(debtVariance,0))issues.push({id:'debtVariance',message:'全手順完了後の借入残高が計画値と一致しません。'});
 let status='notStarted';if(!source)status='blocked';else if(issues.length||counts.diverged>0)status='diverged';else if(allComplete)status='complete';else if(counts.complete>0||counts.partial>0)status='inProgress';else if(!steps.length)status='blocked';
 const completedCount=counts.complete,progress=steps.length?steps.reduce((sum,row)=>sum+Math.max(0,Math.min(1,finite(row.progress))),0)/steps.length:0,reason=issues[0]?.message||(status==='complete'?'全手順と会計記録が計画どおり完了しています。':status==='diverged'?'計画との差異を確認し、再計画してください。':status==='inProgress'?'計画の一部を実行済みです。':status==='blocked'?'固定した計画がありません。':'計画はまだ実行されていません。');
 return{fingerprint:String(source?.fingerprint||''),week:Math.max(1,Math.floor(finite(state.week,1))),planWeek:Math.max(0,Math.floor(finite(source?.week))),optionId:source?.optionId??null,optionName:source?.optionName??'',targetScore:source?.targetScore??null,status,statusLabel:({notStarted:'未着手',inProgress:'実行中',complete:'照合完了',diverged:'要再確認',blocked:'計画なし'}[status]||status),tone:toneFor(status==='notStarted'||status==='inProgress'?'partial':status),progress,completedCount,totalSteps:steps.length,counts,steps,issues,baselineCash,actualCash,expectedCash,cashVariance,baselineDebt,actualDebt,expectedDebt,debtVariance,transactionEvidence:{count:transactionWindow.rows.length,relevantCount:relevantTransactions.length,unexpectedCount:unexpectedTransactions.length,baselineMissing:transactionWindow.missingBaseline},complete:status==='complete',reason};
}
function candidates(instance,targetScore=70){return OPTION_IDS.map(optionId=>readiness.snapshot(instance,normalizeTarget(targetScore),optionId));}
function pin(instance,targetScore=70,optionId='recommended'){const target=normalizeTarget(targetScore),value=readiness.snapshot(instance,target,optionId);if(!value.ready)return null;targets.set(instance,target);pins.set(instance,value);return value;}
function clear(instance){const existed=pins.has(instance);pins.delete(instance);return existed;}
function pinned(instance){return pins.get(instance)||null;}
EngineClass.prototype.pinCapitalAllocationRecoveryFundingSnapshot=function(targetScore=70,optionId='recommended'){return pin(this,targetScore,optionId);};
EngineClass.prototype.clearCapitalAllocationRecoveryFundingSnapshot=function(){return clear(this);};
EngineClass.prototype.capitalAllocationRecoveryFundingTarget=function(){return targetFor(this);};
EngineClass.prototype.setCapitalAllocationRecoveryFundingTarget=function(targetScore=70){return setTarget(this,targetScore);};
EngineClass.prototype.capitalAllocationRecoveryFundingReconciliation=function(snapshot=null){return reconcile(this,snapshot||pinned(this));};
function render(instance=modules.playerEngineBridge?.getEngine?.()){
 if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';
 const fixed=pinned(instance);
 if(!fixed){
  const target=targetFor(instance),plans=candidates(instance,target),targetButtons=TARGET_SCORES.map(score=>`<button class="btn small${score===target?' primary':''}" data-capital-allocation-funding-target="${score}" aria-pressed="${score===target?'true':'false'}">${score}点</button>`).join(''),rows=plans.map(plan=>`<div class="stat"><span>${esc(plan.optionName||plan.optionId||'資金案')}</span><strong>${plan.targetReached?`${plan.projectedScore}点`:'到達不能'}</strong><small>${esc(plan.ready?'固定可能':plan.reason)}</small><button class="btn small" data-capital-allocation-funding-pin="${target}" data-capital-allocation-funding-option="${esc(plan.optionId||'recommended')}"${plan.ready?'':' disabled'}>この案を固定</button></div>`).join(''),key=`empty:${target}:${plans.map(plan=>`${plan.optionId}:${plan.fingerprint}:${plan.ready}`).join('|')}`;
  return `<section class="card" data-capital-allocation-recovery-funding-reconciliation="1" data-capital-allocation-recovery-funding-reconciliation-key="${esc(key)}"><div class="card-head"><div><h2>回復資金・実行後照合</h2><p>目標スコアと4つの資金案を比較して計画を一時固定し、手動取引後の進捗と会計記録を照合します。固定内容はセーブされません。</p></div><span class="badge warn">Phase 8D-27 · 目標${target}点</span></div><div class="card-body"><p><strong>回復目標：</strong>高い目標ほど必要な資産売却・借入が増える可能性があります。</p><div class="button-row" role="group" aria-label="回復目標スコア">${targetButtons}</div><div class="kpi-grid mini">${rows}</div></div></section>`;
 }
 const value=reconcile(instance,fixed),rows=value.steps.map(step=>`<div class="stat"><span>${step.order}. ${esc(step.label)}</span><strong>${esc(statusLabel(step.status))}</strong><small>${esc(step.reason)}</small></div>`).join(''),issues=value.issues.map(issue=>`<p><strong>要確認：</strong>${esc(issue.message)}</p>`).join(''),current=readiness.snapshot(instance,fixed.targetScore,fixed.optionId),key=`${fixed.fingerprint}:${value.week}:${value.status}:${value.transactionEvidence.count}:${value.steps.map(row=>`${row.id}:${row.status}:${row.actual}:${row.evidence?.count}`).join('|')}`,repin=current.ready?`<button class="btn primary small" data-capital-allocation-funding-repin="${fixed.targetScore}" data-capital-allocation-funding-option="${esc(fixed.optionId||'recommended')}">現在状態で再固定</button>`:'';
 return `<section class="card" data-capital-allocation-recovery-funding-reconciliation="1" data-capital-allocation-recovery-funding-reconciliation-key="${esc(key)}"><div class="card-head"><div><h2>回復資金・実行後照合</h2><p>固定した計画と現在の方針・保有資産・借入残高・会計取引を照合します。</p></div><span class="badge ${value.tone}">Phase 8D-27 · ${esc(value.statusLabel)}</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>対象案</span><strong>${esc(value.optionName||value.optionId||'')}</strong></div><div class="stat"><span>目標スコア</span><strong>${value.targetScore??'-'}点</strong></div><div class="stat"><span>計画識別子</span><strong>${esc(value.fingerprint)}</strong></div><div class="stat"><span>完了手順</span><strong>${value.completedCount}/${value.totalSteps}</strong></div><div class="stat"><span>会計証跡</span><strong>${value.transactionEvidence.relevantCount}件</strong></div><div class="stat"><span>現金差異</span><strong>${compactYen(value.cashVariance)}</strong></div><div class="stat"><span>借入差異</span><strong>${compactYen(value.debtVariance)}</strong></div></div><div class="kpi-grid mini">${rows}</div>${issues}<p><strong>判定：</strong>${esc(value.reason)}</p><div class="button-row">${repin}<button class="btn small" data-capital-allocation-funding-clear="1">固定を解除</button></div></div></section>`;
}
let observer=null,scheduled=false;
function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-capital-allocation-recovery-funding-reconciliation]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-capital-allocation-recovery-funding-reconciliation-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-capital-allocation-recovery-funding-reconciliation-key')||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}const host=screen.querySelector?.('[data-capital-allocation-recovery-funding-readiness]');if(host){host.insertAdjacentHTML?.('afterend',html);return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
function installUI(){if(typeof document==='undefined')return;document.addEventListener?.('click',event=>{const engine=modules.playerEngineBridge?.getEngine?.();if(!engine)return;const targetButton=event.target?.closest?.('[data-capital-allocation-funding-target]');if(targetButton){if(setTarget(engine,targetButton.dataset.capitalAllocationFundingTarget))engine.emit?.();return;}const pinButton=event.target?.closest?.('[data-capital-allocation-funding-pin]');if(pinButton){if(pin(engine,Number(pinButton.dataset.capitalAllocationFundingPin)||70,pinButton.dataset.capitalAllocationFundingOption||'recommended'))engine.emit?.();return;}const repinButton=event.target?.closest?.('[data-capital-allocation-funding-repin]');if(repinButton){if(pin(engine,Number(repinButton.dataset.capitalAllocationFundingRepin)||70,repinButton.dataset.capitalAllocationFundingOption||'recommended'))engine.emit?.();return;}const clearButton=event.target?.closest?.('[data-capital-allocation-funding-clear]');if(clearButton&&clear(engine))engine.emit?.();});const root=document.getElementById('app');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
modules.capitalAllocationRecoveryFundingReconciliation=Object.freeze({OPTION_IDS,TARGET_SCORES,normalizeTarget,targetFor,setTarget,moneyClose,statusLabel,toneFor,currentPolicy,sourceFor,transactionId,transactionsSince,matchesStep,evidenceForStep,reconcileStep,reconcile,candidates,pin,clear,pinned,render,enhance,installUI,__installed:true});
installUI();
})(0);
