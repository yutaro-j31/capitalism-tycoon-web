// Phase 7B-3: interactive, read-only store context tabs with stable focus and contextual navigation.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.dUIShell||!modules?.playerEngineBridge?.__installed)throw new Error('d-ui-shell.js and player-engine-bridge.js must be loaded before d-ui-context-tabs.js.');
if(!modules?.uiEnhancerRegistry?.registerUIEnhancer)throw new Error('app.js UI enhancer registry must be loaded before d-ui-context-tabs.js.');
if(modules.dUIContextTabs)throw new Error('D UI context tabs are already registered.');
const TABS=[['overview','概要'],['finance','財務'],['staff','スタッフ'],['product','商品']];
const ACTIONS={overview:['business','店舗を管理','価格・広告・店舗運営を開く'],finance:['report','決算を確認','全社の決算・レポートを開く'],staff:['founder','人材を管理','採用・経営陣の画面を開く'],product:['strategy','商品を強化','研究開発・戦略を開く']};
const NEWS_SECTIONS=Object.freeze([['top','トップ'],['retail','小売'],['management','経営'],['stock','株式市場'],['politics','政治'],['sports','スポーツ']]);
let activeNewsSection='top';
const activeByStore=new Map();
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const esc=value=>String(value??'').replace(/[&<>'\"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function money(value){return modules.engine.compactYen?modules.engine.compactYen(finite(value)):`¥${Math.round(finite(value)).toLocaleString('ja-JP')}`;}
function engine(){return modules.playerEngineBridge.getEngine?.()||null;}
function selectedStore(){
  const marker=document.querySelector('.d-map-marker.selected[data-d-ui-marker^="store:"]');
  const rawID=marker?.dataset?.dUiMarker?.slice(6);const g=engine()?.g;
  if(!rawID||!g)return null;
  const store=(g.stores||[]).find(item=>String(item.id)===String(rawID));
  return store?{key:String(rawID),store,business:engine()?.business?.(store.businessID),g}:null;
}
function metrics(items){return `<div class="d-context-metrics">${items.map(([label,value,note])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong>${note?`<small>${esc(note)}</small>`:''}</div>`).join('')}</div>`;}
function bars(items){return `<div class="d-status-bars">${items.map(([label,value])=>{const score=clamp(finite(value),0,100);return `<label><span>${esc(label)}<b>${score.toFixed(0)}%</b></span><i><em style="width:${score}%"></em></i></label>`;}).join('')}</div>`;}
function action(tab){const item=ACTIONS[tab]||ACTIONS.overview;return `<div class="d-context-actions" aria-label="関連する経営操作"><button type="button" data-d-ui-tab="${esc(item[0])}"><span>${esc(item[1])}</span><small>${esc(item[2])}</small><b aria-hidden="true">›</b></button></div>`;}
function panelContent(tab,context){
  // Same fix as js/d-ui-shell.js: read what market.js actually produces (store.marketResult)
  // before falling back to lastCustomers/store.satisfaction, which nothing ever writes.
  const {store,business,g}=context;const sales=finite(store.lastSales);const profit=finite(store.lastProfit);const customers=finite(store.marketResult?.unitsSold??store.lastCustomers??store.customers);const satisfaction=finite(store.marketResult?.customerSatisfaction??store.satisfaction??g.customerSatisfaction);const cost=Math.max(0,sales-profit);const margin=sales?profit/sales*100:0;
  if(tab==='finance')return metrics([['今週の売上',money(sales)],['今週の利益',money(profit),profit>=0?'黒字':'赤字'],['推定費用',money(cost)],['利益率',`${margin.toFixed(1)}%`]])+bars([['収益性',50+margin],['資金効率',store.efficiency??business?.efficiency??72]])+action(tab);
  if(tab==='staff'){
    const staff=finite(store.staffCount??store.employees?.length??store.workers?.length);const manager=store.managerName??store.manager?.name??'未配置';const service=store.quality??business?.quality??70;const efficiency=store.efficiency??business?.efficiency??72;
    return metrics([['スタッフ数',staff?`${staff.toLocaleString('ja-JP')}人`:'—'],['店長',manager],['サービス品質',`${clamp(finite(service),0,100).toFixed(0)}%`],['運営効率',`${clamp(finite(efficiency),0,100).toFixed(0)}%`]])+bars([['接客力',service],['チーム効率',efficiency]])+action(tab);
  }
  if(tab==='product'){
    const price=finite(store.price??business?.price);const quality=store.productQuality??business?.quality??68;const brand=store.brand??business?.brand??62;
    return metrics([['主力事業',business?.name||'店舗事業'],['販売価格',price?money(price):'—'],['商品品質',`${clamp(finite(quality),0,100).toFixed(0)}%`],['ブランド力',`${clamp(finite(brand),0,100).toFixed(0)}%`]])+bars([['商品魅力度',quality],['ブランド認知',brand]])+action(tab);
  }
  return metrics([['今週の売上',money(sales)],['今週の利益',money(profit)],['来客数',customers?`${customers.toLocaleString('ja-JP')}人`:'—'],['満足度',satisfaction?`${satisfaction.toFixed(1)} ★`:'—']])+bars([['集客力',store.brand??business?.brand??62],['サービス品質',store.quality??business?.quality??70],['商品魅力度',business?.quality??68],['運営効率',store.efficiency??business?.efficiency??72]])+action(tab);
}

function list(value){return Array.isArray(value)?value:[];}
function newsText(row){
  if(typeof row==='string')return row;
  if(!row||typeof row!=='object')return '';
  if(row.text||row.title)return String(row.text||row.title);
  if(row.regimeName)return `第${Math.floor(finite(row.week))}週：景気局面「${row.regimeName}」`;
  return row.type?`第${Math.floor(finite(row.week))}週：${row.type}`:'';
}
function newsLines(rows,emptyText='記事はまだありません。'){
  const items=list(rows).filter(Boolean).map(newsText).filter(Boolean).slice(0,40);
  return items.length?items.map(row=>`<div class="news-line">${esc(row)}</div>`).join(''):`<div class="empty">${esc(emptyText)}</div>`;
}
function newspaperArticles(g,category){
  const rows=[];
  for(const paper of list(g?.weeklyNewspaper)){
    for(const article of list(paper?.articles)){
      if(article?.category!==category)continue;
      rows.push({week:finite(paper.week),title:String(article.title||''),detail:String(article.detail||'')});
    }
  }
  return rows.slice(0,24);
}
function articleRows(rows,emptyText='記事はまだありません。'){
  const items=list(rows).filter(Boolean).slice(0,30);
  return items.length?items.map(row=>`<article class="media-article"><h3>${esc(row.title||'')}</h3>${row.week?`<p>第${Math.floor(finite(row.week))}週</p>`:''}${row.detail?`<p>${esc(row.detail)}</p>`:''}</article>`).join(''):`<div class="empty">${esc(emptyText)}</div>`;
}
function newsCard(title,body,subtitle=''){return `<section class="card"><div class="card-head"><div><h2>${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></div><div class="card-body">${body}</div></section>`;}
function topNewsContent(g){return `<div class="grid two">${newsCard('ニュース履歴',newsLines(g.news,'ニュースなし'))}${newsCard('週次経営履歴',newsLines(g.history,'履歴なし'))}</div>`;}
function retailNewsContent(g){
  const competitor=newspaperArticles(g,'競合');
  const rivalLog=list(g.competitorEventLog).length?g.competitorEventLog:g.competitorEvents;
  return `<div class="grid two">${newsCard('小売・競争',articleRows(competitor,'競争環境の記事はまだありません。'),'既存TYCOON WEEKLY「競合」面')}${newsCard('供給・店舗オペレーション',newsLines(g.supplyChainEvents,'供給イベントはまだありません。'))}${newsCard('競合イベント',newsLines(rivalLog,'競合イベントはまだありません。'))}</div>`;
}
function managementNewsContent(g){
  const corporate=newspaperArticles(g,'企業');
  const management=[...list(g.mediaActionLog),...list(g.employeeComplaintLog),...list(g.keyPersonnelEventLog)];
  return `<div class="grid two">${newsCard('企業・経営',articleRows(corporate,'企業記事はまだありません。'),'既存TYCOON WEEKLY「企業」面')}${newsCard('経営イベント',newsLines(management,'経営イベントはまだありません。'))}</div>`;
}
function stockNewsContent(g){
  return `<div class="grid two">${newsCard('株主・資本市場',newsLines(g.shareholderEventLog,'株主イベントはまだありません。'))}${newsCard('決算・株式市場',newsLines(g.earningsEventLog,'決算イベントはまだありません。'))}</div>`;
}
function politicsNewsContent(g){
  const market=newspaperArticles(g,'市場');
  const macro=list(g.macroHistory).slice(0,16).map(row=>({title:row?.regimeName?`景気局面「${row.regimeName}」`:'マクロ環境',week:row?.week,detail:`景気指数 ${finite(row?.economy).toFixed(2)} · インフレ指数 ${finite(row?.inflation).toFixed(2)} · 政策金利 ${(finite(row?.policyRate)*100).toFixed(2)}%`}));
  const policy=`<div class="kpi-grid mini"><div class="stat"><span>景気指数</span><strong>${finite(g.economy).toFixed(2)}</strong></div><div class="stat"><span>政策金利</span><strong>${(finite(g.policyRate)*100).toFixed(2)}%</strong></div><div class="stat"><span>インフレ指数</span><strong>${finite(g.inflation).toFixed(2)}</strong></div><div class="stat"><span>景気局面</span><strong>${esc(g.macroRegime||'—')}</strong></div></div>`;
  const industry=list(g.industryEventHistory).map(row=>`第${Math.floor(finite(row?.week))}週：${row?.type==='industryEventEnded'?'収束':'発生'}「${String(row?.eventName||'業界イベント')}」`);
  return `<div class="grid two">${newsCard('政策・マクロ',policy,'既存の景気・金利stateを表示')}${newsCard('市場記事',articleRows(market,'市場記事はまだありません。'),'既存TYCOON WEEKLY「市場」面')}${newsCard('景気局面履歴',articleRows(macro,'景気履歴はまだありません。'))}${newsCard('政策・業界イベント',newsLines(industry,'業界イベントはまだありません。'))}</div>`;
}
function sportsNewsContent(g){
  const teams=list(g.sportsTeams);
  const signings=teams.flatMap(team=>list(team?.roster).filter(player=>finite(player?.signedWeek)>0).map(player=>({week:finite(player.signedWeek),title:`${team.name||'球団'}が${player.name||player.playerName||'選手'}を獲得`,detail:player.position?`ポジション ${player.position}`:''}))).sort((a,b)=>b.week-a.week);
  const offers=list(g.sportsSaleOffers).map(offer=>{const team=teams.find(row=>String(row?.id)===String(offer?.teamID));return{title:`${team?.name||'球団'}への売却オファー`,detail:`${offer?.buyer||'投資家'} · ${money(offer?.price)} · ${offer?.status||'pending'}`};});
  const snapshots=teams.map(team=>{const summary=modules.sportsManagement?.summaryFor?.(team);return{title:team.name||'球団',detail:summary?`戦力 ${finite(team.teamStrength).toFixed(1)} · 今季 ${Math.floor(finite(summary.seasonWins))}勝/${Math.floor(finite(summary.seasonGames))}試合 · 週次収支 ${money(summary.net)}`:`戦力 ${finite(team.teamStrength).toFixed(1)}`};});
  return `<div class="grid two">${newsCard('球団近況',articleRows(snapshots,'保有球団はありません。'))}${newsCard('選手獲得',articleRows(signings,'選手獲得ニュースはまだありません。'))}${newsCard('球団売却市場',articleRows(offers,'球団売却オファーはありません。'))}</div>`;
}
function newsSectionContent(g,section){
  if(section==='retail')return retailNewsContent(g);
  if(section==='management')return managementNewsContent(g);
  if(section==='stock')return stockNewsContent(g);
  if(section==='politics')return politicsNewsContent(g);
  if(section==='sports')return sportsNewsContent(g);
  return topNewsContent(g);
}
function enhanceNews(focus=false,uiContext=null){
  const screen=uiContext?.screen||document.querySelector('#screen[data-screen="news"]');
  const g=uiContext?.state||engine()?.g;
  if(!screen||screen.dataset?.screen!=='news'||!g)return false;
  if(!NEWS_SECTIONS.some(([id])=>id===activeNewsSection))activeNewsSection='top';
  const tabs=NEWS_SECTIONS.map(([id,label])=>`<button type="button" role="tab" id="d-news-tab-${id}" aria-selected="${id===activeNewsSection}" aria-controls="d-news-section-panel" tabindex="${id===activeNewsSection?'0':'-1'}" data-d-news-section="${id}">${esc(label)}</button>`).join('');
  screen.innerHTML=`<section class="card wide" data-d-news-sections><div class="card-head"><div><h2>TYCOON WEEKLY</h2><p>既存のニュース・イベントを面ごとに整理して表示します。</p></div></div><div class="card-body"><div style="overflow-x:auto"><div class="d-context-tabs" role="tablist" aria-label="新聞の面" style="grid-template-columns:repeat(6,minmax(88px,1fr));min-width:528px">${tabs}</div></div><div id="d-news-section-panel" role="tabpanel" aria-labelledby="d-news-tab-${activeNewsSection}">${newsSectionContent(g,activeNewsSection)}</div></div></section>`;
  if(focus)screen.querySelector(`[data-d-news-section="${activeNewsSection}"]`)?.focus();
  return true;
}
function selectNews(section,focus=true){
  if(!NEWS_SECTIONS.some(([id])=>id===section))return false;
  activeNewsSection=section;
  return enhanceNews(focus);
}

function renderTabs(panel,context,focus=false){
  const oldTabs=panel.querySelector('.d-context-tabs');if(!oldTabs)return false;
  const active=TABS.some(([id])=>id===activeByStore.get(context.key))?activeByStore.get(context.key):'overview';activeByStore.set(context.key,active);
  oldTabs.innerHTML=TABS.map(([id,label])=>`<button type="button" role="tab" id="d-context-tab-${id}" aria-selected="${id===active}" aria-controls="d-context-tabpanel" tabindex="${id===active?'0':'-1'}" data-d-context-tab="${id}">${label}</button>`).join('');
  oldTabs.setAttribute('role','tablist');oldTabs.setAttribute('aria-label','店舗詳細');
  let content=panel.querySelector('#d-context-tabpanel');
  if(!content){content=document.createElement('div');content.id='d-context-tabpanel';content.className='d-context-tabpanel';content.setAttribute('role','tabpanel');const metricsNode=panel.querySelector('.d-context-metrics');const statusNode=panel.querySelector('.d-status-bars');metricsNode?.remove();statusNode?.remove();oldTabs.after(content);}
  content.setAttribute('aria-labelledby',`d-context-tab-${active}`);content.innerHTML=panelContent(active,context);
  if(focus)oldTabs.querySelector(`[data-d-context-tab="${active}"]`)?.focus();
  panel.dataset.dContextStore=context.key;panel.dataset.dContextActive=active;return true;
}
function enhance(focus=false,uiContext=null){const panel=uiContext?.app?.querySelector?.('.d-context-panel')||document.querySelector('.d-context-panel');const context=selectedStore();if(!panel||!context)return false;if(!focus&&panel.dataset.dContextStore===context.key&&panel.dataset.dContextActive===activeByStore.get(context.key)&&panel.querySelector('[data-d-context-tab]'))return false;return renderTabs(panel,context,focus);}
function select(tab,focus=true){const context=selectedStore();if(!context||!TABS.some(([id])=>id===tab))return false;activeByStore.set(context.key,tab);return enhance(focus);}
function handleClick(event){
  const newsButton=event.target?.closest?.('[data-d-news-section]');
  if(newsButton){event.preventDefault();selectNews(newsButton.dataset.dNewsSection,true);return true;}
  const button=event.target?.closest?.('[data-d-context-tab]');if(!button)return false;event.preventDefault();select(button.dataset.dContextTab,true);return true;
}
function handleKeydown(event){
  const newsButton=event.target?.closest?.('[data-d-news-section]');
  if(newsButton){
    const index=NEWS_SECTIONS.findIndex(([id])=>id===newsButton.dataset.dNewsSection);let next=index;
    if(event.key==='ArrowRight')next=(index+1)%NEWS_SECTIONS.length;else if(event.key==='ArrowLeft')next=(index-1+NEWS_SECTIONS.length)%NEWS_SECTIONS.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=NEWS_SECTIONS.length-1;else return false;
    event.preventDefault();selectNews(NEWS_SECTIONS[next][0],true);return true;
  }
  const button=event.target?.closest?.('[data-d-context-tab]');if(!button)return false;const index=TABS.findIndex(([id])=>id===button.dataset.dContextTab);let next=index;if(event.key==='ArrowRight')next=(index+1)%TABS.length;else if(event.key==='ArrowLeft')next=(index-1+TABS.length)%TABS.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=TABS.length-1;else return false;event.preventDefault();select(TABS[next][0],true);return true;
}
function install(){document.addEventListener('click',handleClick,true);document.addEventListener('keydown',handleKeydown,true);modules.uiEnhancerRegistry.registerUIEnhancer({id:'d-ui-context-tabs',enhance:context=>{enhance(false,context);enhanceNews(false,context);modules.playerMediaAdvertisingUI?.inject?.();}});return true;}
modules.dUIContextTabs=Object.freeze({TABS,ACTIONS,NEWS_SECTIONS,selectedStore,panelContent,action,enhance,select,newspaperArticles,newsSectionContent,enhanceNews,selectNews,handleClick,handleKeydown,install,__installed:true});
install();
})();
