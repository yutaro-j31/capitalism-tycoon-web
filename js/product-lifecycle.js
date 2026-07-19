// Phase 8A-4: product lifecycle, technical debt, and maintenance policy.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must load before product-lifecycle.js.');
if(!modules.productInnovation?.__installed)throw new Error('player-engine-bridge.js must load before product-lifecycle.js.');
if(modules.productLifecycle)throw new Error('product lifecycle is already registered.');
const EngineClass=modules.engine.TycoonEngine,finance=modules.finance;
const VERSION=1,HISTORY_LIMIT=80,POLICIES=Object.freeze({
  lean:Object.freeze({id:'lean',name:'最低限保守',costRate:.004,debtDelta:3.2,qualityRisk:.55}),
  standard:Object.freeze({id:'standard',name:'標準保守',costRate:.009,debtDelta:.6,qualityRisk:.2}),
  intensive:Object.freeze({id:'intensive',name:'重点保守',costRate:.018,debtDelta:-3.5,qualityRisk:0})
});
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,finite(v,min)));
const integer=(v,d=0)=>Math.max(0,Math.floor(finite(v,d)));
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const compactYen=modules.engine.compactYen||((v)=>`${Math.round(finite(v)).toLocaleString('ja-JP')}円`);
function ensure(state){
  if(!state||typeof state!=='object')return state;
  state.productLifecycleVersion=Math.max(VERSION,integer(state.productLifecycleVersion));
  state.productLifecycleHistory=Array.isArray(state.productLifecycleHistory)?state.productLifecycleHistory.filter(Boolean).slice(0,HISTORY_LIMIT):[];
  state.lastProductLifecycleWeek=Math.max(0,integer(state.lastProductLifecycleWeek));
  for(const p of state.productVentures||[]){
    p.maintenancePolicy=POLICIES[p.maintenancePolicy]?p.maintenancePolicy:'standard';
    p.technicalDebt=clamp(p.technicalDebt,0,100);
    p.lifecycleAgeWeeks=Math.max(0,integer(p.lifecycleAgeWeeks));
    p.lastMaintenanceWeek=Math.max(0,integer(p.lastMaintenanceWeek));
    p.lifecycleIncidents=Math.max(0,integer(p.lifecycleIncidents));
  }
  return state;
}
function productFor(state,id){return (state.productVentures||[]).find(x=>String(x.id)===String(id))||null;}
function history(state,type,text,extra={}){const row={week:integer(state.week,1),type,text:String(text||''),...extra};state.productLifecycleHistory.unshift(row);state.productLifecycleHistory=state.productLifecycleHistory.slice(0,HISTORY_LIMIT);state.news=Array.isArray(state.news)?state.news:[];state.news.unshift(`第${row.week}週：${row.text}`);state.news=state.news.slice(0,300);return row;}
function weeklyCost(product,policy){const revenue=Math.max(0,finite(product.revenue));const floor=product.origin==='founderHome'?20_000:120_000;return Math.round(Math.max(floor,revenue*policy.costRate));}
function riskBand(debt){return debt>=80?'危機':debt>=55?'高':debt>=30?'中':'低';}
function validate(state){ensure(state);const errors=[];for(const p of state.productVentures||[]){if(!POLICIES[p.maintenancePolicy])errors.push(`invalid maintenance policy ${p.id}`);if(!Number.isFinite(p.technicalDebt)||p.technicalDebt<0||p.technicalDebt>100)errors.push(`invalid technical debt ${p.id}`);}return{ok:errors.length===0,errors};}
function install(){
  const proto=EngineClass.prototype;if(proto.__productLifecycleInstalled)return true;
  const baseNormalize=proto.normalize;proto.normalize=function(){baseNormalize.call(this);ensure(this.g);};
  proto.ensureProductLifecycleDefaults=function(){return ensure(this.g);};
  proto.setProductMaintenancePolicy=function(productID,policyID){return this.runTransaction(()=>{ensure(this.g);const product=productFor(this.g,productID),policy=POLICIES[policyID];if(!product||product.status!=='released'||!policy)return this.fail('公開済みプロダクトまたは保守方針が見つかりません。');product.maintenancePolicy=policy.id;history(this.g,'policyChanged',`${product.name}の保守方針を「${policy.name}」へ変更しました。`,{productID:String(product.id),policyID:policy.id});this.notify(`${product.name}の保守方針を変更しました。`,'success');return true;});};
  proto.updateProductLifecycleWeekly=function(){
    ensure(this.g);if(integer(this.g.lastProductLifecycleWeek)===integer(this.g.week))return[];this.g.lastProductLifecycleWeek=integer(this.g.week);const incidents=[];
    for(const product of (this.g.productVentures||[]).filter(x=>x.status==='released')){
      product.lifecycleAgeWeeks=integer(product.lifecycleAgeWeeks)+1;const policy=POLICIES[product.maintenancePolicy]||POLICIES.standard,cost=weeklyCost(product,policy),funnel=typeof this.ensureProductFunnel==='function'?this.ensureProductFunnel(product):null;
      const payable=Math.min(Math.max(0,finite(this.g.companyCash)),cost);if(payable>0){this.g.companyCash-=payable;finance.event(this.g,'researchAndDevelopment',payable,{cashEffect:-payable,profitEffect:-payable,assetEffect:0,sourceType:'productMaintenance',sourceID:String(product.id),operationID:`productMaintenance-${product.id}-${this.g.week}`,description:`${product.name} ${policy.name}`});}
      const fundingGap=cost>0?1-payable/cost:0,load=clamp(funnel?.serverLoad,0,2),burden=clamp(funnel?.supportBurden,0,1.5),agePressure=Math.max(0,product.lifecycleAgeWeeks-12)/30;
      product.technicalDebt=clamp(finite(product.technicalDebt)+policy.debtDelta+fundingGap*6+load*1.4+burden*.8+agePressure,0,100);product.lastMaintenanceWeek=integer(this.g.week);
      const debt=product.technicalDebt,incidentChance=policy.qualityRisk+(debt>=80?.35:debt>=55?.12:0)+fundingGap*.3;
      if(debt>=55&&Math.random()<incidentChance){product.lifecycleIncidents=integer(product.lifecycleIncidents)+1;product.quality=clamp(finite(product.quality)-1.5,0,100);if(funnel){funnel.churnRate=clamp(finite(funnel.churnRate,.08)+.003,.003,.28);funnel.supportBurden=clamp(finite(funnel.supportBurden,.1)+.03,0,1.5);}const row=history(this.g,'maintenanceIncident',`${product.name}で保守障害が発生しました。品質が低下し、解約率とサポート負荷が上昇しました。`,{productID:String(product.id),technicalDebt:debt});incidents.push(row);}
      if(product.lastInnovationWeek===integer(this.g.week))product.technicalDebt=clamp(product.technicalDebt-18,0,100);
    }
    return incidents;
  };
  const baseWeekly=proto.updateProductInnovationWeekly;proto.updateProductInnovationWeekly=function(){const result=baseWeekly.call(this);this.updateProductLifecycleWeekly();return result;};
  Object.defineProperty(proto,'__productLifecycleInstalled',{value:true});return true;
}
function renderSection(instance=modules.playerEngineBridge?.getEngine?.()){
  if(!instance||!instance.g?.configured||instance.g.selectedTab!=='business')return'';ensure(instance.g);const products=(instance.g.productVentures||[]).filter(x=>x.status==='released');if(!products.length)return'';
  const rows=products.map(p=>{const policy=POLICIES[p.maintenancePolicy]||POLICIES.standard,cost=weeklyCost(p,policy);return `<article class="item"><div><h3>${esc(p.name)} <span class="badge">負債 ${finite(p.technicalDebt).toFixed(0)}</span></h3><p>リスク ${riskBand(p.technicalDebt)} · 稼働 ${integer(p.lifecycleAgeWeeks)}週 · 障害 ${integer(p.lifecycleIncidents)}件 · 今週保守 ${esc(compactYen(cost))}</p></div><div class="button-grid">${Object.values(POLICIES).map(x=>`<button class="btn small ${x.id===p.maintenancePolicy?'primary':'ghost'}" data-product-lifecycle-action="policy" data-product-id="${esc(p.id)}" data-policy-id="${x.id}">${esc(x.name)}</button>`).join('')}</div></article>`;}).join('');
  return `<section class="card" data-product-lifecycle-ui="1"><div class="card-head"><div><h2>プロダクト・ライフサイクル</h2><p>保守費を抑えるほど技術的負債と障害リスクが増加します。</p></div><span class="badge good">Phase 8A-4</span></div><div class="card-body"><div class="grid two">${rows}</div></div></section>`;
}
let observer=null,bound=false;function enhance(){if(typeof document==='undefined')return false;const engine=modules.playerEngineBridge?.getEngine?.(),screen=document.getElementById('screen');if(!engine||!screen)return false;const old=screen.querySelector?.('[data-product-lifecycle-ui]'),html=renderSection(engine);if(!html){old?.remove?.();return false;}if(old)old.outerHTML=html;else screen.insertAdjacentHTML?.('beforeend',html);return true;}
function handleClick(e){const t=e?.target?.closest?.('[data-product-lifecycle-action]'),engine=modules.playerEngineBridge?.getEngine?.();if(!t||!engine)return false;e.preventDefault?.();const ok=engine.setProductMaintenancePolicy(String(t.dataset.productId||''),String(t.dataset.policyId||''));if(ok)enhance();return Boolean(ok);}
function installUI(){if(typeof document==='undefined')return;const root=document.getElementById('app');if(root&&!bound){root.addEventListener('click',handleClick);bound=true;}if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(()=>enhance());observer.observe(root,{childList:true,subtree:true});}}
install();installUI();modules.productLifecycle=Object.freeze({VERSION,POLICIES,ensure,weeklyCost,riskBand,validate,renderSection,enhance,__installed:true});
})();
