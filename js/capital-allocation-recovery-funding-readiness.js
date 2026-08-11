// Phase 8D-17/18/27: read-only funding execution checklist synchronized with the selected recovery target.
(function install(attempt){
'use strict';attempt=Number.isFinite(Number(attempt))?Number(attempt):0;
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-recovery-funding-readiness.js.');
if(!modules.capitalAllocationRecoveryFundingOptions?.matrix||!modules.capitalAllocationRecoveryFunding?.fundingPlan){
 if(typeof document!=='undefined'&&attempt<50){setTimeout(()=>install(attempt+1),0);return;}
 throw new Error('recovery funding and funding options must load before capital-allocation-recovery-funding-readiness.js.');
}
if(modules.capitalAllocationRecoveryFundingReadiness)throw new Error('capital allocation recovery funding readiness module is already registered.');
const EngineClass=modules.engine.TycoonEngine,funding=modules.capitalAllocationRecoveryFunding,options=modules.capitalAllocationRecoveryFundingOptions;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const compactYen=modules.engine.compactYen||modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
function selectedTarget(instance){return Math.round(clamp(modules.capitalAllocationRecoveryFundingReconciliation?.targetFor?.(instance)??70,0,100));}
function hash(value){let out=2166136261;for(const char of String(value||'')){out^=char.charCodeAt(0);out=Math.imul(out,16777619);}return(out>>>0).toString(36);}
function normalizeOptionId(value){const id=String(value||'recommended');return options.OPTION_ORDER.includes(id)?id:null;}
function desiredAmount(plan){return plan?.cashOnlyNeed?.reachable?Math.max(0,finite(plan.cashOnlyNeed.amount)):Number.POSITIVE_INFINITY;}
function financeMarker(state){const rows=Array.isArray(state?.finance?.transactions)?state.finance.transactions:[],last=rows.at(-1)||null;return{baselineTransactionCount:rows.length,baselineLastTransactionId:String(last?.transactionID||last?.id||'')};}
function allocationForOption(instance,plan,optionId){
 const inventory=plan.inventory||funding.sourceInventory(instance),desired=desiredAmount(plan);
 if(optionId==='noNewDebt')return funding.allocateSources(inventory.sources,desired,2);
 if(optionId==='preserveProperty')return funding.allocateSources(inventory.sources,desired,1);
 if(optionId==='borrowOnly')return funding.allocationFrom([],0);
 const selected=[];
 for(const step of plan.sequence||[]){
  if(step.kind==='borrowing')continue;
  const source=inventory.sources.find(row=>row.id===step.id);if(!source)continue;
  const units=Math.max(1,Math.min(source.units,Math.floor(finite(step.units,source.units)))),selectedProceeds=Math.max(0,finite(step.amount));
  const selectedMarketValue=source.discrete?source.marketValue:units*source.unitMarketValue,selectedCarryingValue=source.discrete?source.carryingValue:units*source.unitCarryingValue;
  selected.push({...source,selectedUnits:units,selectedProceeds,selectedMarketValue,selectedCarryingValue,selectedGainLoss:selectedProceeds-selectedCarryingValue});
 }
 return funding.allocationFrom(selected,plan.assetFunding);
}
function sourceSignature(instance,allocation){
 const state=instance?.g||{},market=new Map((state.market||[]).map(row=>[row.id,row]));
 return(allocation.selected||[]).map(row=>{
  if(row.kind==='securities'){
   const holding=state.companyStocks?.[row.sourceId]||{},stock=market.get(row.sourceId)||{};
   return{id:row.id,kind:row.kind,sourceId:row.sourceId,units:Math.max(0,Math.floor(finite(row.selectedUnits))),amount:Math.max(0,finite(row.selectedProceeds)),price:Math.max(0,finite(stock.price)),holdingUnits:Math.max(0,Math.floor(finite(holding.qty))),averageCost:Math.max(0,finite(holding.avg))};
  }
  const property=(state.properties||[]).find(item=>item.id===row.sourceId)||{},books=funding.propertyCarryingValue(state,property);
  return{id:row.id,kind:row.kind,sourceId:row.sourceId,units:1,amount:Math.max(0,finite(row.selectedProceeds)),owner:String(property.owner||''),marketValue:Math.max(0,finite(property.value,finite(property.price))),landCarryingValue:books.landCarryingValue,buildingCarryingValue:books.buildingCarryingValue,buildingAssetCount:books.buildingAssetCount};
 }).sort((a,b)=>a.id.localeCompare(b.id));
}
function checklist(instance,plan,row,allocation){
 const steps=[],switchRequired=plan.targetPolicy!==plan.currentPolicy;
 if(switchRequired)steps.push({id:'policy',kind:'policy',label:`資本配分方針を「${plan.targetPolicyName}」へ変更`,ready:Boolean(plan.policySwitchAllowed),waitWeeks:Math.max(0,Math.floor(finite(plan.policyWaitWeeks))),amount:0});
 for(const source of allocation.selected||[]){
  if(source.kind==='securities')steps.push({id:source.id,kind:'securities',sourceId:source.sourceId,label:`${source.name}を${Math.floor(finite(source.selectedUnits)).toLocaleString('ja-JP')}株売却`,ready:true,units:Math.floor(finite(source.selectedUnits)),amount:Math.max(0,finite(source.selectedProceeds))});
  if(source.kind==='properties')steps.push({id:source.id,kind:'properties',sourceId:source.sourceId,label:`${source.name}を売却`,ready:true,units:1,amount:Math.max(0,finite(source.selectedProceeds))});
 }
 if(row.borrowing>0)steps.push({id:'borrowing',kind:'borrowing',label:'会社借入を実行',ready:row.borrowing<=row.borrowingCapacity+.5,units:1,amount:Math.max(0,finite(row.borrowing)),capacity:Math.max(0,finite(row.borrowingCapacity))});
 if(!steps.length)steps.push({id:'noAction',kind:'noAction',label:'追加調達は不要',ready:true,units:0,amount:0});
 return steps.map((step,index)=>({...step,order:index+1}));
}
function snapshot(instance,targetScore=70,optionId='recommended'){
 const target=Math.round(clamp(targetScore,0,100)),normalizedOptionId=normalizeOptionId(optionId),state=instance?.g||{},week=Math.max(1,Math.floor(finite(state.week,1))),blockers=[];
 if(!state.publicCompany)blockers.push({id:'notPublic',message:'上場後に利用できます。'});
 const matrix=options.matrix(instance,target),row=normalizedOptionId?matrix.rows.find(item=>item.id===normalizedOptionId):null,plan=funding.fundingPlan(instance,target);
 if(!normalizedOptionId)blockers.push({id:'unknownOption',message:'指定した資金調達案がありません。'});
 if(!row)blockers.push({id:'optionUnavailable',message:'現在の状態では資金調達案を作成できません。'});
 if(row&&!row.targetReached)blockers.push({id:'targetUnreachable',message:`「${row.name}」では目標${target}点へ到達できません。`});
 if(row&&plan.targetPolicy!==plan.currentPolicy&&!plan.policySwitchAllowed)blockers.push({id:'policyCooldown',message:`方針変更まであと${Math.max(0,Math.floor(finite(plan.policyWaitWeeks)))}週必要です。`});
 if(row&&row.borrowing>row.borrowingCapacity+.5)blockers.push({id:'borrowingCapacity',message:'必要借入額が現在の借入余力を超えています。'});
 const allocation=row?allocationForOption(instance,plan,row.id):funding.allocationFrom([],0),sources=sourceSignature(instance,allocation),steps=row?checklist(instance,plan,row,allocation):[],ready=Boolean(row?.targetReached&&blockers.length===0),status=ready?'ready':blockers.some(item=>item.id==='policyCooldown')?'waitPolicy':row?'blocked':'unavailable',marker=financeMarker(state);
 const payload={week,targetScore:target,optionId:row?.id??normalizedOptionId,targetPolicy:plan.targetPolicy,currentPolicy:plan.currentPolicy,policyWaitWeeks:Math.max(0,Math.floor(finite(plan.policyWaitWeeks))),baselineCash:finite(state.companyCash),baselineDebt:Math.max(0,finite(state.companyDebt)),...marker,projectedScore:row?.projectedScore??null,totalFunding:row?.totalFunding??null,assetFunding:row?.assetFunding??null,borrowing:row?.borrowing??null,borrowingCapacity:row?.borrowingCapacity??null,sources};
 const fingerprint=hash(JSON.stringify(payload));
 return{...payload,fingerprint,optionName:row?.name??'',targetPolicyName:plan.targetPolicyName||'',currentPolicyName:plan.currentPolicyName||'',targetReached:Boolean(row?.targetReached),ready,status,blockers,steps,sourceCount:sources.length,reason:ready?'現在の状態で手順を開始できます。':blockers[0]?.message||'実行条件を確認できません。'};
}
function validateSnapshot(instance,previous){
 const source=previous&&typeof previous==='object'?previous:{},current=snapshot(instance,source.targetScore,source.optionId),reasons=[];
 if(!source.fingerprint)reasons.push({id:'missingFingerprint',message:'検証対象の計画識別子がありません。'});
 if(finite(source.week)!==current.week)reasons.push({id:'weekChanged',message:'週が進行しました。'});
 if(String(source.currentPolicy||'')!==String(current.currentPolicy||''))reasons.push({id:'policyChanged',message:'現在の資本配分方針が変わりました。'});
 if(String(source.targetPolicy||'')!==String(current.targetPolicy||''))reasons.push({id:'targetPolicyChanged',message:'推奨される回復方針が変わりました。'});
 if(finite(source.baselineCash)!==finite(current.baselineCash))reasons.push({id:'cashChanged',message:'会社現金が変わりました。'});
 if(finite(source.baselineDebt)!==finite(current.baselineDebt))reasons.push({id:'debtChanged',message:'会社借入残高が変わりました。'});
 if(Math.floor(finite(source.baselineTransactionCount,-1))!==current.baselineTransactionCount||String(source.baselineLastTransactionId||'')!==current.baselineLastTransactionId)reasons.push({id:'financeHistoryChanged',message:'会計取引履歴が変わりました。'});
 if(finite(source.totalFunding,-1)!==finite(current.totalFunding,-1)||finite(source.borrowing,-1)!==finite(current.borrowing,-1))reasons.push({id:'fundingChanged',message:'必要な売却・借入額が変わりました。'});
 if(finite(source.borrowingCapacity,-1)!==finite(current.borrowingCapacity,-1))reasons.push({id:'borrowingCapacityChanged',message:'借入余力が変わりました。'});
 if(JSON.stringify(source.sources||[])!==JSON.stringify(current.sources||[]))reasons.push({id:'sourcesChanged',message:'市場価格、保有量、または不動産の状態が変わりました。'});
 if(String(source.fingerprint||'')!==current.fingerprint&&!reasons.length)reasons.push({id:'fingerprintChanged',message:'計画の前提条件が変わりました。'});
 return{valid:reasons.length===0,executable:current.ready,stale:reasons.length>0,reasons,currentFingerprint:current.fingerprint,previousFingerprint:String(source.fingerprint||''),current};
}
EngineClass.prototype.capitalAllocationRecoveryFundingReadiness=function(targetScore=70,optionId='recommended'){return snapshot(this,targetScore,optionId);};
EngineClass.prototype.validateCapitalAllocationRecoveryFundingSnapshot=function(previous){return validateSnapshot(this,previous);};
function render(instance=modules.playerEngineBridge?.getEngine?.()){
 if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';
 const target=selectedTarget(instance),value=snapshot(instance,target,'recommended'),tone=value.ready?'good':value.status==='waitPolicy'?'warn':'bad',stepRows=value.steps.map(step=>`<div class="stat"><span>${step.order}. ${esc(step.label)}</span><strong>${step.ready?'確認済み':'待機'}</strong><small>${step.amount>0?compactYen(step.amount):step.waitWeeks>0?`あと${step.waitWeeks}週`:'金銭取引なし'}</small></div>`).join(''),blockerRows=value.blockers.map(row=>`<p><strong>停止条件：</strong>${esc(row.message)}</p>`).join('');
 return `<section class="card" data-capital-allocation-recovery-funding-readiness="1" data-capital-allocation-recovery-funding-readiness-key="${value.fingerprint}"><div class="card-head"><div><h2>回復資金・実行前確認</h2><p>選択した目標に対して現在の価格・保有量・借入余力を固定し、手動実行前に計画の有効性を確認します。</p></div><span class="badge ${tone}">Phase 8D-18 · ${value.targetScore}点 · ${value.ready?'実行準備完了':value.status==='waitPolicy'?'方針変更待ち':'再計画'}</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>対象案</span><strong>${esc(value.optionName||'現行推奨')}</strong></div><div class="stat"><span>目標スコア</span><strong>${value.targetScore}点</strong></div><div class="stat"><span>計画識別子</span><strong>${esc(value.fingerprint)}</strong></div><div class="stat"><span>計画後スコア</span><strong>${value.projectedScore??'-'}点</strong></div><div class="stat"><span>総調達額</span><strong>${compactYen(value.totalFunding||0)}</strong></div></div><h3>手動実行チェックリスト</h3><div class="kpi-grid mini">${stepRows}</div>${blockerRows}<p><strong>判定：</strong>${esc(value.reason)}</p><p><small>週・方針・価格・保有量・不動産・借入余力・会計取引履歴が変わった場合、この識別子は無効になります。</small></p></div></section>`;
}

function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-capital-allocation-recovery-funding-readiness]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-capital-allocation-recovery-funding-readiness-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-capital-allocation-recovery-funding-readiness-key')||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}const host=screen.querySelector?.('[data-capital-allocation-recovery-funding-options]');if(host){host.insertAdjacentHTML?.('afterend',html);return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){enhance();}
let registeredEnhancerDefinition=null;
function registerEnhancer(definition){if(registeredEnhancerDefinition)return registeredEnhancerDefinition;registeredEnhancerDefinition=definition;const registry=modules.uiEnhancerRegistry;if(registry?.registerUIEnhancer)return registry.registerUIEnhancer(definition);const key='__capitalismTycoonPendingUIEnhancers';const pending=Array.isArray(globalThis[key])?globalThis[key]:(globalThis[key]=[]);pending.push(definition);return definition;}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');registerEnhancer({id:'capital-allocation-recovery-funding-readiness',enhance:enhance});schedule();}
modules.capitalAllocationRecoveryFundingReadiness=Object.freeze({selectedTarget,normalizeOptionId,desiredAmount,financeMarker,allocationForOption,sourceSignature,checklist,snapshot,validateSnapshot,render,enhance,installUI,__installed:true});
installUI();
})(0);
