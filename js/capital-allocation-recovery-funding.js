// Phase 8D-13/14: conservative recovery funding inventory and debt-aware target frontier.
(function install(attempt){
'use strict';attempt=Number.isFinite(Number(attempt))?Number(attempt):0;
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-recovery-funding.js.');
if(!modules.capitalAllocationResilienceMemo?.recoveryPlan||!modules.capitalAllocationStressTest?.applyScenario||!modules.capitalAllocationPolicy?.executionScore){
 if(typeof document!=='undefined'&&attempt<50){setTimeout(()=>install(attempt+1),0);return;}
 throw new Error('capital allocation resilience, stress test, and policy modules must load before capital-allocation-recovery-funding.js.');
}
if(modules.capitalAllocationRecoveryFunding)throw new Error('capital allocation recovery funding module is already registered.');
const EngineClass=modules.engine.TycoonEngine,resilience=modules.capitalAllocationResilienceMemo,stress=modules.capitalAllocationStressTest,policy=modules.capitalAllocationPolicy;
const DEFAULT_TARGETS=Object.freeze([50,60,70,80]),STOCK_FEE_RATE=.001,PROPERTY_SALE_RATE=.97,COMPOUND_SCENARIO=stress.SCENARIOS.find(row=>row.id==='compoundShock')||stress.SCENARIOS.at(-1);
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const compactYen=modules.engine.compactYen||modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
function renderKey(value){let hash=2166136261;for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function whole(value){return Math.max(0,Math.floor(finite(value)));}
function metricsFor(instance){const result=stress.stressTest(instance),base=result.scenarios.find(row=>row.id==='base');return base?.metrics||{};}
function scoreForFunding(metrics,policyId,assetCash=0,borrowing=0){
 const cash=Math.max(0,finite(assetCash)),debtFunding=Math.max(0,finite(borrowing));
 const funded=stress.recalculate(metrics,{cash:Math.max(0,finite(metrics?.cash)+cash+debtFunding),debt:Math.max(0,finite(metrics?.debt)+debtFunding)}),stressed=stress.applyScenario(funded,COMPOUND_SCENARIO);
 return{score:policy.executionScore(policyId,stressed),fundedMetrics:funded,stressedMetrics:stressed,assetCash:cash,borrowing:debtFunding};
}
function sourceInventory(instance){
 const state=instance?.g||{},marketById=new Map((state.market||[]).map(row=>[row.id,row])),sources=[];
 for(const [stockId,holding] of Object.entries(state.companyStocks||{})){
  const stock=marketById.get(stockId),units=whole(holding?.qty),price=Math.max(0,finite(stock?.price));if(!stock||units<1||price<=0)continue;
  const averageCost=Math.max(0,finite(holding?.avg,price)),marketValue=price*units,carryingValue=averageCost*units,unitProceeds=price*(1-STOCK_FEE_RATE),proceeds=whole(unitProceeds*units);if(proceeds<=0)continue;
  sources.push({id:`stock:${stockId}`,sourceId:stockId,kind:'securities',kindName:'会社保有株式',name:stock.name||stockId,priority:1,discrete:false,units,price,averageCost,unitProceeds,unitMarketValue:price,unitCarryingValue:averageCost,proceeds,marketValue,carryingValue,gainLoss:proceeds-carryingValue});
 }
 for(const property of state.properties||[]){
  if(property?.owner!=='company')continue;
  const marketValue=Math.max(0,finite(property?.value,finite(property?.price))),carryingValue=Math.max(0,finite(property?.bookValue,finite(property?.purchasePrice,marketValue))),proceeds=whole(marketValue*PROPERTY_SALE_RATE);if(proceeds<=0)continue;
  sources.push({id:`property:${property.id}`,sourceId:property.id,kind:'properties',kindName:'会社不動産',name:property.name||'会社不動産',priority:2,discrete:true,units:1,unitProceeds:proceeds,unitMarketValue:marketValue,unitCarryingValue:carryingValue,proceeds,marketValue,carryingValue,gainLoss:proceeds-carryingValue});
 }
 sources.sort((a,b)=>a.priority-b.priority||a.proceeds-b.proceeds||a.id.localeCompare(b.id));
 const totals={securities:0,properties:0};for(const row of sources)totals[row.kind]+=row.proceeds;
 const companyValue=Math.max(0,finite(instance?.companyValue?.(),finite(state.companyCash)-finite(state.companyDebt))),currentDebt=Math.max(0,finite(state.companyDebt)),creditLimit=Math.max(0,finite(instance?.companyCreditLimit?.(),0)),creditFactor=companyValue>0?clamp(creditLimit/companyValue,0,2):0,debtCapacity=Math.max(0,whole(creditLimit-currentDebt));
 const excludedProducts=(state.productVentures||[]).filter(row=>row&&row.status!=='sold').length;
 return{week:Math.max(1,whole(state.week)||1),companyValue,currentDebt,creditLimit,creditFactor,debtCapacity,totals,assetCapacity:totals.securities+totals.properties,sources,excludedOperatingAssets:{products:excludedProducts,businesses:0,total:excludedProducts}};
}
function allocationFrom(selected,desiredAmount){
 const byKind={securities:0,properties:0};let proceeds=0,marketValue=0,carryingValue=0;
 for(const row of selected){proceeds+=row.selectedProceeds;marketValue+=row.selectedMarketValue;carryingValue+=row.selectedCarryingValue;byKind[row.kind]+=row.selectedProceeds;}
 const desired=Number.isFinite(Number(desiredAmount))?Math.max(0,finite(desiredAmount)):Number.POSITIVE_INFINITY;
 return{desiredAmount:desired,proceeds,marketValue,carryingValue,gainLoss:proceeds-carryingValue,marketValueChange:proceeds-marketValue,remaining:Number.isFinite(desired)?Math.max(0,desired-proceeds):null,selected,byKind};
}
function allocateSources(sources,desiredAmount,maxPriority=2){
 const desired=Number.isFinite(Number(desiredAmount))?Math.max(0,finite(desiredAmount)):Number.POSITIVE_INFINITY,selected=[];let proceeds=0;
 for(const source of Array.isArray(sources)?sources:[]){
  if(source.priority>maxPriority||(Number.isFinite(desired)&&proceeds>=desired-.5))continue;
  let units=source.units,selectedProceeds=source.proceeds,selectedMarketValue=source.marketValue,selectedCarryingValue=source.carryingValue;
  const remaining=Number.isFinite(desired)?Math.max(0,desired-proceeds):Number.POSITIVE_INFINITY;
  if(!source.discrete&&remaining<source.proceeds){units=Math.max(1,Math.min(source.units,Math.ceil(remaining/Math.max(.000001,source.unitProceeds))));selectedProceeds=whole(units*source.unitProceeds);selectedMarketValue=units*source.unitMarketValue;selectedCarryingValue=units*source.unitCarryingValue;}
  if(selectedProceeds<=0)continue;
  selected.push({...source,selectedUnits:units,selectedProceeds,selectedMarketValue,selectedCarryingValue,selectedGainLoss:selectedProceeds-selectedCarryingValue});proceeds+=selectedProceeds;
 }
 return allocationFrom(selected,desired);
}
function appendSource(allocation,source){
 if(!source||allocation.selected.some(row=>row.id===source.id))return allocation;
 const selected=[...allocation.selected,{...source,selectedUnits:source.units,selectedProceeds:source.proceeds,selectedMarketValue:source.marketValue,selectedCarryingValue:source.carryingValue,selectedGainLoss:source.proceeds-source.carryingValue}];
 return allocationFrom(selected,allocation.desiredAmount);
}
function debtCapacityAfter(inventory,allocation){const projectedCompanyValue=Math.max(0,inventory.companyValue+allocation.marketValueChange),creditLimit=Math.max(0,projectedCompanyValue*inventory.creditFactor);return{projectedCompanyValue,creditLimit,capacity:Math.max(0,whole(creditLimit-inventory.currentDebt))};}
function minimumCashOnly(metrics,policyId,targetScore){
 const target=Math.round(clamp(targetScore,0,100)),base=scoreForFunding(metrics,policyId,0,0);if(base.score>=target)return{reachable:true,amount:0,baseScore:base.score,projectedScore:base.score};
 let low=0,high=Math.max(1_000_000,finite(metrics?.cash)*.25,finite(metrics?.debt)*.1),projection=base;
 for(let i=0;i<40;i++){projection=scoreForFunding(metrics,policyId,high,0);if(projection.score>=target)break;high*=2;}
 if(projection.score<target)return{reachable:false,amount:null,baseScore:base.score,projectedScore:projection.score};
 for(let i=0;i<52;i++){const mid=(low+high)/2;if(scoreForFunding(metrics,policyId,mid,0).score>=target)high=mid;else low=mid;}
 let amount=Math.max(0,Math.ceil(high));while(amount>0&&scoreForFunding(metrics,policyId,amount-1,0).score>=target)amount--;
 const final=scoreForFunding(metrics,policyId,amount,0);return{reachable:final.score>=target,amount,baseScore:base.score,projectedScore:final.score};
}
function minimumBorrowing(metrics,policyId,targetScore,assetCash,capacity){
 const target=Math.round(clamp(targetScore,0,100)),maxAmount=Math.max(0,whole(capacity)),base=scoreForFunding(metrics,policyId,assetCash,0);
 if(base.score>=target)return{reachable:true,amount:0,bestAmount:0,baseScore:base.score,projectedScore:base.score,maxScore:base.score,scoreAtCapacity:base.score};
 if(maxAmount<=0)return{reachable:false,amount:null,bestAmount:0,baseScore:base.score,projectedScore:base.score,maxScore:base.score,scoreAtCapacity:base.score};
 let previousAmount=0,low=null,high=null,bestAmount=0,maxScore=base.score;const segments=256;
 for(let i=1;i<=segments;i++){
  const amount=Math.min(maxAmount,Math.max(previousAmount+1,whole(maxAmount*i/segments))),next=scoreForFunding(metrics,policyId,assetCash,amount);
  if(next.score>maxScore||(next.score===maxScore&&amount<bestAmount)){maxScore=next.score;bestAmount=amount;}
  if(next.score>=target){low=previousAmount;high=amount;break;}previousAmount=amount;if(amount>=maxAmount)break;
 }
 const atCapacity=scoreForFunding(metrics,policyId,assetCash,maxAmount);if(atCapacity.score>maxScore){maxScore=atCapacity.score;bestAmount=maxAmount;}
 if(high===null)return{reachable:false,amount:null,bestAmount,baseScore:base.score,projectedScore:maxScore,maxScore,scoreAtCapacity:atCapacity.score};
 for(let i=0;i<52;i++){const mid=(low+high)/2;if(scoreForFunding(metrics,policyId,assetCash,mid).score>=target)high=mid;else low=mid;}
 let amount=Math.max(0,Math.min(maxAmount,Math.ceil(high)));while(amount>0&&scoreForFunding(metrics,policyId,assetCash,amount-1).score>=target)amount--;
 const final=scoreForFunding(metrics,policyId,assetCash,amount);return{reachable:final.score>=target,amount,bestAmount:amount,baseScore:base.score,projectedScore:final.score,maxScore:Math.max(maxScore,final.score),scoreAtCapacity:atCapacity.score};
}
function summarizePlan(target,policyRow,recovery,inventory,metrics,allocation,borrowingAnalysis,status,reason){
 const borrowing=borrowingAnalysis?.reachable?Math.max(0,finite(borrowingAnalysis.amount)):Math.max(0,finite(borrowingAnalysis?.bestAmount)),projection=scoreForFunding(metrics,policyRow.id,allocation.proceeds,borrowing),targetReached=projection.score>=target,planned={securities:allocation.byKind.securities,properties:allocation.byKind.properties,borrowing};
 const sequence=[...allocation.selected.map(row=>({id:row.id,kind:row.kind,name:row.name,amount:row.selectedProceeds,units:row.selectedUnits,discrete:row.discrete})),...(borrowing>0?[{id:'borrowing',kind:'borrowing',name:'会社借入',amount:borrowing,units:1,discrete:false}]:[])],creditAfterDisposals=debtCapacityAfter(inventory,allocation);
 return{week:inventory.week,targetScore:target,targetPolicy:policyRow.id,targetPolicyName:policyRow.name,currentPolicy:recovery.currentPolicy,currentPolicyName:recovery.currentPolicyName,policyWaitWeeks:policyRow.weeksUntilSwitch,policySwitchAllowed:policyRow.switchAllowed,status,targetReached,baseScore:policyRow.baseScore,projectedScore:projection.score,cashOnlyNeed:null,planned,totalFunding:allocation.proceeds+borrowing,assetFunding:allocation.proceeds,borrowing,disposalMarketValue:allocation.marketValue,disposalCarryingValue:allocation.carryingValue,disposalGainLoss:allocation.gainLoss,sequence,inventory,creditAfterDisposals,borrowingAnalysis:borrowingAnalysis||null,reason};
}
function fundingPlan(instance,targetScore=70){
 const target=Math.round(clamp(targetScore,0,100)),recovery=resilience.recoveryPlan(instance,target),inventory=sourceInventory(instance),metrics=metricsFor(instance),policyRow=recovery.eventual;
 if(!policyRow)return{week:inventory.week,targetScore:target,targetPolicy:null,targetPolicyName:'',currentPolicy:recovery.currentPolicy,currentPolicyName:recovery.currentPolicyName,policyWaitWeeks:recovery.weeksUntilSwitch,policySwitchAllowed:false,status:'unreachable',targetReached:false,baseScore:0,projectedScore:0,cashOnlyNeed:null,planned:{securities:0,properties:0,borrowing:0},totalFunding:0,assetFunding:0,borrowing:0,disposalMarketValue:0,disposalCarryingValue:0,disposalGainLoss:0,sequence:[],inventory,creditAfterDisposals:debtCapacityAfter(inventory,allocationFrom([],0)),borrowingAnalysis:null,reason:'到達可能な資本配分方針がありません。'};
 const cashNeed=minimumCashOnly(metrics,policyRow.id,target),desired=cashNeed.reachable?cashNeed.amount:Number.POSITIVE_INFINITY,empty=allocationFrom([],0),baseProjection=scoreForFunding(metrics,policyRow.id,0,0);
 if(baseProjection.score>=target){const result=summarizePlan(target,policyRow,recovery,inventory,metrics,empty,{reachable:true,amount:0,bestAmount:0,baseScore:baseProjection.score,projectedScore:baseProjection.score,maxScore:baseProjection.score,scoreAtCapacity:baseProjection.score},'noAction','追加調達なしで目標へ到達します。');return{...result,cashOnlyNeed:cashNeed};}
 let allocation=allocateSources(inventory.sources,desired,1),projection=scoreForFunding(metrics,policyRow.id,allocation.proceeds,0);
 if(projection.score>=target){const result=summarizePlan(target,policyRow,recovery,inventory,metrics,allocation,null,'liquidAssetRecovery','会社保有株式の売却だけで目標へ到達します。');return{...result,cashOnlyNeed:cashNeed};}
 let debtRoom=debtCapacityAfter(inventory,allocation),borrowing=minimumBorrowing(metrics,policyRow.id,target,allocation.proceeds,debtRoom.capacity);
 if(borrowing.reachable){const result=summarizePlan(target,policyRow,recovery,inventory,metrics,allocation,{...borrowing,capacity:debtRoom.capacity,creditLimit:debtRoom.creditLimit},'liquidPlusBorrowing','会社保有株式の売却後、負債影響を反映した借入で目標へ到達します。');return{...result,cashOnlyNeed:cashNeed};}
 const properties=inventory.sources.filter(row=>row.kind==='properties');let lastBorrowing={...borrowing,capacity:debtRoom.capacity,creditLimit:debtRoom.creditLimit};
 for(const property of properties){
  allocation=appendSource(allocation,property);projection=scoreForFunding(metrics,policyRow.id,allocation.proceeds,0);
  if(projection.score>=target){const result=summarizePlan(target,policyRow,recovery,inventory,metrics,allocation,null,'strategicAssetRecovery','会社保有株式に加えて会社不動産の売却が必要です。');return{...result,cashOnlyNeed:cashNeed};}
  debtRoom=debtCapacityAfter(inventory,allocation);borrowing=minimumBorrowing(metrics,policyRow.id,target,allocation.proceeds,debtRoom.capacity);lastBorrowing={...borrowing,capacity:debtRoom.capacity,creditLimit:debtRoom.creditLimit};
  if(borrowing.reachable){const result=summarizePlan(target,policyRow,recovery,inventory,metrics,allocation,lastBorrowing,'strategicAssetsPlusBorrowing','会社不動産の売却後、負債影響を再計算した借入で目標へ到達します。');return{...result,cashOnlyNeed:cashNeed};}
 }
 const result=summarizePlan(target,policyRow,recovery,inventory,metrics,allocation,lastBorrowing,'unreachable','非事業資産と有効な借入余力を用いても目標へ到達できません。');return{...result,cashOnlyNeed:cashNeed,targetReached:false};
}
function fundingFrontier(instance,targets=DEFAULT_TARGETS){const normalized=stress.normalizeTargets(targets),plans=normalized.map(target=>fundingPlan(instance,target)),rows=plans.map(plan=>({targetScore:plan.targetScore,status:plan.status,targetReached:plan.targetReached,targetPolicy:plan.targetPolicy,targetPolicyName:plan.targetPolicyName,projectedScore:plan.projectedScore,totalFunding:plan.totalFunding,assetFunding:plan.assetFunding,borrowing:plan.borrowing,policyWaitWeeks:plan.policyWaitWeeks,sequenceLength:plan.sequence.length}));return{week:plans[0]?.week??Math.max(1,whole(instance?.g?.week)||1),targets:normalized,rows,plans};}
EngineClass.prototype.capitalAllocationRecoveryFundingInventory=function(){return sourceInventory(this);};
EngineClass.prototype.capitalAllocationRecoveryFundingPlan=function(targetScore=70){return fundingPlan(this,targetScore);};
EngineClass.prototype.capitalAllocationRecoveryFundingFrontier=function(targets=DEFAULT_TARGETS){return fundingFrontier(this,targets);};
function render(instance=modules.playerEngineBridge?.getEngine?.()){
 if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';
 const plan=fundingPlan(instance,70),frontier=fundingFrontier(instance),inventory=plan.inventory,tone=plan.targetReached?'good':plan.status==='unreachable'?'bad':'warn',statusLabel=plan.targetReached?'資金計画成立':'資金計画未成立';
 const sourceRows=[['会社保有株式','securities',inventory.totals.securities],['会社不動産','properties',inventory.totals.properties],['会社借入','borrowing',inventory.debtCapacity]].map(([label,key,capacity])=>`<div class="stat"><span>${esc(label)}</span><strong>${plan.planned[key]>0?compactYen(plan.planned[key]):'利用なし'}</strong><small>利用可能 ${compactYen(capacity)}</small></div>`).join('');
 const sequence=plan.sequence.length?plan.sequence.map((row,index)=>`${index+1}. ${row.name} ${compactYen(row.amount)}`).join(' → '):'追加調達なし',frontierRows=frontier.rows.map(row=>`<div class="stat"><span>目標 ${row.targetScore}点</span><strong>${row.targetReached?compactYen(row.totalFunding):'到達不能'}</strong><small>${esc(row.targetPolicyName||'方針なし')}・資産 ${compactYen(row.assetFunding)}・借入 ${compactYen(row.borrowing)}</small></div>`).join(''),need=plan.cashOnlyNeed?.reachable?compactYen(plan.cashOnlyNeed.amount):'現金のみでは到達不能',gainLoss=plan.disposalGainLoss>=0?`売却益 ${compactYen(plan.disposalGainLoss)}`:`売却損 ${compactYen(Math.abs(plan.disposalGainLoss))}`;
 const key=renderKey(`${plan.week}|${plan.targetPolicy}|${plan.status}|${plan.projectedScore}|${plan.totalFunding}|${plan.policyWaitWeeks}|${plan.sequence.map(row=>`${row.id}:${row.amount}`).join('|')}|${frontier.rows.map(row=>`${row.targetScore}:${row.status}:${row.totalFunding}:${row.projectedScore}`).join('|')}`);
 return `<section class="card" data-capital-allocation-recovery-funding="1" data-capital-allocation-recovery-funding-render-key="${key}"><div class="card-head"><div><h2>資本耐性・資金調達計画</h2><p>非事業資産の換金と借入後の負債増加を同時に反映し、複合悪化後の目標到達性を再計算します。</p></div><span class="badge ${tone}">Phase 8D-14 · ${statusLabel}</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>目標方針</span><strong>${esc(plan.targetPolicyName||'到達方針なし')}</strong><small>${plan.policyWaitWeeks>0?`変更まであと${plan.policyWaitWeeks}週`:'変更可能'}</small></div><div class="stat"><span>現金のみの必要額</span><strong>${esc(need)}</strong></div><div class="stat"><span>計画後スコア</span><strong>${plan.projectedScore}点</strong><small>目標 ${plan.targetScore}点</small></div><div class="stat"><span>総調達額</span><strong>${compactYen(plan.totalFunding)}</strong></div><div class="stat"><span>売却損益</span><strong>${esc(gainLoss)}</strong></div></div><div class="kpi-grid mini">${sourceRows}</div><p><strong>結論：</strong>${esc(plan.reason)}</p><p><strong>実行順：</strong>${esc(sequence)}</p><p><strong>保守的除外：</strong>継続収益への影響を安全に再計算できない運営中プロダクト ${inventory.excludedOperatingAssets.products}件は資金源に含めていません。</p><div data-capital-allocation-recovery-funding-frontier="1"><h3>目標別の資金調達前線</h3><div class="kpi-grid mini">${frontierRows}</div></div></div></section>`;
}
let observer=null,scheduled=false;
function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-capital-allocation-recovery-funding]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-capital-allocation-recovery-funding-render-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-capital-allocation-recovery-funding-render-key')||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}const host=screen.querySelector?.('[data-capital-allocation-recovery-audit]')||screen.querySelector?.('[data-capital-allocation-resilience-memo]');if(host){host.insertAdjacentHTML?.('afterend',html);return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
modules.capitalAllocationRecoveryFunding=Object.freeze({DEFAULT_TARGETS,STOCK_FEE_RATE,PROPERTY_SALE_RATE,COMPOUND_SCENARIO,metricsFor,scoreForFunding,sourceInventory,allocationFrom,allocateSources,appendSource,debtCapacityAfter,minimumCashOnly,minimumBorrowing,summarizePlan,fundingPlan,fundingFrontier,renderKey,render,enhance,installUI,__installed:true});
installUI();
})(0);
