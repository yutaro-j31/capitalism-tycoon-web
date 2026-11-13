// UI v3 rivals screen — docs/ui-v3/README.md 5 (UI3-9), list type.
//
// Rows: the competitors (strength, cash, brand, pressure) and their new products. A competitor row opens a read-only sheet
// with the three responses the current screen has (ads defence 2,000,000 yen, quality defence 2,500,000 yen, acquisition of a
// distressed rival): each is a confirmation sheet with the cost and the company cash afterwards. Counter-campaigns against a
// new product are confirmation sheets too (cost from the engine's own option list).
// Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen||!modules.ui3.confirmSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-rivals.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
let context=null;
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
const stat=(label,value)=>`<div class="u-stat"><span>${esc(label)}</span><b class="u-money">${esc(value)}</b></div>`;
// Copies of js/parity.js respondToCompetitor's fixed costs and the acquisition price rule; tests/ui3-rest-webkit-test.js checks them against the engine's text.
const ADS_COST=2000000,QUALITY_COST=2500000;
// js/competitor-parity.js: strength comes from the counter state, cash from the competitor company row; the price is rounded up to the whole yen
const counterOf=(g,c)=>(g.competitorCounterStates||[]).find(x=>x.id===String(c.id)||x.competitorID===String(c.id))||c;
const acquirePrice=(c,g)=>Math.max(5e6,Math.ceil(finite(counterOf(g,c).strength)*1e6+finite(c.cash)*1.2));
const respondedThisWeek=(g,c,kind)=>(g.rivalResponseHistory||[]).some(row=>row.operationID===`rival-response-${Math.max(0,Math.floor(finite(g.week)))}-${counterOf(g,c).competitorID||c.competitorID||c.id}-${kind}`);
const RESPONSES={ads:{label:'広告防衛',cost:()=>ADS_COST,note:'競合の価格圧力を下げ、企業評判が上がります。'},quality:{label:'品質防衛',cost:()=>QUALITY_COST,note:'競合の価格圧力を下げ、該当する業態の品質が上がります。'},acquire:{label:'買収',cost:acquirePrice,note:'買収可能な（経営が苦しい）競合だけを買収できます。'}};

function render(ctx){
  context=ctx;
  const {g,money,engine}=ctx;
  engine.seedCompetitorCounterStates?.();
  const rivals=(g.competitorStates||[]).map(c=>row(` data-ui3-rival="rival" data-id="${esc(c.id)}"`,c.name,`${engine.business(c.industryID)?.name||c.industryID} · ${engine.area(c.regionID)?.name||'全国'}${c.isDistressed?' · 買収の機会':''}`,`強さ${finite(c.strength).toFixed(0)}`)).join('');
  const products=engine.activeCompetitorProducts?.()||[],campaigns=engine.activeCounterCampaigns?.()||[];
  const productRows=products.map(p=>{
    const campaign=campaigns.find(x=>x.productID===p.id);
    return row(` data-ui3-rival="product" data-id="${esc(p.id)}"`,`${p.competitorName}の新製品`,`${engine.business(p.businessID)?.name||p.businessID} · 第${p.maturesWeek}週まで`,campaign?'対抗中':'対抗する');
  }).join('');
  return '<h2 class="u-h2">競合企業</h2>'+(rivals?`<div class="u-list" data-ui3-rivals="rivals">${rivals}</div>`:'<div class="u-h2" data-ui3-rivals="none">競合企業はまだありません。</div>')
    +'<h2 class="u-h2">競合の新製品</h2>'+(productRows?`<div class="u-list" data-ui3-rivals="products">${productRows}</div>`:'<div class="u-h2" data-ui3-rivals="none-products">競合の新製品はありません。</div>');
}

