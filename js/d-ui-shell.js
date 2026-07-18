// Phase 7A-1: D-style premium game shell and strategic map workspace.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before d-ui-shell.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before d-ui-shell.js.');
if(!modules.playerEngineBridge?.__installed)throw new Error('player-engine-bridge.js must be loaded before d-ui-shell.js.');
if(!modules.releaseDiagnosticsUI?.__installed)throw new Error('release-diagnostics-ui.js must be loaded before d-ui-shell.js.');
if(!modules.playtestReportUI?.__installed)throw new Error('playtest-report-ui.js must be loaded before d-ui-shell.js.');
if(modules.dUIShell)throw new Error('D UI shell is already registered.');

const PRIMARY_NAV=[
  ['map','◉','マップ'],['office','▥','本社'],['business','▣','店舗'],['bank','◈','資金調達'],
  ['strategy','△','研究開発'],['founder','●','採用'],['home','✚','危機対応'],['report','▥','実績'],['missions','✓','目標']
];
const DOCK_NAV=[['report','▤','レポート'],['home','◴','ダッシュボード'],['ma','▦','子会社'],['office','♟','取締役会'],['rivals','♛','ランキング'],['settings','?','ヘルプ']];
const ALL_NAV=[
  ['home','⌂','ホーム'],['map','◉','出店マップ'],['business','▣','事業・店舗'],['office','▥','本社・組織'],['market','↗','株式市場'],
  ['venture','◆','VC投資'],['ma','◇','M&A'],['overseas','◎','海外'],['assets','◫','資産・不動産'],['bank','◈','銀行・資金調達'],
  ['report','▤','決算・レポート'],['founder','●','創業者・採用'],['strategy','△','戦略・研究開発'],['media','▰','メディア'],
  ['legacy','♜','承継'],['missions','✓','進行・目標'],['rivals','⚔','競合'],['news','●','ニュース'],['settings','⚙','設定']
];
const MARKER_POSITIONS=[[18,23],[43,17],[66,27],[25,47],[54,48],[78,52],[37,70],[64,73],[15,67],[83,31]];
let selectedEntity;
let scheduled=false;
let observer=null;

