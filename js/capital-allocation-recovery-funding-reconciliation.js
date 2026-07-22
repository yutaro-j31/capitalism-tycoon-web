// Phase 8D-19/20: read-only post-execution reconciliation for pinned funding plans.
(function install(attempt){
'use strict';attempt=Number.isFinite(Number(attempt))?Number(attempt):0;
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-recovery-funding-reconciliation.js.');
if(!modules.capitalAllocationRecoveryFundingReadiness?.snapshot||!modules.capitalAllocationPolicy?.readStateFor){
 if(typeof document!=='undefined'&&attempt<50){setTimeout(()=>install(attempt+1),0);return;}
 throw new Error('funding readiness and capital allocation policy must load before reconciliation.');
}
if(modules.capitalAllocationRecoveryFundingReconciliation)throw new Error('capital allocation recovery funding reconciliation module is already registered.');
const EngineClass=modules.engine.TycoonEngine,readiness=modules.capitalAllocationRecoveryFundingReadiness,policy=modules.capitalAllocationPolicy;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const compactYen=modules.engine.compactYen||modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
const pins=new WeakMap();
function statusLabel(status){return({pending:'未着手',partial:'一部完了',complete:'完了',diverged:'要確認',blocked:'実行不可'}[status]||status);}
function toneFor(status){return status==='complete'?'good':status==='diverged'||status==='blocked'?'bad':'warn';}
function currentPolicy(instance){return policy.readStateFor(instance).id;}
function sourceFor(snapshot,sourceId){return(snapshot?.sources||[]).find(row=>row.sourceId===sourceId)||null;}
function reconcileStep(instance,snapshot,step){
 const state=instance?.g||{},base={id:step.id,kind:step.kind,label:step.label,order:step.order,plannedAmount:Math.max(0,finite(step.amount))};
 if(step.kind==='noAction')return{...base,status:'complete',progress:1,reason:'追加調達は不要です。'};
 if(step.kind==='policy'){
  const actual=currentPolicy(instance),expected=String(snapshot.targetPolicy||''),initial=String(snapshot.currentPolicy||'');
  if(actual===expected)return{...base,status:'complete',progress:1,expected,actual,reason:'目標方針へ変更済みです。'};
  if(actual===initial)return{...base,status:'pending',progress:0,expected,actual,reason:'方針変更はまだ実行されていません。'};
  return{...base,status:'diverged',progress:0,expected,actual,reason:'計画と異なる方針へ変更されています。'};
 }
 if(step.kind==='securities'){
  const source=sourceFor(snapshot,step.sourceId),holding=state.companyStocks?.[step.sourceId],actual=Math.max(0,Math.floor(finite(holding?.qty))),initial=Math.max(0,Math.floor(finite(source?.holdingUnits))),planned=Math.max(0,Math.floor(finite(step.units))),expected=Math.max(0,initial-planned),stock=(state.market||[]).find(row=>row.id===step.sourceId),priceChanged=Math.abs(finite(stock?.price)-finite(source?.price))>.0001;
  if(!source)return{...base,status:'diverged',progress:0,actual,expected:null,reason:'固定時点の株式情報がありません。'};
  if(actual===expected)return{...base,status:'complete',progress:1,initial,expected,actual,reason:'予定株数の売却が完了しています。'};
  if(actual===initial)return{...base,status:priceChanged?'diverged':'pending',progress:0,initial,expected,actual,reason:priceChanged?'未売却のまま市場価格が変化しました。':'株式売却はまだ実行されていません。'};
  if(actual>expected&&actual<initial)return{...base,status:'partial',progress:(initial-actual)/Math.max(1,planned),initial,expected,actual,reason:'予定株数の一部を売却済みです。'};
  return{...base,status:'diverged',progress:actual<expected?1:0,initial,expected,actual,reason:actual<expected?'予定株数を超えて売却しています。':'計画固定後に保有株数が増えています。'};
 }
 if(step.kind==='properties'){
  const property=(state.properties||[]).find(row=>row.id===step.sourceId),owner=String(property?.owner||'');
  if(!property)return{...base,status:'diverged',progress:0,expected:'未所有',actual:'missing',reason:'対象不動産が見つかりません。'};
  if(!owner)return{...base,status:'complete',progress:1,expected:'未所有',actual:owner,reason:'会社不動産の売却が完了しています。'};
  if(owner==='company')return{...base,status:'pending',progress:0,expected:'未所有',actual:owner,reason:'不動産売却はまだ実行されていません。'};
  return{...base,status:'diverged',progress:0,expected:'未所有',actual:owner,reason:'対象不動産の所有状態が計画外に変化しました。'};
 }
 if(step.kind==='borrowing'){
  const initial=Math.max(0,finite(snapshot.baselineDebt)),planned=Math.max(0,finite(step.amount)),expected=initial+planned,actual=Math.max(0,finite(state.companyDebt)),epsilon=.5;
  if(Math.abs(actual-expected)<=epsilon)return{...base,status:'complete',progress:1,initial,expected,actual,reason:'予定借入額の実行が完了しています。'};
  if(Math.abs(actual-initial)<=epsilon)return{...base,status:'pending',progress:0,initial,expected,actual,reason:'会社借入はまだ実行されていません。'};
  if(actual>initial&&actual<expected)return{...base,status:'partial',progress:(actual-initial)/Math.max(1,planned),initial,expected,actual,reason:'予定借入額の一部を実行済みです。'};
  return{...base,status:'diverged',progress:actual>expected?1:0,initial,expected,actual,reason:actual>expected?'予定額を超えて借入しています。':'計画固定後に借入残高が減少しています。'};
 }
 return{...base,status:'diverged',progress:0,reason:'未対応の実行手順です。'};
}
function reconcile(instance,snapshot){
 const source=snapshot&&typeof snapshot==='object'?snapshot:null,state=instance?.g||{},issues=[];
 if(!source?.fingerprint)issues.push({id:'missingSnapshot',message:'固定した資金計画がありません。'});
 if(source&&!Number.isFinite(Number(source.baselineCash)))issues.push({id:'missingBaselineCash',message:'固定時点の会社現金がありません。'});
 if(source&&!Number.isFinite(Number(source.baselineDebt)))issues.push({id:'missingBaselineDebt',message:'固定時点の借入残高がありません。'});
 if(source&&Math.floor(finite(source.week))!==Math.floor(finite(state.week)))issues.push({id:'weekChanged',message:'計画固定後に週が進行しました。'});
 const steps=source?(source.steps||[]).map(step=>reconcileStep(instance,source,step)):[],counts={pending:0,partial:0,complete:0,diverged:0,blocked:0};for(const step of steps)counts[step.status]=(counts[step.status]||0)+1;
 let status='notStarted';if(issues.length||counts.diverged>0)status='diverged';else if(steps.length&&counts.complete===steps.length)status='complete';else if(counts.complete>0||counts.partial>0)status='inProgress';else if(!steps.length)status='blocked';
 const baselineCash=finite(source?.baselineCash),actualCash=finite(state.companyCash),expectedCash=baselineCash+Math.max(0,finite(source?.assetFunding))+Math.max(0,finite(source?.borrowing)),baselineDebt=Math.max(0,finite(source?.baselineDebt)),actualDebt=Math.max(0,finite(state.companyDebt)),expectedDebt=baselineDebt+Math.max(0,finite(source?.borrowing)),completedCount=counts.complete,progress=steps.length?steps.reduce((sum,row)=>sum+Math.max(0,Math.min(1,finite(row.progress))),0)/steps.length:0;
 return{fingerprint:String(source?.fingerprint||''),week:Math.max(1,Math.floor(finite(state.week,1))),planWeek:Math.max(0,Math.floor(finite(source?.week))),optionId:source?.optionId??null,optionName:source?.optionName??'',targetScore:source?.targetScore??null,status,statusLabel:({notStarted:'未着手',inProgress:'実行中',complete:'照合完了',diverged:'要再確認',blocked:'計画なし'}[status]||status),tone:toneFor(status==='notStarted'||status==='inProgress'?'partial':status),progress,completedCount,totalSteps:steps.length,counts,steps,issues,baselineCash,actualCash,expectedCash,cashVariance:actualCash-expectedCash,baselineDebt,actualDebt,expectedDebt,debtVariance:actualDebt-expectedDebt,complete:status==='complete',reason:issues[0]?.message||status==='complete'?'全手順が計画どおり完了しています。':status==='diverged'?'計画との差異を確認し、再計画してください。':status==='inProgress'?'計画の一部を実行済みです。':'計画はまだ実行されていません。'};
}
function pin(instance,targetScore=70,optionId='recommended'){
 const value=readiness.snapshot(instance,targetScore,optionId);if(!value.ready)return null;pins.set(instance,value);return value;
}
function clear(instance){const existed=pins.has(instance);pins.delete(instance);return existed;}
function pinned(instance){return pins.get(instance)||null;}
EngineClass.prototype.pinCapitalAllocationRecoveryFundingSnapshot=function(targetScore=70,optionId='recommended'){return pin(this,targetScore,optionId);};
EngineClass.prototype.clearCapitalAllocationRecoveryFundingSnapshot=function(){return clear(this);};
EngineClass.prototype.capitalAllocationRecoveryFundingReconciliation=function(snapshot=null){return reconcile(this,snapshot||pinned(this));};
function render(instance=modules.playerEngineBridge?.getEngine?.()){
 if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';
 const fixed=pinned(instance),current=readiness.snapshot(instance,70,'recommended');
 if(!fixed){const disabled=current.ready?'':' disabled',reason=current.ready?'現在の現行推奨案を一時固定できます。':current.reason;return `<section class="card" data-capital-allocation-recovery-funding-reconciliation="1" data-capital-allocation-recovery-funding-reconciliation-key="empty:${current.fingerprint}"><div class="card-head"><div><h2>回復資金・実行後照合</h2><p>計画を一時固定し、手動取引後の進捗を照合します。固定内容はセーブされません。</p></div><span class="badge warn">Phase 8D-20 · 未固定</span></div><div class="card-body"><p>${esc(reason)}</p><div class="button-row"><button class="btn primary small" data-capital-allocation-funding-pin="70"${disabled}>現行推奨案を固定</button></div></div></section>`;}
 const value=reconcile(instance,fixed),rows=value.steps.map(step=>`<div class="stat"><span>${step.order}. ${esc(step.label)}</span><strong>${esc(statusLabel(step.status))}</strong><small>${esc(step.reason)}</small></div>`).join(''),issues=value.issues.map(issue=>`<p><strong>要確認：</strong>${esc(issue.message)}</p>`).join(''),key=`${fixed.fingerprint}:${value.week}:${value.status}:${value.steps.map(row=>`${row.id}:${row.status}:${row.actual}`).join('|')}`;
 return `<section class="card" data-capital-allocation-recovery-funding-reconciliation="1" data-capital-allocation-recovery-funding-reconciliation-key="${esc(key)}"><div class="card-head"><div><h2>回復資金・実行後照合</h2><p>固定した計画と現在の方針・保有資産・借入残高を照合します。</p></div><span class="badge ${value.tone}">Phase 8D-20 · ${esc(value.statusLabel)}</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>計画識別子</span><strong>${esc(value.fingerprint)}</strong></div><div class="stat"><span>完了手順</span><strong>${value.completedCount}/${value.totalSteps}</strong></div><div class="stat"><span>現金差異</span><strong>${compactYen(value.cashVariance)}</strong></div><div class="stat"><span>借入差異</span><strong>${compactYen(value.debtVariance)}</strong></div></div><div class="kpi-grid mini">${rows}</div>${issues}<p><strong>判定：</strong>${esc(value.reason)}</p><div class="button-row"><button class="btn small" data-capital-allocation-funding-clear="1">固定を解除</button></div></div></section>`;
}
let observer=null,scheduled=false;
function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-capital-allocation-recovery-funding-reconciliation]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-capital-allocation-recovery-funding-reconciliation-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-capital-allocation-recovery-funding-reconciliation-key')||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}const host=screen.querySelector?.('[data-capital-allocation-recovery-funding-readiness]');if(host){host.insertAdjacentHTML?.('afterend',html);return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
function installUI(){if(typeof document==='undefined')return;document.addEventListener?.('click',event=>{const engine=modules.playerEngineBridge?.getEngine?.();if(!engine)return;const pinButton=event.target?.closest?.('[data-capital-allocation-funding-pin]');if(pinButton){if(pin(engine,Number(pinButton.dataset.capitalAllocationFundingPin)||70,'recommended'))engine.emit?.();return;}const clearButton=event.target?.closest?.('[data-capital-allocation-funding-clear]');if(clearButton&&clear(engine))engine.emit?.();});const root=document.getElementById('app');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
modules.capitalAllocationRecoveryFundingReconciliation=Object.freeze({statusLabel,toneFor,currentPolicy,sourceFor,reconcileStep,reconcile,pin,clear,pinned,render,enhance,installUI,__installed:true});
installUI();
})(0);
