// UI v3 media screen — docs/ui-v3/README.md 5 (UI3-9), list type.
//
// Rows: the press and social-media campaigns (cost fixed, paid by the company: confirmation sheet), the venture forums
// (fee fixed, paid by the founder: confirmation sheet), the luxury auctions (the winning price is the current bid x 1.08,
// paid by the founder: confirmation sheet), and read-only lists (the weekly paper, big business news, the campaign log).
// Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-media.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
let context=null;
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
const info=(title,note)=>`<div class="u-row" role="listitem"><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span></div>`;
// Copy of js/expansion.js bidLuxuryAuction's price rule (the current bid x 1.08); tests/ui3-rest-webkit-test.js checks it against the engine's text.
const AUCTION_MARKUP=1.08;
const mediaActions=()=>modules.completion?.MEDIA_ACTIONS||[];

function render(ctx){
  context=ctx;
  const {g,money}=ctx;
  const stats=`<section class="u-card" aria-label="評判" data-ui3-media="summary"><div class="u-stats">`
    +`<div class="u-stat"><span>企業評判</span><b class="u-money">${finite(g.companyReputation).toFixed(1)}</b></div>`
    +`<div class="u-stat"><span>SNS評判</span><b class="u-money">${finite(g.socialMediaReputation).toFixed(1)}</b></div>`
    +`<div class="u-stat"><span>炎上リスク</span><b class="u-money">${(finite(g.socialMediaHeat)*100).toFixed(1)}%</b></div></div></section>`;
  const actions=mediaActions().map(a=>row(` data-ui3-media="action" data-id="${esc(a.id)}"`,a.name,`${a.detail} · ${a.weeks}週`,money(finite(a.cost)))).join('');
  const forums=(g.ventureForumEvents||[]).filter(x=>x.status==='open');
  const auctions=(g.luxuryAuctionListings||[]).filter(x=>x.status==='open'&&finite(x.expiresWeek)>=finite(g.week));
  const paper=(g.weeklyNewspaper||[])[0];
  const lists=(title,rows,key)=>rows.length?`<h2 class="u-h2">${title}</h2><div class="u-list" role="list" data-ui3-media="${key}">${rows.join('')}</div>`:'';
  return stats+'<h2 class="u-h2">広報の施策（会社の現金）</h2><div class="u-list" data-ui3-media="actions">'+actions+'</div>'
    +lists('ベンチャーフォーラム（個人の現金）',forums.map(x=>row(` data-ui3-media="forum" data-id="${esc(x.id)}"`,x.name,`人脈+${finite(x.networkGain).toFixed(1)} · 評判+${finite(x.repGain).toFixed(1)} · 期限 第${x.expiresWeek}週`,money(finite(x.fee)))),'forums')
    +lists('高級品オークション（個人の現金）',auctions.map(x=>row(` data-ui3-media="auction" data-id="${esc(x.id)}"`,x.name,`★${x.rarity} · ${x.category} · 期限 第${x.expiresWeek}週`,money(finite(x.currentBid)))),'auctions')
    +lists(paper?paper.name:'週刊新聞',paper?(paper.articles||[]).map(a=>info(a.title,a.detail)):[],'paper')
    +lists('大型ビジネスニュース',(g.majorBusinessNews||[]).slice(0,10).map(x=>info(x.title,`第${x.week}週 · ${x.detail}`)),'news')
    +lists('広報の履歴',(g.mediaActionLog||[]).slice(0,10).map(x=>info(x,'')),'log');
}

function show(html){const root=modalRoot();if(root)root.innerHTML=html;}
function askCost(spec){
  const {g,money}=context;
  const wallet=spec.wallet==='company'?'会社':'個人',cash=finite(spec.wallet==='company'?g.companyCash:g.personalCash);
  show(modules.ui3.confirmSheet({title:spec.title,subtitle:`${wallet}の現金から払います。取り消せません。`,
    facts:[{label:'費用',value:money(spec.cost)},{label:`実行後の${wallet}現金`,value:money(cash-spec.cost),tone:cash-spec.cost<0?'down':undefined}],
    note:spec.note,confirm:{label:spec.label,attributes:spec.attributes}}));
}
function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const control=target.closest('[data-ui3-media]');
  if(!control||control.disabled)return;
  const kind=control.dataset.ui3Media,id=control.dataset.id,{g}=context;
  if(kind==='action'){
    const a=mediaActions().find(x=>x.id===id);
    if(a)askCost({title:a.name,wallet:'company',cost:finite(a.cost),note:`${a.detail}（${a.weeks}週）。`,label:'実行する',attributes:{'data-action':'media-action','data-id':id}});
  }else if(kind==='forum'){
    const x=(g.ventureForumEvents||[]).find(e=>e.id===id);
    if(x)askCost({title:x.name,wallet:'personal',cost:finite(x.fee),note:`人脈+${finite(x.networkGain).toFixed(1)}、企業評判+${finite(x.repGain).toFixed(1)}。`,label:'参加する',attributes:{'data-action':'venture-forum','data-id':id}});
  }else if(kind==='auction'){
    const x=(g.luxuryAuctionListings||[]).find(e=>e.id===id);
    if(x)askCost({title:`${x.name}に入札`,wallet:'personal',cost:finite(x.currentBid)*AUCTION_MARKUP,note:`落札価格は現在価格の${AUCTION_MARKUP}倍です。高級資産として個人の資産に加わります。`,label:'入札する',attributes:{'data-action':'auction-bid','data-id':id}});
  }
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('media',{render});
})();
