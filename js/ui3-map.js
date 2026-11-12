// UI v3 map screen and its sheets — docs/ui-v3/README.md 5.2 and 5.3 (UI3-3).
//
// The map itself is the current 3D City Lab (js/city-lab-map.js), unchanged except for an opt-in
// `pins:'u-pin'` presentation mode (v3 pins, no collision hiding, gold selection box, and a focus move
// that puts the selected pin in the part of the map the sheet leaves visible). This module only mounts it,
// puts the v3 filter chips and the zoom / list buttons on top, and turns a tapped pin into a sheet.
//
// Presentation only. Selection, the filter and the sheet's industry choice are view state held here;
// every control that changes the game dispatches an existing `data-action` (open-store, contract-office,
// buy-property-company, ...). `open-store` reads `#business-<tenantID>`, so the tenant sheet carries a
// hidden input with that id. It never writes engine state.
(function(){'use strict';
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.ui3?.registerScreen)throw new Error('js/ui3-shell.js must be loaded before ui3-map.js.');

const KIND={store:'自社店舗',tenant:'出店候補',office:'オフィス',realestate:'不動産',competitor:'競合'};
const FOUNDABLE=['ramen','conveni','gym','realEstateAgency'];   // same list js/app.js offers when opening a store
const SETTLE_MS=450;                                            // see onClick
const FOCUS_Y=.27;                                              // the sheet is 58% high: the pin goes in the part of the map it leaves visible
const state={selected:null,filter:'all',business:null,sheet:null,openedAt:0};   // sheet: null | 'detail' | 'list' | 'breakdown'
let host=null,context=null,unavailable=false,listening=false;

const esc=value=>String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
const modalRoot=()=>globalThis.document?.getElementById('modal-root');

function signed(value,money){
  const amount=finite(value);
  return amount>0?`+${money(amount)}`:amount<0?`−${money(-amount)}`:money(0);
}
const direction=value=>finite(value)>0?' u-up':finite(value)<0?' u-down':'';

function viewModel(){return modules.mapPhase2Canvas.buildMapViewModel(context.g,context.engine);}
function entityById(id){return id?viewModel().entities.find(entity=>entity.id===id)||null:null;}
function visibleEntities(){
  const entities=viewModel().entities;
  return state.filter==='all'?entities:entities.filter(entity=>entity.kind===state.filter);
}

// ---- the map -----------------------------------------------------------------------------------
function workspaceOptions(){
  return {engine:context.engine,selected:state.selected,filter:state.filter,pins:'u-pin',focusY:FOCUS_Y,
    directoryOpen:false,onDirectoryToggle(){},detail:()=>'',select,fallback:useCurrentMap};
}
// js/city-lab-map.js and js/map-phase2-canvas.js load after js/app.js, which can already draw the map tab
// (and queue this screen's mount) when the saved game was left on it. Until both are registered the map waits,
// a bounded number of times, then hands over to the current UI's Canvas2D map (README 6.5): it never stays "loading".
const MAP_MODULE_RETRY_MS=50,MAP_MODULE_MAX_TRIES=100;
const mapModulesReady=()=>Boolean(modules.cityLabMap?.renderWorkspace&&modules.mapPhase2Canvas?.buildMapViewModel);
let waitingForMapModules=false;
function awaitMapModules(){
  if(waitingForMapModules)return;
  waitingForMapModules=true;
  const container=host?.querySelector('[data-ui3-map]');
  if(container&&!container.firstChild)container.innerHTML='<p class="u-h2" data-ui3-map-loading>地図を読み込み中です。</p>';
  let tries=0;
  const tick=()=>{
    if(mapModulesReady()){waitingForMapModules=false;if(host?.isConnected&&!unavailable)startMap();return;}
    if(++tries>=MAP_MODULE_MAX_TRIES){waitingForMapModules=false;if(host?.isConnected)useCurrentMap();return;}
    setTimeout(tick,MAP_MODULE_RETRY_MS);
  };
  setTimeout(tick,MAP_MODULE_RETRY_MS);
}
function refreshMap(){
  const container=host?.querySelector('[data-ui3-map]');
  if(!container||!context||!mapModulesReady())return false;
  container.querySelector('[data-ui3-map-loading]')?.remove();
  return modules.cityLabMap.renderWorkspace(container,context.g,workspaceOptions());
}
// 3D map unavailable (no WebGL, context lost, assets failed): the current UI draws the Canvas2D
// fallback for the map until the page is reloaded (README 6.5; migration-ledger.md).
function useCurrentMap(){
  if(unavailable)return;
  unavailable=true;
  closeSheet();
  globalThis.document?.querySelector?.('[data-ui3-all-screens] [data-action="tab"][data-tab="map"]')?.click();
}

function chipRow(){
  return [['all','すべて'],...Object.entries(KIND)].map(([kind,label])=>`<button type="button" class="u-chip" data-ui3-map-filter="${kind}" aria-pressed="${state.filter===kind}">${esc(label)}</button>`).join('');
}
function decorate(){
  const container=host?.querySelector('[data-ui3-map]');
  const stage=container?.querySelector('.city-lab-stage');
  if(!stage)return;
  let chips=stage.querySelector('[data-ui3-map-chips]');
  if(!chips){
    chips=document.createElement('div');chips.className='u-chips u-map-chips';chips.dataset.ui3MapChips='';
    chips.setAttribute('role','group');chips.setAttribute('aria-label','表示する拠点');
    stage.appendChild(chips);
    // The prefecture switcher is the current map's own select (app.js handles `data-bind="selectedPref"`);
    // it moves into the chip row because tenants exist per prefecture.
    const location=container.querySelector('.city-lab-location');
    if(location){location.classList.add('u-map-pref');chips.appendChild(location);}
    const row=document.createElement('span');row.className='u-map-filters';row.dataset.ui3MapFilters='';chips.appendChild(row);
    const controls=stage.querySelector('.city-lab-controls');
    if(controls&&!controls.querySelector('[data-ui3-map-list]')){
      const list=document.createElement('button');list.type='button';list.dataset.ui3MapList='';list.textContent='一覧';list.setAttribute('aria-label','表示中の拠点の一覧');
      controls.appendChild(list);
      controls.classList.add('u-zoom');
    }
  }
  const row=chips.querySelector('[data-ui3-map-filters]');
  const markup=chipRow();
  if(row.dataset.markup!==markup){row.innerHTML=markup;row.dataset.markup=markup;}
}

// ---- sheets ------------------------------------------------------------------------------------
function show(parts){
  state.openedAt=performance.now();
  const root=modalRoot();
  if(root)root.innerHTML=modules.ui3.sheet(parts);
}
function closeSheet(){
  state.sheet=null;
  const root=modalRoot();
  if(root&&root.querySelector('[data-ui3-map-sheet]'))root.innerHTML='';
}
const marker='<span hidden data-ui3-map-sheet></span>';

function businessList(){
  const g=context.g;
  const list=(g.businesses||[]).filter(business=>FOUNDABLE.includes(business.id));
  return list.length?list:FOUNDABLE.map(id=>({id,name:id}));
}
function chosenBusiness(){
  const ids=businessList().map(business=>business.id);
  if(ids.includes(state.business))return state.business;
  const fromGame=context.g.selectedBusiness;
  return ids.includes(fromGame)?fromGame:ids[0];
}

function tenantSheet(entity){
  const {g,engine,esc:escape,money}=context;
  const tenant=entity.tenant||{};
  const businessID=chosenBusiness();
  const estimate=engine.estimateStoreOpening({tenantID:entity.rawID,businessID,operatingHours:3});
  const biz=businessList();
  const seg=`<div class="u-seg" role="group" aria-label="業種">${biz.map(business=>`<button type="button" data-ui3-map-business="${esc(business.id)}" aria-pressed="${business.id===businessID}">${esc(business.name)}</button>`).join('')}</div>`;
  const hidden=`<input type="hidden" id="business-${esc(entity.rawID)}" value="${esc(businessID)}">`;
  if(!estimate){
    return {eyebrow:KIND.tenant,title:entity.name,subtitle:'試算できませんでした',
      body:`${marker}${hidden}${seg}`,
      actions:'<button type="button" class="u-btn primary" data-ui3-map-close>閉じる</button>'};
  }
  const grade=estimate.siteSuitability?.grade||'—';
  const multiplier=finite(estimate.siteSuitability?.multiplier);
  const profit=finite(estimate.expected?.profit);
  const payback=estimate.paybackWeeks?`${estimate.paybackWeeks}週`:'—';
  const verdict=!estimate.affordable?`資金不足（あと${money(estimate.upfront-estimate.companyCash)}）`:`出店後の会社現金 ${money(estimate.cashAfterOpening)}`;
  const body=`${marker}${hidden}<div><span class="u-badge${multiplier>=1?' good':' warn'}" data-ui3-map="fit">適性 ${esc(grade)}</span></div>`
    +seg
    +`<div class="u-stats" data-ui3-map="numbers">`
    +`<div class="u-stat"><span>初期費用</span><b class="u-money">${esc(money(estimate.upfront))}</b></div>`
    +`<div class="u-stat"><span>週の利益見込み</span><b class="u-money${direction(profit)}">${esc(signed(profit,money))}</b></div>`
    +`<div class="u-stat"><span>回収まで</span><b class="u-money">${esc(payback)}</b></div></div>`
    +`<div class="u-h2" data-ui3-map="after">${esc(verdict)} · 開店まで${esc(estimate.weeksToOpen)}週</div>`;
  return {
    eyebrow:KIND.tenant,title:entity.name,
    subtitle:`商圏 ${tenant.cityName||'—'} · 交通量 ${finite(tenant.traffic).toFixed(2)} · 週額賃料 ${money(tenant.rent)}`,
    body,
    actions:'<button type="button" class="u-btn" data-ui3-map-breakdown>試算の内訳</button>'
      +`<button type="button" class="u-btn primary" data-action="open-store" data-id="${esc(entity.rawID)}">出店する</button>`
  };
}

function breakdownSheet(entity){
  const {engine,money}=context;
  const estimate=engine.estimateStoreOpening({tenantID:entity.rawID,businessID:chosenBusiness(),operatingHours:3});
  if(!estimate)return null;
  const band=(label,row)=>`<div class="u-row" data-ui3-map="band"><span><b>${esc(label)}</b><small>売上 ${esc(money(row.sales))} · 変動費 ${esc(money(row.variable))} · 固定費 ${esc(money(row.fixed))}</small></span><span class="u-end"><b class="u-money${direction(row.profit)}">${esc(signed(row.profit,money))}</b></span></div>`;
  const body=`${marker}<div class="u-list">${band('弱気',estimate.conservative)}${band('期待',estimate.expected)}${band('強気',estimate.optimistic)}</div>`
    +`<div class="u-list"><div class="u-row"><span><b>設備費</b></span><span class="u-end"><b class="u-money">${esc(money(estimate.storeCost))}</b></span></div>`
    +`<div class="u-row"><span><b>契約保証金</b><small>閉店時の返還なし</small></span><span class="u-end"><b class="u-money">${esc(money(estimate.deposit))}</b></span></div></div>`
    +estimate.caveats.map(text=>`<div class="u-h2">${esc(text)}</div>`).join('');
  return {eyebrow:`${estimate.businessName}の試算`,title:'試算の内訳',subtitle:`${estimate.tenantName} · 週あたり`,body,
    actions:'<button type="button" class="u-btn primary" data-ui3-map-detail>戻る</button>'};
}

// Everything but a tenant: the facts the current detail panel shows, and its existing actions.
function otherSheet(entity){
  const {money}=context;
  const kind=entity.kind;
  const row=(label,value)=>`<div class="u-stat"><span>${esc(label)}</span><b class="u-money">${esc(value)}</b></div>`;
  let title=entity.name,subtitle='',stats='',actions='',more='';
  const close='<button type="button" class="u-btn" data-ui3-map-close>閉じる</button>';
  if(kind==='store'){
    const store=entity.store||{};
    subtitle=store.status==='preparing'?'開業準備中':store.status==='closed'?'閉店':'営業中';
    stats=row('今週の売上',money(finite(store.lastSales)))+row('今週の利益',signed(finite(store.lastProfit),money));
    actions=`${close}<button type="button" class="u-btn primary" data-action="tab" data-tab="business">店舗を見る</button>`;
  }else if(kind==='office'){
    const office=entity.office||{};
    subtitle=office.contracted?'契約中':`グレード${office.grade||'—'}`;
    stats=row('週額賃料',money(office.rent))+row('保証金',money(office.deposit));
    // the same choice js/app.js's office list makes: a branch once a head office exists, else the head office
    const branch=(context.g.branchOffices||[]).some(item=>item.officeID===entity.rawID);
    if(branch)subtitle='支社契約中';
    actions=office.contracted||branch
      ?`${close}<button type="button" class="u-btn primary" data-action="tab" data-tab="office">本社・組織へ</button>`
      :context.g.hasHeadOffice
        ?`${close}<button type="button" class="u-btn primary" data-action="contract-branch-office" data-id="${esc(entity.rawID)}">支社として契約する</button>`
        :`${close}<button type="button" class="u-btn primary" data-action="contract-office" data-id="${esc(entity.rawID)}">契約する</button>`;
  }else if(kind==='realestate'){
    const property=entity.property||{};
    subtitle=property.owner==='company'?'自社保有':property.owner==='personal'?'個人保有':'売出中';
    stats=row('売出価格',money(property.price))+row('週次賃料',money(property.rentIncome));
    const id=esc(entity.rawID);
    const rowAction=(action,label)=>`<button type="button" class="u-row" data-action="${action}" data-id="${id}"><span><b>${label}</b></span><span class="u-end" aria-hidden="true">›</span></button>`;
    more=property.owner
      ?`<div class="u-list" data-ui3-map="more">${`<button type="button" class="u-row" data-ui3-map-sell data-id="${id}"><span><b>この物件を売却</b></span><span class="u-end" aria-hidden="true">›</span></button>`}</div>`
      :`<div class="u-list" data-ui3-map="more">${rowAction('negotiate-property-company','会社で価格交渉')}${rowAction('negotiate-property-personal','個人で価格交渉')}</div>`;
    actions=property.owner
      ?`${close}<button type="button" class="u-btn primary" data-action="tab" data-tab="assets">不動産を見る</button>`
      :`<button type="button" class="u-btn" data-ui3-map-buy="personal" data-id="${id}">個人で購入</button><button type="button" class="u-btn primary" data-ui3-map-buy="company" data-id="${id}">会社で購入</button>`;
  }else{
    const presence=entity.presence||{};
    subtitle='競合店舗';
    stats=row('店舗数',`${Math.round(finite(presence.storeCount))}店`)+row('販売価格',money(presence.price));
    actions=`${close}<button type="button" class="u-btn primary" data-action="tab" data-tab="rivals">競合を見る</button>`;
  }
  return {eyebrow:KIND[kind]||'',title,subtitle,body:`${marker}<div class="u-stats two" data-ui3-map="facts">${stats}</div>${more}`,actions};
}

// Buying and selling a property move money for good, so both go through a confirmation sheet (README 6.6, UI3-10b). The price is the engine's:
// buyProperty charges ceilYen(price) to the chosen wallet; sellProperty pays ceil(value x 0.97) (the same copy as js/ui3-assets.js).
function confirmBuy(owner,id){
  const {g,money}=context;
  const property=(g.properties||[]).find(item=>item.id===id);
  if(!property||property.owner)return;
  const price=Math.ceil(finite(property.price)),wallet=owner==='company'?'会社':'個人',cash=finite(owner==='company'?g.companyCash:g.personalCash);
  const root=modalRoot();
  if(root)root.innerHTML=modules.ui3.confirmSheet({title:`${property.name}を購入`,subtitle:`${wallet}の現金で買います。取り消せません。`,
    facts:[{label:'購入価格',value:money(price)},{label:`実行後の${wallet}現金`,value:money(cash-price),tone:cash-price<0?'down':undefined}],
    note:cash<price?`${wallet}の現金が足りないため、実行しても購入できません。`:'',
    confirm:{label:'購入する',attributes:{'data-action':owner==='company'?'buy-property-company':'buy-property-personal','data-id':id}}});
}
function confirmSell(id){
  const {g,money}=context;
  const property=(g.properties||[]).find(item=>item.id===id);
  if(!property||!property.owner)return;
  const proceeds=Math.ceil(finite(property.value)*.97),wallet=property.owner==='company'?'会社':'個人',cash=finite(property.owner==='company'?g.companyCash:g.personalCash);
  const root=modalRoot();
  if(root)root.innerHTML=modules.ui3.confirmSheet({title:`${property.name}を売却`,subtitle:`${wallet}の物件を売ります。取り消せません。`,
    facts:[{label:'売却額（評価額の97%）',value:money(proceeds),tone:'up'},{label:`実行後の${wallet}現金`,value:money(cash+proceeds)}],
    note:'概算です。譲渡益への税などは、実行後の通知とレポートで確認できます。',
    confirm:{label:'売却する',attributes:{'data-action':'sell-property','data-id':id}}});
}

function openDetail(entity){
  state.sheet='detail';
  show(entity.kind==='tenant'?tenantSheet(entity):otherSheet(entity));
}
function openList(){
  state.sheet='list';
  const entities=visibleEntities();
  const rows=entities.map(entity=>`<button type="button" class="u-row" data-ui3-map-pick="${esc(entity.id)}"><span><b>${esc(entity.name)}</b><small>${esc(KIND[entity.kind]||'')}</small></span><span class="u-end" aria-hidden="true">›</span></button>`).join('');
  show({eyebrow:state.filter==='all'?'すべて':KIND[state.filter],title:'拠点の一覧',subtitle:`${entities.length}件`,
    body:`${marker}${rows?`<div class="u-list" data-ui3-map="list">${rows}</div>`:'<div class="u-h2">表示する拠点がありません。</div>'}`,
    actions:'<button type="button" class="u-btn primary" data-ui3-map-close>閉じる</button>'});
}

function select(id){
  state.selected=id||null;
  state.business=null;
  const entity=entityById(state.selected);
  if(!entity){state.selected=null;closeSheet();}
  refreshMap();
  if(entity){openDetail(entity);focusSelected();}
}
// The same camera move as the current sheet's focus button, reached through the workspace's own
// delegated click handler (`data-city-camera`); `focusY` keeps the pin above the sheet.
function focusSelected(){
  const root=host?.querySelector('.city-lab-map');
  if(!root)return;
  const probe=document.createElement('button');probe.type='button';probe.dataset.cityCamera='focus';probe.hidden=true;
  root.appendChild(probe);probe.click();probe.remove();
}

// ---- events ------------------------------------------------------------------------------------
function onClick(event){
  const target=event.target;
  if(!(target instanceof Element))return;
  const filter=target.closest('[data-ui3-map-filter]');
  if(filter&&host?.contains(filter)){
    state.filter=filter.dataset.ui3MapFilter;
    if(state.selected&&state.filter!=='all'&&entityById(state.selected)?.kind!==state.filter){state.selected=null;closeSheet();}
    refreshMap();decorate();
    return;
  }
  if(target.closest('[data-ui3-map-list]')){openList();return;}
  const inSheet=target.closest('#modal-root .u-sheet,#modal-root .u-scrim');
  if(!inSheet)return;
  // The click a touch tap produces after the pin or list row that opened this sheet lands on the new
  // scrim; it must not close the sheet it just opened.
  if(target.closest('#modal-root .u-scrim')&&performance.now()-state.openedAt<SETTLE_MS){event.stopPropagation();event.preventDefault();return;}
  const buy=target.closest('[data-ui3-map-buy]');
  if(buy){confirmBuy(buy.dataset.ui3MapBuy,buy.dataset.id);return;}
  const sell=target.closest('[data-ui3-map-sell]');
  if(sell){confirmSell(sell.dataset.id);return;}
  const business=target.closest('[data-ui3-map-business]');
  if(business){state.business=business.dataset.ui3MapBusiness;const entity=entityById(state.selected);if(entity)openDetail(entity);return;}
  if(target.closest('[data-ui3-map-breakdown]')){
    const entity=entityById(state.selected),parts=entity&&breakdownSheet(entity);
    if(parts){state.sheet='breakdown';show(parts);}
    return;
  }
  if(target.closest('[data-ui3-map-detail]')){const entity=entityById(state.selected);if(entity)openDetail(entity);return;}
  const mapSheetOpen=Boolean(modalRoot()?.querySelector('[data-ui3-map-sheet]'));
  if(target.closest('[data-ui3-map-close]')||(mapSheetOpen&&target.closest('[data-action="close-modal"]'))){
    state.selected=null;state.sheet=null;
    // the shared handler (js/app.js) clears #modal-root for close-modal; do it here for our own close button
    if(target.closest('[data-ui3-map-close]'))closeSheet();
    refreshMap();
    return;
  }
  const pick=target.closest('[data-ui3-map-pick]');
  if(pick){select(pick.dataset.ui3MapPick);return;}
}

modules.ui3.registerScreen('map',{
  useCurrentUI:()=>unavailable,
  render(){return '<section class="u-map" data-ui3-map aria-label="マップ"></section>';},
  mount(mountContext){
    context=mountContext;host=mountContext.host;
    if(!listening){
      listening=true;
      // Delegated on the document, in the capture phase so it sees the sheet before js/app.js's own
      // handler clears it: the map host is replaced on every render, #modal-root is not.
      globalThis.document.addEventListener('click',onClick,true);
    }
    startMap();
  }
});
function startMap(){
  if(!mapModulesReady()){awaitMapModules();return;}
  const entity=entityById(state.selected);
  if(!entity){state.selected=null;state.sheet=null;}
  if(!refreshMap()){useCurrentMap();return;}
  decorate();
  // the workspace builds its stage asynchronously the first time (assets load), so decorate again then
  if(!host.querySelector('[data-ui3-map-chips]'))waitForStage();
}
function waitForStage(){
  let tries=0;
  const tick=()=>{
    if(!host?.isConnected||unavailable)return;
    if(host.querySelector('.city-lab-stage')){decorate();return;}
    if(++tries<40)setTimeout(tick,50);
  };
  tick();
}
})();
