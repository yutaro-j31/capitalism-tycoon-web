// UI v3 pe-portfolio screen — docs/ui-v3/README.md 5 (UI3-6), hub type. The tab is shown only after the PE firm is
// unlocked (js/ui3-shell.js isAvailable).
//
// Card: the funds' cash, the number of portfolio companies and their combined weekly profit. List: the active portfolio
// companies; a row opens a read-only sheet (README: "既存の操作をそのまま" — the six levers, the exit and the fund
// formation stay in the current screen, reachable through "ほかの詳細（現行の画面）"). Nothing here writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen)throw new Error('js/ui3-shell.js must be loaded before ui3-pe-portfolio.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
let context=null;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const row=(attributes,title,note,end='›')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end">${esc(end)}</span></button>`;
const stat=(label,value)=>`<div class="u-stat"><span>${esc(label)}</span><b class="u-money">${esc(value)}</b></div>`;
const signed=(value,money)=>finite(value)>0?`+${money(finite(value))}`:finite(value)<0?`−${money(-finite(value))}`:money(0);
const direction=value=>finite(value)>0?' u-up':finite(value)<0?' u-down':'';

function dealsOf(g){
  const out=[];
  for(const fund of g.peFirm?.funds||[])for(const deal of fund.deals||[])if(deal?.portfolioCompany&&deal.status==='active')out.push({fund,deal});
  return out;
}
const titleOf=(engine,deal)=>deal.companyName||engine.business?.(deal.businessID)?.name||deal.businessID||deal.tierID||deal.id;

function render(ctx){
  context=ctx;
  const {g,money,engine}=ctx;
  const deals=dealsOf(g);
  const cash=(g.peFirm?.funds||[]).reduce((sum,f)=>sum+finite(f.cash),0);
  const profit=deals.reduce((sum,{deal})=>sum+finite(deal.portfolioCompany.weeklyProfit),0);
  const card=`<section class="u-card" aria-label="PEファンドの状況" data-ui3-pe="summary"><div class="u-stats">`
    +`<div class="u-stat"><span>ファンドの現金</span><b class="u-money">${esc(money(cash))}</b></div>`
    +`<div class="u-stat"><span>投資先</span><b class="u-money">${deals.length}社</b></div>`
    +`<div class="u-stat"><span>週次損益（合計）</span><b class="u-money${direction(profit)}">${esc(signed(profit,money))}</b></div></div></section>`;
  const rows=deals.map(({fund,deal})=>row(` data-ui3-pe="deal" data-id="${esc(deal.id)}" data-fund-id="${esc(fund.id)}"`,titleOf(engine,deal),`${fund.id} · 店舗${finite(deal.portfolioCompany.storeCount)}軒`,signed(deal.portfolioCompany.weeklyProfit,money))).join('');
  const list=rows?`<div class="u-list" data-ui3-pe="deals">${rows}</div>`:'<div class="u-h2" data-ui3-pe="none">買収済みの企業はありません。</div>';
  const more=row(' data-ui3-current="pe-portfolio"','ほかの詳細（現行の画面）','6つのレバー（価格・品質・拠点・仕入れ・人員・商品構成）、Exit、ファンドの組成');
  return card+'<h2 class="u-h2">投資先</h2>'+list+`<h2 class="u-h2">そのほか</h2><div class="u-list">${more}</div>`;
}

function show(html){const root=modalRoot();if(root)root.innerHTML=html;}

function dealSheet(fundID,dealID){
  const {g,money,engine}=context;
  const found=dealsOf(g).find(x=>x.deal.id===dealID&&x.fund.id===fundID);
  if(!found)return;
  const {fund,deal}=found,pc=deal.portfolioCompany;
  const body=`<span hidden data-ui3-pe-sheet></span><div class="u-stats">${stat('自社の現金',money(finite(pc.cash)))}`
    +`<div class="u-stat"><span>週次損益</span><b class="u-money${direction(pc.weeklyProfit)}">${esc(signed(pc.weeklyProfit,money))}</b></div>${stat('改善スコア',`${finite(pc.improvementScore)}/100`)}</div>`
    +`<div class="u-stats">${stat('店舗',`${finite(pc.storeCount)}軒`)}${stat('価格係数',finite(pc.priceMultiplier).toFixed(2))}${stat('品質投資',money(finite(pc.qualityInvestment)))}</div>`
    +(deal.employmentPromise?'<div class="u-h2">雇用維持の約束あり：人員削減と閉店はできません。</div>':'')
    +`<div class="u-list">${row(' data-ui3-current="pe-portfolio"','現行の画面で経営する','価格・品質・拠点・仕入れ・人員・商品構成、Exit')}</div>`;
  show(modules.ui3.sheet({eyebrow:fund.id,title:titleOf(engine,deal),subtitle:'PEポートフォリオ',body,actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'}));
}

function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  const control=target.closest('[data-ui3-pe="deal"]');
  if(control)dealSheet(control.dataset.fundId,control.dataset.id);
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('pe-portfolio',{render});
})();
