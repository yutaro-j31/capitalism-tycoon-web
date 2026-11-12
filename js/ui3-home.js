// UI v3 home screen — docs/ui-v3/README.md 5.1 (UI3-1).
//
// Presentation only. It reads the game through the same helpers the current home uses
// (ceoDashboard, executiveSecretary, foundingTutorial, engine.growthMilestones) and every
// control it renders dispatches an existing `data-action` through js/app.js `action()`.
// It never writes engine state. While the cash crisis is open the shell shows the current
// home instead (CURRENT_UI_RULES.home in js/ui3-shell.js), so this screen has no crisis
// handling of its own.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3)throw new Error('js/ui3-shell.js must be loaded before ui3-home.js.');

const MAX_ACTIONS=3;     // README 5.1: this week's actions
const MAX_NEWS=2;        // README 5.1: latest news rows

// Growth stage: the last achieved milestone of the engine's own growth ladder (README 5.1).
function stageName(engine){
  const achieved=(engine.growthMilestones?.()||[]).filter(row=>row?.achieved);
  return achieved.length?String(achieved[achieved.length-1].title||''):'';
}

// "+" / "−" (U+2212) in front of a compactYen amount; zero has no sign.
function signed(value,money){
  const amount=Number(value)||0;
  return amount>0?`+${money(amount)}`:amount<0?`−${money(-amount)}`:money(0);
}
const direction=value=>Number(value)>0?' u-up':Number(value)<0?' u-down':'';

function profitCard({g,engine,esc,money}){
  const dashboard=modules.ceoDashboard;
  const impact=dashboard.weeklyImpact(g,{companyValue:engine.companyValue()});
  const metric=id=>impact.metrics.find(row=>row.id===id)||{value:0,delta:0,hasDelta:false};
  const profit=metric('profit'),sales=metric('sales');
  const stores=(g.stores||[]).filter(store=>store&&store.status==='open').length;
  const delta=profit.hasDelta?`前週比 ${dashboard.deltaLabel(profit.delta,money)}`:'前週比較なし';
  return `<section class="u-card" aria-label="今週の成績">`
    +`<div class="u-stat hero"><span>今週の利益</span><b class="u-money${direction(profit.value)}">${esc(signed(profit.value,money))}</b>`
    +`<span class="u-delta${profit.hasDelta?direction(profit.delta):''}">${esc(delta)}</span></div>`
    +`<div class="u-stats">`
    +`<div class="u-stat"><span>売上</span><b class="u-money">${esc(money(sales.value))}</b></div>`
    +`<div class="u-stat"><span>企業価値</span><b class="u-money">${esc(money(engine.companyValue()))}</b></div>`
    +`<div class="u-stat"><span>店舗数</span><b class="u-money">${esc(`${stores}店`)}</b></div>`
    +`</div></section>`;
}

// This week's actions: critical secretary tasks (warn) first, then the founding guide's current
// step, then the remaining secretary tasks in the secretary's own order; three at most (README 5.1).
function actionItems({g,engine}){
  const secretary=modules.executiveSecretary,founding=modules.foundingTutorial;
  const tasks=secretary.generateTasks(g,{
    engine,companyValue:engine.companyValue(),borrowRate:engine.companyBorrowRate?.(),creditLimit:engine.companyCreditLimit?.(),
    maPortfolio:modules.maPortfolioSummary?.build?.(g),ipoReady:!g.publicCompany&&engine.ipoMissingReasons().length===0
  });
  const task=row=>({kind:'task',warn:row.priority==='critical',icon:row.priority==='critical'?'⚠':'💡',title:row.title,detail:row.reason,
    attributes:{'data-action':'secretary-jump','data-tab':row.targetTab,'data-focus':row.focus,'data-ui3-dest':row.id}});
  const guide=founding.build(g);
  let guideItem=null;
  if(guide.displayMode==='guide'&&guide.current){
    guideItem={kind:'guide',warn:false,icon:'📘',title:`創業ガイド ${guide.current.order}/${guide.total}：${guide.current.title}`,detail:guide.current.description,
      attributes:{'data-action':'founding-tutorial-jump','data-step':guide.current.id,'data-tab':guide.current.targetTab,'data-focus':guide.current.targetSelector,'data-ui3-dest':`guide:${guide.current.id}`}};
  }
  // After the guide, the current home's "成長ロードマップ" card is not an action here: the missions
  // entry below reaches the same screen (design decision, 2026-11-11).
  const critical=tasks.filter(row=>row.priority==='critical').map(task);
  const rest=tasks.filter(row=>row.priority!=='critical').map(task);
  // (The cash-crisis response sheet is opened by the shell's notice, which every v3 screen shows including this one; no slot here: README 10.2.)
  return [...critical,...(guideItem?[guideItem]:[]),...rest].slice(0,MAX_ACTIONS);
}

