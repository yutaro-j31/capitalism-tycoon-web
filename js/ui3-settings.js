// UI v3 settings screen — docs/ui-v3/README.md 5 (UI3-8), list type.
//
// Rows: the game settings (auto-management on/off and style, reduced motion: segments that drive the same hidden
// `data-setting` controls as the current screen, so the app's own change handler writes them), saving (now, three slots),
// exporting / importing the JSON save, loading a slot, starting over and the company sale. Overwriting a slot, loading a slot,
// starting over and selling the company are confirmation sheets; the existing actions run unchanged. Diagnostics, release
// and storage tools, the playtest report and the probes stay reachable through "ほかの詳細（現行の画面）" (README 6.5).
// Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-settings.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
let context=null;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
// Copies of the current screen's own rule (js/app.js settings buyout button and confirm-buyout: company value of 200,000,000 yen or more,
// not yet sold; the sale price is company value x 1.2); tests/ui3-company-webkit-test.js checks them against the app's text.
const BUYOUT_MIN_VALUE=200000000,BUYOUT_MULTIPLIER=1.2;
const STYLES=[['aggressive','成長重視'],['balanced','バランス'],['defensive','守備重視']];

function render(ctx){
  context=ctx;
  const {g,engine}=ctx;
  const buyoutReason=g.isCompanySold?'会社はすでに売却済みです':finite(engine.companyValue())<BUYOUT_MIN_VALUE?'企業価値2億円以上で売却できます':'';
  const auto=Boolean(g.autoManage),motion=Boolean(g.settings?.reducedMotion),style=g.autoManageStyle||'balanced';
  const onOff=(key,on)=>`<div class="u-seg" role="group" data-ui3-settings="${key}"><button type="button" data-ui3-set="${key}" data-value="true" aria-pressed="${on}">オン</button><button type="button" data-ui3-set="${key}" data-value="false" aria-pressed="${!on}">オフ</button></div>`;
  // the current screen's own controls, hidden: the app's change handler (js/app.js) reads `data-setting`
  const hidden=`<input type="checkbox" hidden data-setting="autoManage"${auto?' checked':''} aria-hidden="true" tabindex="-1">`
    +`<input type="checkbox" hidden data-setting="reducedMotion"${motion?' checked':''} aria-hidden="true" tabindex="-1">`
    +`<select hidden data-setting="autoManageStyle" aria-hidden="true" tabindex="-1">${STYLES.map(([v,l])=>`<option value="${v}"${v===style?' selected':''}>${l}</option>`).join('')}</select>`
    +`<input id="import-file" type="file" accept="application/json" hidden>`
    // js/save-storage-ui.js takes `save-now` / `save-slot` clicks first (capture phase, stopping them), so the confirmation sheet closes
    // itself and then clicks one of these proxies: the existing action runs exactly as the current screen's slot button
    +[1,2,3].map(i=>`<button type="button" hidden aria-hidden="true" tabindex="-1" data-ui3-proxy="save-slot" data-action="save-slot" data-id="${i}"></button>`).join('');
  const game=`<h2 class="u-h2">自動経営</h2>${onOff('autoManage',auto)}`
    +`<div class="u-seg" role="group" aria-label="自動経営の方針" data-ui3-settings="style">${STYLES.map(([v,l])=>`<button type="button" data-ui3-set="autoManageStyle" data-value="${v}" aria-pressed="${v===style}">${l}</button>`).join('')}</div>`
    +`<h2 class="u-h2">動きを減らす</h2>${onOff('reducedMotion',motion)}`;
  const saves=`<h2 class="u-h2">セーブ</h2><div class="u-list" data-ui3-settings="saves">`
    +row(' data-action="save-now"','現在データを保存','この端末に保存する','保存')
    +row(' data-action="export-save"','JSON書き出し','バックアップのファイルを保存する','書き出し')
    +row(' data-action="import-save"','JSON読み込み','バックアップのファイルから復元する','読み込み')
    +row(' data-ui3-settings="slots"','セーブスロット','スロット1〜3に保存・読み込み')+`</div>`;
  const danger=`<h2 class="u-h2">データの削除・会社の売却</h2><div class="u-list" data-ui3-settings="danger">`
    +row(' data-ui3-settings-confirm="reset"','最初からやり直す','進行状況をすべて削除する','削除')
    +row(` data-ui3-settings-confirm="buyout"${buyoutReason?' disabled':''}`,'会社売却を検討',buyoutReason||'事業経営を終えて個人資産モードへ',buyoutReason?'—':'売却')+`</div>`;
  const more=row(' data-ui3-current="settings"','ほかの詳細（現行の画面）','診断・最新版で再起動・不具合報告・保存領域・動作確認のツール');
  return game+saves+danger+`<h2 class="u-h2">そのほか</h2><div class="u-list">${more}</div>`+hidden;
}

