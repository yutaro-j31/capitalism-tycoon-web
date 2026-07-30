// Mobile-first real estate management UI for the assets screen.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.realEstate)throw new Error('real-estate.js must be loaded before real-estate-ui.js.');
if(!modules?.playerEngineBridge?.getEngine)throw new Error('player-engine-bridge.js must be loaded before real-estate-ui.js.');
if(modules.realEstateUI)throw new Error('real estate UI module is already registered.');
const bridge=modules.playerEngineBridge;
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const finite=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const money=v=>`${Math.round(finite(v)).toLocaleString('ja-JP')}円`;
const pct=v=>`${(finite(v)*100).toFixed(1)}%`;
function owned(engine){return (engine?.g?.properties||[]).filter(p=>p.owner==='company'||p.owner==='personal');}
function loanFor(engine,propertyID){return (engine?.g?.realEstate?.loans||[]).find(l=>l.propertyID===propertyID&&l.status==='active')||null;}
function latestEvent(engine,propertyID){return [...(engine?.g?.realEstate?.marketEvents||[])].reverse().find(e=>e.propertyID===propertyID)||null;}
function renderRow(engine,p){
 const m=engine.getPropertyInvestmentMetrics?.(p.id);if(!m)return '';
 const loan=loanFor(engine,p.id),event=latestEvent(engine,p.id),profile=m.marketProfile||engine.getPropertyMarketProfile?.(p.id),owner=p.owner==='company'?'会社':'個人',enabled=Boolean(p.realEstate?.rentalEnabled);
 const rentAction=enabled?`<button class="btn secondary small" data-real-estate-action="disable-rental" data-property-id="${esc(p.id)}">賃貸停止</button>`:`<button class="btn primary small" data-real-estate-action="enable-rental" data-property-id="${esc(p.id)}">賃貸開始</button>`;
 const borrow=m.collateralAvailable>10000?`<button class="btn secondary small" data-real-estate-action="borrow" data-property-id="${esc(p.id)}">担保借入</button>`:'';
 const repay=loan?`<button class="btn secondary small" data-real-estate-action="repay" data-loan-id="${esc(loan.loanID)}">一部返済</button>`:'';
 const sell=!loan?`<button class="btn danger small" data-real-estate-action="sell" data-property-id="${esc(p.id)}">売却</button>`:'<span class="badge warn">担保解除後に売却可</span>';
 const marketBadges=profile?`<span class="badge">${esc(profile.regionLabel)}</span><span class="badge">${esc(profile.propertyTypeLabel)}</span>`:'';
 const eventLine=event?`<p class="muted">直近イベント: ${esc(event.title)}（第${event.week}週・影響は第${event.untilWeek}週まで）${event.cost?` · 費用 ${money(event.cost)}`:''}</p>`:'';
 return `<article class="item real-estate-property" data-real-estate-property="${esc(p.id)}"><div><div class="button-row"><h3>${esc(p.name||p.id)}</h3><span class="badge">${owner}</span>${marketBadges}${enabled?'<span class="badge good">賃貸中</span>':'<span class="badge">未稼働</span>'}</div><p>${esc(p.buildingType||p.kind||'土地')} · 評価 ${money(m.valuation)}</p><div class="item-metrics"><span>土地 ${money(m.landValue)}</span><span>建物 ${money(m.buildingValue)}</span><span>稼働率 ${pct(m.occupancy)}</span><span>需要倍率 ${profile?pct(profile.demandMultiplier):'—'}</span><span>賃料倍率 ${profile?pct(profile.rentMultiplier):'—'}</span><span>表面利回り ${pct(m.grossYield)}</span><span>実質利回り ${pct(m.netYield)}</span><span>担保余力 ${money(m.collateralAvailable)}</span></div>${eventLine}${loan?`<p class="muted">借入残高 ${money(loan.outstandingPrincipal)} · 金利 ${pct(loan.interestRate)} · 残り${loan.remainingWeeks}週</p>`:''}</div><div class="button-row">${rentAction}${borrow}${repay}${sell}</div></article>`;
}
function render(engine){const rows=owned(engine),events=engine?.g?.realEstate?.marketEvents||[];return `<section class="card real-estate-manager" data-real-estate-manager><div class="card-head"><div><h2>不動産経営</h2><p>地域需要、用途特性、土地・建物評価、賃貸収支、担保融資を一括管理します。</p></div><span class="badge good">${rows.length}件</span></div><div class="card-body">${events.length?`<p class="muted">不動産市場イベント履歴 ${events.length}件</p>`:''}${rows.length?rows.map(p=>renderRow(engine,p)).join(''):'<div class="empty">保有物件はありません。資産タブの物件購入から取得できます。</div>'}</div></section>`;}
let queued=false,installed=false;
function inject(){queued=false;const engine=bridge.getEngine(),screen=document.querySelector('[data-screen="assets"]');if(!engine||!screen)return;const html=render(engine),current=screen.querySelector('[data-real-estate-manager]');if(current)current.outerHTML=html;else screen.insertAdjacentHTML('afterbegin',html);}
function queue(){if(queued)return;queued=true;(typeof queueMicrotask==='function'?queueMicrotask:fn=>setTimeout(fn,0))(inject);}
function act(button){const engine=bridge.getEngine();if(!engine)return;const id=button.dataset.propertyId,action=button.dataset.realEstateAction;
 if(action==='enable-rental'){const p=engine.g.properties.find(x=>x.id===id),monthly=Math.max(10000,Math.round(finite(p?.value,p?.price)*.004));engine.enablePropertyRental(id,{monthlyRent:monthly,targetOccupancy:.9});}
 else if(action==='disable-rental')engine.disablePropertyRental(id);
 else if(action==='borrow'){const m=engine.getPropertyInvestmentMetrics(id),amount=Math.floor(finite(m?.collateralAvailable)*.5);if(amount>0)engine.borrowAgainstProperty(id,amount,{termWeeks:260});}
 else if(action==='repay'){const loan=(engine.g.realEstate?.loans||[]).find(x=>x.loanID===button.dataset.loanId),cash=loan?.owner==='company'?engine.g.companyCash:engine.g.personalCash,amount=Math.min(finite(loan?.outstandingPrincipal),Math.max(0,Math.floor(finite(cash)*.1)));if(amount>0)engine.repayPropertyLoan(button.dataset.loanId,amount);}
 else if(action==='sell')engine.sellPropertyInvestment?.(id);
 engine.save?.();engine.emit?.();queue();
}
function install(){if(installed)return;installed=true;const app=document.getElementById('app');if(!app)return;if(typeof MutationObserver==='function')new MutationObserver(queue).observe(app,{childList:true,subtree:true});document.addEventListener('click',event=>{const button=event.target.closest?.('[data-real-estate-action]');if(button){event.preventDefault();act(button);}});queue();}
install();
modules.realEstateUI=Object.freeze({install,inject,render,renderRow,owned,loanFor,latestEvent});
})();
