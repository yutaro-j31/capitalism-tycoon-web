// UI v3 overseas screen — docs/ui-v3/README.md 5 (UI3-9), list type.
//
// Rows: the countries (base demand, risk, set-up cost, FX) and the overseas subsidiaries. A country row opens a sheet where the
// business is chosen (chips); setting up a local company is a confirmation sheet with the cost the engine charges (the country's
// set-up cost plus twice the business's store cost) and the company cash afterwards; it needs a head office and a CEO (shown as the
// reason, as the engine requires). Repatriation, localisation and brand investment stay in the current screen through
// "ほかの詳細（現行の画面）". The existing `open-overseas` action reads the business from the current screen's own select
// (`#overseas-business-<country>`), so hidden selects are rendered and set just before the action runs.
// Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-overseas.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
const state={country:null,business:null};
let context=null;
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const percent=ratio=>`${(Math.round(finite(ratio)*1000)/10).toFixed(1)}%`;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
const stat=(label,value)=>`<div class="u-stat"><span>${esc(label)}</span><b class="u-money">${esc(value)}</b></div>`;
const countries=()=>modules.data?.OVERSEAS_COUNTRIES||[];
const blockedReason=g=>(!g.hasHeadOffice||!g.executives?.CEO)?'本社とCEOが必要です':'';
// the engine's set-up cost (js/engine.js openOverseas): the country's cost plus twice the business's store cost
const setupCost=(c,b)=>finite(c.cost)+finite(b.storeCost)*2;

function render(ctx){
  context=ctx;
  const {g,money,engine}=ctx;
  const rows=countries().map(c=>row(` data-ui3-os="country" data-id="${esc(c.id)}"`,c.name,`基礎需要${finite(c.demand).toFixed(2)} · リスク${percent(c.risk)} · FX ${finite(engine.overseasFxRate(c.id)).toFixed(3)}`,money(finite(c.cost)))).join('');
  const subs=(g.overseasSubsidiaries||[]).map(x=>row(' disabled',x.name,`${engine.business(x.businessID)?.name||x.businessID} · 評価額${money(finite(x.valuation))} · 週次利益${money(finite(x.lastProfit))}`,x.status==='active'?'運営中':x.status)).join('');
  const hidden=countries().map(c=>`<select hidden id="overseas-business-${esc(c.id)}" aria-hidden="true" tabindex="-1">${(g.businesses||[]).map(b=>`<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}</select>`).join('');
  const reason=blockedReason(g);
  return (reason?`<div class="u-h2" data-ui3-os="blocked">${reason}（本社の部門・役員で整えます）。</div>`:'')
    +'<h2 class="u-h2">進出先</h2><div class="u-list" data-ui3-os="countries">'+rows+'</div>'
    +'<h2 class="u-h2">海外子会社</h2>'+(subs?`<div class="u-list" data-ui3-os="subsidiaries">${subs}</div>`:'<div class="u-h2" data-ui3-os="none">海外子会社はありません。</div>')
    +`<h2 class="u-h2">そのほか</h2><div class="u-list">${row(' data-ui3-current="overseas"','ほかの詳細（現行の画面）','本社への送金・ローカライズ・ブランド投資')}</div>`+hidden;
}

function show(html){const root=modalRoot();if(root)root.innerHTML=html;}
function countrySheet(id){
  const {g,money,engine}=context;
  const c=countries().find(x=>x.id===id);
  if(!c)return;
  state.country=id;
  const businesses=g.businesses||[];
  if(!businesses.some(b=>b.id===state.business))state.business=businesses[0]?.id;
  const b=businesses.find(x=>x.id===state.business);
  const chips=`<nav class="u-chips" aria-label="事業" data-ui3-os="businesses">${businesses.map(x=>`<button type="button" class="u-chip" data-ui3-os-business="${esc(x.id)}" aria-pressed="${x.id===state.business}">${esc(x.name)}</button>`).join('')}</nav>`;
  const reason=blockedReason(g);
  const body=`<span hidden data-ui3-os-sheet></span><div class="u-stats">${stat('基礎需要',finite(c.demand).toFixed(2))}${stat('リスク',percent(c.risk))}${stat('FX',finite(engine.overseasFxRate(c.id)).toFixed(3))}</div>`
    +`<div class="u-h2">進出する事業</div>${chips}<div class="u-h2" data-ui3-os="cost">${b?`設立費用 ${esc(money(setupCost(c,b)))}（国 ${esc(money(finite(c.cost)))} + 店舗費の2倍 ${esc(money(finite(b.storeCost)*2))}）`:''}${reason?`　${esc(reason)}`:''}</div>`;
  show(modules.ui3.sheet({eyebrow:'進出先',title:c.name,body,actions:`<button type="button" class="u-btn" data-action="close-modal">閉じる</button><button type="button" class="u-btn primary" data-ui3-os="open" data-id="${esc(id)}"${reason||!b?' disabled':''}>現地法人を設立</button>`}));
}
function confirmOpen(id){
  const {g,money}=context;
  const c=countries().find(x=>x.id===id),b=(g.businesses||[]).find(x=>x.id===state.business);
  if(!c||!b||blockedReason(g))return;
  const cost=setupCost(c,b),cash=finite(g.companyCash);
  // the existing action reads the business from the current screen's own select
  const select=globalThis.document.querySelector(`#overseas-business-${id}`);
  if(select)select.value=b.id;
  show(modules.ui3.confirmSheet({title:`${c.name}に現地法人を設立`,subtitle:`${b.name}。会社の現金から払います。取り消せません。`,
    facts:[{label:'設立費用',value:money(cost)},{label:'実行後の会社現金',value:money(cash-cost),tone:cash-cost<0?'down':undefined}],
    note:'設立から8週後に営業を始めます。',confirm:{label:'設立する',attributes:{'data-action':'open-overseas','data-id':id}}}));
}
function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const chip=target.closest('[data-ui3-os-business]');
  if(chip){state.business=chip.dataset.ui3OsBusiness;countrySheet(state.country);return;}
  const control=target.closest('[data-ui3-os]');
  if(!control||control.disabled)return;
  const kind=control.dataset.ui3Os;
  if(kind==='country')countrySheet(control.dataset.id);
  else if(kind==='open')confirmOpen(control.dataset.id);
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('overseas',{render});
})();