// ---- where a row of "今週やること" goes (UI3-10c, README 10.10; the full table is in migration-ledger.md) ----------------------------
// A row only used to switch to the tab the secretary names (js/app.js secretary-jump / founding-tutorial-jump, unchanged), which left some rows
// on a screen without the operation they ask for. Each row now carries data-ui3-dest (the secretary task id, or "guide:<step>") and this
// resolver, which runs before the app's handler, sends the ones below somewhere the operation exists:
//  - a store task opens the business screen's store sheet for the store the secretary means (the same expressions as executive-secretary.js);
//  - crisis_active opens the crisis response sheet;
//  - what v3 has no operation for opens the current screen directly (modules.ui3.openCurrentUI), on the tab that holds the operation, with
//    the focus the secretary names;
//  - every other row passes through to the app's own jump (the v3 screen it names has the operation).
// Nothing here writes engine state.
const nf=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const openStoresOf=g=>(g.stores||[]).filter(store=>store&&store.status==='open');
const stockoutOf=store=>nf(store.stockoutWeeks||store.stockoutRisk||store.inventoryShortage)>0||nf(store.inventory)<Math.max(1,nf(store.weeklyDemand))*.5;
const overstockOf=store=>nf(store.inventory)>Math.max(20,nf(store.weeklyDemand)*6);
const lossStoreOf=g=>openStoresOf(g).filter(store=>nf(store.lastProfit)<0).sort((a,b)=>nf(a.lastProfit)-nf(b.lastProfit))[0];
const supplyStoreOf=g=>openStoresOf(g).find(store=>modules.supply?.isTargetBusinessID?.(store.businessID));
const DESTINATIONS={
  supply_stockout:{store:g=>openStoresOf(g).find(stockoutOf),scroll:'[data-ui3-supply-card]'},
  supply_overstock:{store:g=>openStoresOf(g).find(overstockOf),scroll:'[data-ui3-supply-card]'},
  store_loss:{store:lossStoreOf},
  'guide:unit_economics':{store:supplyStoreOf,scroll:'[data-ui3-supply-card]'},
  'guide:first_improvement':{business:g=>(g.businesses||[]).find(business=>(g.stores||[]).some(store=>store.businessID===business.id&&store.status!=='closed'))},
  // negative cash and the declared crisis go to the crisis response sheet; before the weekly check has declared the crisis the sheet cannot open,
  // and the only lever left is the funding screen
  finance_cash_negative:{crisis:true,fallbackTab:'bank'},
  crisis_active:{crisis:true,fallbackTab:'bank'},
  workforce_retention:{current:'office',officeTab:'keypeople'},
  growth_product_ready:{current:'business'},
  growth_ipo_ready:{current:'office',officeTab:'board'}
};
const destinationFor=id=>DESTINATIONS[id]||(String(id).startsWith('ma_')?{current:'ma'}:null);
const goTab=screen=>{
  const button=globalThis.document?.querySelector(`[data-ui3-all-screens] [data-action="tab"][data-tab="${screen}"]`);
  if(!button)return false;
  button.click();
  return true;
};
function focusOn(selector){
  const target=(selector&&globalThis.document.querySelector(selector))||globalThis.document.getElementById('screen');
  if(!target)return;
  target.setAttribute('tabindex',target.getAttribute('tabindex')||'-1');
  target.scrollIntoView?.({block:'start'});
  target.focus?.({preventScroll:true});
}
function resolveDestination(control){
  const rule=destinationFor(control.dataset.ui3Dest);
  const engine=modules.playerEngineBridge?.getEngine?.();
  if(!rule||!engine?.g)return false;
  const g=engine.g;
  if(rule.crisis)return modules.ui3.openCrisisSheet()||(rule.fallbackTab?goTab(rule.fallbackTab):false);
  if(rule.current){
    if(!modules.ui3.openCurrentUI(rule.current))return false;
    if(rule.officeTab)globalThis.document.querySelector(`[data-action="office-tab"][data-id="${rule.officeTab}"]`)?.click();
    focusOn(control.dataset.focus);
    return true;
  }
  if(rule.store){
    const store=rule.store(g);
    if(!store||!goTab('business'))return false;
    const open=globalThis.document.querySelector(`[data-ui3-biz="store"][data-id="${store.id}"]`);
    if(!open)return false;
    open.click();
    if(rule.scroll)globalThis.document.querySelector(rule.scroll)?.scrollIntoView?.({block:'start'});
    return true;
  }
  if(rule.business){
    const business=rule.business(g);
    if(!business||!goTab('business'))return false;
    const open=globalThis.document.querySelector(`[data-ui3-biz="business"][data-id="${business.id}"]`);
    if(!open)return false;
    open.click();
    return true;
  }
  return false;
}
globalThis.document?.addEventListener('click',event=>{
  const control=event.target instanceof Element?event.target.closest('[data-ui3-dest]'):null;
  if(!control||control.disabled)return;
  if(resolveDestination(control)){event.preventDefault();event.stopImmediatePropagation();}
},true);

