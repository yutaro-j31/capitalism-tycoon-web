// Mobile-first real-estate portfolio headquarters dashboard.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.realEstatePortfolioDashboard||!modules?.playerEngineBridge?.getEngine)throw new Error('portfolio dashboard and player bridge are required.');
if(modules.realEstatePortfolioDashboardUI)throw new Error('portfolio dashboard UI already registered.');
const bridge=modules.playerEngineBridge;
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const money=v=>`${Math.round(Number(v)||0).toLocaleString('ja-JP')}円`;
const pct=v=>`${(Number(v||0)*100).toFixed(1)}%`;
let queued=false;
function render(){
  queued=false;
  const e=bridge.getEngine(),app=document.getElementById('app');
  if(!e||!app)return;
  app.querySelector('[data-real-estate-portfolio-dashboard]')?.remove();
  const settings=e.g?.realEstatePortfolioSettings||{owner:'all',sort:'risk'};
  const r=e.getRealEstatePortfolio?.(settings);
  if(!r||!r.totals.count)return;
  const box=document.createElement('section');
  box.dataset.realEstatePortfolioDashboard='';
  box.className='card';
  box.innerHTML=`<h2>不動産ポートフォリオ本部</h2><p class="muted">${r.totals.count}物件 · 資産${money(r.totals.value)} · 負債${money(r.totals.debt)} · 純資産${money(r.totals.equity)}</p><p class="muted">稼働率${pct(r.totals.occupancy)} · LTV ${pct(r.totals.ltv)} · DSCR ${r.totals.dscr===999?'無借入':Number(r.totals.dscr).toFixed(2)} · 年間NOI ${money(r.totals.noi)}</p><div class="button-row">${[['all','全物件'],['company','会社'],['personal','個人']].map(([id,label])=>`<button class="btn secondary small" style="min-height:44px" data-portfolio-owner="${id}">${label}</button>`).join('')}${[['risk','危険度'],['value','資産価値'],['equity','純資産'],['occupancy','空室優先']].map(([id,label])=>`<button class="btn secondary small" style="min-height:44px" data-portfolio-sort="${id}">${label}</button>`).join('')}</div><div>${r.rows.map(x=>`<article class="item"><strong>${esc(x.name)}</strong><p class="muted">${x.owner==='personal'?'個人':'会社'} · 価値${money(x.value)} · 純資産${money(x.equity)} · LTV ${pct(x.ltv)} · DSCR ${x.dscr===999?'無借入':Number(x.dscr).toFixed(2)}</p><p class="muted">稼働${x.occupancy?'入居中':'空室'} · 状態${Math.round(x.condition)} · 危険度${x.risk}${x.alerts.length?` · ${x.alerts.map(esc).join(' / ')}`:''}</p></article>`).join('')}</div>`;
  app.prepend(box);
}
function queue(){
  if(queued)return;
  queued=true;
  const schedule=typeof requestAnimationFrame==='function'?requestAnimationFrame:fn=>setTimeout(fn,0);
  schedule(render);
}
document.addEventListener('click',ev=>{
  const owner=ev.target.closest?.('[data-portfolio-owner]'),sort=ev.target.closest?.('[data-portfolio-sort]');
  if(!owner&&!sort)return;
  ev.preventDefault();
  const e=bridge.getEngine(),s=e?.g?.realEstatePortfolioSettings||{owner:'all',sort:'risk'};
  e?.setRealEstatePortfolioView?.(owner?.dataset.portfolioOwner||s.owner,sort?.dataset.portfolioSort||s.sort);
  e?.save?.();
  e?.emit?.();
  queue();
});
const activeEngine=bridge.getEngine();
activeEngine?.addEventListener?.('change',queue);
activeEngine?.addEventListener?.('week',queue);
globalThis.addEventListener?.('pageshow',queue);
queue();
modules.realEstatePortfolioDashboardUI=Object.freeze({render,queue,observerFree:true});
})();