const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function money(value){return modules.engine.compactYen?modules.engine.compactYen(finite(value)):`¥${Math.round(finite(value)).toLocaleString('ja-JP')}`;}
function engine(){return modules.playerEngineBridge.getEngine?.()||null;}
function game(){return engine()?.g||null;}
function tabButton(tab){return `<button type="button" data-action="tab" data-tab="${esc(tab[0])}" class="d-nav-button"><span>${tab[1]}</span><b>${esc(tab[2])}</b><i aria-hidden="true"></i></button>`;}
function activeTab(){return game()?.selectedTab||document.querySelector('.tabs button.active')?.dataset?.tab||'home';}
function hash(text){let value=2166136261;for(const char of String(text)){value^=char.codePointAt(0);value=Math.imul(value,16777619);}return value>>>0;}
function markerPosition(id,index){const base=MARKER_POSITIONS[index%MARKER_POSITIONS.length];const shift=hash(id)%7;return [clamp(base[0]+(shift-3),8,90),clamp(base[1]+((shift*3)%7-3),10,82)];}
function reportSeries(g){
  const pools=[g?.reportHistory,g?.weeklyReports,g?.reports,g?.finance?.history,g?.financeHistory].filter(Array.isArray);
  for(const pool of pools){
    const values=pool.slice(-8).map(item=>finite(item?.profit??item?.operatingProfit??item?.netProfit??item?.weeklyProfit)).filter(Number.isFinite);
    if(values.length>=3)return values;
  }
  const current=finite(g?.lastReport?.profit);
  const basis=current||1;
  return [.62,.78,.69,.91,.74,.83,.96,1].map(multiplier=>basis*multiplier);
}
function sparkline(values){
  const series=values.length?values:[0];const min=Math.min(...series),max=Math.max(...series),span=max-min||1;
  const points=series.map((value,index)=>`${(index/(Math.max(1,series.length-1))*100).toFixed(1)},${(76-((value-min)/span)*58).toFixed(1)}`).join(' ');
  return `<svg class="d-profit-chart" viewBox="0 0 100 82" role="img" aria-label="週間利益推移"><path d="M0 76H100"/><polyline points="${points}"/>${series.map((value,index)=>`<circle cx="${(index/(Math.max(1,series.length-1))*100).toFixed(1)}" cy="${(76-((value-min)/span)*58).toFixed(1)}" r="1.8"/>`).join('')}</svg>`;
}
function currentKpis(g,e){
  const companyValue=finite(e?.companyValue?.());const personal=finite(e?.personalNetWorth?.());const profit=finite(g?.lastReport?.profit);
  return [
    ['総資産','▦',money(companyValue+personal),companyValue+personal>0?'▲ 企業・個人合計':'—'],
    ['現金','▰',money(g?.companyCash),g?.companyCash>=0?'▲ 手元流動性':'▼ 資金危機'],
    ['週間利益','↗',money(profit),profit>=0?'▲ 黒字':'▼ 赤字'],
    ['企業価値','◔',money(companyValue),g?.publicCompany?'上場企業':'未上場'],
    ['株価','▥',g?.publicCompany?`¥ ${finite(g?.stockPrice).toLocaleString('ja-JP',{maximumFractionDigits:0})}`:'—',g?.publicCompany?String(g?.ticker||'公開市場'):'IPO前']
  ];
}
function enhanceTopbar(g,e){
  const topbar=document.querySelector('.topbar');if(!topbar)return;
  topbar.classList.add('d-topbar');
  const brand=topbar.querySelector('.brand');
  if(brand)brand.innerHTML=`<div class="d-brand-crest">¥</div><div><h1>資本主義ポケット TYCOON <em>D</em></h1><p>${esc(g.companyName)} · ${esc(g.playerName)}</p></div>`;
  const stats=topbar.querySelector('.top-stats');
  if(stats){stats.className='top-stats d-kpi-strip';stats.innerHTML=currentKpis(g,e).map(item=>`<div class="d-kpi"><span class="d-kpi-icon">${item[1]}</span><div><small>${esc(item[0])}</small><strong>${esc(item[2])}</strong><em class="${item[3].startsWith('▼')?'down':'up'}">${esc(item[3])}</em></div></div>`).join('');}
  const controls=topbar.querySelector('.week-controls');
  if(controls)controls.innerHTML=`<div class="d-date"><span>▣ 第${finite(g.week)}週</span><small>${finite(g.month)}か月目</small></div><div class="d-speed" aria-label="進行速度"><button type="button" disabled>◀</button><button type="button" disabled>Ⅱ</button><button type="button" data-action="advance-4" aria-label="4週進める">▶▶</button></div><button type="button" class="btn primary d-advance" data-action="advance-week">一週進める <b>»</b></button>`;
}
function ensureNavigation(g){
  const app=document.getElementById('app');const screen=document.getElementById('screen');const source=document.querySelector('.tabs');if(!app||!screen||!source)return;
  source.classList.add('d-source-tabs');source.setAttribute('aria-hidden','true');
  let sidebar=document.getElementById('d-ui-sidebar');
  if(!sidebar){sidebar=document.createElement('aside');sidebar.id='d-ui-sidebar';sidebar.className='d-sidebar';screen.before(sidebar);}
  sidebar.innerHTML=`<button class="d-menu-toggle" type="button" data-d-ui-action="toggle-menu" aria-label="全メニューを開く">☰</button><nav>${PRIMARY_NAV.map(tabButton).join('')}</nav><div class="d-company-rank"><small>企業ランク</small><strong>${g.publicCompany?'A':'B'}</strong><span>評価スコア ${Math.max(0,Math.round(finite(engine()?.companyValue?.())/100000)).toLocaleString('ja-JP')}</span></div>`;
  let dock=document.getElementById('d-ui-dock');
  if(!dock){dock=document.createElement('footer');dock.id='d-ui-dock';dock.className='d-bottom-dock';app.appendChild(dock);}
  dock.innerHTML=DOCK_NAV.map(tabButton).join('');
  let menu=document.getElementById('d-ui-command-menu');
  if(!menu){menu=document.createElement('div');menu.id='d-ui-command-menu';menu.className='d-command-menu';app.appendChild(menu);}
  menu.innerHTML=`<div class="d-command-panel"><div class="d-command-head"><div><strong>経営メニュー</strong><small>すべての機能へ移動</small></div><button type="button" data-d-ui-action="toggle-menu" aria-label="閉じる">×</button></div><div class="d-command-grid">${ALL_NAV.map(tabButton).join('')}</div></div>`;
  const active=activeTab();
  for(const button of [...sidebar.querySelectorAll('[data-tab]'),...dock.querySelectorAll('[data-tab]'),...menu.querySelectorAll('[data-tab]')])button.classList.toggle('active',button.dataset.tab===active);
}
function mapEntities(g,screen){
  const prefID=screen.querySelector('[data-bind="selectedPref"]')?.value||g.selectedPref||g.founderHomePrefID;
  const stores=(g.stores||[]).filter(store=>!prefID||store.prefID===prefID).slice(0,6).map(store=>({kind:'store',id:`store:${store.id}`,rawID:store.id,name:store.name||engine()?.business?.(store.businessID)?.name||'直営店舗',store}));
  const tenantButtons=[...screen.querySelectorAll('button[data-action="open-store"]')].slice(0,6);
  const tenants=tenantButtons.map(button=>{const item=button.closest('.item');return {kind:'tenant',id:`tenant:${button.dataset.id}`,rawID:button.dataset.id,name:item?.querySelector('h3')?.textContent?.trim()||'出店候補',item,button};});
  const offices=[...screen.querySelectorAll('button[data-action="contract-office"],button[data-action="contract-branch-office"]')].slice(0,2).map(button=>({kind:'office',id:`office:${button.dataset.id}`,rawID:button.dataset.id,name:button.closest('.item')?.querySelector('h3')?.textContent?.trim()||'オフィス候補',item:button.closest('.item')}));
  return [...stores,...tenants,...offices];
}
function markerIcon(entity){return entity.kind==='store'?'▣':entity.kind==='office'?'△':'▤';}
function selectedDetail(entity,g){
  if(!entity)return `<div class="d-context-empty"><span>◉</span><h3>拠点を選択</h3><p>地図上のマーカーを選ぶと詳細が表示されます。</p></div>`;
  if(entity.kind==='store'){
    const store=entity.store||{};const business=engine()?.business?.(store.businessID);const sales=finite(store.lastSales);const profit=finite(store.lastProfit);const customers=finite(store.lastCustomers??store.customers);const satisfaction=finite(store.satisfaction??g.customerSatisfaction);
    return `<div class="d-context-hero"><div class="d-store-visual"><span>TYCOON ${esc((business?.name||'STORE').toUpperCase())}</span></div><div class="d-rating"><b>営業中</b><span>★★★★★</span></div></div><div class="d-context-tabs"><b>概要</b><span>財務</span><span>スタッフ</span><span>商品</span></div><div class="d-context-metrics"><div><span>今週の売上</span><strong>${money(sales)}</strong></div><div><span>今週の利益</span><strong>${money(profit)}</strong></div><div><span>来客数</span><strong>${customers?customers.toLocaleString('ja-JP')+'人':'—'}</strong></div><div><span>満足度</span><strong>${satisfaction?satisfaction.toFixed(1):'—'} ★</strong></div></div><div class="d-status-bars">${[['集客力',store.brand??business?.brand??62],['サービス品質',store.quality??business?.quality??70],['商品魅力度',business?.quality??68],['運営効率',store.efficiency??business?.efficiency??72]].map(([label,value])=>`<label><span>${label}<b>${clamp(finite(value),0,100).toFixed(0)}%</b></span><i><em style="width:${clamp(finite(value),0,100)}%"></em></i></label>`).join('')}</div><button type="button" class="btn primary wide" data-action="tab" data-tab="business">店舗詳細を見る</button>`;
  }
  const text=entity.item?.textContent?.replace(/\s+/g,' ').trim()||entity.name;
  if(entity.kind==='tenant')return `<div class="d-context-hero"><div class="d-store-visual tenant"><span>NEW LOCATION</span></div><div class="d-rating"><b>出店候補</b><span>★★★★☆</span></div></div><div class="d-context-tabs"><b>概要</b><span>商圏</span><span>費用</span></div><p class="d-context-copy">${esc(text)}</p><div class="d-context-metrics"><div><span>地域</span><strong>${esc(engine()?.pref?.(g.selectedPref)?.name||'選択地域')}</strong></div><div><span>状態</span><strong>契約可能</strong></div></div><button type="button" class="btn primary wide" data-action="open-store" data-id="${esc(entity.rawID)}">この場所に出店する</button>`;
  return `<div class="d-context-hero"><div class="d-store-visual office"><span>HEAD OFFICE</span></div><div class="d-rating"><b>本社候補</b><span>★★★★☆</span></div></div><p class="d-context-copy">${esc(text)}</p><button type="button" class="btn secondary wide" data-action="tab" data-tab="office">本社・組織画面へ</button>`;
}
function missionRows(g){
  const profit=finite(g.lastReport?.profit);const openStores=(g.stores||[]).filter(store=>store.status==='open').length;
  return [
    ['↗','週間利益を黒字化する',profit,Math.max(1000000,Math.abs(profit)||1000000),profit>=0,'money'],
    ['▣','直営店舗を3店まで拡大する',openStores,3,openStores>=3,'count'],
    ['△','本社機能を整備する',g.hasHeadOffice?1:0,1,Boolean(g.hasHeadOffice),'count']
  ];
}
function missionValue(value,kind){return kind==='money'?money(value):`${Math.max(0,Math.round(finite(value))).toLocaleString('ja-JP')}件`;}
function renderMapWorkspace(screen,g){
  const entities=mapEntities(g,screen);if(selectedEntity===undefined||(selectedEntity!==null&&!entities.some(entity=>entity.id===selectedEntity)))selectedEntity=entities[0]?.id||null;
  const chosen=selectedEntity===null?null:entities.find(entity=>entity.id===selectedEntity)||null;
  let directory=screen.querySelector(':scope > .d-map-directory');
  if(!directory){
    const originals=[...screen.children];directory=document.createElement('details');directory.className='d-map-directory';directory.open=globalThis.innerWidth<960;directory.innerHTML='<summary>出店候補・不動産・オフィス一覧を開く</summary><div class="d-map-directory-body"></div>';
    const body=directory.querySelector('.d-map-directory-body');for(const node of originals)body.appendChild(node);screen.appendChild(directory);
  }
  let workspace=screen.querySelector(':scope > .d-map-workspace');
  if(!workspace){workspace=document.createElement('section');workspace.className='d-map-workspace';screen.insertBefore(workspace,directory);}
  const positions=entities.map((entity,index)=>{const pos=markerPosition(entity.id,index);return `<button type="button" class="d-map-marker ${entity.kind} ${entity.id===chosen?.id?'selected':''}" style="--x:${pos[0]}%;--y:${pos[1]}%" data-d-ui-marker="${esc(entity.id)}"><span>${markerIcon(entity)}</span><small>${esc(entity.name)}</small></button>`;}).join('');
  const blocks=Array.from({length:34},(_,index)=>{const x=7+(index*17)%84,y=12+(index*23)%68,h=18+(index*13)%58;return `<i style="--x:${x}%;--y:${y}%;--h:${h}px"></i>`;}).join('');
  const missions=missionRows(g);const news=(g.news||[]).slice(0,3);
  workspace.innerHTML=`<div class="d-map-stage"><div class="d-map-toolbar"><button type="button">都市ビュー⌄</button><span>${esc(engine()?.pref?.(screen.querySelector('[data-bind="selectedPref"]')?.value)?.name||'全国')}</span></div><div class="d-city-surface"><div class="d-water"></div><div class="d-road-grid"></div><div class="d-city-blocks">${blocks}</div>${positions||'<div class="d-no-markers">出店候補を読み込み中です</div>'}</div><div class="d-map-tools"><button type="button">◎</button><button type="button">☷<small>フィルター</small></button><button type="button">⌕<small>凡例</small></button><button type="button">−</button><button type="button">＋</button></div></div><div class="d-map-overlay"><article class="d-white-card d-chart-card"><header><div><h2>週間利益推移</h2><small>単位：円</small></div><b>${money(g.lastReport?.profit)}</b></header>${sparkline(reportSeries(g))}<footer><span>4週前</span><span>3週前</span><span>2週前</span><span>先週</span><span>今週</span></footer></article><article class="d-white-card d-mission-card"><header><h2>ミッション</h2><b>${missions.filter(item=>item[4]).length}/${missions.length}</b></header>${missions.map(item=>`<div class="d-mission-row ${item[4]?'done':''}"><span>${item[0]}</span><div><strong>${esc(item[1])}</strong><small>${missionValue(item[2],item[5])} / ${missionValue(item[3],item[5])}</small><i><em style="width:${clamp(item[2]/Math.max(1,item[3])*100,0,100)}%"></em></i></div></div>`).join('')}<button type="button" data-action="tab" data-tab="missions">すべてのミッションを見る ›</button></article><article class="d-white-card d-news-card"><header><h2>企業ニュース</h2><button type="button" data-action="tab" data-tab="news">すべて見る ↗</button></header>${news.length?news.map((item,index)=>`<div><span></span><p>${esc(item)}</p><small>${index+1}件前</small></div>`).join(''):'<p>新しいニュースはありません。</p>'}</article></div><aside class="d-context-panel"><header><div><span>●</span><h2>${esc(chosen?.name||'拠点詳細')}</h2></div><button type="button" data-d-ui-action="clear-selection" aria-label="拠点詳細を閉じる">×</button></header>${selectedDetail(chosen,g)}</aside>`;
}
function enhanceMap(g){
  const screen=document.getElementById('screen');if(!screen)return;
  screen.classList.toggle('d-map-screen',activeTab()==='map');
  if(activeTab()!=='map')return;
  renderMapWorkspace(screen,g);
}
function renderKey(g){return [g.week,g.selectedTab,g.stores?.length,g.companyCash,g.lastReport?.profit,selectedEntity].join(':');}
function enhance(force=false){
  const app=document.getElementById('app');const g=game();const e=engine();if(!app||!g)return false;
  if(document.getElementById('setup-form')){document.body.classList.remove('d-ui-active');return false;}
  const key=renderKey(g);if(!force&&app.dataset.dUiKey===key&&document.getElementById('d-ui-sidebar'))return false;
  app.dataset.dUiKey=key;document.body.classList.add('d-ui-active');enhanceTopbar(g,e);ensureNavigation(g);enhanceMap(g);return true;
}
function schedule(){if(scheduled)return;scheduled=true;const run=()=>{scheduled=false;enhance();};if(typeof queueMicrotask==='function')queueMicrotask(run);else setTimeout(run,0);}
function handleClick(event){
  const action=event.target?.closest?.('[data-d-ui-action]')?.dataset?.dUiAction;
  if(action==='toggle-menu'){event.preventDefault();document.getElementById('d-ui-command-menu')?.classList.toggle('open');return true;}
  if(action==='clear-selection'){event.preventDefault();selectedEntity=null;enhance(true);return true;}
  const marker=event.target?.closest?.('[data-d-ui-marker]');
  if(marker){event.preventDefault();selectedEntity=marker.dataset.dUiMarker;enhance(true);return true;}
  const tab=event.target?.closest?.('[data-action="tab"]');if(tab)document.getElementById('d-ui-command-menu')?.classList.remove('open');
  return false;
}
function install(){
  document.addEventListener('click',handleClick,true);const app=document.getElementById('app');if(app&&typeof MutationObserver==='function'){observer=new MutationObserver(schedule);observer.observe(app,{childList:true,subtree:true});}
  schedule();return true;
}
modules.dUIShell=Object.freeze({PRIMARY_NAV,DOCK_NAV,ALL_NAV,money,reportSeries,sparkline,currentKpis,mapEntities,missionRows,missionValue,selectedDetail,renderMapWorkspace,enhance,handleClick,install,__installed:true});
install();
})();
