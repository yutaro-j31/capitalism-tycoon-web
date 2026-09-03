// Phase 7A-1: D-style premium game shell and strategic map workspace.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before d-ui-shell.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before d-ui-shell.js.');
if(!modules.playerEngineBridge?.__installed)throw new Error('player-engine-bridge.js must be loaded before d-ui-shell.js.');
if(!modules.releaseDiagnosticsUI?.__installed)throw new Error('release-diagnostics-ui.js must be loaded before d-ui-shell.js.');
if(!modules.playtestReportUI?.__installed)throw new Error('playtest-report-ui.js must be loaded before d-ui-shell.js.');
if(!modules.uiEnhancerRegistry?.registerUIEnhancer)throw new Error('app.js UI enhancer registry must be loaded before d-ui-shell.js.');
if(modules.dUIShell)throw new Error('D UI shell is already registered.');

const PRIMARY_NAV=[
  ['map','◉','マップ'],['office','▥','本社'],['business','▣','店舗'],['market','↗','株式市場'],['bank','◈','資金調達'],
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
let mapDirectoryOpen=null;
/*
 * PR B: non-persistent UI-only filter for Phase 2 markers (see docs/map-
 * phase2-production-integration-audit.md section 6, PR B). Same lifetime
 * pattern as mapDirectoryOpen above -- a module-level variable, not part
 * of #screen's DOM (renderMapWorkspace rebuilds workspace.innerHTML on
 * every call) and never written to g/save state. Only consulted when the
 * modules.mapPhase2Canvas flag is on; legacy (flag-off) markers are never
 * filtered by it.
 */
let mapFilterKind='all';
const MAP_FILTER_KINDS=[['all','すべて'],['store','自社店舗'],['tenant','空きテナント'],['office','オフィス'],['realestate','不動産']];

const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function money(value){return modules.engine.compactYen?modules.engine.compactYen(finite(value)):`¥${Math.round(finite(value)).toLocaleString('ja-JP')}`;}
function engine(){return modules.playerEngineBridge.getEngine?.()||null;}
function game(){return engine()?.g||null;}
function tabButton(tab){return `<button type="button" data-action="tab" data-tab="${esc(tab[0])}" class="d-nav-button"><span>${tab[1]}</span><b>${esc(tab[2])}</b><i aria-hidden="true"></i></button>`;}
function activeTab(){return game()?.selectedTab||document.querySelector('.tabs button.active')?.dataset?.tab||'home';}
function hash(text){let value=2166136261;for(const char of String(text)){value^=char.codePointAt(0);value=Math.imul(value,16777619);}return value>>>0;}
function markerPositionsCollide(a,b){return Math.abs(a[0]-b[0])<8&&Math.abs(a[1]-b[1])<9;}
// Grid spacing (9 on x, 10 on y) is deliberately wider than markerPositionsCollide's own
// threshold so no two grid cells can collide with each other -- only with markers already
// placed on the map. 9x7=63 cells comfortably covers mapEntities()'s worst case of 20
// simultaneous markers (6 stores + 6 tenants + 2 offices + 6 real-estate listings).
const MARKER_GRID_X=[12,21,30,39,48,57,66,75,84];
const MARKER_GRID_Y=[14,24,34,44,54,64,74];
/*
 * MARKER_POSITIONS only has 10 base slots, but mapEntities() can return up to 20
 * entities (6 stores + 6 tenants + 2 offices + 6 real-estate listings). Once `index`
 * wraps past MARKER_POSITIONS.length, two entities land on the very same base slot
 * (only nudged apart by a +/-3 hash shift), guaranteeing their markers visually overlap
 * -- one of them then always wins pointer-events and the other becomes unclickable.
 * `occupied` (every marker position already placed for this render) lets later entities
 * nudge to the nearest still-clear grid cell instead of silently landing on top of an
 * earlier one.
 */
function markerPosition(id,index,occupied){
  const base=MARKER_POSITIONS[index%MARKER_POSITIONS.length];
  const shift=hash(id)%7;
  const preferred=[clamp(base[0]+(shift-3),8,90),clamp(base[1]+((shift*3)%7-3),10,82)];
  if(!occupied||!occupied.some(spot=>markerPositionsCollide(preferred,spot)))return preferred;
  const candidates=[];
  for(const x of MARKER_GRID_X)for(const y of MARKER_GRID_Y)candidates.push([x,y]);
  candidates.sort((a,b)=>((a[0]-preferred[0])**2+(a[1]-preferred[1])**2)-((b[0]-preferred[0])**2+(b[1]-preferred[1])**2));
  for(const candidate of candidates){
    if(!occupied.some(spot=>markerPositionsCollide(candidate,spot)))return candidate;
  }
  return preferred;
}
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
  if(controls)controls.innerHTML=`<div class="d-date"><span>▣ ${esc(modules.engine.gameDate(g.week).label)} · 第${finite(g.week)}週</span><small>${modules.engine.gameDate(g.week).year}年目</small></div><div class="d-speed" aria-label="進行速度"><button type="button" disabled>◀</button><button type="button" disabled>Ⅱ</button><button type="button" data-action="advance-4" aria-label="4週進める">▶▶</button></div><button type="button" class="btn primary d-advance" data-action="advance-week">一週進める <b>»</b></button>`;
}
function setCommandMenu(open,restoreFocus=false){
  const menu=document.getElementById('d-ui-command-menu');if(!menu)return false;
  menu.classList.toggle('open',open);
  const toggle=document.querySelector('.d-menu-toggle');if(toggle)toggle.setAttribute('aria-expanded',String(open));
  if(open)menu.querySelector('[data-d-ui-action="toggle-menu"]')?.focus();
  else if(restoreFocus)toggle?.focus();
  return true;
}
function ensureNavigation(g){
  const app=document.getElementById('app');const screen=document.getElementById('screen');const source=document.querySelector('.tabs');if(!app||!screen||!source)return;
  source.classList.add('d-source-tabs');source.setAttribute('aria-hidden','true');
  let sidebar=document.getElementById('d-ui-sidebar');
  if(!sidebar){sidebar=document.createElement('aside');sidebar.id='d-ui-sidebar';sidebar.className='d-sidebar';screen.before(sidebar);}
  const menuOpen=document.getElementById('d-ui-command-menu')?.classList.contains('open')||false;
  sidebar.innerHTML=`<button class="d-menu-toggle" type="button" data-d-ui-action="toggle-menu" aria-label="全メニューを開く" aria-controls="d-ui-command-menu" aria-expanded="${menuOpen}">☰</button><nav>${PRIMARY_NAV.map(tabButton).join('')}</nav><div class="d-company-rank"><small>企業ランク</small><strong>${g.publicCompany?'A':'B'}</strong><span>評価スコア ${Math.max(0,Math.round(finite(engine()?.companyValue?.())/100000)).toLocaleString('ja-JP')}</span></div>`;
  let dock=document.getElementById('d-ui-dock');
  if(!dock){dock=document.createElement('footer');dock.id='d-ui-dock';dock.className='d-bottom-dock';app.appendChild(dock);}
  dock.innerHTML=DOCK_NAV.map(tabButton).join('');
  let menu=document.getElementById('d-ui-command-menu');
  if(!menu){menu=document.createElement('div');menu.id='d-ui-command-menu';menu.className='d-command-menu';app.appendChild(menu);}
  menu.innerHTML=`<div class="d-command-panel" role="dialog" aria-modal="true" aria-label="経営メニュー"><div class="d-command-head"><div><strong>経営メニュー</strong><small>すべての機能へ移動</small></div><button type="button" data-d-ui-action="toggle-menu" aria-label="閉じる">×</button></div><div class="d-command-grid">${ALL_NAV.map(tabButton).join('')}</div></div>`;
  const active=activeTab();
  for(const button of [...sidebar.querySelectorAll('[data-tab]'),...dock.querySelectorAll('[data-tab]'),...menu.querySelectorAll('[data-tab]')]){
    const isActive=button.dataset.tab===active;
    button.classList.toggle('active',isActive);
    if(isActive)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  }
}
function mapEntities(g,screen){
  const prefID=screen.querySelector('[data-bind="selectedPref"]')?.value||g.selectedPref||g.founderHomePrefID;
  const stores=(g.stores||[]).filter(store=>!prefID||store.prefID===prefID).slice(0,6).map(store=>({kind:'store',id:`store:${store.id}`,rawID:store.id,name:store.name||engine()?.business?.(store.businessID)?.name||'直営店舗',store}));
  const tenantButtons=[...screen.querySelectorAll('button[data-action="open-store"]')].slice(0,6);
  const tenants=tenantButtons.map(button=>{const item=button.closest('.item');return {kind:'tenant',id:`tenant:${button.dataset.id}`,rawID:button.dataset.id,name:item?.querySelector('h3')?.textContent?.trim()||'出店候補',item,button};});
  const offices=[...screen.querySelectorAll('button[data-action="contract-office"],button[data-action="contract-branch-office"]')].slice(0,2).map(button=>({kind:'office',id:`office:${button.dataset.id}`,rawID:button.dataset.id,name:button.closest('.item')?.querySelector('h3')?.textContent?.trim()||'オフィス候補',item:button.closest('.item')}));
  const realEstateButtons=[...screen.querySelectorAll('button[data-action="buy-property-company"]')].slice(0,6);
  const realEstate=realEstateButtons.map(button=>{const property=(g.properties||[]).find(p=>String(p.id)===String(button.dataset.id));return {kind:'realestate',id:`realestate:${button.dataset.id}`,rawID:button.dataset.id,name:property?.name||button.closest('.item')?.querySelector('h3')?.textContent?.trim()||'不動産候補',property};});
  return [...stores,...tenants,...offices,...realEstate];
}
function markerIcon(entity){return entity.kind==='store'?'▣':entity.kind==='office'?'△':entity.kind==='realestate'?'◆':'▤';}
// A store opened this week is 'preparing' until its openingWeek arrives (js/engine.js sets
// status/openingWeek at openStore and flips to 'open' in the weekly loop). This panel used to
// print 営業中 unconditionally, so a store still under construction looked like a trading store
// earning nothing -- indistinguishable from a failing one.
function storeStatusLabel(store,g){
  if(store?.status==='closed')return '閉店';
  if(store?.status==='preparing'){
    const weeks=Math.max(0,Math.ceil(finite(store.openingWeek)-finite(g?.week)));
    return weeks>0?`開業準備中・あと${weeks}週`:'まもなく開業';
  }
  return '営業中';
}
function selectedDetail(entity,g){
  if(!entity)return `<div class="d-context-empty"><span>◉</span><h3>拠点を選択</h3><p>地図上のマーカーを選ぶと詳細が表示されます。</p></div>`;
  if(entity.kind==='store'){
    const store=entity.store||{};const business=engine()?.business?.(store.businessID);const sales=finite(store.lastSales);const profit=finite(store.lastProfit);
    // unitsSold/customerSatisfaction are what market.js actually computes and engine.js stores on
    // store.marketResult; lastCustomers/store.satisfaction are read here historically but are never
    // written anywhere in the codebase, so this panel always showed "—" for a fully simulated store.
    // js/iphone-playtest-fixes.js already reads the market result first -- this matches it.
    const customers=finite(store.marketResult?.unitsSold??store.lastCustomers??store.customers);const satisfaction=finite(store.marketResult?.customerSatisfaction??store.satisfaction??g.customerSatisfaction);
    const status=storeStatusLabel(store,g);
    return `<div class="d-context-hero"><div class="d-store-visual"><span>TYCOON ${esc((business?.name||'STORE').toUpperCase())}</span></div><div class="d-rating"><b>${esc(status)}</b><span>★★★★★</span></div></div><div class="d-context-tabs"><b>概要</b><span>財務</span><span>スタッフ</span><span>商品</span></div><div class="d-context-metrics"><div><span>今週の売上</span><strong>${money(sales)}</strong></div><div><span>今週の利益</span><strong>${money(profit)}</strong></div><div><span>来客数</span><strong>${customers?customers.toLocaleString('ja-JP')+'人':'—'}</strong></div><div><span>満足度</span><strong>${satisfaction?satisfaction.toFixed(1):'—'} ★</strong></div></div><div class="d-status-bars">${[['集客力',store.brand??business?.brand??62],['サービス品質',store.quality??business?.quality??70],['商品魅力度',business?.quality??68],['運営効率',store.efficiency??business?.efficiency??72]].map(([label,value])=>`<label><span>${label}<b>${clamp(finite(value),0,100).toFixed(0)}%</b></span><i><em style="width:${clamp(finite(value),0,100)}%"></em></i></label>`).join('')}</div><button type="button" class="btn primary wide" data-action="tab" data-tab="business">店舗詳細を見る</button>`;
  }
  const text=entity.item?.textContent?.replace(/\s+/g,' ').trim()||entity.name;
  if(entity.kind==='tenant')return `<div class="d-context-hero"><div class="d-store-visual tenant"><span>NEW LOCATION</span></div><div class="d-rating"><b>出店候補</b><span>★★★★☆</span></div></div><div class="d-context-tabs"><b>概要</b><span>商圏</span><span>費用</span></div><p class="d-context-copy">${esc(text)}</p><div class="d-context-metrics"><div><span>地域</span><strong>${esc(engine()?.pref?.(g.selectedPref)?.name||'選択地域')}</strong></div><div><span>状態</span><strong>契約可能</strong></div></div><button type="button" class="btn primary wide" data-action="open-store" data-id="${esc(entity.rawID)}">この場所に出店する</button>`;
  if(entity.kind==='realestate'){
    const property=entity.property||{};
    return `<div class="d-context-hero"><div class="d-store-visual realestate"><span>FOR SALE</span></div><div class="d-rating"><b>売買可能</b><span>利回り${(finite(property.yieldRate)*100).toFixed(1)}%</span></div></div><div class="d-context-metrics"><div><span>価格</span><strong>${money(property.price)}</strong></div><div><span>週次賃料</span><strong>${money(property.rentIncome)}</strong></div><div><span>種別</span><strong>${esc(property.kind||'土地')}</strong></div><div><span>面積</span><strong>${finite(property.landAreaSqm).toLocaleString('ja-JP')}㎡</strong></div></div><div class="button-row"><button type="button" class="btn secondary" data-action="buy-property-company" data-id="${esc(entity.rawID)}">会社で購入</button><button type="button" class="btn ghost" data-action="buy-property-personal" data-id="${esc(entity.rawID)}">個人で購入</button></div>`;
  }
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
function isoCityBuildingsSVG(g){
  const prefID=g?.selectedPref||g?.founderHomePrefID||'national';
  // Mirror the immutable legacy block coordinates in this later SVG layer so each old grey
  // silhouette receives a coloured isometric facade without hiding or changing the old DOM.
  const legacyCoverage=Array.from({length:34},(_,index)=>{
    const legacyX=7+(index*17)%84,legacyY=12+(index*23)%68,legacyHeight=18+(index*13)%58;
    const zone=legacyX<38?{name:'office',hue:210,lift:58,width:46,depth:20}:legacyX<67?{name:'mixed',hue:38,lift:30,width:43,depth:18}:{name:'residential',hue:26,lift:10,width:40,depth:16};
    const seed=hash(`${prefID}:iso-legacy-cover:${zone.name}:${index}`);
    const width=zone.width+(seed%7)-3;const depth=zone.depth+((seed>>>4)%5)-2;
    const height=legacyHeight+zone.lift+((seed>>>8)%9);const hue=zone.hue+((seed>>>15)%9)-4;
    const x=legacyX*10+10;const y=legacyY*6+legacyHeight+8;
    const windows=2+((seed>>>27)%3);const topY=y-height;
    const windowLines=Array.from({length:windows},(_,windowIndex)=>{
      const lineY=topY+height*((windowIndex+1)/(windows+1));
      return `<line class="d-iso-window" x1="${x-width/2+6}" y1="${lineY}" x2="${x-2}" y2="${lineY+depth/2-2}"/><line class="d-iso-window" x1="${x+2}" y1="${lineY+depth/2-2}" x2="${x+width/2-6}" y2="${lineY}"/>`;
    }).join('');
    return `<g class="d-iso-building d-iso-legacy-cover d-iso-${zone.name}" style="--d-iso-hue:${hue}"><polygon class="d-iso-left" points="${x-width/2},${topY} ${x},${topY+depth/2} ${x},${y+depth/2} ${x-width/2},${y}"/><polygon class="d-iso-right" points="${x},${topY+depth/2} ${x+width/2},${topY} ${x+width/2},${y} ${x},${y+depth/2}"/><polygon class="d-iso-top" points="${x-width/2},${topY} ${x},${topY-depth/2} ${x+width/2},${topY} ${x},${topY+depth/2}"/>${windowLines}</g>`;
  }).join('');
  const cars=Array.from({length:7},(_,index)=>{const seed=hash(`${prefID}:iso-car:${index}`);const x=105+(seed%760),y=390+((seed>>>10)%125);return `<g class="d-iso-car" transform="translate(${x} ${y})"><rect width="18" height="7" rx="2"/><rect x="5" y="-4" width="9" height="5" rx="1"/></g>`;}).join('');
  return `<svg class="d-iso-city" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><g class="d-iso-parks"><path class="d-iso-park" d="M72 292l92-42 76 37-93 44zM730 442l91-42 67 33-91 43z"/>${[[112,281],[151,294],[188,279],[766,430],[805,444],[845,426]].map(([x,y])=>`<g class="d-iso-tree" transform="translate(${x} ${y})"><rect x="-2" y="4" width="4" height="12"/><circle cy="1" r="9"/><circle cx="-6" cy="4" r="6"/><circle cx="6" cy="4" r="6"/></g>`).join('')}</g>${legacyCoverage}<g class="d-iso-bridge"><rect x="22" y="483" width="250" height="10" rx="3"/><path d="M45 483V440M247 483V440M45 446Q146 506 247 446M45 446Q146 420 247 446"/><line x1="45" y1="440" x2="45" y2="505"/><line x1="247" y1="440" x2="247" y2="505"/></g>${cars}</svg>`;
}
function renderMapWorkspace(screen,g){
  const phase2On=Boolean(modules.mapPhase2Canvas?.isEnabled?.());
  const legacyEntities=mapEntities(g,screen);
  /*
   * PR B: production marker/selection/filter wiring (see docs/map-phase2-
   * production-integration-audit.md section 6, PR B). buildMapViewModel()
   * is the sole production adapter -- no DOM scraping, no legacy
   * mapEntities() reuse -- and placeEntityTiles() deterministically
   * assigns each entity a world tile using the district this render's own
   * Phase 2 canvas draw will use, so markers and canvas share one
   * worldToScreen. `null` from placeEntityTiles means the district isn't
   * built yet (assets/prototypes still loading), not "no entities".
   */
  const phase2ViewModel=phase2On?modules.mapPhase2Canvas.buildMapViewModel(g,engine()):null;
  const phase2Placed=phase2ViewModel?modules.mapPhase2Canvas.placeEntityTiles(phase2ViewModel.entities,phase2ViewModel.prefID):null;
  // Single selection source of truth: selectedEntity is validated against
  // whichever entity list is actually driving the visible markers this
  // render (legacy DOM-scrape when the flag is off, the Phase 2 view
  // model when it's on) -- never two parallel selection states.
  const activeEntities=phase2On?(phase2Placed||[]):legacyEntities;
  if(selectedEntity===undefined||(selectedEntity!==null&&!activeEntities.some(entity=>entity.id===selectedEntity)))selectedEntity=activeEntities[0]?.id||null;
  const chosen=selectedEntity===null?null:activeEntities.find(entity=>entity.id===selectedEntity)||null;
  let directory=screen.querySelector(':scope > .d-map-directory');
  if(!directory){
    // app.js's render() replaces #screen's entire innerHTML on every state change (e.g. a
    // select inside this directory firing 'change'), so this <details> element itself is
    // rebuilt from scratch each time -- its own DOM `open` attribute never survives that.
    // mapDirectoryOpen is a module-level variable (not part of #screen's DOM) that persists
    // across those rebuilds, so the accordion stays open after the user opens it.
    const originals=[...screen.children];directory=document.createElement('details');directory.className='d-map-directory';directory.open=mapDirectoryOpen===null?globalThis.innerWidth<960:mapDirectoryOpen;directory.innerHTML='<summary>出店候補・不動産・オフィス一覧を開く</summary><div class="d-map-directory-body"></div>';
    directory.addEventListener('toggle',()=>{mapDirectoryOpen=directory.open;});
    const body=directory.querySelector('.d-map-directory-body');for(const node of originals)body.appendChild(node);screen.appendChild(directory);
  }
  let workspace=screen.querySelector(':scope > .d-map-workspace');
  if(!workspace){workspace=document.createElement('section');workspace.className='d-map-workspace';screen.insertBefore(workspace,directory);}
  const occupiedMarkerPositions=[];
  const positions=legacyEntities.map((entity,index)=>{const pos=markerPosition(entity.id,index,occupiedMarkerPositions);occupiedMarkerPositions.push(pos);return `<button type="button" class="d-map-marker ${entity.kind} ${entity.id===chosen?.id?'selected':''}" style="--x:${pos[0]}%;--y:${pos[1]}%" data-d-ui-marker="${esc(entity.id)}"><span>${markerIcon(entity)}</span><small>${esc(entity.name)}</small></button>`;}).join('');
  const blocks=Array.from({length:34},(_,index)=>{const x=7+(index*17)%84,y=12+(index*23)%68,h=18+(index*13)%58;return `<i style="--x:${x}%;--y:${y}%;--h:${h}px"></i>`;}).join('');
  const missions=missionRows(g);const news=(g.news||[]).slice(0,3);
  /*
   * PR A (production integration foundation, see docs/map-phase2-
   * production-integration-audit.md): when the internal, non-persistent
   * modules.mapPhase2Canvas flag is on, add a phase2 marker class to
   * .d-city-surface (css/d-ui-map-phase2-canvas.css hides the legacy
   * .d-water/.d-road-grid/.d-city-blocks/.d-iso-city imagery underneath,
   * without deleting it) and a <canvas> for Phase 2's own deterministic
   * scenery. Flag off (the default) emits neither -- byte-identical to
   * this function before this change. Legacy positions/mapEntities()
   * markup below is generated exactly as before either way; PR B only
   * hides it via CSS (.d-map-marker:not([data-phase2-tile-x])) when the
   * flag is on, alongside the new Phase 2 markers added below.
   */
  const citySurfaceClass=phase2On?'d-city-surface d-city-surface-phase2':'d-city-surface';
  const phase2Canvas=phase2On?'<canvas class="d-phase2-canvas" aria-hidden="true"></canvas>':'';
  /*
   * PR B markers: built from phase2Placed (the Phase 2 view model, already
   * tile-placed above), not legacyEntities -- see the buildMapViewModel()/
   * placeEntityTiles() comment above. Reuses the exact same .d-map-marker
   * button markup/classes/data-d-ui-marker attribute as the legacy path
   * so handleClick()'s existing marker-click handling needs no changes;
   * only the position source differs (data-phase2-tile-x/y, resolved to
   * --x/--y pixel values by modules.mapPhase2Canvas.render()'s
   * positionMarkers() using the same camera the canvas itself just used).
   */
  let phase2MarkersHTML='';
  if(phase2On){
    if(!phase2Placed){
      phase2MarkersHTML='<div class="d-no-markers">出店候補を読み込み中です</div>';
    }else{
      const filtered=mapFilterKind==='all'?phase2Placed:phase2Placed.filter(entity=>entity.kind===mapFilterKind);
      const placeable=filtered.filter(entity=>entity.tileX!==null&&entity.tileY!==null);
      phase2MarkersHTML=placeable.length
        ?placeable.map(entity=>`<button type="button" class="d-map-marker ${entity.kind} ${entity.id===chosen?.id?'selected':''}" data-d-ui-marker="${esc(entity.id)}" data-phase2-tile-x="${entity.tileX}" data-phase2-tile-y="${entity.tileY}"><span>${markerIcon(entity)}</span><small>${esc(entity.name)}</small></button>`).join('')
        :'<div class="d-no-markers">該当する拠点がありません</div>';
    }
  }
  const filterChips=phase2On?`<div class="d-map-filter-chips">${MAP_FILTER_KINDS.map(([kind,label])=>`<button type="button" class="d-map-filter-chip ${mapFilterKind===kind?'active':''}" data-d-ui-action="map-filter" data-kind="${kind}">${esc(label)}</button>`).join('')}</div>`:'';
  workspace.innerHTML=`<div class="d-map-stage"><div class="d-map-toolbar"><button type="button">都市ビュー⌄</button><span>${esc(engine()?.pref?.(screen.querySelector('[data-bind="selectedPref"]')?.value)?.name||'全国')}</span></div><div class="${citySurfaceClass}">${phase2Canvas}<div class="d-water"></div><div class="d-road-grid"></div><div class="d-city-blocks">${blocks}</div>${isoCityBuildingsSVG(g)}${positions||'<div class="d-no-markers">出店候補を読み込み中です</div>'}${phase2MarkersHTML}</div><div class="d-map-tools"><button type="button">◎</button><button type="button">☷<small>フィルター</small></button><button type="button">⌕<small>凡例</small></button><button type="button">−</button><button type="button">＋</button></div></div><div class="d-map-overlay"><article class="d-white-card d-chart-card"><header><div><h2>週間利益推移</h2><small>単位：円</small></div><b>${money(g.lastReport?.profit)}</b></header>${filterChips}${sparkline(reportSeries(g))}<footer><span>4週前</span><span>3週前</span><span>2週前</span><span>先週</span><span>今週</span></footer></article><article class="d-white-card d-mission-card"><header><h2>ミッション</h2><b>${missions.filter(item=>item[4]).length}/${missions.length}</b></header>${missions.map(item=>`<div class="d-mission-row ${item[4]?'done':''}"><span>${item[0]}</span><div><strong>${esc(item[1])}</strong><small>${missionValue(item[2],item[5])} / ${missionValue(item[3],item[5])}</small><i><em style="width:${clamp(item[2]/Math.max(1,item[3])*100,0,100)}%"></em></i></div></div>`).join('')}<button type="button" data-action="tab" data-tab="missions">すべてのミッションを見る ›</button></article><article class="d-white-card d-news-card"><header><h2>企業ニュース</h2><button type="button" data-action="tab" data-tab="news">すべて見る ↗</button></header>${news.length?news.map((item,index)=>`<div><span></span><p>${esc(item)}</p><small>${index+1}件前</small></div>`).join(''):'<p>新しいニュースはありません。</p>'}</article></div><aside class="d-context-panel"><header><div><span>●</span><h2>${esc(chosen?.name||'拠点詳細')}</h2></div><button type="button" data-d-ui-action="clear-selection" aria-label="拠点詳細を閉じる">×</button></header>${selectedDetail(chosen,g)}</aside>`;
  if(phase2On)modules.mapPhase2Canvas.render(workspace.querySelector('.d-phase2-canvas'),g);
}
function enhanceMap(g){
  const screen=document.getElementById('screen');if(!screen)return;
  screen.classList.toggle('d-map-screen',activeTab()==='map');
  if(activeTab()!=='map')return;
  renderMapWorkspace(screen,g);
}
function renderKey(g){return [g.week,g.selectedTab,g.stores?.length,g.companyCash,g.lastReport?.profit,selectedEntity,mapFilterKind].join(':');}
function enhance(force=false,context=null){
  const app=context?.app||document.getElementById('app');const g=context?.state||game();const e=context?.engine||engine();if(!app||!g)return false;
  if(document.getElementById('setup-form')){document.body.classList.remove('d-ui-active');return false;}
  const key=renderKey(g);if(!force&&app.dataset.dUiKey===key&&document.getElementById('d-ui-sidebar'))return false;
  app.dataset.dUiKey=key;document.body.classList.add('d-ui-active');enhanceTopbar(g,e);ensureNavigation(g);enhanceMap(g);return true;
}
function handleClick(event){
  const menu=document.getElementById('d-ui-command-menu');
  if(menu?.classList.contains('open')&&event.target===menu){event.preventDefault();setCommandMenu(false,true);return true;}
  const action=event.target?.closest?.('[data-d-ui-action]')?.dataset?.dUiAction;
  if(action==='toggle-menu'){event.preventDefault();const open=!menu?.classList.contains('open');setCommandMenu(open,!open);return true;}
  if(action==='clear-selection'){event.preventDefault();selectedEntity=null;modules.uiEnhancerRegistry.runUIEnhancers();return true;}
  if(action==='map-filter'){event.preventDefault();mapFilterKind=event.target.closest('[data-d-ui-action]').dataset.kind||'all';modules.uiEnhancerRegistry.runUIEnhancers();return true;}
  const marker=event.target?.closest?.('[data-d-ui-marker]');
  if(marker){event.preventDefault();selectedEntity=marker.dataset.dUiMarker;modules.uiEnhancerRegistry.runUIEnhancers();return true;}
  const tab=event.target?.closest?.('[data-action="tab"]');if(tab)setCommandMenu(false);
  return false;
}
function handleKeydown(event){
  const menu=document.getElementById('d-ui-command-menu');
  if(!menu?.classList.contains('open'))return false;
  if(event.key!=='Escape'){
    if(event.key!=='Tab')return false;
  }else{event.preventDefault();setCommandMenu(false,true);return true;}
  const focusable=[...menu.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element=>!element.hidden&&element.getAttribute('aria-hidden')!=='true');
  if(!focusable.length)return false;
  const first=focusable[0];const last=focusable[focusable.length-1];const active=document.activeElement;
  if(event.shiftKey&&active===first){event.preventDefault();last.focus();return true;}
  if(!event.shiftKey&&active===last){event.preventDefault();first.focus();return true;}
  if(!menu.contains(active)){event.preventDefault();first.focus();return true;}
  return false;
}
function install(){
  document.addEventListener('click',handleClick,true);
  document.addEventListener('keydown',handleKeydown,true);
  modules.uiEnhancerRegistry.registerUIEnhancer({id:'d-ui-shell',enhance:context=>enhance(false,context)});
  return true;
}
modules.dUIShell=Object.freeze({PRIMARY_NAV,DOCK_NAV,ALL_NAV,money,reportSeries,sparkline,currentKpis,mapEntities,missionRows,missionValue,selectedDetail,renderMapWorkspace,setCommandMenu,enhance,handleClick,handleKeydown,install,__installed:true});
install();
})();
