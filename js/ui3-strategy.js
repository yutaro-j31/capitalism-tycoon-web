// UI v3 strategy screen — docs/ui-v3/README.md 5 (UI3-9), list type. Three views (a `.u-seg`, view state kept here):
// supply chain (the vertical-integration investments: confirmation sheet with the cost; the stores' supplier / policy / safety-stock
// settings stay in the current screen through "ほかの詳細（現行の画面）"), R&D (research projects: confirmation sheet, disabled with the
// reason without a product or DX department; patents: licensing on/off is a direct row), and customers (read-only segments and shares).
// Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-strategy.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
const state={tab:'supply'};
let context=null;
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const percent=ratio=>`${(Math.round(finite(ratio)*1000)/10).toFixed(1)}%`;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
const info=(title,note,end='')=>`<div class="u-row" role="listitem"><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span>${end?`<span class="u-end">${esc(end)}</span>`:''}</div>`;
const TABS=[['supply','サプライチェーン'],['rd','R&D・特許'],['segments','顧客・市場シェア']];
const offers=()=>modules.expansion?.VERTICAL_INTEGRATION_OFFERS||[];
const projects=()=>modules.expansion?.RD_PROJECTS||[];
const noRDDepartment=g=>!g.departments?.product&&!g.departments?.dx;

function supply(g,money){
  const held=new Set((g.verticalIntegrationAssets||[]).filter(x=>x.active).map(x=>x.id));
  const rows=offers().map(o=>held.has(o.id)?info(o.name,`週次費${money(finite(o.weeklyCost))} · 原価低減${percent(o.costReduction)}`,'稼働中')
    :row(` data-ui3-strat="vi" data-id="${esc(o.id)}"`,o.name,`週次費${money(finite(o.weeklyCost))} · 原価低減${percent(o.costReduction)} · リスク${percent(o.risk)}`,money(finite(o.cost)))).join('');
  const events=(g.supplyChainEvents||[]).slice(0,8).map(x=>info(x,'')).join('');
  return '<h2 class="u-h2">垂直統合</h2><div class="u-list" data-ui3-strat="vi-list">'+rows+'</div>'
    +(events?`<h2 class="u-h2">サプライチェーンの出来事</h2><div class="u-list" role="list">${events}</div>`:'')
    +`<h2 class="u-h2">そのほか</h2><div class="u-list">${row(' data-ui3-current="strategy"','ほかの詳細（現行の画面）','店舗ごとの仕入先・自動発注・安全在庫・緊急発注、在庫の表')}</div>`;
}
function rd(g,money){
  const reason=noRDDepartment(g)?'商品開発部門またはDX部門が必要です':'';
  const rows=projects().map(o=>{
    const active=(g.rdProjects||[]).find(x=>x.id===o.id),patent=(g.patentRecords||[]).find(x=>x.projectID===o.id);
    if(patent)return info(o.name,`${o.field} · ライセンス${money(finite(o.licenseIncome))}/週`,'特許取得');
    if(active)return info(o.name,`${o.field} · 進捗 ${finite(active.progress).toFixed(1)}%`,active.status==='researching'?'研究中':active.status);
    return row(` data-ui3-strat="rd" data-id="${esc(o.id)}"${reason?' disabled':''}`,o.name,reason||`${o.field} · ${o.weeks}週 · ライセンス${money(finite(o.licenseIncome))}/週`,money(finite(o.cost)));
  }).join('');
  const patents=(g.patentRecords||[]).map(p=>row(` data-action="license-patent" data-id="${esc(p.id)}"`,p.name,`${p.field} · 効果${percent(p.strength)} · ライセンス${money(finite(p.licenseIncome))}/週`,p.licensed?'提供中・止める':'停止中・始める')).join('');
  return '<h2 class="u-h2">研究テーマ</h2><div class="u-list" data-ui3-strat="rd-list">'+rows+'</div>'
    +'<h2 class="u-h2">特許</h2>'+(patents?`<div class="u-list" data-ui3-strat="patents">${patents}</div>`:'<div class="u-h2" data-ui3-strat="none-patents">R&Dが完了すると特許が追加されます。</div>');
}
function segments(g){
  const rows=(g.businesses||[]).filter(b=>(g.stores||[]).some(s=>s.businessID===b.id)).map(b=>{
    const seg=g.customerSegmentsByBusinessID?.[b.id]||{};
    return info(b.name,`大衆${finite(seg.mass).toFixed(0)}% · 価格${finite(seg.value).toFixed(0)}% · 高級${finite(seg.premium).toFixed(0)}% · 法人${finite(seg.business).toFixed(0)}% · デジタル${finite(seg.digital).toFixed(0)}%`,`シェア${percent(g.marketShareByBusinessID?.[b.id])}`);
  }).join('');
  return '<h2 class="u-h2">業態ごとの顧客と市場シェア</h2>'+(rows?`<div class="u-list" role="list" data-ui3-strat="segments">${rows}</div>`:'<div class="u-h2" data-ui3-strat="none-segments">店舗を開くと市場シェアが計算されます。</div>');
}

function render(ctx){
  context=ctx;
  const {g,money}=ctx;
  const seg=`<div class="u-seg" role="group" aria-label="戦略の種類" data-ui3-strat="tabs">${TABS.map(([id,label])=>`<button type="button" data-ui3-strat-tab="${id}" aria-pressed="${state.tab===id}">${label}</button>`).join('')}</div>`;
  return seg+(state.tab==='rd'?rd(g,money):state.tab==='segments'?segments(g):supply(g,money));
}

function show(html){const root=modalRoot();if(root)root.innerHTML=html;}
function confirmCost(title,cost,facts,note,attributes,label){
  const {g,money}=context;
  const cash=finite(g.companyCash);
  show(modules.ui3.confirmSheet({title,subtitle:'会社の現金から払います。取り消せません。',
    facts:[{label:'費用',value:money(cost)},{label:'実行後の会社現金',value:money(cash-cost),tone:cash-cost<0?'down':undefined},...facts],note,confirm:{label,attributes}}));
}
function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const tab=target.closest('[data-ui3-strat-tab]');
  if(tab){state.tab=tab.dataset.ui3StratTab;globalThis.document.querySelector('[data-ui3-all-screens] [data-action="tab"][data-tab="strategy"]')?.click();return;}
  const control=target.closest('[data-ui3-strat]');
  if(!control||control.disabled)return;
  const kind=control.dataset.ui3Strat,id=control.dataset.id,{money}=context;
  if(kind==='vi'){
    const o=offers().find(x=>x.id===id);
    if(o)confirmCost(`${o.name}に投資`,finite(o.cost),[],`週次費${money(finite(o.weeklyCost))}がかかり、原価が${percent(o.costReduction)}下がります。`,{'data-action':'vertical-integration','data-id':id},'投資する');
  }else if(kind==='rd'){
    const o=projects().find(x=>x.id===id);
    if(o&&!noRDDepartment(context.g))confirmCost(`${o.name}の研究を開始`,finite(o.cost),[{label:'期間',value:`${o.weeks}週`}],`完了すると特許が取れ、ライセンス収入が週${money(finite(o.licenseIncome))}入ります。`,{'data-action':'start-rd','data-id':id},'開始する');
  }
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('strategy',{render});
})();
