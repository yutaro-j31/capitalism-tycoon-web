// Script boundary: js/setup-recovery.js (classic JavaScript)
(function(){'use strict';
const marker='data-setup-recovery';

function ensureSetupRecovery(){
  const app=document.getElementById('app');
  if(!app||typeof app.innerHTML!=='string')return;
  if(!app.innerHTML.includes('id="setup-form"')||app.innerHTML.includes(marker))return;
  const closing='</form>';
  const index=app.innerHTML.indexOf(closing);
  if(index<0)return;
  const recovery=`<div class="setup-recovery" ${marker}><p class="setup-note">以前のJSONセーブがある場合は、新しく創業せずにここから復旧できます。</p><button class="btn secondary wide" type="button" data-action="import-save">JSONセーブを読み込む</button><input id="import-file" type="file" accept="application/json,.json" hidden></div>`;
  app.innerHTML=`${app.innerHTML.slice(0,index+closing.length)}${recovery}${app.innerHTML.slice(index+closing.length)}`;
}

ensureSetupRecovery();
if(typeof MutationObserver==='function'){
  const app=document.getElementById('app');
  if(app){
    const observer=new MutationObserver(ensureSetupRecovery);
    observer.observe(app,{childList:true});
  }
}
})();
