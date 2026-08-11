// Phase 8D-15/16/27: deterministic recovery-funding alternatives synchronized with the selected recovery target.
(function install(attempt){
'use strict';attempt=Number.isFinite(Number(attempt))?Number(attempt):0;
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-recovery-funding-options.js.');
if(!modules.capitalAllocationRecoveryFunding?.fundingPlan||!modules.capitalAllocationRecoveryFunding?.minimumBorrowing){
 if(typeof document!=='undefined'&&attempt<50){setTimeout(()=>install(attempt+1),0);return;}
 throw new Error('capital allocation recovery funding must load before capital-allocation-recovery-funding-options.js.');
}
if(modules.capitalAllocationRecoveryFundingOptions)throw new Error('capital allocation recovery funding options module is already registered.');
const EngineClass=modules.engine.TycoonEngine,funding=modules.capitalAllocationRecoveryFunding,stress=modules.capitalAllocationStressTest;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const compactYen=modules.engine.compactYen||modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
const OPTION_ORDER=Object.freeze(['recommended','noNewDebt','preserveProperty','borrowOnly']);
function selectedTarget(instance){return Math.round(clamp(modules.capitalAllocationRecoveryFundingReconciliation?.targetFor?.(instance)??70,0,100));}
function renderKey(value){let hash=2166136261;for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function borrowingAmount(analysis){if(!analysis)return 0;if(analysis.reachable)return Math.max(0,finite(analysis.amount));return Math.max(0,finite(analysis.bestAmount));}
function selectedProfile(allocation){const selected=Array.isArray(allocation?.selected)?allocation.selected:[],propertyCount=selected.filter(row=>row.kind==='properties').length,stockUnits=selected.filter(row=>row.kind==='securities').reduce((sum,row)=>sum+Math.max(0,Math.floor(finite(row.selectedUnits))),0);return{propertyCount,stockUnits,stepCount:selected.length};}
function statusFor(targetReached,assetFunding,borrowing,propertyCount){if(!targetReached)return'unreachable';if(assetFunding<=0&&borrowing<=0)return'noAction';if(propertyCount>0&&borrowing>0)return'propertyAndDebt';if(propertyCount>0)return'propertySale';if(assetFunding>0&&borrowing>0)return'liquidAndDebt';if(assetFunding>0)return'liquidSale';return'debtOnly';}
function optionFromAllocation(input){
 const {id,name,description,target,policyId,policyName,metrics,inventory,allocation,borrowingAnalysis}=input,borrowing=borrowingAmount(borrowingAnalysis),projection=funding.scoreForFunding(metrics,policyId,allocation.proceeds,borrowing),profile=selectedProfile(allocation),creditAfterDisposals=funding.debtCapacityAfter(inventory,allocation),targetReached=projection.score>=target;
 return{id,name,description,targetScore:target,targetPolicy:policyId,targetPolicyName:policyName,targetReached,status:statusFor(targetReached,allocation.proceeds,borrowing,profile.propertyCount),projectedScore:projection.score,totalFunding:allocation.proceeds+borrowing,assetFunding:allocation.proceeds,borrowing,borrowingCapacity:creditAfterDisposals.capacity,disposalMarketValue:allocation.marketValue,disposalCarryingValue:allocation.carryingValue,disposalGainLoss:allocation.gainLoss,propertyCount:profile.propertyCount,stockUnits:profile.stockUnits,stepCount:profile.stepCount+(borrowing>0?1:0),cashAfter:Math.max(0,finite(metrics?.cash)+allocation.proceeds+borrowing),debtAfter:Math.max(0,finite(metrics?.debt)+borrowing),creditAfterDisposals,borrowingAnalysis:borrowingAnalysis||null};
}
function recommendedOption(plan,metrics){
 const propertyCount=(plan.sequence||[]).filter(row=>row.kind==='properties').length,stockUnits=(plan.sequence||[]).filter(row=>row.kind==='securities').reduce((sum,row)=>sum+Math.max(0,Math.floor(finite(row.units))),0),assetFunding=Math.max(0,finite(plan.assetFunding)),borrowing=Math.max(0,finite(plan.borrowing)),targetReached=Boolean(plan.targetReached);
 return{id:'recommended',name:'現行推奨',description:'現在の回復資金計画が採用する順序です。',targetScore:plan.targetScore,targetPolicy:plan.targetPolicy,targetPolicyName:plan.targetPolicyName,targetReached,status:statusFor(targetReached,assetFunding,borrowing,propertyCount),projectedScore:plan.projectedScore,totalFunding:plan.totalFunding,assetFunding,borrowing,borrowingCapacity:Math.max(0,finite(plan.creditAfterDisposals?.capacity,plan.inventory?.debtCapacity)),disposalMarketValue:Math.max(0,finite(plan.disposalMarketValue)),disposalCarryingValue:Math.max(0,finite(plan.disposalCarryingValue)),disposalGainLoss:finite(plan.disposalGainLoss),propertyCount,stockUnits,stepCount:(plan.sequence||[]).length,cashAfter:Math.max(0,finite(metrics?.cash)+assetFunding+borrowing),debtAfter:Math.max(0,finite(metrics?.debt)+borrowing),creditAfterDisposals:plan.creditAfterDisposals||null,borrowingAnalysis:plan.borrowingAnalysis||null};
}
function compareBy(fields){return(a,b)=>{for(const [field,direction] of fields){const av=finite(a?.[field]),bv=finite(b?.[field]);if(av!==bv)return direction==='desc'?bv-av:av-bv;}return OPTION_ORDER.indexOf(a.id)-OPTION_ORDER.indexOf(b.id)||a.id.localeCompare(b.id);};}
function leader(rows,fields,filter=()=>true){const candidates=(rows||[]).filter(row=>row.targetReached&&filter(row));return candidates.sort(compareBy(fields))[0]||null;}
function tradeoffLeaders(rows){return{
 leastBorrowing:leader(rows,[['borrowing','asc'],['propertyCount','asc'],['disposalMarketValue','asc'],['totalFunding','asc']]),
 leastAssetSale:leader(rows,[['disposalMarketValue','asc'],['propertyCount','asc'],['borrowing','asc'],['totalFunding','asc']]),
 lowestTotalFunding:leader(rows,[['totalFunding','asc'],['borrowing','asc'],['disposalMarketValue','asc']]),
 highestScore:leader(rows,[['projectedScore','desc'],['borrowing','asc'],['disposalMarketValue','asc']]),
 propertyPreserving:leader(rows,[['borrowing','asc'],['disposalMarketValue','asc'],['totalFunding','asc']],row=>row.propertyCount===0)
 };
}
function matrix(instance,targetScore=70){
 const target=Math.round(clamp(targetScore,0,100)),plan=funding.fundingPlan(instance,target),inventory=plan.inventory||funding.sourceInventory(instance),metrics=funding.metricsFor(instance);
 if(!plan.targetPolicy)return{week:inventory.week,targetScore:target,targetPolicy:null,targetPolicyName:'',rows:[],leaders:tradeoffLeaders([]),reachableCount:0,reason:'到達可能な回復方針がありません。'};
 const desired=plan.cashOnlyNeed?.reachable?Math.max(0,finite(plan.cashOnlyNeed.amount)):Number.POSITIVE_INFINITY,empty=funding.allocationFrom([],0),securities=funding.allocateSources(inventory.sources,desired,1),allAssets=funding.allocateSources(inventory.sources,desired,2),securitiesCredit=funding.debtCapacityAfter(inventory,securities),emptyCredit=funding.debtCapacityAfter(inventory,empty);
 const preserveBorrowing=funding.minimumBorrowing(metrics,plan.targetPolicy,target,securities.proceeds,securitiesCredit.capacity),borrowOnlyAnalysis=funding.minimumBorrowing(metrics,plan.targetPolicy,target,0,emptyCredit.capacity);
 const rows=[
  recommendedOption(plan,metrics),
  optionFromAllocation({id:'noNewDebt',name:'無借入',description:'会社保有株式と会社不動産だけで回復し、新規借入を行いません。',target,policyId:plan.targetPolicy,policyName:plan.targetPolicyName,metrics,inventory,allocation:allAssets,borrowingAnalysis:null}),
  optionFromAllocation({id:'preserveProperty',name:'不動産温存',description:'会社保有株式を先に換金し、会社不動産を売らずに不足分だけ借入します。',target,policyId:plan.targetPolicy,policyName:plan.targetPolicyName,metrics,inventory,allocation:securities,borrowingAnalysis:preserveBorrowing}),
  optionFromAllocation({id:'borrowOnly',name:'資産温存',description:'会社保有株式と会社不動産を売らず、借入だけで回復可能かを判定します。',target,policyId:plan.targetPolicy,policyName:plan.targetPolicyName,metrics,inventory,allocation:empty,borrowingAnalysis:borrowOnlyAnalysis})
 ];
 const leaders=tradeoffLeaders(rows),reachableCount=rows.filter(row=>row.targetReached).length;
 return{week:inventory.week,targetScore:target,targetPolicy:plan.targetPolicy,targetPolicyName:plan.targetPolicyName,rows,leaders,reachableCount,reason:reachableCount?`${reachableCount}案が目標へ到達します。`:'4案のいずれも目標へ到達できません。'};
}
function frontier(instance,targets=funding.DEFAULT_TARGETS||[50,60,70,80]){const normalized=stress.normalizeTargets(targets),matrices=normalized.map(target=>matrix(instance,target)),rows=matrices.map(value=>({targetScore:value.targetScore,reachableCount:value.reachableCount,leastBorrowing:value.leaders.leastBorrowing?.id??null,leastBorrowingName:value.leaders.leastBorrowing?.name??'',leastBorrowingAmount:value.leaders.leastBorrowing?.borrowing??null,leastAssetSale:value.leaders.leastAssetSale?.id??null,leastAssetSaleName:value.leaders.leastAssetSale?.name??'',leastAssetSaleAmount:value.leaders.leastAssetSale?.disposalMarketValue??null}));return{week:matrices[0]?.week??Math.max(1,Math.floor(finite(instance?.g?.week,1))),targets:normalized,rows,matrices};}
EngineClass.prototype.capitalAllocationRecoveryFundingOptions=function(targetScore=70){return matrix(this,targetScore);};
EngineClass.prototype.capitalAllocationRecoveryFundingOptionFrontier=function(targets=funding.DEFAULT_TARGETS||[50,60,70,80]){return frontier(this,targets);};
function render(instance=modules.playerEngineBridge?.getEngine?.()){
 if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';
 const target=selectedTarget(instance),value=matrix(instance,target),leaderRows=[['借入最少',value.leaders.leastBorrowing],['資産売却最少',value.leaders.leastAssetSale],['総調達額最少',value.leaders.lowestTotalFunding]].map(([label,row])=>`<div class="stat"><span>${label}</span><strong>${row?esc(row.name):'到達案なし'}</strong><small>${row?`借入 ${compactYen(row.borrowing)}・資産売却 ${compactYen(row.disposalMarketValue)}`:'構造改善が必要'}</small></div>`).join('');
 const optionRows=value.rows.map(row=>{const result=row.targetReached?`${row.projectedScore}点・到達`:`${row.projectedScore}点・未達`,gainLoss=row.disposalGainLoss>=0?`売却益 ${compactYen(row.disposalGainLoss)}`:`売却損 ${compactYen(Math.abs(row.disposalGainLoss))}`;return `<div class="stat"><span>${esc(row.name)}</span><strong>${result}</strong><small>資産 ${compactYen(row.assetFunding)}・借入 ${compactYen(row.borrowing)}・不動産 ${row.propertyCount}件・${gainLoss}</small></div>`;}).join('');
 const key=renderKey(`${value.week}|${value.targetScore}|${value.targetPolicy}|${value.rows.map(row=>`${row.id}:${row.targetReached}:${row.projectedScore}:${row.assetFunding}:${row.borrowing}:${row.propertyCount}:${row.disposalGainLoss}`).join('|')}`);
 return `<section class="card" data-capital-allocation-recovery-funding-options="1" data-capital-allocation-recovery-funding-options-render-key="${key}"><div class="card-head"><div><h2>回復資金・代替案比較</h2><p>選択した目標スコアに対し、借入と資産売却のトレードオフを比較します。自動売却・自動借入は行いません。</p></div><span class="badge ${value.reachableCount?'good':'bad'}">Phase 8D-16 · ${value.targetScore}点 · ${value.reachableCount}/4案到達</span></div><div class="card-body"><div class="kpi-grid mini">${optionRows}</div><h3>取締役会の比較軸</h3><div class="kpi-grid mini">${leaderRows}</div><p><strong>目標方針：</strong>${esc(value.targetPolicyName||'到達方針なし')} ／ <strong>目標：</strong>${value.targetScore}点</p></div></section>`;
}

function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-capital-allocation-recovery-funding-options]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-capital-allocation-recovery-funding-options-render-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-capital-allocation-recovery-funding-options-render-key')||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}const host=screen.querySelector?.('[data-capital-allocation-recovery-funding]');if(host){host.insertAdjacentHTML?.('afterend',html);return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){enhance();}
let registeredEnhancerDefinition=null;
function registerEnhancer(definition){if(registeredEnhancerDefinition)return registeredEnhancerDefinition;registeredEnhancerDefinition=definition;const registry=modules.uiEnhancerRegistry;if(registry?.registerUIEnhancer)return registry.registerUIEnhancer(definition);const key='__capitalismTycoonPendingUIEnhancers';const pending=Array.isArray(globalThis[key])?globalThis[key]:(globalThis[key]=[]);pending.push(definition);return definition;}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');registerEnhancer({id:'capital-allocation-recovery-funding-options',enhance:enhance});schedule();}
modules.capitalAllocationRecoveryFundingOptions=Object.freeze({OPTION_ORDER,selectedTarget,borrowingAmount,selectedProfile,statusFor,optionFromAllocation,recommendedOption,compareBy,leader,tradeoffLeaders,matrix,frontier,renderKey,render,enhance,installUI,__installed:true});
installUI();
})(0);
