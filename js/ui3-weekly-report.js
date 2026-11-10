// UI v3 weekly report sheet — docs/ui-v3/README.md 5.4 (UI3-2).
//
// The sheet can open over a screen the current UI still renders. There, css/d-ui-city-lab.css forces the
// colour of every h2 inside #modal-root (`body.city-lab-presentation #modal-root :is(h2,…)!important`), so
// the two section headings are `div role="heading"` instead of h2: same meaning for assistive technology,
// and the v3 label colour is not overridden. The same file recolours every p and small there, so the
// empty-events note is a div, and the next move's note colour is restored in css/ui3-weekly-report.css.
//
// Presentation only. js/app.js asks modules.ui3.renderSheet('weekly-report', …) when a week has been
// advanced; with ?ui=3 this module answers with the sheet, otherwise the current modal is shown
// unchanged. It reads the game through the helpers the current modal uses (ceoDashboard.weeklyImpact,
// finance.cashBridge, executiveSecretary, foundingTutorial) and every control it renders dispatches an
// existing `data-action`. It never writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerSheet)throw new Error('js/ui3-shell.js must be loaded before ui3-weekly-report.js.');

const MAX_EVENTS=2;     // README 5.4: this week's events

// "+" / "−" (U+2212) in front of a compactYen amount; zero has no sign.
function signed(value,money){
  const amount=Number(value)||0;
  return amount>0?`+${money(amount)}`:amount<0?`−${money(-amount)}`:money(0);
}
const direction=value=>Number(value)>0?' u-up':Number(value)<0?' u-down':'';

// The week's cash movement, from the same statement the current modal's cash bridge uses. null when
// it cannot be read, so the sentence then says nothing about cash.
function cashChange(g){
  try{
    const change=Number(modules.finance?.cashBridge?.(g,'week')?.netCashChange);
    return Number.isFinite(change)?change:null;
  }catch(error){return null;}
}

// One sentence for the whole week (README 5.4). Profit decides the first half; a falling cash
// balance is added because a profitable week can still burn cash.
function resultSentence(profit,previousProfit,cash){
  const fell=cash!==null&&cash<0;
  if(profit>0){
    if(fell)return '黒字でしたが、現金は減りました';
    return previousProfit!==null&&previousProfit>0?'黒字が続いています':'黒字でした';
  }
  if(profit<0){
    if(fell)return '赤字で、現金も減りました';
    return previousProfit!==null&&previousProfit<0?'赤字が続いています':'赤字でした';
  }
  return fell?'利益は出ず、現金は減りました':'収支はゼロでした';
}

// The first of: a critical secretary task (warn), the founding guide's current step, the secretary's
// next task. The same order as the home screen's "this week" list. The sheet closes with the `tab`
// action (secretary-jump and founding-tutorial-jump leave a modal open), so the target is a tab.
function nextMove({g,engine}){
  const secretary=modules.executiveSecretary,founding=modules.foundingTutorial;
  const tasks=secretary.generateTasks(g,{
    engine,companyValue:engine.companyValue(),borrowRate:engine.companyBorrowRate?.(),creditLimit:engine.companyCreditLimit?.(),
    maPortfolio:modules.maPortfolioSummary?.build?.(g),ipoReady:!g.publicCompany&&engine.ipoMissingReasons().length===0
  });
  const critical=tasks.find(row=>row.priority==='critical');
  if(critical)return {warn:true,icon:'⚠',title:critical.title,detail:critical.reason,tab:critical.targetTab};
  const guide=founding.build(g);
  if(guide.displayMode==='guide'&&guide.current){
    return {warn:false,icon:'📘',title:`創業ガイド ${guide.current.order}/${guide.total}：${guide.current.title}`,detail:guide.current.description,tab:guide.current.targetTab};
  }
  if(tasks.length)return {warn:false,icon:'💡',title:tasks[0].title,detail:tasks[0].reason,tab:tasks[0].targetTab};
  return {warn:false,icon:'🏠',title:'ホームを見る',detail:'次にやることを確認します',tab:'home'};
}

// This week's events only: the game's news lines ("第N週：…") whose week is the report's week, the
// first two. Not summary.newNews: that is "news added since the last report", which can carry older
// weeks (design decision, 2026-11-11).
function eventRows(g,week,esc){
  const news=(Array.isArray(g?.news)?g.news:[]).filter(entry=>{
    const match=/^第(\d+)週[：:]/.exec(String(entry??''));
    return match&&Number(match[1])===week;
  }).slice(0,MAX_EVENTS);
  if(!news.length)return '<div class="u-h2">大きな出来事はありませんでした。</div>';
  return `<div class="u-list" data-ui3-report="events">${news.map(entry=>{
    const text=String(entry??'').replace(/^第\d+週[：:]\s*/,'');
    return `<div class="u-row"><span><b>${esc(text)}</b></span></div>`;
  }).join('')}</div>`;
}

modules.ui3.registerSheet('weekly-report',{
  render(context){
    const {g,engine,summary,esc,money}=context;
    const impact=modules.ceoDashboard.weeklyImpact(g,{companyValue:engine.companyValue()});
    const metric=id=>impact.metrics.find(row=>row.id===id)||{value:0,delta:0,hasDelta:false};
    const profit=metric('profit'),sales=metric('sales'),cash=metric('cash');
    const delta=row=>row.hasDelta?`前週比 ${modules.ceoDashboard.deltaLabel(row.delta,money)}`:'前週比較なし';
    const deltaClass=row=>row.hasDelta?direction(row.delta):'';
    const week=Number.isFinite(Number(summary?.week))?Number(summary.week):g.week;
    const sentence=resultSentence(profit.value,profit.hasDelta?profit.value-profit.delta:null,cashChange(g));
    const next=nextMove(context);
    const body=`<section class="u-card" data-ui3-report="summary" aria-label="今週の成績">`
      +`<div class="u-stat hero"><span>利益</span><b class="u-money${direction(profit.value)}">${esc(signed(profit.value,money))}</b><span class="u-delta${deltaClass(profit)}">${esc(delta(profit))}</span></div>`
      +`<div class="u-stats two">`
      +`<div class="u-stat"><span>売上</span><b class="u-money">${esc(money(sales.value))}</b><span class="u-delta${deltaClass(sales)}">${esc(delta(sales))}</span></div>`
      +`<div class="u-stat"><span>会社現金</span><b class="u-money">${esc(money(cash.value))}</b><span class="u-delta${deltaClass(cash)}">${esc(delta(cash))}</span></div>`
      +`</div></section>`
      +`<div class="u-h2" role="heading" aria-level="2">今週の出来事</div>${eventRows(g,week,esc)}`
      +`<div class="u-h2" role="heading" aria-level="2">次の一手</div>`
      +`<button type="button" class="u-action${next.warn?' warn':''}" data-ui3-report="next" data-action="tab" data-tab="${esc(next.tab)}"><i aria-hidden="true">${next.icon}</i>`
      +`<span><b>${esc(next.title)}</b><small>${esc(next.detail)}</small></span></button>`;
    return {
      eyebrow:`第${week}週の結果`,title:sentence,body,
      actions:'<button type="button" class="u-btn" data-action="tab" data-tab="report">詳しい決算</button>'
        +'<button type="button" class="u-btn primary" data-action="close-modal">閉じる</button>'
    };
  }
});
})();
