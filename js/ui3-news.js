// UI v3 news screen — docs/ui-v3/README.md 5 (UI3-9), list type, read-only: the news history and the weekly management history.
// Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen)throw new Error('js/ui3-shell.js must be loaded before ui3-news.js.');
const esc=modules.ui3.esc;
const LIMIT=30;
const line=text=>`<div class="u-row" role="listitem"><span><b>${esc(text)}</b></span></div>`;
function render(ctx){
  const {g}=ctx;
  const news=(g.news||[]).slice(0,LIMIT),history=(g.history||[]).slice(0,LIMIT);
  const block=(title,rows,none,key)=>`<h2 class="u-h2">${title}</h2>`+(rows.length?`<div class="u-list" role="list" data-ui3-news="${key}">${rows.map(line).join('')}</div>`:`<div class="u-h2" data-ui3-news="none-${key}">${none}</div>`);
  return block('ニュース',news,'ニュースはありません。','news')+block('週次の経営履歴',history,'履歴はありません。','history');
}
modules.ui3.registerScreen('news',{render});
})();