function show(html){const root=modalRoot();if(root)root.innerHTML=html;}
const slotsSheet=()=>show(modules.ui3.sheet({eyebrow:'セーブスロット',title:'スロットを選ぶ',
  body:`<span hidden data-ui3-settings-sheet></span><div class="u-list">${[1,2,3].map(i=>row(` data-ui3-settings-confirm="save-slot" data-id="${i}"`,`スロット${i}に保存`,'いまの進行状況で上書きする','保存')+row(` data-ui3-settings-confirm="load-slot" data-id="${i}"`,`スロット${i}から読み込む`,'いまの進行状況は置き換わる','読込')).join('')}</div>`,
  actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'}));

function askConfirm(kind,id){
  const sheets={
    'save-slot':{title:`スロット${id}に保存`,subtitle:'スロットの中身は、いまの進行状況で上書きされます。',confirm:{label:'保存する',attributes:{'data-ui3-settings-run':'save-slot','data-id':id}}},
    'load-slot':{title:`スロット${id}を読み込む`,subtitle:'いまの進行状況は、スロットの内容に置き換わります。保存していない分は失われます。',confirm:{label:'読み込む',attributes:{'data-action':'load-slot','data-id':id}}},
    reset:{title:'最初からやり直す',subtitle:'現在の進行状況をすべて削除します。この操作は取り消せません。',confirm:{label:'削除してやり直す',attributes:{'data-action':'confirm-reset'}}},
    buyout:{title:'会社を売却する',subtitle:'会社を売却すると事業経営は終了し、個人資産モードへ移行します。取り消せません。',note:'個人で保有する自社株の分は別に受け取ります（上の金額に含まれません）。',confirm:{label:'売却する',attributes:{'data-action':'confirm-buyout'}}}
  };
  const spec=sheets[kind];
  if(!spec)return;
  let facts=[];
  if(kind==='buyout'){
    const {g,money,engine}=context;
    if(g.isCompanySold||finite(engine.companyValue())<BUYOUT_MIN_VALUE)return;
    const price=finite(engine.companyValue())*BUYOUT_MULTIPLIER;
    facts=[{label:'売却額（概算）',value:money(price),tone:'up'},{label:'創業者の受取（概算）',value:money(price*finite(g.founderOwnershipRatio))}];
  }
  show(modules.ui3.confirmSheet({...spec,facts}));
}

function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const set=target.closest('[data-ui3-set]');
  if(set){
    // the current screen's own control + its own change handler (js/app.js writes the setting and saves)
    const control=globalThis.document.querySelector(`#app [data-setting="${set.dataset.ui3Set}"]`);
    if(!control)return;
    if(control.type==='checkbox')control.checked=set.dataset.value==='true';else control.value=set.dataset.value;
    control.dispatchEvent(new Event('change',{bubbles:true}));
    return;
  }
  if(target.closest('[data-ui3-settings="slots"]')){slotsSheet();return;}
  const run=target.closest('[data-ui3-settings-run]');
  if(run){
    const proxy=globalThis.document.querySelector(`#app [data-ui3-proxy="${run.dataset.ui3SettingsRun}"][data-id="${run.dataset.id}"]`);
    const root=modalRoot();
    if(root)root.innerHTML='';
    if(proxy)proxy.click();
    return;
  }
  const confirmRow=target.closest('[data-ui3-settings-confirm]');
  if(confirmRow&&!confirmRow.disabled)askConfirm(confirmRow.dataset.ui3SettingsConfirm,confirmRow.dataset.id);
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('settings',{render});
})();
