// UI v3 market screen — docs/ui-v3/README.md 5.5 (UI3-5), hub type.
//
// Card: the account's cash (labelled personal or company, README 2), market value of the holdings, unrealised gain or loss (for the chosen
// account: personal or company). List: the holdings and favourites (a row opens the stock sheet: price, change,
// holding, favourite, sell / buy) and "銘柄を探す" (a sheet with every stock and a sector filter). Buying and
// selling go to the existing dialogs of the current UI (`buy-stock` / `sell-stock` ask for the number of shares
// first, so the cost is only known after it: those dialogs are the confirmation, and a v3 number-input sheet is
// the work UI3-9a). The company's own stock operations (split, MBO, defence, dividends, buy-backs, capital
// allocation), the chart and the margin panel stay reachable through the "ほかの詳細（現行の画面）" row.
//
// The account is view state kept here. `buy-stock` / `sell-stock` read the current UI's own account setting
// (`data-bind="selectedAccount"`), so a hidden select inside #app is changed through its own `change` event
// before a trade, exactly as the current screen's select does; nothing is written to the engine here.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen)throw new Error('js/ui3-shell.js must be loaded before ui3-market.js.');
const esc=modules.ui3.esc;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');
const state={account:'personal',sector:'all'};
let context=null;

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
function signed(value,money){
  const amount=finite(value);
  return amount>0?`+${money(amount)}`:amount<0?`−${money(-amount)}`:money(0);
}
function signedPercent(ratio){
  const percent=Math.round(finite(ratio)*1000)/10;
  return percent>0?`+${percent.toFixed(1)}%`:percent<0?`−${Math.abs(percent).toFixed(1)}%`:'0.0%';
}
const direction=value=>finite(value)>0?' u-up':finite(value)<0?' u-down':'';
const row=(attributes,title,note,end='›',endClass='')=>`<button type="button" class="u-row"${attributes}><span><b>${esc(title)}</b>${note?`<small>${esc(note)}</small>`:''}</span><span class="u-end${endClass}">${esc(end)}</span></button>`;

const holdingsOf=g=>(state.account==='company'?g.companyStocks:g.personalStocks)||{};
// week-over-week change, rounded to the 0.1% that is displayed, so a change that shows as 0.0% is not coloured
const changeOf=stock=>finite(stock.previous)>0?Math.round((finite(stock.price)-finite(stock.previous))/finite(stock.previous)*1000)/1000:0;
const accountLabel=()=>state.account==='company'?'会社':'個人';
// The current stock panel's own condition (js/app.js stockTradeCapacity): a company account trades only with the
// investment department. Read, never written.
const blockedOf=g=>state.account==='company'&&!g.departments?.investment;
const BLOCKED_TITLE='会社口座の売買には投資部門が必要です';

function render(ctx){
  context=ctx;
  const {g,money}=ctx;
  const holdings=holdingsOf(g);
  const market=g.market||[];
  const held=market.filter(stock=>finite(holdings[stock.id]?.qty)>0);
  const favourites=market.filter(stock=>!held.includes(stock)&&(g.favoriteStockIds||[]).includes(stock.id));
  const value=held.reduce((sum,stock)=>sum+finite(holdings[stock.id].qty)*finite(stock.price),0);
  const gain=held.reduce((sum,stock)=>sum+(finite(stock.price)-finite(holdings[stock.id].avg))*finite(holdings[stock.id].qty),0);
  const cash=state.account==='company'?g.companyCash:g.personalCash;
  const card=`<section class="u-card" aria-label="${accountLabel()}口座の成績" data-ui3-market="summary"><div class="u-stats">`
    +`<div class="u-stat"><span>${accountLabel()}の現金</span><b class="u-money">${esc(money(finite(cash)))}</b></div>`
    +`<div class="u-stat"><span>保有の時価</span><b class="u-money">${esc(money(value))}</b></div>`
    +`<div class="u-stat"><span>含み損益</span><b class="u-money${direction(gain)}">${esc(signed(gain,money))}</b></div>`
    +`</div></section>`;
  const seg=`<div class="u-seg" role="group" aria-label="投資口座" data-ui3-market="account">`
    +`<button type="button" data-ui3-mkt-account="personal" aria-pressed="${state.account==='personal'}">個人口座</button>`
    +`<button type="button" data-ui3-mkt-account="company" aria-pressed="${state.account==='company'}">会社口座</button></div>`
    +`<select hidden data-bind="selectedAccount" aria-hidden="true" tabindex="-1"><option value="personal"${state.account==='personal'?' selected':''}>個人口座</option><option value="company"${state.account==='company'?' selected':''}>会社口座</option></select>`;
  const stockRow=(stock,note)=>row(` data-ui3-mkt="stock" data-id="${esc(stock.id)}"`,stock.name,note,`${money(finite(stock.price))} ${signedPercent(changeOf(stock))}`,direction(changeOf(stock)));
  const rows=held.map(stock=>stockRow(stock,`${stock.id} · 保有${Math.round(finite(holdings[stock.id].qty)).toLocaleString('ja-JP')}株`))
    .concat(favourites.map(stock=>stockRow(stock,`${stock.id} · お気に入り`))).join('');
  const list=rows?`<div class="u-list" data-ui3-market="holdings">${rows}</div>`
    :`<div class="u-h2" data-ui3-market="none">${accountLabel()}口座の保有とお気に入りはまだありません。「銘柄を探す」から選びます。</div>`;
  const more=row(' data-ui3-mkt="all"','銘柄を探す',`${market.length}銘柄`)
    +row(' data-ui3-current="market"','ほかの詳細（現行の画面）','自社株の操作（分割・MBO・配当・自社株買い）、チャート、信用取引、資本配分など');
  const blocked=blockedOf(g)?`<button type="button" class="u-action warn" data-ui3-market="blocked" data-action="tab" data-tab="office"><i aria-hidden="true">⚠</i><span><b>${BLOCKED_TITLE}</b><small>本社の部門を設定する</small></span></button>`:'';
  return seg+blocked+card+'<h2 class="u-h2">保有・お気に入り</h2>'+list+`<h2 class="u-h2">そのほか</h2><div class="u-list">${more}</div>`;
}

