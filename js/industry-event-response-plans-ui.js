// Phase 8C.2 UI for industry event response plans.
(function(){'use strict';
const m=globalThis.__capitalismTycoonModules;
if(!m?.industryEventResponsePlans?.PLANS)throw new Error('industry-event-response-plans.js must load first');
if(!m?.playerEngineBridge?.getEngine)throw new Error('player-engine-bridge.js must load first');
if(m.industryEventResponsePlansUI)throw new Error('industry response plan UI already registered');
const bridge=m.playerEngineBridge,logic=m.industryEventResponsePlans;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const yen=m.engine.compactYen||m.engine.yen||(v=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`);
function render(x=bridge.getEngine?.()){if(!x?.g?.configured||x.g.selectedTab!=='market')return'';logic.ensure(x.g);const eid=logic.eventId(x.g),active=x.g.activeIndustryEventResponsePlan;if(!eid)return'';const buttons=Object.entries(logic.PLANS).map(([type,p])=>`<button class="btn ${type==='demandDefense'?'primary':'secondary'}" style="min-height:44px" data-industry-response-plan="${esc(type)}" ${active?'disabled':''}>${esc(p.title)} ${esc(yen(logic.cost(x.g,type)))}</button>`).join('');return`<section class="card" data-industry-response-plans><div class="card-head"><div><h2>業界イベント対応計画</h2><p>${active?`${esc(active.title)}を実行中。イベント終了時に自動失効します。`:'現在のイベントに対して1つの対応計画を選択できます。'}</p></div><span class="badge">${esc(eid)}</span></div><div class="card-body"><div class="button-row">${buttons}</div></div></section>`;}
let observer=null,scheduled=false;
function enhance(){if(typeof document==='undefined')return false;const screen=document.getElementById('screen');if(!screen)return false;const old=screen.querySelector?.('[data-industry-response-plans]'),html=render();if(!html){old?.remove?.();return false;}if(old)old.outerHTML=html;else screen.insertAdjacentHTML?.('beforeend',html);return true;}
function schedule(){if(scheduled)return;scheduled=true;(typeof queueMicrotask==='function'?queueMicrotask:fn=>setTimeout(fn,0))(()=>{scheduled=false;enhance();});}
function install(){if(typeof document==='undefined')return;document.addEventListener('click',event=>{const b=event.target.closest?.('[data-industry-response-plan]');if(!b)return;event.preventDefault();bridge.getEngine?.()?.activateIndustryEventResponsePlan?.(b.dataset.industryResponsePlan);schedule();},true);const root=document.getElementById('app');if(root&&!observer&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true});}schedule();}
m.industryEventResponsePlansUI=Object.freeze({render,enhance,install,__installed:true});install();
})();
