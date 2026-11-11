// UI v3 ma screen — docs/ui-v3/README.md 5 (UI3-6), list type.
//
// Lists: deals in progress (the deal room's status and remaining weeks), acquisition candidates and acquired
// companies (with the integration status). A candidate row opens a read-only sheet with an "案件を開く" action (the
// existing `ma-open-deal`); acquiring a company, selling one and refreshing the candidates are confirmation sheets
// (they replace or move money). The deal room itself (due diligence, offers, financing, board approval, closing,
// integration steps) stays in the current screen, reachable through "ほかの詳細（現行の画面）" (README 6.5).
// Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-ma.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
let context=null;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const percent=ratio=>`${(Math.round(finite(ratio)*1000)/10).toFixed(1)}%`;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
const TERMINAL=['acquired','withdrawn','expired','lost','rejected'];
const PMI={planning:'PMI計画待ち',integrating:'PMI進行中',stalled:'PMI停滞',completed:'統合完了'};
const labelOf=status=>modules.maDealRoom?.STATUS_LABELS?.[status]||status;

const dealsOf=g=>(g.maDealRooms||[]).filter(d=>!TERMINAL.includes(d.status));
const dealOfTarget=(g,id)=>(g.maDealRooms||[]).find(d=>d.targetID===id&&!TERMINAL.includes(d.status));

function render(ctx){
  context=ctx;
  const {g,money}=ctx;
  const hasInvestment=Boolean(g.departments?.investment);
  const targets=g.acquisitionTargets||[],deals=dealsOf(g),subs=(g.maSubsidiaries||[]).filter(s=>s.status==='active');
  const warn=hasInvestment?'':`<button type="button" class="u-action warn" data-ui3-ma="blocked" data-action="tab" data-tab="office"><i aria-hidden="true">⚠</i><span><b>M&Aには投資部門が必要です</b><small>本社の部門を設定する</small></span></button>`;
  const dealRows=deals.map(d=>{
    const t=targets.find(x=>x.id===d.targetID)||{};
    const weeks=Math.max(0,finite(d.deadlineWeek)-finite(g.week));
    return row(` data-ui3-ma="deal" data-id="${esc(d.id)}"`,t.name||'案件',`${labelOf(d.status)} · 期限まで${weeks}週`,t.valuation?money(finite(t.valuation)):'');
  }).join('');
  const candidateRows=targets.map(t=>row(` data-ui3-ma="target" data-id="${esc(t.id)}"`,t.name,`${t.domain}${dealOfTarget(g,t.id)?' · 案件あり':''}`,money(finite(t.valuation)))).join('');
  const subRows=subs.map(s=>row(` data-ui3-ma="subsidiary" data-id="${esc(s.id)}"`,s.name,`${s.domain||''} · ${PMI[s.pmiStatus]||'PMI未設定'}`,money(finite(s.valuation)))).join('');
  const refresh=row(` data-ui3-ma="refresh"${hasInvestment?'':' disabled'}`,'候補企業を探索',`いまの候補${targets.length}件は新しい候補に入れ替わります`);
  const pe=g.peFirm?.unlocked?row(' data-action="tab" data-tab="pe-portfolio"','買収先の経営（PE）','ファンドが買収した企業を経営する'):'';
  const more=row(' data-ui3-current="ma"','ほかの詳細（現行の画面）','案件の交渉（DD・オファー・資金調達・取締役会・クロージング）、統合の進め方');
  return warn
    +'<h2 class="u-h2">進行中の案件</h2>'+(dealRows?`<div class="u-list" data-ui3-ma="deals">${dealRows}</div>`:'<div class="u-h2" data-ui3-ma="none-deals">進行中の案件はありません。候補から案件を開きます。</div>')
    +'<h2 class="u-h2">買収候補</h2>'+(candidateRows?`<div class="u-list" data-ui3-ma="targets">${candidateRows}</div>`:'<div class="u-h2" data-ui3-ma="none-targets">候補はまだありません。「候補企業を探索」で探します。</div>')
    +(subRows?`<h2 class="u-h2">買収済みの企業</h2><div class="u-list" data-ui3-ma="subsidiaries">${subRows}</div>`:'')
    +`<h2 class="u-h2">そのほか</h2><div class="u-list">${refresh}${pe}${more}</div>`;
}

function show(html){const root=modalRoot();if(root)root.innerHTML=html;}
const stat=(label,value)=>`<div class="u-stat"><span>${esc(label)}</span><b class="u-money">${esc(value)}</b></div>`;

