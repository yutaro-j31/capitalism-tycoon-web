// UI v3 game-over screen — docs/ui-v3/README.md 5.6 (UI3-8b). Replaces the current screen's "倒産" overlay while v3 is on: the reason, and
// what the current overlay led to (its "設定を開く" button opens the settings tab, whose save / reset controls matter here): starting
// over (a confirmation sheet; the existing `confirm-reset`), loading a slot (confirmation sheet; the existing `load-slot`), saving the result
// card and exporting the save (the existing actions). Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerGameOver||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-gameover.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
function render(ctx){
  const {g}=ctx;
  return `<div class="u-over" data-ui3-gameover-body><h1 class="u-h1">倒産</h1><div class="u-card"><p data-ui3-gameover="reason">${esc(g.gameOverReason||'')}</p></div>`
    +`<div class="u-list" data-ui3-gameover="actions">`
    +row(' data-ui3-gameover-confirm="reset"','最初からやり直す','新しい会社を創業する','開始')
    +[1,2,3].map(i=>row(` data-ui3-gameover-confirm="load-slot" data-id="${i}"`,`スロット${i}から読み込む`,'保存した進行状況に戻る','読込')).join('')
    +row(' data-action="download-result-card"','結果カードを保存','エンディングと記録を画像で保存','保存')
    +row(' data-action="tab" data-tab="settings"','設定を開く','現行の「設定を開く」と同じ（設定の画面へ）')
    +row(' data-action="export-save"','JSON書き出し','バックアップのファイルを保存する','書き出し')
    +`</div></div>`;
}
function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  const control=target?.closest('[data-ui3-gameover-confirm]');
  if(!control||control.disabled||!control.closest('[data-ui3-gameover]'))return;
  const kind=control.dataset.ui3GameoverConfirm,id=control.dataset.id;
  const spec=kind==='reset'
    ?{title:'最初からやり直す',subtitle:'現在の進行状況をすべて削除します。この操作は取り消せません。',confirm:{label:'削除してやり直す',attributes:{'data-action':'confirm-reset'}}}
    :{title:`スロット${id}を読み込む`,subtitle:'いまの進行状況は、スロットの内容に置き換わります。',confirm:{label:'読み込む',attributes:{'data-action':'load-slot','data-id':id}}};
  const root=modalRoot();
  if(root)root.innerHTML=modules.ui3.confirmSheet({...spec,facts:[]});
}
globalThis.document?.addEventListener('click',onClick,true);
modules.ui3.registerGameOver({render});
})();
