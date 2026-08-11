// Phase 8C-10/8C-15: execute recommended and threshold debt repayments safely, explain score impact, and track recovery thresholds.
(function install(attempt){
'use strict';
attempt=Number.isFinite(Number(attempt))?Number(attempt):0;
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-actions.js.');
if(!modules.capitalAllocationForecast?.actionPlan||!modules.treasuryPrepayment?.capacity){
  if(typeof document!=='undefined'&&attempt<50){setTimeout(()=>install(attempt+1),0);return;}
  throw new Error('capital-allocation-forecast.js and treasury-prepayment.js must load before capital-allocation-actions.js.');
}
if(modules.capitalAllocationActions)throw new Error('capital allocation actions module is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const forecast=modules.capitalAllocationForecast;
const treasury=modules.treasuryPrepayment;
const policy=modules.capitalAllocationPolicy;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const lexical=(a,b)=>a<b?-1:a>b?1:0;
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const compactYen=modules.engine.compactYen||modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
const point=value=>Math.round(finite(value)*10)/10;
const pointText=value=>`${finite(value)>=0?'+':''}${point(value).toFixed(1).replace(/\.0$/,'')}点`;
const percent=value=>Math.round(clamp(value,0,1)*1000)/10;
function renderKey(value){let hash=2166136261;const text=String(value||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function preview(instance,policyId){
  const progress=policy.progress(instance);
  const selected=policyId||progress.id||progress.policy;
  const plan=forecast.actionPlan(selected,progress.metrics);
  const capacity=treasury.capacity(instance);
  const debtRequested=Math.max(0,Math.floor(finite(plan.debtAmount)));
  const debtExecutable=Math.max(0,Math.min(debtRequested,Math.floor(finite(capacity.maxAmount))));
  const debtFundingGap=Math.max(0,debtRequested-debtExecutable);
  const growthAmount=Math.max(0,Math.floor(finite(plan.growthAmount)));
  const blockingActions=plan.actions.filter(row=>row.id==='pauseGrowth'||row.id==='pausePayout');
  return{policy:selected,policyName:plan.policyName,plan,capacity,debtRequested,debtExecutable,debtFundingGap,growthAmount,blockingActions,canExecuteDebt:debtExecutable>0};
}
function attainmentFor(target){
  if(!target?.bindingId)return 1;
  const current=Math.max(0,finite(target.currentRatio));
  const desired=Math.max(0,finite(target.targetRatio));
  if(['growthBelow','debtReduction'].includes(target.bindingId))return desired<=0?1:clamp(current/desired,0,1);
  return current<=0?1:clamp(desired/current,0,1);
}
function afterDebtRepayment(metrics,amount){
  const after={...(metrics||{})};
  const paid=Math.max(0,Math.min(Math.max(0,finite(after.debt)),finite(amount)));
  after.cash=Math.max(0,finite(after.cash)-paid);
  after.debt=Math.max(0,finite(after.debt)-paid);
  after.debtReduction=Math.max(0,finite(after.debtReduction)+paid);
  after.leverageRatio=after.debt/Math.max(1,after.cash+Math.max(1,finite(after.revenue,1)));
  after.debtReductionRatio=after.debtReduction/Math.max(1,after.debt+after.debtReduction);
  return after;
}
function recoveryTargetBase(policyId,metrics){
  const breakdown=policy.executionScoreBreakdown(policyId,metrics);
  const p=policy.POLICIES[breakdown.policy];
  const binding=breakdown.bindingConstraint;
  const m=metrics||{};
  const cash=Math.max(0,finite(m.cash));
  const debt=Math.max(0,finite(m.debt));
  const revenue=Math.max(1,finite(m.revenue,1));
  const growthRatio=Math.max(0,finite(m.growthRatio));
  const payoutRatio=Math.max(0,finite(m.payoutRatio));
  const debtReduction=Math.max(0,finite(m.debtReduction));
  const debtReductionRatio=Math.max(0,finite(m.debtReductionRatio));
  const availableCash=Math.max(0,cash-treasury.MIN_CASH);
  const base={policy:breakdown.policy,policyName:breakdown.policyName,bindingId:binding?.id||null,bindingLabel:binding?.label||null,recoverablePoints:binding?.amount||0,currentRatio:0,targetRatio:0,action:'maintain',actionLabel:'現在の配分を維持',requiredAmount:0,executableAmount:0,fundingGap:0,direct:false,fullyFunded:true,text:'現在の方針では減点要因がありません。'};
  if(!binding)return base;
  let requiredAmount=0,executableAmount=0,currentRatio=0,targetRatio=0,action='',actionLabel='',direct=false,text='';
  if(binding.id==='growthBelow'){
    currentRatio=growthRatio;
    targetRatio=p.growth[0];
    requiredAmount=Math.max(0,Math.ceil((targetRatio-currentRatio)*revenue));
    executableAmount=Math.min(requiredAmount,availableCash);
    action='growthInvestment';
    actionLabel='成長投資の追加';
    text=`成長投資を${compactYen(requiredAmount)}追加すると、最低投資率${(targetRatio*100).toFixed(1)}%へ届く見込みです。`;
  }else if(binding.id==='growthAbove'){
    currentRatio=growthRatio;
    targetRatio=p.growth[1];
    const effectiveSpend=Math.max(Math.max(0,finite(m.growthSpend)),currentRatio*revenue);
    requiredAmount=targetRatio>0?Math.max(0,Math.ceil(effectiveSpend/targetRatio-revenue)):0;
    action='growRevenue';
    actionLabel='追加投資停止と売上拡大';
    text=`追加投資を停止し、売上基盤を${compactYen(requiredAmount)}増やすと上限${(targetRatio*100).toFixed(1)}%へ戻る見込みです。`;
  }else if(binding.id==='leverage'){
    currentRatio=Math.max(0,finite(m.leverageRatio));
    targetRatio=p.maxLeverage;
    const balanceBase=cash+revenue;
    const repaymentImproves=debt<balanceBase&&targetRatio<1;
    if(repaymentImproves){
      requiredAmount=Math.max(0,Math.min(debt,Math.ceil((debt-targetRatio*balanceBase)/Math.max(.01,1-targetRatio))));
      executableAmount=Math.min(requiredAmount,availableCash,debt);
      action='debtRepayment';
      actionLabel='借入返済';
      direct=true;
      text=`借入を${compactYen(requiredAmount)}返済すると、レバレッジ${(targetRatio*100).toFixed(1)}%以下へ届く見込みです。`;
    }else{
      requiredAmount=targetRatio>0?Math.max(0,Math.ceil(debt/targetRatio-balanceBase)):0;
      action='strengthenCashBase';
      actionLabel='現金・売上基盤の拡大';
      text=`借入返済だけでは比率が悪化するため、現金または売上基盤を${compactYen(requiredAmount)}増やすことが必要です。`;
    }
  }else if(binding.id==='payout'){
    currentRatio=payoutRatio;
    targetRatio=p.maxPayout;
    const returnBase=Math.max(1,finite(m.safeReturn)||revenue);
    const returnAmount=Math.max(Math.max(0,finite(m.dividend))+Math.max(0,finite(m.buyback)),currentRatio*returnBase);
    requiredAmount=targetRatio>0?Math.max(0,Math.ceil(returnAmount/targetRatio-returnBase)):0;
    action='strengthenProfitBase';
    actionLabel='追加還元停止と利益基盤拡大';
    text=`追加還元を停止し、分配可能利益または売上基盤を${compactYen(requiredAmount)}増やすと上限へ戻る見込みです。`;
  }else if(binding.id==='debtReduction'){
    currentRatio=debtReductionRatio;
    targetRatio=p.minDebtReduction;
    const originalDebt=Math.max(1,debt+debtReduction);
    requiredAmount=Math.max(0,Math.min(debt,Math.ceil(targetRatio*originalDebt-debtReduction)));
    executableAmount=Math.min(requiredAmount,availableCash,debt);
    action='debtRepayment';
    actionLabel='借入返済';
    direct=true;
    text=`借入を${compactYen(requiredAmount)}返済すると、削減率${(targetRatio*100).toFixed(1)}%へ届く見込みです。`;
  }
  const fundingGap=Math.max(0,requiredAmount-executableAmount);
  const fullyFunded=requiredAmount<=.5||fundingGap<=.5;
  return{...base,currentRatio,targetRatio,action,actionLabel,requiredAmount,executableAmount,fundingGap,direct,fullyFunded,text};
}
function recoveryTargetFor(policyId,metrics){
  const target=recoveryTargetBase(policyId,metrics);
  const attainmentRatio=attainmentFor(target);
  const currentBreakdown=policy.executionScoreBreakdown(target.policy,metrics);
  let projectionAvailable=false;
  let projectedScore=currentBreakdown.score;
  let projectedScoreGain=0;
  let projectedBindingId=target.bindingId;
  let projectedBindingLabel=target.bindingLabel;
  let projectedPenalty=target.recoverablePoints;
  let projectedAttainmentRatio=attainmentRatio;
  let projectedRequiredAmount=target.requiredAmount;
  let projectedActionLabel=target.actionLabel;
  if(target.direct&&target.executableAmount>0){
    projectionAvailable=true;
    const after=afterDebtRepayment(metrics,target.executableAmount);
    const afterBreakdown=policy.executionScoreBreakdown(target.policy,after);
    const next=recoveryTargetBase(target.policy,after);
    projectedScore=afterBreakdown.score;
    projectedScoreGain=projectedScore-currentBreakdown.score;
    projectedBindingId=next.bindingId;
    projectedBindingLabel=next.bindingLabel;
    projectedPenalty=next.recoverablePoints;
    projectedAttainmentRatio=attainmentFor(next);
    projectedRequiredAmount=next.requiredAmount;
    projectedActionLabel=next.actionLabel;
  }
  return{...target,attainmentRatio,attainmentPercent:percent(attainmentRatio),projectionAvailable,projectedScore,projectedScoreGain,projectedBindingId,projectedBindingLabel,projectedPenalty,projectedAttainmentRatio,projectedAttainmentPercent:percent(projectedAttainmentRatio),projectedRequiredAmount,projectedActionLabel};
}
function impactForAmount(instance,policyId,requestedAmount){
  const progress=policy.progress(instance);
  const selected=policyId||progress.id||progress.policy;
  const current={...progress.metrics};
  const capacity=treasury.capacity(instance);
  const requested=Math.max(0,Math.floor(finite(requestedAmount)));
  const amount=Math.max(0,Math.min(requested,Math.floor(finite(capacity.maxAmount)),Math.floor(Math.max(0,finite(current.debt)))));
  const after=afterDebtRepayment(current,amount);
  const beforeBreakdown=policy.executionScoreBreakdown(selected,current);
  const afterBreakdown=policy.executionScoreBreakdown(selected,after);
  const beforeScore=beforeBreakdown.score;
  const afterScore=afterBreakdown.score;
  const improvement=afterScore-beforeScore;
  const afterById=new Map(afterBreakdown.penalties.map(row=>[row.id,row]));
  const componentEffects=beforeBreakdown.penalties.map(row=>{const next=afterById.get(row.id)||{amount:0};return{id:row.id,metric:row.metric,label:row.label,beforePenalty:row.amount,afterPenalty:next.amount,scoreEffect:row.amount-next.amount};});
  const improvements=componentEffects.filter(row=>row.scoreEffect>0).sort((a,b)=>b.scoreEffect-a.scoreEffect||lexical(a.id,b.id));
  const regressions=componentEffects.filter(row=>row.scoreEffect<0).sort((a,b)=>a.scoreEffect-b.scoreEffect||lexical(a.id,b.id));
  const recoveryTarget=recoveryTargetFor(selected,current);
  return{policy:selected,policyName:beforeBreakdown.policyName,requestedAmount:requested,amount,capacity,beforeScore,afterScore,improvement,canExecute:amount>0&&improvement>=0,currentMetrics:current,afterMetrics:after,beforeBreakdown,afterBreakdown,componentEffects,largestImprovement:improvements[0]||null,largestRegression:regressions[0]||null,recoveryTarget};
}
function impact(instance,policyId){
  const value=preview(instance,policyId);
  return impactForAmount(instance,value.policy,value.debtExecutable);
}
function thresholdDebtPreview(instance,policyId){
  const progress=policy.progress(instance);
  const selected=policyId||progress.id||progress.policy;
  const target=recoveryTargetFor(selected,progress.metrics);
  const capacity=treasury.capacity(instance);
  const requestedAmount=target.direct?Math.max(0,Math.floor(finite(target.requiredAmount))):0;
  const executableAmount=target.direct?Math.max(0,Math.min(requestedAmount,Math.floor(finite(target.executableAmount)),Math.floor(finite(capacity.maxAmount)))):0;
  const fundingGap=Math.max(0,requestedAmount-executableAmount);
  const scoreImpact=impactForAmount(instance,selected,executableAmount);
  return{policy:selected,policyName:target.policyName,target,capacity,requestedAmount,executableAmount,fundingGap,fullyFunded:requestedAmount<=.5||fundingGap<=.5,scoreImpact,canExecute:target.direct&&executableAmount>0&&scoreImpact.improvement>=0};
}
function executeDebt(instance,policyId){
  if(!instance?.g?.publicCompany)return instance?.fail?.('上場後に利用できます。')??false;
  const value=preview(instance,policyId);
  if(value.debtRequested<=0)return instance.fail?.('この方針で追加の借入返済は必要ありません。')??false;
  if(value.debtExecutable<=0)return instance.fail?.(`最低運転資金${compactYen(treasury.MIN_CASH)}を残すため、現在は返済を実行できません。`)??false;
  const scoreImpact=impactForAmount(instance,value.policy,value.debtExecutable);
  if(scoreImpact.improvement<0)return instance.fail?.('この返済は現金減少により資本配分評価を悪化させるため実行しません。')??false;
  return instance.prepayCompanyDebtVoluntarily(value.debtExecutable);
}
function executeThresholdDebt(instance,policyId){
  if(!instance?.g?.publicCompany)return instance?.fail?.('上場後に利用できます。')??false;
  const value=thresholdDebtPreview(instance,policyId);
  if(!value.target.bindingId)return instance.fail?.('現在の方針では減点要因がありません。')??false;
  if(!value.target.direct)return instance.fail?.(`次の改善項目「${value.target.bindingLabel}」は借入返済では実行できません。`)??false;
  if(value.requestedAmount<=0)return instance.fail?.('返済による追加改善は必要ありません。')??false;
  if(value.executableAmount<=0)return instance.fail?.(`最低運転資金${compactYen(treasury.MIN_CASH)}を残すため、現在は返済を実行できません。`)??false;
  if(value.scoreImpact.improvement<0)return instance.fail?.('改善閾値までの返済は資本配分評価を悪化させるため実行しません。')??false;
  return instance.prepayCompanyDebtVoluntarily(value.executableAmount);
}
EngineClass.prototype.capitalAllocationDebtActionPreview=function(policyId){return preview(this,policyId);};
EngineClass.prototype.capitalAllocationDebtActionImpact=function(policyId){return impact(this,policyId);};
EngineClass.prototype.capitalAllocationDebtAmountImpact=function(policyId,amount){return impactForAmount(this,policyId,amount);};
EngineClass.prototype.capitalAllocationThresholdDebtActionPreview=function(policyId){return thresholdDebtPreview(this,policyId);};
EngineClass.prototype.capitalAllocationPolicyRecoveryTarget=function(policyId){const value=policy.progress(this);return recoveryTargetFor(policyId||value.policy,value.metrics);};
EngineClass.prototype.executeCapitalAllocationDebtAction=function(policyId){return executeDebt(this,policyId);};
EngineClass.prototype.executeCapitalAllocationThresholdDebtAction=function(policyId){return executeThresholdDebt(this,policyId);};
function render(instance=modules.playerEngineBridge?.getEngine?.()){
  if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';
  const comparison=instance.capitalAllocationPolicyComparison?.();
  const recommended=comparison?.recommendedPolicy||policy.progress(instance).policy;
  const value=preview(instance,recommended);
  const scoreImpact=impact(instance,recommended);
  const recovery=scoreImpact.recoveryTarget;
  const threshold=thresholdDebtPreview(instance,recommended);
  const canExecute=value.canExecuteDebt&&scoreImpact.improvement>=0;
  const canExecuteThreshold=threshold.canExecute;
  const warnings=[];
  if(value.growthAmount>0)warnings.push(`成長投資${compactYen(value.growthAmount)}は既存の投資画面から個別に実行してください。`);
  for(const row of value.blockingActions)warnings.push(row.text);
  if(value.debtFundingGap>0)warnings.push(`推奨返済額に対して${compactYen(value.debtFundingGap)}の資金不足です。実行可能額だけ返済します。`);
  if(threshold.target.direct&&threshold.fundingGap>0)warnings.push(`改善閾値までの返済に${compactYen(threshold.fundingGap)}不足しています。実行可能額だけ返済します。`);
  if(scoreImpact.improvement<0)warnings.push('実行可能額だけを返済すると現金減少で評価点が悪化するため、返済は停止されています。');
  const improvementFactor=scoreImpact.largestImprovement;
  const regressionFactor=scoreImpact.largestRegression;
  const binding=scoreImpact.afterBreakdown.bindingConstraint;
  const breakdownKey=scoreImpact.componentEffects.map(row=>`${row.id}:${row.beforePenalty}:${row.afterPenalty}`).join('|');
  const recoveryKey=`${recovery.bindingId}|${recovery.action}|${recovery.requiredAmount}|${recovery.executableAmount}|${recovery.fundingGap}|${recovery.attainmentPercent}|${recovery.projectedBindingId}|${recovery.projectedScore}`;
  const thresholdKey=`${threshold.requestedAmount}|${threshold.executableAmount}|${threshold.fundingGap}|${threshold.scoreImpact.afterScore}|${threshold.scoreImpact.improvement}|${threshold.canExecute}`;
  const key=renderKey(`${instance.g.week}|${recommended}|${value.debtRequested}|${value.debtExecutable}|${value.capacity.cash}|${value.capacity.debt}|${scoreImpact.beforeScore}|${scoreImpact.afterScore}|${breakdownKey}|${recoveryKey}|${thresholdKey}|${warnings.join('|')}`);
  const warningHtml=warnings.length?warnings.map(text=>`<p>${esc(text)}</p>`).join(''):'<p>追加の制約はありません。</p>';
  const recoveryAmount=recovery.requiredAmount>0?compactYen(recovery.requiredAmount):'追加資金不要';
  const projectedLabel=recovery.projectionAvailable?(recovery.projectedBindingLabel||'なし'):'未試算';
  const projectedDetail=recovery.projectionAvailable?(recovery.projectedBindingLabel?`${point(recovery.projectedPenalty).toFixed(1).replace(/\.0$/,'')}点減点・次に${esc(recovery.projectedActionLabel)}`:`全目標達成・予測${recovery.projectedScore}点`):'実行可能な直接処理なし';
  const thresholdAmount=threshold.target.direct?compactYen(threshold.executableAmount):'対象外';
  const thresholdScore=threshold.target.direct?`${threshold.scoreImpact.afterScore}点`:'未試算';
  return `<section class="card" data-capital-allocation-actions-ui="1" data-capital-allocation-actions-render-key="${key}"><div class="card-head"><div><h2>資本配分アクション</h2><p>推奨方針「${esc(value.policyName)}」の借入返済を、方針全体または次の改善閾値まで安全に実行します。</p></div><span class="badge ${canExecute||canExecuteThreshold?'good':'warn'}">Phase 8C-15</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>推奨返済</span><strong>${esc(compactYen(value.debtRequested))}</strong></div><div class="stat"><span>今回実行可能</span><strong>${esc(compactYen(value.debtExecutable))}</strong></div><div class="stat"><span>返済後現金</span><strong>${esc(compactYen(value.capacity.cash-value.debtExecutable))}</strong></div><div class="stat"><span>現在予測点</span><strong>${scoreImpact.beforeScore}点</strong></div><div class="stat"><span>返済後予測点</span><strong>${scoreImpact.afterScore}点</strong></div><div class="stat"><span>予測改善幅</span><strong>${scoreImpact.improvement>=0?'+':''}${scoreImpact.improvement}点</strong></div><div class="stat"><span>閾値返済</span><strong>${esc(thresholdAmount)}</strong><small>${esc(recovery.bindingLabel||'全目標達成')}</small></div><div class="stat"><span>閾値返済後</span><strong>${esc(thresholdScore)}</strong><small>${threshold.target.direct?pointText(threshold.scoreImpact.improvement):'返済対象ではありません'}</small></div></div><div data-capital-allocation-score-breakdown="1"><h3>評価内訳</h3><div class="kpi-grid mini"><div class="stat"><span>最大改善要因</span><strong>${improvementFactor?esc(improvementFactor.label):'なし'}</strong><small>${improvementFactor?pointText(improvementFactor.scoreEffect):'減点改善なし'}</small></div><div class="stat"><span>最大悪化要因</span><strong>${regressionFactor?esc(regressionFactor.label):'なし'}</strong><small>${regressionFactor?pointText(regressionFactor.scoreEffect):'追加減点なし'}</small></div><div class="stat"><span>返済後の主な減点</span><strong>${binding?esc(binding.label):'なし'}</strong><small>${binding?`${point(binding.amount).toFixed(1).replace(/\.0$/,'')}点減点`:'減点なし'}</small></div></div></div><div data-capital-allocation-recovery-target="1"><h3>次の改善閾値</h3><div class="kpi-grid mini"><div class="stat"><span>目標達成度</span><strong>${recovery.attainmentPercent.toFixed(1).replace(/\.0$/,'')}%</strong><small>${esc(recovery.bindingLabel||'全目標達成')}</small></div><div class="stat"><span>必要改善額</span><strong>${esc(recoveryAmount)}</strong><small>${esc(recovery.actionLabel)}</small></div><div class="stat"><span>改善閾値実行後</span><strong>${esc(projectedLabel)}</strong><small>${projectedDetail}</small></div></div><p>${esc(recovery.text)}</p></div>${warningHtml}<div class="button-row"><button class="btn secondary small" data-capital-allocation-threshold-debt-action="${esc(recommended)}" ${canExecuteThreshold?'':'disabled'}>改善閾値まで返済</button><button class="btn primary small" data-capital-allocation-debt-action="${esc(recommended)}" ${canExecute?'':'disabled'}>方針推奨額を返済</button></div></div></section>`;
}
let bound=false;
function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-capital-allocation-actions-ui]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-capital-allocation-actions-render-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-capital-allocation-actions-render-key')||old?.dataset?.capitalAllocationActionsRenderKey||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}const forecastCard=screen.querySelector?.('[data-capital-allocation-forecast-ui]');if(forecastCard){forecastCard.insertAdjacentHTML?.('afterend',html);return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){enhance();}
function click(event){const thresholdButton=event?.target?.closest?.('[data-capital-allocation-threshold-debt-action]'),recommendationButton=event?.target?.closest?.('[data-capital-allocation-debt-action]'),engine=modules.playerEngineBridge?.getEngine?.();if(!engine)return;if(thresholdButton&&!thresholdButton.disabled){event.preventDefault?.();if(engine.executeCapitalAllocationThresholdDebtAction(thresholdButton.dataset.capitalAllocationThresholdDebtAction))schedule();return;}if(recommendationButton&&!recommendationButton.disabled){event.preventDefault?.();if(engine.executeCapitalAllocationDebtAction(recommendationButton.dataset.capitalAllocationDebtAction))schedule();}}
let registeredEnhancerDefinition=null;
function registerEnhancer(definition){if(registeredEnhancerDefinition)return registeredEnhancerDefinition;registeredEnhancerDefinition=definition;const registry=modules.uiEnhancerRegistry;if(registry?.registerUIEnhancer)return registry.registerUIEnhancer(definition);const key='__capitalismTycoonPendingUIEnhancers';const pending=Array.isArray(globalThis[key])?globalThis[key]:(globalThis[key]=[]);pending.push(definition);return definition;}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!bound){root.addEventListener('click',click);bound=true;}registerEnhancer({id:'capital-allocation-actions',enhance:enhance});schedule();}
modules.capitalAllocationActions=Object.freeze({preview,attainmentFor,afterDebtRepayment,recoveryTargetFor,impactForAmount,impact,thresholdDebtPreview,executeDebt,executeThresholdDebt,renderKey,render,enhance,installUI,__installed:true});
installUI();
})(0);
