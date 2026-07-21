// Phase 8D-15: read-only feasibility audit for manually executing a recovery funding plan.
(function install(attempt){
'use strict';attempt=Number.isFinite(Number(attempt))?Number(attempt):0;
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before capital-allocation-recovery-execution-audit.js.');
if(!modules.capitalAllocationRecoveryFunding?.fundingPlan||!modules.capitalAllocationPolicy?.POLICIES){
 if(typeof document!=='undefined'&&attempt<50){setTimeout(()=>install(attempt+1),0);return;}
 throw new Error('recovery funding and capital allocation policy modules must load before capital-allocation-recovery-execution-audit.js.');
}
if(modules.capitalAllocationRecoveryExecutionAudit)throw new Error('capital allocation recovery execution audit module is already registered.');
const EngineClass=modules.engine.TycoonEngine,funding=modules.capitalAllocationRecoveryFunding,policy=modules.capitalAllocationPolicy;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const compactYen=modules.engine.compactYen||modules.engine.yen||((value)=>`${Math.round(finite(value)).toLocaleString('ja-JP')}円`);
function renderKey(value){let hash=2166136261;for(const char of String(value||'')){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function closeEnough(a,b,tolerance=1){return Math.abs(finite(a)-finite(b))<=Math.max(0,finite(tolerance,1));}
function currentPolicy(instance){const id=instance?.g?.finance?.capitalAllocationPolicy?.id;return policy.POLICIES[id]?id:'balanced';}
function policyWait(instance){const state=instance?.g||{},week=Math.max(1,Math.floor(finite(state.week,1))),changed=Math.floor(finite(state.finance?.capitalAllocationPolicy?.lastChangedWeek,-999));return Math.max(0,policy.COOLDOWN_WEEKS-(week-changed));}
function step(id,kind,name,status,reason,extra={}){const statusLabel={satisfied:'完了',ready:'実行可能',cooldown:'待機',stale:'再計算必要',unavailable:'実行不能',unreachable:'到達不能'}[status]||status;return{id,kind,name,status,statusLabel,reason,amount:0,units:0,engineMethod:null,dependsOn:[],canExecuteNow:false,...extra};}
function policyAudit(instance,plan){
 const actual=currentPolicy(instance),target=plan.targetPolicy,week=Math.max(1,Math.floor(finite(instance?.g?.week,1))),wait=policyWait(instance);
 if(!target||!policy.POLICIES[target])return step('policy','policy','資本配分方針','unavailable','目標方針がありません。',{actualPolicy:actual,targetPolicy:target});
 if(actual===target)return step('policy','policy',`方針「${policy.POLICIES[target].name}」`,'satisfied','目標方針へ設定済みです。',{engineMethod:'setCapitalAllocationPolicy',actualPolicy:actual,targetPolicy:target});
 if(actual!==plan.currentPolicy)return step('policy','policy',`方針「${policy.POLICIES[target].name}」`,'stale','計画作成後に現在方針が変わりました。',{engineMethod:'setCapitalAllocationPolicy',actualPolicy:actual,targetPolicy:target});
 if(typeof instance?.setCapitalAllocationPolicy!=='function')return step('policy','policy',`方針「${policy.POLICIES[target].name}」`,'unavailable','方針変更APIが利用できません。',{engineMethod:'setCapitalAllocationPolicy',actualPolicy:actual,targetPolicy:target});
 if(wait>0)return step('policy','policy',`方針「${policy.POLICIES[target].name}」`,'cooldown',`あと${wait}週変更できません。`,{engineMethod:'setCapitalAllocationPolicy',actualPolicy:actual,targetPolicy:target,weeksUntilReady:wait,earliestWeek:week+wait});
 return step('policy','policy',`方針「${policy.POLICIES[target].name}」`,'ready','既存の方針変更APIで実行できます。',{engineMethod:'setCapitalAllocationPolicy',actualPolicy:actual,targetPolicy:target});
}
function securitiesAudit(instance,row,plannedSource,currentSource){
 const stockId=String(row.id||'').replace(/^stock:/,''),market=(instance?.g?.market||[]).find(item=>item.id===stockId),holding=instance?.g?.companyStocks?.[stockId],units=Math.max(0,Math.floor(finite(row.units))),name=row.name||plannedSource?.name||stockId;
 if(typeof instance?.sellStock!=='function')return step(row.id,'securities',name,'unavailable','会社保有株式の売却APIが利用できません。',{engineMethod:'sellStock',amount:row.amount,units,sourceId:stockId});
 if(!market||!holding||finite(holding.qty)<units||units<1)return step(row.id,'securities',name,'unavailable','現在の会社保有株数では計画数量を売却できません。',{engineMethod:'sellStock',amount:row.amount,units,sourceId:stockId,currentUnits:Math.max(0,Math.floor(finite(holding?.qty)))});
 const proceeds=Math.floor(Math.max(0,finite(market.price))*units*(1-funding.STOCK_FEE_RATE)),carryingValue=Math.max(0,finite(holding.avg,market.price))*units;
 const stale=!plannedSource||!currentSource||!closeEnough(proceeds,row.amount)||!closeEnough(proceeds,currentSource.unitProceeds*units)||!closeEnough(carryingValue,plannedSource.unitCarryingValue*units);
 if(stale)return step(row.id,'securities',name,'stale','価格、平均取得単価、または保有数量が計画作成時から変わりました。',{engineMethod:'sellStock',amount:row.amount,units,sourceId:stockId,currentProceeds:proceeds,currentCarryingValue:carryingValue});
 return step(row.id,'securities',name,'ready',`会社口座で${units.toLocaleString('ja-JP')}株を売却します。`,{engineMethod:'sellStock',amount:proceeds,units,sourceId:stockId,currentProceeds:proceeds,currentCarryingValue:carryingValue});
}
function propertyAudit(instance,row,plannedSource,currentSource){
 const propertyId=String(row.id||'').replace(/^property:/,''),property=(instance?.g?.properties||[]).find(item=>item.id===propertyId),name=row.name||plannedSource?.name||propertyId;
 if(typeof instance?.sellProperty!=='function')return step(row.id,'properties',name,'unavailable','会社不動産の売却APIが利用できません。',{engineMethod:'sellProperty',amount:row.amount,units:1,sourceId:propertyId});
 if(!property||property.owner!=='company')return step(row.id,'properties',name,'unavailable','対象不動産を会社が所有していません。',{engineMethod:'sellProperty',amount:row.amount,units:1,sourceId:propertyId});
 if(!plannedSource||!currentSource)return step(row.id,'properties',name,'stale','現在の不動産評価を再取得できません。',{engineMethod:'sellProperty',amount:row.amount,units:1,sourceId:propertyId});
 const stale=!closeEnough(currentSource.proceeds,row.amount)||!closeEnough(currentSource.carryingValue,plannedSource.carryingValue)||currentSource.buildingAssetCount!==plannedSource.buildingAssetCount||!closeEnough(currentSource.buildingCarryingValue,plannedSource.buildingCarryingValue);
 if(stale)return step(row.id,'properties',name,'stale','不動産価値、土地簿価、または建物簿価が計画作成時から変わりました。',{engineMethod:'sellProperty',amount:row.amount,units:1,sourceId:propertyId,currentProceeds:currentSource.proceeds,currentCarryingValue:currentSource.carryingValue,currentBuildingAssetCount:currentSource.buildingAssetCount});
 return step(row.id,'properties',name,'ready',`土地と稼働中建物${currentSource.buildingAssetCount}件を同時に売却・除却します。`,{engineMethod:'sellProperty',amount:currentSource.proceeds,units:1,sourceId:propertyId,currentProceeds:currentSource.proceeds,currentCarryingValue:currentSource.carryingValue,currentBuildingAssetCount:currentSource.buildingAssetCount});
}
function borrowingAudit(instance,row,plan,dependsOn){
 const amount=Math.max(0,finite(row.amount)),state=instance?.g||{},limit=Math.max(0,finite(instance?.companyCreditLimit?.(),0)),debt=Math.max(0,finite(state.companyDebt)),currentCapacity=Math.max(0,limit-debt),projectedCapacity=Math.max(0,finite(plan.creditAfterDisposals?.capacity,currentCapacity));
 if(typeof instance?.borrow!=='function')return step('borrowing','borrowing','会社借入','unavailable','会社借入APIが利用できません。',{engineMethod:'borrow',amount,units:1,dependsOn,currentCapacity,projectedCapacity});
 if(amount<=0)return step('borrowing','borrowing','会社借入','satisfied','借入は不要です。',{engineMethod:'borrow',amount:0,units:0,dependsOn,currentCapacity,projectedCapacity});
 if(amount>projectedCapacity+.5)return step('borrowing','borrowing','会社借入','stale','資産処分後の想定借入余力を計画額が超えています。',{engineMethod:'borrow',amount,units:1,dependsOn,currentCapacity,projectedCapacity});
 if(amount>currentCapacity+.5)return step('borrowing','borrowing','会社借入','stale','現在の借入限度では計画額を借り入れできません。',{engineMethod:'borrow',amount,units:1,dependsOn,currentCapacity,projectedCapacity});
 return step('borrowing','borrowing','会社借入','ready',`会社借入として${compactYen(amount)}を実行します。`,{engineMethod:'borrow',amount,units:1,dependsOn,currentCapacity,projectedCapacity,interestRate:Math.max(0,finite(instance?.companyBorrowRate?.(),0))});
}
function executionAuditFromPlan(instance,plan){
 const source=plan&&typeof plan==='object'?plan:{},state=instance?.g||{},week=Math.max(1,Math.floor(finite(state.week,1))),sameWeek=week===Math.max(1,Math.floor(finite(source.week,week))),currentInventory=funding.sourceInventory(instance),plannedById=new Map((source.inventory?.sources||[]).map(row=>[row.id,row])),currentById=new Map((currentInventory.sources||[]).map(row=>[row.id,row])),steps=[];
 const policyStep=policyAudit(instance,source);if(source.targetPolicy&&source.targetPolicy!==source.currentPolicy||currentPolicy(instance)!==source.targetPolicy)steps.push(policyStep);
 const assetIds=[];
 for(const row of source.sequence||[]){
  if(row.kind==='securities'){const next=securitiesAudit(instance,row,plannedById.get(row.id),currentById.get(row.id));steps.push(next);assetIds.push(next.id);}
  else if(row.kind==='properties'){const next=propertyAudit(instance,row,plannedById.get(row.id),currentById.get(row.id));steps.push(next);assetIds.push(next.id);}
  else if(row.kind==='borrowing')steps.push(borrowingAudit(instance,row,source,[...assetIds]));
 }
 if(!steps.length)steps.push(step('none','none','追加操作','satisfied','追加操作は不要です。'));
 if(!sameWeek)for(const row of steps){if(row.status==='ready')row.reason=`第${source.week}週の計画です。現在は第${week}週のため再計算してください。`;}
 let blocker=null;
 if(!source.targetReached)blocker='unreachable';
 else if(!sameWeek)blocker='stale';
 else if(steps.some(row=>row.status==='unavailable'))blocker='unavailable';
 else if(steps.some(row=>row.status==='stale'))blocker='stale';
 else if(steps.some(row=>row.status==='cooldown'))blocker='cooldown';
 const status=blocker||'ready',statusLabel={ready:'手動実行可能',cooldown:'方針変更待機',stale:'計画再計算',unavailable:'実行不能',unreachable:'目標未到達'}[status];
 let priorReady=true,nextStep=null;
 for(const row of steps){row.canExecuteNow=priorReady&&row.status==='ready'&&!nextStep;if(row.canExecuteNow)nextStep=row;if(!['satisfied','ready'].includes(row.status)||row.status==='ready')priorReady=false;}
 const destructiveSteps=steps.filter(row=>['securities','properties'].includes(row.kind)&&row.status!=='satisfied').length;
 return{week,planWeek:source.week??null,targetScore:source.targetScore??70,targetReached:Boolean(source.targetReached),targetPolicy:source.targetPolicy??null,targetPolicyName:source.targetPolicyName??'',sameWeek,status,statusLabel,canExecuteManually:status==='ready',automaticExecution:false,requiresConfirmation:destructiveSteps>0,destructiveSteps,nextStep,steps,plan:source};
}
function executionAudit(instance,targetScore=70){return executionAuditFromPlan(instance,funding.fundingPlan(instance,targetScore));}
EngineClass.prototype.capitalAllocationRecoveryExecutionAudit=function(targetScore=70){return executionAudit(this,targetScore);};
EngineClass.prototype.capitalAllocationRecoveryExecutionAuditFromPlan=function(plan){return executionAuditFromPlan(this,plan);};
function render(instance=modules.playerEngineBridge?.getEngine?.()){
 if(!instance?.g?.configured||instance.g.selectedTab!=='market'||!instance.g.publicCompany)return'';
 const value=executionAudit(instance,70),tone=value.status==='ready'?'good':value.status==='unreachable'||value.status==='unavailable'?'bad':'warn';
 const rows=value.steps.map((row,index)=>`<div class="stat"><span>${index+1}. ${esc(row.name)}</span><strong>${esc(row.statusLabel)}</strong><small>${esc(row.reason)}${row.amount>0?` · ${compactYen(row.amount)}`:''}</small></div>`).join('');
 const next=value.nextStep?`${value.nextStep.name}（${value.nextStep.engineMethod}）`:'現在実行できる操作はありません。';
 const summary=value.status==='ready'?'計画値と現在状態は一致しています。各操作を確認しながら手動で実行できます。':value.status==='cooldown'?'資本配分方針のクールダウン終了後に再監査してください。':value.status==='stale'?'価格、保有資産、簿価、週、または借入余力が変わっています。計画を再計算してください。':value.status==='unreachable'?'現在の資金源では目標スコアへ到達しません。':'必要な取引APIまたは資産が利用できません。';
 const key=renderKey(`${value.week}|${value.planWeek}|${value.status}|${value.targetPolicy}|${value.steps.map(row=>`${row.id}:${row.status}:${row.amount}:${row.units}`).join('|')}`);
 return `<section class="card" data-capital-allocation-recovery-execution-audit="1" data-capital-allocation-recovery-execution-audit-render-key="${key}"><div class="card-head"><div><h2>資金計画・実行監査</h2><p>計画値を既存の方針変更・株式売却・不動産売却・借入APIと照合します。</p></div><span class="badge ${tone}">Phase 8D-15 · ${esc(value.statusLabel)}</span></div><div class="card-body"><div class="kpi-grid mini">${rows}</div><p><strong>監査結論：</strong>${esc(summary)}</p><p><strong>次の操作：</strong>${esc(next)}</p><p><strong>安全制約：</strong>この監査は読み取り専用です。資産売却、借入、方針変更を自動実行しません。</p></div></section>`;
}
let observer=null,scheduled=false;
function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-capital-allocation-recovery-execution-audit]'),html=render();if(!html){old?.remove?.();return false;}const desired=(html.match(/data-capital-allocation-recovery-execution-audit-render-key="([^"]+)"/)||[])[1]||'',current=String(old?.getAttribute?.('data-capital-allocation-recovery-execution-audit-render-key')||'');if(old&&current===desired)return false;if(old){old.outerHTML=html;return true;}const host=screen.querySelector?.('[data-capital-allocation-recovery-funding]');if(host){host.insertAdjacentHTML?.('afterend',html);return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
modules.capitalAllocationRecoveryExecutionAudit=Object.freeze({closeEnough,currentPolicy,policyWait,step,policyAudit,securitiesAudit,propertyAudit,borrowingAudit,executionAuditFromPlan,executionAudit,renderKey,render,enhance,installUI,__installed:true});
installUI();
})(0);
