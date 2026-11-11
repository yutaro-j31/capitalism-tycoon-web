// UI v3 assets screen — docs/ui-v3/README.md 5 (UI3-6), hub type.
//
// Card: the number of held properties, their market value and the weekly rent. List: held properties (company and
// personal). A row opens the property sheet; selling is a confirmation sheet (the amount is fixed: 97% of the value,
// the rule of the current engine path), buying stays on the map. Building on land (it asks for a name), funds and
// bonds, luxury assets, sports teams and the founder-wealth breakdown stay reachable through "ほかの詳細（現行の画面）"
// (README 6.5). Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-assets.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
let context=null;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
const stat=(label,value)=>`<div class="u-stat"><span>${esc(label)}</span><b class="u-money">${esc(value)}</b></div>`;
const ownerName=owner=>owner==='company'?'会社':'個人';
const heldOf=g=>(g.properties||[]).filter(p=>p.owner);

function render(ctx){
  context=ctx;
  const {g,money}=ctx;
  const held=heldOf(g);
  const value=held.reduce((sum,p)=>sum+finite(p.value),0),rent=held.reduce((sum,p)=>sum+finite(p.rentIncome),0);
  const card=`<section class="u-card" aria-label="保有物件の状況" data-ui3-assets="summary"><div class="u-stats">`
    +stat('保有物件',`${held.length}件`)+stat('時価',money(value))+stat('賃料収入（週）',money(rent))+`</div></section>`;
  const rows=held.map(p=>row(` data-ui3-asset="property" data-id="${esc(p.id)}"`,p.name,`${ownerName(p.owner)} · ${p.kind}`,money(finite(p.value)))).join('');
  const list=rows?`<div class="u-list" data-ui3-assets="properties">${rows}</div>`
    :`<div class="u-h2" data-ui3-assets="none">保有物件はまだありません。出店マップから購入できます。</div>`;
  const buy=row(' data-action="tab" data-tab="map"','物件を買う（マップ）','購入は出店マップの物件から');
  const more=row(' data-ui3-current="assets"','ほかの詳細（現行の画面）','土地の建設・投信・債券・高級資産・スポーツ・個人資産の内訳');
  return card+'<h2 class="u-h2">保有物件</h2>'+list+`<h2 class="u-h2">そのほか</h2><div class="u-list">${buy}${more}</div>`;
}

function show(html){const root=modalRoot();if(root)root.innerHTML=html;}

function propertySheet(id){
  const {g,money}=context;
  const p=(g.properties||[]).find(x=>x.id===id);
  if(!p||!p.owner)return;
  const body=`<span hidden data-ui3-asset-sheet></span><div class="u-stats">${stat('評価額',money(finite(p.value)))}${stat('賃料（週）',money(finite(p.rentIncome)))}${stat('持ち主',ownerName(p.owner))}</div>`
    +(p.owner==='company'&&p.kind==='土地'?`<div class="u-list">${row(' data-ui3-current="assets"','建物を建設（現行の画面）','建物の種類を選んで建設する')}</div>`:'');
  show(modules.ui3.sheet({eyebrow:p.kind,title:p.name,subtitle:`${ownerName(p.owner)}の物件`,body,
    actions:`<button type="button" class="u-btn" data-action="close-modal">閉じる</button><button type="button" class="u-btn primary" data-ui3-asset="sell" data-id="${esc(id)}">売却する</button>`}));
}

function confirmSell(id){
  const {g,money}=context;
  const p=(g.properties||[]).find(x=>x.id===id);
  if(!p||!p.owner)return;
  const proceeds=Math.ceil(finite(p.value)*.97),cash=finite(p.owner==='company'?g.companyCash:g.personalCash);
  show(modules.ui3.confirmSheet({title:`${p.name}を売却`,subtitle:`${ownerName(p.owner)}の物件を売ります。取り消せません。`,
    facts:[{label:'売却額（評価額の97%）',value:money(proceeds),tone:'up'},{label:`実行後の${ownerName(p.owner)}現金`,value:money(cash+proceeds)}],
    note:'概算です。譲渡益への税などは、実行後の通知とレポートで確認できます。',
    confirm:{label:'売却する',attributes:{'data-action':'sell-property','data-id':id}}}));
}

function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const control=target.closest('[data-ui3-asset]');
  if(!control||control.disabled)return;
  const kind=control.dataset.ui3Asset,id=control.dataset.id;
  if(kind==='property')propertySheet(id);
  else if(kind==='sell')confirmSell(id);
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('assets',{render});
})();
