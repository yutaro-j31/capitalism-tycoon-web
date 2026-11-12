// UI v3 founding screen — docs/ui-v3/README.md 5.6 (UI3-8b). The current form's fields, in the same order and with the same `name`s,
// on ui3.css parts; one screen, with the "創業する" button fixed at the bottom. The form is `#setup-form` and is submitted through
// the current handler (js/app.js reads FormData and calls engine.configure), so nothing here writes engine state. There is no top
// bar, tab bar or advance button here (the game has not started).
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerSetup)throw new Error('js/ui3-shell.js must be loaded before ui3-setup.js.');
const esc=modules.ui3.esc;
const traits=()=>modules.expansion?.FOUNDER_TRAITS||[];
function render(ctx){
  const {g}=ctx;
  const prefs=(g.prefs||[]).map(p=>`<option value="${esc(p.id)}"${p.id===g.founderHomePrefID?' selected':''}>${esc(p.name)}</option>`).join('');
  const trait=traits().map(t=>`<option value="${esc(t.id)}">${esc(t.icon)} ${esc(t.name)} — ${esc(t.detail)}</option>`).join('');
  return `<form id="setup-form" class="u-setup" data-ui3-setup-form>`
    +`<div class="u-setup-head"><div class="u-setup-logo" aria-hidden="true">¥</div><div><h1 class="u-h1">資本主義ポケット TYCOON</h1></div></div>`
    +`<label class="u-field"><span>プレイヤー名</span><input class="u-input u-input-text" name="playerName" value="創業者" maxlength="24" autocomplete="off"></label>`
    +`<label class="u-field"><span>会社名</span><input class="u-input u-input-text" name="companyName" value="ポケット商事" maxlength="30" autocomplete="off"></label>`
    +`<div class="u-setup-pair"><label class="u-field"><span>難易度</span><select class="u-input u-input-text" name="difficulty"><option value="easy">やさしい</option><option value="normal" selected>標準</option><option value="hard">ハード</option></select></label>`
    +`<label class="u-field"><span>出身地</span><select class="u-input u-input-text" name="founderPrefID">${prefs}</select></label></div>`
    +`<div class="u-setup-pair"><label class="u-field"><span>初期特性</span><select class="u-input u-input-text" name="founderTraitID">${trait}</select></label>`
    +`<label class="u-field"><span>シナリオ</span><select class="u-input u-input-text" name="scenario"><option value="free">自由プレイ</option><option value="standard">標準シナリオ</option></select></label></div>`
    +`<div class="u-setup-foot"><p class="u-setup-note">開始時の会社資金800万円、個人資金200万円。業種は固定されず、店舗経営・IT／デジタル事業・投資などから自由に会社を育てられます。</p>`
    +`<button type="submit" class="u-btn primary wide">創業する</button></div></form>`
    // The current form is followed by a recovery block that the page's setup-recovery bootstrap (index.html) adds to #app when
    // `data-setup-recovery` is absent. It is drawn here with the same marker, so the bootstrap leaves it alone: the same button
    // (`import-save`) and the same hidden file input (`#import-file`), on ui3.css parts.
    +`<div class="u-setup-recovery" data-setup-recovery><div class="u-list"><button type="button" class="u-row" data-action="import-save"><span><b>JSONセーブを読み込む</b><small>以前のJSONセーブがある場合は、新しく創業せずにここから復旧できます</small></span><span class="u-end">読み込み</span></button></div>`
    +`<input id="import-file" type="file" accept="application/json,.json" hidden></div>`;
}
modules.ui3.registerSetup({render});
})();
