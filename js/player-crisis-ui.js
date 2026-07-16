// Phase 6A-2B: mobile-safe crisis liquidity panel.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('engine.js must be loaded before player-crisis-ui.js.');
if(!modules.playerCrisisActions?.__installed)throw new Error('player-crisis-actions.js must be loaded before player-crisis-ui.js.');
if(modules.playerCrisisUI)throw new Error('player crisis UI module is already registered.');
const EngineClass=modules.engine.TycoonEngine,originalLoad=EngineClass.load.bind(EngineClass);
let instance=null,pending=false;
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const yen=value=>`${Math.round(Number(value)||0).toLocaleString('ja-JP')}円`;
const labels={watch:'資金繰り注意',distressed:'資金危機',turnaround:'再建中',recovered:'回復確認',insolvent:'支払不能'};
function render(){pending=false;if(!instance||!instance.g?.configured)return;const screen=document.querySelector('#screen');if(!screen)return;screen.querySelector('[data-player-crisis-panel]')?.remove();const options=instance.crisisLiquidityOptions(),status=options.status;if(status==='stable'||status==='insolvent')return;const panel=document.createElement('section');panel.className='card crisis-liquidity-panel';panel.dataset.playerCrisisPanel='true';panel.setAttribute('aria-live','polite');panel.innerHTML=`<div class="card-head"><div><h2>資金危機対応</h2><p>${esc(labels[status]||status)} · 会社現金 ${esc(yen(instance.g.companyCash))}</p></div><span class="badge ${status==='distressed'?'warn':''}">${esc(labels[status]||status)}</span></div><div class="card-body"><div class="kpi-grid mini"><div class="stat"><span>個人資金</span><strong>${esc(yen(options.founderAvailable))}</strong></div><div class="stat"><span>緊急与信枠</span><strong>${esc(yen(options.availableCredit))}</strong></div><div class="stat"><span>融資候補額</span><strong>${esc(yen(options.bridgeAmount))}</strong><small>${options.bridgeCooldownWeeksRemaining?`再申請まで${options.bridgeCooldownWeeksRemaining}週`:'申請可能'}</small></div></div><p>個人資金の注入は会社の資本、緊急融資は会社の負債として記録されます。</p><div class="button-row"><button class="btn primary" data-crisis-action="founder" ${options.canInjectFounder?'':'disabled'}>創業者資金を注入</button><button class="btn secondary" data-crisis-action="bridge" ${options.canRequestBridge?'':'disabled'}>緊急融資を申請</button></div></div>`;screen.prepend(panel);}
function schedule(){if(pending)return;pending=true;queueMicrotask(render);}
EngineClass.load=function(){instance=originalLoad();instance.addEventListener('change',schedule);instance.addEventListener('week',schedule);schedule();return instance;};
document.addEventListener('click',event=>{const button=event.target.closest('[data-crisis-action]');if(!button||button.disabled||!instance)return;if(button.dataset.crisisAction==='founder'){const available=Math.floor(Number(instance.g.personalCash)||0),raw=globalThis.prompt('会社へ注入する金額（円）',String(Math.min(available,3_000_000)));if(raw==null)return;const amount=Math.floor(Number(String(raw).replace(/,/g,'')));if(Number.isFinite(amount))instance.injectFounderCapital(amount);}else if(button.dataset.crisisAction==='bridge'&&globalThis.confirm('緊急ブリッジローンを実行しますか？'))instance.requestEmergencyBridgeLoan();schedule();});
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
modules.playerCrisisUI=Object.freeze({render,schedule,__installed:true});
})();