function show(html){const root=modalRoot();if(root)root.innerHTML=html;}
const blockedReason=(g,c,kind)=>respondedThisWeek(g,c,kind)?'同じ週に同じ競合対策は実行済みです':kind==='acquire'&&(!counterOf(g,c).isDistressed&&!c.isDistressed)?'買収できるのは経営が苦しい競合だけです':'';
function rivalSheet(id){
  const {g,money}=context;
  const c=(g.competitorStates||[]).find(x=>x.id===id);
  if(!c)return;
  const body=`<span hidden data-ui3-rival-sheet></span><div class="u-stats">${stat('強さ',finite(c.strength).toFixed(0))}${stat('現金',money(finite(c.cash)))}${stat('ブランド',finite(c.brandPower).toFixed(0))}</div>`
    +`<div class="u-stats">${stat('価格圧力',finite(c.pricePressure).toFixed(1))}${stat('攻撃性',`${(finite(c.aggression)*100).toFixed(0)}%`)}${stat('状態',c.isDistressed?'買収の機会':'通常')}</div>`
    +`<div class="u-list">${Object.entries(RESPONSES).map(([kind,r])=>row(` data-ui3-rival="respond" data-id="${esc(id)}" data-kind="${kind}"${blockedReason(g,c,kind)?' disabled':''}`,r.label,blockedReason(g,c,kind)||r.note,money(r.cost(c,g)))).join('')}</div>`;
  show(modules.ui3.sheet({eyebrow:`${context.engine.business(c.industryID)?.name||c.industryID}`,title:c.name,body,actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'}));
}
function confirmRespond(id,kind){
  const {g,money}=context;
  const c=(g.competitorStates||[]).find(x=>x.id===id),r=RESPONSES[kind];
  if(!c||!r||blockedReason(g,c,kind))return;
  const cost=r.cost(c,g),cash=finite(g.companyCash);
  show(modules.ui3.confirmSheet({title:`${c.name}：${r.label}`,subtitle:'会社の現金から払います。取り消せません。',
    facts:[{label:'費用',value:money(cost)},{label:'実行後の会社現金',value:money(cash-cost),tone:cash-cost<0?'down':undefined}],note:[r.note,modules.ui3.reserveNote(cash-cost)].filter(Boolean).join(' '),
    confirm:{label:'実行する',attributes:{'data-action':'respond-rival','data-id':id,'data-kind':kind}}}));
}
function productSheet(id){
  const {g,money,engine}=context;
  const p=(engine.activeCompetitorProducts?.()||[]).find(x=>x.id===id);
  if(!p)return;
  const campaign=(engine.activeCounterCampaigns?.()||[]).find(x=>x.productID===id);
  const options=engine.counterCampaignOptions?.()||[];
  const body=`<span hidden data-ui3-rival-sheet></span><div class="u-stats">${stat('相手のブランド',`+${p.brandBoost}`)}${stat('相手の品質',`+${p.qualityBoost}`)}${stat('効果の終わり',`第${p.maturesWeek}週`)}</div>`
    +(campaign?`<div class="u-h2" data-ui3-rival="countering">対抗中：${esc(options.find(o=>o.id===campaign.type)?.label||campaign.type)}（第${campaign.endsWeek}週まで）</div>`
      :`<div class="u-list">${options.map(o=>row(` data-ui3-rival="counter" data-id="${esc(id)}" data-kind="${esc(o.id)}"${finite(g.companyCash)<finite(o.cost)?' disabled':''}`,o.label,`${o.delayWeeks>0?`${o.delayWeeks}週後に効果`:'即座に効果'} · ${o.durationWeeks}週継続 · ${o.detail}`,money(finite(o.cost)))).join('')}</div>`);
  show(modules.ui3.sheet({eyebrow:engine.business(p.businessID)?.name||p.businessID,title:`${p.competitorName}の新製品`,body,actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'}));
}
function confirmCounter(id,kind){
  const {g,money,engine}=context;
  const o=(engine.counterCampaignOptions?.()||[]).find(x=>x.id===kind);
  if(!o||finite(g.companyCash)<finite(o.cost))return;
  const cash=finite(g.companyCash);
  show(modules.ui3.confirmSheet({title:o.label,subtitle:'会社の現金から払います。取り消せません。',
    facts:[{label:'費用',value:money(finite(o.cost))},{label:'実行後の会社現金',value:money(cash-finite(o.cost)),tone:cash-finite(o.cost)<0?'down':undefined}],note:[o.detail,modules.ui3.reserveNote(cash-finite(o.cost))].filter(Boolean).join(' '),
    confirm:{label:'実行する',attributes:{'data-action':'counter-competitor-product','data-id':id,'data-kind':kind}}}));
}
function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const control=target.closest('[data-ui3-rival]');
  if(!control||control.disabled)return;
  const kind=control.dataset.ui3Rival,id=control.dataset.id;
  if(kind==='rival')rivalSheet(id);
  else if(kind==='respond')confirmRespond(id,control.dataset.kind);
  else if(kind==='product')productSheet(id);
  else if(kind==='counter')confirmCounter(id,control.dataset.kind);
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('rivals',{render});
})();