function targetSheet(id){
  const {g,money}=context;
  const t=(g.acquisitionTargets||[]).find(x=>x.id===id);
  if(!t)return;
  const deal=dealOfTarget(g,id),weeks=Math.max(0,finite(t.expiresWeek)-finite(g.week));
  const body=`<span hidden data-ui3-ma-sheet></span><div class="u-stats">${stat('評価額',money(finite(t.valuation)))}${stat('売上',money(finite(t.sales)))}${stat('営業利益',money(finite(t.operatingProfit)))}</div>`
    +`<div class="u-stats">${stat('成長率',percent(t.growth))}${stat('リスク',percent(t.risk))}${stat('シナジー',percent(t.synergy))}</div>`
    +`<div class="u-h2" data-ui3-ma="target-note">${deal?`案件あり：${esc(labelOf(deal.status))}。交渉は「ほかの詳細（現行の画面）」で進めます。`:`候補の期限まであと${weeks}週。案件を開くと、DD・オファーを始められます。`}</div>`;
  const open=deal?'':`<button type="button" class="u-btn primary" data-action="ma-open-deal" data-id="${esc(id)}"${g.departments?.investment?'':' disabled'}>案件を開く</button>`;
  show(modules.ui3.sheet({eyebrow:t.domain,title:t.name,subtitle:t.friendly===false?'敵対的な買収になりやすい相手':'友好的な買収が見込める相手',body,
    actions:`<button type="button" class="u-btn" data-action="close-modal">閉じる</button>${open}`}));
}

function dealSheet(id){
  const {g,money}=context;
  const d=(g.maDealRooms||[]).find(x=>x.id===id);
  if(!d)return;
  const t=(g.acquisitionTargets||[]).find(x=>x.id===d.targetID)||{};
  const weeks=Math.max(0,finite(d.deadlineWeek)-finite(g.week));
  const terms=d.acceptedTerms;
  const body=`<span hidden data-ui3-ma-sheet></span><div class="u-stats">${stat('状態',labelOf(d.status))}${stat('期限まで',`${weeks}週`)}${stat('評価額',money(finite(t.valuation)))}</div>`
    +(terms?`<div class="u-stats two">${stat('合意価格',money(finite(terms.finalPrice)))}${stat('最終契約まで',`${Math.max(0,finite(terms.closingDeadlineWeek)-finite(g.week))}週`)}</div>`:'')
    +`<div class="u-list">${row(' data-ui3-current="ma"','現行の画面で交渉を進める','DD・オファー・資金調達・取締役会・クロージング')}</div>`;
  show(modules.ui3.sheet({eyebrow:t.domain||'',title:t.name||'案件',subtitle:'案件',body,actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'}));
}

function subsidiarySheet(id){
  const {g,money}=context;
  const s=(g.maSubsidiaries||[]).find(x=>x.id===id);
  if(!s)return;
  const body=`<span hidden data-ui3-ma-sheet></span><div class="u-stats">${stat('評価額',money(finite(s.valuation)))}${stat('週次利益',money(finite(s.weeklyProfit)))}${stat('統合',PMI[s.pmiStatus]||'未設定')}</div>`
    +`<div class="u-list">${row(' data-ui3-current="ma"','統合の進め方（現行の画面）','PMIの開始・支援策')}</div>`;
  show(modules.ui3.sheet({eyebrow:s.domain||'',title:s.name,subtitle:s.acquisitionMethod||'',body,
    actions:`<button type="button" class="u-btn" data-action="close-modal">閉じる</button><button type="button" class="u-btn primary" data-ui3-ma="sell" data-id="${esc(id)}">売却する</button>`}));
}

function confirmSell(id){
  const {g,money}=context;
  const s=(g.maSubsidiaries||[]).find(x=>x.id===id);
  if(!s)return;
  show(modules.ui3.confirmSheet({title:`${s.name}を売却`,subtitle:'売却額は評価額の85〜130%の間で決まります。取り消せません。',
    facts:[{label:'評価額',value:money(finite(s.valuation))},{label:'いまの会社の現金',value:money(finite(g.companyCash))}],
    note:'売却額と損益は、実行後の通知とレポートで確認できます。',
    confirm:{label:'売却する',attributes:{'data-action':'sell-ma','data-id':id}}}));
}
function confirmRefresh(){
  const {g}=context;
  const count=(g.acquisitionTargets||[]).length;
  show(modules.ui3.confirmSheet({title:'候補企業を探索',subtitle:'いまの候補は、新しい候補に入れ替わります。',
    facts:[{label:'いまの候補',value:`${count}件`},{label:'探索の費用',value:'なし'}],
    confirm:{label:'探索する',attributes:{'data-action':'generate-ma'}}}));
}

function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  // opening a deal room is done by the app's own handler; the sheet then closes so the new deal shows in the list
  const open=target.closest('[data-action="ma-open-deal"]');
  if(open&&modalRoot()?.contains(open)&&!open.disabled){setTimeout(()=>{const root=modalRoot();if(root)root.innerHTML='';},0);return;}
  const control=target.closest('[data-ui3-ma]');
  if(!control||control.disabled)return;
  const kind=control.dataset.ui3Ma,id=control.dataset.id;
  if(kind==='target')targetSheet(id);
  else if(kind==='deal')dealSheet(id);
  else if(kind==='subsidiary')subsidiarySheet(id);
  else if(kind==='refresh')confirmRefresh();
  else if(kind==='sell')confirmSell(id);
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('ma',{render});
})();