function actionCard(item,esc){
  const attributes=Object.entries(item.attributes).map(([name,value])=>` ${name}="${esc(value)}"`).join('');
  return `<button type="button" class="u-action${item.warn?' warn':''}"${attributes}><i aria-hidden="true">${item.icon}</i>`
    +`<span><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></span></button>`;
}

// News strings read "第N週：…"; the week becomes the row's note. Rows open the news screen until
// UI3-9 turns it into a sheet (README 5.1).
function newsRows({g,esc}){
  const rows=(Array.isArray(g.news)?g.news:[]).slice(0,MAX_NEWS).map(entry=>{
    const text=String(entry??''),match=/^(第\d+週)[：:]\s*([\s\S]*)$/.exec(text);
    const title=match?match[2]:text,week=match?match[1]:'';
    return `<button type="button" class="u-row" data-action="tab" data-tab="news"><span><b>${esc(title)}</b>${week?`<small>${esc(week)}</small>`:''}</span>`
      +`<span class="u-end" aria-hidden="true">›</span></button>`;
  });
  return rows.length?`<h2 class="u-h2">ニュース</h2><div class="u-list">${rows.join('')}</div>`:'';
}

// A permanent way into 進行・目標: the next milestone that is not achieved yet names the row.
function missionsRow({engine,esc}){
  const next=(engine.growthMilestones?.()||[]).find(row=>row&&!row.achieved);
  const note=next?String(next.title||''):'すべて達成しました';
  return `<h2 class="u-h2">目標</h2><div class="u-list"><button type="button" class="u-row" data-ui3-home="missions" data-action="tab" data-tab="missions">`
    +`<span><b>進行・目標</b><small>${esc(note)}</small></span><span class="u-end" aria-hidden="true">›</span></button></div>`;
}

modules.ui3.registerScreen('home',{
  render(context){
    const {g,engine,esc}=context;
    const stage=stageName(engine);
    const items=actionItems(context);
    return `<h1 class="u-h1">${esc(g.companyName)}${stage?` <span class="u-badge">${esc(stage)}</span>`:''}</h1>`
      +profitCard(context)
      +`<h2 class="u-h2">今週やること</h2>`
      +(items.length?items.map(item=>actionCard(item,esc)).join(''):'<p class="u-h2">いま急ぐことはありません。</p>')
      +newsRows(context)
      +missionsRow(context);
  }
});
})();