// ---- sheets ------------------------------------------------------------------------------------
function show(html){const root=modalRoot();if(root)root.innerHTML=html;}

function stockSheet(id){
  const {g,money}=context;
  const stock=(g.market||[]).find(item=>item.id===id);
  if(!stock)return;
  const holding=holdingsOf(g)[id];
  const quantity=finite(holding?.qty);
  const favourite=(g.favoriteStockIds||[]).includes(id);
  const blocked=blockedOf(g);
  const change=changeOf(stock);
  const valuation=`PER ${stock.per?`${finite(stock.per).toFixed(1)}倍`:'—'} / PBR ${stock.pbr?`${finite(stock.pbr).toFixed(1)}倍`:'—'}`;
  const body=`<span hidden data-ui3-market-sheet></span><div class="u-stats">`
    +`<div class="u-stat"><span>株価</span><b class="u-money">${esc(money(finite(stock.price)))}</b></div>`
    +`<div class="u-stat"><span>前週比</span><b class="u-money${direction(change)}">${esc(signedPercent(change))}</b></div>`
    +`<div class="u-stat"><span>保有（${accountLabel()}）</span><b class="u-money">${esc(quantity>0?`${Math.round(quantity).toLocaleString('ja-JP')}株`:'—')}</b></div></div>`
    +(blocked?`<div class="u-h2" data-ui3-market="blocked-note">${BLOCKED_TITLE}（本社の部門で投資部門を設置します）。</div>`:'')
    +(quantity>0?`<div class="u-h2" data-ui3-market="average">平均取得価格 ${esc(money(finite(holding.avg)))}</div>`:'')
    +`<div class="u-list">${row(` data-action="favorite-stock" data-id="${esc(id)}" data-ui3-mkt-refresh="${esc(id)}"`,favourite?'お気に入りから外す':'お気に入りに入れる','',favourite?'★':'☆')}</div>`;
  show(modules.ui3.sheet({eyebrow:`${stock.id} · ${stock.sector}`,title:stock.name,subtitle:`時価総額 ${money(finite(stock.marketCap))} · ${valuation}`,body,
    actions:`<button type="button" class="u-btn" data-action="sell-stock" data-id="${esc(id)}" data-ui3-sync-account${quantity>0&&!blocked?'':' disabled'}>売る</button>`
      +`<button type="button" class="u-btn primary" data-action="buy-stock" data-id="${esc(id)}" data-ui3-sync-account${blocked?' disabled':''}>買う</button>`}));
}

function allStocksSheet(){
  const {g,money}=context;
  const market=g.market||[];
  const sectors=['all',...new Set(market.map(stock=>stock.sector))];
  if(!sectors.includes(state.sector))state.sector='all';
  const chips=`<nav class="u-chips" aria-label="業種" data-ui3-market="sectors">${sectors.map(sector=>`<button type="button" class="u-chip" data-ui3-mkt-sector="${esc(sector)}" aria-pressed="${sector===state.sector}">${sector==='all'?'全業種':esc(sector)}</button>`).join('')}</nav>`;
  const holdings=holdingsOf(g);
  const rows=market.filter(stock=>state.sector==='all'||stock.sector===state.sector).map(stock=>row(` data-ui3-mkt="stock" data-id="${esc(stock.id)}"`,stock.name,
    `${stock.id} · ${stock.sector}${finite(holdings[stock.id]?.qty)>0?' · 保有':''}`,`${money(finite(stock.price))} ${signedPercent(changeOf(stock))}`,direction(changeOf(stock)))).join('');
  show(modules.ui3.sheet({eyebrow:`${market.length}銘柄`,title:'銘柄を探す',body:`<span hidden data-ui3-market-sheet></span>${chips}<div class="u-list" data-ui3-market="all-stocks">${rows}</div>`,
    actions:'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'}));
}

// ---- events ------------------------------------------------------------------------------------
// The current UI keeps its account setting in a select it owns; changing it fires the app's own handler.
function syncAccount(){
  const select=globalThis.document?.querySelector('#app select[data-bind="selectedAccount"]');
  if(!select)return;
  select.value=state.account;
  select.dispatchEvent(new Event('change',{bubbles:true}));
}
function onClick(event){
  const target=event.target instanceof Element?event.target:null;
  if(!target||!context)return;
  if(target.closest('[data-ui3-sync-account]')&&!target.closest('[disabled]')){syncAccount();return;}
  const account=target.closest('[data-ui3-mkt-account]');
  if(account){state.account=account.dataset.ui3MktAccount;syncAccount();return;}
  const sector=target.closest('[data-ui3-mkt-sector]');
  if(sector){state.sector=sector.dataset.ui3MktSector;allStocksSheet();return;}
  const refresh=target.closest('[data-ui3-mkt-refresh]');
  if(refresh){const id=refresh.dataset.ui3MktRefresh;setTimeout(()=>{if(context)stockSheet(id);},0);return;}
  const control=target.closest('[data-ui3-mkt]');
  if(!control||control.disabled)return;
  if(control.dataset.ui3Mkt==='stock')stockSheet(control.dataset.id);
  else if(control.dataset.ui3Mkt==='all')allStocksSheet();
}
globalThis.document?.addEventListener('click',onClick,true);

modules.ui3.registerScreen('market',{render});
})();
