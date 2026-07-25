// Phase 8B-10: player-selectable refinancing term policy.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before treasury-refinancing-policy.js.');
if(!modules.playerDebtRefinancing?.__installed){
 const src=typeof document!=='undefined'?document.currentScript?.src:'';
 if(src&&!modules.__deferredTreasuryRefinancingPolicy){
  modules.__deferredTreasuryRefinancingPolicy=true;
  const retry=()=>{if(modules.playerDebtRefinancing?.__installed){const script=document.createElement('script');script.src=src;script.async=false;script.setAttribute('data-deferred-treasury-refinancing','');(document.head||document.documentElement).appendChild(script);}else setTimeout(retry,0);};
  setTimeout(retry,0);return;
 }
 throw new Error('player-debt-service.js must load before treasury-refinancing-policy.js.');
}
if(modules.treasuryRefinancingPolicy)throw new Error('treasury refinancing policy is already registered.');
const EngineClass=modules.engine.TycoonEngine;
const HISTORY_LIMIT=52,CHANGE_COOLDOWN_WEEKS=13;
const POLICIES=Object.freeze({
 short:Object.freeze({id:'short',name:'短期・負債圧縮',termWeeks:26,principalShare:.15,feeRate:.003,description:'満期頻度と元本返済は重いが、借換手数料を抑えます。'}),
 balanced:Object.freeze({id:'balanced',name:'標準',termWeeks:52,principalShare:.10,feeRate:.005,description:'返済負担と手数料のバランスを取ります。'}),
 long:Object.freeze({id:'long',name:'長期・流動性重視',termWeeks:104,principalShare:.075,feeRate:.008,description:'満期時の元本負担を軽くする代わりに、手数料が高くなります。'})
});
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function renderKey(value){let hash=2166136261;const text=String(value||'');for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36);}
function stateFor(instance){const state=instance?.g||instance||{},book=state.finance&&typeof state.finance==='object'?state.finance:(state.finance={}),raw=book.refinancingPolicy&&typeof book.refinancingPolicy==='object'?book.refinancingPolicy:{};const result=book.refinancingPolicy={policyID:'balanced',lastChangedWeek:-CHANGE_COOLDOWN_WEEKS,history:[],...raw};if(!POLICIES[result.policyID])result.policyID='balanced';result.lastChangedWeek=Math.floor(finite(result.lastChangedWeek,-CHANGE_COOLDOWN_WEEKS));result.history=Array.isArray(result.history)?result.history.filter(Boolean).slice(-HISTORY_LIMIT):[];return result;}
function snapshot(instance){const policyState=stateFor(instance),policy=POLICIES[policyState.policyID],refinancing=modules.playerDebtRefinancing.normalize(instance),week=integer(instance?.g?.week,1),cooldownRemaining=Math.max(0,CHANGE_COOLDOWN_WEEKS-(week-policyState.lastChangedWeek));return{policyState,policy,refinancing,week,cooldownRemaining,canChange:cooldownRemaining===0};}
function setPolicy(instance,policyID){const policy=POLICIES[policyID],view=snapshot(instance);if(!policy)return instance.fail?.('借換方針が見つかりません。')??false;if(view.policy.id===policy.id)return instance.fail?.('すでに選択中の借換方針です。')??false;if(!view.canChange)return instance.fail?.(`借換方針の再変更にはあと${view.cooldownRemaining}週必要です。`)??false;return instance.runTransaction(()=>{const state=instance.g,policyState=stateFor(instance),refinancing=modules.playerDebtRefinancing.normalize(instance),previous=policyState.policyID;refinancing.termWeeks=policy.termWeeks;refinancing.principalShare=policy.principalShare;refinancing.feeRate=policy.feeRate;policyState.policyID=policy.id;policyState.lastChangedWeek=integer(state.week,1);policyState.history.push({week:policyState.lastChangedWeek,from:previous,to:policy.id,termWeeks:policy.termWeeks,principalShare:policy.principalShare,feeRate:policy.feeRate});policyState.history=policyState.history.slice(-HISTORY_LIMIT);const reserve=modules.playerDebtMaturityReserve?.normalize?.(instance);if(reserve)reserve.lastCheckedWeek=-1;modules.playerDebtMaturityReserve?.evaluate?.(instance);instance.notify?.(`借換方針を「${policy.name}」へ変更しました。`,'success');return true;});}
EngineClass.prototype.refinancingPolicySnapshot=function(){return snapshot(this);};
EngineClass.prototype.setRefinancingPolicy=function(policyID){return setPolicy(this,policyID);};
Object.defineProperty(EngineClass.prototype,'__treasuryRefinancingPolicyInstalled',{value:true});
const compactYen=modules.engine.compactYen||((v)=>`${Math.round(finite(v)).toLocaleString('ja-JP')}円`);
function render(instance=modules.playerEngineBridge?.getEngine?.()){if(!instance?.g?.configured||instance.g.selectedTab!=='bank')return'';const view=snapshot(instance),debt=Math.max(0,finite(instance.g.companyDebt)),principal=Math.round(debt*view.refinancing.principalShare),fee=Math.round(debt*view.refinancing.feeRate),key=renderKey(`${view.policy.id}|${view.refinancing.termWeeks}|${view.refinancing.principalShare}|${view.refinancing.feeRate}|${view.cooldownRemaining}|${debt}|${principal}|${fee}`);const buttons=Object.values(POLICIES).map(p=>`<button class="btn small ${p.id===view.policy.id?'primary':'ghost'}" data-refinancing-policy="${p.id}" ${p.id===view.policy.id||!view.canChange?'disabled':''}>${esc(p.name)}</button>`).join('');return `<section class="card" data-refinancing-policy-ui="1" data-refinancing-policy-render-key="${key}"><div class="card-head"><div><h2>借換期間方針</h2><p>次回以降の借換期間、満期元本返済率、手数料率を選択します。満期日そのものは変更しません。</p></div><span class="badge good">Phase 8B-10</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>現在方針</span><strong>${esc(view.policy.name)}</strong></div><div class="stat"><span>借換期間</span><strong>${view.refinancing.termWeeks}週</strong></div><div class="stat"><span>満期元本目安</span><strong>${esc(compactYen(principal))}</strong></div><div class="stat"><span>手数料目安</span><strong>${esc(compactYen(fee))}</strong></div></div><p>${esc(view.policy.description)}${view.cooldownRemaining?` 再変更まであと${view.cooldownRemaining}週。`:''}</p><div class="button-row">${buttons}</div></div></section>`;}
let scheduled=false,observer=null,bound=false;
function enhance(){if(typeof document==='undefined')return false;const engine=modules.playerEngineBridge?.getEngine?.(),screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-refinancing-policy-ui]'),html=render(engine);if(!html){old?.remove?.();return false;}const desiredKey=(html.match(/data-refinancing-policy-render-key="([^"]+)"/)||[])[1]||'',currentKey=String(old?.getAttribute?.('data-refinancing-policy-render-key')||old?.dataset?.refinancingPolicyRenderKey||'');if(old&&currentKey===desiredKey)return false;if(old){old.outerHTML=html;return true;}screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:setTimeout)(()=>{scheduled=false;enhance();},0);}
function click(event){const button=event?.target?.closest?.('[data-refinancing-policy]'),engine=modules.playerEngineBridge?.getEngine?.();if(!button||button.disabled||!engine)return;event.preventDefault?.();if(engine.setRefinancingPolicy(String(button.dataset.refinancingPolicy||'')))schedule();}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!bound){root.addEventListener('click',click);bound=true;}if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
modules.treasuryRefinancingPolicy=Object.freeze({HISTORY_LIMIT,CHANGE_COOLDOWN_WEEKS,POLICIES,stateFor,snapshot,setPolicy,renderKey,render,enhance,installUI,__installed:true});
installUI();
})();